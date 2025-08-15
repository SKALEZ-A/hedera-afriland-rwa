import { Router } from 'express'
import { MonitoringController } from '../controllers/MonitoringController'
import { authMiddleware } from '../middleware/authMiddleware'
import { validateRequest } from '../middleware/validation'
import { body, param, query } from 'express-validator'

const router = Router()
const monitoringController = new MonitoringController()

// Public health check endpoint (no auth required)
router.get('/health', monitoringController.getHealthStatus)
router.get('/health/:checkName', [
  param('checkName').isString().notEmpty(),
  validateRequest
], monitoringController.getHealthCheck)

// Protected monitoring endpoints (authentication required)
router.use(authMiddleware)

// System metrics
router.get('/metrics/system', monitoringController.getSystemMetrics)

router.get('/metrics/performance', [
  query('operation').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  validateRequest
], monitoringController.getPerformanceMetrics)

router.get('/metrics/custom', [
  query('name').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  validateRequest
], monitoringController.getCustomMetrics)

router.get('/metrics/response-time/:operation', [
  param('operation').isString().notEmpty(),
  query('timeWindow').optional().isInt({ min: 1000 }),
  validateRequest
], monitoringController.getAverageResponseTime)

router.get('/metrics/success-rate/:operation', [
  param('operation').isString().notEmpty(),
  query('timeWindow').optional().isInt({ min: 1000 }),
  validateRequest
], monitoringController.getSuccessRate)

// Analytics endpoints
router.get('/analytics/business', [
  query('timeRange').optional().isIn(['day', 'week', 'month', 'year']),
  validateRequest
], monitoringController.getBusinessAnalytics)

router.get('/analytics/user/:userId', [
  param('userId').isUUID(),
  validateRequest
], monitoringController.getUserBehaviorAnalytics)

router.get('/analytics/property/:propertyId', [
  param('propertyId').isUUID(),
  validateRequest
], monitoringController.getPropertyAnalytics)

router.get('/analytics/realtime', monitoringController.getRealTimeAnalytics)

router.post('/analytics/funnel', [
  body('steps').isArray({ min: 2 }),
  body('steps.*').isString().notEmpty(),
  validateRequest
], monitoringController.getFunnelAnalysis)

// Event tracking
router.post('/events/track', [
  body('event').isString().notEmpty(),
  body('properties').optional().isObject(),
  validateRequest
], monitoringController.trackEvent)

// Export and dashboard
router.get('/export/metrics', monitoringController.exportMetrics)
router.get('/dashboard', monitoringController.getDashboardData)

export default router