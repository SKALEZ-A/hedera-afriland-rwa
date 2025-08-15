import { Request, Response } from 'express'
import { PropertyManagerController } from '../../controllers/PropertyManagerController'
import { PropertyService } from '../../services/PropertyService'
import { DividendService } from '../../services/DividendService'
import { PropertyDocumentService } from '../../services/PropertyDocumentService'
import { NotificationService } from '../../services/NotificationService'

// Mock the services
jest.mock('../../services/PropertyService')
jest.mock('../../services/DividendService')
jest.mock('../../services/PropertyDocumentService')
jest.mock('../../services/NotificationService')

describe('PropertyManagerController', () => {
  let controller: PropertyManagerController
  let mockPropertyService: jest.Mocked<PropertyService>
  let mockDividendService: jest.Mocked<DividendService>
  let mockDocumentService: jest.Mocked<PropertyDocumentService>
  let mockNotificationService: jest.Mocked<NotificationService>
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Create controller instance
    controller = new PropertyManagerController()

    // Get mocked services
    mockPropertyService = PropertyService.prototype as jest.Mocked<PropertyService>
    mockDividendService = DividendService.prototype as jest.Mocked<DividendService>
    mockDocumentService = PropertyDocumentService.prototype as jest.Mocked<PropertyDocumentService>
    mockNotificationService = NotificationService.prototype as jest.Mocked<NotificationService>

    // Setup mock request and response
    mockRequest = {
      propertyManager: {
        id: 'manager-123',
        managedProperties: ['property-1', 'property-2']
      },
      params: {},
      body: {},
      query: {}
    }

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    }
  })

  describe('getDashboard', () => {
    it('should return dashboard data successfully', async () => {
      // Mock data
      const mockProperty = {
        id: 'property-1',
        name: 'Test Property',
        valuation: 1000000,
        totalTokens: 10000,
        availableTokens: 5000
      }

      const mockPerformance = {
        propertyId: 'property-1',
        totalInvestment: 500000,
        currentValue: 1000000,
        appreciation: 100,
        dividendYield: 8.5,
        totalDividends: 42500,
        occupancyRate: 0.95
      }

      const mockDividendHistory = [
        { totalAmount: 25000, distributionDate: new Date() },
        { totalAmount: 17500, distributionDate: new Date() }
      ]

      // Setup mocks
      mockPropertyService.getPropertyById.mockResolvedValue(mockProperty as any)
      mockPropertyService.getPropertyPerformance.mockResolvedValue(mockPerformance as any)
      mockDividendService.getDistributionHistory.mockResolvedValue(mockDividendHistory as any)
      mockPropertyService.getManagerActivity.mockResolvedValue([])

      // Execute
      await controller.getDashboard(mockRequest as any, mockResponse as Response)

      // Verify
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalProperties: 2,
            totalValue: expect.any(Number),
            totalTokensIssued: expect.any(Number),
            averageOccupancy: expect.any(Number)
          }),
          properties: expect.any(Array),
          recentActivity: expect.any(Array)
        })
      )
    })

    it('should handle errors gracefully', async () => {
      // Setup error
      mockPropertyService.getPropertyById.mockRejectedValue(new Error('Database error'))

      // Execute
      await controller.getDashboard(mockRequest as any, mockResponse as Response)

      // Verify error response
      expect(mockResponse.status).toHaveBeenCalledWith(500)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Failed to load dashboard'
      })
    })
  })

  describe('inputRentalIncome', () => {
    beforeEach(() => {
      mockRequest.params = { propertyId: 'property-1' }
      mockRequest.body = {
        amount: 5000,
        period: '2024-01',
        description: 'Monthly rent collection'
      }
    })

    it('should process rental income and distribute dividends immediately', async () => {
      // Mock data
      const mockProperty = {
        id: 'property-1',
        name: 'Test Property',
        managementFee: 0.05
      }

      const mockIncomeRecord = {
        id: 'income-1',
        propertyId: 'property-1',
        amount: 5000,
        period: '2024-01'
      }

      const mockDistribution = {
        totalDistributed: 4750,
        managementFee: 250,
        distributions: [
          { userId: 'user-1', amount: 2375 },
          { userId: 'user-2', amount: 2375 }
        ]
      }

      // Setup mocks
      mockPropertyService.recordRentalIncome.mockResolvedValue(mockIncomeRecord as any)
      mockPropertyService.getPropertyById.mockResolvedValue(mockProperty as any)
      mockDividendService.calculateDistribution.mockResolvedValue(mockDistribution as any)
      mockDividendService.distributeDividends.mockResolvedValue(undefined)
      mockNotificationService.notifyTokenHolders.mockResolvedValue({
        success: true,
        notificationsSent: 2
      })

      // Execute
      await controller.inputRentalIncome(mockRequest as any, mockResponse as Response)

      // Verify
      expect(mockPropertyService.recordRentalIncome).toHaveBeenCalledWith(
        'property-1',
        expect.objectContaining({
          amount: 5000,
          period: '2024-01',
          description: 'Monthly rent collection',
          recordedBy: 'manager-123'
        })
      )

      expect(mockDividendService.distributeDividends).toHaveBeenCalledWith(
        'property-1',
        mockDistribution.distributions
      )

      expect(mockNotificationService.notifyTokenHolders).toHaveBeenCalledWith(
        'property-1',
        'dividend_distributed',
        expect.objectContaining({
          title: 'Dividend Payment Received',
          amount: 4750
        })
      )

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          incomeRecord: mockIncomeRecord,
          distribution: expect.objectContaining({
            status: 'distributed'
          })
        })
      )
    })

    it('should validate rental income amount', async () => {
      mockRequest.body.amount = 0

      await controller.inputRentalIncome(mockRequest as any, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Valid rental income amount is required'
      })
    })

    it('should validate income period', async () => {
      mockRequest.body.period = ''

      await controller.inputRentalIncome(mockRequest as any, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Income period is required'
      })
    })
  })

  describe('createGovernanceProposal', () => {
    beforeEach(() => {
      mockRequest.params = { propertyId: 'property-1' }
      mockRequest.body = {
        title: 'Property Renovation Proposal',
        description: 'Proposal to renovate the property lobby',
        proposalType: 'renovation',
        options: ['Yes', 'No'],
        votingPeriod: 7
      }
    })

    it('should create governance proposal successfully', async () => {
      const mockProposal = {
        id: 'proposal-1',
        title: 'Property Renovation Proposal',
        description: 'Proposal to renovate the property lobby',
        proposalType: 'renovation',
        status: 'active'
      }

      const mockProperty = {
        name: 'Test Property'
      }

      mockPropertyService.createGovernanceProposal.mockResolvedValue(mockProposal as any)
      mockPropertyService.getPropertyById.mockResolvedValue(mockProperty as any)
      mockNotificationService.notifyTokenHolders.mockResolvedValue({
        success: true,
        notificationsSent: 5
      })

      await controller.createGovernanceProposal(mockRequest as any, mockResponse as Response)

      expect(mockPropertyService.createGovernanceProposal).toHaveBeenCalledWith(
        'property-1',
        expect.objectContaining({
          title: 'Property Renovation Proposal',
          description: 'Proposal to renovate the property lobby',
          proposalType: 'renovation',
          options: ['Yes', 'No'],
          votingPeriod: 7,
          createdBy: 'manager-123'
        })
      )

      expect(mockNotificationService.notifyTokenHolders).toHaveBeenCalledWith(
        'property-1',
        'governance_proposal',
        expect.objectContaining({
          title: 'New Governance Proposal',
          proposalId: 'proposal-1'
        })
      )

      expect(mockResponse.json).toHaveBeenCalledWith(mockProposal)
    })

    it('should validate required fields', async () => {
      mockRequest.body.title = ''

      await controller.createGovernanceProposal(mockRequest as any, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Title, description, and proposal type are required'
      })
    })
  })

  describe('uploadDocument', () => {
    beforeEach(() => {
      mockRequest.params = { propertyId: 'property-1' }
      mockRequest.body = {
        documentType: 'legal',
        title: 'Property Deed',
        description: 'Official property ownership document'
      }
      mockRequest.file = {
        buffer: Buffer.from('mock file content'),
        originalname: 'deed.pdf',
        mimetype: 'application/pdf'
      } as any
    })

    it('should upload document successfully', async () => {
      const mockDocument = {
        id: 'doc-1',
        propertyId: 'property-1',
        title: 'Property Deed',
        documentType: 'legal',
        ipfsHash: 'QmTest123'
      }

      const mockProperty = {
        name: 'Test Property'
      }

      mockDocumentService.uploadDocument.mockResolvedValue(mockDocument as any)
      mockPropertyService.getPropertyById.mockResolvedValue(mockProperty as any)
      mockNotificationService.notifyTokenHolders.mockResolvedValue({
        success: true,
        notificationsSent: 3
      })

      await controller.uploadDocument(mockRequest as any, mockResponse as Response)

      expect(mockDocumentService.uploadDocument).toHaveBeenCalledWith(
        'property-1',
        expect.objectContaining({
          file: expect.any(Buffer),
          filename: 'deed.pdf',
          mimetype: 'application/pdf',
          documentType: 'legal',
          title: 'Property Deed',
          description: 'Official property ownership document',
          uploadedBy: 'manager-123'
        })
      )

      expect(mockNotificationService.notifyTokenHolders).toHaveBeenCalledWith(
        'property-1',
        'document_uploaded',
        expect.objectContaining({
          title: 'New Document Available',
          documentTitle: 'Property Deed'
        })
      )

      expect(mockResponse.json).toHaveBeenCalledWith(mockDocument)
    })

    it('should validate file upload', async () => {
      mockRequest.file = undefined

      await controller.uploadDocument(mockRequest as any, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Document file is required'
      })
    })

    it('should validate document type and title', async () => {
      mockRequest.body.documentType = ''
      mockRequest.body.title = ''

      await controller.uploadDocument(mockRequest as any, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Document type and title are required'
      })
    })
  })
})