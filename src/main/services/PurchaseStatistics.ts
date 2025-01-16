import Store from 'electron-store';

interface PurchaseAttempt {
  timestamp: number;
  productId: string;
  productName: string;
  price: number;
  success: boolean;
  error?: string;
  accountUsed: string;
  timeTaken: number;
  proxyUsed?: string;
}

interface Statistics {
  attempts: PurchaseAttempt[];
  successRate: number;
  averageTime: number;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
}

interface StatisticsStore {
  attempts: PurchaseAttempt[];
}

export class PurchaseStatistics {
  private store: Store<StatisticsStore>;
  private readonly MAX_HISTORY = 1000;

  constructor() {
    this.store = new Store<StatisticsStore>({
      name: 'purchase-statistics',
      defaults: {
        attempts: []
      }
    });
  }

  public recordPurchaseAttempt(attempt: Omit<PurchaseAttempt, 'timestamp'>): void {
    const attempts = this.store.get('attempts') as PurchaseAttempt[];
    
    attempts.unshift({
      ...attempt,
      timestamp: Date.now()
    });

    // 保持历史记录在限制范围内
    if (attempts.length > this.MAX_HISTORY) {
      attempts.length = this.MAX_HISTORY;
    }

    this.store.set('attempts', attempts);
  }

  public getStatistics(): Statistics {
    const attempts = this.store.get('attempts') as PurchaseAttempt[];
    const successful = attempts.filter(a => a.success);
    
    return {
      attempts,
      successRate: attempts.length ? (successful.length / attempts.length) * 100 : 0,
      averageTime: attempts.length ? 
        attempts.reduce((sum, a) => sum + a.timeTaken, 0) / attempts.length : 0,
      totalAttempts: attempts.length,
      successfulAttempts: successful.length,
      failedAttempts: attempts.length - successful.length
    };
  }

  public getProductStatistics(productId: string): Statistics {
    const attempts = (this.store.get('attempts') as PurchaseAttempt[])
      .filter(a => a.productId === productId);
    const successful = attempts.filter(a => a.success);

    return {
      attempts,
      successRate: attempts.length ? (successful.length / attempts.length) * 100 : 0,
      averageTime: attempts.length ? 
        attempts.reduce((sum, a) => sum + a.timeTaken, 0) / attempts.length : 0,
      totalAttempts: attempts.length,
      successfulAttempts: successful.length,
      failedAttempts: attempts.length - successful.length
    };
  }

  public getAccountStatistics(username: string): Statistics {
    const attempts = (this.store.get('attempts') as PurchaseAttempt[])
      .filter(a => a.accountUsed === username);
    const successful = attempts.filter(a => a.success);

    return {
      attempts,
      successRate: attempts.length ? (successful.length / attempts.length) * 100 : 0,
      averageTime: attempts.length ? 
        attempts.reduce((sum, a) => sum + a.timeTaken, 0) / attempts.length : 0,
      totalAttempts: attempts.length,
      successfulAttempts: successful.length,
      failedAttempts: attempts.length - successful.length
    };
  }

  public clearStatistics(): void {
    this.store.set('attempts', []);
  }
} 