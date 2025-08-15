import request from 'supertest'
import { app } from '../../app'
import { testUtils } from '../setup'
import { performance } from 'perf_hooks'

describe('Comprehensive Performance Tests', () => {
  let userTokens: string[] = []
  let testProperties: any[] = []
  let adminToken: string

  beforeAll(async () => {
    // Create multiple test users
    const users = await Promise.all(
      Array(50).fill(null).map((_, index) =>
        testUtils.createTestUser({
          email: `user${index}@test.com`,
          kycStatus: 'approved'
        })
      )
    )

    userTokens = users.map(user => testUtils.generateTestToken(user.id))

    // Create admin user
    const adminUser = await testUtils.createTestUser({
      email: 'admin@test.com',
      role: 'admin'
    })
    adminToken = testUtils.generateTestToken(adminUser.id)

    // Create test properties
    testProperties = await Promise.all(
      Array(20).fill(null).map(() => testUtils.createTestProperty())
    )
  })

  afterAll(async () => {
    await testUtils.cleanTestData()
  })

  describe('API Endpoint Performance', () => {
    it('should handle high concurrent property listing requests', async () => {
      const concurrentRequests = 100
      const startTime = performance.now()

      const promises = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .get('/api/properties')
          .expect(200)
      )

      const responses = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      // All requests should succeed
      expect(responses.every(r => r.status === 200)).toBe(true)
      
      // Should complete within reasonable time (adjust based on requirements)
      expect(duration).toBeLessThan(5000) // 5 seconds
      
      // Calculate average response time
      const avgResponseTime = duration / concurrentRequests
      expect(avgResponseTime).toBeLessThan(100) // 100ms average

      console.log(`Property listing: ${concurrentRequests} requests in ${duration.toFixed(2)}ms`)
      console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`)
    })

    it('should handle concurrent user authentication requests', async () => {
      const concurrentLogins = 50
      const startTime = performance.now()

      const promises = Array(concurrentLogins).fill(null).map((_, index) =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: `user${index}@test.com`,
            password: 'password123'
          })
      )

      const responses = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      // Most requests should succeed (some might fail due to rate limiting)
      const successfulLogins = responses.filter(r => r.status === 200).length
      expect(successfulLogins).toBeGreaterThan(concurrentLogins * 0.8) // At least 80% success

      console.log(`Authentication: ${successfulLogins}/${concurrentLogins} successful in ${duration.toFixed(2)}ms`)
    })

    it('should handle concurrent investment creation requests', async () => {
      const concurrentInvestments = 30
      const startTime = performance.now()

      const promises = Array(concurrentInvestments).fill(null).map((_, index) =>
        request(app)
          .post('/api/investments')
          .set('Authorization', `Bearer ${userTokens[index % userTokens.length]}`)
          .send({
            propertyId: testProperties[index % testProperties.length].id,
            tokenAmount: 10,
            paymentMethod: 'card'
          })
      )

      const responses = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      const successfulInvestments = responses.filter(r => r.status === 201).length
      expect(successfulInvestments).toBeGreaterThan(0)

      console.log(`Investments: ${successfulInvestments}/${concurrentInvestments} created in ${duration.toFixed(2)}ms`)
    })

    it('should handle large portfolio queries efficiently', async () => {
      // Create many investments for a single user
      const userId = userTokens[0]
      const investmentPromises = Array(100).fill(null).map((_, index) =>
        testUtils.createTestInvestment(
          userId.split('.')[1], // Extract user ID from token (simplified)
          testProperties[index % testProperties.length].id,
          { tokenAmount: Math.floor(Math.random() * 50) + 1 }
        )
      )

      await Promise.all(investmentPromises)

      const startTime = performance.now()
      
      const portfolioResponse = await request(app)
        .get('/api/investments/portfolio')
        .set('Authorization', `Bearer ${userId}`)
        .expect(200)

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(portfolioResponse.body.data.properties.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(1000) // Should complete within 1 second

      console.log(`Large portfolio query: ${duration.toFixed(2)}ms`)
    })
  })

  describe('Database Performance', () => {
    it('should handle complex property search queries efficiently', async () => {
      const searchQueries = [
        { propertyType: 'residential', minPrice: 1000000, maxPrice: 50000000 },
        { location: 'Nairobi', minTokens: 1000 },
        { expectedReturn: 0.1, propertyType: 'commercial' },
        { sortBy: 'totalValuation', order: 'desc', limit: 50 }
      ]

      const startTime = performance.now()

      const promises = searchQueries.map(query =>
        request(app)
          .get('/api/properties/search')
          .query(query)
          .expect(200)
      )

      const responses = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(responses.every(r => r.status === 200)).toBe(true)
      expect(duration).toBeLessThan(2000) // 2 seconds for all complex queries

      console.log(`Complex search queries: ${duration.toFixed(2)}ms`)
    })

    it('should handle bulk dividend calculations efficiently', async () => {
      // Create many investments across multiple properties
      const bulkInvestments = []
      for (let i = 0; i < 200; i++) {
        bulkInvestments.push(
          testUtils.createTestInvestment(
            userTokens[i % userTokens.length].split('.')[1],
            testProperties[i % testProperties.length].id,
            { tokenAmount: Math.floor(Math.random() * 100) + 1 }
          )
        )
      }

      await Promise.all(bulkInvestments)

      const startTime = performance.now()

      // Trigger dividend calculation for all properties
      const distributionPromises = testProperties.map(property =>
        request(app)
          .post(`/api/dividends/calculate/${property.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ amount: 100000 })
      )

      await Promise.all(distributionPromises)
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(10000) // 10 seconds for bulk calculations

      console.log(`Bulk dividend calculations: ${duration.toFixed(2)}ms`)
    })
  })

  describe('Memory and Resource Usage', () => {
    it('should handle memory efficiently during large data operations', async () => {
      const initialMemory = process.memoryUsage()

      // Perform memory-intensive operations
      const largeDataPromises = Array(50).fill(null).map(() =>
        request(app)
          .get('/api/properties?limit=100&includeAnalytics=true')
          .expect(200)
      )

      await Promise.all(largeDataPromises)

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
    })

    it('should handle concurrent WebSocket connections efficiently', async () => {
      // This would test WebSocket performance if implemented
      // For now, we'll test HTTP long-polling or similar
      
      const concurrentConnections = 20
      const startTime = performance.now()

      const promises = Array(concurrentConnections).fill(null).map((_, index) =>
        request(app)
          .get('/api/notifications/stream')
          .set('Authorization', `Bearer ${userTokens[index % userTokens.length]}`)
          .timeout(1000) // 1 second timeout
      )

      // Some connections might timeout, which is expected
      const responses = await Promise.allSettled(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      const successfulConnections = responses.filter(
        r => r.status === 'fulfilled'
      ).length

      console.log(`WebSocket-like connections: ${successfulConnections}/${concurrentConnections} in ${duration.toFixed(2)}ms`)
    })
  })

  describe('Blockchain Performance', () => {
    it('should handle multiple token operations efficiently', async () => {
      // Mock multiple blockchain operations
      const tokenOperations = 20
      const startTime = performance.now()

      const promises = Array(tokenOperations).fill(null).map((_, index) =>
        request(app)
          .post('/api/blockchain/token-transfer')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            fromAccount: 'test-account-1',
            toAccount: 'test-account-2',
            tokenId: testProperties[index % testProperties.length].tokenId,
            amount: 10
          })
      )

      // These might fail due to mocking, but we're testing the API layer
      const responses = await Promise.allSettled(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      console.log(`Blockchain operations: ${tokenOperations} operations in ${duration.toFixed(2)}ms`)
      
      // Should complete within reasonable time even with failures
      expect(duration).toBeLessThan(15000) // 15 seconds
    })
  })

  describe('Stress Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const testDuration = 30000 // 30 seconds
      const requestInterval = 100 // 100ms between requests
      const startTime = performance.now()
      let requestCount = 0
      let successCount = 0
      let errorCount = 0

      const makeRequest = async () => {
        try {
          const response = await request(app)
            .get('/api/properties')
            .timeout(5000)

          requestCount++
          if (response.status === 200) {
            successCount++
          } else {
            errorCount++
          }
        } catch (error) {
          requestCount++
          errorCount++
        }
      }

      // Start sustained load
      const interval = setInterval(makeRequest, requestInterval)

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration))
      clearInterval(interval)

      const endTime = performance.now()
      const actualDuration = endTime - startTime

      const successRate = (successCount / requestCount) * 100
      const requestsPerSecond = (requestCount / actualDuration) * 1000

      console.log(`Stress test results:`)
      console.log(`  Duration: ${actualDuration.toFixed(2)}ms`)
      console.log(`  Total requests: ${requestCount}`)
      console.log(`  Success rate: ${successRate.toFixed(2)}%`)
      console.log(`  Requests/second: ${requestsPerSecond.toFixed(2)}`)
      console.log(`  Errors: ${errorCount}`)

      // Should maintain reasonable success rate under load
      expect(successRate).toBeGreaterThan(80) // 80% success rate
      expect(requestsPerSecond).toBeGreaterThan(5) // At least 5 RPS
    })

    it('should recover gracefully from overload conditions', async () => {
      // Simulate overload with burst of requests
      const burstSize = 200
      const startTime = performance.now()

      const burstPromises = Array(burstSize).fill(null).map(() =>
        request(app)
          .get('/api/properties')
          .timeout(10000)
      )

      const responses = await Promise.allSettled(burstPromises)
      const endTime = performance.now()
      const duration = endTime - startTime

      const successful = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 200
      ).length

      const rateLimited = responses.filter(r =>
        r.status === 'fulfilled' && (r.value as any).status === 429
      ).length

      const failed = responses.filter(r => r.status === 'rejected').length

      console.log(`Overload recovery test:`)
      console.log(`  Successful: ${successful}`)
      console.log(`  Rate limited: ${rateLimited}`)
      console.log(`  Failed: ${failed}`)
      console.log(`  Duration: ${duration.toFixed(2)}ms`)

      // System should handle overload gracefully with rate limiting
      expect(rateLimited).toBeGreaterThan(0) // Rate limiting should kick in
      expect(successful + rateLimited).toBeGreaterThan(burstSize * 0.7) // 70% handled
    })
  })

  describe('Performance Benchmarks', () => {
    it('should meet response time SLAs', async () => {
      const endpoints = [
        { path: '/api/properties', method: 'GET', sla: 500 },
        { path: '/api/auth/profile', method: 'GET', sla: 200, auth: true },
        { path: '/api/investments/portfolio', method: 'GET', sla: 1000, auth: true },
        { path: '/api/dividends/history', method: 'GET', sla: 800, auth: true }
      ]

      for (const endpoint of endpoints) {
        const startTime = performance.now()
        
        let requestBuilder = request(app)[endpoint.method.toLowerCase() as 'get'](endpoint.path)
        
        if (endpoint.auth) {
          requestBuilder = requestBuilder.set('Authorization', `Bearer ${userTokens[0]}`)
        }

        const response = await requestBuilder.expect(200)
        
        const endTime = performance.now()
        const duration = endTime - startTime

        console.log(`${endpoint.method} ${endpoint.path}: ${duration.toFixed(2)}ms (SLA: ${endpoint.sla}ms)`)
        
        expect(duration).toBeLessThan(endpoint.sla)
        expect(response.body.success).toBe(true)
      }
    })

    it('should handle database connection pooling efficiently', async () => {
      // Test concurrent database operations
      const concurrentDbOps = 50
      const startTime = performance.now()

      const promises = Array(concurrentDbOps).fill(null).map((_, index) =>
        request(app)
          .get(`/api/properties/${testProperties[index % testProperties.length].id}`)
          .expect(200)
      )

      const responses = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(responses.every(r => r.status === 200)).toBe(true)
      expect(duration).toBeLessThan(3000) // 3 seconds for 50 DB operations

      console.log(`Database pooling test: ${concurrentDbOps} operations in ${duration.toFixed(2)}ms`)
    })
  })
})