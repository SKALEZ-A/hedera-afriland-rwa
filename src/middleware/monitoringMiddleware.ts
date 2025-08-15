import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import MonitoringService from '../services/MonitoringService'
import AnalyticsService from '../services/AnalyticsService'
import { v4 as uuidv4 } from 'uuid'

interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    role: string
    [key: string]: any
  }
}

/**
 * Request logging middleware
 */
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()
  const requestId = uuidv4()
  
  // Add request ID to request object
  req.requestId = requestId
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId)
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as AuthenticatedRequest).user?.id
  })

  // Override res.end to capture response details
  const originalEnd = res.end
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime
    
    // Log API request performance
    logger.apiRequest(
      req.method,
      req.url,
      res.statusCode,
      duration,
      (req as AuthenticatedRequest).user?.id,
      requestId
    )
    
    // Record performance metric
    MonitoringService.recordPerformance({
      operation: 'api_request',
      duration,
      success: res.statusCode < 400,
      metadata: {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        requestId
      }
    })
    
    // Track user activity if authenticated
    if ((req as AuthenticatedRequest).user?.id) {
      AnalyticsService.trackEvent({
        userId: (req as AuthenticatedRequest).user.id,
        event: 'api_request',
        properties: {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration
        },
        sessionId: req.headers['x-session-id'] as string,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      })
    }
    
    // Call original end method
    originalEnd.call(this, chunk, encoding)
  }
  
  next()
}

/**
 * Performance monitoring middleware
 */
export const performanceMonitoringMiddleware = (operationName?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const operation = operationName || `${req.method} ${req.route?.path || req.path}`
    
    try {
      await MonitoringService.measureOperation(operation, async () => {
        return new Promise<void>((resolve, reject) => {
          // Override res.end to resolve promise when response is sent
          const originalEnd = res.end
          res.end = function(chunk?: any, encoding?: any) {
            originalEnd.call(this, chunk, encoding)
            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}`))
            } else {
              resolve()
            }
          }
          
          next()
        })
      })
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Error monitoring middleware
 */
export const errorMonitoringMiddleware = (error: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.requestId || 'unknown'
  
  // Log error with context
  logger.logError(error, {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    body: req.body,
    params: req.params,
    query: req.query
  }, (req as AuthenticatedRequest).user?.id)
  
  // Record error metric
  MonitoringService.recordMetric({
    name: 'api.errors',
    value: 1,
    unit: 'count',
    tags: {
      method: req.method,
      url: req.url,
      errorType: error.name,
      statusCode: res.statusCode.toString()
    }
  })
  
  // Track error event
  if ((req as AuthenticatedRequest).user?.id) {
    AnalyticsService.trackEvent({
      userId: (req as AuthenticatedRequest).user.id,
      event: 'api_error',
      properties: {
        method: req.method,
        url: req.url,
        errorType: error.name,
        errorMessage: error.message,
        statusCode: res.statusCode
      },
      sessionId: req.headers['x-session-id'] as string,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    })
  }
  
  next(error)
}

/**
 * Business event tracking middleware
 */
export const businessEventMiddleware = (eventName: string, extractData?: (req: Request, res: Response) => any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Override res.end to track business event after successful response
    const originalEnd = res.end
    res.end = function(chunk?: any, encoding?: any) {
      // Only track on successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = (req as AuthenticatedRequest).user?.id
        if (userId) {
          const eventData = extractData ? extractData(req, res) : {}
          
          logger.business(eventName, eventData, userId)
          
          AnalyticsService.trackEvent({
            userId,
            event: eventName,
            properties: eventData,
            sessionId: req.headers['x-session-id'] as string,
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip
          })
        }
      }
      
      originalEnd.call(this, chunk, encoding)
    }
    
    next()
  }
}

/**
 * Database operation monitoring middleware
 */
export const databaseMonitoringMiddleware = (operation: string, tableName: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()
    
    try {
      await new Promise<void>((resolve, reject) => {
        const originalEnd = res.end
        res.end = function(chunk?: any, encoding?: any) {
          const duration = Date.now() - startTime
          const success = res.statusCode < 400
          
          logger.database(operation, tableName, duration, success, success ? undefined : 'Operation failed')
          
          MonitoringService.recordMetric({
            name: 'database.operation.duration',
            value: duration,
            unit: 'milliseconds',
            tags: {
              operation,
              table: tableName,
              success: success.toString()
            }
          })
          
          originalEnd.call(this, chunk, encoding)
          resolve()
        }
        
        next()
      })
    } catch (error) {
      const duration = Date.now() - startTime
      logger.database(operation, tableName, duration, false, error instanceof Error ? error.message : 'Unknown error')
      throw error;
    }
  }
}

/**
 * Security monitoring middleware
 */
export const securityMonitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\<script\>|\<\/script\>)/gi, // XSS attempts
    /(union|select|insert|delete|update|drop|create|alter)/gi, // SQL injection attempts
    /(\.\.|\/etc\/|\/proc\/|\/sys\/)/gi, // Path traversal attempts
    /(eval\(|exec\(|system\()/gi // Code injection attempts
  ]
  
  const checkForSuspiciousContent = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(obj))
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForSuspiciousContent(value))
    }
    
    return false
  }
  
  // Check request body, params, and query for suspicious content
  const suspicious = checkForSuspiciousContent(req.body) ||
                   checkForSuspiciousContent(req.params) ||
                   checkForSuspiciousContent(req.query)
  
  if (suspicious) {
    logger.audit('suspicious_request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body,
      params: req.params,
      query: req.query
    }, (req as AuthenticatedRequest).user?.id)
    
    MonitoringService.recordMetric({
      name: 'security.suspicious_requests',
      value: 1,
      unit: 'count',
      tags: {
        ip: req.ip,
        method: req.method,
        url: req.url
      }
    })
  }
  
  // Check for rapid requests from same IP (potential DDoS)
  const clientIp = req.ip
  const now = Date.now()
  const timeWindow = 60000 // 1 minute
  
  // This would typically use Redis or in-memory store
  // For now, we'll just log potential DDoS attempts
  if (req.headers['x-forwarded-for'] || req.connection.remoteAddress) {
    logger.audit('request_rate_check', {
      ip: clientIp,
      timestamp: now,
      url: req.url
    })
  }
  
  next()
}

/**
 * Compliance monitoring middleware
 */
export const complianceMonitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as AuthenticatedRequest).user?.id
  
  // Monitor sensitive operations
  const sensitiveOperations = [
    '/api/kyc/',
    '/api/payments/',
    '/api/investments/',
    '/api/admin/',
    '/api/compliance/'
  ]
  
  const isSensitiveOperation = sensitiveOperations.some(pattern => req.url.includes(pattern))
  
  if (isSensitiveOperation && userId) {
    logger.compliance('sensitive_operation_access', userId, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date()
    })
    
    MonitoringService.recordMetric({
      name: 'compliance.sensitive_operations',
      value: 1,
      unit: 'count',
      tags: {
        operation: req.url,
        userId,
        method: req.method
      }
    })
  }
  
  next()
}

// Extend Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}