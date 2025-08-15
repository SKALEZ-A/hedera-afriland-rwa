import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';

export interface NotificationRequest {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  channels?: string[];
}

export interface NotificationResponse {
  id: string;
  status: 'sent' | 'failed';
  channels: string[];
  error?: string;
}

export class NotificationService {
  private emailTransporter: nodemailer.Transporter;

  constructor() {
    this.initializeEmailTransporter();
  }

  private initializeEmailTransporter() {
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Send notification to a user
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResponse> {
    try {
      logger.info(`Sending notification to user ${request.userId}`, {
        type: request.type,
        title: request.title
      });

      const channels = request.channels || ['email'];
      const sentChannels: string[] = [];
      let error: string | undefined;

      // Send email notification
      if (channels.includes('email')) {
        try {
          await this.sendEmailNotification(request);
          sentChannels.push('email');
        } catch (emailError) {
          logger.error('Failed to send email notification:', emailError);
          error = emailError instanceof Error ? emailError.message : 'Email sending failed';
        }
      }

      // Send push notification (placeholder)
      if (channels.includes('push')) {
        try {
          await this.sendPushNotification(request);
          sentChannels.push('push');
        } catch (pushError) {
          logger.error('Failed to send push notification:', pushError);
          error = pushError instanceof Error ? pushError.message : 'Push notification failed';
        }
      }

      const response: NotificationResponse = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: sentChannels.length > 0 ? 'sent' : 'failed',
        channels: sentChannels,
        error
      };

      logger.info('Notification sent', response);
      return response;

    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(request: NotificationRequest): Promise<void> {
    // This would typically get the user's email from the database
    const userEmail = `user${request.userId}@example.com`; // Placeholder

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: userEmail,
      subject: request.title,
      html: `
        <h2>${request.title}</h2>
        <p>${request.message}</p>
        ${request.data ? `<pre>${JSON.stringify(request.data, null, 2)}</pre>` : ''}
      `
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  /**
   * Send push notification (placeholder implementation)
   */
  private async sendPushNotification(request: NotificationRequest): Promise<void> {
    // This would integrate with a push notification service like Firebase
    logger.info('Push notification would be sent here', {
      userId: request.userId,
      title: request.title,
      message: request.message
    });
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(requests: NotificationRequest[]): Promise<NotificationResponse[]> {
    try {
      const responses = await Promise.all(
        requests.map(request => this.sendNotification(request))
      );
      
      logger.info(`Sent ${responses.length} bulk notifications`);
      return responses;

    } catch (error) {
      logger.error('Error sending bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Send notification to all token holders of a property
   */
  async notifyTokenHolders(
    propertyId: string,
    notificationType: string,
    notificationData: {
      title: string;
      message: string;
      [key: string]: any;
    }
  ): Promise<{ success: boolean; notificationsSent: number; errors?: string[] }> {
    try {
      logger.info(`Sending notifications to token holders for property ${propertyId}`);

      // This would typically query the database for token holders
      // For now, we'll return a placeholder response
      return {
        success: true,
        notificationsSent: 0
      };

    } catch (error) {
      logger.error('Error notifying token holders:', error);
      throw error;
    }
  }
}