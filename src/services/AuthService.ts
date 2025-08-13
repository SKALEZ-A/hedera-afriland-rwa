import jwt, { SignOptions } from 'jsonwebtoken';
import { UserModel } from '../models/UserModel';
import { User, UserKYCStatus, UserVerificationLevel } from '../types/entities';
import { logger } from '../utils/logger';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: Date;
  nationality?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  kycStatus: UserKYCStatus;
  verificationLevel: UserVerificationLevel;
  roles: string[];
}

export class AuthService {
  private userModel: UserModel;
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.userModel = new UserModel();
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'your-access-secret-key';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      // Check if user already exists
      const existingUser = await this.userModel.findByEmail(userData.email);
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Create new user
      const user = await this.userModel.createUser(userData);
      
      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Update last login
      await this.userModel.updateLastLogin(user.id);

      logger.info('User registered successfully', { userId: user.id, email: user.email });

      return { user, tokens };
    } catch (error) {
      logger.error('Registration failed', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        email: userData.email 
      });
      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      // Verify user credentials
      const user = await this.userModel.verifyPassword(credentials.email, credentials.password);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Update last login
      await this.userModel.updateLastLogin(user.id);

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return { user, tokens };
    } catch (error) {
      logger.error('Login failed', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        email: credentials.email 
      });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret) as TokenPayload;
      
      // Get user from database
      const user = await this.userModel.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      logger.info('Token refreshed successfully', { userId: user.id });

      return tokens;
    } catch (error) {
      logger.error('Token refresh failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Verify access token and return user data
   */
  async verifyToken(accessToken: string): Promise<User> {
    try {
      // Verify access token
      const decoded = jwt.verify(accessToken, this.accessTokenSecret) as TokenPayload;
      
      // Get user from database
      const user = await this.userModel.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error('Token verification failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new Error('Invalid access token');
    }
  }

  /**
   * Generate access and refresh tokens for user
   */
  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      kycStatus: user.kycStatus,
      verificationLevel: user.verificationLevel,
      roles: this.getUserRoles(user)
    };

    const accessToken = jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'globalland-platform',
      audience: 'globalland-users'
    } as SignOptions);

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.refreshTokenSecret,
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'globalland-platform',
        audience: 'globalland-users'
      } as SignOptions
    );

    // Calculate expiry time in seconds
    const expiresIn = this.parseExpiryToSeconds(this.accessTokenExpiry);

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  /**
   * Get user roles based on verification level and status
   */
  private getUserRoles(user: User): string[] {
    const roles = ['user'];

    if (user.kycStatus === 'approved') {
      roles.push('verified_user');
    }

    if (user.isAccreditedInvestor) {
      roles.push('accredited_investor');
    }

    if (user.verificationLevel === 'advanced') {
      roles.push('advanced_user');
    }

    return roles;
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiryToSeconds(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900; // 15 minutes default
    }
  }

  /**
   * Logout user (invalidate tokens)
   */
  async logout(userId: string): Promise<void> {
    try {
      // In a production system, you would maintain a blacklist of tokens
      // or store active sessions in Redis and remove them here
      logger.info('User logged out', { userId });
    } catch (error) {
      logger.error('Logout failed', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        userId 
      });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await this.userModel.verifyPassword(user.email, currentPassword);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      await this.userModel.updatePassword(userId, newPassword);

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Password change failed', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        userId 
      });
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await this.userModel.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        logger.info('Password reset requested for non-existent user', { email });
        return;
      }

      // Generate reset token (in production, store this in database with expiry)
      const resetToken = jwt.sign(
        { userId: user.id, purpose: 'password_reset' },
        this.accessTokenSecret,
        { expiresIn: '1h' }
      );

      // In production, send email with reset link
      logger.info('Password reset token generated', { userId: user.id, resetToken });

      // TODO: Send email with reset link
    } catch (error) {
      logger.error('Password reset request failed', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        email 
      });
      throw error;
    }
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    try {
      // Verify reset token
      const decoded = jwt.verify(resetToken, this.accessTokenSecret) as any;
      
      if (decoded.purpose !== 'password_reset') {
        throw new Error('Invalid reset token');
      }

      // Update password
      await this.userModel.updatePassword(decoded.userId, newPassword);

      logger.info('Password reset successfully', { userId: decoded.userId });
    } catch (error) {
      logger.error('Password reset failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new Error('Invalid or expired reset token');
    }
  }
}