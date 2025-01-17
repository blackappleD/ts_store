import React, { useState, useEffect } from 'react';
import { UserCredentials } from '../../common/interfaces/types';
import { ipcRenderer } from 'electron';
import '../styles/AccountManager.css';

interface AccountManagerProps {
  onAccountsChange?: (accounts: UserCredentials[]) => void;
}

export const AccountManager: React.FC<AccountManagerProps> = ({ onAccountsChange }) => {
  const [accounts, setAccounts] = useState<UserCredentials[]>([]);
  const [newAccount, setNewAccount] = useState<UserCredentials>({
    username: '',
    password: '',
    isDefault: false,
    orderCount: 0,
    hasPaymentInfo: false
  });
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [purchaseSettings, setPurchaseSettings] = useState({
    singleAccountLimit: 1,
    quantityPerOrder: 1
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadPurchaseSettings();
  }, []);

  const loadAccounts = async () => {
    try {
      const savedAccounts = await ipcRenderer.invoke('get-accounts');
      setAccounts(savedAccounts);
    } catch (error) {
      console.error('加载账号失败:', error);
    }
  };

  const loadPurchaseSettings = async () => {
    try {
      const settings = await ipcRenderer.invoke('get-purchase-settings');
      if (settings) {
        setPurchaseSettings(settings);
      }
    } catch (error) {
      console.error('加载购买设置失败:', error);
      // 使用默认设置
      setPurchaseSettings({
        singleAccountLimit: 1,
        quantityPerOrder: 1
      });
    }
  };

  const handleAddAccount = async () => {
    if (!newAccount.username || !newAccount.password) {
      alert('请填写账号和密码');
      return;
    }

    // 检查账号是否已存在
    const accountExists = accounts.some(acc => acc.username === newAccount.username);
    if (accountExists) {
      alert('该账号已存在');
      return;
    }

    try {
      // 创建新账号对象
      const accountToAdd = {
        ...newAccount,
        isDefault: accounts.length === 0, // 如果是第一个账号则设为默认
        orderCount: 0,
        hasPaymentInfo: false
      };

      const updatedAccounts = [...accounts, accountToAdd];
      await ipcRenderer.invoke('save-accounts', updatedAccounts);
      
      // 更新本地状态
      setAccounts(updatedAccounts);
      
      // 重置表单
      setNewAccount({
        username: '',
        password: '',
        isDefault: false,
        orderCount: 0,
        hasPaymentInfo: false
      });

      // 通知父组件账号列表已更新
      onAccountsChange?.(updatedAccounts);
    } catch (error) {
      console.error('添加账号失败:', error);
      alert('添加账号失败');
    }
  };

  const handleDeleteAccount = async (username: string) => {
    try {
      const updatedAccounts = accounts.filter(acc => acc.username !== username);
      await ipcRenderer.invoke('save-accounts', updatedAccounts);
      setAccounts(updatedAccounts);
      onAccountsChange?.(updatedAccounts);
    } catch (error) {
      console.error('删除账号失败:', error);
    }
  };

  const handleSetDefault = async (username: string) => {
    try {
      const updatedAccounts = accounts.map(acc => ({
        ...acc,
        isDefault: acc.username === username
      }));
      await ipcRenderer.invoke('save-accounts', updatedAccounts);
      setAccounts(updatedAccounts);
      onAccountsChange?.(updatedAccounts);
    } catch (error) {
      console.error('设置默认账号失败:', error);
    }
  };

  const handlePurchaseSettingsChange = (key: keyof typeof purchaseSettings, value: number) => {
    setPurchaseSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSavePurchaseSettings = async () => {
    try {
      setIsLoading(true);
      await ipcRenderer.invoke('save-purchase-settings', purchaseSettings);
      alert('购买设置保存成功');
    } catch (error) {
      console.error('保存购买设置失败:', error);
      alert('保存设置失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditPaymentInfo = (username: string) => {
    ipcRenderer.send('switch-tab', 'payment-info', { username });
  };

  const handleAddPaymentInfo = (username: string) => {
    ipcRenderer.send('switch-tab', 'payment-info', { username });
  };

  return (
    <div className="account-manager">
      <h2>账号管理</h2>
      
      <div className="account-manager-container">
        <div className="settings-section">
          <h3>购买设置</h3>
          <div className="form-group">
            <label>单账号下单量：</label>
            <input
              type="number"
              min="1"
              value={purchaseSettings.singleAccountLimit}
              onChange={(e) => handlePurchaseSettingsChange('singleAccountLimit', parseInt(e.target.value))}
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label>每单购买数量：</label>
            <input
              type="number"
              min="1"
              value={purchaseSettings.quantityPerOrder}
              onChange={(e) => handlePurchaseSettingsChange('quantityPerOrder', parseInt(e.target.value))}
              disabled={isLoading}
            />
          </div>
          <button 
            className="save-button"
            onClick={handleSavePurchaseSettings}
            disabled={isLoading}
          >
            {isLoading ? '保存中...' : '保存设置'}
          </button>
        </div>

        <div className="add-account">
          <h3>添加账号</h3>
          <input
            type="text"
            placeholder="用户名"
            value={newAccount.username}
            onChange={(e) => setNewAccount(prev => ({ ...prev, username: e.target.value }))}
          />
          <input
            type="password"
            placeholder="密码"
            value={newAccount.password}
            onChange={(e) => setNewAccount(prev => ({ ...prev, password: e.target.value }))}
          />
          <button onClick={handleAddAccount}>添加账号</button>
        </div>

        <div className="account-list">
          <h3>账号列表</h3>
          <table>
            <thead>
              <tr>
                <th>用户名</th>
                <th>默认账号</th>
                <th>已下单数</th>
                <th>支付信息</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(account => (
                <tr key={account.username}>
                  <td>{account.username}</td>
                  <td>
                    <input
                      type="radio"
                      checked={account.isDefault}
                      onChange={() => handleSetDefault(account.username)}
                    />
                  </td>
                  <td>{account.orderCount || 0}</td>
                  <td>
                    {account.hasPaymentInfo ? (
                      <button 
                        className="edit-button"
                        onClick={() => handleEditPaymentInfo(account.username)}
                      >
                        编辑支付信息
                      </button>
                    ) : (
                      <button 
                        className="add-button"
                        onClick={() => handleAddPaymentInfo(account.username)}
                      >
                        添加支付信息
                      </button>
                    )}
                  </td>
                  <td>
                    <button 
                      className="delete-button"
                      onClick={() => handleDeleteAccount(account.username)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}; 