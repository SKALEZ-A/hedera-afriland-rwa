import { DividendService } from '../../services/DividendService';
import { Distribution } from '../../types/entities';

// Mock dependencies
jest.mock('../services/HederaService');
jest.mock('../models/InvestmentModel');
jest.mock('../models/PropertyModel');
jest.mock('../models/TransactionModel');

describe('DividendService', () => {
  let dividendService: DividendService;

  beforeEach(() => {
    dividendService = new DividendService();
    jest.clearAllMocks();
  });

  describe('calculateDistribution', () => {
    it('should calculate dividend distribution correctly', async () => {
      // Mock property data
      const mockProperty = {
        id: 'prop123',
        tokenId: 'token123',
        managementFee: 0.02, // 2%
        name: 'Test Property'
      };

      // Mock investments
      const mockInvestments = [
        { userId: 'user1', tokenAmount: 100, user: { walletAddress: 'wallet1' } },
        { userId: 'user2', tokenAmount: 200, user: { walletAddress: 'wallet2' } },
        { userId: 'user3', tokenAmount: 50, user: { walletAddress: 'wallet3' } }
      ];

      // Mock the model methods
      const mockPropertyModel = require('../../models/PropertyModel').PropertyModel;
      const mockInvestmentModel = require('../../models/InvestmentModel').InvestmentModel;
      
      mockPropertyModel.prototype.findByTokenId.mockResolvedValue(mockProperty);
      mockInvestmentModel.prototype.findByPropertyId.mockResolvedValue(mockInvestments);

      const totalIncome = 1000;
      const distributions = await dividendService.calculateDistribution('token123', totalIncome);

      // Verify calculations
      expect(distributions).toHaveLength(3);
      
      // Total tokens = 100 + 200 + 50 = 350
      // Management fee = 1000 * 0.02 = 20
      // Distributable = 1000 - 20 = 980
      // Per token = 980 / 350 = 2.8
      
      expect(distributions[0].dividendAmount).toBeCloseTo(280); // 100 * 2.8
      expect(distributions[1].dividendAmount).toBeCloseTo(560); // 200 * 2.8
      expect(distributions[2].dividendAmount).toBeCloseTo(140); // 50 * 2.8

      // Verify all distributions have required fields
      distributions.forEach(dist => {
        expect(dist).toHaveProperty('userId');
        expect(dist).toHaveProperty('walletAddress');
        expect(dist).toHaveProperty('tokenAmount');
        expect(dist).toHaveProperty('dividendAmount');
        expect(dist).toHaveProperty('currency');
        expect(dist).toHaveProperty('status', 'PENDING');
      });
    });

    it('should handle property not found', async () => {
      const mockPropertyModel = require('../../models/PropertyModel').PropertyModel;
      mockPropertyModel.prototype.findByTokenId.mockResolvedValue(null);

      await expect(
        dividendService.calculateDistribution('nonexistent', 1000)
      ).rejects.toThrow('Property not found for token nonexistent');
    });

    it('should handle no investments', async () => {
      const mockProperty = { id: 'prop123', tokenId: 'token123', managementFee: 0.01 };
      const mockPropertyModel = require('../../models/PropertyModel').PropertyModel;
      const mockInvestmentModel = require('../../models/InvestmentModel').InvestmentModel;
      
      mockPropertyModel.prototype.findByTokenId.mockResolvedValue(mockProperty);
      mockInvestmentModel.prototype.findByPropertyId.mockResolvedValue([]);

      const distributions = await dividendService.calculateDistribution('token123', 1000);
      expect(distributions).toHaveLength(0);
    });
  });

  describe('setManagementFees', () => {
    it('should set management fees successfully', async () => {
      const mockProperty = { id: 'prop123', tokenId: 'token123' };
      const mockPropertyModel = require('../../models/PropertyModel').PropertyModel;
      
      mockPropertyModel.prototype.findByTokenId.mockResolvedValue(mockProperty);
      mockPropertyModel.prototype.updateManagementFee.mockResolvedValue(true);

      await expect(
        dividendService.setManagementFees('token123', 0.025)
      ).resolves.not.toThrow();

      expect(mockPropertyModel.prototype.updateManagementFee).toHaveBeenCalledWith('prop123', 0.025);
    });

    it('should reject invalid fee percentage', async () => {
      await expect(
        dividendService.setManagementFees('token123', 0.15) // 15% - too high
      ).rejects.toThrow('Management fee must be between 0% and 10%');

      await expect(
        dividendService.setManagementFees('token123', -0.01) // Negative
      ).rejects.toThrow('Management fee must be between 0% and 10%');
    });
  });

  describe('calculateProjectedDividends', () => {
    it('should calculate projected dividends from historical data', async () => {
      const mockProperty = {
        id: 'prop123',
        tokenId: 'token123',
        pricePerToken: 100,
        expectedYield: 0.08
      };

      const mockHistory = [
        { totalAmount: 1000, recipientCount: 100 }, // $10 per token
        { totalAmount: 1200, recipientCount: 120 }  // $10 per token
      ];

      const mockPropertyModel = require('../../models/PropertyModel').PropertyModel;
      mockPropertyModel.prototype.findByTokenId.mockResolvedValue(mockProperty);
      
      // Mock getDistributionHistory
      jest.spyOn(dividendService, 'getDistributionHistory').mockResolvedValue(mockHistory as any);

      const projection = await dividendService.calculateProjectedDividends('token123', 50, 12);

      // Average monthly dividend per token = ((1000/100) + (1200/120)) / 2 = (10 + 10) / 2 = 10
      // For 50 tokens = 50 * 10 = 500 monthly
      expect(projection.monthlyDividend).toBeCloseTo(500);
      expect(projection.annualDividend).toBeCloseTo(6000);
      
      // Investment amount = 50 * 100 = 5000
      // Yield = 6000 / 5000 = 1.2 (120%)
      expect(projection.projectedYield).toBeCloseTo(1.2);
    });

    it('should use expected yield when no historical data', async () => {
      const mockProperty = {
        id: 'prop123',
        tokenId: 'token123',
        pricePerToken: 100,
        expectedYield: 0.08 // 8%
      };

      const mockPropertyModel = require('../../models/PropertyModel').PropertyModel;
      mockPropertyModel.prototype.findByTokenId.mockResolvedValue(mockProperty);
      
      jest.spyOn(dividendService, 'getDistributionHistory').mockResolvedValue([]);

      const projection = await dividendService.calculateProjectedDividends('token123', 50, 12);

      // Monthly dividend per token = (100 * 0.08) / 12 = 0.667
      // For 50 tokens = 50 * 0.667 = 33.33 monthly
      expect(projection.monthlyDividend).toBeCloseTo(33.33, 1);
      expect(projection.annualDividend).toBeCloseTo(400);
      expect(projection.projectedYield).toBeCloseTo(0.08);
    });
  });

  describe('getPendingDividends', () => {
    it('should return pending dividends for user', async () => {
      const mockInvestments = [
        { propertyId: 'prop1', userId: 'user1' },
        { propertyId: 'prop2', userId: 'user1' }
      ];

      const mockUnclaimedTx1 = [
        { amount: 100 },
        { amount: 50 }
      ];

      const mockUnclaimedTx2 = [
        { amount: 200 }
      ];

      const mockProperties = [
        { id: 'prop1', name: 'Property 1', tokenId: 'token1' },
        { id: 'prop2', name: 'Property 2', tokenId: 'token2' }
      ];

      const mockInvestmentModel = require('../../models/InvestmentModel').InvestmentModel;
      const mockTransactionModel = require('../../models/TransactionModel').TransactionModel;
      const mockPropertyModel = require('../../models/PropertyModel').PropertyModel;

      mockInvestmentModel.prototype.findByUserId.mockResolvedValue(mockInvestments);
      mockTransactionModel.prototype.findUnclaimed
        .mockResolvedValueOnce(mockUnclaimedTx1)
        .mockResolvedValueOnce(mockUnclaimedTx2);
      mockPropertyModel.prototype.findById
        .mockResolvedValueOnce(mockProperties[0])
        .mockResolvedValueOnce(mockProperties[1]);
      mockTransactionModel.prototype.getLastDistributionDate
        .mockResolvedValue(new Date('2024-01-01'));

      const result = await dividendService.getPendingDividends('user1');

      expect(result.totalPending).toBe(350); // 150 + 200
      expect(result.byProperty).toHaveLength(2);
      expect(result.byProperty[0].pendingAmount).toBe(150);
      expect(result.byProperty[1].pendingAmount).toBe(200);
    });
  });
});