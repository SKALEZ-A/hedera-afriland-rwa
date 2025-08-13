import { Router } from 'express';
import { InvestmentController } from '../controllers/InvestmentController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const investmentController = new InvestmentController();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/investments/purchase
 * @desc Purchase property tokens
 * @access Private
 */
router.post('/purchase', investmentController.purchaseTokens);

/**
 * @route POST /api/investments/validate
 * @desc Validate investment before purchase
 * @access Private
 */
router.post('/validate', investmentController.validateInvestment);

/**
 * @route GET /api/investments/portfolio
 * @desc Get user's investment portfolio
 * @access Private
 */
router.get('/portfolio', investmentController.getPortfolio);

/**
 * @route GET /api/investments/portfolio/performance
 * @desc Get portfolio performance analytics
 * @access Private
 */
router.get('/portfolio/performance', investmentController.getPortfolioPerformance);

/**
 * @route GET /api/investments/history
 * @desc Get investment history
 * @access Private
 * @query limit - Number of records to return (max 100, default 50)
 * @query offset - Number of records to skip (default 0)
 */
router.get('/history', investmentController.getInvestmentHistory);

/**
 * @route GET /api/investments/stats
 * @desc Get investment statistics (admin only)
 * @access Private (Admin)
 */
router.get('/stats', investmentController.getInvestmentStats);

/**
 * @route PUT /api/investments/:investmentId/status
 * @desc Update investment status (admin only)
 * @access Private (Admin)
 */
router.put('/:investmentId/status', investmentController.updateInvestmentStatus);

export default router;