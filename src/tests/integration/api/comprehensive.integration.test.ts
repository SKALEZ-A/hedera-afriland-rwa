import request from 'supertest'
import { app } from '../../../app'
import { testUtils } from '../../setup'
import jwt from 'jsonwebtoken'

describe('Comprehensive API Integration Tests', () => {
  let userToken: string
  let adminToken: string
  let propertyManagerToken: string
  let testUser: any
  let testProperty: any

  beforeAll(async () => {
    // Create test users with different roles
    testUser = await testUtils.createTestUser({
      email: 'investor@test.com',
      role: 'investor'
    })

    const adminUser = await testUtils.createTestUser({
      email: 'admin@test.com',
      role: 'admin'
    })

    const propertyManagerUser = await testUtils.createTestUser({
      email: 'manager@test.com',
      role: 'property_manager'
    })

    // Generate tokens
    userToken = testUtils.generateTestToken(testUser.id)
    adminToken = testUtils.generateTestToken(adminUser.id)
    propertyManagerToken = testUtils.generateTestToken(propertyManagerUser.id)

    // Create test property
    testProperty = await testUtils.createTestProperty({
      managerId: propertyManagerUser.id
    })
  })

  afterAll(async () => {
    await testUtils.cleanTestData()
  })

  describe('Authentication Flow', () => {
    it('should complete full registration and login flow', async () => {
      const userData = {
        email: 'newuser@test.com',
        password: 'SecurePass123!',
        firstName: 'New',
        lastName: 'User'
      }

      // Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)

      expect(registerResponse.body.success).toBe(true)
      expect(registerResponse.body.data).toHaveProperty('user')
      expect(registerResponse.body.data).toHaveProperty('token')

      // Login with new user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200)

      expect(loginResponse.body.success).toBe(true)
      expect(loginResponse.body.data).toHaveProperty('token')
      expect(loginResponse.body.data).toHaveProperty('refreshToken')

      // Verify token works
      const token = loginResponse.body.data.token
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(profileResponse.body.data.email).toBe(userData.email)
    })

    it('should handle token refresh flow', async () => {
      // Login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        })
        .expect(200)

      const refreshToken = loginResponse.body.data.refreshToken

      // Use refresh token to get new access token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200)

      expect(refreshResponse.body.data).toHaveProperty('token')
      expect(refreshResponse.body.data).toHaveProperty('refreshToken')
    })

    it('should handle logout flow', async () => {
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(logoutResponse.body.success).toBe(true)
    })
  })

  describe('KYC Verification Flow', () => {
    it('should complete KYC document upload and verification', async () => {
      // Upload KYC documents
      const uploadResponse = await request(app)
        .post('/api/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .field('documentType', 'passport')
        .attach('document', Buffer.from('fake-document-data'), 'passport.pdf')
        .expect(200)

      expect(uploadResponse.body.success).toBe(true)
      expect(uploadResponse.body.data).toHaveProperty('documentId')

      // Check KYC status
      const statusResponse = await request(app)
        .get('/api/kyc/status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(statusResponse.body.data).toHaveProperty('status')
      expect(statusResponse.body.data).toHaveProperty('documents')
    })

    it('should handle KYC approval by admin', async () => {
      // Admin approves KYC
      const approvalResponse = await request(app)
        .post(`/api/kyc/approve/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true, notes: 'Documents verified' })
        .expect(200)

      expect(approvalResponse.body.success).toBe(true)

      // Verify user status updated
      const userResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(userResponse.body.data.kycStatus).toBe('approved')
    })
  })

  describe('Property Management Flow', () => {
    it('should complete property listing and tokenization', async () => {
      const propertyData = {
        name: 'Test Apartment Complex',
        propertyType: 'residential',
        address: {
          addressLine1: '123 Test Street',
          city: 'Nairobi',
          country: 'Kenya'
        },
        totalValuation: 50000000,
        totalTokens: 50000,
        description: 'Modern apartment complex in prime location'
      }

      // Property manager creates property
      const createResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send(propertyData)
        .expect(201)

      expect(createResponse.body.success).toBe(true)
      expect(createResponse.body.data).toHaveProperty('id')

      const propertyId = createResponse.body.data.id

      // Upload property documents
      const docResponse = await request(app)
        .post(`/api/properties/${propertyId}/documents`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .field('documentType', 'title_deed')
        .attach('document', Buffer.from('fake-deed-data'), 'title_deed.pdf')
        .expect(200)

      expect(docResponse.body.success).toBe(true)

      // Tokenize property
      const tokenizeResponse = await request(app)
        .post(`/api/properties/${propertyId}/tokenize`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(200)

      expect(tokenizeResponse.body.success).toBe(true)
      expect(tokenizeResponse.body.data).toHaveProperty('tokenId')
    })

    it('should handle property valuation updates', async () => {
      const valuationResponse = await request(app)
        .post(`/api/properties/${testProperty.id}/valuation`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send({
          newValuation: 55000000,
          reason: 'Market appreciation'
        })
        .expect(200)

      expect(valuationResponse.body.success).toBe(true)
      expect(valuationResponse.body.data.totalValuation).toBe(55000000)
    })
  })

  describe('Investment Flow', () => {
    it('should complete full investment purchase flow', async () => {
      const investmentData = {
        propertyId: testProperty.id,
        tokenAmount: 100,
        paymentMethod: 'card'
      }

      // Create investment
      const investResponse = await request(app)
        .post('/api/investments')
        .set('Authorization', `Bearer ${userToken}`)
        .send(investmentData)
        .expect(201)

      expect(investResponse.body.success).toBe(true)
      expect(investResponse.body.data).toHaveProperty('id')
      expect(investResponse.body.data).toHaveProperty('paymentId')

      const investmentId = investResponse.body.data.id
      const paymentId = investResponse.body.data.paymentId

      // Simulate payment completion
      const paymentResponse = await request(app)
        .post(`/api/payments/${paymentId}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ 
          paymentIntentId: 'pi_test_123',
          status: 'succeeded'
        })
        .expect(200)

      expect(paymentResponse.body.success).toBe(true)

      // Verify investment is active
      const investmentStatusResponse = await request(app)
        .get(`/api/investments/${investmentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(investmentStatusResponse.body.data.status).toBe('active')
    })

    it('should calculate and display portfolio correctly', async () => {
      const portfolioResponse = await request(app)
        .get('/api/investments/portfolio')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(portfolioResponse.body.success).toBe(true)
      expect(portfolioResponse.body.data).toHaveProperty('totalValue')
      expect(portfolioResponse.body.data).toHaveProperty('totalTokens')
      expect(portfolioResponse.body.data).toHaveProperty('properties')
      expect(Array.isArray(portfolioResponse.body.data.properties)).toBe(true)
    })
  })

  describe('Payment Processing Flow', () => {
    it('should handle multiple payment methods', async () => {
      const paymentMethods = ['card', 'bank_transfer', 'mobile_money']

      for (const method of paymentMethods) {
        const paymentResponse = await request(app)
          .post('/api/payments/create')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            amount: 10000,
            currency: 'KES',
            paymentMethod: method,
            propertyId: testProperty.id,
            tokenAmount: 10
          })
          .expect(200)

        expect(paymentResponse.body.success).toBe(true)
        expect(paymentResponse.body.data).toHaveProperty('paymentId')
      }
    })

    it('should handle payment webhooks', async () => {
      // Simulate Stripe webhook
      const webhookResponse = await request(app)
        .post('/api/payments/webhook/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test_webhook',
              status: 'succeeded',
              metadata: {
                userId: testUser.id,
                propertyId: testProperty.id
              }
            }
          }
        })
        .expect(200)

      expect(webhookResponse.body.success).toBe(true)
    })
  })

  describe('Dividend Distribution Flow', () => {
    it('should calculate and distribute dividends', async () => {
      // Property manager adds rental income
      const incomeResponse = await request(app)
        .post(`/api/properties/${testProperty.id}/income`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send({
          amount: 500000,
          currency: 'KES',
          type: 'rental',
          description: 'Monthly rental income'
        })
        .expect(200)

      expect(incomeResponse.body.success).toBe(true)

      // Trigger dividend distribution
      const distributionResponse = await request(app)
        .post(`/api/dividends/distribute/${testProperty.id}`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(200)

      expect(distributionResponse.body.success).toBe(true)
      expect(distributionResponse.body.data).toHaveProperty('totalDistributed')
      expect(distributionResponse.body.data).toHaveProperty('recipientCount')

      // Check user received dividend
      const dividendResponse = await request(app)
        .get('/api/dividends/history')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(dividendResponse.body.success).toBe(true)
      expect(Array.isArray(dividendResponse.body.data)).toBe(true)
    })
  })

  describe('Trading Flow', () => {
    it('should handle secondary market trading', async () => {
      // Create sell order
      const sellOrderResponse = await request(app)
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'sell',
          propertyId: testProperty.id,
          tokenAmount: 50,
          pricePerToken: 1100
        })
        .expect(201)

      expect(sellOrderResponse.body.success).toBe(true)
      expect(sellOrderResponse.body.data).toHaveProperty('orderId')

      const orderId = sellOrderResponse.body.data.orderId

      // Check order book
      const orderBookResponse = await request(app)
        .get(`/api/trading/orderbook/${testProperty.id}`)
        .expect(200)

      expect(orderBookResponse.body.success).toBe(true)
      expect(orderBookResponse.body.data).toHaveProperty('sellOrders')
      expect(orderBookResponse.body.data).toHaveProperty('buyOrders')

      // Cancel order
      const cancelResponse = await request(app)
        .delete(`/api/trading/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(cancelResponse.body.success).toBe(true)
    })
  })

  describe('Notification Flow', () => {
    it('should send and receive notifications', async () => {
      // Send test notification
      const notificationResponse = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          type: 'investment_update',
          title: 'Test Notification',
          message: 'This is a test notification',
          data: { propertyId: testProperty.id }
        })
        .expect(200)

      expect(notificationResponse.body.success).toBe(true)

      // Get user notifications
      const userNotificationsResponse = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(userNotificationsResponse.body.success).toBe(true)
      expect(Array.isArray(userNotificationsResponse.body.data)).toBe(true)

      // Mark notification as read
      const notificationId = userNotificationsResponse.body.data[0].id
      const markReadResponse = await request(app)
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(markReadResponse.body.success).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      // No token
      await request(app)
        .get('/api/auth/profile')
        .expect(401)

      // Invalid token
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      // Expired token
      const expiredToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      )

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401)
    })

    it('should handle authorization errors', async () => {
      // User trying to access admin endpoint
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)

      // User trying to manage property they don't own
      await request(app)
        .post(`/api/properties/${testProperty.id}/income`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 1000, type: 'rental' })
        .expect(403)
    })

    it('should handle validation errors', async () => {
      // Invalid email format
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400)

      // Missing required fields
      await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send({
          name: 'Test Property'
          // Missing required fields
        })
        .expect(400)
    })

    it('should handle not found errors', async () => {
      // Non-existent property
      await request(app)
        .get('/api/properties/non-existent-id')
        .expect(404)

      // Non-existent investment
      await request(app)
        .get('/api/investments/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404)
    })

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const promises = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      )

      const responses = await Promise.all(promises)
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now()
      
      // Make 50 concurrent requests
      const promises = Array(50).fill(null).map(() =>
        request(app)
          .get('/api/properties')
          .expect(200)
      )

      await Promise.all(promises)
      
      const duration = Date.now() - startTime
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000) // 5 seconds
    })

    it('should handle large data sets efficiently', async () => {
      // Create multiple properties
      const properties = await Promise.all(
        Array(20).fill(null).map(() =>
          testUtils.createTestProperty()
        )
      )

      const startTime = Date.now()
      
      const response = await request(app)
        .get('/api/properties?limit=100')
        .expect(200)

      const duration = Date.now() - startTime
      
      expect(response.body.data.length).toBeGreaterThanOrEqual(20)
      expect(duration).toBeLessThan(2000) // 2 seconds
    })
  })
})