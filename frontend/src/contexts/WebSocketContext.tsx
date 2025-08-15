import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

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
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

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

  const connectSocket = () => {
    if (socket?.connected) {
      return;
    }

    const newSocket = io(process.env.REACT_APP_WS_URL || 'ws://localhost:3001', {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      
      // Join user-specific room
      if (user) {
        newSocket.emit('join_user_room', { userId: user.id });
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      
      // Don't show error for intentional disconnects
      if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
        toast.error('Connection lost. Attempting to reconnect...');
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      
      reconnectAttemptsRef.current++;
      
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        toast.error('Unable to establish real-time connection. Some features may be limited.');
      }
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      toast.success('Connection restored');
    });

    // Global notification handlers
    newSocket.on('notification', (data) => {
      handleNotification(data);
    });

    newSocket.on('dividend_payment', (data) => {
      toast.success(`Dividend payment received: $${data.amount} from ${data.propertyName}`);
    });

    newSocket.on('investment_confirmed', (data) => {
      toast.success(`Investment confirmed: ${data.tokenAmount} tokens in ${data.propertyName}`);
    });

    newSocket.on('order_matched', (data) => {
      toast.success(`Order matched: ${data.amount} tokens at $${data.price}`);
    });

    newSocket.on('property_update', (data) => {
      toast.info(`Property update: ${data.message}`);
    });

    setSocket(newSocket);
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
        toast.success(message || title);
        break;
      case 'error':
        toast.error(message || title);
        break;
      case 'warning':
        toast(message || title, {
          icon: '⚠️',
          duration: urgent ? 8000 : 4000,
        });
        break;
      case 'info':
      default:
        toast(message || title, {
          icon: 'ℹ️',
          duration: urgent ? 6000 : 4000,
        });
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