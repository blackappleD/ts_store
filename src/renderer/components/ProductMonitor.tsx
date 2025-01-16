import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { Product } from '../../common/interfaces/types';

interface ProductMonitorProps {
  onProductAvailable: (product: Product) => void;
}

export const ProductMonitor: React.FC<ProductMonitorProps> = ({ onProductAvailable }) => {
  const [targetUrl, setTargetUrl] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [status, setStatus] = useState('未开始监控');
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  useEffect(() => {
    // 监听商品状态更新
    const handleProductStatus = (_: any, product: Product) => {
      setStatus(`商品状态: ${product.available ? '可购买' : '暂无库存'}`);
      setLastCheckTime(new Date());
      
      if (product.available) {
        console.log('商品可购买，触发购买流程');
        onProductAvailable(product);
        // 自动停止监控
        handleStopMonitoring();
      }
    };

    ipcRenderer.on('product-status', handleProductStatus);
    return () => {
      ipcRenderer.removeListener('product-status', handleProductStatus);
    };
  }, [onProductAvailable]);

  const handleStartMonitoring = async () => {
    if (!targetUrl) {
      alert('请输入商品URL');
      return;
    }

    try {
      await ipcRenderer.invoke('start-monitoring', targetUrl);
      setIsMonitoring(true);
      setStatus('正在监控中...');
    } catch (error) {
      console.error('启动监控失败:', error);
      setStatus('监控启动失败');
    }
  };

  const handleStopMonitoring = async () => {
    await ipcRenderer.invoke('stop-monitoring');
    setIsMonitoring(false);
    setStatus('监控已停止');
  };

  return (
    <div className="product-monitor">
      <h3>商品监控</h3>
      
      <div className="monitor-form">
        <div className="form-group">
          <input
            type="text"
            placeholder="请输入商品URL"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            disabled={isMonitoring}
          />
        </div>

        <div className="monitor-controls">
          {!isMonitoring ? (
            <button 
              className="start-button"
              onClick={handleStartMonitoring}
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

        <div className="monitor-status">
          <p>{status}</p>
          {lastCheckTime && (
            <p className="last-check">
              上次检查时间: {lastCheckTime.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}; 