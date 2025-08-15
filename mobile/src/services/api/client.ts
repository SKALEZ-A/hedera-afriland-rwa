import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToast } from '../../utils/toast';

// API client configuration
const API_BASE_URL = 'http://localhost:3001/api'; // This should be configurable

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { token } = response.data.data;
          await AsyncStorage.setItem('authToken', token);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens
        await AsyncStorage.multiRemove(['authToken', 'refreshToken']);
        // Navigate to login would be handled by auth context
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    handleApiError(error);
    return Promise.reject(error);
  }
);

// Error handler
const handleApiError = (error: any) => {
  if (!error.response) {
    // Network error
    showToast('error', 'Network Error', 'Please check your connection');
    return;
  }

  const { status, data } = error.response;
  const message = data?.error || data?.message || 'An error occurred';

  switch (status) {
    case 400:
      showToast('error', 'Invalid Request', message);
      break;
    case 401:
      // Handled by interceptor
      break;
    case 403:
      showToast('error', 'Access Denied', 'You do not have permission');
      break;
    case 404:
      showToast('error', 'Not Found', 'Resource not found');
      break;
    case 429:
      showToast('error', 'Too Many Requests', 'Please try again later');
      break;
    case 500:
      showToast('error', 'Server Error', 'Please try again later');
      break;
    default:
      showToast('error', 'Error', message);
  }
};

// API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

// Generic API methods
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> =>
    apiClient.get(url, config),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> =>
    apiClient.post(url, data, config),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> =>
    apiClient.put(url, data, config),

  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse<T>>> =>
    apiClient.delete(url, config),
};

export default apiClient;