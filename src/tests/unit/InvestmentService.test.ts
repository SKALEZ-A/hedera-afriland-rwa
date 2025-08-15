import { InvestmentService, InvestmentPurchaseRequest } from '../../services/InvestmentService';
import { InvestmentModel } from '../../models/InvestmentModel';
import { TransactionModel } from '../../models/TransactionModel';
import { PropertyModel } from '../../models/PropertyModel';
import { UserModel } from '../../models/UserModel';
import { HederaService } from '../../services/HederaService';
import { ComplianceService } from '../../services/ComplianceService';
import { NotificationService } from '../../services/NotificationService';
import { 
  Investment, 
  Transaction, 
  Property, 
  User, 
  PaymentMethod, 
  CurrencyCode,
  TransactionStatus,
  InvestmentStatus
} from '../../types/entities';

// Mock all dependencies
jest.mock('../../models/InvestmentModel');
jest.mock('../../models/TransactionModel');
jest.mock('../../models/PropertyModel');
jest.mock('../../models/UserModel');
jest.mock('../../services/HederaService');
jest.mock('../../services/ComplianceService');
jest.mock('../../services/NotificationService');

describe('InvestmentService', () => {
  let investmentService: InvestmentService;
  let mockInvestmentModel: jest.Mocked<InvestmentModel>;
  let mockTransactionModel: jest.Mocked<TransactionModel>;
  let mockPropertyModel: jest.Mocked<PropertyModel>;
  let mockUserModel: jest.Mocked<UserModel>;
  let mockHederaService: jest.Mocked<HederaService>;
  let mockComplianceService: jest.Mocked<ComplianceService>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    firstName: 'John',
    lastName: 'Doe',
    walletAddress: '0.0.12345',
    kycStatus: 'approved',
    verificationLevel: 'intermediate',
    isAccreditedInvestor: false,
    emailVerified: true,
    phoneVerified: false,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockProperty: Property = {
    id: 'property-1',
    tokenId: '0.0.54321',
    name: 'Test Property',
    propertyType: 'residential',
    address: {
      addressLine1: '123 Test St',
      city: 'Test City',
      country: 'USA'
    },
    totalValuation: 1000000,
    totalTokens: 10000,
    availableTokens: 5000,
    pricePerToken: 100,
    minimumInvestment: 100,
    managementFeePercentage: 1.0,
    platformFeePercentage: 2.5,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockTransaction: Transaction = {
    id: 'transaction-1',
    userId: 'user-1',
    propertyId: 'property-1',
    transactionType: 'investment',
    amount: 1000,
    currency: 'USD',
    feeAmount: 25,
    netAmount: 1025,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockInvestment: Investment = {
    id: 'investment-1',
    userId: 'user-1',
    propertyId: 'property-1',
    tokenAmount: 10,
    purchasePricePerToken: 100,
    totalPurchasePrice: 1000,
    purchaseDate: new Date(),
    totalDividendsReceived: 0,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mocked instances
    mockInvestmentModel = new InvestmentModel() as jest.Mocked<InvestmentModel>;
    mockTransactionModel = new TransactionModel() as jest.Mocked<TransactionModel>;
    mockPropertyModel = new PropertyModel() as jest.Mocked<PropertyModel>;
    mockUserModel = new UserModel() as jest.Mocked<UserModel>;
    mockHederaService = new HederaService() as jest.Mocked<HederaService>;
    mockComplianceService = new ComplianceService() as jest.Mocked<ComplianceService>;
    mockNotificationService = new NotificationService() as jest.Mocked<NotificationService>;

    // Create service instance
    investmentService = new InvestmentService();

    // Replace private properties with mocks
    (investmentService as any).investmentModel = mockInvestmentModel;
    (investmentService as any).transactionModel = mockTransactionModel;
    (investmentService as any).propertyModel = mockPropertyModel;
    (investmentService as any).userModel = mockUserModel;
    (investmentService as any).hederaService = mockHederaService;
    (investmentService as any).complianceService = mockComplianceService;
    (investmentService as any).notificationService = mockNotificationService;
  });

  describe('purchaseTokens', () => {
    const validPurchaseRequest: InvestmentPurchaseRequest = {
      userId: 'user-1',
      propertyId: 'property-1',
      tokenAmount: 10,
      paymentMethod: 'card' as PaymentMethod,
      currency: 'USD' as CurrencyCode
    };

    beforeEach(() => {
      // Setup default mock responses
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockPropertyModel.findById.mockResolvedValue(mockProperty);
      mockTransactionModel.createTransaction.mockResolvedValue(mockTransaction);
      mockTransactionModel.updateTransaction.mockResolvedValue({
        ...mockTransaction,
        status: 'completed' as TransactionStatus
      });
      mockHederaService.transferTokens.mockResolvedValue({
        success: true,
        transactionId: 'hedera-tx-123'
      });
      mockInvestmentModel.getInvestmentByUserAndProperty.mockResolvedValue(null);
      mockInvestmentModel.createInvestment.mockResolvedValue(mockInvestment);
      mockPropertyModel.updateAvailableTokens.mockResolvedValue(mockProperty);
      
      // Mock compliance service methods
      (mockComplianceService as any).logInvestmentEvent = jest.fn().mockResolvedValue(undefined);
      (mockComplianceService as any).checkInvestmentLimits = jest.fn().mockResolvedValue({ allowed: true });
      (mockComplianceService as any).logInvestmentStatusChange = jest.fn().mockResolvedValue(undefined);
      
      // Mock notification service methods
      (mockNotificationService as any).sendNotification = jest.fn().mockResolvedValue(undefined);
    });

    it('should successfully purchase tokens for new investment', async () => {
      // Setup validation to pass
      (mockComplianceService as any).checkInvestmentLimits.mockResolvedValue({
        allowed: true
      });

      await investmentService.purchaseTokens(validPurchaseRequest);

      // Verify all steps were called
      expect(mockUserModel.findById).toHaveBeenCalledWith('user-1');
      expect(mockPropertyModel.findById).toHaveBeenCalledWith('property-1');
      expect(mockTransactionModel.createTransaction).toHaveBeenCalled();
      expect(mockHederaService.transferTokens).toHaveBeenCalled();
      expect(mockInvestmentModel.createInvestment).toHaveBeenCalled();
      expect((mockComplianceService as any).logInvestmentEvent).toHaveBeenCalled();
    });

    it('should add tokens to existing investment', async () => {
      // Setup existing investment
      mockInvestmentModel.getInvestmentByUserAndProperty.mockResolvedValue(mockInvestment);
      mockInvestmentModel.addTokensToInvestment.mockResolvedValue({
        ...mockInvestment,
        tokenAmount: 20,
        totalPurchasePrice: 2000
      });
      (mockComplianceService as any).checkInvestmentLimits.mockResolvedValue({
        allowed: true
      });

      // Mock successful payment for this test
      jest.spyOn(investmentService as any, 'processPayment').mockResolvedValue({
        success: true,
        transactionId: 'pay_success',
        paymentReference: 'ref_success',
        amount: 1025,
        currency: 'USD',
        status: 'completed',
        message: 'Payment processed successfully'
      });

      await investmentService.purchaseTokens(validPurchaseRequest);

      expect(mockInvestmentModel.addTokensToInvestment).toHaveBeenCalledWith(
        'user-1',
        'property-1',
        10,
        100
      );
      expect(mockInvestmentModel.createInvestment).not.toHaveBeenCalled();
    });

    it('should fail when user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      await expect(investmentService.purchaseTokens(validPurchaseRequest))
        .rejects.toThrow('User not found');
    });

    it('should fail when property not found', async () => {
      mockPropertyModel.findById.mockResolvedValue(null);

      await expect(investmentService.purchaseTokens(validPurchaseRequest))
        .rejects.toThrow('Property not found');
    });

    it('should fail when payment processing fails', async () => {
      (mockComplianceService as any).checkInvestmentLimits.mockResolvedValue({
        allowed: true
      });

      // Mock payment failure by making the service return a failed payment
      jest.spyOn(investmentService as any, 'processPayment').mockResolvedValue({
        success: false,
        message: 'Payment failed'
      });

      await expect(investmentService.purchaseTokens(validPurchaseRequest))
        .rejects.toThrow('Payment failed: Payment failed');
    });

    it('should fail when blockchain transfer fails', async () => {
      (mockComplianceService as any).checkInvestmentLimits.mockResolvedValue({
        allowed: true
      });
      mockHederaService.transferTokens.mockResolvedValue({
        success: false,
        transactionId: '',
        error: 'Blockchain error'
      });

      await expect(investmentService.purchaseTokens(validPurchaseRequest))
        .rejects.toThrow('Token transfer failed: Blockchain error');
    });
  });

  describe('validateInvestment', () => {
    const validationRequest: InvestmentPurchaseRequest = {
      userId: 'user-1',
      propertyId: 'property-1',
      tokenAmount: 10,
      paymentMethod: 'card' as PaymentMethod,
      currency: 'USD' as CurrencyCode
    };

    beforeEach(() => {
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockPropertyModel.findById.mockResolvedValue(mockProperty);
      (mockComplianceService as any).checkInvestmentLimits.mockResolvedValue({
        allowed: true
      });
    });

    it('should pass validation for valid investment', async () => {
      const result = await investmentService.validateInvestment(validationRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when user KYC not approved', async () => {
      mockUserModel.findById.mockResolvedValue({
        ...mockUser,
        kycStatus: 'pending'
      });

      const result = await investmentService.validateInvestment(validationRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User KYC verification required');
    });

    it('should fail validation when user has no wallet', async () => {
      mockUserModel.findById.mockResolvedValue({
        ...mockUser,
        walletAddress: undefined
      });

      const result = await investmentService.validateInvestment(validationRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User wallet address required');
    });

    it('should fail validation when property not active', async () => {
      mockPropertyModel.findById.mockResolvedValue({
        ...mockProperty,
        status: 'draft'
      });

      const result = await investmentService.validateInvestment(validationRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Property is not available for investment');
    });

    it('should fail validation when insufficient tokens available', async () => {
      const result = await investmentService.validateInvestment({
        ...validationRequest,
        tokenAmount: 10000 // More than available
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Insufficient tokens available. Available: 5000, Requested: 10000');
    });

    it('should fail validation when below minimum investment', async () => {
      const result = await investmentService.validateInvestment({
        ...validationRequest,
        tokenAmount: 0.5 // Only $50, but minimum is $100
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Investment amount below minimum. Minimum: $100, Requested: $50');
    });

    it('should fail validation when compliance limits exceeded', async () => {
      (mockComplianceService as any).checkInvestmentLimits.mockResolvedValue({
        allowed: false,
        reason: 'Daily limit exceeded'
      });

      const result = await investmentService.validateInvestment(validationRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Investment exceeds compliance limits: Daily limit exceeded');
    });

    it('should include warnings for large investments by non-accredited investors', async () => {
      const result = await investmentService.validateInvestment({
        ...validationRequest,
        tokenAmount: 150 // $15,000 investment
      });

      expect(result.warnings).toContain('Large investment amount - accredited investor verification recommended');
    });
  });

  describe('getPortfolio', () => {
    const mockPortfolio = {
      userId: 'user-1',
      totalInvestments: 2,
      totalValue: 2000,
      totalDividends: 100,
      totalReturn: 100,
      returnPercentage: 5,
      investments: [mockInvestment],
      properties: []
    };

    beforeEach(() => {
      mockInvestmentModel.getUserPortfolio.mockResolvedValue(mockPortfolio);
      mockPropertyModel.findByIds.mockResolvedValue([mockProperty]);
    });

    it('should return user portfolio with updated values', async () => {
      await investmentService.getPortfolio('user-1');

      expect(mockInvestmentModel.getUserPortfolio).toHaveBeenCalledWith('user-1');
    });

    it('should update current values based on latest property prices', async () => {
      await investmentService.getPortfolio('user-1');

      // Should have called findByIds to get current property data
      expect(mockPropertyModel.findByIds).toHaveBeenCalledWith(['property-1']);
    });
  });

  describe('getPortfolioPerformance', () => {
    const mockPortfolio = {
      userId: 'user-1',
      totalInvestments: 1,
      totalValue: 1100,
      totalDividends: 50,
      totalReturn: 150,
      returnPercentage: 15,
      investments: [{
        ...mockInvestment,
        currentValue: 1100,
        totalDividendsReceived: 50
      }],
      properties: [mockProperty]
    };

    beforeEach(() => {
      jest.spyOn(investmentService, 'getPortfolio').mockResolvedValue(mockPortfolio);
    });

    it('should calculate portfolio performance metrics', async () => {
      const result = await investmentService.getPortfolioPerformance('user-1');

      expect(result).toHaveProperty('totalReturn');
      expect(result).toHaveProperty('returnPercentage');
      expect(result).toHaveProperty('dividendYield');
      expect(result).toHaveProperty('capitalGains');
      expect(result).toHaveProperty('performanceByProperty');
      expect(result.performanceByProperty).toHaveLength(1);
    });

    it('should calculate correct performance metrics', async () => {
      const result = await investmentService.getPortfolioPerformance('user-1');

      // Total invested: 1000, Current value: 1100, Dividends: 50
      // Total return: (1100 + 50) - 1000 = 150
      // Return percentage: (150 / 1000) * 100 = 15%
      // Dividend yield: (50 / 1000) * 100 = 5%
      // Capital gains: 1100 - 1000 = 100

      expect(result.totalReturn).toBe(150);
      expect(result.returnPercentage).toBe(15);
      expect(result.dividendYield).toBe(5);
      expect(result.capitalGains).toBe(100);
    });
  });

  describe('getInvestmentHistory', () => {
    beforeEach(() => {
      mockInvestmentModel.getUserInvestments.mockResolvedValue([mockInvestment]);
      mockTransactionModel.getUserTransactions.mockResolvedValue({
        transactions: [mockTransaction],
        total: 1
      });
    });

    it('should return investment history', async () => {
      const result = await investmentService.getInvestmentHistory('user-1', 50, 0);

      expect(result).toHaveProperty('investments');
      expect(result).toHaveProperty('transactions');
      expect(result).toHaveProperty('total');
      expect(mockInvestmentModel.getUserInvestments).toHaveBeenCalledWith('user-1');
      expect(mockTransactionModel.getUserTransactions).toHaveBeenCalledWith('user-1', ['investment'], 50, 0);
    });
  });

  describe('updateInvestmentStatus', () => {
    beforeEach(() => {
      mockInvestmentModel.findById.mockResolvedValue(mockInvestment);
      mockInvestmentModel.updateById.mockResolvedValue(mockInvestment);
      mockPropertyModel.findById.mockResolvedValue(mockProperty);
      (mockComplianceService as any).logInvestmentStatusChange.mockResolvedValue(undefined);
    });

    it('should update investment status', async () => {
      const result = await investmentService.updateInvestmentStatus(
        'investment-1',
        'sold' as InvestmentStatus,
        'user-1'
      );

      expect(result).toBeDefined();
      expect(mockInvestmentModel.updateById).toHaveBeenCalledWith('investment-1', { status: 'sold' });
      expect((mockComplianceService as any).logInvestmentStatusChange).toHaveBeenCalled();
    });

    it('should return null when investment not found', async () => {
      mockInvestmentModel.updateById.mockResolvedValue(null);

      const result = await investmentService.updateInvestmentStatus(
        'investment-1',
        'sold' as InvestmentStatus
      );

      expect(result).toBeNull();
    });
  });

  describe('getInvestmentStats', () => {
    const mockStats = {
      totalInvestments: 100,
      totalInvested: 500000,
      totalDividendsPaid: 25000,
      averageInvestmentSize: 5000,
      activeInvestors: 75
    };

    beforeEach(() => {
      mockInvestmentModel.getInvestmentStats.mockResolvedValue(mockStats);
    });

    it('should return investment statistics', async () => {
      const result = await investmentService.getInvestmentStats();

      expect(result).toEqual(mockStats);
      expect(mockInvestmentModel.getInvestmentStats).toHaveBeenCalled();
    });
  });

  describe('updatePortfolioValues', () => {
    const mockInvestments = [
      {
        ...mockInvestment,
        currentValue: 1000
      }
    ];

    beforeEach(() => {
      mockInvestmentModel.getUserInvestments.mockResolvedValue(mockInvestments);
      mockPropertyModel.findById.mockResolvedValue({
        ...mockProperty,
        pricePerToken: 110 // Price increased from 100 to 110
      });
      mockInvestmentModel.updateCurrentValue.mockResolvedValue(mockInvestment);
    });

    it('should update portfolio values when prices change significantly', async () => {
      await investmentService.updatePortfolioValues('user-1');

      expect(mockInvestmentModel.getUserInvestments).toHaveBeenCalledWith('user-1');
      expect(mockPropertyModel.findById).toHaveBeenCalledWith('property-1');
      expect(mockInvestmentModel.updateCurrentValue).toHaveBeenCalledWith('investment-1', 1100);
    });

    it('should not update values for small price changes', async () => {
      mockPropertyModel.findById.mockResolvedValue({
        ...mockProperty,
        pricePerToken: 100.5 // Only 0.5% change
      });

      await investmentService.updatePortfolioValues('user-1');

      expect(mockInvestmentModel.updateCurrentValue).not.toHaveBeenCalled();
    });
  });

  describe('getInvestmentAnalytics', () => {
    const mockPortfolio = {
      userId: 'user-1',
      totalInvestments: 2,
      totalValue: 2200,
      totalDividends: 100,
      totalReturn: 300,
      returnPercentage: 15,
      investments: [
        { ...mockInvestment, totalPurchasePrice: 1000 },
        { ...mockInvestment, id: 'investment-2', totalPurchasePrice: 1000 }
      ],
      properties: [mockProperty]
    };

    const mockPerformance = {
      totalReturn: 300,
      returnPercentage: 15,
      dividendYield: 5,
      capitalGains: 200,
      performanceByProperty: [
        {
          propertyId: 'property-1',
          propertyName: 'Test Property',
          return: 150,
          returnPercentage: 15,
          dividendYield: 5
        }
      ]
    };

    beforeEach(() => {
      jest.spyOn(investmentService, 'getPortfolio').mockResolvedValue(mockPortfolio);
      jest.spyOn(investmentService, 'getPortfolioPerformance').mockResolvedValue(mockPerformance);
    });

    it('should return detailed investment analytics', async () => {
      const result = await investmentService.getInvestmentAnalytics('user-1');

      expect(result).toHaveProperty('totalInvestments', 2);
      expect(result).toHaveProperty('totalValue', 2200);
      expect(result).toHaveProperty('totalReturn', 300);
      expect(result).toHaveProperty('returnPercentage', 15);
      expect(result).toHaveProperty('bestPerformingProperty');
      expect(result).toHaveProperty('worstPerformingProperty');
      expect(result).toHaveProperty('monthlyReturns');
      expect(result).toHaveProperty('diversificationScore');
      expect(result.monthlyReturns).toHaveLength(12);
    });

    it('should calculate diversification score correctly', async () => {
      const result = await investmentService.getInvestmentAnalytics('user-1');

      // With 2 investments of equal size (50% each), diversification should be reasonable
      expect(result.diversificationScore).toBeGreaterThan(0);
      expect(result.diversificationScore).toBeLessThanOrEqual(100);
    });
  });

  describe('notification integration', () => {
    beforeEach(() => {
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockPropertyModel.findById.mockResolvedValue(mockProperty);
      mockTransactionModel.createTransaction.mockResolvedValue(mockTransaction);
      mockTransactionModel.updateTransaction.mockResolvedValue({
        ...mockTransaction,
        status: 'completed' as TransactionStatus
      });
      mockHederaService.transferTokens.mockResolvedValue({
        success: true,
        transactionId: 'hedera-tx-123'
      });
      mockInvestmentModel.getInvestmentByUserAndProperty.mockResolvedValue(null);
      mockInvestmentModel.createInvestment.mockResolvedValue(mockInvestment);
      mockPropertyModel.updateAvailableTokens.mockResolvedValue(mockProperty);
      (mockComplianceService as any).checkInvestmentLimits.mockResolvedValue({ allowed: true });
    });

    it('should send success notification after successful purchase', async () => {
      const validPurchaseRequest: InvestmentPurchaseRequest = {
        userId: 'user-1',
        propertyId: 'property-1',
        tokenAmount: 10,
        paymentMethod: 'card' as PaymentMethod,
        currency: 'USD' as CurrencyCode
      };

      await investmentService.purchaseTokens(validPurchaseRequest);

      expect((mockNotificationService as any).sendNotification).toHaveBeenCalledWith(
        'user-1',
        'investment_confirmation',
        expect.objectContaining({
          propertyName: 'Test Property',
          tokenAmount: 10,
          investmentId: 'investment-1'
        })
      );
    });

    it('should send failure notification when purchase fails', async () => {
      mockHederaService.transferTokens.mockResolvedValue({
        success: false,
        transactionId: '',
        error: 'Blockchain error'
      });

      const validPurchaseRequest: InvestmentPurchaseRequest = {
        userId: 'user-1',
        propertyId: 'property-1',
        tokenAmount: 10,
        paymentMethod: 'card' as PaymentMethod,
        currency: 'USD' as CurrencyCode
      };

      await expect(investmentService.purchaseTokens(validPurchaseRequest))
        .rejects.toThrow('Token transfer failed: Blockchain error');

      expect((mockNotificationService as any).sendNotification).toHaveBeenCalledWith(
        'user-1',
        'investment_confirmation',
        expect.objectContaining({
          propertyName: 'Test Property',
          tokenAmount: 10
        })
      );
    });

    it('should send status update notification when investment status changes', async () => {
      mockInvestmentModel.findById.mockResolvedValue(mockInvestment);
      mockInvestmentModel.updateById.mockResolvedValue({
        ...mockInvestment,
        status: 'sold' as InvestmentStatus
      });

      await investmentService.updateInvestmentStatus('investment-1', 'sold', 'user-1');

      expect((mockNotificationService as any).sendNotification).toHaveBeenCalledWith(
        'user-1',
        'property_update',
        expect.objectContaining({
          propertyName: 'Test Property',
          oldStatus: 'active',
          newStatus: 'sold'
        })
      );
    });
  });
});