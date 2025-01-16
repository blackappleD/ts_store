import { EventEmitter } from 'events';
import Store from 'electron-store';
import puppeteer from 'puppeteer';
import { notificationManager, INotificationManager } from './NotificationManager';

interface PriceHistory {
  timestamp: number;
  price: number;
}

interface PriceAlert {
  productId: string;
  targetPrice: number;
  condition: 'below' | 'above';
  enabled: boolean;
}

interface PriceMonitorStore {
  history: Record<string, PriceHistory[]>;
  alerts: Record<string, PriceAlert[]>;
}

export class PriceMonitor extends EventEmitter {
  private store: Store<PriceMonitorStore>;
  private notificationManager: INotificationManager;
  private monitors: Map<string, NodeJS.Timer> = new Map();
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查一次

  constructor(notificationManager: INotificationManager) {
    super();
    this.store = new Store<PriceMonitorStore>({ 
      name: 'price-monitor',
      defaults: {
        history: {},
        alerts: {}
      }
    });
    this.notificationManager = notificationManager;
  }

  public async startMonitoring(productId: string, url: string): Promise<void> {
    if (this.monitors.has(productId)) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const price = await this.checkPrice(url);
        if (price !== null) {
          this.recordPrice(productId, price);
          this.checkAlerts(productId, price);
        }
      } catch (error) {
        console.error(`价格监控错误 (${productId}):`, error);
      }
    }, this.CHECK_INTERVAL) as NodeJS.Timeout;

    this.monitors.set(productId, timer);
  }

  public stopMonitoring(productId: string): void {
    const timer = this.monitors.get(productId);
    if (timer) {
      clearInterval(timer as NodeJS.Timeout);
      this.monitors.delete(productId);
    }
  }

  private async checkPrice(url: string): Promise<number | null> {
    try {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url);

      const price = await page.evaluate(() => {
        const priceElement = document.querySelector('.product-price');
        if (priceElement && priceElement.textContent) {
          const priceText = priceElement.textContent;
          return parseFloat(priceText.replace(/[^\d.]/g, ''));
        }
        return null;
      });

      await browser.close();
      return price;
    } catch (error) {
      console.error('检查价格失败:', error);
      return null;
    }
  }

  private recordPrice(productId: string, price: number): void {
    const history = this.store.get('history');
    if (!history[productId]) {
      history[productId] = [];
    }
    history[productId].push({
      timestamp: Date.now(),
      price
    });
    this.store.set('history', history);
  }

  private async checkAlerts(productId: string, currentPrice: number): Promise<void> {
    const alerts = this.getAlerts(productId);
    for (const alert of alerts) {
      if (!alert.enabled) continue;

      const shouldNotify = alert.condition === 'below' 
        ? currentPrice <= alert.targetPrice
        : currentPrice >= alert.targetPrice;

      if (shouldNotify) {
        await this.notificationManager.notify(
          '价格提醒',
          `商品 ${productId} 当前价格: ${currentPrice}`,
          'info'
        );
      }
    }
  }

  private getAlerts(productId: string): PriceAlert[] {
    const alerts = this.store.get('alerts');
    return alerts[productId] || [];
  }

  public setAlert(alert: PriceAlert): void {
    const alerts = this.store.get(`price-alerts`, []) as PriceAlert[];
    const index = alerts.findIndex(a => a.productId === alert.productId);
    
    if (index !== -1) {
      alerts[index] = alert;
    } else {
      alerts.push(alert);
    }
    
    this.store.set('price-alerts', alerts);
  }

  public deleteAlert(productId: string): void {
    const alerts = this.store.get('price-alerts', []) as PriceAlert[];
    const filteredAlerts = alerts.filter(a => a.productId !== productId);
    this.store.set('price-alerts', filteredAlerts);
  }
} 