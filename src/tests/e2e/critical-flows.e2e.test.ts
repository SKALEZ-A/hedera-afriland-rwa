import request from 'supertest'
import { app } from '../../app'
import { testUtils } from '../setup'
import { HederaService } from '../../services/HederaService'

// Mock external services for E2E tests
jest.mock('../../services/HederaService')
jest.mock('stripe')

const mockHederaService = HederaService as jest.Mocked<typeof HederaService>

describe('Critical User Flows E2E Tests', () => {
  beforeAll(async () => {
    // Setup mock responses for external services
    mockHederaService.prototype.createToken = jest.fn().mockResolvedValue({
      tokenId: 'test-token-id',
      transactionId: 'test-tx-id'
    })

    mockHederaService.prototype.transferTokens = jest.fn().mockResolvedValue({
      transactionId: 'test-transfer-tx-id',
      success: true
    })
  })

  afterEach(async () => {
    await testUtils.cleanTestData()
  })

  describe('Complete Investment Journey', () => {
    it('should complete full investor journey from registration to dividend receipt', async () => {
      // Step 1: User Registration
      const userData = {
        email: 'investor@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Investor',
        phoneNumber: '+254700000000'
      }

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)

      expect(registerResponse.body.success).toBe(true)
      const userToken = registerResponse.body.data.token
      const userId = registerResponse.body.data.user.id

      // Step 2: KYC Document Upload
      const kycResponse = await request(app)
        .post('/api/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .field('documentType', 'national_id')
        .attach('document', Buffer.from('fake-id-document'), 'national_id.pdf')
        .expect(200)

      expect(kycResponse.body.success).toBe(true)

      // Step 3: Admin KYC Approval (simulate admin action)
      const adminUser = await testUtils.createTestUser({
        email: 'admin@example.com',
        role: 'admin'
      })
      const adminToken = testUtils.generateTestToken(adminUser.id)

      await request(app)
        .post(`/api/kyc/approve/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true, notes: 'Documents verified' })
        .expect(200)

      // Step 4: Property Manager Creates Property
      const propertyManagerUser = await testUtils.createTestUser({
        email: 'manager@example.com',
        role: 'property_manager'
      })
      const managerToken = testUtils.generateTestToken(propertyManagerUser.id)

      const propertyData = {
        name: 'Riverside Apartments',
        propertyType: 'residential',
        address: {
          addressLine1: '123 Riverside Drive',
          city: 'Nairobi',
          state: 'Nairobi County',
          country: 'Kenya',
          postalCode: '00100'
        },
        totalValuation: 50000000, // 50M KES
        totalTokens: 50000,
        description: 'Modern apartment complex with river views',
        amenities: ['Swimming Pool', 'Gym', 'Parking', 'Security'],
        expectedAnnualReturn: 0.12 // 12%
      }

      const propertyResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(propertyData)
        .expect(201)

      const propertyId = propertyResponse.body.data.id

      // Step 5: Property Tokenization
      const tokenizeResponse = await request(app)
        .post(`/api/properties/${propertyId}/tokenize`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200)

      expect(tokenizeResponse.body.success).toBe(true)
      expect(tokenizeResponse.body.data).toHaveProperty('tokenId')

      // Step 6: User Browses Properties
      const propertiesResponse = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(propertiesResponse.body.data.length).toBeGreaterThan(0)
      const availableProperty = propertiesResponse.body.data.find(
        (p: any) => p.id === propertyId
      )
      expect(availableProperty).toBeDefined()

      // Step 7: User Views Property Details
      const propertyDetailResponse = await request(app)
        .get(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(propertyDetailResponse.body.data.name).toBe(propertyData.name)
      expect(propertyDetailResponse.body.data.availableTokens).toBeGreaterThan(0)

      // Step 8: User Creates Investment
      const investmentData = {
        propertyId,
        tokenAmount: 100, // Buy 100 tokens
        paymentMethod: 'card'
      }

      const investmentResponse = await request(app)
        .post('/api/investments')
        .set('Authorization', `Bearer ${userToken}`)
        .send(investmentData)
        .expect(201)

      const investmentId = investmentResponse.body.data.id
      const paymentId = investmentResponse.body.data.paymentId

      // Step 9: Payment Processing
      const paymentCompleteResponse = await request(app)
        .post(`/api/payments/${paymentId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          paymentIntentId: 'pi_test_successful',
          status: 'succeeded'
        })
        .expect(200)

      expect(paymentCompleteResponse.body.success).toBe(true)

      // Step 10: Verify Investment is Active
      const investmentStatusResponse = await request(app)
        .get(`/api/investments/${investmentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(investmentStatusResponse.body.data.status).toBe('active')
      expect(investmentStatusResponse.body.data.tokenAmount).toBe(100)

      // Step 11: Check Portfolio
      const portfolioResponse = await request(app)
        .get('/api/investments/portfolio')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(portfolioResponse.body.data.totalTokens).toBe(100)
      expect(portfolioResponse.body.data.properties).toHaveLength(1)

      // Step 12: Property Manager Adds Rental Income
      const incomeData = {
        amount: 500000, // 500K KES monthly rent
        currency: 'KES',
        type: 'rental',
        description: 'Monthly rental income - December 2023'
      }

      const incomeResponse = await request(app)
        .post(`/api/properties/${propertyId}/income`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(incomeData)
        .expect(200)

      expect(incomeResponse.body.success).toBe(true)

      // Step 13: Dividend Distribution
      const distributionResponse = await request(app)
        .post(`/api/dividends/distribute/${propertyId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200)

      expect(distributionResponse.body.success).toBe(true)
      expect(distributionResponse.body.data.totalDistributed).toBeGreaterThan(0)

      // Step 14: User Receives Dividend
      const dividendHistoryResponse = await request(app)
        .get('/api/dividends/history')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(dividendHistoryResponse.body.data).toHaveLength(1)
      const dividend = dividendHistoryResponse.body.data[0]
      expect(dividend.amount).toBeGreaterThan(0)
      expect(dividend.propertyId).toBe(propertyId)

      // Step 15: User Views Updated Portfolio
      const updatedPortfolioResponse = await request(app)
        .get('/api/investments/portfolio')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(updatedPortfolioResponse.body.data.totalDividendsReceived).toBeGreaterThan(0)
    })
  })

  describe('Property Manager Journey', () => {
    it('should complete property manager journey from property creation to income distribution', async () => {
      // Step 1: Property Manager Registration
      const managerData = {
        email: 'manager@example.com',
        password: 'ManagerPass123!',
        firstName: 'Jane',
        lastName: 'Manager',
        role: 'property_manager',
        companyName: 'Prime Properties Ltd'
      }

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(managerData)
        .expect(201)

      const managerToken = registerResponse.body.data.token
      const managerId = registerResponse.body.data.user.id

      // Step 2: Manager KYC and Business Verification
      const businessKycResponse = await request(app)
        .post('/api/kyc/business-documents')
        .set('Authorization', `Bearer ${managerToken}`)
        .field('documentType', 'business_license')
        .attach('document', Buffer.from('fake-license'), 'business_license.pdf')
        .expect(200)

      expect(businessKycResponse.body.success).toBe(true)

      // Step 3: Admin Approves Manager
      const adminUser = await testUtils.createTestUser({
        email: 'admin@example.com',
        role: 'admin'
      })
      const adminToken = testUtils.generateTestToken(adminUser.id)

      await request(app)
        .post(`/api/kyc/approve/${managerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true, notes: 'Business verified' })
        .expect(200)

      // Step 4: Create Multiple Properties
      const properties = []
      for (let i = 1; i <= 3; i++) {
        const propertyData = {
          name: `Property Complex ${i}`,
          propertyType: 'residential',
          address: {
            addressLine1: `${i}00 Test Street`,
            city: 'Nairobi',
            country: 'Kenya'
          },
          totalValuation: 30000000 + (i * 10000000),
          totalTokens: 30000 + (i * 10000),
          description: `Modern residential complex ${i}`
        }

        const propertyResponse = await request(app)
          .post('/api/properties')
          .set('Authorization', `Bearer ${managerToken}`)
          .send(propertyData)
          .expect(201)

        properties.push(propertyResponse.body.data)

        // Tokenize each property
        await request(app)
          .post(`/api/properties/${propertyResponse.body.data.id}/tokenize`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200)
      }

      // Step 5: Upload Property Documents
      for (const property of properties) {
        const documentTypes = ['title_deed', 'valuation_report', 'insurance_policy']
        
        for (const docType of documentTypes) {
          await request(app)
            .post(`/api/properties/${property.id}/documents`)
            .set('Authorization', `Bearer ${managerToken}`)
            .field('documentType', docType)
            .attach('document', Buffer.from(`fake-${docType}`), `${docType}.pdf`)
            .expect(200)
        }
      }

      // Step 6: View Manager Dashboard
      const dashboardResponse = await request(app)
        .get('/api/property-manager/dashboard')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200)

      expect(dashboardResponse.body.data.totalProperties).toBe(3)
      expect(dashboardResponse.body.data.totalValuation).toBeGreaterThan(0)

      // Step 7: Add Rental Income to Properties
      for (const property of properties) {
        const incomeData = {
          amount: 400000 + (Math.random() * 200000), // Random income
          currency: 'KES',
          type: 'rental',
          description: 'Monthly rental collection'
        }

        await request(app)
          .post(`/api/properties/${property.id}/income`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send(incomeData)
          .expect(200)
      }

      // Step 8: Create Governance Proposal
      const proposalData = {
        propertyId: properties[0].id,
        title: 'Property Renovation Proposal',
        description: 'Proposal to renovate common areas',
        type: 'maintenance',
        budget: 2000000,
        votingPeriod: 7 // days
      }

      const proposalResponse = await request(app)
        .post('/api/governance/proposals')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(proposalData)
        .expect(201)

      expect(proposalResponse.body.success).toBe(true)

      // Step 9: Distribute Dividends
      for (const property of properties) {
        const distributionResponse = await request(app)
          .post(`/api/dividends/distribute/${property.id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200)

        expect(distributionResponse.body.success).toBe(true)
      }

      // Step 10: View Performance Analytics
      const analyticsResponse = await request(app)
        .get('/api/property-manager/analytics')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200)

      expect(analyticsResponse.body.data).toHaveProperty('totalIncome')
      expect(analyticsResponse.body.data).toHaveProperty('totalDividendsDistributed')
      expect(analyticsResponse.body.data).toHaveProperty('occupancyRates')
    })
  })

  describe('Secondary Market Trading Journey', () => {
    it('should complete secondary market trading flow', async () => {
      // Setup: Create users and property with investments
      const seller = await testUtils.createTestUser({
        email: 'seller@example.com',
        kycStatus: 'approved'
      })
      const buyer = await testUtils.createTestUser({
        email: 'buyer@example.com',
        kycStatus: 'approved'
      })
      const property = await testUtils.createTestProperty()

      const sellerToken = testUtils.generateTestToken(seller.id)
      const buyerToken = testUtils.generateTestToken(buyer.id)

      // Create initial investment for seller
      const investment = await testUtils.createTestInvestment(seller.id, property.id, {
        tokenAmount: 200
      })

      // Step 1: Seller Creates Sell Order
      const sellOrderData = {
        type: 'sell',
        propertyId: property.id,
        tokenAmount: 100,
        pricePerToken: 1050 // 5% premium
      }

      const sellOrderResponse = await request(app)
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(sellOrderData)
        .expect(201)

      const sellOrderId = sellOrderResponse.body.data.orderId

      // Step 2: View Order Book
      const orderBookResponse = await request(app)
        .get(`/api/trading/orderbook/${property.id}`)
        .expect(200)

      expect(orderBookResponse.body.data.sellOrders).toHaveLength(1)
      expect(orderBookResponse.body.data.sellOrders[0].pricePerToken).toBe(1050)

      // Step 3: Buyer Creates Buy Order (matching price)
      const buyOrderData = {
        type: 'buy',
        propertyId: property.id,
        tokenAmount: 100,
        pricePerToken: 1050
      }

      const buyOrderResponse = await request(app)
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send(buyOrderData)
        .expect(201)

      // Step 4: Order Matching and Execution
      // The system should automatically match and execute the trade
      const tradeHistoryResponse = await request(app)
        .get(`/api/trading/history/${property.id}`)
        .expect(200)

      expect(tradeHistoryResponse.body.data).toHaveLength(1)
      const trade = tradeHistoryResponse.body.data[0]
      expect(trade.tokenAmount).toBe(100)
      expect(trade.pricePerToken).toBe(1050)

      // Step 5: Verify Token Transfer
      const sellerPortfolioResponse = await request(app)
        .get('/api/investments/portfolio')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200)

      const buyerPortfolioResponse = await request(app)
        .get('/api/investments/portfolio')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200)

      // Seller should have 100 tokens remaining
      const sellerProperty = sellerPortfolioResponse.body.data.properties.find(
        (p: any) => p.propertyId === property.id
      )
      expect(sellerProperty.tokenAmount).toBe(100)

      // Buyer should have 100 tokens
      const buyerProperty = buyerPortfolioResponse.body.data.properties.find(
        (p: any) => p.propertyId === property.id
      )
      expect(buyerProperty.tokenAmount).toBe(100)

      // Step 6: Payment Settlement
      const sellerTransactionsResponse = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200)

      const saleTransaction = sellerTransactionsResponse.body.data.find(
        (t: any) => t.type === 'token_sale'
      )
      expect(saleTransaction).toBeDefined()
      expect(saleTransaction.amount).toBe(105000) // 100 tokens * 1050 KES
    })
  })

  describe('Error Recovery Flows', () => {
    it('should handle payment failure and recovery', async () => {
      const user = await testUtils.createTestUser({
        email: 'investor@example.com',
        kycStatus: 'approved'
      })
      const property = await testUtils.createTestProperty()
      const userToken = testUtils.generateTestToken(user.id)

      // Step 1: Create Investment
      const investmentData = {
        propertyId: property.id,
        tokenAmount: 50,
        paymentMethod: 'card'
      }

      const investmentResponse = await request(app)
        .post('/api/investments')
        .set('Authorization', `Bearer ${userToken}`)
        .send(investmentData)
        .expect(201)

      const paymentId = investmentResponse.body.data.paymentId

      // Step 2: Simulate Payment Failure
      const paymentFailureResponse = await request(app)
        .post(`/api/payments/${paymentId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          paymentIntentId: 'pi_test_failed',
          status: 'failed',
          error: 'card_declined'
        })
        .expect(400)

      expect(paymentFailureResponse.body.success).toBe(false)

      // Step 3: Retry Payment with Different Method
      const retryPaymentResponse = await request(app)
        .post(`/api/payments/${paymentId}/retry`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          paymentMethod: 'bank_transfer'
        })
        .expect(200)

      expect(retryPaymentResponse.body.success).toBe(true)

      // Step 4: Complete Payment Successfully
      const successfulPaymentResponse = await request(app)
        .post(`/api/payments/${paymentId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          paymentIntentId: 'pi_test_success_retry',
          status: 'succeeded'
        })
        .expect(200)

      expect(successfulPaymentResponse.body.success).toBe(true)
    })

    it('should handle blockchain transaction failures', async () => {
      // Mock blockchain failure
      mockHederaService.prototype.transferTokens = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          transactionId: 'test-retry-tx-id',
          success: true
        })

      const user = await testUtils.createTestUser({
        email: 'investor@example.com',
        kycStatus: 'approved'
      })
      const property = await testUtils.createTestProperty()
      const userToken = testUtils.generateTestToken(user.id)

      // Create investment that will initially fail blockchain transfer
      const investmentData = {
        propertyId: property.id,
        tokenAmount: 25,
        paymentMethod: 'card'
      }

      const investmentResponse = await request(app)
        .post('/api/investments')
        .set('Authorization', `Bearer ${userToken}`)
        .send(investmentData)
        .expect(201)

      const investmentId = investmentResponse.body.data.id
      const paymentId = investmentResponse.body.data.paymentId

      // Complete payment (this should trigger blockchain transfer)
      await request(app)
        .post(`/api/payments/${paymentId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          paymentIntentId: 'pi_test_blockchain_fail',
          status: 'succeeded'
        })
        .expect(200)

      // Check investment status (should be pending due to blockchain failure)
      const investmentStatusResponse = await request(app)
        .get(`/api/investments/${investmentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(investmentStatusResponse.body.data.status).toBe('pending_blockchain')

      // Retry blockchain transaction
      const retryBlockchainResponse = await request(app)
        .post(`/api/investments/${investmentId}/retry-blockchain`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(retryBlockchainResponse.body.success).toBe(true)

      // Verify investment is now active
      const finalStatusResponse = await request(app)
        .get(`/api/investments/${investmentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(finalStatusResponse.body.data.status).toBe('active')
    })
  })
})