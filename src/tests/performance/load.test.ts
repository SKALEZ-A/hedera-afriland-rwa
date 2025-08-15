import { performance } from 'perf_hooks';
import request from 'supertest';
import { app } from '../../app';
import { testUtils } from '../setup';

describe('Performance Load Tests', () => {
  let authTokens: string[] = [];
  let testProperties: any[] = [];

  beforeAll(async () => {
    // Create multiple test users and properties for load testing
    const userPromises = Array.from({ length: 10 }, (_, i) =>
      testUtils.createTestUser({
        email: `load-test-user-${i}@example.com`,
        roles: ['investor'],
      })
    );

    const users = await Promise.all(userPromises);
    authTokens = users.map(user => testUtils.generateTestToken(user.id));

    // Create test properties
    const propertyPromises = Array.from({ length: 5 }, (_, i) =>
      testUtils.createTestProperty({
        name: `Load Test Property ${i}`,
        totalValuation: 1000000 + (i * 100000),
        totalTokens: 10000,
        pricePerToken: 100 + (i * 10),
      })
    );

    testProperties = await Promise.all(propertyPromises);
  });

  afterAll(async () => {
    await testUtils.cleanTestData();
  });

  describe('API Endpoint Performance', () => {
    it('should handle concurrent property list requests', async () => {
      const concurrentRequests = 50;
      const startTime = performance.now();

      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/properties')
          .query({ page: 1, limit: 20 })
          .expect(200)
      );

      const responses = await Promise.all(requests);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageResponseTime = totalTime / concurrentRequests;

      // Assertions
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.properties).toBeDefined();
      });

      // Performance assertions
      expect(averageResponseTime).toBeLessThan(500); // Average response time < 500ms
      expect(totalTime).toBeLessThan(5000); // Total time < 5 seconds

      console.log(`Concurrent requests: ${concurrentRequests}`);
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`Average response time: ${averageResponseTime.toFixed(2)}ms`);
    });

    it('should handle concurrent investment purchases', async () => {
      const concurrentInvestments = 20;
      const property = testProperties[0];
      const startTime = performance.now();

      const investmentRequests = Array.from({ length: concurrentInvestments }, (_, i) =>
        request(app)
          .post('/api/investments/purchase')
          .set('Authorization', `Bearer ${authTokens[i % authTokens.length]}`)
          .send({
            propertyId: property.id,
            tokenAmount: 10,
            paymentMethod: 'STRIPE',
            paymentMethodId: `pm_test_${i}`,
          })
      );

      const responses = await Promise.allSettled(investmentRequests);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Count successful vs failed requests
      const successful = responses.filter(r => r.status === 'fulfilled').length;
      const failed = responses.filter(r => r.status === 'rejected').length;

      console.log(`Concurrent investments: ${concurrentInvestments}`);
      console.log(`Successful: ${successful}, Failed: ${failed}`);
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);

      // At least 80% should succeed (accounting for race conditions)
      expect(successful / concurrentInvestments).toBeGreaterThan(0.8);
      expect(totalTime).toBeLessThan(10000); // Total time < 10 seconds
    });

    it('should handle portfolio requests under load', async () => {
      // First create some investments
      const setupPromises = authTokens.slice(0, 5).map((token, i) =>
        testUtils.createTestInvestment(
          testUtils.getUserIdFromToken(token),
          testProperties[i % testProperties.length].id,
          { tokenAmount: 100, purchasePrice: 10000 }
        )
      );
      await Promise.all(setupPromises);

      const concurrentRequests = 30;
      const startTime = performance.now();

      const portfolioRequests = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app)
          .get('/api/investments/portfolio')
          .set('Authorization', `Bearer ${authTokens[i % authTokens.length]}`)
          .expect(200)
      );

      const responses = await Promise.all(portfolioRequests);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageResponseTime = totalTime / concurrentRequests;

      // Verify responses
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.investments).toBeDefined();
      });

      // Performance assertions
      expect(averageResponseTime).toBeLessThan(800); // Average response time < 800ms
      expect(totalTime).toBeLessThan(8000); // Total time < 8 seconds

      console.log(`Portfolio requests: ${concurrentRequests}`);
      console.log(`Average response time: ${averageResponseTime.toFixed(2)}ms`);
    });
  });

  describe('Database Performance', () => {
    it('should handle bulk property queries efficiently', async () => {
      const queryCount = 100;
      const startTime = performance.now();

      const queries = Array.from({ length: queryCount }, () =>
        testUtils.db().query('SELECT * FROM properties WHERE status = $1 LIMIT 10', ['active'])
      );

      const results = await Promise.all(queries);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageQueryTime = totalTime / queryCount;

      // Verify results
      expect(results).toHaveLength(queryCount);
      results.forEach(result => {
        expect(result.rows).toBeDefined();
      });

      // Performance assertions
      expect(averageQueryTime).toBeLessThan(50); // Average query time < 50ms
      expect(totalTime).toBeLessThan(3000); // Total time < 3 seconds

      console.log(`Database queries: ${queryCount}`);
      console.log(`Average query time: ${averageQueryTime.toFixed(2)}ms`);
    });

    it('should handle complex aggregation queries efficiently', async () => {
      const startTime = performance.now();

      const complexQuery = `
        SELECT 
          p.id,
          p.name,
          p.total_valuation,
          COUNT(i.id) as investor_count,
          SUM(i.token_amount) as total_tokens_sold,
          AVG(i.purchase_price / i.token_amount) as avg_purchase_price
        FROM properties p
        LEFT JOIN investments i ON p.id = i.property_id
        WHERE p.status = 'active'
        GROUP BY p.id, p.name, p.total_valuation
        ORDER BY total_tokens_sold DESC
        LIMIT 20
      `;

      const result = await testUtils.db().query(complexQuery);
      const endTime = performance.now();
      const queryTime = endTime - startTime;

      // Verify result
      expect(result.rows).toBeDefined();
      expect(Array.isArray(result.rows)).toBe(true);

      // Performance assertion
      expect(queryTime).toBeLessThan(1000); // Query time < 1 second

      console.log(`Complex aggregation query time: ${queryTime.toFixed(2)}ms`);
      console.log(`Results returned: ${result.rows.length}`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not have memory leaks during sustained load', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 100;

      // Simulate sustained load
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/api/properties')
          .query({ page: Math.floor(i / 20) + 1, limit: 20 });

        // Force garbage collection every 25 iterations
        if (i % 25 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      console.log(`Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory increase: ${memoryIncreasePercent.toFixed(2)}%`);

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);
    });

    it('should handle large response payloads efficiently', async () => {
      // Create a large number of properties for testing
      const largePropertyCount = 100;
      const createPromises = Array.from({ length: largePropertyCount }, (_, i) =>
        testUtils.createTestProperty({
          name: `Large Test Property ${i}`,
          description: 'A'.repeat(1000), // Large description
        })
      );

      await Promise.all(createPromises);

      const startTime = performance.now();
      const response = await request(app)
        .get('/api/properties')
        .query({ limit: largePropertyCount })
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Verify large response
      expect(response.body.data.properties).toHaveLength(largePropertyCount);
      
      // Performance assertion for large payload
      expect(responseTime).toBeLessThan(2000); // Response time < 2 seconds

      console.log(`Large payload response time: ${responseTime.toFixed(2)}ms`);
      console.log(`Payload size: ~${JSON.stringify(response.body).length} characters`);
    });
  });

  describe('Stress Testing', () => {
    it('should maintain performance under extreme load', async () => {
      const extremeLoad = 200;
      const maxConcurrency = 20;
      const batches = Math.ceil(extremeLoad / maxConcurrency);
      
      const startTime = performance.now();
      let totalSuccessful = 0;
      let totalFailed = 0;

      // Process requests in batches to avoid overwhelming the system
      for (let batch = 0; batch < batches; batch++) {
        const batchSize = Math.min(maxConcurrency, extremeLoad - (batch * maxConcurrency));
        
        const batchRequests = Array.from({ length: batchSize }, (_, i) =>
          request(app)
            .get('/api/properties')
            .query({ page: (batch * maxConcurrency + i) % 10 + 1, limit: 10 })
            .timeout(5000) // 5 second timeout
        );

        const batchResults = await Promise.allSettled(batchRequests);
        
        totalSuccessful += batchResults.filter(r => r.status === 'fulfilled').length;
        totalFailed += batchResults.filter(r => r.status === 'rejected').length;

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const successRate = (totalSuccessful / extremeLoad) * 100;

      console.log(`Extreme load test: ${extremeLoad} requests`);
      console.log(`Successful: ${totalSuccessful}, Failed: ${totalFailed}`);
      console.log(`Success rate: ${successRate.toFixed(2)}%`);
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);

      // Under extreme load, we expect at least 90% success rate
      expect(successRate).toBeGreaterThan(90);
      expect(totalTime).toBeLessThan(30000); // Total time < 30 seconds
    });
  });

  // Helper function to extract user ID from JWT token (for testing)
  function getUserIdFromToken(token: string): string {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    return decoded.userId;
  }
});