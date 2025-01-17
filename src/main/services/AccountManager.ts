import Store from 'electron-store';
import { UserCredentials, PurchaseSettings } from '../../common/interfaces/types';

interface StoreSchema {
  accounts: UserCredentials[];
  purchaseSettings: PurchaseSettings;
}

export class AccountManagerService {
  private static instance: AccountManagerService;
  private store: Store<StoreSchema>;

  private constructor() {
    this.store = new Store<StoreSchema>({
      name: 'accounts',
      defaults: {
        accounts: [],
        purchaseSettings: {
          singleAccountLimit: 1,
          quantityPerOrder: 1
        }
      }
    });
  }

  public static getInstance(): AccountManagerService {
    if (!AccountManagerService.instance) {
      AccountManagerService.instance = new AccountManagerService();
    }
    return AccountManagerService.instance;
  }

  public async getAccounts(): Promise<UserCredentials[]> {
    return this.store.get('accounts', []);
  }

  public async saveAccounts(accounts: UserCredentials[]): Promise<void> {
    await this.store.set('accounts', accounts);
  }

  public async updateAccount(username: string, updates: Partial<UserCredentials>): Promise<void> {
    const accounts = await this.getAccounts();
    const index = accounts.findIndex(acc => acc.username === username);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      await this.saveAccounts(accounts);
    }
  }

  public async hasPaymentInfo(username: string): Promise<boolean> {
    const accounts = await this.getAccounts();
    const account = accounts.find(acc => acc.username === username);
    return account?.hasPaymentInfo || false;
  }

  public async savePurchaseSettings(settings: PurchaseSettings): Promise<void> {
    try {
      await this.store.set('purchaseSettings', settings);
    } catch (error) {
      console.error('保存购买设置失败:', error);
      throw error;
    }
  }

  public async getPurchaseSettings(): Promise<PurchaseSettings> {
    try {
      return this.store.get('purchaseSettings');
    } catch (error) {
      console.error('读取购买设置失败:', error);
      throw error;
    }
  }
} 