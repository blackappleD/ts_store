import { ipcMain, BrowserWindow, dialog } from 'electron';
import { PaymentInfo, PurchaseSettings, Config, Product, UserCredentials } from '../../common/interfaces/types';
import { PaymentInfoManager } from '../services/PaymentInfoManager';
import { AccountManagerService } from '../services/AccountManager';
import { ProductMonitor } from '../services/ProductMonitor';
import { notificationManager } from '../services/NotificationManager';
import { PurchaseTaskManager } from '../services/PurchaseTaskManager';
import { ProxyManager } from '../services/ProxyManager';

// 获取服务实例
const paymentInfoManager = PaymentInfoManager.getInstance();
const accountManager = AccountManagerService.getInstance();
const proxyManager = ProxyManager.getInstance();
const purchaseTaskManager = new PurchaseTaskManager(notificationManager, proxyManager);

// 监控实例
let productMonitor: ProductMonitor | null = null;

// 导出所有处理器的设置函数
export function setupAllHandlers(mainWindow: BrowserWindow) {
  // 监控相关的处理器
  ipcMain.handle('start-monitoring', async (_, config: Config) => {
    try {
      if (!productMonitor) {
        productMonitor = new ProductMonitor(config, notificationManager);
        
        // 监听商品可用事件
        productMonitor.on('product-available', async (product: Product) => {
          mainWindow?.webContents.send('product-available', product);
          
          if (config.purchaseStrategy.autoPurchase) {
            // 获取默认账号
            const accounts = await accountManager.getAccounts();
            const defaultAccount = accounts.find(acc => acc.isDefault);
            
            if (defaultAccount) {
              // 获取账号的支付信息
              const paymentInfo = await paymentInfoManager.getPaymentInfo(defaultAccount.username);
              
              if (paymentInfo) {
                await purchaseTaskManager.startPurchaseTask(
                  product,
                  defaultAccount,
                  paymentInfo
                );
              }
            }
          }
        });
      }
      
      await productMonitor.startMonitoring();
      return true;
    } catch (error) {
      console.error('启动监控失败:', error);
      throw error;
    }
  });

  ipcMain.handle('stop-monitoring', () => {
    if (productMonitor) {
      productMonitor.stopMonitoring();
      productMonitor = null;
    }
    return true;
  });

  // 通知设置相关的处理器
  ipcMain.handle('get-notification-settings', () => {
    return notificationManager.getSettings();
  });

  ipcMain.handle('save-notification-settings', (_, settings: { enabled: boolean }) => {
    notificationManager.saveSettings(settings);
    return true;
  });

  // 窗口控制相关的处理器
  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    mainWindow?.close();
  });

  ipcMain.on('reload-window', () => {
    mainWindow?.reload();
  });

  ipcMain.on('show-about', () => {
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: '关于',
      message: 'Taylor Swift CD Snapped Monitor',
      detail: '版本 1.0.0\n作者: Ct\n© 2024 All Rights Reserved',
      buttons: ['确定']
    });
  });

  // 标签切换相关的处理器
  ipcMain.on('switch-tab', (_, tab: string, params?: any) => {
    if (tab === 'payment-info' && params?.username) {
      mainWindow?.webContents.send('switch-tab', tab);
      setTimeout(() => {
        mainWindow?.webContents.send('select-account', params.username);
      }, 100);
    } else {
      mainWindow?.webContents.send('switch-tab', tab);
    }
  });

  // 账号相关的处理器
  ipcMain.handle('save-accounts', async (_, accounts: UserCredentials[]) => {
    try {
      await accountManager.saveAccounts(accounts);
      return true;
    } catch (error) {
      console.error('保存账号失败:', error);
      throw error;
    }
  });

  ipcMain.handle('get-accounts', async () => {
    try {
      return await accountManager.getAccounts();
    } catch (error) {
      console.error('获取账号失败:', error);
      throw error;
    }
  });

  // 支付信息相关的处理器
  ipcMain.handle('get-payment-info', async (_, username: string) => {
    try {
      return await paymentInfoManager.getPaymentInfo(username);
    } catch (error) {
      console.error('获取支付信息失败:', error);
      throw error;
    }
  });

  ipcMain.handle('save-payment-info', async (_, username: string, info: PaymentInfo) => {
    try {
      await paymentInfoManager.savePaymentInfo(username, info);
      await accountManager.updateAccount(username, { hasPaymentInfo: true });
      return true;
    } catch (error) {
      console.error('保存支付信息失败:', error);
      throw error;
    }
  });

  // 购买设置相关的处理器
  ipcMain.handle('get-purchase-settings', async () => {
    try {
      return await accountManager.getPurchaseSettings();
    } catch (error) {
      console.error('读取购买设置失败:', error);
      throw error;
    }
  });

  ipcMain.handle('save-purchase-settings', async (_, settings: PurchaseSettings) => {
    try {
      await accountManager.savePurchaseSettings(settings);
      return true;
    } catch (error) {
      console.error('保存购买设置失败:', error);
      throw error;
    }
  });
} 