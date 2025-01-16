import Store from 'electron-store';
import { UserCredentials } from '../../common/interfaces/types';

export class AccountManagerService {
  private static instance: AccountManagerService;
  private store: Store;

  private constructor() {
    this.store = new Store({
      name: 'accounts'
    });
  }

  public static getInstance(): AccountManagerService {
    if (!AccountManagerService.instance) {
      AccountManagerService.instance = new AccountManagerService();
    }
    return AccountManagerService.instance;
  }

  public async getAccounts(): Promise<UserCredentials[]> {
    return this.store.get('accounts', []) as UserCredentials[];
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
} 