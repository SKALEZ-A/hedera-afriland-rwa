// Global type declarations for React Native modules

/// <reference types="react" />
/// <reference types="react-native" />

// Remove problematic React module declaration - let TypeScript use the official @types/react

declare module 'react-native-splash-screen' {
  export default class SplashScreen {
    static show(): void;
    static hide(): void;
  }
}

declare module 'react-native-toast-message' {
  import { Component } from 'react';
  
  interface ToastConfig {
    [key: string]: (props: any) => JSX.Element;
  }
  
  interface ToastShowParams {
    type?: string;
    text1?: string;
    text2?: string;
    position?: 'top' | 'bottom';
    visibilityTime?: number;
    autoHide?: boolean;
    topOffset?: number;
    bottomOffset?: number;
    onShow?: () => void;
    onHide?: () => void;
    onPress?: () => void;
    props?: any;
  }
  
  export default class Toast extends Component {
    static show(params: ToastShowParams): void;
    static hide(): void;
  }
}

declare module 'react-native-vector-icons/MaterialIcons' {
  import { Component } from 'react';
  import { TextStyle, ViewStyle } from 'react-native';
  
  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle | ViewStyle;
  }
  
  export default class MaterialIcons extends Component<IconProps> {}
}

declare module 'react-native-vector-icons/Ionicons' {
  import { Component } from 'react';
  import { TextStyle, ViewStyle } from 'react-native';
  
  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle | ViewStyle;
  }
  
  export default class Ionicons extends Component<IconProps> {}
}

declare module 'react-native-linear-gradient' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';
  
  interface LinearGradientProps {
    colors: string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    locations?: number[];
    style?: ViewStyle;
    children?: React.ReactNode;
  }
  
  export default class LinearGradient extends Component<LinearGradientProps> {}
}

declare module 'react-query' {
  export * from '@tanstack/react-query';
}

declare module '@react-native-async-storage/async-storage' {
  export default class AsyncStorage {
    static getItem(key: string): Promise<string | null>;
    static setItem(key: string, value: string): Promise<void>;
    static removeItem(key: string): Promise<void>;
    static clear(): Promise<void>;
    static getAllKeys(): Promise<string[]>;
    static multiGet(keys: string[]): Promise<[string, string | null][]>;
    static multiSet(keyValuePairs: [string, string][]): Promise<void>;
    static multiRemove(keys: string[]): Promise<void>;
  }
}

declare module 'react-native-keychain' {
  export interface UserCredentials {
    username: string;
    password: string;
    service?: string;
    storage?: string;
  }
  
  export interface Options {
    service?: string;
    accessGroup?: string;
    authenticationPrompt?: string;
    authenticationType?: string;
    accessControl?: string;
    canImplyAuthentication?: boolean;
    touchID?: boolean;
    showModal?: boolean;
    kLocalizedFallbackTitle?: string;
  }
  
  export function setInternetCredentials(
    server: string,
    username: string,
    password: string,
    options?: Options
  ): Promise<void>;
  
  export function getInternetCredentials(
    server: string,
    options?: Options
  ): Promise<UserCredentials | false>;
  
  export function resetInternetCredentials(server: string): Promise<void>;
  
  export function setGenericPassword(
    username: string,
    password: string,
    options?: Options
  ): Promise<void>;
  
  export function getGenericPassword(options?: Options): Promise<UserCredentials | false>;
  
  export function resetGenericPassword(options?: Options): Promise<void>;
}

// Global type augmentations
declare global {
  namespace ReactNavigation {
    interface RootParamList {
      // Define your navigation param types here
      [key: string]: any;
    }
  }
}

// Module augmentations for better type safety
declare module '*.png' {
  const value: any;
  export default value;
}

declare module '*.jpg' {
  const value: any;
  export default value;
}

declare module '*.jpeg' {
  const value: any;
  export default value;
}

declare module '*.svg' {
  const value: any;
  export default value;
}

declare module '*.json' {
  const value: any;
  export default value;
}