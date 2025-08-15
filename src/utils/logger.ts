import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, userId, requestId, ...meta }) => {
    const logEntry: any = {
      timestamp,
      level,
      message,
      service: service || 'globalland-api',
      environment: process.env.NODE_ENV || 'development',
      ...meta
    };
    if (userId) logEntry.userId = userId;
    if (requestId) logEntry.requestId = requestId;
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, service, userId, requestId, ...meta }) => {
    let logMessage = `${timestamp} [${level}] ${message}`;
    
    if (userId) logMessage += ` (user: ${userId})`;
    if (requestId) logMessage += ` (req: ${requestId})`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? structuredFormat : consoleFormat
  }),
  
  // Error logs
  new winston.transports.File({ 
    filename: path.join(logsDir, 'error.log'), 
    level: 'error',
    format: structuredFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true
  }),
  
  // Combined logs
  new winston.transports.File({ 
    filename: path.join(logsDir, 'combined.log'),
    format: structuredFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    tailable: true
  }),
  
  // Audit logs for security events
  new winston.transports.File({
    filename: path.join(logsDir, 'audit.log'),
    level: 'warn',
    format: structuredFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 20,
    tailable: true
  }),
  
  // Performance logs
  new winston.transports.File({
    filename: path.join(logsDir, 'performance.log'),
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
      winston.format.printf((info) => {
        // Only log performance-related entries
        if (info.category === 'performance' || info.duration !== undefined) {
          return JSON.stringify(info);
        }
        return '';
      })
    ),
    maxsize: 5 * 1024 * 1024, // 5MB
    maxFiles: 5,
    tailable: true
  })
];

// Create the base logger
const baseLogger = winston.createLogger({
  level: level(),
  levels,
  format: structuredFormat,
  defaultMeta: { 
    service: 'globalland-api',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports,
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

// Enhanced logger with additional methods
class EnhancedLogger {
  private winston: winston.Logger;
  
  constructor(winstonLogger: winston.Logger) {
    this.winston = winstonLogger;
  }

  // Standard logging methods
  error(message: string, meta?: any) {
    this.winston.error(message, meta);
  }

  warn(message: string, meta?: any) {
    this.winston.warn(message, meta);
  }

  info(message: string, meta?: any) {
    this.winston.info(message, meta);
  }

  http(message: string, meta?: any) {
    this.winston.http(message, meta);
  }

  debug(message: string, meta?: any) {
    this.winston.debug(message, meta);
  }

  // Security audit logging
  audit(event: string, details: any, userId?: string) {
    this.winston.warn('Security audit event', {
      category: 'security',
      event,
      details,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  // Performance logging
  performance(operation: string, duration: number, metadata?: any) {
    this.winston.info('Performance metric', {
      category: 'performance',
      operation,
      duration,
      ...metadata
    });
  }

  // Business event logging
  business(event: string, data: any, userId?: string) {
    this.winston.info('Business event', {
      category: 'business',
      event,
      data,
      userId
    });
  }

  // API request logging
  apiRequest(method: string, url: string, statusCode: number, duration: number, userId?: string, requestId?: string) {
    this.winston.info('API request', {
      category: 'api',
      method,
      url,
      statusCode,
      duration,
      userId,
      requestId
    });
  }

  // Database operation logging
  database(operation: string, table: string, duration: number, success: boolean, error?: string) {
    this.winston.info('Database operation', {
      category: 'database',
      operation,
      table,
      duration,
      success,
      error
    });
  }

  // Blockchain operation logging
  blockchain(operation: string, success: boolean, transactionId?: string, error?: string, metadata?: any) {
    this.winston.info('Blockchain operation', {
      category: 'blockchain',
      operation,
      transactionId,
      success,
      error,
      ...metadata
    });
  }

  // User activity logging
  userActivity(userId: string, activity: string, details?: any) {
    this.winston.info('User activity', {
      category: 'user_activity',
      userId,
      activity,
      details
    });
  }

  // System health logging
  health(component: string, status: 'healthy' | 'warning' | 'critical', details?: any) {
    const level = status === 'critical' ? 'error' : status === 'warning' ? 'warn' : 'info';
    this.winston.log(level, 'System health check', {
      category: 'health',
      component,
      status,
      details
    });
  }

  // Create child logger with additional context
  child(meta: any) {
    return new EnhancedLogger(this.winston.child(meta));
  }

  // Log with custom level
  log(level: string, message: string, meta?: any) {
    this.winston.log(level, message, meta);
  }

  // Structured error logging
  logError(error: Error, context?: any, userId?: string) {
    this.winston.error('Application error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      userId
    });
  }

  // Transaction logging for financial operations
  transaction(type: string, amount: number, currency: string, userId: string, status: string, details?: any) {
    this.winston.info('Financial transaction', {
      category: 'transaction',
      type,
      amount,
      currency,
      userId,
      status,
      details
    });
  }

  // Compliance logging
  compliance(event: string, userId: string, details: any, riskLevel?: 'low' | 'medium' | 'high') {
    this.winston.warn('Compliance event', {
      category: 'compliance',
      event,
      userId,
      details,
      riskLevel: riskLevel || 'medium'
    });
  }
}

// Export enhanced logger instance
export const logger = new EnhancedLogger(baseLogger);