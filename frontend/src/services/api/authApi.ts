import { api } from './client';
import { 
  LoginCredentials, 
  RegisterData, 
  AuthResponse, 
  ForgotPasswordData,
  ResetPasswordData,
  ChangePasswordData,
  UpdateProfileData,
  User
} from '../../types/auth';

export const authApi = {
  // Authentication
  login: (credentials: LoginCredentials) =>
    api.post<AuthResponse['data']>('/auth/login', credentials),

  register: (data: RegisterData) =>
    api.post<AuthResponse['data']>('/auth/register', data),

  logout: () =>
    api.post('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    api.post<{ token: string; refreshToken: string }>('/auth/refresh', { refreshToken }),

  verifyToken: () =>
    api.get<{ user: User }>('/auth/verify'),

  // Password management
  forgotPassword: (data: ForgotPasswordData) =>
    api.post('/auth/forgot-password', data),

  resetPassword: (data: ResetPasswordData) =>
    api.post('/auth/reset-password', data),

  changePassword: (data: ChangePasswordData) =>
    api.post('/auth/change-password', data),

  // Profile management
  getProfile: () =>
    api.get<User>('/auth/profile'),

  updateProfile: (data: UpdateProfileData) =>
    api.put<User>('/auth/profile', data),

  // KYC
  uploadKYCDocuments: (formData: FormData) =>
    api.upload('/auth/kyc/upload', formData),

  getKYCStatus: () =>
    api.get<{ status: string; documents: any[] }>('/auth/kyc/status'),

  // Token refresh interceptor setup
  setupTokenRefreshInterceptor: (
    getToken: () => string | null,
    setToken: (token: string) => void,
    onRefreshFailed: () => void
  ) => {
    // This would be implemented in the main client
    // For now, return a placeholder
    return null;
  },

  removeInterceptor: (interceptor: any) => {
    // Remove interceptor implementation
  },
};