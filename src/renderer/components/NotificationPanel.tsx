import React from 'react';

interface NotificationPanelProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  enabled,
  onToggle
}) => {
  return (
    <div className="notification-panel">
      <h2>通知设置</h2>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          启用桌面通知
        </label>
      </div>
    </div>
  );
}; 