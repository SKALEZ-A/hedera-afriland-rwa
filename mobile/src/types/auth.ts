export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  walletAddress?: string;
  kycStatus: 'pending' | 'approved' | 'rejected';
  verificationLevel: 'basic' | 'verified' | 'accredited';
  roles: string[];
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
    realTime: boolean;
  };
  language: string;
  currency: string;
  timezone: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    refreshToken: string;
  };
}