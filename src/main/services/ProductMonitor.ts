import {EventEmitter} from 'events';
import puppeteer, {Browser, Page, BrowserContext} from 'puppeteer';
import {Config, Product, UserCredentials, AccountSession, PaymentInfo} from '../../common/interfaces/types';
import {INotificationManager} from './NotificationManager';
import {AccountManagerService} from './AccountManager';
import {PaymentInfoManager} from './PaymentInfoManager';
import {PurchaseFlow} from './PurchaseFlow';
import {delay} from '../../utils/helpers';

export class ProductMonitor extends EventEmitter {
    private browser: Browser | null = null;
    private sessions: Map<string, AccountSession> = new Map();
    private isMonitoring: boolean = false;
    private readonly config: Config;

    constructor(
        config: Config,
        private readonly notificationManager: INotificationManager,
        private readonly accountManager: AccountManagerService,
        private readonly paymentInfoManager: PaymentInfoManager
    ) {
        super();
        this.config = {
            targetUrl: config.targetUrl || '',
            refreshInterval: config.refreshInterval || 1000,
            autoRetry: config.autoRetry ?? true,
            maxRetries: config.maxRetries || 3,
            notificationEnabled: config.notificationEnabled ?? true,
            maxConcurrentSessions: config.maxConcurrentSessions || 5,
            retryDelay: config.retryDelay || 5000,
            timeouts: {
                elementWait: config.timeouts?.elementWait || 5000,
                navigation: config.timeouts?.navigation || 30000,
                pageLoad: config.timeouts?.pageLoad || 30000
            },
            purchaseStrategy: {
                autoPurchase: config.purchaseStrategy?.autoPurchase ?? false,
                multiAccount: config.purchaseStrategy?.multiAccount ?? false,
                priceLimit: config.purchaseStrategy?.priceLimit ?? false,
                maxPrice: config.purchaseStrategy?.maxPrice || 0,
                purchaseLimit: {
                    singleAccountLimit: config.purchaseStrategy?.purchaseLimit?.singleAccountLimit || 1,
                    quantityPerOrder: config.purchaseStrategy?.purchaseLimit?.quantityPerOrder || 1
                }
            }
        };
    }

    private async createSession(account: UserCredentials, index: number): Promise<void> {
        const paymentInfo = await this.paymentInfoManager.getPaymentInfo(account.username);
        if (!paymentInfo) return;

        // 创建独立的浏览器上下文
        const context = await this.browser!.createBrowserContext();
        const page = await context.newPage();
        
        // 设置页面位置，每个窗口错开显示
        const offset = index * 50;  // 每个窗口错开50像素
        await page.evaluate((x, y) => {
            window.moveTo(x, y);
        }, 50 + offset, 50 + offset);

        // 设置页面超时
        await page.setDefaultNavigationTimeout(this.config.timeouts.navigation);

        // 创建会话
        this.sessions.set(account.username, {
            username: account.username,
            credentials: account,
            paymentInfo,
            page,
            context,
            isMonitoring: false,
            retryCount: 0
        });

        // 启动监控
        void this.startSessionMonitoring(account.username);
    }

    public async startMonitoring(): Promise<void> {
        if (this.isMonitoring) return;
        
        try {
            this.browser = await puppeteer.launch({
                headless: false,
                defaultViewport: {
                    width: 1280,
                    height: 800
                },
                args: [
                    `--window-size=1280,800`
                ]
            });

            // 获取所有账号
            const accounts = await this.accountManager.getAccounts();
            
            // 为每个账号创建会话，传入索引用于计算窗口位置
            for (let i = 0; i < accounts.length; i++) {
                await this.createSession(accounts[i], i);
            }

            this.isMonitoring = true;
        } catch (error) {
            console.error('启动监控失败:', error);
            await this.cleanup();
            throw error;
        }
    }

    private async startSessionMonitoring(username: string): Promise<void> {
        const session = this.sessions.get(username);
        if (!session) return;

        session.isMonitoring = true;
        console.log(`开始账号 ${username} 的监控`);

        const monitorLoop = async (): Promise<void> => {
            if (!session.isMonitoring) return;

            try {
                await session.page.goto(this.config.targetUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: this.config.timeouts.navigation
                });

                const isAvailable = await this.checkProductAvailable(session.page);
                
                if (isAvailable) {
                    console.log(`账号 ${username} 检测到商品可购买`);
                    session.isMonitoring = false;

                    try {
                        const product = await this.getProductInfo(session.page);
                        
                        // 发出商品可用事件
                        this.emit('product-available', product);

                        // 创建购买流程
                        const purchaseFlow = new PurchaseFlow(this.notificationManager);
                        purchaseFlow.setPage(session.page);

                        // 获取购买设置
                        const purchaseSettings = await AccountManagerService.getInstance().getPurchaseSettings();
                        // 使用购买设置
                        const quantity = purchaseSettings.quantityPerOrder;

                        // 执行购买
                        const success = await purchaseFlow.execute(
                            product,
                            session.credentials,
                            session.paymentInfo,
                            this.config.purchaseStrategy.autoPurchase,
                            quantity
                        );

                        if (success) {
                            await this.notificationManager.notify(
                                '购买成功',
                                `账号 ${username} 成功购买商品`,
                                'success'
                            );
                        }
                    } catch (error) {
                        console.error(`账号 ${username} 购买失败:`, error);
                        session.retryCount++;
                        
                        if (session.retryCount < this.config.maxRetries) {
                            session.isMonitoring = true;
                            setTimeout(() => void monitorLoop(), this.config.retryDelay);
                        }
                    }
                } else {
                    const randomDelay = this.config.refreshInterval + Math.random() * 500;
                    setTimeout(() => void monitorLoop(), randomDelay);
                }
            } catch (error) {
                console.error(`账号 ${username} 监控失败:`, error);
                session.retryCount++;
                
                if (session.retryCount < this.config.maxRetries) {
                    setTimeout(() => void monitorLoop(), this.config.retryDelay);
                }
            }
        };

        void monitorLoop();
    }

    public async stopMonitoring(): Promise<void> {
        this.isMonitoring = false;
        await this.cleanup();
    }

    private async cleanup(): Promise<void> {
        // 停止所有会话
        for (const session of this.sessions.values()) {
            session.isMonitoring = false;
            await session.page.close().catch(() => {});
            await session.context.close().catch(() => {});
        }

        // 关闭浏览器
        if (this.browser) {
            await this.browser.close().catch(() => {});
            this.browser = null;
        }

        this.sessions.clear();
    }

    private async checkProductAvailable(page: Page): Promise<boolean> {
        try {
            await page.waitForSelector('button[name="add"], .add-to-cart, .add_to_cart', {
                timeout: this.config.timeouts.elementWait
            });

            const isAvailable = await page.evaluate(() => {
                const addButton = document.querySelector('button[name="add"], .add-to-cart, .add_to_cart') as HTMLButtonElement;
                const soldOutLabel = document.querySelector('.sold-out-label, .sold-out');
                const outOfStockLabel = document.querySelector('.out-of-stock');
                const stockElement = document.querySelector('.stock-count, .inventory-quantity');
                const stockCount = stockElement ? parseInt(stockElement.textContent || '0') : null;

                return addButton && 
                    !addButton.disabled && 
                    !addButton.classList.contains('disabled') &&
                    !soldOutLabel && 
                    !outOfStockLabel && 
                    (stockCount === null || stockCount > 0);
            });

            if (isAvailable) {
                console.log('商品可购买');
            }

            return isAvailable;
        } catch (error) {
            console.error('检查商品可用性失败:', error);
            return false;
        }
    }

    private async getProductInfo(page: Page): Promise<Product> {
        const productInfo = await page.evaluate(() => {
            const titleElement = document.querySelector('.product-title, .product-name, h1');
            const priceElement = document.querySelector('.product-price, .price');
            const addButton = document.querySelector('button[name="add"], .add-to-cart, .add_to_cart');

            return {
                name: titleElement?.textContent?.trim() || 'Unknown Product',
                price: priceElement ? parseFloat(priceElement.textContent?.replace(/[^\d.]/g, '') || '0') : 0,
                available: addButton instanceof HTMLButtonElement && !addButton.disabled
            };
        });

        return {
            id: this.config.targetUrl,
            url: this.config.targetUrl,
            ...productInfo
        };
    }
} 