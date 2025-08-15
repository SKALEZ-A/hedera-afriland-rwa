import request from 'supertest';
import { app } from '../../../app';
import { testUtils } from '../../setup';

describe('Properties API Integration Tests', () => {
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    // Create test user and get auth token
    testUser = await testUtils.createTestUser({
      email: 'properties-test@example.com',
      roles: ['investor', 'property_manager'],
    });
    authToken = testUtils.generateTestToken(testUser.id);
  });

  beforeEach(async () => {
    await testUtils.cleanTestData();
  });

  describe('GET /api/properties', () => {
    it('should return paginated properties list', async () => {
      // Create test properties
      await testUtils.createTestProperty({ name: 'Property 1', pricePerToken: 100 });
      await testUtils.createTestProperty({ name: 'Property 2', pricePerToken: 150 });
      await testUtils.createTestProperty({ name: 'Property 3', pricePerToken: 200 });

      const response = await request(app)
        .get('/api/properties')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.properties).toHaveLength(2);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        pages: 2,
      });
    });

    it('should filter properties by type', async () => {
      await testUtils.createTestProperty({ name: 'Residential 1', propertyType: 'residential' });
      await testUtils.createTestProperty({ name: 'Commercial 1', propertyType: 'commercial' });

      const response = await request(app)
        .get('/api/properties')
        .query({ propertyType: 'residential' })
        .expect(200);

      expect(response.body.data.properties).toHaveLength(1);
      expect(response.body.data.properties[0].propertyType).toBe('residential');
    });
  });
});