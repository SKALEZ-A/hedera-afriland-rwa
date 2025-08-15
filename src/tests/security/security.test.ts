import request from 'supertest'
import { app } from '../../app'
import { testUtils } from '../setup'
import jwt from 'jsonwebtoken'

describe('Security Tests', () => {
  let userToken: string
  let adminToken: string
  let testUser: any
  let testProperty: any

  beforeAll(async () => {
    testUser = await testUtils.createTestUser({
      email: 'user@test.com',
      kycStatus: 'approved'
    })

    const adminUser = await testUtils.createTestUser({
      email: 'admin@test.com',
      role: 'admin'
    })

    userToken = testUtils.generateTestToken(testUser.id)
    adminToken = testUtils.generateTestToken(adminUser.id)

    testProperty = await testUtils.createTestProperty()
  })

  afterAll(async () => {
    await testUtils.cleanTestData()
  })

  describe('Authentication Security', () => {
    it('should reject requests without authentication token', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/auth/profile' },
        { method: 'get', path: '/api/investments/portfolio' },
        { method: 'post', path: '/api/investments' },
        { method: 'get', path: '/api/dividends/history' }
      ]

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method as 'get' | 'post'](endpoint.path)
        expect(response.status).toBe(401)
        expect(response.body.error).toContain('authentication')
      }
    })

    it('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'invalid-token',
        'Bearer invalid-token',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'Bearer ' + 'a'.repeat(200), // Very long token
        'Bearer ', // Empty token
        'Bearer null',
        'Bearer undefined'
      ]

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', token)

        expect(response.status).toBe(401)
      }
    })

    it('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      )

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)

      expect(response.status).toBe(401)
      expect(response.body.error).toContain('expired')
    })

    it('should reject tokens with invalid signatures', async () => {
      const invalidToken = jwt.sign(
        { userId: testUser.id },
        'wrong-secret',
        { expiresIn: '1h' }
      )

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${invalidToken}`)

      expect(response.status).toBe(401)
    })

    it('should implement proper session management', async () => {
      // Login to get tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        })

      const { token, refreshToken } = loginResponse.body.data

      // Use token successfully
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      // Logout should invalidate tokens
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      // Token should no longer work after logout
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401)
    })
  })

  describe('Authorization Security', () => {
    it('should enforce role-based access control', async () => {
      const adminOnlyEndpoints = [
        { method: 'get', path: '/api/admin/users' },
        { method: 'post', path: `/api/kyc/approve/${testUser.id}` },
        { method: 'get', path: '/api/admin/analytics' }
      ]

      for (const endpoint of adminOnlyEndpoints) {
        // User should be denied access
        const userResponse = await request(app)[endpoint.method as 'get' | 'post'](endpoint.path)
          .set('Authorization', `Bearer ${userToken}`)

        expect(userResponse.status).toBe(403)

        // Admin should have access
        const adminResponse = await request(app)[endpoint.method as 'get' | 'post'](endpoint.path)
          .set('Authorization', `Bearer ${adminToken}`)

        expect([200, 201, 404]).toContain(adminResponse.status) // 404 is OK if endpoint doesn't exist
      }
    })

    it('should prevent users from accessing other users\' data', async () => {
      const otherUser = await testUtils.createTestUser({
        email: 'other@test.com'
      })
      const otherUserToken = testUtils.generateTestToken(otherUser.id)

      // Create investment for other user
      const otherInvestment = await testUtils.createTestInvestment(
        otherUser.id,
        testProperty.id
      )

      // User should not be able to access other user's investment
      const response = await request(app)
        .get(`/api/investments/${otherInvestment.id}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(response.status).toBe(403)
    })

    it('should validate resource ownership', async () => {
      const propertyManager = await testUtils.createTestUser({
        email: 'manager@test.com',
        role: 'property_manager'
      })
      const managerToken = testUtils.generateTestToken(propertyManager.id)

      // Manager should not be able to manage properties they don't own
      const response = await request(app)
        .post(`/api/properties/${testProperty.id}/income`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          amount: 100000,
          type: 'rental',
          description: 'Test income'
        })

      expect(response.status).toBe(403)
    })
  })

  describe('Input Validation Security', () => {
    it('should prevent SQL injection attacks', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
        "' UNION SELECT * FROM users --",
        "'; UPDATE users SET role='admin' WHERE id=1; --"
      ]

      for (const payload of sqlInjectionPayloads) {
        // Test in login endpoint
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'password'
          })

        expect(loginResponse.status).toBe(400) // Should be validation error, not 500

        // Test in search endpoint
        const searchResponse = await request(app)
          .get('/api/properties/search')
          .query({ name: payload })

        expect([400, 422]).toContain(searchResponse.status)
      }
    })

    it('should prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '"><script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')"></svg>'
      ]

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'password123',
            firstName: payload,
            lastName: 'User'
          })

        // Should either reject the input or sanitize it
        if (response.status === 201) {
          expect(response.body.data.user.firstName).not.toContain('<script>')
          expect(response.body.data.user.firstName).not.toContain('javascript:')
        } else {
          expect(response.status).toBe(400)
        }
      }
    })

    it('should validate input lengths and formats', async () => {
      // Test extremely long inputs
      const longString = 'a'.repeat(10000)
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: longString + '@example.com',
          password: 'password123',
          firstName: longString,
          lastName: 'User'
        })

      expect(response.status).toBe(400)

      // Test invalid email formats
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..user@example.com',
        'user@example',
        ''
      ]

      for (const email of invalidEmails) {
        const emailResponse = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            password: 'password123',
            firstName: 'Test',
            lastName: 'User'
          })

        expect(emailResponse.status).toBe(400)
      }
    })

    it('should prevent NoSQL injection attacks', async () => {
      const noSqlPayloads = [
        { $ne: null },
        { $gt: '' },
        { $where: 'function() { return true; }' },
        { $regex: '.*' },
        { $or: [{ email: 'admin@example.com' }, { role: 'admin' }] }
      ]

      for (const payload of noSqlPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'password'
          })

        expect(response.status).toBe(400)
      }
    })
  })

  describe('Rate Limiting Security', () => {
    it('should implement rate limiting on authentication endpoints', async () => {
      const maxAttempts = 10
      const promises = []

      // Make multiple rapid login attempts
      for (let i = 0; i < maxAttempts + 5; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'nonexistent@example.com',
              password: 'wrongpassword'
            })
        )
      }

      const responses = await Promise.all(promises)
      const rateLimitedResponses = responses.filter(r => r.status === 429)

      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })

    it('should implement rate limiting on API endpoints', async () => {
      const promises = []

      // Make many rapid requests to API endpoint
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .get('/api/properties')
        )
      }

      const responses = await Promise.all(promises)
      const rateLimitedResponses = responses.filter(r => r.status === 429)

      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Data Security', () => {
    it('should not expose sensitive data in API responses', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      const userData = response.body.data

      // Should not expose password hash or other sensitive fields
      expect(userData).not.toHaveProperty('password')
      expect(userData).not.toHaveProperty('passwordHash')
      expect(userData).not.toHaveProperty('privateKey')
      expect(userData).not.toHaveProperty('secret')
    })

    it('should properly sanitize error messages', async () => {
      // Try to access non-existent resource
      const response = await request(app)
        .get('/api/investments/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(response.status).toBe(404)
      
      // Error message should not expose internal details
      expect(response.body.error).not.toContain('SELECT')
      expect(response.body.error).not.toContain('database')
      expect(response.body.error).not.toContain('table')
      expect(response.body.error).not.toContain('column')
    })

    it('should implement proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/properties')
        .set('Origin', 'https://malicious-site.com')

      // Should have proper CORS headers
      expect(response.headers).toHaveProperty('access-control-allow-origin')
      
      // Should not allow all origins in production
      if (process.env.NODE_ENV === 'production') {
        expect(response.headers['access-control-allow-origin']).not.toBe('*')
      }
    })
  })

  describe('File Upload Security', () => {
    it('should validate file types for KYC documents', async () => {
      const maliciousFiles = [
        { filename: 'malware.exe', content: 'MZ\x90\x00' }, // PE header
        { filename: 'script.js', content: 'alert("XSS")' },
        { filename: 'shell.php', content: '<?php system($_GET["cmd"]); ?>' },
        { filename: 'large.pdf', content: 'a'.repeat(50 * 1024 * 1024) } // 50MB file
      ]

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/kyc/documents')
          .set('Authorization', `Bearer ${userToken}`)
          .field('documentType', 'passport')
          .attach('document', Buffer.from(file.content), file.filename)

        expect(response.status).toBe(400)
        expect(response.body.error).toContain('file')
      }
    })

    it('should scan uploaded files for malware signatures', async () => {
      // Test with EICAR test string (standard antivirus test)
      const eicarString = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
      
      const response = await request(app)
        .post('/api/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .field('documentType', 'passport')
        .attach('document', Buffer.from(eicarString), 'test.pdf')

      // Should reject malicious content
      expect(response.status).toBe(400)
    })
  })

  describe('API Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/properties')

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options')
      expect(response.headers['x-content-type-options']).toBe('nosniff')

      expect(response.headers).toHaveProperty('x-frame-options')
      expect(response.headers['x-frame-options']).toBe('DENY')

      expect(response.headers).toHaveProperty('x-xss-protection')
      expect(response.headers['x-xss-protection']).toBe('1; mode=block')

      if (process.env.NODE_ENV === 'production') {
        expect(response.headers).toHaveProperty('strict-transport-security')
      }
    })

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/properties')

      // Should not expose server details
      expect(response.headers).not.toHaveProperty('server')
      expect(response.headers).not.toHaveProperty('x-powered-by')
    })
  })

  describe('Business Logic Security', () => {
    it('should prevent investment amount manipulation', async () => {
      // Try to invest with negative amount
      const negativeResponse = await request(app)
        .post('/api/investments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: -100,
          paymentMethod: 'card'
        })

      expect(negativeResponse.status).toBe(400)

      // Try to invest with zero amount
      const zeroResponse = await request(app)
        .post('/api/investments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: 0,
          paymentMethod: 'card'
        })

      expect(zeroResponse.status).toBe(400)

      // Try to invest more than available tokens
      const excessiveResponse = await request(app)
        .post('/api/investments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          propertyId: testProperty.id,
          tokenAmount: 999999999,
          paymentMethod: 'card'
        })

      expect(excessiveResponse.status).toBe(400)
    })

    it('should prevent price manipulation in trading', async () => {
      // Create investment first
      await testUtils.createTestInvestment(testUser.id, testProperty.id, {
        tokenAmount: 100
      })

      // Try to create sell order with negative price
      const negativePrice = await request(app)
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'sell',
          propertyId: testProperty.id,
          tokenAmount: 50,
          pricePerToken: -1000
        })

      expect(negativePrice.status).toBe(400)

      // Try to create order with unrealistic price
      const unrealisticPrice = await request(app)
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'sell',
          propertyId: testProperty.id,
          tokenAmount: 50,
          pricePerToken: 999999999
        })

      expect(unrealisticPrice.status).toBe(400)
    })

    it('should prevent dividend manipulation', async () => {
      const propertyManager = await testUtils.createTestUser({
        email: 'manager@test.com',
        role: 'property_manager'
      })
      const managerToken = testUtils.generateTestToken(propertyManager.id)

      // Try to add negative income
      const negativeIncome = await request(app)
        .post(`/api/properties/${testProperty.id}/income`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          amount: -100000,
          type: 'rental',
          description: 'Negative income'
        })

      expect(negativeIncome.status).toBe(400)

      // Try to distribute dividends without sufficient income
      const excessiveDividend = await request(app)
        .post(`/api/dividends/distribute/${testProperty.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          amount: 999999999
        })

      expect(excessiveDividend.status).toBe(400)
    })
  })

  describe('Blockchain Security', () => {
    it('should validate blockchain transaction signatures', async () => {
      // Test with invalid transaction data
      const invalidTx = await request(app)
        .post('/api/blockchain/verify-transaction')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transactionId: 'invalid-tx-id',
          signature: 'invalid-signature',
          data: 'tampered-data'
        })

      expect(invalidTx.status).toBe(400)
    })

    it('should prevent replay attacks', async () => {
      // This would test nonce validation and transaction uniqueness
      const txData = {
        from: 'test-account-1',
        to: 'test-account-2',
        amount: 100,
        nonce: 1
      }

      // First transaction should succeed (mocked)
      const firstTx = await request(app)
        .post('/api/blockchain/submit-transaction')
        .set('Authorization', `Bearer ${userToken}`)
        .send(txData)

      // Second identical transaction should fail
      const replayTx = await request(app)
        .post('/api/blockchain/submit-transaction')
        .set('Authorization', `Bearer ${userToken}`)
        .send(txData)

      expect(replayTx.status).toBe(400)
      expect(replayTx.body.error).toContain('nonce')
    })
  })
})