import { Router } from 'express'
import { PropertyController } from '../controllers/PropertyController'
import { authMiddleware } from '../middleware/authMiddleware'
import { validateRequest } from '../middleware/validation'
import { body, param, query } from 'express-validator'

const router = Router()
const propertyController = new PropertyController()

// Public routes (no authentication required)
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('location').optional().isString(),
    query('minPrice').optional().isFloat({ min: 0 }),
    query('maxPrice').optional().isFloat({ min: 0 }),
    query('propertyType').optional().isIn(['residential', 'commercial', 'industrial', 'land', 'mixed_use']),
    query('sortBy').optional().isIn(['price', 'yield', 'created', 'valuation']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    validateRequest
  ],
  propertyController.getProperties
)

router.get(
  '/:propertyId',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    validateRequest
  ],
  propertyController.getPropertyById
)

router.get(
  '/:propertyId/performance',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validateRequest
  ],
  propertyController.getPropertyPerformance
)

router.get(
  '/:propertyId/documents',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    query('type').optional().isString(),
    validateRequest
  ],
  propertyController.getPropertyDocuments
)

// Protected routes (authentication required)
router.post(
  '/',
  authMiddleware,
  [
    body('name').isString().isLength({ min: 1, max: 200 }).withMessage('Property name is required'),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('propertyType').isIn(['residential', 'commercial', 'industrial', 'land', 'mixed_use'])
      .withMessage('Valid property type is required'),
    body('address.addressLine1').isString().isLength({ min: 1, max: 200 })
      .withMessage('Address line 1 is required'),
    body('address.city').isString().isLength({ min: 1, max: 100 })
      .withMessage('City is required'),
    body('address.country').isString().isLength({ min: 1, max: 100 })
      .withMessage('Country is required'),
    body('totalValuation').isFloat({ min: 1 }).withMessage('Total valuation must be greater than 0'),
    body('totalTokens').isInt({ min: 1 }).withMessage('Total tokens must be greater than 0'),
    body('pricePerToken').isFloat({ min: 0.01 }).withMessage('Price per token must be greater than 0'),
    body('expectedAnnualYield').optional().isFloat({ min: 0, max: 1 }),
    body('minimumInvestment').optional().isFloat({ min: 0 }),
    validateRequest
  ],
  propertyController.createProperty
)

router.put(
  '/:propertyId',
  authMiddleware,
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    body('name').optional().isString().isLength({ min: 1, max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('expectedAnnualYield').optional().isFloat({ min: 0, max: 1 }),
    body('minimumInvestment').optional().isFloat({ min: 0 }),
    validateRequest
  ],
  propertyController.updateProperty
)

router.post(
  '/:propertyId/tokenize',
  authMiddleware,
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    body('tokenName').optional().isString().isLength({ min: 1, max: 100 }),
    body('tokenSymbol').optional().isString().isLength({ min: 1, max: 10 }),
    validateRequest
  ],
  propertyController.tokenizeProperty
)

router.put(
  '/:propertyId/status',
  authMiddleware,
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    body('status').isIn(['draft', 'active', 'sold_out', 'inactive'])
      .withMessage('Valid status is required'),
    body('reason').optional().isString().isLength({ max: 500 }),
    validateRequest
  ],
  propertyController.updatePropertyStatus
)

router.put(
  '/:propertyId/valuation',
  authMiddleware,
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    body('newValuation').isFloat({ min: 1 }).withMessage('New valuation must be greater than 0'),
    body('valuationMethod').isString().isLength({ min: 1, max: 100 })
      .withMessage('Valuation method is required'),
    body('valuationProvider').optional().isString().isLength({ max: 100 }),
    body('notes').optional().isString().isLength({ max: 1000 }),
    validateRequest
  ],
  propertyController.updatePropertyValuation
)

// Statistics endpoint
router.get(
  '/stats/overview',
  propertyController.getPropertyStatistics
)

export default router