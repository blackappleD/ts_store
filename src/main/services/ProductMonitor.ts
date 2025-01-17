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
    RANDOM_DELAY: 200,
    ELEMENT_WAIT: 5000
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
      
      // 使用 Promise.all 等待所有账号的支付信息检查完成
      const unconfiguredAccounts = await Promise.all(
        accounts.map(async (account) => {
          const hasPaymentInfo = await this.paymentInfoManager.hasPaymentInfo(account.username);
          return hasPaymentInfo ? null : account.username;
        })
      ).then(results => results.filter(username => username !== null));

      if (unconfiguredAccounts.length > 0) {
        const accountNames = unconfiguredAccounts.join('/');
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

  private async getProductInfo(): Promise<{ available: boolean; name: string; price: number }> {
    if (!this.page) throw new Error('Page not initialized');

    await delay(Math.random() * this.TIMEOUTS.RANDOM_DELAY);

    const response = await this.page.goto(this.config.targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: this.TIMEOUTS.PAGE_LOAD
    });

    if (!response || (response.status() !== 200 && response.status() !== 304)) {
      throw new Error(`页面加载失败: ${response?.status()}`);
    }

    // 检查商品信息
    return await this.page.evaluate(() => {
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
  }

  private async checkAvailability(): Promise<void> {
    try {
      if (!this.page) return;

      // 检查商品状态
      const productInfo = await this.getProductInfo();
      
      if (productInfo.available) {
        console.log('商品状态:', productInfo);

        // 获取可用账号
        const account = await this.getAvailableAccount();
        if (!account) {
          console.log('没有可用账号');
          return;
        }

        // 获取购买设置
        const purchaseSettings = await AccountManagerService.getInstance().getPurchaseSettings();
        
        // 使用购买设置
        const quantity = purchaseSettings.quantityPerOrder;
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
            // 获取选定账号的支付信息
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

            // 直接进入购买流程，不需要登录
            const purchaseFlow = new PurchaseFlow(this.notificationManager);
            await purchaseFlow.execute(currentProduct, account, paymentInfo);
          }

          this.stopMonitoring();
        } catch (error) {
          console.error('添加到购物车失败:', error);
        }
      }
    } catch (error) {
      console.error('检查商品状态失败:', error);
      if (this.config.autoRetry && this.retryCount < this.config.maxRetries) {
        this.retryCount++;
        console.log(`重试第 ${this.retryCount} 次`);
      } else {
        this.emit('error', error);
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

  private async addToCartWithQuantity(quantity: number): Promise<boolean> {
    try {
      if (!this.page) return false;

      // 等待Add按钮出现并可点击
      const addButton = await this.page.waitForSelector('button[name="add"], .add-to-cart, .add_to_cart', {
        visible: true,
        timeout: this.TIMEOUTS.ELEMENT_WAIT
      });

      if (!addButton) {
        console.log('未找到添加购物车按钮');
        return false;
      }

      // 如果有数量输入框，设置数量
      const quantityInput = await this.page.$('input[name="quantity"], .quantity-input');
      if (quantityInput) {
        await quantityInput.click({ clickCount: 3 }); // 全选当前值
        await quantityInput.type(quantity.toString());
      }

      console.log('找到可点击的Add按钮，等待1秒后点击...');
      await delay(1000); // 等待1秒再点击

      // 点击添加按钮
      await addButton.click();

      // 等待侧边购物车出现和checkout按钮
      try {
        // 等待侧边购物车面板
        await this.page.waitForSelector('.cart-drawer, .cart-sidebar, [data-cart-drawer], .drawer--right[data-drawer]', {
          visible: true,
          timeout: 5000
        });

        console.log('侧边购物车已打开，等待Checkout按钮...');

        // 等待Checkout按钮出现
        await this.page.waitForSelector(
          'a[href="/checkout"], button[name="checkout"], .checkout-button, .go-to-checkout, [data-checkout-button]', 
          {
            visible: true,
            timeout: 5000
          }
        );

        console.log('商品已成功添加到购物车，且找到了Checkout按钮');
        return true;
      } catch (error) {
        // 如果没有找到侧边购物车或Checkout按钮，检查其他可能的成功指示
        try {
          await Promise.race([
            // 检查购物车数量变化
            this.page.waitForFunction(
              () => {
                const cartCount = document.querySelector('.cart-count, .cart-items-count');
                return cartCount && parseInt(cartCount.textContent || '0') > 0;
              },
              { timeout: 3000 }
            ),
            // 检查是否直接跳转到购物车或结账页面
            this.page.waitForFunction(
              () => {
                const url = window.location.href;
                return url.includes('/cart') || url.includes('/checkout');
              },
              { timeout: 3000 }
            )
          ]);
          
          console.log('商品已添加到购物车（通过替代方式确认）');
          return true;
        } catch (innerError) {
          console.error('等待购物车更新失败:', error);
          return false;
        }
      }
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