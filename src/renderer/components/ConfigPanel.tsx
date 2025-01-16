import React from 'react';
import { Config } from '../../common/interfaces/types';

interface ConfigPanelProps {
  config: Config;
  onConfigChange: (config: Config) => void;
  disabled: boolean;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  onConfigChange,
  disabled
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    onConfigChange({
      ...config,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  return (
    <div className="config-panel">
      <h2>配置</h2>
      <div className="form-group">
        <label>
          商品URL：
          <input
            type="text"
            name="targetUrl"
            value={config.targetUrl}
            onChange={handleChange}
            disabled={disabled}
          />
        </label>
      </div>

      <div className="form-group">
        <label>
          刷新间隔（毫秒）：
          <input
            type="number"
            name="refreshInterval"
            value={config.refreshInterval}
            onChange={handleChange}
            min="1000"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            name="autoRetry"
            checked={config.autoRetry}
            onChange={handleChange}
            disabled={disabled}
          />
          自动重试
        </label>
      </div>

      {config.autoRetry && (
        <div className="form-group">
          <label>
            最大重试次数：
            <input
              type="number"
              name="maxRetries"
              value={config.maxRetries}
              onChange={handleChange}
              min="1"
              disabled={disabled}
            />
          </label>
        </div>
      )}
    </div>
  );
}; 