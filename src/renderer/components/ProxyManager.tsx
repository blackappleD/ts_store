import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';

interface ProxyConfig {
  protocol: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  failCount: number;
  averageResponseTime: number;
}

interface ProxyStats {
  total: number;
  healthy: number;
  averageResponseTime: number;
}

export const ProxyManager: React.FC = () => {
  const [proxies, setProxies] = useState<ProxyConfig[]>([]);
  const [stats, setStats] = useState<ProxyStats | null>(null);
  const [newProxy, setNewProxy] = useState({
    protocol: 'http',
    host: '',
    port: '',
    username: '',
    password: ''
  });

  useEffect(() => {
    loadProxies();
    const interval = setInterval(loadProxies, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadProxies = async () => {
    const proxyList = await ipcRenderer.invoke('get-proxies');
    const proxyStats = await ipcRenderer.invoke('get-proxy-stats');
    setProxies(proxyList);
    setStats(proxyStats);
  };

  const handleAddProxy = async () => {
    try {
      await ipcRenderer.invoke('add-proxy', {
        protocol: newProxy.protocol,
        host: newProxy.host,
        port: parseInt(newProxy.port),
        ...(newProxy.username && {
          username: newProxy.username,
          password: newProxy.password
        })
      });
      
      setNewProxy({
        protocol: 'http',
        host: '',
        port: '',
        username: '',
        password: ''
      });
      
      loadProxies();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '添加代理失败';
      console.error('添加代理失败:', errorMessage);
      // 可以添加错误提示UI
    }
  };

  return (
    <div className="proxy-manager">
      <h3>代理服务器管理</h3>
      
      {stats && (
        <div className="proxy-stats">
          <div className="stat-item">
            <label>总数量</label>
            <span>{stats.total}</span>
          </div>
          <div className="stat-item">
            <label>健康数量</label>
            <span>{stats.healthy}</span>
          </div>
          <div className="stat-item">
            <label>平均响应时间</label>
            <span>{stats.averageResponseTime.toFixed(0)}ms</span>
          </div>
        </div>
      )}

      <div className="proxy-list">
        {proxies.map((proxy, index) => (
          <div key={index} className="proxy-item">
            <div className="proxy-info">
              <span className="protocol">{proxy.protocol}</span>
              <span className="host">{proxy.host}:{proxy.port}</span>
              {proxy.username && <span className="auth">已认证</span>}
            </div>
            <div className="proxy-status">
              <span className={`status ${proxy.failCount === 0 ? 'healthy' : 'unhealthy'}`}>
                {proxy.failCount === 0 ? '正常' : `失败次数: ${proxy.failCount}`}
              </span>
              <span className="response-time">{proxy.averageResponseTime}ms</span>
            </div>
          </div>
        ))}
      </div>

      <div className="add-proxy-form">
        <h4>添加新代理</h4>
        <div className="form-row">
          <div className="form-group">
            <label>协议</label>
            <select
              value={newProxy.protocol}
              onChange={(e) => setNewProxy(prev => ({
                ...prev,
                protocol: e.target.value
              }))}
            >
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks4">SOCKS4</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>

          <div className="form-group">
            <label>主机地址</label>
            <input
              type="text"
              value={newProxy.host}
              onChange={(e) => setNewProxy(prev => ({
                ...prev,
                host: e.target.value
              }))}
              placeholder="例如: proxy.example.com"
            />
          </div>

          <div className="form-group">
            <label>端口</label>
            <input
              type="number"
              value={newProxy.port}
              onChange={(e) => setNewProxy(prev => ({
                ...prev,
                port: e.target.value
              }))}
              placeholder="例如: 8080"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>用户名 (可选)</label>
            <input
              type="text"
              value={newProxy.username}
              onChange={(e) => setNewProxy(prev => ({
                ...prev,
                username: e.target.value
              }))}
            />
          </div>

          <div className="form-group">
            <label>密码 (可选)</label>
            <input
              type="password"
              value={newProxy.password}
              onChange={(e) => setNewProxy(prev => ({
                ...prev,
                password: e.target.value
              }))}
            />
          </div>
        </div>

        <button
          onClick={handleAddProxy}
          className="add-button"
          disabled={!newProxy.host || !newProxy.port}
        >
          添加代理
        </button>
      </div>
    </div>
  );
}; 