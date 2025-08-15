import { Router } from 'express'
import authRoutes from './authRoutes'
import propertyRoutes from './propertyRoutes'
import investmentRoutes from './investmentRoutes'
import paymentRoutes from './paymentRoutes'
import dividendRoutes from './dividendRoutes'
import tradingRoutes from './tradingRoutes'
import notificationRoutes from './notificationRoutes'
import propertyManagerRoutes from './propertyManagerRoutes'
import { apiVersionMiddleware } from '../middleware/apiVersionMiddleware'
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware'

const router = Router()

// Apply global middleware
router.use(apiVersionMiddleware)
router.use(rateLimitMiddleware)

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
  })
})

// API status endpoint
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      api: 'GlobalLand API',
      version: '1.0.0',
      status: 'operational',
      endpoints: {
        authentication: '/api/auth',
        properties: '/api/properties',
        investments: '/api/investments',
        payments: '/api/payments',
        dividends: '/api/dividends',
        trading: '/api/trading',
        notifications: '/api/notifications',
        propertyManager: '/api/property-manager'
      },
      documentation: {
        swagger: '/api/docs',
        openapi: '/api/openapi.yaml'
      },
      support: {
        email: 'support@globalland.com',
        docs: 'https://docs.globalland.com'
      }
    }
  })
})

// Mount route modules
router.use('/auth', authRoutes)
router.use('/properties', propertyRoutes)
router.use('/investments', investmentRoutes)
router.use('/payments', paymentRoutes)
router.use('/dividends', dividendRoutes)
router.use('/trading', tradingRoutes)
router.use('/notifications', notificationRoutes)
router.use('/property-manager', propertyManagerRoutes)

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    details: {
      path: req.originalUrl,
      method: req.method,
      availableEndpoints: [
        'GET /api/health',
        'GET /api/status',
        'POST /api/auth/login',
        'GET /api/properties',
        'GET /api/investments/portfolio',
        'POST /api/payments/process',
        'GET /api/trading/orderbook/:tokenId'
      ]
    }
  })
})

export default router