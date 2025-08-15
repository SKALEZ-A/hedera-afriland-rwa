import { Request, Response, NextFunction } from 'express'

// Extend Response interface to include custom methods
declare global {
  namespace Express {
    interface Response {
      success(data?: any, message?: string, statusCode?: number): Response
      error(error: string, details?: any, statusCode?: number): Response
      paginated(data: any[], pagination: PaginationInfo, message?: string): Response
    }
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

export const responseFormatter = (req: Request, res: Response, next: NextFunction) => {
  // Success response method
  res.success = function(data?: any, message?: string, statusCode: number = 200) {
    const response: any = {
      success: true,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    }

    if (message) {
      response.message = message
    }

    if (data !== undefined) {
      response.data = data
    }

    return this.status(statusCode).json(response)
  }

  // Error response method
  res.error = function(error: string, details?: any, statusCode: number = 400) {
    const response: any = {
      success: false,
      error,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    }

    if (details) {
      response.details = details
    }

    // Add request ID if available (useful for debugging)
    if (req.headers['x-request-id']) {
      response.requestId = req.headers['x-request-id']
    }

    return this.status(statusCode).json(response)
  }

  // Paginated response method
  res.paginated = function(data: any[], pagination: PaginationInfo, message?: string) {
    const response: any = {
      success: true,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: pagination.pages,
        hasNext: pagination.page < pagination.pages,
        hasPrev: pagination.page > 1,
        nextPage: pagination.page < pagination.pages ? pagination.page + 1 : null,
        prevPage: pagination.page > 1 ? pagination.page - 1 : null
      }
    }

    if (message) {
      response.message = message
    }

    return this.status(200).json(response)
  }

  next()
}

// Utility function to create standardized API responses
export class ApiResponse {
  static success(data?: any, message?: string, statusCode: number = 200) {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      statusCode
    }
  }

  static error(error: string, details?: any, statusCode: number = 400) {
    return {
      success: false,
      error,
      details,
      timestamp: new Date().toISOString(),
      statusCode
    }
  }

  static paginated(data: any[], pagination: PaginationInfo, message?: string) {
    return {
      success: true,
      message,
      data,
      pagination: {
        ...pagination,
        hasNext: pagination.page < pagination.pages,
        hasPrev: pagination.page > 1,
        nextPage: pagination.page < pagination.pages ? pagination.page + 1 : null,
        prevPage: pagination.page > 1 ? pagination.page - 1 : null
      },
      timestamp: new Date().toISOString()
    }
  }

  static created(data?: any, message?: string) {
    return this.success(data, message, 201)
  }

  static noContent(message?: string) {
    return {
      success: true,
      message: message || 'Operation completed successfully',
      timestamp: new Date().toISOString(),
      statusCode: 204
    }
  }

  static badRequest(error: string, details?: any) {
    return this.error(error, details, 400)
  }

  static unauthorized(error: string = 'Unauthorized access', details?: any) {
    return this.error(error, details, 401)
  }

  static forbidden(error: string = 'Access forbidden', details?: any) {
    return this.error(error, details, 403)
  }

  static notFound(error: string = 'Resource not found', details?: any) {
    return this.error(error, details, 404)
  }

  static conflict(error: string, details?: any) {
    return this.error(error, details, 409)
  }

  static unprocessableEntity(error: string, details?: any) {
    return this.error(error, details, 422)
  }

  static tooManyRequests(error: string = 'Too many requests', details?: any) {
    return this.error(error, details, 429)
  }

  static internalServerError(error: string = 'Internal server error', details?: any) {
    return this.error(error, details, 500)
  }

  static serviceUnavailable(error: string = 'Service unavailable', details?: any) {
    return this.error(error, details, 503)
  }
}

// HTTP Status Code constants
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const

// Common error messages
export const ERROR_MESSAGES = {
  VALIDATION_FAILED: 'Validation failed',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  ALREADY_EXISTS: 'Resource already exists',
  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  INVALID_TOKEN: 'Invalid or expired token',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  INVALID_INPUT: 'Invalid input provided',
  OPERATION_FAILED: 'Operation failed',
  DATABASE_ERROR: 'Database operation failed',
  EXTERNAL_SERVICE_ERROR: 'External service error',
  PAYMENT_FAILED: 'Payment processing failed',
  BLOCKCHAIN_ERROR: 'Blockchain operation failed'
} as const

// Success messages
export const SUCCESS_MESSAGES = {
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  OPERATION_COMPLETED: 'Operation completed successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  REGISTRATION_SUCCESS: 'Registration successful',
  PAYMENT_SUCCESS: 'Payment processed successfully',
  INVESTMENT_SUCCESS: 'Investment purchased successfully',
  DIVIDEND_DISTRIBUTED: 'Dividends distributed successfully',
  ORDER_CREATED: 'Order created successfully',
  ORDER_CANCELLED: 'Order cancelled successfully',
  NOTIFICATION_SENT: 'Notification sent successfully'
} as const