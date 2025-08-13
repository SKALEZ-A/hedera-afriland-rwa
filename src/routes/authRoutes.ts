import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { KYCController } from '../controllers/KYCController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const authController = new AuthController();
const kycController = new KYCController();

// Authentication routes
router.post('/register', 
  authMiddleware.rateLimitAuth(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  authController.register
);

router.post('/login', 
  authMiddleware.rateLimitAuth(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  authController.login
);

router.post('/refresh-token', authController.refreshToken);

router.post('/logout', 
  authMiddleware.authenticate, 
  authController.logout
);

// Profile routes
router.get('/profile', 
  authMiddleware.authenticate, 
  authController.getProfile
);

router.put('/change-password', 
  authMiddleware.authenticate,
  authMiddleware.rateLimitAuth(3, 60 * 60 * 1000), // 3 attempts per hour
  authController.changePassword
);

// Password reset routes
router.post('/request-password-reset', 
  authMiddleware.rateLimitAuth(3, 60 * 60 * 1000), // 3 attempts per hour
  authController.requestPasswordReset
);

router.post('/reset-password', 
  authMiddleware.rateLimitAuth(3, 60 * 60 * 1000), // 3 attempts per hour
  authController.resetPassword
);

// KYC routes
router.post('/kyc/submit', 
  authMiddleware.authenticate,
  kycController.upload.array('documents', 10), // Allow up to 10 document files
  kycController.submitKYC
);

router.get('/kyc/status', 
  authMiddleware.authenticate, 
  kycController.getKYCStatus
);

router.post('/kyc/resubmit', 
  authMiddleware.authenticate,
  kycController.upload.array('documents', 10),
  kycController.resubmitKYC
);

router.post('/kyc/aml-screening', 
  authMiddleware.authenticate,
  authMiddleware.requireKYC,
  kycController.performAMLScreening
);

// Admin routes for compliance
router.get('/compliance/enhanced-due-diligence/:userId',
  authMiddleware.authenticate,
  authMiddleware.requireRoles(['admin']),
  kycController.getEnhancedDueDiligence
);

router.get('/compliance/report',
  authMiddleware.authenticate,
  authMiddleware.requireRoles(['admin']),
  kycController.getComplianceReport
);

export default router;