import { Router } from 'express'
import { DemoController } from '../controllers/DemoController'
import { authMiddleware } from '../middleware/authMiddleware'
import { validateRequest } from '../middleware/validation'
import { param, query } from 'express-validator'

const router = Router()
const demoController = new DemoController()

// Public demo endpoints (no auth required)
router.get('/overview', demoController.getHackathonOverview)
router.get('/credentials', demoController.getDemoCredentials)
router.get('/data/summary', demoController.getDemoDataSummary)

// Demo data endpoints
router.get('/data/users', demoController.getDemoUsers)
router.get('/data/properties', demoController.getDemoProperties)
router.get('/data/investments', demoController.getDemoInvestments)
router.get('/data/transactions', demoController.getDemoTransactions)

// Showcase scenario endpoints
router.get('/scenarios', [
  query('category').optional().isIn(['user_journey', 'business_flow', 'technical_demo', 'analytics']),
  query('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']),
  validateRequest
], demoController.getShowcaseScenarios)

router.get('/scenarios/:scenarioId', [
  param('scenarioId').isString().notEmpty(),
  validateRequest
], demoController.getShowcaseScenario)

router.get('/scenarios/:scenarioId/script', [
  param('scenarioId').isString().notEmpty(),
  validateRequest
], demoController.generatePresentationScript)

// Scenario execution endpoints
router.post('/scenarios/:scenarioId/start', [
  param('scenarioId').isString().notEmpty(),
  validateRequest
], demoController.startScenario)

router.post('/scenarios/:scenarioId/next', [
  param('scenarioId').isString().notEmpty(),
  validateRequest
], demoController.executeNextStep)

router.get('/scenarios/:scenarioId/status', [
  param('scenarioId').isString().notEmpty(),
  validateRequest
], demoController.getScenarioStatus)

router.post('/scenarios/:scenarioId/pause', [
  param('scenarioId').isString().notEmpty(),
  validateRequest
], demoController.pauseScenario)

router.post('/scenarios/:scenarioId/resume', [
  param('scenarioId').isString().notEmpty(),
  validateRequest
], demoController.resumeScenario)

router.post('/scenarios/:scenarioId/stop', [
  param('scenarioId').isString().notEmpty(),
  validateRequest
], demoController.stopScenario)

// Protected admin endpoints (authentication required)
router.use(authMiddleware)

router.post('/data/initialize', demoController.initializeDemoData)

export default router