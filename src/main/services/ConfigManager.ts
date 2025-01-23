import { ipcMain } from 'electron';
import Store from 'electron-store';
import { Config, StoredConfig } from '../../common/interfaces/types';

export class ConfigManager {
  private store: Store<StoredConfig>;
  private static readonly DEFAULT_CONFIG: Config = {
    targetUrl: '',
    refreshInterval: 500,
    autoRetry: true,
    maxRetries: 3,
    notificationEnabled: true,
    maxConcurrentSessions: 5,
    retryDelay: 5000,
    timeouts: {
      elementWait: 2000,
      navigation: 10000,
      pageLoad: 5000
    },
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
        ...ConfigManager.DEFAULT_CONFIG,
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
      return this.saveConfig(config, true);
    });

    ipcMain.handle('update-config', async (_, config: Config) => {
      try {
        await this.saveConfig(config, false);
        return { success: true };
      } catch (error: any) {
        console.error('Failed to update config:', error);
        return { 
          success: false, 
          error: error?.message || 'Unknown error occurred'
        };
      }
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
        maxConcurrentSessions: this.store.get('maxConcurrentSessions', 5),
        retryDelay: this.store.get('retryDelay', 5000),
        timeouts: this.store.get('timeouts', {
          elementWait: 5000,
          navigation: 30000,
          pageLoad: 30000
        }),
        purchaseStrategy: this.store.get('purchaseStrategy', {
          autoPurchase: false,
          multiAccount: false,
          priceLimit: false,
          maxPrice: 0,
          purchaseLimit: {
            singleAccountLimit: 1,
            quantityPerOrder: 1
          }
        }),
        browserConfig: this.store.get('browserConfig', {
          incognito: true,
          disableGPU: false,
          disableDevShmUsage: false,
          disableWebSecurity: false,
          disableFeatures: false,
          enableCustomUserAgent: false,
          userAgent: ''
        })
      };
      console.log('Retrieved config from store:', config);
      return config;
    } catch (error: any) {
      console.error('Error getting config:', error);
      return ConfigManager.DEFAULT_CONFIG;
    }
  }

  public async saveConfig(config: Config, validateAll: boolean = true): Promise<void> {
    console.log('Attempting to save config:', config);
    
    if (!config) {
      console.error('Config is undefined');
      throw new Error('Config is undefined');
    }

    try {
      // 只在需要完整验证时检查URL
      if (validateAll) {
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
      }

      // 保存每个配置项
      if (validateAll) {
        await this.store.set('targetUrl', config.targetUrl);
        await this.store.set('refreshInterval', config.refreshInterval);
        await this.store.set('autoRetry', config.autoRetry);
        await this.store.set('maxRetries', config.maxRetries);
        await this.store.set('notificationEnabled', config.notificationEnabled);
        await this.store.set('maxConcurrentSessions', config.maxConcurrentSessions);
        await this.store.set('retryDelay', config.retryDelay);
        await this.store.set('timeouts', config.timeouts);
        await this.store.set('purchaseStrategy', config.purchaseStrategy);
      }
      

      console.log('Config saved successfully');
    } catch (error: any) {
      console.error('Failed to save config:', error);
      throw new Error(error?.message || 'Failed to save configuration');
    }
  }

  public resetConfig(): void {
    this.store.clear();
    Object.entries(ConfigManager.DEFAULT_CONFIG).forEach(([key, value]) => {
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

  public loadConfig(): Config {
    try {
      const storedConfig = this.store.get('config') as Config;
      return {
        ...ConfigManager.DEFAULT_CONFIG,
        ...storedConfig
      };
    } catch (error: any) {
      console.error('加载配置失败:', error);
      return ConfigManager.DEFAULT_CONFIG;
    }
  }
} 