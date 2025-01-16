import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';

export const NotificationSettings: React.FC = () => {
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await ipcRenderer.invoke('get-notification-settings');
        if (settings) {
          setNotificationEnabled(settings.enabled);
        }
      } catch (error) {
        console.error('加载通知设置失败:', error);
        setError('加载通知设置失败');
      }
    };

    loadSettings();
  }, []);

  const handleChange = async (enabled: boolean) => {
    try {
      await ipcRenderer.invoke('save-notification-settings', { enabled });
      setNotificationEnabled(enabled);
      setError(null);
    } catch (error) {
      console.error('保存通知设置失败:', error);
      setError('保存通知设置失败');
    }
  };

  return (
    <div className="notification-settings">
      <h3>通知设置</h3>
      <div className="form-group checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={notificationEnabled}
            onChange={(e) => handleChange(e.target.checked)}
          />
          <span>启用通知</span>
        </label>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
}; 