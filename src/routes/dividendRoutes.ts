import { Router } from 'express';
import { DividendController } from '../controllers/DividendController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validationMiddleware';
import { body, param } from 'express-validator';

const router = Router();
const dividendController = new DividendController();

// Property manager routes (require property manager role)
router.post(
  '/:tokenId/calculate',
  authMiddleware,
  [
    param('tokenId').isString().withMessage('Token ID is required'),
    body('totalIncome').isNumeric().withMessage('Total income must be a number')
  ],
  validateRequest,
  dividendController.calculateDistribution
);

router.post(
  '/:tokenId/distribute',
  authMiddleware,
  [
    param('tokenId').isString().withMessage('Token ID is required'),
    body('totalIncome').isNumeric().withMessage('Total income must be a number')
  ],
  validateRequest,
  dividendController.distributeDividends
);

router.put(
  '/:tokenId/management-fees',
  authMiddleware,
  [
    param('tokenId').isString().withMessage('Token ID is required'),
    body('feePercentage').isNumeric().withMessage('Fee percentage must be a number')
  ],
  validateRequest,
  dividendController.setManagementFees
);

// Public routes (for investors)
router.get(
  '/:tokenId/history',
  [param('tokenId').isString().withMessage('Token ID is required')],
  validateRequest,
  dividendController.getDistributionHistory
);

router.post(
  '/:tokenId/projected',
  authMiddleware,
  [
    param('tokenId').isString().withMessage('Token ID is required'),
    body('tokenAmount').isNumeric().withMessage('Token amount must be a number'),
    body('projectionMonths').optional().isNumeric().withMessage('Projection months must be a number')
  ],
  validateRequest,
  dividendController.calculateProjectedDividends
);

router.get(
  '/:tokenId/analytics',
  [param('tokenId').isString().withMessage('Token ID is required')],
  validateRequest,
  dividendController.getDividendAnalytics
);

// User-specific routes
router.post(
  '/:tokenId/claim',
  authMiddleware,
  [param('tokenId').isString().withMessage('Token ID is required')],
  validateRequest,
  dividendController.claimDividends
);

router.get(
  '/pending',
  authMiddleware,
  dividendController.getPendingDividends
);

export default router;