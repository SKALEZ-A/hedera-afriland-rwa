import { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';
import { logger } from '../utils/logger';
import { PaymentRequest, MobilePaymentRequest } from '../types/entities';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * Process a payment
   */
  processPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const paymentRequest: PaymentRequest = {
        userId: req.user?.id!,
        amount: req.body.amount,
        currency: req.body.currency,
        paymentMethod: req.body.paymentMethod,
        paymentMethodId: req.body.paymentMethodId,
        propertyId: req.body.propertyId,
        tokenAmount: req.body.tokenAmount,
        phoneNumber: req.body.phoneNumber,
        mobileMoneyProvider: req.body.mobileMoneyProvider
      };

      // Validate payment request
      if (!this.paymentService.validatePaymentRequest(paymentRequest)) {
        res.status(400).json({
          success: false,
          error: 'Invalid payment request'
        });
        return;
      }

      const result = await this.paymentService.processPayment(paymentRequest);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Payment processing failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Payment processing failed'
      });
    }
  };

  /**
   * Initiate mobile money payment
   */
  initiateMobilePayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const mobilePaymentRequest: MobilePaymentRequest = {
        userId: req.user?.id!,
        amount: req.body.amount,
        currency: req.body.currency,
        phoneNumber: req.body.phoneNumber,
        provider: req.body.provider,
        propertyId: req.body.propertyId,
        tokenAmount: req.body.tokenAmount
      };

      const result = await this.paymentService.initiateMobilePayment(mobilePaymentRequest);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Mobile payment initiation failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Mobile payment initiation failed'
      });
    }
  };

  /**
   * Convert currency
   */
  convertCurrency = async (req: Request, res: Response): Promise<void> => {
    try {
      const { amount, from, to } = req.body;

      if (!amount || !from || !to) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: amount, from, to'
        });
        return;
      }

      const convertedAmount = await this.paymentService.convertCurrency(amount, from, to);

      res.status(200).json({
        success: true,
        data: {
          originalAmount: amount,
          originalCurrency: from,
          convertedAmount,
          convertedCurrency: to,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Currency conversion failed', { error });
      res.status(500).json({
        success: false,
        error: 'Currency conversion failed'
      });
    }
  };

  /**
   * Get exchange rates
   */
  getExchangeRates = async (req: Request, res: Response): Promise<void> => {
    try {
      const rates = await this.paymentService.getExchangeRates();

      res.status(200).json({
        success: true,
        data: rates
      });
    } catch (error) {
      logger.error('Failed to get exchange rates', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get exchange rates'
      });
    }
  };

  /**
   * Handle Stripe webhook
   */
  handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const payload = req.body;

      await this.paymentService.handleWebhook(signature, payload);

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Webhook handling failed', { error });
      res.status(400).json({
        success: false,
        error: 'Webhook handling failed'
      });
    }
  };

  /**
   * Get payment methods for user
   */
  getPaymentMethods = async (req: Request, res: Response): Promise<void> => {
    try {
      // Mock payment methods based on user location/preferences
      const paymentMethods = [
        {
          id: 'stripe',
          name: 'Credit/Debit Card',
          type: 'STRIPE',
          currencies: ['USD', 'EUR', 'GBP'],
          fees: '2.9% + $0.30'
        },
        {
          id: 'mpesa',
          name: 'M-Pesa',
          type: 'MOBILE_MONEY',
          currencies: ['KES'],
          fees: '1.5%'
        },
        {
          id: 'mtn',
          name: 'MTN Mobile Money',
          type: 'MOBILE_MONEY',
          currencies: ['UGX', 'GHS', 'ZMW'],
          fees: '2.0%'
        },
        {
          id: 'airtel',
          name: 'Airtel Money',
          type: 'MOBILE_MONEY',
          currencies: ['KES', 'UGX', 'TZS'],
          fees: '1.8%'
        },
        {
          id: 'hbar',
          name: 'HBAR',
          type: 'CRYPTO',
          currencies: ['HBAR'],
          fees: '$0.0001'
        }
      ];

      res.status(200).json({
        success: true,
        data: paymentMethods
      });
    } catch (error) {
      logger.error('Failed to get payment methods', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get payment methods'
      });
    }
  };

  /**
   * Calculate payment fees
   */
  calculateFees = async (req: Request, res: Response): Promise<void> => {
    try {
      const { amount, currency, paymentMethod } = req.body;

      if (!amount || !currency || !paymentMethod) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters'
        });
        return;
      }

      let fees = 0;
      let feeDescription = '';

      switch (paymentMethod) {
        case 'STRIPE':
          fees = (amount * 0.029) + 0.30;
          feeDescription = '2.9% + $0.30';
          break;
        case 'MOBILE_MONEY':
          fees = amount * 0.015; // 1.5%
          feeDescription = '1.5%';
          break;
        case 'CRYPTO':
          fees = 0.0001; // Fixed HBAR fee
          feeDescription = '$0.0001';
          break;
        default:
          fees = 0;
          feeDescription = 'No fees';
      }

      const totalAmount = amount + fees;

      res.status(200).json({
        success: true,
        data: {
          amount,
          currency,
          paymentMethod,
          fees,
          feeDescription,
          totalAmount,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Fee calculation failed', { error });
      res.status(500).json({
        success: false,
        error: 'Fee calculation failed'
      });
    }
  };
}