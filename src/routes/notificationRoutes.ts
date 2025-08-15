import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validationMiddleware';
import { body, query } from 'express-validator';

const router = Router();
const notificationController = new NotificationController();

// Send notifications (admin/system use)
router.post(
  '/send',
  authMiddleware,
  [
    body('userId').isString().withMessage('User ID is required'),
    body('templateId').isString().withMessage('Template ID is required'),
    body('variables').isObject().withMessage('Variables must be an object'),
    body('preferences').optional().isObject().withMessage('Preferences must be an object')
  ],
  validateRequest,
  notificationController.sendNotification
);

router.post(
  '/send-bulk',
  authMiddleware,
  [
    body('userIds').isArray().withMessage('User IDs must be an array'),
    body('templateId').isString().withMessage('Template ID is required'),
    body('variables').isObject().withMessage('Variables must be an object')
  ],
  validateRequest,
  notificationController.sendBulkNotification
);

// User notification management
router.get(
  '/history',
  authMiddleware,
  [
    query('limit').optional().isNumeric().withMessage('Limit must be a number'),
    query('offset').optional().isNumeric().withMessage('Offset must be a number')
  ],
  validateRequest,
  notificationController.getNotificationHistory
);

router.get(
  '/preferences',
  authMiddleware,
  notificationController.getPreferences
);

router.put(
  '/preferences',
  authMiddleware,
  [
    body('email').optional().isBoolean().withMessage('Email preference must be boolean'),
    body('sms').optional().isBoolean().withMessage('SMS preference must be boolean'),
    body('push').optional().isBoolean().withMessage('Push preference must be boolean'),
    body('realTime').optional().isBoolean().withMessage('Real-time preference must be boolean')
  ],
  validateRequest,
  notificationController.updatePreferences
);

router.post(
  '/mark-read',
  authMiddleware,
  [
    body('notificationIds').isArray().withMessage('Notification IDs must be an array')
  ],
  validateRequest,
  notificationController.markAsRead
);

// Testing and templates
router.post(
  '/test',
  authMiddleware,
  [
    body('templateId').isString().withMessage('Template ID is required'),
    body('testData').optional().isObject().withMessage('Test data must be an object')
  ],
  validateRequest,
  notificationController.sendTestNotification
);

router.get('/templates', notificationController.getTemplates);

router.get('/stats', authMiddleware, notificationController.getNotificationStats);

export default router;