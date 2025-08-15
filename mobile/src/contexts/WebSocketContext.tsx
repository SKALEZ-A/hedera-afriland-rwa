import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { showToast } from '../utils/toast';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (event: string, callback: (data: any) => void) => void;
  unsubscribe: (event: string, callback?: (data: any) => void) => void;
  emit: (event: string, data?: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const appStateRef = useRef<AppStateStatus>('active');

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        if (user && token && !socket?.connected) {
          connectSocket();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App has gone to the background
        if (socket?.connected) {
          socket.disconnect();
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [user, token, socket]);

  useEffect(() => {
    if (user && token) {
      connectSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [user, token]);

  const connectSocket = async () => {
    if (socket?.connected) {
      return;
    }

    try {
      const wsUrl = await AsyncStorage.getItem('wsUrl') || 'ws://localhost:3001';
      
      const newSocket = io(wsUrl, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // Join user-specific room
        if (user) {
          newSocket.emit('join_user_room', { userId: user.id });
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setIsConnected(false);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('WebSocket reconnected after', attemptNumber, 'attempts');
        showToast('success', 'Connection restored');
      });

      // Global notification handlers
      newSocket.on('notification', (data) => {
        handleNotification(data);
      });

      newSocket.on('dividend_payment', (data) => {
        showToast('success', 'Dividend Received', `$${data.amount} from ${data.propertyName}`);
      });

      newSocket.on('investment_confirmed', (data) => {
        showToast('success', 'Investment Confirmed', `${data.tokenAmount} tokens in ${data.propertyName}`);
      });

      newSocket.on('order_matched', (data) => {
        showToast('success', 'Order Matched', `${data.amount} tokens at $${data.price}`);
      });

      newSocket.on('property_update', (data) => {
        showToast('info', 'Property Update', data.message);
      });

      setSocket(newSocket);
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  };

  const handleNotification = (data: any) => {
    const { type, title, message, urgent } = data;

    switch (type) {
      case 'success':
        showToast('success', title, message);
        break;
      case 'error':
        showToast('error', title, message);
        break;
      case 'warning':
        showToast('warning', title, message);
        break;
      case 'info':
      default:
        showToast('info', title, message);
        break;
    }
  };

  const subscribe = (event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const unsubscribe = (event: string, callback?: (data: any) => void) => {
    if (socket) {
      if (callback) {
        socket.off(event, callback);
      } else {
        socket.off(event);
      }
    }
  };

  const emit = (event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    }
  };

  const value: WebSocketContextType = {
    socket,
    isConnected,
    subscribe,
    unsubscribe,
    emit,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};