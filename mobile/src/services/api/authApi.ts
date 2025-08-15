import { api } from './client';
import { LoginCredentials, RegisterData, AuthResponse, User } from '../../types/auth';

export const authApi = {
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

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),

  getProfile: () =>
    api.get<User>('/auth/profile'),

  updateProfile: (data: Partial<User>) =>
    api.put<User>('/auth/profile', data),
};