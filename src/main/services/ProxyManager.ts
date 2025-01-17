import { ipcMain } from 'electron';
import Store from 'electron-store';

export class ProxyManager {
  private static instance: ProxyManager;
  private store: Store;

  private constructor() {
    this.store = new Store({
      name: 'proxy-settings'
    });
    this.setupIpcHandlers();
  }

  public static getInstance(): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager();
    }
    return ProxyManager.instance;
  }

  private setupIpcHandlers() {
    ipcMain.handle('get-proxies', () => {
      return this.getProxies();
    });

    ipcMain.handle('save-proxy', async (_, proxy: string) => {
      return this.saveProxy(proxy);
    });

    ipcMain.handle('delete-proxy', async (_, proxy: string) => {
      return this.deleteProxy(proxy);
    });
  }

  public getProxies(): string[] {
    return this.store.get('proxies', []) as string[];
  }

  public saveProxy(proxy: string): boolean {
    const proxies = this.getProxies();
    if (!proxies.includes(proxy)) {
      proxies.push(proxy);
      this.store.set('proxies', proxies);
      return true;
    }
    return false;
  }

  public deleteProxy(proxy: string): boolean {
    const proxies = this.getProxies();
    const index = proxies.indexOf(proxy);
    if (index > -1) {
      proxies.splice(index, 1);
      this.store.set('proxies', proxies);
      return true;
    }
    return false;
  }
} 