import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { MonitoringPanel } from './components/MonitoringPanel';
import { AccountManager } from './components/AccountManager';
import { PaymentInfoManager } from './components/PaymentInfoManager';
import { NotificationSettings } from './components/NotificationSettings';
import { StatisticsPanel } from './components/StatisticsPanel';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('monitor');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  useEffect(() => {
    // 监听切换页面事件
    ipcRenderer.on('switch-tab', (_, tab: string) => {
      setCurrentTab(tab);
    });

    // 监听选择账号事件
    ipcRenderer.on('select-account', (_, username: string) => {
      setSelectedAccount(username);
    });

    return () => {
      ipcRenderer.removeAllListeners('switch-tab');
      ipcRenderer.removeAllListeners('select-account');
    };
  }, []);

  const renderContent = () => {
    switch (currentTab) {
      case 'monitor':
        return <MonitoringPanel />;
      case 'accounts':
        return <AccountManager />;
      case 'payment-info':
        return <PaymentInfoManager selectedAccount={selectedAccount} />;
      // ... 其他页面 ...
      default:
        return <MonitoringPanel />;
    }
  };

  return (
    <div className="app">
      {renderContent()}
    </div>
  );
};

export default App; 