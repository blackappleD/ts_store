import { app, Notification } from 'electron';
import path from 'path';
import Store from 'electron-store';

export interface NotificationSettings {
  enabled: boolean;
}

interface StoreSchema {
  settings: NotificationSettings;
}

export interface INotificationManager {
  getSettings(): NotificationSettings;
  saveSettings(settings: NotificationSettings): void;
  showNotification(title: string, body: string): Promise<void>;
  notify(title: string, message: string, type: 'success' | 'error' | 'info'): Promise<void>;
}

class NotificationManager implements INotificationManager {
  private store: Store<StoreSchema>;
  private settings: NotificationSettings;

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'notification-settings',
      defaults: {
        settings: {
          enabled: true
        }
      }
    });

    this.settings = this.store.get('settings');
  }

  getSettings(): NotificationSettings {
    return this.settings;
  }

  saveSettings(settings: NotificationSettings): void {
    this.settings = settings;
    this.store.set('settings', settings);
  }

  async showNotification(title: string, body: string): Promise<void> {
    if (!this.settings.enabled) {
      return;
    }

    if (!app.isReady()) {
      await app.whenReady();
    }

    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, '../assets/icon.png')
    });

    notification.show();
  }

  async notify(title: string, message: string, type: 'success' | 'error' | 'info'): Promise<void> {
    await this.showNotification(title, message);
  }
}

export const notificationManager = new NotificationManager(); 