import { app, BrowserWindow } from 'electron';
import path from 'path';
import { setupAllHandlers } from './ipc/handlers';
import { ConfigManager } from './services/ConfigManager';

let mainWindow: BrowserWindow | null = null;
let configManager: ConfigManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false, // 移除原生窗口框架
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 初始化配置管理器
  configManager = new ConfigManager();

  // 在生产环境中加载打包后的文件
  if (process.env.NODE_ENV === 'production') {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));
  }

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