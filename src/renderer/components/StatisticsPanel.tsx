import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { ipcRenderer } from 'electron';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export const StatisticsPanel: React.FC = () => {
  const [stats, setStats] = useState({
    totalMonitoringTime: 0,
    successfulPurchases: 0,
    failedAttempts: 0,
    averageResponseTime: 0,
    monitoringHistory: [] as { timestamp: string; available: boolean }[]
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const statistics = await ipcRenderer.invoke('get-statistics');
        setStats(statistics);
      } catch (error) {
        console.error('Failed to load statistics:', error);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 5000);

    return () => clearInterval(interval);
  }, []);

  const chartData = {
    labels: stats.monitoringHistory.map(h => new Date(h.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: '商品可用性',
        data: stats.monitoringHistory.map(h => h.available ? 1 : 0),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  };

  return (
    <div className="statistics-panel">
      <h2>监控统计</h2>
      <div className="stats-grid">
        <div className="stat-item">
          <label>总监控时间</label>
          <span>{Math.floor(stats.totalMonitoringTime / 60)} 分钟</span>
        </div>
        <div className="stat-item">
          <label>成功购买次数</label>
          <span>{stats.successfulPurchases}</span>
        </div>
        <div className="stat-item">
          <label>失败尝试次数</label>
          <span>{stats.failedAttempts}</span>
        </div>
        <div className="stat-item">
          <label>平均响应时间</label>
          <span>{stats.averageResponseTime.toFixed(2)} ms</span>
        </div>
      </div>
      <div className="chart-container">
        <Line data={chartData} options={{
          responsive: true,
          plugins: {
            legend: {
              position: 'top' as const,
            },
            title: {
              display: true,
              text: '商品可用性历史'
            }
          }
        }} />
      </div>
    </div>
  );
}; 