import Store from 'electron-store';
import { PaymentInfo } from '../../common/interfaces/types';

export class PaymentInfoManager {
  private static instance: PaymentInfoManager;
  private store: Store<{[key: string]: PaymentInfo}>;

  private constructor() {
    this.store = new Store<{[key: string]: PaymentInfo}>({
      name: 'payment-info',
      defaults: {}
    });
  }

  public static getInstance(): PaymentInfoManager {
    if (!PaymentInfoManager.instance) {
      PaymentInfoManager.instance = new PaymentInfoManager();
    }
    return PaymentInfoManager.instance;
  }

  public async getPaymentInfo(username: string): Promise<PaymentInfo | null> {
    return this.store.get(`payment-info.${username}`) as PaymentInfo | null;
  }

  public async savePaymentInfo(username: string, info: PaymentInfo): Promise<void> {
    if (!info.accountId) {
      info = {
        ...info,
        accountId: username
      };
    }
    await this.store.set(`payment-info.${username}`, info);
  }

  public async hasPaymentInfo(username: string): Promise<boolean> {
    const info = await this.getPaymentInfo(username);
    return !!info;
  }
} 