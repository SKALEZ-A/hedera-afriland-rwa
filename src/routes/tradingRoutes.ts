import { Router } from 'express';
import { TradingController } from '../controllers/TradingController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validationMiddleware';
import { body, param, query } from 'express-validator';

const router = Router();
const tradingController = new TradingController();

// Order management routes
router.post(
  '/orders',
  authMiddleware,
  [
    body('tokenId').isString().withMessage('Token ID is required'),
    body('orderType').isIn(['BUY', 'SELL']).withMessage('Order type must be BUY or SELL'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('expiresAt').optional().isISO8601().withMessage('Expires at must be a valid date')
  ],
  validateRequest,
  tradingController.createOrder
);

router.delete(
  '/orders/:orderId',
  authMiddleware,
  [param('orderId').isString().withMessage('Order ID is required')],
  validateRequest,
  tradingController.cancelOrder
);

router.get(
  '/orders/:orderId',
  authMiddleware,
  [param('orderId').isString().withMessage('Order ID is required')],
  validateRequest,
  tradingController.getOrderDetails
);

router.get(
  '/orders',
  authMiddleware,
  [query('status').optional().isIn(['OPEN', 'FILLED', 'CANCELLED', 'EXPIRED', 'PARTIALLY_FILLED'])],
  validateRequest,
  tradingController.getUserOrders
);

// Market data routes
router.get(
  '/orderbook/:tokenId',
  [param('tokenId').isString().withMessage('Token ID is required')],
  validateRequest,
  tradingController.getOrderBook
);

router.get(
  '/history/:tokenId',
  [
    param('tokenId').isString().withMessage('Token ID is required'),
    query('limit').optional().isNumeric().withMessage('Limit must be a number')
  ],
  validateRequest,
  tradingController.getTradingHistory
);

router.get(
  '/stats/:tokenId',
  [param('tokenId').isString().withMessage('Token ID is required')],
  validateRequest,
  tradingController.getMarketStats
);

router.get(
  '/chart/:tokenId',
  [
    param('tokenId').isString().withMessage('Token ID is required'),
    query('period').optional().isIn(['24h', '7d', '30d']).withMessage('Period must be 24h, 7d, or 30d')
  ],
  validateRequest,
  tradingController.getPriceChart
);

router.get(
  '/liquidity/:tokenId',
  [param('tokenId').isString().withMessage('Token ID is required')],
  validateRequest,
  tradingController.getLiquidity
);

// Market overview
router.get('/overview', tradingController.getMarketOverview);

export default router;