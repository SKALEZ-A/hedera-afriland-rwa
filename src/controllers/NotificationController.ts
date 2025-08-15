import { Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';
import { logger } from '../utils/logger';
import { NotificationPreferences } from '../types/entities';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Send a notification to a user
   */
  sendNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        userId,
        templateId,
        variables,
        preferences
      } = req.body;

      if (!userId || !templateId || !variables) {
        res.status(400).json({
          success: false,
          error: 'userId, templateId, and variables are required'
        });
        return;
      }

      await this.notificationService.sendNotification(
        userId,
        templateId,
        variables,
        preferences
      );

      res.status(200).json({
        success: true,
        data: {
          message: 'Notification sent successfully',
          userId,
          templateId
        }
      });
    } catch (error) {
      logger.error('Failed to send notification', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification'
      });
    }
  };

  /**
   * Send bulk notifications
   */
  sendBulkNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        userIds,
        templateId,
        variables
      } = req.body;

      if (!Array.isArray(userIds) || !templateId || !variables) {
        res.status(400).json({
          success: false,
          error: 'userIds (array), templateId, and variables are required'
        });
        return;
      }

      await this.notificationService.sendBulkNotification(
        userIds,
        templateId,
        variables
      );

      res.status(200).json({
        success: true,
        data: {
          message: 'Bulk notifications sent successfully',
          userCount: userIds.length,
          templateId
        }
      });
    } catch (error) {
      logger.error('Failed to send bulk notification', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send bulk notification'
      });
    }
  };

  /**
   * Get notification history for current user
   */
  getNotificationHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id!;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await this.notificationService.getNotificationHistory(
        userId,
        limit,
        offset
      );

      res.status(200).json({
        success: true,
        data: {
          history,
          pagination: {
            limit,
            offset,
            total: history.length
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get notification history', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get notification history'
      });
    }
  };

  /**
   * Update notification preferences for current user
   */
  updatePreferences = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id!;
      const preferences: NotificationPreferences = req.body;

      // Validate preferences
      const validKeys = ['email', 'sms', 'push', 'realTime'];
      const invalidKeys = Object.keys(preferences).filter(key => !validKeys.includes(key));
      
      if (invalidKeys.length > 0) {
        res.status(400).json({
          success: false,
          error: `Invalid preference keys: ${invalidKeys.join(', ')}`
        });
        return;
      }

      await this.notificationService.updateNotificationPreferences(userId, preferences);

      res.status(200).json({
        success: true,
        data: {
          message: 'Notification preferences updated successfully',
          preferences
        }
      });
    } catch (error) {
      logger.error('Failed to update notification preferences', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to update notification preferences'
      });
    }
  };

  /**
   * Get current notification preferences
   */
  getPreferences = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id!;

      // Mock preferences for demo
      const preferences: NotificationPreferences = {
        email: true,
        sms: false,
        push: true,
        realTime: true
      };

      res.status(200).json({
        success: true,
        data: {
          userId,
          preferences
        }
      });
    } catch (error) {
      logger.error('Failed to get notification preferences', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get notification preferences'
      });
    }
  };

  /**
   * Send test notification
   */
  sendTestNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id!;
      const { templateId, testData } = req.body;

      if (!templateId) {
        res.status(400).json({
          success: false,
          error: 'templateId is required'
        });
        return;
      }

      const variables = {
        userName: 'Test User',
        userEmail: 'test@example.com',
        userPhone: '+1234567890',
        propertyName: 'Test Property',
        investmentAmount: '1000.00',
        tokenAmount: '100',
        transactionId: 'test_tx_123',
        ...testData
      };

      await this.notificationService.sendNotification(
        userId,
        templateId,
        variables
      );

      res.status(200).json({
        success: true,
        data: {
          message: 'Test notification sent successfully',
          templateId,
          variables
        }
      });
    } catch (error) {
      logger.error('Failed to send test notification', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test notification'
      });
    }
  };

  /**
   * Get available notification templates
   */
  getTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
      const templates = [
        {
          id: 'investment_confirmation',
          name: 'Investment Confirmation',
          description: 'Sent when an investment is confirmed',
          variables: ['userName', 'propertyName', 'investmentAmount', 'tokenAmount', 'transactionId']
        },
        {
          id: 'dividend_payment',
          name: 'Dividend Payment',
          description: 'Sent when dividend is paid',
          variables: ['userName', 'propertyName', 'dividendAmount', 'paymentDate', 'tokenAmount', 'transactionId']
        },
        {
          id: 'trade_executed',
          name: 'Trade Executed',
          description: 'Sent when a trade is executed',
          variables: ['userName', 'propertyName', 'tradeType', 'tokenAmount', 'price', 'totalValue', 'tradeId']
        },
        {
          id: 'kyc_approved',
          name: 'KYC Approved',
          description: 'Sent when KYC verification is approved',
          variables: ['userName']
        },
        {
          id: 'property_update',
          name: 'Property Update',
          description: 'Sent when there are property updates',
          variables: ['userName', 'propertyName', 'updateContent', 'updateSummary']
        }
      ];

      res.status(200).json({
        success: true,
        data: {
          templates
        }
      });
    } catch (error) {
      logger.error('Failed to get notification templates', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get notification templates'
      });
    }
  };

  /**
   * Mark notifications as read
   */
  markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id!;
      const { notificationIds } = req.body;

      if (!Array.isArray(notificationIds)) {
        res.status(400).json({
          success: false,
          error: 'notificationIds must be an array'
        });
        return;
      }

      // Mock marking as read for demo
      logger.info('Notifications marked as read', { userId, notificationIds });

      res.status(200).json({
        success: true,
        data: {
          message: 'Notifications marked as read',
          markedCount: notificationIds.length
        }
      });
    } catch (error) {
      logger.error('Failed to mark notifications as read', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to mark notifications as read'
      });
    }
  };

  /**
   * Get notification statistics
   */
  getNotificationStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id!;

      // Mock statistics for demo
      const stats = {
        totalSent: 45,
        totalDelivered: 43,
        totalFailed: 2,
        deliveryRate: 95.6,
        channelBreakdown: {
          email: 45,
          sms: 12,
          push: 38,
          realTime: 45
        },
        recentActivity: {
          last24h: 5,
          last7d: 18,
          last30d: 45
        }
      };

      res.status(200).json({
        success: true,
        data: {
          userId,
          stats
        }
      });
    } catch (error) {
      logger.error('Failed to get notification stats', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get notification stats'
      });
    }
  };
}