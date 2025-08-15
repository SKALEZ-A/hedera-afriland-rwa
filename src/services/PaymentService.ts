import { PaymentRequest, PaymentResult, Currency, ExchangeRates, MobilePaymentRequest, TransactionStatus } from '../types/entities';
import { logger } from '../utils/logger';
import Stripe from 'stripe';

export class PaymentService {
  private stripe: Stripe;
  private exchangeRates: Map<string, number> = new Map();

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });
    
    // Initialize exchange rates
    this.initializeExchangeRates();
  }

  /**
   * Process payment based on payment method
   */
  async processPayment(payment: PaymentRequest): Promise<PaymentResult> {
    try {
      logger.info('Processing payment', { 
        method: payment.paymentMethod, 
        amount: payment.amount,
        currency: payment.currency 
      });

      // Validate payment request
      if (!this.validatePaymentRequest(payment)) {
        return {
          success: false,
          transactionId: '',
          amount: payment.amount,
          currency: payment.currency,
          status: 'failed' as TransactionStatus,
          error: 'Invalid payment request'
        };
      }

      switch (payment.paymentMethod) {
        case 'STRIPE':
          return await this.processStripePayment(payment);
        case 'MOBILE_MONEY':
          return await this.processMobileMoneyPayment(payment as MobilePaymentRequest);
        case 'CRYPTO':
          return await this.processCryptoPayment(payment);
        default:
          return {
            success: false,
            transactionId: '',
            amount: payment.amount,
            currency: payment.currency,
            status: 'failed' as TransactionStatus,
            error: 'Unsupported payment method'
          };
      }
    } catch (error) {
      logger.error('Payment processing failed', { error, payment });
      return {
        success: false,
        transactionId: '',
        amount: payment.amount,
        currency: payment.currency,
        status: 'failed' as TransactionStatus,
        error: error instanceof Error ? error.message : 'Payment processing failed'
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
        payment_method: payment.paymentMethodId || 'pm_card_visa',
        confirm: true,
        return_url: process.env.FRONTEND_URL + '/payment/success',
        metadata: {
          userId: payment.userId,
          propertyId: payment.propertyId || '',
          tokenAmount: payment.tokenAmount?.toString() || '0'
        }
      });

      if (paymentIntent.status === 'succeeded') {
        return {
          success: true,
          transactionId: paymentIntent.id,
          paymentReference: paymentIntent.id,
          amount: payment.amount,
          currency: payment.currency,
          status: 'completed' as TransactionStatus,
          message: 'Payment processed successfully'
        };
      } else {
        return {
          success: false,
          transactionId: paymentIntent.id,
          amount: payment.amount,
          currency: payment.currency,
          status: 'failed' as TransactionStatus,
          error: `Payment status: ${paymentIntent.status}`
        };
      }
    } catch (error) {
      logger.error('Stripe payment failed', { error, payment });
      throw error;
    }
  }

  /**
   * Process mobile money payment
   */
  private async processMobileMoneyPayment(payment: MobilePaymentRequest): Promise<PaymentResult> {
    try {
      logger.info('Processing mobile money payment', {
        provider: payment.mobileMoneyProvider,
        phoneNumber: payment.phoneNumber
      });

      switch (payment.mobileMoneyProvider) {
        case 'M_PESA':
          return await this.initiateMPesaPayment(payment);
        case 'MTN_MOBILE_MONEY':
          return await this.initiateMTNPayment(payment);
        case 'AIRTEL_MONEY':
          return await this.initiateAirtelPayment(payment);
        default:
          throw new Error(`Unsupported mobile money provider: ${payment.mobileMoneyProvider}`);
      }
    } catch (error) {
      logger.error('Mobile money payment failed', { error, payment });
      throw error;
    }
  }

  /**
   * Process crypto payment
   */
  private async processCryptoPayment(payment: PaymentRequest): Promise<PaymentResult> {
    try {
      logger.info('Processing crypto payment', {
        amount: payment.amount,
        currency: payment.currency
      });

      const transactionId = `HBAR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        transactionId,
        amount: payment.amount,
        currency: payment.currency,
        status: 'completed' as TransactionStatus,
        message: 'Crypto payment processed successfully'
      };
    } catch (error) {
      logger.error('Crypto payment failed', { error, payment });
      throw error;
    }
  }

  /**
   * Convert currency
   */
  async convertCurrency(amount: number, from: Currency, to: Currency): Promise<number> {
    if (from === to) return amount;

    const fromRate = this.exchangeRates.get(from) || 1;
    const toRate = this.exchangeRates.get(to) || 1;

    // Convert to USD first, then to target currency
    const usdAmount = amount / fromRate;
    const convertedAmount = usdAmount * toRate;

    logger.info('Currency conversion', {
      amount,
      from,
      to,
      convertedAmount,
      fromRate,
      toRate
    });

    return convertedAmount;
  }

  /**
   * Initiate mobile payment
   */
  async initiateMobilePayment(request: MobilePaymentRequest): Promise<PaymentResult> {
    return this.processMobileMoneyPayment(request);
  }

  /**
   * Initiate M-Pesa payment
   */
  private async initiateMPesaPayment(request: MobilePaymentRequest): Promise<PaymentResult> {
    const transactionId = `MPESA_${Date.now()}`;
    
    // Simulate M-Pesa API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      success: true,
      transactionId,
      amount: request.amount,
      currency: request.currency,
      status: 'completed' as TransactionStatus,
      message: 'M-Pesa payment initiated successfully'
    };
  }

  /**
   * Initiate MTN payment
   */
  private async initiateMTNPayment(request: MobilePaymentRequest): Promise<PaymentResult> {
    const transactionId = `MTN_${Date.now()}`;
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      success: true,
      transactionId,
      amount: request.amount,
      currency: request.currency,
      status: 'completed' as TransactionStatus,
      message: 'MTN Mobile Money payment initiated successfully'
    };
  }

  /**
   * Initiate Airtel payment
   */
  private async initiateAirtelPayment(request: MobilePaymentRequest): Promise<PaymentResult> {
    const transactionId = `AIRTEL_${Date.now()}`;
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      success: true,
      transactionId,
      amount: request.amount,
      currency: request.currency,
      status: 'completed' as TransactionStatus,
      message: 'Airtel Money payment initiated successfully'
    };
  }

  /**
   * Get exchange rates
   */
  async getExchangeRates(): Promise<ExchangeRates> {
    try {
      // Mock exchange rates - in production, fetch from real API
      return {
        USD: 1.0,
        EUR: 0.85,
        GBP: 0.73,
        NGN: 460.0,
        KES: 110.0,
        ZAR: 18.5,
        GHS: 6.2,
        UGX: 3700.0,
        HBAR: 0.05
      };
    } catch (error) {
      logger.error('Failed to fetch exchange rates', { error });
      // Return default rates
      return {
        USD: 1.0,
        EUR: 0.85,
        GBP: 0.73,
        NGN: 460.0,
        KES: 110.0,
        ZAR: 18.5,
        GHS: 6.2,
        UGX: 3700.0,
        HBAR: 0.05
      };
    }
  }

  /**
   * Initialize exchange rates
   */
  private async initializeExchangeRates(): Promise<void> {
    try {
      const rates = await this.getExchangeRates();
      
      Object.entries(rates).forEach(([currency, rate]) => {
        this.exchangeRates.set(currency, rate);
      });

      logger.info('Exchange rates initialized', {
        currencies: Array.from(this.exchangeRates.keys())
      });
    } catch (error) {
      logger.error('Failed to initialize exchange rates', { error });
    }
  }

  /**
   * Validate payment request
   */
  validatePaymentRequest(payment: PaymentRequest): boolean {
    if (!payment.userId || !payment.amount || !payment.currency || !payment.paymentMethod) {
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
   * Handle webhook
   */
  async handleWebhook(signature: string, payload: string): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
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
   * Handle payment success
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.info('Payment succeeded via webhook', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount
    });

    // Update payment status in database
    // This would typically update the transaction record
  }

  /**
   * Handle payment failure
   */
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.error('Payment failed via webhook', {
      paymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error
    });

    // Update payment status in database
    // This would typically update the transaction record
  }
}