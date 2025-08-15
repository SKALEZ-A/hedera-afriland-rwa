import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

/**
 * Initialize the app with necessary permissions and setup
 */
export const initializeApp = async (): Promise<void> => {
  try {
    // Request necessary permissions
    await requestPermissions();
    
    // Check network connectivity
    await checkNetworkConnectivity();
    
    // Initialize app settings
    await initializeAppSettings();
    
    console.log('App initialized successfully');
  } catch (error) {
    console.error('App initialization failed:', error);
    throw error;
  }
};

/**
 * Request necessary permissions for the app
 */
const requestPermissions = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ];

      const granted = await PermissionsAndroid.requestMultiple(permissions);
      
      Object.keys(granted).forEach((permission) => {
        if (granted[permission] === PermissionsAndroid.RESULTS.GRANTED) {
          console.log(`${permission} permission granted`);
        } else {
          console.log(`${permission} permission denied`);
        }
      });
    } catch (error) {
      console.error('Permission request failed:', error);
    }
  }
};

/**
 * Check network connectivity
 */
const checkNetworkConnectivity = async (): Promise<void> => {
  try {
    const netInfo = await NetInfo.fetch();
    
    if (!netInfo.isConnected) {
      console.warn('No network connection detected');
    } else {
      console.log('Network connection available:', netInfo.type);
    }
  } catch (error) {
    console.error('Network check failed:', error);
  }
};

/**
 * Initialize app settings and preferences
 */
const initializeAppSettings = async (): Promise<void> => {
  try {
    // Check if this is the first app launch
    const isFirstLaunch = await AsyncStorage.getItem('isFirstLaunch');
    
    if (isFirstLaunch === null) {
      // First launch - set default settings
      await AsyncStorage.setItem('isFirstLaunch', 'false');
      await AsyncStorage.setItem('themeMode', 'system');
      await AsyncStorage.setItem('biometricEnabled', 'false');
      
      console.log('First launch - default settings applied');
    }
    
    // Initialize other app-specific settings
    await initializeNotificationSettings();
    
  } catch (error) {
    console.error('App settings initialization failed:', error);
  }
};

/**
 * Initialize notification settings
 */
const initializeNotificationSettings = async (): Promise<void> => {
  try {
    const notificationSettings = await AsyncStorage.getItem('notificationSettings');
    
    if (!notificationSettings) {
      const defaultSettings = {
        push: true,
        email: true,
        sms: false,
        dividends: true,
        trading: true,
        news: false,
      };
      
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(defaultSettings));
      console.log('Default notification settings applied');
    }
  } catch (error) {
    console.error('Notification settings initialization failed:', error);
  }
};