import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validationMiddleware';
import { body } from 'express-validator';

const router = Router();
const paymentController = new PaymentController();

// Payment processing routes
router.post(
  '/process',
  authMiddleware,
  [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('currency').isString().withMessage('Currency is required'),
    body('paymentMethod').isIn(['STRIPE', 'MOBILE_MONEY', 'CRYPTO']).withMessage('Invalid payment method'),
    body('propertyId').optional().isString(),
    body('tokenAmount').optional().isNumeric()
  ],
  validateRequest,
  paymentController.processPayment
);

// Mobile money payment routes
router.post(
  '/mobile/initiate',
  authMiddleware,
  [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('currency').isString().withMessage('Currency is required'),
    body('phoneNumber').isMobilePhone('any').withMessage('Valid phone number is required'),
    body('provider').isIn(['M_PESA', 'MTN_MOBILE_MONEY', 'AIRTEL_MONEY']).withMessage('Invalid mobile money provider')
  ],
  validateRequest,
  paymentController.initiateMobilePayment
);

// Currency conversion
router.post(
  '/convert',
  authMiddleware,
  [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('from').isString().withMessage('From currency is required'),
    body('to').isString().withMessage('To currency is required')
  ],
  validateRequest,
  paymentController.convertCurrency
);

// Exchange rates
router.get('/rates', paymentController.getExchangeRates);

// Payment methods
router.get('/methods', authMiddleware, paymentController.getPaymentMethods);

// Fee calculation
router.post(
  '/fees',
  authMiddleware,
  [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('currency').isString().withMessage('Currency is required'),
    body('paymentMethod').isString().withMessage('Payment method is required')
  ],
  validateRequest,
  paymentController.calculateFees
);

// Webhook endpoints
router.post('/webhook/stripe', paymentController.handleStripeWebhook);

export default router;