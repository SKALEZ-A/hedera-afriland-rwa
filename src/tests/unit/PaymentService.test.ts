import { PaymentService } from '../../services/PaymentService';
import { PaymentRequest, MobilePaymentRequest } from '../../types/entities';

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    paymentService = new PaymentService();
  });

  describe('validatePaymentRequest', () => {
    it('should validate a valid payment request', () => {
      const validRequest: PaymentRequest = {
        userId: 'user123',
        amount: 100,
        currency: 'USD',
        paymentMethod: 'STRIPE',
        paymentMethodId: 'pm_123'
      };

      const isValid = paymentService.validatePaymentRequest(validRequest);
      expect(isValid).toBe(true);
    });

    it('should reject payment request with missing userId', () => {
      const invalidRequest: PaymentRequest = {
        userId: '',
        amount: 100,
        currency: 'USD',
        paymentMethod: 'STRIPE',
        paymentMethodId: 'pm_123'
      };

      const isValid = paymentService.validatePaymentRequest(invalidRequest);
      expect(isValid).toBe(false);
    });

    it('should reject payment request with zero amount', () => {
      const invalidRequest: PaymentRequest = {
        userId: 'user123',
        amount: 0,
        currency: 'USD',
        paymentMethod: 'STRIPE',
        paymentMethodId: 'pm_123'
      };

      const isValid = paymentService.validatePaymentRequest(invalidRequest);
      expect(isValid).toBe(false);
    });

    it('should reject mobile money request without phone number', () => {
      const invalidRequest: PaymentRequest = {
        userId: 'user123',
        amount: 100,
        currency: 'KES',
        paymentMethod: 'MOBILE_MONEY'
      };

      const isValid = paymentService.validatePaymentRequest(invalidRequest);
      expect(isValid).toBe(false);
    });
  });

  describe('convertCurrency', () => {
    it('should return same amount for same currency', async () => {
      const result = await paymentService.convertCurrency(100, 'USD', 'USD');
      expect(result).toBe(100);
    });

    it('should convert USD to KES correctly', async () => {
      const result = await paymentService.convertCurrency(1, 'USD', 'KES');
      expect(result).toBeGreaterThan(100); // Assuming 1 USD > 100 KES
    });

    it('should handle currency conversion errors', async () => {
      await expect(
        paymentService.convertCurrency(100, 'INVALID' as any, 'USD')
      ).rejects.toThrow('Currency conversion failed');
    });
  });

  describe('getExchangeRates', () => {
    it('should return exchange rates object', async () => {
      const rates = await paymentService.getExchangeRates();
      
      expect(rates).toHaveProperty('USD');
      expect(rates).toHaveProperty('EUR');
      expect(rates).toHaveProperty('KES');
      expect(rates).toHaveProperty('HBAR');
      expect(rates).toHaveProperty('lastUpdated');
      expect(rates.USD).toBe(1.0);
    });
  });

  describe('initiateMobilePayment', () => {
    it('should initiate M-Pesa payment successfully', async () => {
      const request: MobilePaymentRequest = {
        userId: 'user123',
        amount: 1000,
        currency: 'KES',
        phoneNumber: '+254700000000',
        provider: 'M_PESA',
        propertyId: 'prop123',
        tokenAmount: 10
      };

      const result = await paymentService.initiateMobilePayment(request);
      
      expect(result.success).toBe(true);
      expect(result.transactionId).toContain('MPESA_');
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe('KES');
    });

    it('should initiate MTN Mobile Money payment successfully', async () => {
      const request: MobilePaymentRequest = {
        userId: 'user123',
        amount: 50000,
        currency: 'UGX',
        phoneNumber: '+256700000000',
        provider: 'MTN_MOBILE_MONEY',
        propertyId: 'prop123',
        tokenAmount: 5
      };

      const result = await paymentService.initiateMobilePayment(request);
      
      expect(result.success).toBe(true);
      expect(result.transactionId).toContain('MTN_');
      expect(result.amount).toBe(50000);
    });

    it('should handle unsupported mobile money provider', async () => {
      const request: MobilePaymentRequest = {
        userId: 'user123',
        amount: 1000,
        currency: 'KES',
        phoneNumber: '+254700000000',
        provider: 'UNSUPPORTED' as any,
        propertyId: 'prop123',
        tokenAmount: 10
      };

      await expect(
        paymentService.initiateMobilePayment(request)
      ).rejects.toThrow('Unsupported mobile money provider');
    });
  });

  describe('processPayment', () => {
    it('should process crypto payment successfully', async () => {
      const request: PaymentRequest = {
        userId: 'user123',
        amount: 100,
        currency: 'HBAR',
        paymentMethod: 'CRYPTO',
        propertyId: 'prop123',
        tokenAmount: 2000
      };

      const result = await paymentService.processPayment(request);
      
      expect(result.success).toBe(true);
      expect(result.transactionId).toContain('HBAR_');
      expect(result.amount).toBe(100);
      expect(result.currency).toBe('HBAR');
    });

    it('should handle unsupported payment method', async () => {
      const request: PaymentRequest = {
        userId: 'user123',
        amount: 100,
        currency: 'USD',
        paymentMethod: 'UNSUPPORTED' as any
      };

      const result = await paymentService.processPayment(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported payment method');
    });
  });
});