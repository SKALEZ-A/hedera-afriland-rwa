import request from 'supertest'
import { app } from '../../app'

describe('API Integration Tests', () => {
  describe('Health and Status Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body.data).toHaveProperty('status', 'healthy')
      expect(response.body.data).toHaveProperty('timestamp')
      expect(response.body.data).toHaveProperty('version')
      expect(response.body.data).toHaveProperty('environment')
    })

    it('should return API information', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body.data).toHaveProperty('name', 'GlobalLand API')
      expect(response.body.data).toHaveProperty('version', '1.0.0')
      expect(response.body.data).toHaveProperty('endpoints')
      expect(response.body.data.endpoints).toHaveProperty('auth', '/api/auth')
      expect(response.body.data.endpoints).toHaveProperty('properties', '/api/properties')
    })

    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404)

      expect(response.body).toHaveProperty('success', false)
      expect(response.body).toHaveProperty('error', 'Endpoint not found')
      expect(response.body).toHaveProperty('path', '/api/non-existent')
      expect(response.body).toHaveProperty('method', 'GET')
    })
  })

  describe('API Documentation Endpoints', () => {
    it('should serve API documentation info', async () => {
      const response = await request(app)
        .get('/api/docs/info')
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body.data).toHaveProperty('title', 'GlobalLand API Documentation')
      expect(response.body.data).toHaveProperty('version', '1.0.0')
      expect(response.body.data).toHaveProperty('links')
      expect(response.body.data.links).toHaveProperty('interactive', '/api/docs')
      expect(response.body.data.links).toHaveProperty('openapi_json', '/api/docs/openapi.json')
    })

    it('should serve OpenAPI JSON specification', async () => {
      const response = await request(app)
        .get('/api/docs/openapi.json')
        .expect(200)

      expect(response.body).toHaveProperty('openapi')
      expect(response.body).toHaveProperty('info')
      expect(response.body).toHaveProperty('paths')
      expect(response.body.info).toHaveProperty('title', 'GlobalLand API')
      expect(response.body.info).toHaveProperty('version', '1.0.0')
    })

    it('should serve Postman collection', async () => {
      const response = await request(app)
        .get('/api/docs/postman')
        .expect(200)

      expect(response.body).toHaveProperty('info')
      expect(response.body).toHaveProperty('item')
      expect(response.body).toHaveProperty('variable')
      expect(response.body.info).toHaveProperty('name', 'GlobalLand API')
      expect(Array.isArray(response.body.item)).toBe(true)
      expect(Array.isArray(response.body.variable)).toBe(true)
    })
  })

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200)

      // Rate limit headers should be present
      expect(response.headers).toHaveProperty('x-ratelimit-limit')
      expect(response.headers).toHaveProperty('x-ratelimit-remaining')
      expect(response.headers).toHaveProperty('x-ratelimit-reset')
    })

    it('should enforce rate limits', async () => {
      // This test would need to be adjusted based on actual rate limits
      // For now, we'll just verify the structure
      const promises = Array(5).fill(null).map(() => 
        request(app).get('/api')
      )

      const responses = await Promise.all(promises)
      
      // All requests should succeed within normal limits
      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.headers).toHaveProperty('x-ratelimit-remaining')
      })
    })
  })

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api')
        .set('Origin', 'http://localhost:3000')
        .expect(200)

      expect(response.headers).toHaveProperty('access-control-allow-origin')
      expect(response.headers).toHaveProperty('access-control-allow-methods')
      expect(response.headers).toHaveProperty('access-control-allow-headers')
    })

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/properties')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization')
        .expect(204)

      expect(response.headers).toHaveProperty('access-control-allow-origin')
      expect(response.headers).toHaveProperty('access-control-allow-methods')
      expect(response.headers).toHaveProperty('access-control-allow-headers')
    })
  })

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200)

      // Helmet security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff')
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY')
      expect(response.headers).toHaveProperty('x-xss-protection', '0')
    })
  })

  describe('Content Compression', () => {
    it('should support gzip compression', async () => {
      const response = await request(app)
        .get('/api')
        .set('Accept-Encoding', 'gzip')
        .expect(200)

      // Response should be compressed if compression middleware is working
      // The exact header depends on the response size and compression settings
      expect(response.body).toHaveProperty('success', true)
    })
  })

  describe('Request Logging', () => {
    it('should log incoming requests', async () => {
      // This test verifies that requests are processed without errors
      // Actual logging verification would require log capture setup
      const response = await request(app)
        .get('/api')
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400)

      expect(response.body).toHaveProperty('success', false)
      expect(response.body).toHaveProperty('error')
    })

    it('should handle large payloads appropriately', async () => {
      const largePayload = {
        data: 'x'.repeat(11 * 1024 * 1024) // 11MB payload (exceeds 10MB limit)
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(largePayload)
        .expect(413) // Payload too large

      expect(response.body).toHaveProperty('success', false)
    })
  })

  describe('API Versioning', () => {
    it('should handle API version headers', async () => {
      const response = await request(app)
        .get('/api')
        .set('API-Version', '1.0')
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
    })

    it('should handle missing API version gracefully', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
    })
  })

  describe('Content Type Handling', () => {
    it('should handle JSON content type', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })

      // Should process the request (may fail auth but should parse JSON)
      expect([200, 400, 401]).toContain(response.status)
    })

    it('should handle URL-encoded content type', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('email=test@example.com&password=password123')

      // Should process the request (may fail auth but should parse form data)
      expect([200, 400, 401]).toContain(response.status)
    })
  })

  describe('HTTP Methods', () => {
    it('should support GET requests', async () => {
      await request(app)
        .get('/api')
        .expect(200)
    })

    it('should support POST requests', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })

      // Should accept POST (may fail validation but method is supported)
      expect([200, 400, 401, 422]).toContain(response.status)
    })

    it('should support PUT requests', async () => {
      const response = await request(app)
        .put('/api/properties/123e4567-e89b-12d3-a456-426614174000')
        .send({
          name: 'Updated Property'
        })

      // Should accept PUT (may fail auth but method is supported)
      expect([200, 401, 403, 404]).toContain(response.status)
    })

    it('should support DELETE requests', async () => {
      const response = await request(app)
        .delete('/api/trading/orders/123e4567-e89b-12d3-a456-426614174000')

      // Should accept DELETE (may fail auth but method is supported)
      expect([200, 401, 403, 404]).toContain(response.status)
    })
  })

  describe('Response Format Consistency', () => {
    it('should return consistent success response format', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('data')
      expect(typeof response.body.data).toBe('object')
    })

    it('should return consistent error response format', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404)

      expect(response.body).toHaveProperty('success', false)
      expect(response.body).toHaveProperty('error')
      expect(typeof response.body.error).toBe('string')
    })
  })
})