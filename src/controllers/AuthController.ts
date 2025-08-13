import { Request, Response } from 'express';
import { AuthService, RegisterData, LoginCredentials } from '../services/AuthService';
import { KYCService, KYCSubmission } from '../services/KYCService';
import { ComplianceService } from '../services/ComplianceService';
import { logger } from '../utils/logger';
import Joi from 'joi';

export class AuthController {
  private authService: AuthService;
  private kycService: KYCService;
  private complianceService: ComplianceService;

  constructor() {
    this.authService = new AuthService();
    this.kycService = new KYCService();
    this.complianceService = new ComplianceService();
  }

  /**
   * Register new user
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required(),
        firstName: Joi.string().min(2).max(50).required(),
        lastName: Joi.string().min(2).max(50).required(),
        phone: Joi.string().optional(),
        dateOfBirth: Joi.date().optional(),
        nationality: Joi.string().length(3).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(d => d.message)
        });
        return;
      }

      const registerData: RegisterData = value;

      // Register user
      const result = await this.authService.register(registerData);

      // Record audit event
      await this.complianceService.recordAuditEvent({
        userId: result.user.id,
        action: 'user_registered',
        resourceType: 'user',
        resourceId: result.user.id,
        newValues: {
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            kycStatus: result.user.kycStatus,
            verificationLevel: result.user.verificationLevel,
            emailVerified: result.user.emailVerified
          },
          tokens: result.tokens
        }
      });
    } catch (error) {
      logger.error('Registration failed', {
        error: error.message,
        email: req.body.email,
        ip: req.ip
      });

      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Login user
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(d => d.message)
        });
        return;
      }

      const credentials: LoginCredentials = value;

      // Login user
      const result = await this.authService.login(credentials);

      // Record audit event
      await this.complianceService.recordAuditEvent({
        userId: result.user.id,
        action: 'user_login',
        resourceType: 'user',
        resourceId: result.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            kycStatus: result.user.kycStatus,
            verificationLevel: result.user.verificationLevel,
            emailVerified: result.user.emailVerified,
            lastLogin: result.user.lastLogin
          },
          tokens: result.tokens
        }
      });
    } catch (error) {
      logger.error('Login failed', {
        error: error.message,
        email: req.body.email,
        ip: req.ip
      });

      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = Joi.object({
        refreshToken: Joi.string().required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Refresh token required'
        });
        return;
      }

      const tokens = await this.authService.refreshToken(value.refreshToken);

      res.json({
        success: true,
        data: { tokens }
      });
    } catch (error) {
      logger.error('Token refresh failed', {
        error: error.message,
        ip: req.ip
      });

      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Logout user
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      if (req.user) {
        await this.authService.logout(req.user.id);

        // Record audit event
        await this.complianceService.recordAuditEvent({
          userId: req.user.id,
          action: 'user_logout',
          resourceType: 'user',
          resourceId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout failed', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  };

  /**
   * Get current user profile
   */
  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          user: {
            id: req.user.id,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            phone: req.user.phone,
            dateOfBirth: req.user.dateOfBirth,
            nationality: req.user.nationality,
            walletAddress: req.user.walletAddress,
            kycStatus: req.user.kycStatus,
            verificationLevel: req.user.verificationLevel,
            isAccreditedInvestor: req.user.isAccreditedInvestor,
            emailVerified: req.user.emailVerified,
            phoneVerified: req.user.phoneVerified,
            twoFactorEnabled: req.user.twoFactorEnabled,
            lastLogin: req.user.lastLogin,
            createdAt: req.user.createdAt
          }
        }
      });
    } catch (error) {
      logger.error('Get profile failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get profile'
      });
    }
  };

  /**
   * Change password
   */
  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const schema = Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(8).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(d => d.message)
        });
        return;
      }

      await this.authService.changePassword(
        req.user.id,
        value.currentPassword,
        value.newPassword
      );

      // Record audit event
      await this.complianceService.recordAuditEvent({
        userId: req.user.id,
        action: 'password_changed',
        resourceType: 'user',
        resourceId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Password change failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Request password reset
   */
  requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = Joi.object({
        email: Joi.string().email().required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Valid email required'
        });
        return;
      }

      await this.authService.requestPasswordReset(value.email);

      res.json({
        success: true,
        message: 'Password reset instructions sent to email'
      });
    } catch (error) {
      logger.error('Password reset request failed', {
        error: error.message,
        email: req.body.email
      });

      res.status(500).json({
        success: false,
        error: 'Failed to process password reset request'
      });
    }
  };

  /**
   * Reset password with token
   */
  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = Joi.object({
        resetToken: Joi.string().required(),
        newPassword: Joi.string().min(8).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(d => d.message)
        });
        return;
      }

      await this.authService.resetPassword(value.resetToken, value.newPassword);

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      logger.error('Password reset failed', {
        error: error.message
      });

      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };
}