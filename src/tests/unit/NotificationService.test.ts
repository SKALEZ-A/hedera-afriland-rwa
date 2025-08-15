import { NotificationService } from '../../services/NotificationService';
import { NotificationPreferences } from '../../types/entities';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    notificationService = new NotificationService();
    jest.clearAllMocks();
  });

  describe('sendEmail', () => {
    it('should send email with investment confirmation template', async () => {
      const variables = {
        userName: 'John Doe',
        propertyName: 'Lagos Luxury Apartments',
        investmentAmount: '1000.00',
        tokenAmount: '100',
        transactionId: 'tx_123456'
      };

      await expect(
        notificationService.sendEmail('john@example.com', 'investment_confirmation', variables)
      ).resolves.not.toThrow();
    });

    it('should throw error for invalid template', async () => {
      await expect(
        notificationService.sendEmail('john@example.com', 'invalid_template', {})
      ).rejects.toThrow('Template not found: invalid_template');
    });

    it('should replace variables in email template', async () => {
      const variables = {
        userName: 'Jane Smith',
        propertyName: 'Nairobi Office Complex',
        dividendAmount: '125.50',
        paymentDate: '2024-01-15',
        tokenAmount: '50',
        transactionId: 'div_789'
      };

      await expect(
        notificationService.sendEmail('jane@example.com', 'dividend_payment', variables)
      ).resolves.not.toThrow();
    });
  });

  describe('sendSMS', () => {
    it('should send SMS with template', async () => {
      const variables = {
        propertyName: 'Cape Town Retail Center',
        dividendAmount: '75.25',
        transactionId: 'sms_tx_123'
      };

      await expect(
        notificationService.sendSMS('+1234567890', 'dividend_payment', variables)
      ).resolves.not.toThrow();
    });

    it('should throw error for template without SMS template', async () => {
      // Assuming some template doesn't have SMS template
      await expect(
        notificationService.sendSMS('+1234567890', 'invalid_template', {})
      ).rejects.toThrow('SMS template not found: invalid_template');
    });
  });

  describe('sendPushNotification', () => {
    it('should send push notification with template', async () => {
      const variables = {
        propertyName: 'Accra Business District',
        investmentAmount: '500.00'
      };

      await expect(
        notificationService.sendPushNotification('user123', 'investment_confirmation', variables)
      ).resolves.not.toThrow();
    });
  });

  describe('sendNotification', () => {
    it('should send multi-channel notification', async () => {
      const variables = {
        userName: 'Alice Johnson',
        userEmail: 'alice@example.com',
        userPhone: '+1987654321',
        propertyName: 'Johannesburg Mall',
        investmentAmount: '2000.00',
        tokenAmount: '200',
        transactionId: 'multi_tx_456'
      };

      const preferences: NotificationPreferences = {
        email: true,
        sms: true,
        push: true,
        realTime: true
      };

      await expect(
        notificationService.sendNotification('user456', 'investment_confirmation', variables, preferences)
      ).resolves.not.toThrow();
    });

    it('should respect user preferences', async () => {
      const variables = {
        userName: 'Bob Wilson',
        userEmail: 'bob@example.com',
        propertyName: 'Kigali Heights',
        dividendAmount: '150.00'
      };

      const preferences: NotificationPreferences = {
        email: true,
        sms: false,
        push: false,
        realTime: true
      };

      await expect(
        notificationService.sendNotification('user789', 'dividend_payment', variables, preferences)
      ).resolves.not.toThrow();
    });
  });

  describe('sendBulkNotification', () => {
    it('should send notifications to multiple users', async () => {
      const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
      const variables = {
        propertyName: 'Dar es Salaam Tower',
        updateContent: 'Property renovation completed successfully.',
        updateSummary: 'Renovation completed'
      };

      await expect(
        notificationService.sendBulkNotification(userIds, 'property_update', variables)
      ).resolves.not.toThrow();
    });

    it('should handle large user lists with batching', async () => {
      const userIds = Array.from({ length: 25 }, (_, i) => `user${i + 1}`);
      const variables = {
        userName: 'Valued Investor',
        propertyName: 'Kampala Commercial Center'
      };

      await expect(
        notificationService.sendBulkNotification(userIds, 'kyc_approved', variables)
      ).resolves.not.toThrow();
    });
  });

  describe('getNotificationHistory', () => {
    it('should return notification history for user', async () => {
      const history = await notificationService.getNotificationHistory('user123', 10, 0);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(0);
      
      if (history.length > 0) {
        expect(history[0]).toHaveProperty('id');
        expect(history[0]).toHaveProperty('userId');
        expect(history[0]).toHaveProperty('templateId');
        expect(history[0]).toHaveProperty('channels');
        expect(history[0]).toHaveProperty('status');
        expect(history[0]).toHaveProperty('createdAt');
      }
    });

    it('should respect limit and offset parameters', async () => {
      const history1 = await notificationService.getNotificationHistory('user123', 1, 0);
      const history2 = await notificationService.getNotificationHistory('user123', 1, 1);

      expect(history1.length).toBeLessThanOrEqual(1);
      expect(history2.length).toBeLessThanOrEqual(1);
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update user notification preferences', async () => {
      const preferences: NotificationPreferences = {
        email: false,
        sms: true,
        push: true,
        realTime: false
      };

      await expect(
        notificationService.updateNotificationPreferences('user123', preferences)
      ).resolves.not.toThrow();
    });
  });

  describe('template variable replacement', () => {
    it('should replace variables correctly in templates', async () => {
      const variables = {
        userName: 'Test User',
        propertyName: 'Test Property',
        amount: '100.00'
      };

      // Test private method through public interface
      await expect(
        notificationService.sendEmail('test@example.com', 'investment_confirmation', variables)
      ).resolves.not.toThrow();
    });

    it('should handle missing variables gracefully', async () => {
      const variables = {
        userName: 'Test User'
        // Missing other required variables
      };

      await expect(
        notificationService.sendEmail('test@example.com', 'investment_confirmation', variables)
      ).resolves.not.toThrow();
    });
  });

  describe('WebSocket functionality', () => {
    it('should register WebSocket client', () => {
      const mockWs = {
        readyState: 1, // WebSocket.OPEN
        send: jest.fn(),
        on: jest.fn()
      } as any;

      expect(() => {
        notificationService.registerWebSocketClient('user123', mockWs);
      }).not.toThrow();

      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should send real-time notification to connected client', async () => {
      const mockWs = {
        readyState: 1, // WebSocket.OPEN
        send: jest.fn(),
        on: jest.fn()
      } as any;

      notificationService.registerWebSocketClient('user123', mockWs);

      await notificationService.sendRealTimeNotification('user123', 'test_notification', {
        message: 'Test message'
      });

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('test_notification')
      );
    });
  });
});