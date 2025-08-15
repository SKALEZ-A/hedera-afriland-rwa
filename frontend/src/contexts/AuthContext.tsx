import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authApi } from '../services/api/authApi';
import { User, LoginCredentials, RegisterData } from '../types/auth';
import toast from 'react-hot-toast';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User };

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('authToken'),
  isLoading: true,
  isAuthenticated: false,
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
    default:
      return state;
  }
};

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshToken: () => Promise<void>;
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
      const token = localStorage.getItem('authToken');
      
      if (token) {
        try {
          // Verify token and get user data
          const response = await authApi.verifyToken();
          
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: response.data.user,
              token,
            },
          });
        } catch (error) {
          // Token is invalid, remove it
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          dispatch({ type: 'AUTH_FAILURE' });
        }
      } else {
        dispatch({ type: 'AUTH_FAILURE' });
      }
    };

    initializeAuth();
  }, []);

  // Set up axios interceptor for token refresh
  useEffect(() => {
    const interceptor = authApi.setupTokenRefreshInterceptor(
      () => state.token,
      (newToken: string) => {
        localStorage.setItem('authToken', newToken);
        // Update state with new token if needed
      },
      () => {
        // Token refresh failed, logout user
        logout();
      }
    );

    return () => {
      // Clean up interceptor
      if (interceptor) {
        authApi.removeInterceptor(interceptor);
      }
    };
  }, [state.token]);

  const login = async (credentials: LoginCredentials) => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await authApi.login(credentials);
      const { user, token, refreshToken } = response.data;

      // Store tokens
      localStorage.setItem('authToken', token);
      localStorage.setItem('refreshToken', refreshToken);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token },
      });

      toast.success('Welcome back!');
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      
      const errorMessage = error.response?.data?.error || 'Login failed';
      toast.error(errorMessage);
      
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await authApi.register(data);
      const { user, token, refreshToken } = response.data;

      // Store tokens
      localStorage.setItem('authToken', token);
      localStorage.setItem('refreshToken', refreshToken);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token },
      });

      toast.success('Account created successfully!');
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      
      const errorMessage = error.response?.data?.error || 'Registration failed';
      toast.error(errorMessage);
      
      throw error;
    }
  };

  const logout = () => {
    // Clear tokens
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');

    // Call logout API (fire and forget)
    authApi.logout().catch(() => {
      // Ignore errors on logout
    });

    dispatch({ type: 'LOGOUT' });
    toast.success('Logged out successfully');
  };

  const updateUser = (user: User) => {
    dispatch({ type: 'UPDATE_USER', payload: user });
  };

  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authApi.refreshToken(refreshToken);
      const { token: newToken, refreshToken: newRefreshToken } = response.data;

      localStorage.setItem('authToken', newToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      // Update state if needed
      if (state.user) {
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: state.user,
            token: newToken,
          },
        });
      }
    } catch (error) {
      // Refresh failed, logout user
      logout();
      throw error;
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};