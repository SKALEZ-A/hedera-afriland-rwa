import request from 'supertest';
import { app } from '../../app';
import { testUtils } from '../setup';

describe('End-to-End Investment Flow', () => {
  let investorToken: string;
  let propertyManagerToken: string;
  let testProperty: any;
  let testInvestor: any;
  let testPropertyManager: any;

  beforeAll(async () => {
    // Create test users
    testInvestor = await testUtils.createTestUser({
      email: 'investor-e2e@example.com',
      roles: ['investor'],
      kycStatus: 'approved',
    });

    testPropertyManager = await testUtils.createTestUser({
      email: 'manager-e2e@example.com',
      roles: ['property_manager'],
      kycStatus: 'approved',
    });

    // Generate tokens
    investorToken = testUtils.generateTestToken(testInvestor.id);
    propertyManagerToken = testUtils.generateTestToken(testPropertyManager.id);

    // Create test property
    testProperty = await testUtils.createTestProperty({
      name: 'E2E Test Property',
      totalValuation: 1000000,
      totalTokens: 10000,
      pricePerToken: 100,
      availableTokens: 10000,
      propertyManagerId: testPropertyManager.id,
    });
  });

  beforeEach(async () => {
    // Reset property state for each test
    await testUtils.db().query(
      'UPDATE properties SET available_tokens = total_tokens WHERE id = $1',
      [testProperty.id]
    );
  });

  it('should complete full investment lifecycle', async () => {
    // Step 1: Investor browses properties
    const propertiesResponse = await request(app)
      .get('/api/properties')
      .expect(200);

    expect(propertiesResponse.body.data.properties).toHaveLength(1);
    const property = propertiesResponse.body.data.properties[0];

    // Step 2: Investor views property details
    const propertyDetailResponse = await request(app)
      .get(`/api/properties/${property.id}`)
      .expect(200);

    expect(propertyDetailResponse.body.data.name).toBe('E2E Test Property');
    expect(propertyDetailResponse.body.data.availableTokens).toBe(10000);

    // Step 3: Investor makes investment
    const investmentResponse = await request(app)
      .post('/api/investments/purchase')
      .set('Authorization', `Bearer ${investorToken}`)
      .send({
        propertyId: property.id,
        tokenAmount: 100,
        paymentMethod: 'STRIPE',
        paymentMethodId: 'pm_test_123',
      })
      .expect(201);

    expect(investmentResponse.body.success).toBe(true);
    expect(investmentResponse.body.data.tokenAmount).toBe(100);

    // Step 4: Verify investment in portfolio
    const portfolioResponse = await request(app)
      .get('/api/investments/portfolio')
      .set('Authorization', `Bearer ${investorToken}`)
      .expect(200);

    expect(portfolioResponse.body.data.investments).toHaveLength(1);
    expect(portfolioResponse.body.data.totalInvested).toBe(10000); // 100 tokens * $100

    // Step 5: Property manager records rental income
    const rentalIncomeResponse = await request(app)
      .post(`/api/property-manager/properties/${property.id}/rental-income`)
      .set('Authorization', `Bearer ${propertyManagerToken}`)
      .send({
        amount: 5000,
        period: '2024-01',
        description: 'Monthly rent collection',
      })
      .expect(200);

    expect(rentalIncomeResponse.body.incomeRecord.amount).toBe(5000);
    expect(rentalIncomeResponse.body.distribution.status).toBe('distributed');

    // Step 6: Verify dividend payment in portfolio
    const updatedPortfolioResponse = await request(app)
      .get('/api/investments/portfolio')
      .set('Authorization', `Bearer ${investorToken}`)
      .expect(200);

    const investment = updatedPortfolioResponse.body.data.investments[0];
    expect(investment.totalDividends).toBeGreaterThan(0);

    // Step 7: Investor creates sell order
    const sellOrderResponse = await request(app)
      .post('/api/trading/orders')
      .set('Authorization', `Bearer ${investorToken}`)
      .send({
        tokenId: property.tokenId,
        orderType: 'SELL',
        amount: 50,
        price: 105.00,
      })
      .expect(201);

    expect(sellOrderResponse.body.data.orderType).toBe('SELL');
    expect(sellOrderResponse.body.data.amount).toBe(50);

    // Step 8: Check order book
    const orderBookResponse = await request(app)
      .get(`/api/trading/orderbook/${property.tokenId}`)
      .expect(200);

    expect(orderBookResponse.body.data.sellOrders).toHaveLength(1);
    expect(orderBookResponse.body.data.sellOrders[0].price).toBe(105.00);
  });

  it('should handle investment validation errors', async () => {
    // Test insufficient funds
    const insufficientFundsResponse = await request(app)
      .post('/api/investments/purchase')
      .set('Authorization', `Bearer ${investorToken}`)
      .send({
        propertyId: testProperty.id,
        tokenAmount: 20000, // More than available
        paymentMethod: 'STRIPE',
        paymentMethodId: 'pm_test_123',
      })
      .expect(400);

    expect(insufficientFundsResponse.body.success).toBe(false);
    expect(insufficientFundsResponse.body.error).toContain('insufficient');

    // Test invalid payment method
    const invalidPaymentResponse = await request(app)
      .post('/api/investments/purchase')
      .set('Authorization', `Bearer ${investorToken}`)
      .send({
        propertyId: testProperty.id,
        tokenAmount: 100,
        paymentMethod: 'INVALID',
        paymentMethodId: 'invalid_123',
      })
      .expect(400);

    expect(invalidPaymentResponse.body.success).toBe(false);
  });

  it('should handle property manager operations', async () => {
    // Create investment first
    await testUtils.createTestInvestment(testInvestor.id, testProperty.id, {
      tokenAmount: 200,
      purchasePrice: 20000,
    });

    // Test property manager dashboard
    const dashboardResponse = await request(app)
      .get('/api/property-manager/dashboard')
      .set('Authorization', `Bearer ${propertyManagerToken}`)
      .expect(200);

    expect(dashboardResponse.body.data.properties).toHaveLength(1);
    expect(dashboardResponse.body.data.summary.totalProperties).toBe(1);

    // Test governance proposal creation
    const proposalResponse = await request(app)
      .post(`/api/property-manager/properties/${testProperty.id}/governance/proposals`)
      .set('Authorization', `Bearer ${propertyManagerToken}`)
      .send({
        title: 'Property Renovation Proposal',
        description: 'Proposal to renovate the property lobby',
        proposalType: 'renovation',
        votingPeriod: 7,
      })
      .expect(200);

    expect(proposalResponse.body.title).toBe('Property Renovation Proposal');
    expect(proposalResponse.body.status).toBe('active');

    // Test performance report generation
    const reportResponse = await request(app)
      .get(`/api/property-manager/properties/${testProperty.id}/reports/performance`)
      .set('Authorization', `Bearer ${propertyManagerToken}`)
      .expect(200);

    expect(reportResponse.body.property.id).toBe(testProperty.id);
    expect(reportResponse.body.performance).toBeDefined();
    expect(reportResponse.body.financials).toBeDefined();
  });

  it('should handle trading operations', async () => {
    // Create investment and tokens
    await testUtils.createTestInvestment(testInvestor.id, testProperty.id, {
      tokenAmount: 500,
      purchasePrice: 50000,
    });

    // Create buy order
    const buyOrderResponse = await request(app)
      .post('/api/trading/orders')
      .set('Authorization', `Bearer ${investorToken}`)
      .send({
        tokenId: testProperty.tokenId,
        orderType: 'BUY',
        amount: 100,
        price: 95.00,
      })
      .expect(201);

    expect(buyOrderResponse.body.data.orderType).toBe('BUY');

    // Create sell order
    const sellOrderResponse = await request(app)
      .post('/api/trading/orders')
      .set('Authorization', `Bearer ${investorToken}`)
      .send({
        tokenId: testProperty.tokenId,
        orderType: 'SELL',
        amount: 100,
        price: 105.00,
      })
      .expect(201);

    expect(sellOrderResponse.body.data.orderType).toBe('SELL');

    // Check order book
    const orderBookResponse = await request(app)
      .get(`/api/trading/orderbook/${testProperty.tokenId}`)
      .expect(200);

    expect(orderBookResponse.body.data.buyOrders).toHaveLength(1);
    expect(orderBookResponse.body.data.sellOrders).toHaveLength(1);
    expect(orderBookResponse.body.data.spread).toBe(10.00); // 105 - 95

    // Get trading history
    const historyResponse = await request(app)
      .get(`/api/trading/history/${testProperty.tokenId}`)
      .expect(200);

    expect(Array.isArray(historyResponse.body.data)).toBe(true);
  });

  afterAll(async () => {
    await testUtils.cleanTestData();
  });
});