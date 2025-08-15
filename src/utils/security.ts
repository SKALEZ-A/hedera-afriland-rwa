import crypto from 'crypto';
import { Request } from 'express';
import { logger } from './logger';
import { securityConfig } from '../config/security';

/**
 * Security utility functions
 */
export class SecurityUtils {
  
  /**
   * Validate password against security policy
   */
  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const policy = securityConfig.passwordPolicy;

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = '';
    
    // Ensure at least one character from each required category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Sanitize input to prevent XSS
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if IP is in allowed range (for admin endpoints)
   */
  static isAllowedIP(ip: string, allowedRanges: string[] = []): boolean {
    if (allowedRanges.length === 0) return true;
    
    // Simple IP range checking (could be enhanced with proper CIDR support)
    return allowedRanges.some(range => {
      if (range.includes('/')) {
        // CIDR notation - simplified check
        const [network, bits] = range.split('/');
        // This is a simplified implementation
        return ip.startsWith(network.split('.').slice(0, Math.floor(parseInt(bits) / 8)).join('.'));
      } else {
        return ip === range;
      }
    });
  }

  /**
   * Generate CSRF token
   */
  static generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate CSRF token
   */
  static validateCSRFToken(token: string, sessionToken: string): boolean {
    if (!token || !sessionToken) return false;
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(sessionToken, 'hex')
    );
  }

  /**
   * Extract client IP from request
   */
  static getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }

  /**
   * Check if request is from mobile device
   */
  static isMobileDevice(userAgent: string): boolean {
    const mobileRegex = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i;
    return mobileRegex.test(userAgent);
  }

  /**
   * Generate secure API key
   */
  static generateAPIKey(prefix: string = 'gla'): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(16).toString('hex');
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Hash API key for storage
   */
  static hashAPIKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Validate request signature (for webhooks)
   */
  static validateSignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256'
  ): boolean {
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  }

  /**
   * Check for suspicious patterns in user input
   */
  static detectSuspiciousPatterns(input: string): { suspicious: boolean; patterns: string[] } {
    const suspiciousPatterns = [
      { name: 'SQL Injection', regex: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi },
      { name: 'XSS', regex: /<script|javascript:|on\w+=/gi },
      { name: 'Path Traversal', regex: /\.\.[\/\\]/g },
      { name: 'Command Injection', regex: /[;&|`$()]/g },
      { name: 'LDAP Injection', regex: /[()&|!]/g }
    ];

    const detectedPatterns: string[] = [];

    for (const pattern of suspiciousPatterns) {
      if (pattern.regex.test(input)) {
        detectedPatterns.push(pattern.name);
      }
    }

    return {
      suspicious: detectedPatterns.length > 0,
      patterns: detectedPatterns
    };
  }

  /**
   * Rate limit key generator
   */
  static generateRateLimitKey(req: Request, identifier?: string): string {
    const ip = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    const userId = (req as any).user?.id;
    
    if (identifier) {
      return `${identifier}:${ip}:${userId || 'anonymous'}`;
    }
    
    return `${req.path}:${ip}:${userId || 'anonymous'}`;
  }

  /**
   * Log security event
   */
  static logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: any,
    req?: Request
  ): void {
    const logData = {
      event,
      severity,
      details,
      timestamp: new Date().toISOString(),
      ip: req ? this.getClientIP(req) : undefined,
      userAgent: req ? req.get('User-Agent') : undefined,
      path: req ? req.path : undefined,
      method: req ? req.method : undefined,
      userId: req ? (req as any).user?.id : undefined
    };

    if (severity === 'critical' || severity === 'high') {
      logger.error('Security event', logData);
    } else if (severity === 'medium') {
      logger.warn('Security event', logData);
    } else {
      logger.info('Security event', logData);
    }
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'authorization',
      'ssn', 'social', 'credit', 'card', 'cvv', 'pin',
      'privateKey', 'mnemonic', 'seed'
    ];

    const masked = { ...data };

    for (const field of sensitiveFields) {
      if (masked[field]) {
        if (typeof masked[field] === 'string') {
          masked[field] = '*'.repeat(masked[field].length);
        } else {
          masked[field] = '[REDACTED]';
        }
      }
    }

    return masked;
  }

  /**
   * Generate secure session ID
   */
  static generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Check password age
   */
  static isPasswordExpired(passwordCreatedAt: Date): boolean {
    const maxAge = securityConfig.passwordPolicy.maxAge * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    const now = new Date().getTime();
    const passwordAge = now - passwordCreatedAt.getTime();
    
    return passwordAge > maxAge;
  }

  /**
   * Generate secure OTP
   */
  static generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    
    return otp;
  }

  /**
   * Validate file upload security
   */
  static validateFileUpload(filename: string, mimetype: string, size: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check file extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(extension)) {
      errors.push('File type not allowed');
    }
    
    // Check MIME type
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedMimeTypes.includes(mimetype)) {
      errors.push('MIME type not allowed');
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (size > maxSize) {
      errors.push('File size too large');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}