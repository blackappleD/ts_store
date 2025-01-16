import { EventEmitter } from 'events';
import puppeteer, { Browser, Page } from 'puppeteer';
import { Config, Product, UserCredentials } from '../../common/interfaces/types';
import { INotificationManager } from './NotificationManager';
import { AccountManagerService } from './AccountManager';
import { PaymentInfoManager } from './PaymentInfoManager';
import { PurchaseFlow } from './PurchaseFlow';
import { delay } from '../../utils/helpers';

export class ProductMonitor extends EventEmitter {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private retryCount: number = 0;
  private accountManager: AccountManagerService;
  private paymentInfoManager: PaymentInfoManager;

  private readonly TIMEOUTS = {
    PAGE_LOAD: 10000,
    BUTTON_CHECK: 100,
    CLICK_DELAY: 1000,
    CART_NOTIFY: 2000,
    RANDOM_DELAY: 200
  };

  constructor(
    private config: Config,
    private notificationManager: INotificationManager
  ) {
    super();
    this.accountManager = AccountManagerService.getInstance();
    this.paymentInfoManager = PaymentInfoManager.getInstance();
  }

  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    // 检查多账号配置
    if (this.config.purchaseStrategy.multiAccount) {
      const accounts = await this.accountManager.getAccounts();
      
      // 检查所有账号的支付信息
      const unconfiguredAccounts = accounts.filter(async (account) => 
        !(await this.paymentInfoManager.hasPaymentInfo(account.username))
      );

      if (unconfiguredAccounts.length > 0) {
        const accountNames = unconfiguredAccounts.map(a => a.username).join('/');
        throw new Error(`多账号抢购需要为每个账号配置支付信息，${accountNames}账号未配置`);
      }
    }

    try {
      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      this.page = await this.browser.newPage();
      
      // 设置页面缓存禁用
      await this.page.setCacheEnabled(false);
      
      // 设置请求拦截
      await this.page.setRequestInterception(true);
      this.page.on('request', request => {
        const headers = {
          ...request.headers(),
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };
        request.continue({ headers });
      });

      this.isMonitoring = true;
      this.retryCount = 0;

      await this.checkAvailability();
      this.monitoringInterval = setInterval(
        () => this.checkAvailability(),
        this.config.refreshInterval
      );

    } catch (error) {
      console.error('启动监控失败:', error);
      throw error;
    }
  }

  private async waitForButtonAndClick(): Promise<boolean> {
    let checkCount = 0;
    const maxChecks = 50; // 最多检查5秒 (100ms * 50)

    while (checkCount < maxChecks) {
      const buttonInfo = await this.page!.evaluate(() => {
        const addToCartButton = document.querySelector('button[name="add"]') as HTMLButtonElement | null;
        if (!addToCartButton) return { exists: false };

        const isClickable = !addToCartButton.disabled && 
          !addToCartButton.classList.contains('disabled') &&
          getComputedStyle(addToCartButton).display !== 'none' &&
          getComputedStyle(addToCartButton).visibility !== 'hidden';

        return {
          exists: true,
          isClickable,
          text: addToCartButton.textContent?.trim() || ''
        };
      });

      if (buttonInfo.exists && buttonInfo.isClickable) {
        console.log('找到可点击的Add按钮，等待1秒后点击...');
        await delay(this.TIMEOUTS.CLICK_DELAY);
        
        // 再次确认按钮状态，避免1秒等待期间按钮状态改变
        const finalCheck = await this.page!.evaluate(() => {
          const button = document.querySelector('button[name="add"]') as HTMLButtonElement | null;
          if (button && 
              !button.disabled && 
              !button.classList.contains('disabled') &&
              getComputedStyle(button).display !== 'none' &&
              getComputedStyle(button).visibility !== 'hidden') {
            button.click();
            return true;
          }
          return false;
        });

        return finalCheck;
      }

      await delay(this.TIMEOUTS.BUTTON_CHECK);
      checkCount++;
    }

    return false;
  }

  private async checkAvailability(): Promise<void> {
    if (!this.page) return;

    try {
      await delay(Math.random() * this.TIMEOUTS.RANDOM_DELAY);

      const response = await this.page.goto(this.config.targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.TIMEOUTS.PAGE_LOAD
      });

      if (!response || (response.status() !== 200 && response.status() !== 304)) {
        throw new Error(`页面加载失败: ${response?.status()}`);
      }

      // 检查商品信息
      const productInfo = await this.page.evaluate(() => {
        const titleElement = document.querySelector('.product-title, .product-name, h1');
        const priceElement = document.querySelector('.product-price, .price');
        const soldOutLabel = document.querySelector('.sold-out-label, .sold-out');
        const outOfStockLabel = document.querySelector('.out-of-stock');
        const stockElement = document.querySelector('.stock-count, .inventory-quantity');
        const stockCount = stockElement ? parseInt(stockElement.textContent || '0') : null;

        return {
          available: !soldOutLabel && !outOfStockLabel && (stockCount === null || stockCount > 0),
          name: titleElement?.textContent?.trim() || '',
          price: priceElement ? parseFloat(priceElement.textContent?.replace(/[^\d.]/g, '') || '0') : 0
        };
      });

      if (productInfo.available) {
        console.log('商品状态:', productInfo);

        // 获取可用账号
        const account = await this.getAvailableAccount();
        if (!account) {
          console.log('没有可用账号');
          return;
        }

        // 使用选定账号登录
        if (!await this.loginWithAccount(account)) {
          console.log('账号登录失败');
          return;
        }

        // 添加指定数量商品到购物车
        const quantity = this.config.purchaseStrategy.purchaseLimit?.quantityPerOrder ?? 1;
        if (!await this.addToCartWithQuantity(quantity)) {
          console.log('添加商品到购物车失败');
          return;
        }

        // 等待购物车通知
        try {
          await this.page.waitForSelector('.cart-notification', { 
            timeout: this.TIMEOUTS.CART_NOTIFY,
            visible: true
          });
          console.log('成功添加到购物车');

          if (this.config.purchaseStrategy.priceLimit && 
              productInfo.price > (this.config.purchaseStrategy.maxPrice ?? 0)) {
            console.log('商品价格超出限制:', productInfo.price);
            return;
          }

          await this.notificationManager.notify(
            '商品已添加到购物车',
            `${productInfo.name}\n价格: $${productInfo.price}\n开始自动购买流程`,
            'success'
          );

          if (this.config.purchaseStrategy.autoPurchase) {
            const paymentInfo = await this.paymentInfoManager.getPaymentInfo(account.username);
            if (!paymentInfo) {
              console.log('未找到支付信息');
              return;
            }

            const currentProduct: Product = {
              id: Date.now().toString(),
              name: productInfo.name,
              price: productInfo.price,
              url: this.config.targetUrl,
              available: true
            };

            const purchaseFlow = new PurchaseFlow(this.notificationManager);
            await purchaseFlow.execute(currentProduct, account, paymentInfo);
          }

          this.stopMonitoring();
        } catch (error) {
          console.error('添加到购物车失败:', error);
        }
      }

      this.retryCount = 0;

    } catch (error: unknown) {
      console.error('检查商品状态失败:', error);
      this.retryCount++;

      if (this.config.autoRetry && this.retryCount < this.config.maxRetries) {
        const retryDelay = Math.min(this.config.refreshInterval, 1000);
        console.log(`将在 ${retryDelay}ms 后重试，当前重试次数: ${this.retryCount}`);
      } else {
        this.stopMonitoring();
        throw error;
      }
    }
  }

  private async getAvailableAccount(): Promise<UserCredentials | null> {
    const accounts = await this.accountManager.getAccounts();
    
    if (this.config.purchaseStrategy.multiAccount) {
      // 过滤出未达到下单限制的账号
      const availableAccounts = accounts.filter(account => 
        (account.orderCount || 0) < (this.config.purchaseStrategy.purchaseLimit?.singleAccountLimit || 1)
      );
      
      if (availableAccounts.length === 0) return null;
      
      // 随机选择一个账号
      return availableAccounts[Math.floor(Math.random() * availableAccounts.length)];
    } else {
      // 使用默认账号
      return accounts.find(account => account.isDefault) || null;
    }
  }

  private async loginWithAccount(account: UserCredentials): Promise<boolean> {
    try {
      await this.page!.type('#customer_email', account.username);
      await this.page!.type('#customer_password', account.password);
      await this.page!.click('#customer_login');
      
      // 等待登录成功
      await this.page!.waitForSelector('.account-summary', { timeout: 5000 });
      return true;
    } catch (error) {
      console.error('登录失败:', error);
      return false;
    }
  }

  private async addToCartWithQuantity(quantity: number): Promise<boolean> {
    try {
      // 设置商品数量
      await this.page!.evaluate((qty) => {
        const quantityInput = document.querySelector('input[name="quantity"]') as HTMLInputElement;
        if (quantityInput) quantityInput.value = qty.toString();
      }, quantity);

      // 点击添加到购物车按钮
      const clicked = await this.waitForButtonAndClick();
      if (!clicked) return false;

      // 等待购物车通知
      await this.page!.waitForSelector('.cart-notification', { 
        timeout: this.TIMEOUTS.CART_NOTIFY,
        visible: true
      });

      return true;
    } catch (error) {
      console.error('添加商品到购物车失败:', error);
      return false;
    }
  }

  public stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.browser) {
      this.browser.close();
      this.browser = null;
    }
    this.page = null;
    this.retryCount = 0;
  }

  private async checkPaymentInfo(username: string): Promise<boolean> {
    try {
      const info = await this.paymentInfoManager.getPaymentInfo(username);
      return !!info;
    } catch (error) {
      console.error('检查支付信息失败:', error);
      return false;
    }
  }
} 