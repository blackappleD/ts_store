import { Page } from 'puppeteer';
import { Product, UserCredentials, PaymentInfo } from '../../common/interfaces/types';
import { INotificationManager } from './NotificationManager';
import { delay } from '../../utils/helpers';

interface DeliveryInfo {
  firstName: string;
  lastName: string;
  countryCode: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  postalCode: string;
  phone: string;
}

interface CardInfo {
  number: string;
  holderName: string;
  expiry: string;
  cvv: string;
}

export class PurchaseFlow {
  private page: Page | null = null;

  constructor(
    private notificationManager: INotificationManager
  ) {}

  async execute(product: Product, account: UserCredentials, paymentInfo: PaymentInfo): Promise<boolean> {
    try {
      if (!this.page) {
        throw new Error('页面未初始化');
      }

      // 等待页面加载完成
      await this.page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // 检查是否需要处理排队
      if (await this.isInQueue()) {
        if (!await this.handleQueue()) {
          return false;
        }
      }

      // 等待支付信息表单加载
      await this.waitForCheckoutForm();

      // 填写支付信息
      if (!await this.fillPaymentInfo(account, paymentInfo)) {
        return false;
      }

      // 提交订单
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

  private async isInQueue(): Promise<boolean> {
    try {
      return await this.page!.evaluate(() => {
        return document.body.textContent?.includes('re in line to check out') || false;
      });
    } catch {
      return false;
    }
  }

  private async handleQueue(): Promise<boolean> {
    try {
      console.log('进入排队状态，等待中...');
      await this.page!.waitForFunction(
        () => !document.body.textContent?.includes('re in line to check out'),
        { timeout: 300000 } // 5分钟超时
      );
      return true;
    } catch (error) {
      console.error('排队等待失败:', error);
      return false;
    }
  }

  private async waitForCheckoutForm(): Promise<boolean> {
    try {
      console.log('等待结账页面加载...');
      
      // 不再等待导航，而是直接等待页面内容
      await this.page!.waitForFunction(
        () => {
          // 检查URL是否包含checkout
          const isCheckoutUrl = window.location.href.includes('/checkout');
          // 检查页面是否加载完成
          const isLoaded = document.readyState === 'complete';
          return isCheckoutUrl && isLoaded;
        },
        { timeout: 30000 }
      );

      console.log('页面已加载，开始查找表单元素...');

      // 等待任意一个表单元素出现
      const selectors = [
        '[data-email-input]',
        '[data-first-name-input]',
        '[data-last-name-input]',
        '[data-address1-input]',
        'input[type="email"]',
        'input[placeholder*="Email"]',
        'input[placeholder*="First name"]',
        'input[placeholder*="Last name"]',
        'input[placeholder*="Address"]',
        'input[name="number"][autocomplete="cc-number"]'
      ];

      // 使用 Promise.race 等待任意一个元素出现
      await Promise.race(
        selectors.map(selector =>
          this.page!.waitForSelector(selector, {
            visible: true,
            timeout: 30000
          }).then(() => {
            console.log(`找到表单元素: ${selector}`);
            return true;
          }).catch(() => false)
        )
      );

      // 打印当前页面URL和标题，用于调试
      const pageUrl = await this.page!.url();
      const pageTitle = await this.page!.title();
      console.log('当前页面:', { url: pageUrl, title: pageTitle });

      return true;
    } catch (error) {
      console.error('等待结账表单失败:', error);
      return false;
    }
  }

  private async fillPaymentInfo(account: UserCredentials, paymentInfo: PaymentInfo): Promise<boolean> {
    try {
      const { delivery, card, useSameAddress, billingAddress } = paymentInfo;

      // 填充邮箱
      await this.fillField('input[type="email"]', account.username);

      // 填充配送信息
      await this.fillDeliveryInfo(delivery);

      // 选择信用卡支付方式并填写信用卡信息
      await this.fillCreditCardInfo(card);

      // 选择配送方式
      await this.selectShippingMethod();

      // 如果账单地址与配送地址不同，填写账单地址
      if (!useSameAddress && billingAddress) {
        await this.fillBillingInfo(billingAddress);
      }

      return true;
    } catch (error) {
      console.error('填充支付信息失败:', error);
      return false;
    }
  }

  private async fillField(selector: string, value: string | undefined): Promise<void> {
    if (value) {
      await this.page!.waitForSelector(selector, { visible: true });
      await this.page!.type(selector, value);
    }
  }

  private async fillDeliveryInfo(delivery: DeliveryInfo): Promise<void> {
    const deliverySelectors = {
      firstName: 'input[name="firstName"][autocomplete="shipping given-name"]',
      lastName: 'input[name="lastName"][autocomplete="shipping family-name"]',
      country: 'select[name="countryCode"][autocomplete="shipping country"]',
      company: 'input[name="company"]',
      address1: 'input[name="address1"]',
      address2: 'input[name="address2"]',
      city: 'input[name="city"]',
      province: 'select[name="zone"][autocomplete="shipping address-level1"]',
      postalCode: 'input[name="postalCode"]',
      phone: 'input[name="phone"]'
    };

    await this.fillField(deliverySelectors.firstName, delivery.firstName);
    await this.fillField(deliverySelectors.lastName, delivery.lastName);
    await this.selectField(deliverySelectors.country, delivery.countryCode);
    await this.fillField(deliverySelectors.company, delivery.company);
    await this.fillField(deliverySelectors.address1, delivery.address1);
    await this.fillField(deliverySelectors.address2, delivery.address2);
    await this.fillField(deliverySelectors.city, delivery.city);
    
    if (delivery.province?.trim()) {
      await this.selectField(deliverySelectors.province, delivery.province);
    }
    
    await this.fillField(deliverySelectors.postalCode, delivery.postalCode);
    await this.fillField(deliverySelectors.phone, delivery.phone);
  }

  private async fillCreditCardInfo(card: CardInfo | undefined): Promise<void> {
    if (!card) return;

    const cardSelectors = {
      radio: [
        'input[id="basic-creditCards"]',
        'input[value="credit_card"]',
        'input[name="basic"][value="creditCards"]',
        'input[data-payment-method="credit_card"]'
      ].join(','),
      number: '#number',
      name: '#name',
      expiry: '#expiry',
      cvv: '#verification_value'
    };

    // 选择信用卡支付方式
    await this.page!.waitForSelector(cardSelectors.radio, { visible: true });
    await this.page!.click(cardSelectors.radio);
    
    // 使用 evaluate 来等待一段时间，替代 waitForTimeout
    await this.page!.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

    // 填写信用卡信息
    await this.fillField(cardSelectors.number, card.number);
    await this.fillField(cardSelectors.name, card.holderName);
    await this.fillField(cardSelectors.expiry, card.expiry);
    await this.fillField(cardSelectors.cvv, card.cvv);
  }

  private async fillBillingInfo(billing: DeliveryInfo): Promise<void> {
    const billingSelectors = {
      country: 'select[autocomplete="billing country"]',
      firstName: 'input[name="firstName"][autocomplete="billing given-name"]',
      lastName: 'input[name="lastName"][autocomplete="billing family-name"]',
      company: 'input[name="company"][autocomplete="billing organization"]',
      address1: 'input[name="address1"][autocomplete="billing address-line1"]',
      address2: 'input[name="address2"][autocomplete="billing address-line2"]',
      city: 'input[name="city"][autocomplete="billing address-level2"]',
      province: 'select[name="zone"][autocomplete="billing address-level1"]',
      postalCode: 'input[name="postalCode"][autocomplete="billing postal-code"]',
      phone: 'input[name="phone"][autocomplete="billing tel"]'
    };

    await this.selectField(billingSelectors.country, billing.countryCode);
    await this.fillField(billingSelectors.firstName, billing.firstName);
    await this.fillField(billingSelectors.lastName, billing.lastName);
    await this.fillField(billingSelectors.company, billing.company);
    await this.fillField(billingSelectors.address1, billing.address1);
    await this.fillField(billingSelectors.address2, billing.address2);
    await this.fillField(billingSelectors.city, billing.city);
    
    if (billing.province?.trim()) {
      await this.selectField(billingSelectors.province, billing.province);
    }
    
    await this.fillField(billingSelectors.postalCode, billing.postalCode);
    await this.fillField(billingSelectors.phone, billing.phone);
  }

  private async selectField(selector: string, value: string): Promise<void> {
    await this.page!.waitForSelector(selector, { visible: true });
    await this.page!.select(selector, value);
  }

  private async selectShippingMethod(): Promise<void> {
    const shippingMethodElements = await this.page!.$$('input[name="shippingMethod"]');
    if (shippingMethodElements.length > 0) {
      await shippingMethodElements[0].click();
    }
  }

  private async submitOrder(): Promise<boolean> {
    try {
      // 点击最终的支付按钮
      await this.page!.click('#continue_button');
      
      // 等待订单确认页面
      await this.page!.waitForSelector('.order-summary__section--payment-lines', {
        timeout: 10000
      });
      
      // 如果需要手动确认支付，这里可以等待用户操作
      // await this.page!.waitForSelector('.payment-confirmed', { timeout: 300000 }); // 5分钟超时

      return true;
    } catch (error: unknown) {
      console.error('提交订单失败:', error);
      return false;
    }
  }

  // 设置页面实例的方法
  public setPage(page: Page) {
    this.page = page;
  }
} 