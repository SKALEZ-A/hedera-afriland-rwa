import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Keychain from 'react-native-keychain';
import { authApi } from '../services/api/authApi';
import { User, LoginCredentials, RegisterData } from '../types/auth';
import { showToast } from '../utils/toast';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  biometricEnabled: boolean;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'SET_BIOMETRIC'; payload: boolean };

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  biometricEnabled: false,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
        isAuthenticated: true,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    case 'SET_BIOMETRIC':
      return {
        ...state,
        biometricEnabled: action.payload,
      };
    default:
      return state;
  }
};

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithBiometric: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check for stored token
        const token = await AsyncStorage.getItem('authToken');
        
        if (token) {
          // Verify token and get user data
          const response = await authApi.verifyToken();
          
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: response.data.user,
              token,
            },
          });
        } else {
          dispatch({ type: 'AUTH_FAILURE' });
        }

        // Check biometric settings
        const biometricEnabled = await AsyncStorage.getItem('biometricEnabled');
        dispatch({
          type: 'SET_BIOMETRIC',
          payload: biometricEnabled === 'true',
        });
      } catch (error) {
        // Token is invalid, remove it
        await AsyncStorage.multiRemove(['authToken', 'refreshToken']);
        dispatch({ type: 'AUTH_FAILURE' });
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await authApi.login(credentials);
      const { user, token, refreshToken } = response.data;

      // Store tokens
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('refreshToken', refreshToken);

      // Store credentials in keychain if biometric is enabled
      if (state.biometricEnabled) {
        await Keychain.setInternetCredentials(
          'globalland_auth',
          credentials.email,
          credentials.password
        );
      }

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token },
      });

      showToast('success', 'Welcome back!');
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      
      const errorMessage = error.response?.data?.error || 'Login failed';
      showToast('error', errorMessage);
      
      throw error;
    }
  };

  const loginWithBiometric = async () => {
    try {
      dispatch({ type: 'AUTH_START' });

      // Get credentials from keychain
      const credentials = await Keychain.getInternetCredentials('globalland_auth');
      
      if (!credentials || credentials === false) {
        throw new Error('No biometric credentials found');
      }

      // Login with stored credentials
      await login({
        email: credentials.username,
        password: credentials.password,
      });
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      showToast('error', 'Biometric authentication failed');
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await authApi.register(data);
      const { user, token, refreshToken } = response.data;

      // Store tokens
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('refreshToken', refreshToken);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token },
      });

      showToast('success', 'Account created successfully!');
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      
      const errorMessage = error.response?.data?.error || 'Registration failed';
      showToast('error', errorMessage);
      
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear tokens
      await AsyncStorage.multiRemove(['authToken', 'refreshToken']);
      
      // Clear keychain
      await Keychain.resetInternetCredentials('globalland_auth');

      // Call logout API (fire and forget)
      authApi.logout().catch(() => {
        // Ignore errors on logout
      });

      dispatch({ type: 'LOGOUT' });
      showToast('success', 'Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = (user: User) => {
    dispatch({ type: 'UPDATE_USER', payload: user });
  };

  const enableBiometric = async () => {
    try {
      await AsyncStorage.setItem('biometricEnabled', 'true');
      dispatch({ type: 'SET_BIOMETRIC', payload: true });
      showToast('success', 'Biometric authentication enabled');
    } catch (error) {
      showToast('error', 'Failed to enable biometric authentication');
      throw error;
    }
  };

  const disableBiometric = async () => {
    try {
      await AsyncStorage.setItem('biometricEnabled', 'false');
      await Keychain.resetInternetCredentials('globalland_auth');
      dispatch({ type: 'SET_BIOMETRIC', payload: false });
      showToast('success', 'Biometric authentication disabled');
    } catch (error) {
      showToast('error', 'Failed to disable biometric authentication');
      throw error;
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    loginWithBiometric,
    register,
    logout,
    updateUser,
    enableBiometric,
    disableBiometric,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};