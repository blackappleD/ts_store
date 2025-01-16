import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { Line } from 'react-chartjs-2';

interface Statistics {
  attempts: Array<{
    timestamp: number;
    productId: string;
    productName: string;
    success: boolean;
    timeTaken: number;
  }>;
  successRate: number;
  averageTime: number;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
}

export const StatisticsDisplay: React.FC = () => {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');

  useEffect(() => {
    loadStatistics();
    const interval = setInterval(loadStatistics, 5000);
    return () => clearInterval(interval);
  }, [selectedProduct, selectedAccount]);

  const loadStatistics = async () => {
    let stats;
    if (selectedProduct !== 'all') {
      stats = await ipcRenderer.invoke('get-product-statistics', selectedProduct);
    } else if (selectedAccount !== 'all') {
      stats = await ipcRenderer.invoke('get-account-statistics', selectedAccount);
    } else {
      stats = await ipcRenderer.invoke('get-statistics');
    }
    setStatistics(stats);
  };

  const getChartData = () => {
    if (!statistics) return null;

    const data = statistics.attempts.slice(0, 50).reverse();
    return {
      labels: data.map(a => new Date(a.timestamp).toLocaleTimeString()),
      datasets: [
        {
          label: '抢购耗时 (ms)',
          data: data.map(a => a.timeTaken),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }
      ]
    };
  };

  if (!statistics) return <div>加载统计数据...</div>;

  return (
    <div className="statistics-display">
      <div className="statistics-header">
        <h3>抢购统计</h3>
        <div className="filters">
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            <option value="all">所有商品</option>
            {/* 动态加载商品列表 */}
          </select>

          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            <option value="all">所有账号</option>
            {/* 动态加载账号列表 */}
          </select>
        </div>
      </div>

      <div className="statistics-summary">
        <div className="stat-item">
          <label>成功率</label>
          <span>{statistics.successRate.toFixed(2)}%</span>
        </div>
        <div className="stat-item">
          <label>平均耗时</label>
          <span>{statistics.averageTime.toFixed(0)}ms</span>
        </div>
        <div className="stat-item">
          <label>总尝试次数</label>
          <span>{statistics.totalAttempts}</span>
        </div>
        <div className="stat-item">
          <label>成功次数</label>
          <span>{statistics.successfulAttempts}</span>
        </div>
        <div className="stat-item">
          <label>失败次数</label>
          <span>{statistics.failedAttempts}</span>
        </div>
      </div>

      <div className="statistics-chart">
        {getChartData() && (
          <Line
            data={getChartData()!}
            options={{
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }}
          />
        )}
      </div>
    </div>
  );
}; 