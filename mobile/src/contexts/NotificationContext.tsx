import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import PushNotification from 'react-native-push-notification';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

interface NotificationSettings {
  push: boolean;
  email: boolean;
  sms: boolean;
  dividends: boolean;
  trading: boolean;
  news: boolean;
}

interface NotificationContextType {
  settings: NotificationSettings;
  updateSettings: (newSettings: Partial<NotificationSettings>) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  hasPermission: boolean;
}

const defaultSettings: NotificationSettings = {
  push: true,
  email: true,
  sms: false,
  dividends: true,
  trading: true,
  news: false,
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    initializeNotifications();
    loadSettings();
  }, []);

  useEffect(() => {
    if (user) {
      // Register for push notifications when user is authenticated
      registerForPushNotifications();
    }
  }, [user]);

  const initializeNotifications = () => {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('Push notification token:', token);
        setHasPermission(true);
        // Send token to server
        sendTokenToServer(token.token);
      },

      onNotification: (notification) => {
        console.log('Notification received:', notification);
        
        // Handle notification tap
        if (notification.userInteraction) {
          handleNotificationTap(notification);
        }
      },

      onAction: (notification) => {
        console.log('Notification action:', notification);
      },

      onRegistrationError: (err) => {
        console.error('Push notification registration error:', err);
        setHasPermission(false);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'default',
          channelName: 'Default',
          channelDescription: 'Default notifications',
          playSound: true,
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log(`Default channel created: ${created}`)
      );

      PushNotification.createChannel(
        {
          channelId: 'dividends',
          channelName: 'Dividend Payments',
          channelDescription: 'Notifications for dividend payments',
          playSound: true,
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log(`Dividends channel created: ${created}`)
      );

      PushNotification.createChannel(
        {
          channelId: 'trading',
          channelName: 'Trading Updates',
          channelDescription: 'Notifications for trading activities',
          playSound: true,
          soundName: 'default',
          importance: 3,
          vibrate: false,
        },
        (created) => console.log(`Trading channel created: ${created}`)
      );
    }
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('notificationSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(updatedSettings));
      
      // Update server settings
      if (user) {
        // TODO: Send settings to server
      }
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'ios') {
        const permissions = await PushNotification.requestPermissions();
        const granted = permissions.alert && permissions.badge && permissions.sound;
        setHasPermission(granted);
        return granted;
      } else {
        // Android permissions are handled during initialization
        return hasPermission;
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  };

  const registerForPushNotifications = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        console.log('Push notification permission denied');
        return;
      }
    }

    // Register for push notifications
    PushNotification.registerForPushNotifications();
  };

  const sendTokenToServer = async (token: string) => {
    try {
      // TODO: Send push token to server
      console.log('Sending push token to server:', token);
    } catch (error) {
      console.error('Failed to send push token to server:', error);
    }
  };

  const handleNotificationTap = (notification: any) => {
    // TODO: Handle notification tap navigation
    console.log('Notification tapped:', notification);
  };

  const value: NotificationContextType = {
    settings,
    updateSettings,
    requestPermission,
    hasPermission,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};