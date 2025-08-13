import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/testApp';
import { createTestUser, createTestProperty, getAuthToken } from '../helpers/testHelpers';
import { PropertyModel } from '../../models/PropertyModel';
import { PropertyDocumentService } from '../../services/PropertyDocumentService';

describe('Property API Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let adminToken: string;
  let propertyManagerToken: string;
  let testUserId: string;
  let adminUserId: string;
  let propertyManagerId: string;
  let testPropertyId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Create test users
    const testUser = await createTestUser({
      email: 'investor@test.com',
      kycStatus: 'approved'
    });
    testUserId = testUser.id;
    authToken = await getAuthToken(testUser.email);

    const adminUser = await createTestUser({
      email: 'admin@test.com',
      role: 'admin',
      kycStatus: 'approved'
    });
    adminUserId = adminUser.id;
    adminToken = await getAuthToken(adminUser.email);

    const propertyManager = await createTestUser({
      email: 'manager@test.com',
      role: 'property_manager',
      kycStatus: 'approved'
    });
    propertyManagerId = propertyManager.id;
    propertyManagerToken = await getAuthToken(propertyManager.email);

    // Create test property
    const testProperty = await createTestProperty({
      propertyManagerId
    });
    testPropertyId = testProperty.id;
  });

  describe('POST /api/properties/register', () => {
    const validPropertyData = {
      name: 'Test Property Registration',
      description: 'A test property for registration',
      propertyType: 'residential',
      address: {
        addressLine1: '123 Test Street',
        city: 'Test City',
        country: 'USA',
        postalCode: '12345'
      },
      totalValuation: 1000000,
      totalTokens: 10000,
      pricePerToken: 100,
      minimumInvestment: 100,
      expectedAnnualYield: 8.5,
      propertySize: 150,
      yearBuilt: 2020,
      managementFeePercentage: 1.5,
      platformFeePercentage: 2.5
    };

    it('should successfully register property as admin', async () => {
      const response = await request(app)
        .post('/api/properties/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validPropertyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.property).toBeDefined();
      expect(response.body.data.property.name).toBe(validPropertyData.name);
      expect(response.body.data.property.status).toBe('draft');
    });

    it('should successfully register property as property manager', async () => {
      const response = await request(app)
        .post('/api/properties/register')
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send({
          ...validPropertyData,
          name: 'Property Manager Test Property'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.property.name).toBe('Property Manager Test Property');
    });

    it('should fail without authentication', async () => {
      await request(app)
        .post('/api/properties/register')
        .send(validPropertyData)
        .expect(401);
    });

    it('should fail with insufficient permissions', async () => {
      await request(app)
        .post('/api/properties/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPropertyData)
        .expect(403);
    });

    it('should fail with invalid property data', async () => {
      const invalidData = {
        ...validPropertyData,
        name: '', // Empty name
        totalValuation: -1000 // Negative valuation
      };

      const response = await request(app)
        .post('/api/properties/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Property name is required');
      expect(response.body.errors).toContain('Total valuation must be greater than 0');
    });

    it('should fail with token economics mismatch', async () => {
      const invalidData = {
        ...validPropertyData,
        totalValuation: 1000000,
        totalTokens: 10000,
        pricePerToken: 200 // This makes total value 2,000,000 instead of 1,000,000
      };

      const response = await request(app)
        .post('/api/properties/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Token economics mismatch: total tokens × price per token should equal total valuation');
    });
  });

  describe('GET /api/properties/search', () => {
    it('should return properties without authentication', async () => {
      const response = await request(app)
        .get('/api/properties/search')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.properties).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.total).toBeDefined();
    });

    it('should filter properties by country', async () => {
      const response = await request(app)
        .get('/api/properties/search?country=USA')
        .expect(200);

      expect(response.body.success).toBe(true);
      // All returned properties should be in USA
      response.body.data.properties.forEach((property: any) => {
        expect(property.address.country).toBe('USA');
      });
    });

    it('should filter properties by type', async () => {
      const response = await request(app)
        .get('/api/properties/search?propertyType=residential')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.properties.forEach((property: any) => {
        expect(property.propertyType).toBe('residential');
      });
    });

    it('should apply pagination correctly', async () => {
      const response = await request(app)
        .get('/api/properties/search?limit=5&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.properties.length).toBeLessThanOrEqual(5);
      expect(response.body.data.pagination.limit).toBe(5);
      expect(response.body.data.pagination.page).toBe(1);
    });

    it('should apply price range filters', async () => {
      const response = await request(app)
        .get('/api/properties/search?minPrice=50&maxPrice=150')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.properties.forEach((property: any) => {
        expect(property.pricePerToken).toBeGreaterThanOrEqual(50);
        expect(property.pricePerToken).toBeLessThanOrEqual(150);
      });
    });
  });

  describe('GET /api/properties/:propertyId', () => {
    it('should return property details', async () => {
      const response = await request(app)
        .get(`/api/properties/${testPropertyId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.property).toBeDefined();
      expect(response.body.data.property.id).toBe(testPropertyId);
    });

    it('should return 404 for non-existent property', async () => {
      const response = await request(app)
        .get('/api/properties/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Property not found');
    });
  });

  describe('PUT /api/properties/:propertyId/status', () => {
    it('should update property status as admin', async () => {
      const response = await request(app)
        .put(`/api/properties/${testPropertyId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'pending_verification',
          reason: 'Ready for verification'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.property.status).toBe('pending_verification');
    });

    it('should fail with invalid status', async () => {
      const response = await request(app)
        .put(`/api/properties/${testPropertyId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'invalid_status'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid status provided');
    });

    it('should fail without proper permissions', async () => {
      await request(app)
        .put(`/api/properties/${testPropertyId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'active'
        })
        .expect(403);
    });
  });

  describe('PUT /api/properties/:propertyId/valuation', () => {
    it('should update property valuation as admin', async () => {
      const response = await request(app)
        .put(`/api/properties/${testPropertyId}/valuation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newValuation: 1200000,
          valuationDate: new Date().toISOString(),
          valuationMethod: 'professional_appraisal',
          valuationProvider: 'Test Appraiser',
          notes: 'Updated valuation based on market conditions'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.property).toBeDefined();
    });

    it('should fail with invalid valuation amount', async () => {
      const response = await request(app)
        .put(`/api/properties/${testPropertyId}/valuation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newValuation: -1000,
          valuationMethod: 'professional_appraisal'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid valuation amount');
    });
  });

  describe('GET /api/properties/:propertyId/performance', () => {
    it('should return property performance metrics', async () => {
      const response = await request(app)
        .get(`/api/properties/${testPropertyId}/performance`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.performance).toBeDefined();
      expect(response.body.data.performance.propertyId).toBe(testPropertyId);
      expect(response.body.data.performance.totalInvestors).toBeDefined();
      expect(response.body.data.performance.totalInvested).toBeDefined();
    });

    it('should accept date range parameters', async () => {
      const startDate = new Date('2023-01-01').toISOString();
      const endDate = new Date('2023-12-31').toISOString();

      const response = await request(app)
        .get(`/api/properties/${testPropertyId}/performance?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.performance.performancePeriod).toBeDefined();
    });

    it('should return 404 for non-existent property', async () => {
      const response = await request(app)
        .get('/api/properties/non-existent-id/performance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Property not found');
    });
  });

  describe('GET /api/properties/statistics', () => {
    it('should return property statistics as admin', async () => {
      const response = await request(app)
        .get('/api/properties/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics).toBeDefined();
      expect(response.body.data.statistics.totalProperties).toBeDefined();
      expect(response.body.data.statistics.activeProperties).toBeDefined();
      expect(response.body.data.statistics.propertiesByType).toBeDefined();
      expect(response.body.data.statistics.propertiesByCountry).toBeDefined();
    });

    it('should fail without admin permissions', async () => {
      await request(app)
        .get('/api/properties/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('POST /api/properties/:propertyId/tokenize', () => {
    it('should initiate tokenization as admin', async () => {
      // First update property status to be ready for tokenization
      await request(app)
        .put(`/api/properties/${testPropertyId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'pending_verification' });

      const response = await request(app)
        .post(`/api/properties/${testPropertyId}/tokenize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tokenName: 'Test Property Token',
          tokenSymbol: 'TPT'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokenId).toBeDefined();
      expect(response.body.data.transactionId).toBeDefined();
    });

    it('should respect rate limiting', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post(`/api/properties/${testPropertyId}/tokenize`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            tokenName: 'Test Token',
            tokenSymbol: 'TEST'
          })
      );

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited (429)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Document Management', () => {
    let documentId: string;

    describe('POST /api/properties/:propertyId/documents', () => {
      it('should upload documents as property manager', async () => {
        const response = await request(app)
          .post(`/api/properties/${testPropertyId}/documents`)
          .set('Authorization', `Bearer ${propertyManagerToken}`)
          .field('documentType', 'deed')
          .attach('documents', Buffer.from('test document content'), 'test-deed.pdf')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.results).toBeDefined();
        expect(response.body.data.results[0].success).toBe(true);
        expect(response.body.data.results[0].document).toBeDefined();
        
        documentId = response.body.data.results[0].document.id;
      });

      it('should fail with unsupported file type', async () => {
        const response = await request(app)
          .post(`/api/properties/${testPropertyId}/documents`)
          .set('Authorization', `Bearer ${propertyManagerToken}`)
          .field('documentType', 'deed')
          .attach('documents', Buffer.from('test content'), 'test.exe')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('File type not supported');
      });

      it('should fail without proper permissions', async () => {
        await request(app)
          .post(`/api/properties/${testPropertyId}/documents`)
          .set('Authorization', `Bearer ${authToken}`)
          .field('documentType', 'deed')
          .attach('documents', Buffer.from('test content'), 'test.pdf')
          .expect(403);
      });
    });

    describe('GET /api/properties/:propertyId/documents', () => {
      it('should return property documents', async () => {
        const response = await request(app)
          .get(`/api/properties/${testPropertyId}/documents`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.documents).toBeDefined();
        expect(Array.isArray(response.body.data.documents)).toBe(true);
      });
    });

    describe('GET /api/properties/documents/:documentId/download', () => {
      it('should return document download URL', async () => {
        if (!documentId) {
          // Skip if no document was created
          return;
        }

        const response = await request(app)
          .get(`/api/properties/documents/${documentId}/download`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.downloadUrl).toBeDefined();
      });

      it('should return 404 for non-existent document', async () => {
        const response = await request(app)
          .get('/api/properties/documents/non-existent-id/download')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/properties/documents/:documentId/verification', () => {
      it('should update document verification status as admin', async () => {
        if (!documentId) {
          return;
        }

        const response = await request(app)
          .put(`/api/properties/documents/${documentId}/verification`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'verified',
            notes: 'Document verified successfully'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.document.verificationStatus).toBe('verified');
      });

      it('should fail with invalid status', async () => {
        if (!documentId) {
          return;
        }

        const response = await request(app)
          .put(`/api/properties/documents/${documentId}/verification`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'invalid_status'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Invalid verification status');
      });
    });

    describe('DELETE /api/properties/documents/:documentId', () => {
      it('should delete document as admin', async () => {
        if (!documentId) {
          return;
        }

        const response = await request(app)
          .delete(`/api/properties/documents/${documentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Document deleted successfully');
      });
    });
  });
});