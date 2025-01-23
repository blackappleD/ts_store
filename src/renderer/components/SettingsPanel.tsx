import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import './SettingsPanel.css';
import { Config } from '../../common/interfaces/types';

const defaultConfig: Config = {
  targetUrl: '',
  refreshInterval: 1000,
  autoRetry: true,
  maxRetries: 3,
  notificationEnabled: true,
  maxConcurrentSessions: 5,
  retryDelay: 5000,
  timeouts: {
    elementWait: 5000,
    navigation: 30000,
    pageLoad: 30000
  },
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
};

export const SettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<Config>(defaultConfig);

  // 初始化时从主进程获取配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await ipcRenderer.invoke('get-config');
        if (savedConfig) {
          setConfig(savedConfig);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    };
    loadConfig();
  }, []);

  return (
    <div className="settings-panel">
      {/* 移除 BrowserSettings 组件 */}
      {/* 其他设置保持不变 */}
    </div>
  );
}; 