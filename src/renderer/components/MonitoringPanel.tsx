import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { Config } from '../../common/interfaces/types';
import '../styles/MonitoringPanel.css';

export const MonitoringPanel: React.FC = () => {
  const [config, setConfig] = useState<Config>({
    targetUrl: '',
    refreshInterval: 5000,
    autoRetry: true,
    maxRetries: 3,
    notificationEnabled: true,
    purchaseStrategy: {
      autoPurchase: false,
      multiAccount: false,
      priceLimit: false,
      maxPrice: 0,
      purchaseLimit: {
        singleAccountLimit: 1,
        quantityPerOrder: 1
      }
    }
  });
  const [isMonitoring, setIsMonitoring] = useState(false);

  const handleStartMonitoring = async () => {
    try {
      await ipcRenderer.invoke('start-monitoring', config);
      setIsMonitoring(true);
    } catch (error) {
      console.error('启动监控失败:', error);
    }
  };

  const handleStopMonitoring = async () => {
    try {
      await ipcRenderer.invoke('stop-monitoring');
      setIsMonitoring(false);
    } catch (error) {
      console.error('停止监控失败:', error);
    }
  };

  return (
    <div className="monitoring-panel">
      <h2>商品监控</h2>
      
      <div className="monitoring-section">
        <h3>基本设置</h3>
        <div className="form-group">
          <label>商品URL</label>
          <input
            type="text"
            value={config.targetUrl}
            onChange={(e) => setConfig({ ...config, targetUrl: e.target.value })}
            placeholder="请输入商品URL"
            className="full-width-input"
          />
        </div>

        <div className="form-group">
          <label>刷新间隔 (毫秒)</label>
          <input
            type="number"
            value={config.refreshInterval}
            onChange={(e) => setConfig({ ...config, refreshInterval: parseInt(e.target.value) })}
            min="1000"
            className="number-input"
          />
        </div>
      </div>

      <div className="monitoring-section">
        <h3>监控选项</h3>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={config.autoRetry}
              onChange={(e) => setConfig({ ...config, autoRetry: e.target.checked })}
            />
            自动重试
          </label>
          
          {config.autoRetry && (
            <div className="sub-option">
              <label>最大重试次数</label>
              <input
                type="number"
                value={config.maxRetries}
                onChange={(e) => setConfig({ ...config, maxRetries: parseInt(e.target.value) })}
                min="1"
                className="number-input"
              />
            </div>
          )}
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={config.notificationEnabled}
              onChange={(e) => setConfig({ ...config, notificationEnabled: e.target.checked })}
            />
            启用通知
          </label>
        </div>
      </div>

      <div className="monitoring-section">
        <h3>购买策略</h3>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={config.purchaseStrategy.multiAccount}
              onChange={(e) => setConfig({
                ...config,
                purchaseStrategy: {
                  ...config.purchaseStrategy,
                  multiAccount: e.target.checked
                }
              })}
            />
            启用多账号抢购
          </label>
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={config.purchaseStrategy.autoPurchase}
              onChange={(e) => setConfig({
                ...config,
                purchaseStrategy: {
                  ...config.purchaseStrategy,
                  autoPurchase: e.target.checked
                }
              })}
            />
            自动购买
          </label>
        </div>
      </div>

      <div className="action-buttons">
        {!isMonitoring ? (
          <button 
            className="start-button"
            onClick={handleStartMonitoring}
            disabled={!config.targetUrl}
          >
            开始监控
          </button>
        ) : (
          <button 
            className="stop-button"
            onClick={handleStopMonitoring}
          >
            停止监控
          </button>
        )}
      </div>
    </div>
  );
}; 