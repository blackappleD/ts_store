import { Browser, Page } from 'puppeteer';
import { UserCredentials, PaymentInfo, Product } from '../../common/interfaces/types';
import { INotificationManager } from './NotificationManager';
import { delay } from '../../utils/helpers';

export class PurchaseFlow {
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(
    private notificationManager: INotificationManager
  ) {}

  async execute(product: Product, account: UserCredentials, paymentInfo: PaymentInfo): Promise<boolean> {
    try {
      // 1. 打开商品页面并检查库存
      if (!await this.openProductPage(product.url)) {
        return false;
      }

      // 2. 添加商品到购物车
      if (!await this.addToCart()) {
        return false;
      }

      // 3. 进入购物车页面
      if (!await this.goToCart()) {
        return false;
      }

      // 4. 点击 GO TO CHECKOUT
      if (!await this.goToCheckout()) {
        return false;
      }

      // 5. 处理排队情况
      if (!await this.handleQueue()) {
        return false;
      }

      // 6. 填写支付信息
      if (!await this.fillPaymentInfo(paymentInfo)) {
        return false;
      }

      // 7. 提交订单
      if (!await this.submitOrder()) {
        return false;
      }

      await this.notificationManager.notify(
        '购买成功',
        `成功购买商品: ${product.name}`,
        'success'
      );

      return true;
    } catch (error: unknown) {
      console.error('购买流程执行失败:', error);
      await this.notificationManager.notify(
        '购买失败',
        `购买商品失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'error'
      );
      return false;
    }
  }

  private async openProductPage(url: string): Promise<boolean> {
    try {
      const response = await this.page!.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      if (!response || !response.ok()) {
        throw new Error('商品页面加载失败');
      }

      // 检查库存
      const hasStock = await this.page!.evaluate(() => {
        const addToCartButton = document.querySelector('button[name="add"]');
        const soldOutLabel = document.querySelector('.sold-out-label, .sold-out');
        return addToCartButton && !soldOutLabel;
      });

      if (!hasStock) {
        throw new Error('商品已售罄');
      }

      return true;
    } catch (error: unknown) {
      console.error('打开商品页面失败:', error);
      return false;
    }
  }

  private async addToCart(): Promise<boolean> {
    try {
      await this.page!.click('button[name="add"]');
      await this.page!.waitForSelector('.cart-notification', { timeout: 5000 });
      return true;
    } catch (error: unknown) {
      console.error('添加到购物车失败:', error);
      return false;
    }
  }

  private async goToCart(): Promise<boolean> {
    try {
      await this.page!.click('.cart-link');
      await this.page!.waitForSelector('.cart-items', { timeout: 5000 });
      return true;
    } catch (error: unknown) {
      console.error('进入购物车失败:', error);
      return false;
    }
  }

  private async goToCheckout(): Promise<boolean> {
    try {
      await this.page!.click('button[name="checkout"]');
      return true;
    } catch (error: unknown) {
      console.error('进入结账页面失败:', error);
      return false;
    }
  }

  private async handleQueue(): Promise<boolean> {
    try {
      // 检查是否进入排队页面
      const isQueuing = await this.page!.evaluate(() => {
        return document.body.textContent?.includes('re in line to check out');
      });

      if (isQueuing) {
        console.log('进入排队状态，等待中...');
        // 等待排队结束
        await this.page!.waitForFunction(
          () => !document.body.textContent?.includes('re in line to check out'),
          { timeout: 300000 } // 5分钟超时
        );
      }

      return true;
    } catch (error: unknown) {
      console.error('排队等待失败:', error);
      return false;
    }
  }

  private async fillPaymentInfo(paymentInfo: PaymentInfo): Promise<boolean> {
    try {
      const { delivery } = paymentInfo;
      
      // 填写配送信息
      await this.page!.type('#checkout_shipping_address_first_name', delivery.firstName);
      await this.page!.type('#checkout_shipping_address_last_name', delivery.lastName);
      await this.page!.type('#checkout_shipping_address_address1', delivery.address1);
      await this.page!.type('#checkout_shipping_address_city', delivery.city);
      await this.page!.type('#checkout_shipping_address_zip', delivery.postalCode);
      await this.page!.type('#checkout_shipping_address_phone', delivery.phone);

      // 继续到支付方式选择
      await this.page!.click('#continue_button');
      await delay(1000);

      // 继续到支付页面
      await this.page!.click('#continue_button');
      await delay(1000);

      return true;
    } catch (error: unknown) {
      console.error('填写支付信息失败:', error);
      return false;
    }
  }

  private async submitOrder(): Promise<boolean> {
    try {
      await this.page!.click('#continue_button');
      await this.page!.waitForSelector('.order-summary__section--payment-lines', {
        timeout: 5000
      });
      return true;
    } catch (error: unknown) {
      console.error('提交订单失败:', error);
      return false;
    }
  }
} 