import { app, BrowserWindow } from 'electron';
import path from 'path';
import { setupAllHandlers } from './ipc/handlers';
import { ConfigManager } from './services/ConfigManager';

let mainWindow: BrowserWindow | null = null;
let configManager: ConfigManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // 移除原生窗口框架
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 初始化配置管理器
  configManager = new ConfigManager();

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  setupAllHandlers(mainWindow);
}

app.whenReady().then(createWindow);

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