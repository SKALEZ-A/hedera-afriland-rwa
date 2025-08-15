import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Create rate limiter with custom configuration
 */
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: options.message || 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      res.status(429).json({
        success: false,
        error: options.message || 'Too many requests, please try again later.',
        retryAfter: Math.round(options.windowMs / 1000)
      });
    }
  });
};

/**
 * General API rate limiter
 */
export const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later.'
});

/**
 * Authentication rate limiter (stricter)
 */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true // Don't count successful logins
});

/**
 * Payment rate limiter
 */
export const paymentLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 payment attempts per window
  message: 'Too many payment attempts, please try again later.'
});

/**
 * Trading rate limiter
 */
export const tradingLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 trading operations per minute
  message: 'Too many trading requests, please slow down.'
});

/**
 * Notification rate limiter
 */
export const notificationLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 notification requests per minute
  message: 'Too many notification requests, please try again later.'
});

/**
 * File upload rate limiter
 */
export const uploadLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // 20 uploads per window
  message: 'Too many file uploads, please try again later.'
});

/**
 * KYC rate limiter
 */
export const kycLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 KYC attempts per hour
  message: 'Too many KYC verification attempts, please try again later.'
});