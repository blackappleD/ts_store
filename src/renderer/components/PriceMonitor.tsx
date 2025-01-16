import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { Line } from 'react-chartjs-2';

interface PriceHistory {
  timestamp: number;
  price: number;
}

interface PriceAlert {
  productId: string;
  targetPrice: number;
  condition: 'below' | 'above';
  enabled: boolean;
}

export const PriceMonitor: React.FC<{ productId: string }> = ({ productId }) => {
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [alert, setAlert] = useState<PriceAlert>({
    productId,
    targetPrice: 0,
    condition: 'below',
    enabled: false
  });

  useEffect(() => {
    loadPriceHistory();
    loadAlert();
    
    const interval = setInterval(loadPriceHistory, 5000);
    ipcRenderer.on('price-updated', handlePriceUpdate);
    
    return () => {
      clearInterval(interval);
      ipcRenderer.removeListener('price-updated', handlePriceUpdate);
    };
  }, [productId]);

  const loadPriceHistory = async () => {
    const history = await ipcRenderer.invoke('get-price-history', productId);
    setPriceHistory(history);
  };

  const loadAlert = async () => {
    const alerts = await ipcRenderer.invoke('get-price-alerts', productId);
    if (alerts.length > 0) {
      setAlert(alerts[0]);
    }
  };

  const handlePriceUpdate = (event: any, data: { productId: string; price: number }) => {
    if (data.productId === productId) {
      loadPriceHistory();
    }
  };

  const handleAlertChange = async (changes: Partial<PriceAlert>) => {
    const newAlert = { ...alert, ...changes };
    setAlert(newAlert);
    await ipcRenderer.invoke('set-price-alert', newAlert);
  };

  const getChartData = () => {
    return {
      labels: priceHistory.map(record => new Date(record.timestamp).toLocaleString()),
      datasets: [
        {
          label: '商品价格',
          data: priceHistory.map(record => record.price),
          fill: false,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }
      ]
    };
  };

  return (
    <div className="price-monitor">
      <h3>价格监控</h3>

      <div className="price-chart">
        {priceHistory.length > 0 && (
          <Line
            data={getChartData()}
            options={{
              responsive: true,
              scales: {
                y: {
                  beginAtZero: false
                }
              }
            }}
          />
        )}
      </div>

      <div className="price-alert-settings">
        <h4>价格提醒</h4>
        <div className="alert-form">
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={alert.enabled}
                onChange={(e) => handleAlertChange({ enabled: e.target.checked })}
              />
              启用价格提醒
            </label>
          </div>

          {alert.enabled && (
            <>
              <div className="form-group">
                <label>目标价格</label>
                <input
                  type="number"
                  value={alert.targetPrice}
                  onChange={(e) => handleAlertChange({ 
                    targetPrice: parseFloat(e.target.value) 
                  })}
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>提醒条件</label>
                <select
                  value={alert.condition}
                  onChange={(e) => handleAlertChange({ 
                    condition: e.target.value as 'below' | 'above' 
                  })}
                >
                  <option value="below">价格低于目标价格时</option>
                  <option value="above">价格高于目标价格时</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 