import { PaymentRequest, PaymentResult, Currency, ExchangeRates, MobilePaymentRequest } from '../types/entities';
import { logger } from '../utils/logger';
import Stripe from 'stripe';

export class PaymentService {
  private stripe: Stripe;
  private exchangeRates: Map<string, number> = new Map();

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
    this.initializeExchangeRates();
  }

  /**
   * Process payment using various payment methods
   */
  async processPayment(payment: PaymentRequest): Promise<PaymentResult> {
    try {
      logger.info('Processing payment', { 
        userId: payment.userId, 
        amount: payment.amount, 
        currency: payment.currency 
      });

      switch (payment.paymentMethod) {
        case 'STRIPE':
          return await this.processStripePayment(payment);
        case 'MOBILE_MONEY':
          return await this.processMobileMoneyPayment(payment);
        case 'CRYPTO':
          return await this.processCryptoPayment(payment);
        default:
          throw new Error(`Unsupported payment method: ${payment.paymentMethod}`);
      }
    } catch (error) {
      logger.error('Payment processing failed', { error, payment });
      return {
        success: false,
        transactionId: '',
        error: error instanceof Error ? error.message : 'Payment processing failed',
        timestamp: new Date()
      };
    }
  }

  /**
   * Process Stripe payment
   */
  private async processStripePayment(payment: PaymentRequest): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(payment.amount * 100), // Convert to cents
        currency: payment.currency.toLowerCase(),
        payment_method: payment.paymentMethodId,
        confirm: true,
        return_url: `${process.env.FRONTEND_URL}/payment/return`,
        metadata: {
          userId: payment.userId,
          propertyId: payment.propertyId || '',
          tokenAmount: payment.tokenAmount?.toString() || '0'
        }
      });

      if (paymentIntent.status === 'succeeded') {
        logger.info('Stripe payment succeeded', { 
          paymentIntentId: paymentIntent.id,
          userId: payment.userId 
        });

        return {
          success: true,
          transactionId: paymentIntent.id,
          amount: payment.amount,
          currency: payment.currency,
          timestamp: new Date(),
          providerResponse: paymentIntent
        };
      } else {
        return {
          success: false,
          transactionId: paymentIntent.id,
          error: `Payment status: ${paymentIntent.status}`,
          timestamp: new Date()
        };
      }
    } catch (error) {
      logger.error('Stripe payment failed', { error, payment });
      throw error;
    }
  }

  /**
   * Process mobile money payment (Mock implementation for demo)
   */
  private async processMobileMoneyPayment(payment: PaymentRequest): Promise<PaymentResult> {
    try {
      // Mock mobile money integration
      logger.info('Processing mobile money payment', { 
        provider: payment.mobileMoneyProvider,
        phoneNumber: payment.phoneNumber 
      });

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful payment for demo
      const transactionId = `MM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        transactionId,
        amount: payment.amount,
        currency: payment.currency,
        timestamp: new Date(),
        providerResponse: {
          provider: payment.mobileMoneyProvider,
          phoneNumber: payment.phoneNumber,
          reference: transactionId
        }
      };
    } catch (error) {
      logger.error('Mobile money payment failed', { error, payment });
      throw error;
    }
  }

  /**
   * Process cryptocurrency payment
   */
  private async processCryptoPayment(payment: PaymentRequest): Promise<PaymentResult> {
    try {
      // For demo, we'll simulate HBAR payment
      logger.info('Processing crypto payment', { 
        currency: payment.currency,
        amount: payment.amount 
      });

      // In real implementation, this would integrate with Hedera SDK
      const transactionId = `HBAR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        transactionId,
        amount: payment.amount,
        currency: payment.currency,
        timestamp: new Date(),
        providerResponse: {
          network: 'hedera-testnet',
          transactionId
        }
      };
    } catch (error) {
      logger.error('Crypto payment failed', { error, payment });
      throw error;
    }
  }

  /**
   * Convert currency amounts
   */
  async convertCurrency(amount: number, from: Currency, to: Currency): Promise<number> {
    if (from === to) return amount;

    try {
      const fromRate = this.exchangeRates.get(from) || 1;
      const toRate = this.exchangeRates.get(to) || 1;
      
      const convertedAmount = (amount / fromRate) * toRate;
      
      logger.info('Currency conversion', { 
        amount, 
        from, 
        to, 
        convertedAmount,
        fromRate,
        toRate 
      });

      return convertedAmount;
    } catch (error) {
      logger.error('Currency conversion failed', { error, amount, from, to });
      throw new Error('Currency conversion failed');
    }
  }

  /**
   * Initiate mobile money payment
   */
  async initiateMobilePayment(request: MobilePaymentRequest): Promise<PaymentResult> {
    try {
      logger.info('Initiating mobile money payment', { 
        provider: request.provider,
        phoneNumber: request.phoneNumber 
      });

      // Mock implementation for different providers
      switch (request.provider) {
        case 'M_PESA':
          return await this.initiateMPesaPayment(request);
        case 'MTN_MOBILE_MONEY':
          return await this.initiateMTNPayment(request);
        case 'AIRTEL_MONEY':
          return await this.initiateAirtelPayment(request);
        default:
          throw new Error(`Unsupported mobile money provider: ${request.provider}`);
      }
    } catch (error) {
      logger.error('Mobile payment initiation failed', { error, request });
      throw error;
    }
  }

  /**
   * Mock M-Pesa integration
   */
  private async initiateMPesaPayment(request: MobilePaymentRequest): Promise<PaymentResult> {
    // Mock M-Pesa STK Push
    const transactionId = `MPESA_${Date.now()}`;
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      success: true,
      transactionId,
      amount: request.amount,
      currency: 'KES',
      timestamp: new Date(),
      providerResponse: {
        CheckoutRequestID: transactionId,
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        CustomerMessage: 'Success. Request accepted for processing'
      }
    };
  }

  /**
   * Mock MTN Mobile Money integration
   */
  private async initiateMTNPayment(request: MobilePaymentRequest): Promise<PaymentResult> {
    const transactionId = `MTN_${Date.now()}`;
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      success: true,
      transactionId,
      amount: request.amount,
      currency: request.currency,
      timestamp: new Date(),
      providerResponse: {
        referenceId: transactionId,
        status: 'PENDING',
        message: 'Payment request sent to customer'
      }
    };
  }

  /**
   * Mock Airtel Money integration
   */
  private async initiateAirtelPayment(request: MobilePaymentRequest): Promise<PaymentResult> {
    const transactionId = `AIRTEL_${Date.now()}`;
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      success: true,
      transactionId,
      amount: request.amount,
      currency: request.currency,
      timestamp: new Date(),
      providerResponse: {
        transaction_id: transactionId,
        status: 'TXN_SUCCESS',
        message: 'Transaction successful'
      }
    };
  }

  /**
   * Get current exchange rates
   */
  async getExchangeRates(): Promise<ExchangeRates> {
    try {
      // In production, this would fetch from a real exchange rate API
      return {
        USD: 1.0,
        EUR: 0.85,
        GBP: 0.73,
        KES: 150.0,
        NGN: 800.0,
        ZAR: 18.5,
        GHS: 12.0,
        HBAR: 0.05,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Failed to fetch exchange rates', { error });
      throw new Error('Failed to fetch exchange rates');
    }
  }

  /**
   * Initialize exchange rates cache
   */
  private async initializeExchangeRates(): Promise<void> {
    try {
      const rates = await this.getExchangeRates();
      
      Object.entries(rates).forEach(([currency, rate]) => {
        if (typeof rate === 'number') {
          this.exchangeRates.set(currency, rate);
        }
      });

      logger.info('Exchange rates initialized', { 
        currencies: Array.from(this.exchangeRates.keys()) 
      });
    } catch (error) {
      logger.error('Failed to initialize exchange rates', { error });
      // Set default rates
      this.exchangeRates.set('USD', 1.0);
      this.exchangeRates.set('HBAR', 0.05);
    }
  }

  /**
   * Validate payment request
   */
  validatePaymentRequest(payment: PaymentRequest): boolean {
    if (!payment.userId || !payment.amount || !payment.currency) {
      return false;
    }

    if (payment.amount <= 0) {
      return false;
    }

    if (payment.paymentMethod === 'MOBILE_MONEY' && !payment.phoneNumber) {
      return false;
    }

    if (payment.paymentMethod === 'STRIPE' && !payment.paymentMethodId) {
      return false;
    }

    return true;
  }

  /**
   * Handle payment webhook (for Stripe)
   */
  async handleWebhook(signature: string, payload: string): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      logger.info('Stripe webhook received', { type: event.type });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
          break;
        default:
          logger.info('Unhandled webhook event type', { type: event.type });
      }
    } catch (error) {
      logger.error('Webhook handling failed', { error });
      throw error;
    }
  }

  /**
   * Handle successful payment webhook
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.info('Payment succeeded via webhook', { 
      paymentIntentId: paymentIntent.id,
      userId: paymentIntent.metadata.userId 
    });

    // Update payment status in database
    // Trigger investment token transfer
    // Send confirmation notifications
  }

  /**
   * Handle failed payment webhook
   */
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.error('Payment failed via webhook', { 
      paymentIntentId: paymentIntent.id,
      userId: paymentIntent.metadata.userId 
    });

    // Update payment status in database
    // Send failure notifications
    // Trigger retry logic if applicable
  }
}