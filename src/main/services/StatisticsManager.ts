import { ipcMain } from 'electron';
import Store from 'electron-store';

interface Statistics {
  totalMonitoringTime: number;
  successfulPurchases: number;
  failedAttempts: number;
  averageResponseTime: number;
  monitoringHistory: Array<{
    timestamp: string;
    available: boolean;
  }>;
}

export class StatisticsManager {
  private store: Store<{statistics: Statistics}>;
  private startTime: number | null = null;
  private statistics: Statistics;

  constructor() {
    // 初始化默认统计数据
    const defaultStats: Statistics = {
      totalMonitoringTime: 0,
      successfulPurchases: 0,
      failedAttempts: 0,
      averageResponseTime: 0,
      monitoringHistory: []
    };

    // 使用泛型指定 Store 的类型
    this.store = new Store<{statistics: Statistics}>({
      defaults: {
        statistics: defaultStats
      }
    });

    // 从存储中加载统计数据
    this.statistics = this.loadStatistics();
    this.setupIpcHandlers();
  }

  private loadStatistics(): Statistics {
    const stats = this.store.get('statistics');
    if (!stats) {
      return {
        totalMonitoringTime: 0,
        successfulPurchases: 0,
        failedAttempts: 0,
        averageResponseTime: 0,
        monitoringHistory: []
      };
    }
    return stats;
  }

  private saveStatistics() {
    this.store.set('statistics', this.statistics);
  }

  private setupIpcHandlers() {
    ipcMain.handle('get-statistics', () => {
      return this.statistics;
    });
  }

  public startMonitoring() {
    this.startTime = Date.now();
  }

  public stopMonitoring() {
    if (this.startTime) {
      this.statistics.totalMonitoringTime += (Date.now() - this.startTime) / 1000;
      this.startTime = null;
      this.saveStatistics();
    }
  }

  public recordAvailability(available: boolean, responseTime: number) {
    this.statistics.monitoringHistory.push({
      timestamp: new Date().toISOString(),
      available
    });

    // 保持历史记录在合理范围内
    if (this.statistics.monitoringHistory.length > 100) {
      this.statistics.monitoringHistory.shift();
    }

    // 更新平均响应时间
    this.statistics.averageResponseTime = 
      (this.statistics.averageResponseTime + responseTime) / 2;

    this.saveStatistics();
  }

  public recordPurchaseAttempt(success: boolean) {
    if (success) {
      this.statistics.successfulPurchases++;
    } else {
      this.statistics.failedAttempts++;
    }
    this.saveStatistics();
  }
} 