import { Router } from 'express'
import multer from 'multer'
import { PropertyManagerController } from '../controllers/PropertyManagerController'
import { authenticatePropertyManager, authorizePropertyAccess } from '../middleware/propertyManagerAuth'
import { validateRequest } from '../middleware/validation'
import { body, param, query } from 'express-validator'

const router = Router()
const propertyManagerController = new PropertyManagerController()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif'
    ]
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only PDF, Word documents, and images are allowed.'))
    }
  }
})

// Apply property manager authentication to all routes
router.use(authenticatePropertyManager)

// Dashboard routes
router.get('/dashboard', propertyManagerController.getDashboard)

// Property management routes
router.get(
  '/properties/:propertyId',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    validateRequest
  ],
  authorizePropertyAccess,
  propertyManagerController.getPropertyDetails
)

router.put(
  '/properties/:propertyId',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    body('description').optional().isString().isLength({ min: 10, max: 1000 }),
    body('expectedYield').optional().isFloat({ min: 0, max: 1 }),
    body('occupancyRate').optional().isFloat({ min: 0, max: 1 }),
    body('monthlyRent').optional().isFloat({ min: 0 }),
    validateRequest
  ],
  authorizePropertyAccess,
  propertyManagerController.updateProperty
)

// Rental income and dividend distribution routes
router.post(
  '/properties/:propertyId/rental-income',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid rental income amount is required'),
    body('period').isString().isLength({ min: 1, max: 50 }).withMessage('Income period is required'),
    body('description').optional().isString().isLength({ max: 500 }),
    body('distributionDate').optional().isISO8601().withMessage('Valid distribution date is required'),
    validateRequest
  ],
  authorizePropertyAccess,
  propertyManagerController.inputRentalIncome
)

// Document management routes
router.post(
  '/properties/:propertyId/documents',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    body('documentType').isIn(['legal', 'financial', 'maintenance', 'insurance', 'valuation', 'other'])
      .withMessage('Valid document type is required'),
    body('title').isString().isLength({ min: 1, max: 200 }).withMessage('Document title is required'),
    body('description').optional().isString().isLength({ max: 1000 }),
    validateRequest
  ],
  authorizePropertyAccess,
  upload.single('document'),
  propertyManagerController.uploadDocument
)

router.get(
  '/properties/:propertyId/documents',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    query('type').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validateRequest
  ],
  authorizePropertyAccess,
  propertyManagerController.getDocuments
)

// Governance routes
router.post(
  '/properties/:propertyId/governance/proposals',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    body('title').isString().isLength({ min: 5, max: 200 }).withMessage('Proposal title is required'),
    body('description').isString().isLength({ min: 20, max: 2000 }).withMessage('Proposal description is required'),
    body('proposalType').isIn(['maintenance', 'renovation', 'sale', 'refinancing', 'management', 'other'])
      .withMessage('Valid proposal type is required'),
    body('options').optional().isArray({ min: 2, max: 5 }),
    body('votingPeriod').optional().isInt({ min: 1, max: 30 }),
    validateRequest
  ],
  authorizePropertyAccess,
  propertyManagerController.createGovernanceProposal
)

router.get(
  '/properties/:propertyId/governance/proposals',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    query('status').optional().isIn(['active', 'completed', 'cancelled']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validateRequest
  ],
  authorizePropertyAccess,
  propertyManagerController.getGovernanceProposals
)

// Reporting routes
router.get(
  '/properties/:propertyId/reports/performance',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    query('startDate').optional().isISO8601().withMessage('Valid start date is required'),
    query('endDate').optional().isISO8601().withMessage('Valid end date is required'),
    query('reportType').optional().isIn(['comprehensive', 'financial', 'occupancy', 'maintenance']),
    validateRequest
  ],
  authorizePropertyAccess,
  propertyManagerController.generatePerformanceReport
)

// Notification routes
router.post(
  '/properties/:propertyId/notifications',
  [
    param('propertyId').isUUID().withMessage('Valid property ID is required'),
    body('title').isString().isLength({ min: 5, max: 100 }).withMessage('Notification title is required'),
    body('message').isString().isLength({ min: 10, max: 500 }).withMessage('Notification message is required'),
    body('type').optional().isIn(['general', 'maintenance', 'financial', 'governance', 'urgent']),
    body('urgent').optional().isBoolean(),
    validateRequest
  ],
  authorizePropertyAccess,
  propertyManagerController.sendNotification
)

export default router