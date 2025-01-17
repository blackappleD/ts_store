import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { Config } from '../../common/interfaces/types';
import '../styles/MonitoringPanel.css';

export const MonitoringPanel: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [config, setConfig] = useState<Config>(() => {
    // 从 localStorage 读取保存的配置
    const savedConfig = localStorage.getItem('monitorConfig');
    if (savedConfig) {
      return JSON.parse(savedConfig);
    }
    // 默认配置
    return {
      targetUrl: '',
      refreshInterval: 1000,
      autoRetry: true,
      maxRetries: 3,
      notificationEnabled: true,
      purchaseStrategy: {
        multiAccount: false,
        autoPurchase: false,
        priceLimit: false,
        maxPrice: 0,
        purchaseLimit: {
          singleAccountLimit: 1,
          quantityPerOrder: 1
        }
      }
    };
  });
  const [error, setError] = useState<string>('');

  // 当配置改变时保存到 localStorage
  useEffect(() => {
    localStorage.setItem('monitorConfig', JSON.stringify(config));
  }, [config]);

  // 处理配置更新
  const handleConfigChange = (updates: Partial<Config>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };
      localStorage.setItem('monitorConfig', JSON.stringify(newConfig));
      return newConfig;
    });
  };

  // 处理购买策略更新
  const handleStrategyChange = (updates: Partial<typeof config.purchaseStrategy>) => {
    setConfig(prev => {
      const newConfig = {
        ...prev,
        purchaseStrategy: {
          ...prev.purchaseStrategy,
          ...updates
        }
      };
      localStorage.setItem('monitorConfig', JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const handleStartMonitoring = async () => {
    try {
      setError('');
      await ipcRenderer.invoke('start-monitoring', config);
      setIsMonitoring(true);
    } catch (error: any) {
      // 只提取错误信息，忽略堆栈
      const errorMessage = error.message || '启动监控失败';
      // 如果错误信息包含堆栈信息，只取第一行
      const cleanMessage = errorMessage.split('\n')[0];
      // 如果错误信息以 "Error:" 开头，去掉这个前缀
      const finalMessage = cleanMessage.replace(/^Error:\s*/, '');
      
      console.error('启动监控失败:', error); // 保留完整错误日志
      setError(finalMessage);
      setIsMonitoring(false);
    }
  };

  const handleStopMonitoring = async () => {
    try {
      await ipcRenderer.invoke('stop-monitoring');
      setIsMonitoring(false);
      setError('');
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
          <label>商品链接：</label>
          <input
            type="text"
            value={config.targetUrl}
            onChange={(e) => handleConfigChange({ targetUrl: e.target.value })}
            placeholder="请输入商品链接"
            className="full-width-input"
          />
        </div>
        
        <div className="form-group">
          <label>刷新间隔（毫秒）：</label>
          <input
            type="number"
            min="1000"
            value={config.refreshInterval}
            onChange={(e) => handleConfigChange({ refreshInterval: parseInt(e.target.value) })}
            className="number-input"
          />
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={config.autoRetry}
              onChange={(e) => handleConfigChange({ autoRetry: e.target.checked })}
            />
            <span>自动重试</span>
          </label>
          {config.autoRetry && (
            <div className="sub-option">
              <label>最大重试次数：</label>
              <input
                type="number"
                min="1"
                value={config.maxRetries}
                onChange={(e) => handleConfigChange({ maxRetries: parseInt(e.target.value) })}
                className="number-input"
              />
            </div>
          )}
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={config.notificationEnabled}
              onChange={(e) => handleConfigChange({ notificationEnabled: e.target.checked })}
            />
            <span>启用通知</span>
          </label>
        </div>
      </div>

      <div className="monitoring-section">
        <h3>购买策略</h3>
        <div className="strategy-options">
          <label>
            <input
              type="checkbox"
              checked={config.purchaseStrategy.multiAccount}
              onChange={(e) => handleStrategyChange({ multiAccount: e.target.checked })}
            />
            <span>多账号抢购</span>
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={config.purchaseStrategy.autoPurchase}
              onChange={(e) => handleStrategyChange({ autoPurchase: e.target.checked })}
            />
            <span>自动完成购买</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="error-alert">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
        </div>
      )}

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