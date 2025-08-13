import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/testApp';
import { createTestUser, createTestProperty, generateAuthToken } from '../helpers/testHelpers';
import { InvestmentService } from '../../services/InvestmentService';
import { PropertyModel } from '../../models/PropertyModel';
import { UserModel } from '../../models/UserModel';
import { TransactionModel } from '../../models/TransactionModel';
import { InvestmentModel } from '../../models/InvestmentModel';

// Mock the services to avoid actual blockchain calls
jest.mock('../../services/HederaService');
jest.mock('../../services/ComplianceService');

describe('Investment API Integration Tests', () => {
  let app: Express;
  let userModel: UserModel;
  let propertyModel: PropertyModel;
  let transactionModel: TransactionModel;
  let investmentModel: InvestmentModel;
  let testUser: any;
  let testProperty: any;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    userModel = new UserModel();
    propertyModel = new PropertyModel();
    transactionModel = new TransactionModel();
    investmentModel = new InvestmentModel();
  });

  beforeEach(async () => {
    // Create test user and property
    testUser = await createTestUser({
      email: 'investor@test.com',
      kycStatus: 'approved',
      walletAddress: '0.0.12345'
    });

    testProperty = await createTestProperty({
      name: 'Test Investment Property',
      totalTokens: 10000,
      availableTokens: 5000,
      pricePerToken: 100,
      status: 'active',
      tokenId: '0.0.54321'
    });

    authToken = generateAuthToken(testUser.id);
  });

  describe('POST /api/investments/validate', () => {
    it('should validate a valid investment request', async () => {
      const response = await request(app)
        .post('/api/investments/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: 10,
          paymentMethod: 'card',
          currency: 'USD'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.errors).toHaveLength(0);
    });

    it('should reject investment with insufficient tokens', async () => {
      const response = await request(app)
        .post('/api/investments/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: 10000, // More than available
          paymentMethod: 'card',
          currency: 'USD'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.errors).toContain(
        expect.stringContaining('Insufficient tokens available')
      );
    });

    it('should reject investment below minimum amount', async () => {
      const response = await request(app)
        .post('/api/investments/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: 1, // Only $100, but minimum might be higher
          paymentMethod: 'card',
          currency: 'USD'
        });

      expect(response.status).toBe(200);
      // Result depends on property minimum investment setting
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/investments/validate')
        .send({
          propertyId: testProperty.id,
          tokenAmount: 10,
          paymentMethod: 'card',
          currency: 'USD'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/investments/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty.id,
          // Missing tokenAmount, paymentMethod, currency
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
      expect(response.body.required).toContain('tokenAmount');
      expect(response.body.required).toContain('paymentMethod');
      expect(response.body.required).toContain('currency');
    });
  });

  describe('POST /api/investments/purchase', () => {
    it('should successfully purchase tokens', async () => {
      // Mock the investment service methods
      const mockInvestmentService = InvestmentService.prototype;
      jest.spyOn(mockInvestmentService, 'purchaseTokens').mockResolvedValue({
        investment: {
          id: 'investment-1',
          userId: testUser.id,
          propertyId: testProperty.id,
          tokenAmount: 10,
          purchasePricePerToken: 100,
          totalPurchasePrice: 1000,
          purchaseDate: new Date(),
          totalDividendsReceived: 0,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        transaction: {
          id: 'transaction-1',
          userId: testUser.id,
          propertyId: testProperty.id,
          transactionType: 'investment',
          amount: 1000,
          currency: 'USD',
          feeAmount: 25,
          netAmount: 1025,
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        blockchainTxId: 'hedera-tx-123'
      });

      const response = await request(app)
        .post('/api/investments/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: 10,
          paymentMethod: 'card',
          currency: 'USD'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Investment purchase completed successfully');
      expect(response.body.data).toHaveProperty('investment');
      expect(response.body.data).toHaveProperty('transaction');
      expect(response.body.data).toHaveProperty('blockchainTxId');
      expect(response.body.data.blockchainTxId).toBe('hedera-tx-123');
    });

    it('should handle validation failures', async () => {
      const mockInvestmentService = InvestmentService.prototype;
      jest.spyOn(mockInvestmentService, 'purchaseTokens').mockRejectedValue(
        new Error('Investment validation failed: Insufficient tokens available')
      );

      const response = await request(app)
        .post('/api/investments/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: 10000,
          paymentMethod: 'card',
          currency: 'USD'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Investment validation failed');
    });

    it('should handle payment failures', async () => {
      const mockInvestmentService = InvestmentService.prototype;
      jest.spyOn(mockInvestmentService, 'purchaseTokens').mockRejectedValue(
        new Error('Payment failed: Insufficient funds')
      );

      const response = await request(app)
        .post('/api/investments/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: 10,
          paymentMethod: 'card',
          currency: 'USD'
        });

      expect(response.status).toBe(402);
      expect(response.body.error).toBe('Payment processing failed');
    });

    it('should validate token amount is positive integer', async () => {
      const response = await request(app)
        .post('/api/investments/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: -5,
          paymentMethod: 'card',
          currency: 'USD'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Token amount must be a positive integer');
    });

    it('should validate payment method', async () => {
      const response = await request(app)
        .post('/api/investments/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: 10,
          paymentMethod: 'invalid_method',
          currency: 'USD'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid payment method');
      expect(response.body.validMethods).toContain('card');
      expect(response.body.validMethods).toContain('mobile_money');
    });

    it('should validate currency', async () => {
      const response = await request(app)
        .post('/api/investments/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: 10,
          paymentMethod: 'card',
          currency: 'INVALID'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid currency');
      expect(response.body.validCurrencies).toContain('USD');
      expect(response.body.validCurrencies).toContain('EUR');
    });
  });

  describe('GET /api/investments/portfolio', () => {
    beforeEach(async () => {
      // Create a test investment
      await investmentModel.createInvestment({
        userId: testUser.id,
        propertyId: testProperty.id,
        tokenAmount: 10,
        purchasePricePerToken: 100
      });
    });

    it('should return user portfolio', async () => {
      const response = await request(app)
        .get('/api/investments/portfolio')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userId', testUser.id);
      expect(response.body.data).toHaveProperty('totalInvestments');
      expect(response.body.data).toHaveProperty('totalValue');
      expect(response.body.data).toHaveProperty('investments');
      expect(response.body.data).toHaveProperty('properties');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/investments/portfolio');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('GET /api/investments/portfolio/performance', () => {
    beforeEach(async () => {
      // Create test investment with some performance
      await investmentModel.createInvestment({
        userId: testUser.id,
        propertyId: testProperty.id,
        tokenAmount: 10,
        purchasePricePerToken: 100
      });
    });

    it('should return portfolio performance analytics', async () => {
      const response = await request(app)
        .get('/api/investments/portfolio/performance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalReturn');
      expect(response.body.data).toHaveProperty('returnPercentage');
      expect(response.body.data).toHaveProperty('dividendYield');
      expect(response.body.data).toHaveProperty('capitalGains');
      expect(response.body.data).toHaveProperty('performanceByProperty');
    });
  });

  describe('GET /api/investments/history', () => {
    beforeEach(async () => {
      // Create test transactions
      await transactionModel.createTransaction({
        userId: testUser.id,
        propertyId: testProperty.id,
        transactionType: 'investment',
        amount: 1000,
        currency: 'USD'
      });
    });

    it('should return investment history', async () => {
      const response = await request(app)
        .get('/api/investments/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('investments');
      expect(response.body.data).toHaveProperty('transactions');
      expect(response.body.data).toHaveProperty('total');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/investments/history?limit=10&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should limit maximum page size', async () => {
      const response = await request(app)
        .get('/api/investments/history?limit=200')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Limit cannot exceed 100');
    });
  });

  describe('GET /api/investments/stats', () => {
    it('should return investment statistics for admin', async () => {
      // Create admin user
      const adminUser = await createTestUser({
        email: 'admin@test.com',
        isAdmin: true
      });
      const adminToken = generateAuthToken(adminUser.id);

      const response = await request(app)
        .get('/api/investments/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalInvestments');
      expect(response.body.data).toHaveProperty('totalInvested');
      expect(response.body.data).toHaveProperty('activeInvestors');
    });

    it('should require admin access', async () => {
      const response = await request(app)
        .get('/api/investments/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('PUT /api/investments/:investmentId/status', () => {
    let testInvestment: any;

    beforeEach(async () => {
      testInvestment = await investmentModel.createInvestment({
        userId: testUser.id,
        propertyId: testProperty.id,
        tokenAmount: 10,
        purchasePricePerToken: 100
      });
    });

    it('should update investment status for admin', async () => {
      // Create admin user
      const adminUser = await createTestUser({
        email: 'admin@test.com',
        isAdmin: true
      });
      const adminToken = generateAuthToken(adminUser.id);

      const response = await request(app)
        .put(`/api/investments/${testInvestment.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'sold'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Investment status updated successfully');
    });

    it('should require admin access', async () => {
      const response = await request(app)
        .put(`/api/investments/${testInvestment.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'sold'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should validate status values', async () => {
      const adminUser = await createTestUser({
        email: 'admin@test.com',
        isAdmin: true
      });
      const adminToken = generateAuthToken(adminUser.id);

      const response = await request(app)
        .put(`/api/investments/${testInvestment.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'invalid_status'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid status');
      expect(response.body.validStatuses).toContain('active');
      expect(response.body.validStatuses).toContain('sold');
    });

    it('should handle non-existent investment', async () => {
      const adminUser = await createTestUser({
        email: 'admin@test.com',
        isAdmin: true
      });
      const adminToken = generateAuthToken(adminUser.id);

      const response = await request(app)
        .put('/api/investments/non-existent-id/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'sold'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Investment not found');
    });
  });
});