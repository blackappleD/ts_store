import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions } from 'electron';
import { ProductMonitor } from './services/ProductMonitor';
import { Config, Product, UserCredentials, PaymentInfo } from '../common/interfaces/types';
import path from 'path';
import { PurchaseTaskManager } from './services/PurchaseTaskManager';
import { ConfigManager } from './services/ConfigManager';
import { StatisticsManager } from './services/StatisticsManager';
import { AccountManagerService } from './services/AccountManager';
import { PaymentInfoManager } from './services/PaymentInfoManager';
import { ProxyManager } from './services/ProxyManager';
import { notificationManager } from './services/NotificationManager';

let mainWindow: BrowserWindow | null = null;
let productMonitor: ProductMonitor | null = null;
const configManager = new ConfigManager();
const statisticsManager = new StatisticsManager();
const accountManager = AccountManagerService.getInstance();
const paymentManager = PaymentInfoManager.getInstance();
const proxyManager = new ProxyManager();
const purchaseTaskManager = new PurchaseTaskManager(notificationManager, proxyManager);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function setupIpcHandlers() {
  // 监控相关
  ipcMain.handle('start-monitoring', async (_, config: Config) => {
    try {
      if (!productMonitor) {
        productMonitor = new ProductMonitor(config, notificationManager);
        
        // 监听商品可购买事件
        productMonitor.on('product-available', async (product: Product) => {
          if (mainWindow) {
            mainWindow.webContents.send('product-available', product);
          }
          
          if (config.purchaseStrategy.autoPurchase) {
            // 获取默认账号
            const accounts = await accountManager.getAccounts();
            const defaultAccount = accounts.find(acc => acc.isDefault);
            
            if (defaultAccount) {
              // 获取账号的支付信息
              const paymentInfo = await paymentManager.getPaymentInfo(defaultAccount.username);
              
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
  });

  // 添加通知设置相关的 IPC 处理程序
  ipcMain.handle('get-notification-settings', () => {
    return notificationManager.getSettings();
  });

  ipcMain.handle('save-notification-settings', (_, settings: { enabled: boolean }) => {
    notificationManager.saveSettings(settings);
    return true;
  });

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

  ipcMain.on('switch-tab', (_, tab: string, params?: any) => {
    if (tab === 'payment-info' && params?.username) {
      // 先切换到支付信息页面
      mainWindow?.webContents.send('switch-tab', tab);
      // 然后发送选中的账号信息
      setTimeout(() => {
        mainWindow?.webContents.send('select-account', params.username);
      }, 100);
    } else {
      mainWindow?.webContents.send('switch-tab', tab);
    }
  });

  // 添加账号相关的 IPC 处理器
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
      const accountManager = AccountManagerService.getInstance();
      return accountManager.getAccounts();
    } catch (error) {
      console.error('获取账号失败:', error);
      throw error;
    }
  });

  // 支付信息相关的 IPC 处理器
  ipcMain.handle('get-payment-info', async (_, username: string) => {
    try {
      return await paymentManager.getPaymentInfo(username);
    } catch (error) {
      console.error('获取支付信息失败:', error);
      throw error;
    }
  });

  ipcMain.handle('save-payment-info', async (_, paymentInfo: PaymentInfo) => {
    try {
      const { accountId, ...info } = paymentInfo;
      // 创建一个新的支付信息对象，确保包含 accountId
      const paymentInfoToSave: PaymentInfo = {
        accountId,
        ...info,
        delivery: paymentInfo.delivery,
        paymentMethod: paymentInfo.paymentMethod,
        creditCard: paymentInfo.creditCard
      };
      
      await paymentManager.savePaymentInfo(accountId, paymentInfoToSave);
      
      // 更新账号的支付信息状态
      await accountManager.updateAccount(accountId, { hasPaymentInfo: true });
      return true;
    } catch (error) {
      console.error('保存支付信息失败:', error);
      throw error;
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createMenu();
  setupIpcHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function createMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '商品监控',
      click: () => {
        mainWindow?.webContents.send('switch-tab', 'monitor');
      }
    },
    {
      label: '账号管理',
      click: () => {
        mainWindow?.webContents.send('switch-tab', 'accounts');
      }
    },
    // {
    //   label: '支付信息',
    //   click: () => {
    //     mainWindow?.webContents.send('switch-tab', 'payment');
    //   }
    // },
    {
      label: '通知设置',
      click: () => {
        mainWindow?.webContents.send('switch-tab', 'settings');
      }
    },
    {
      label: '监控统计',
      click: () => {
        mainWindow?.webContents.send('switch-tab', 'statistics');
      }
    },
    {
      label: '重载',
      accelerator: process.platform === 'darwin' ? 'Cmd+R' : 'Ctrl+R',
      click: () => {
        // 重新加载窗口
        mainWindow?.reload();
      }
    },
    {
      label: '关于',
      click: () => {
        if (mainWindow) {
          const options = {
            type: 'info' as const,
            title: '关于',
            message: 'Taylor Swift CD Snapped Monitor',
            detail: '版本 1.0.0\n作者: Ct\n© 2024 All Rights Reserved',
            buttons: ['确定']
          };
          require('electron').dialog.showMessageBox(mainWindow, options);
        }
      }
    }
    
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}