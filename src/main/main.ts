import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions } from 'electron';
import { ProductMonitor } from './services/ProductMonitor';
import { Config, Product, UserCredentials, PaymentInfo, PurchaseSettings } from '../common/interfaces/types';
import path from 'path';
import { PurchaseTaskManager } from './services/PurchaseTaskManager';
import { ConfigManager } from './services/ConfigManager';
import { StatisticsManager } from './services/StatisticsManager';
import { AccountManagerService } from './services/AccountManager';
import { PaymentInfoManager } from './services/PaymentInfoManager';
import { ProxyManager } from './services/ProxyManager';
import { notificationManager } from './services/NotificationManager';
import { setupAllHandlers } from './ipc/handlers';
import fs from 'fs-extra';

let mainWindow: BrowserWindow | null = null;
let productMonitor: ProductMonitor | null = null;
const configManager = new ConfigManager();
const statisticsManager = new StatisticsManager();
const accountManager = AccountManagerService.getInstance();
const paymentManager = PaymentInfoManager.getInstance();
const proxyManager = ProxyManager.getInstance();
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

app.whenReady().then(() => {
  createWindow();
  if (mainWindow) {
    setupAllHandlers(mainWindow);
    createMenu();
  }
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
    //     mainWindow?.webContents.send('switch-tab', 'payment-info');
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