import { BrowserWindow } from 'electron';

declare global {
  var mainWindow: BrowserWindow | null;
}

export {}; 