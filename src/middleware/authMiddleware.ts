import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthService } from '../services/AuthService';
import { User, UserKYCStatus, UserVerificationLevel } from '../types/entities';
import { logger } from '../utils/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      tokenPayload?: {
        userId: string;
        email: string;
        kycStatus: UserKYCStatus;
        verificationLevel: UserVerificationLevel;
        roles: string[];
      };
    }
  }
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Middleware to authenticate JWT token
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Access token required'
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Verify token and get user
      const user = await this.authService.verifyToken(token);
      
      // Attach user to request
      req.user = user;
      req.tokenPayload = {
        userId: user.id,
        email: user.email,
        kycStatus: user.kycStatus,
        verificationLevel: user.verificationLevel,
        roles: this.getUserRoles(user)
      };

      next();
    } catch (error) {
      logger.error('Authentication failed', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  };

  /**
   * Middleware to require KYC verification
   */
  requireKYC = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (req.user.kycStatus !== 'approved') {
      res.status(403).json({
        success: false,
        error: 'KYC verification required',
        kycStatus: req.user.kycStatus
      });
      return;
    }

    next();
  };

  /**
   * Middleware to require specific verification level
   */
  requireVerificationLevel = (minLevel: UserVerificationLevel) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const levelHierarchy: Record<UserVerificationLevel, number> = {
        'basic': 1,
        'intermediate': 2,
        'advanced': 3
      };

      const userLevel = levelHierarchy[req.user.verificationLevel];
      const requiredLevel = levelHierarchy[minLevel];

      if (userLevel < requiredLevel) {
        res.status(403).json({
          success: false,
          error: `Verification level '${minLevel}' required`,
          currentLevel: req.user.verificationLevel
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to require specific roles
   */
  requireRoles = (requiredRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.tokenPayload) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const userRoles = req.tokenPayload.roles;
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          requiredRoles,
          userRoles
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to require accredited investor status
   */
  requireAccreditedInvestor = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!req.user.isAccreditedInvestor) {
      res.status(403).json({
        success: false,
        error: 'Accredited investor status required'
      });
      return;
    }

    next();
  };

  /**
   * Middleware to check if user owns resource
   */
  requireOwnership = (userIdParam: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
      
      if (req.user.id !== resourceUserId) {
        res.status(403).json({
          success: false,
          error: 'Access denied: resource ownership required'
        });
        return;
      }

      next();
    };
  };

  /**
   * Optional authentication middleware (doesn't fail if no token)
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const user = await this.authService.verifyToken(token);
        
        req.user = user;
        req.tokenPayload = {
          userId: user.id,
          email: user.email,
          kycStatus: user.kycStatus,
          verificationLevel: user.verificationLevel,
          roles: this.getUserRoles(user)
        };
      }

      next();
    } catch (error) {
      // Don't fail on optional auth, just continue without user
      next();
    }
  };

  /**
   * Rate limiting middleware for authentication endpoints
   */
  rateLimitAuth = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
    const attempts = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction): void => {
      const clientId = req.ip + (req.body.email || '');
      const now = Date.now();
      
      const clientAttempts = attempts.get(clientId);
      
      if (clientAttempts) {
        if (now > clientAttempts.resetTime) {
          // Reset window
          attempts.set(clientId, { count: 1, resetTime: now + windowMs });
        } else if (clientAttempts.count >= maxAttempts) {
          res.status(429).json({
            success: false,
            error: 'Too many authentication attempts',
            retryAfter: Math.ceil((clientAttempts.resetTime - now) / 1000)
          });
          return;
        } else {
          clientAttempts.count++;
        }
      } else {
        attempts.set(clientId, { count: 1, resetTime: now + windowMs });
      }

      next();
    };
  };

  /**
   * Get user roles based on user properties
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

    // Add admin role based on email domain (for demo)
    if (user.email.endsWith('@globalland.com')) {
      roles.push('admin');
    }

    return roles;
  }
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();