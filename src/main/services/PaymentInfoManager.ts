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
    return this.store.get(username) as PaymentInfo | null;
  }

  public async savePaymentInfo(username: string, info: PaymentInfo): Promise<void> {
    info = {
      ...info,
      accountId: username
    };
    await this.store.set(username, info);
  }

  public async hasPaymentInfo(username: string): Promise<boolean> {
    return this.store.has(username);
  }
} 