import { ipcMain } from 'electron';
import Store from 'electron-store';
import { Config, StoredConfig } from '../../common/interfaces/types';

export class ConfigManager {
  private store: Store<StoredConfig>;
  private defaultConfig: Config = {
    targetUrl: '',
    refreshInterval: 5000,
    autoRetry: true,
    maxRetries: 3,
    notificationEnabled: true,
    purchaseStrategy: {
      autoPurchase: false,
      multiAccount: false,
      priceLimit: false,
      maxPrice: 0,
      purchaseLimit: {
        singleAccountLimit: 1,
        quantityPerOrder: 1
      }
    }
  };

  constructor() {
    this.store = new Store<StoredConfig>({
      defaults: {
        ...this.defaultConfig,
        credentials: '',
        paymentInfo: ''
      }
    });

    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    ipcMain.handle('get-config', () => {
      return this.getConfig();
    });

    ipcMain.handle('save-config', async (_, config: Config) => {
      return this.saveConfig(config);
    });

    ipcMain.handle('reset-config', () => {
      return this.resetConfig();
    });
  }

  public getConfig(): Config {
    try {
      const config = {
        targetUrl: this.store.get('targetUrl', ''),
        refreshInterval: this.store.get('refreshInterval', 5000),
        autoRetry: this.store.get('autoRetry', true),
        maxRetries: this.store.get('maxRetries', 3),
        notificationEnabled: this.store.get('notificationEnabled', true),
        purchaseStrategy: this.store.get('purchaseStrategy', {
          autoPurchase: false,
          multiAccount: false,
          priceLimit: false,
          maxPrice: 0,
          purchaseLimit: {
            singleAccountLimit: 1,
            quantityPerOrder: 1
          }
        })
      };
      console.log('Retrieved config from store:', config);
      return config;
    } catch (error) {
      console.error('Error getting config:', error);
      return this.defaultConfig;
    }
  }

  public async saveConfig(config: Config): Promise<void> {
    console.log('Attempting to save config:', config);
    
    if (!config) {
      console.error('Config is undefined');
      throw new Error('Config is undefined');
    }

    // 验证 URL
    if (!config.targetUrl) {
      console.error('Target URL is empty');
      throw new Error('Target URL is required');
    }

    try {
      const url = new URL(config.targetUrl);
      console.log('Valid URL:', url.href);
    } catch (e) {
      console.error('Invalid URL format:', config.targetUrl);
      throw new Error('Invalid URL format');
    }

    try {
      // 保存每个配置项
      await this.store.set('targetUrl', config.targetUrl);
      await this.store.set('refreshInterval', config.refreshInterval);
      await this.store.set('autoRetry', config.autoRetry);
      await this.store.set('maxRetries', config.maxRetries);
      await this.store.set('notificationEnabled', config.notificationEnabled);
      await this.store.set('purchaseStrategy', config.purchaseStrategy);

      // 验证保存是否成功
      const savedUrl = this.store.get('targetUrl');
      console.log('Saved URL:', savedUrl);
      
      if (savedUrl !== config.targetUrl) {
        throw new Error('Failed to save URL');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  public resetConfig(): void {
    // 先清除所有配置
    this.store.clear();
    
    // 然后设置默认配置
    Object.entries(this.defaultConfig).forEach(([key, value]) => {
      this.store.set(key, value);
    });
  }

  public getCredentials(): string {
    return this.store.get('credentials', '');
  }

  public saveCredentials(credentials: string): void {
    this.store.set('credentials', credentials || '');
  }

  public getPaymentInfo(): string {
    return this.store.get('paymentInfo', '');
  }

  public savePaymentInfo(paymentInfo: string): void {
    this.store.set('paymentInfo', paymentInfo || '');
  }
} 