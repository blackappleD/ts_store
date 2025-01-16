import { ipcMain } from 'electron';
import Store from 'electron-store';
import axios from 'axios';
import { ProxyConfig } from '../../common/interfaces/types';

interface ProxyStore {
  proxies: ProxyConfig[];
}

export class ProxyManager {
  private store: Store<ProxyStore>;
  private proxyList: ProxyConfig[] = [];
  private currentIndex = 0;
  private readonly MAX_FAIL_COUNT = 3;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查一次

  constructor() {
    this.store = new Store<ProxyStore>({
      name: 'proxy-manager',
      defaults: { proxies: [] }
    });

    this.loadProxies();
    this.setupIpcHandlers();
    this.startHealthCheck();
  }

  private setupIpcHandlers() {
    ipcMain.handle('get-proxies', () => this.proxyList);
    ipcMain.handle('add-proxy', async (_, proxy: Omit<ProxyConfig, 'failCount' | 'averageResponseTime'>) => {
      await this.addProxy(proxy);
    });
    ipcMain.handle('remove-proxy', (_, host: string) => {
      this.removeProxy(host);
    });
    ipcMain.handle('test-proxy', async (_, proxy: ProxyConfig) => {
      return this.testProxy(proxy);
    });
  }

  private async testProxy(proxy: ProxyConfig): Promise<boolean> {
    const startTime = Date.now();
    try {
      await axios.get('https://www.google.com', {
        proxy: {
          host: proxy.host,
          port: proxy.port,
          protocol: proxy.protocol,
          auth: proxy.username ? {
            username: proxy.username,
            password: proxy.password || ''
          } : undefined
        },
        timeout: 5000
      });

      const responseTime = Date.now() - startTime;
      return responseTime < 5000;
    } catch {
      return false;
    }
  }

  private async startHealthCheck() {
    setInterval(async () => {
      for (const proxy of this.proxyList) {
        const isHealthy = await this.testProxy(proxy);
        if (!isHealthy) {
          proxy.failCount++;
        } else {
          proxy.failCount = 0;
        }
      }

      // 移除不健康的代理
      this.proxyList = this.proxyList.filter(p => p.failCount < this.MAX_FAIL_COUNT);
      this.saveProxies();
    }, this.CHECK_INTERVAL);
  }

  public async getNextProxy(): Promise<ProxyConfig | null> {
    if (this.proxyList.length === 0) return null;

    // 按照响应时间和失败次数排序
    this.proxyList.sort((a, b) => {
      const aScore = a.averageResponseTime * (a.failCount + 1);
      const bScore = b.averageResponseTime * (b.failCount + 1);
      return aScore - bScore;
    });

    this.currentIndex = (this.currentIndex + 1) % this.proxyList.length;
    return this.proxyList[this.currentIndex];
  }

  private loadProxies() {
    this.proxyList = this.store.get('proxies');
  }

  private saveProxies() {
    this.store.set('proxies', this.proxyList);
  }

  private async addProxy(proxy: Omit<ProxyConfig, 'failCount' | 'averageResponseTime'>) {
    const newProxy: ProxyConfig = {
      ...proxy,
      failCount: 0,
      averageResponseTime: 0
    };

    if (await this.testProxy(newProxy)) {
      this.proxyList.push(newProxy);
      this.saveProxies();
    } else {
      throw new Error('代理服务器测试失败');
    }
  }

  private removeProxy(host: string) {
    this.proxyList = this.proxyList.filter(p => p.host !== host);
    this.saveProxies();
  }
} 