import request from 'supertest'
import { app } from '../../app'
import { UserModel } from '../../models/UserModel'
import { PropertyModel } from '../../models/PropertyModel'
import jwt from 'jsonwebtoken'

describe('Property Manager API', () => {
  let propertyManagerToken: string
  let propertyManagerId: string
  let propertyId: string

  beforeAll(async () => {
    // Create test property manager user
    const propertyManager = await UserModel.create({
      email: 'manager@test.com',
      password: 'password123',
      roles: ['property_manager'],
      kycStatus: 'approved'
    })
    propertyManagerId = propertyManager.id

    // Generate JWT token
    propertyManagerToken = jwt.sign(
      { userId: propertyManagerId },
      process.env.JWT_SECRET || 'test-secret'
    )

    // Create test property managed by this manager
    const property = await PropertyModel.create({
      name: 'Test Property',
      propertyType: 'residential',
      address: {
        addressLine1: '123 Test St',
        city: 'Test City',
        country: 'Test Country'
      },
      totalValuation: 1000000,
      totalTokens: 10000,
      pricePerToken: 100,
      propertyManagerId: propertyManagerId
    })
    propertyId = property.id
  })

  afterAll(async () => {
    // Cleanup test data
    await PropertyModel.deleteById(propertyId)
    await UserModel.deleteById(propertyManagerId)
  })

  describe('GET /api/property-manager/dashboard', () => {
    it('should return dashboard data for authenticated property manager', async () => {
      const response = await request(app)
        .get('/api/property-manager/dashboard')
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('summary')
      expect(response.body).toHaveProperty('properties')
      expect(response.body).toHaveProperty('recentActivity')
      
      expect(response.body.summary).toHaveProperty('totalProperties')
      expect(response.body.summary).toHaveProperty('totalValue')
      expect(response.body.summary).toHaveProperty('totalTokensIssued')
      expect(response.body.summary).toHaveProperty('averageOccupancy')
    })

    it('should require authentication', async () => {
      await request(app)
        .get('/api/property-manager/dashboard')
        .expect(401)
    })

    it('should require property manager role', async () => {
      // Create regular user token
      const regularUser = await UserModel.create({
        email: 'regular@test.com',
        password: 'password123',
        roles: ['investor']
      })

      const regularToken = jwt.sign(
        { userId: regularUser.id },
        process.env.JWT_SECRET || 'test-secret'
      )

      await request(app)
        .get('/api/property-manager/dashboard')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403)

      // Cleanup
      await UserModel.deleteById(regularUser.id)
    })
  })

  describe('GET /api/property-manager/properties/:propertyId', () => {
    it('should return property details for managed property', async () => {
      const response = await request(app)
        .get(`/api/property-manager/properties/${propertyId}`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('id', propertyId)
      expect(response.body).toHaveProperty('name', 'Test Property')
      expect(response.body).toHaveProperty('performance')
      expect(response.body).toHaveProperty('dividendHistory')
      expect(response.body).toHaveProperty('documents')
      expect(response.body).toHaveProperty('tokenHolders')
    })

    it('should reject access to non-managed property', async () => {
      // Create property managed by different manager
      const otherProperty = await PropertyModel.create({
        name: 'Other Property',
        propertyType: 'commercial',
        address: {
          addressLine1: '456 Other St',
          city: 'Other City',
          country: 'Other Country'
        },
        totalValuation: 500000,
        totalTokens: 5000,
        pricePerToken: 100,
        propertyManagerId: 'other-manager-id'
      })

      await request(app)
        .get(`/api/property-manager/properties/${otherProperty.id}`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(403)

      // Cleanup
      await PropertyModel.deleteById(otherProperty.id)
    })

    it('should validate property ID format', async () => {
      await request(app)
        .get('/api/property-manager/properties/invalid-id')
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(400)
    })
  })

  describe('POST /api/property-manager/properties/:propertyId/rental-income', () => {
    it('should record rental income and trigger dividend distribution', async () => {
      const rentalIncomeData = {
        amount: 5000,
        period: '2024-01',
        description: 'Monthly rent collection'
      }

      const response = await request(app)
        .post(`/api/property-manager/properties/${propertyId}/rental-income`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send(rentalIncomeData)
        .expect(200)

      expect(response.body).toHaveProperty('incomeRecord')
      expect(response.body).toHaveProperty('distribution')
      
      expect(response.body.incomeRecord).toHaveProperty('amount', 5000)
      expect(response.body.incomeRecord).toHaveProperty('period', '2024-01')
      
      expect(response.body.distribution).toHaveProperty('status')
      expect(['distributed', 'scheduled']).toContain(response.body.distribution.status)
    })

    it('should validate rental income amount', async () => {
      const invalidData = {
        amount: 0,
        period: '2024-01'
      }

      const response = await request(app)
        .post(`/api/property-manager/properties/${propertyId}/rental-income`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send(invalidData)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Validation failed')
    })

    it('should validate income period', async () => {
      const invalidData = {
        amount: 5000,
        period: ''
      }

      await request(app)
        .post(`/api/property-manager/properties/${propertyId}/rental-income`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send(invalidData)
        .expect(400)
    })
  })

  describe('POST /api/property-manager/properties/:propertyId/governance/proposals', () => {
    it('should create governance proposal', async () => {
      const proposalData = {
        title: 'Property Renovation Proposal',
        description: 'Proposal to renovate the property lobby and common areas',
        proposalType: 'renovation',
        options: ['Yes', 'No'],
        votingPeriod: 7
      }

      const response = await request(app)
        .post(`/api/property-manager/properties/${propertyId}/governance/proposals`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send(proposalData)
        .expect(200)

      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('title', proposalData.title)
      expect(response.body).toHaveProperty('description', proposalData.description)
      expect(response.body).toHaveProperty('proposalType', proposalData.proposalType)
      expect(response.body).toHaveProperty('status', 'active')
    })

    it('should validate proposal title length', async () => {
      const invalidData = {
        title: 'Too',
        description: 'This description is long enough to pass validation requirements',
        proposalType: 'maintenance'
      }

      await request(app)
        .post(`/api/property-manager/properties/${propertyId}/governance/proposals`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send(invalidData)
        .expect(400)
    })

    it('should validate proposal type', async () => {
      const invalidData = {
        title: 'Valid Title Here',
        description: 'This description is long enough to pass validation requirements',
        proposalType: 'invalid-type'
      }

      await request(app)
        .post(`/api/property-manager/properties/${propertyId}/governance/proposals`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send(invalidData)
        .expect(400)
    })
  })

  describe('GET /api/property-manager/properties/:propertyId/governance/proposals', () => {
    it('should return governance proposals for property', async () => {
      const response = await request(app)
        .get(`/api/property-manager/properties/${propertyId}/governance/proposals`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      
      // If there are proposals, check their structure
      if (response.body.length > 0) {
        const proposal = response.body[0]
        expect(proposal).toHaveProperty('id')
        expect(proposal).toHaveProperty('title')
        expect(proposal).toHaveProperty('description')
        expect(proposal).toHaveProperty('proposalType')
        expect(proposal).toHaveProperty('status')
        expect(proposal).toHaveProperty('votingResults')
      }
    })

    it('should filter proposals by status', async () => {
      const response = await request(app)
        .get(`/api/property-manager/properties/${propertyId}/governance/proposals`)
        .query({ status: 'active' })
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/property-manager/properties/${propertyId}/governance/proposals`)
        .query({ limit: 5, offset: 0 })
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
    })
  })

  describe('POST /api/property-manager/properties/:propertyId/notifications', () => {
    it('should send notification to token holders', async () => {
      const notificationData = {
        title: 'Property Update',
        message: 'Important update regarding your property investment',
        type: 'general',
        urgent: false
      }

      const response = await request(app)
        .post(`/api/property-manager/properties/${propertyId}/notifications`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send(notificationData)
        .expect(200)

      expect(response.body).toHaveProperty('success')
      expect(response.body).toHaveProperty('notificationsSent')
    })

    it('should validate notification title and message', async () => {
      const invalidData = {
        title: '',
        message: 'Valid message here',
        type: 'general'
      }

      await request(app)
        .post(`/api/property-manager/properties/${propertyId}/notifications`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send(invalidData)
        .expect(400)
    })

    it('should validate notification type', async () => {
      const invalidData = {
        title: 'Valid Title',
        message: 'Valid message here',
        type: 'invalid-type'
      }

      await request(app)
        .post(`/api/property-manager/properties/${propertyId}/notifications`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .send(invalidData)
        .expect(400)
    })
  })

  describe('GET /api/property-manager/properties/:propertyId/reports/performance', () => {
    it('should generate performance report', async () => {
      const response = await request(app)
        .get(`/api/property-manager/properties/${propertyId}/reports/performance`)
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('property')
      expect(response.body).toHaveProperty('reportPeriod')
      expect(response.body).toHaveProperty('performance')
      expect(response.body).toHaveProperty('financials')
      expect(response.body).toHaveProperty('occupancy')
      expect(response.body).toHaveProperty('generatedAt')

      expect(response.body.property).toHaveProperty('id', propertyId)
      expect(response.body.reportPeriod).toHaveProperty('startDate')
      expect(response.body.reportPeriod).toHaveProperty('endDate')
      expect(response.body.reportPeriod).toHaveProperty('reportType')
    })

    it('should support custom date range', async () => {
      const startDate = '2024-01-01'
      const endDate = '2024-12-31'

      const response = await request(app)
        .get(`/api/property-manager/properties/${propertyId}/reports/performance`)
        .query({ startDate, endDate, reportType: 'financial' })
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(200)

      expect(response.body.reportPeriod.reportType).toBe('financial')
    })

    it('should validate date format', async () => {
      await request(app)
        .get(`/api/property-manager/properties/${propertyId}/reports/performance`)
        .query({ startDate: 'invalid-date' })
        .set('Authorization', `Bearer ${propertyManagerToken}`)
        .expect(400)
    })
  })
})