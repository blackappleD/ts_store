import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { AccountManager } from './components/AccountManager';
import { MonitoringPanel } from './components/MonitoringPanel';
import { PaymentInfoManager } from './components/PaymentInfoManager';
import { SettingsPanel } from './components/SettingsPanel';
import { StatisticsPanel } from './components/StatisticsPanel';
import './App.css';

type TabType = 'monitor' | 'accounts' | 'payment-info' | 'settings' | 'statistics';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('monitor');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  useEffect(() => {
    // 监听切换页面事件
    ipcRenderer.on('switch-tab', (_, tab: TabType) => {
      setActiveTab(tab);
    });

    // 监听选择账号事件
    ipcRenderer.on('select-account', (_, username: string) => {
      setSelectedAccount(username);
      setActiveTab('payment-info');
    });

    return () => {
      ipcRenderer.removeAllListeners('switch-tab');
      ipcRenderer.removeAllListeners('select-account');
    };
  }, []);

  const handleReload = () => {
    ipcRenderer.send('reload-window');
  };

  const handleAbout = () => {
    ipcRenderer.send('show-about');
  };

  const handleWindowControl = (action: 'minimize' | 'maximize' | 'close') => {
    ipcRenderer.send(`${action}-window`);
  };

  const renderTitleBar = () => (
    <div className="title-bar">
      <div className="title">Taylor Swift CD Snapped Monitor</div>
      <div className="window-controls">
        <button onClick={() => handleWindowControl('minimize')}>—</button>
        <button onClick={() => handleWindowControl('maximize')}>□</button>
        <button onClick={() => handleWindowControl('close')}>×</button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'monitor':
        return <MonitoringPanel />;
      case 'accounts':
        return <AccountManager onAccountSelect={(username: string) => {
          setSelectedAccount(username);
          setActiveTab('payment-info');
        }} />;
      case 'payment-info':
        return <PaymentInfoManager selectedAccount={selectedAccount || ''} />;
      case 'settings':
        return <SettingsPanel />;
      case 'statistics':
        return <StatisticsPanel />;
      default:
        return <MonitoringPanel />;
    }
  };

  const renderTabs = () => (
    <div className="tabs">
      <div className="tab-group">
        <button 
          className={`tab ${activeTab === 'monitor' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitor')}
        >
          商品监控
        </button>
        <button 
          className={`tab ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          账号管理
        </button>
        <button 
          className={`tab ${activeTab === 'payment-info' ? 'active' : ''}`}
          onClick={() => setActiveTab('payment-info')}
        >
          支付信息
        </button>
        <button 
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          设置
        </button>
        <button 
          className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          统计
        </button>
      </div>
      <div className="tab-actions">
        <button className="action-button" onClick={handleReload}>
          重载
        </button>
        <button className="action-button" onClick={handleAbout}>
          关于
        </button>
      </div>
    </div>
  );

  return (
    <div className="app">
      {renderTitleBar()}
      {renderTabs()}
      <div className="content">
        {renderContent()}
      </div>
    </div>
  );
};

export default App; 