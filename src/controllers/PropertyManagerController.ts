import { Request, Response } from 'express'
import { PropertyService } from '../services/PropertyService'
import { DividendService } from '../services/DividendService'
import { PropertyDocumentService } from '../services/PropertyDocumentService'
import { NotificationService } from '../services/NotificationService'
import { logger } from '../utils/logger'

interface PropertyManagerRequest extends Request {
  user?: any
  propertyManager?: {
    id: string
    managedProperties: string[]
  }
}

export class PropertyManagerController {
  private propertyService: PropertyService
  private dividendService: DividendService
  private documentService: PropertyDocumentService
  private notificationService: NotificationService

  constructor() {
    this.propertyService = new PropertyService()
    this.dividendService = new DividendService()
    this.documentService = new PropertyDocumentService()
    this.notificationService = new NotificationService()
  }

  // Get dashboard overview for property manager
  getDashboard = async (req: PropertyManagerRequest, res: Response) => {
    try {
      const managerId = req.propertyManager!.id
      const managedPropertyIds = req.propertyManager!.managedProperties

      // Get properties with performance metrics
      const properties = await Promise.all(
        managedPropertyIds.map(async (propertyId) => {
          const property = await this.propertyService.getPropertyById(propertyId)
          const performance = await this.propertyService.getPropertyPerformance(propertyId)
          const dividendHistory = await this.dividendService.getDistributionHistory(propertyId)
          
          return {
            ...property,
            performance,
            totalDividendsDistributed: dividendHistory.reduce((sum, dist) => sum + dist.totalAmount, 0),
            lastDividendDate: dividendHistory[0]?.distributionDate || null
          }
        })
      )

      // Calculate summary metrics
      const totalProperties = properties.length
      const totalValue = properties.reduce((sum, p) => sum + p.valuation, 0)
      const totalTokensIssued = properties.reduce((sum, p) => sum + (p.totalTokens - p.availableTokens), 0)
      const averageOccupancy = properties.reduce((sum, p) => sum + (p.performance?.occupancyRate || 0), 0) / totalProperties

      const dashboard = {
        summary: {
          totalProperties,
          totalValue,
          totalTokensIssued,
          averageOccupancy: Math.round(averageOccupancy * 100) / 100
        },
        properties,
        recentActivity: await this.getRecentActivity(managerId)
      }

      res.json(dashboard)
    } catch (error) {
      logger.error('Error getting property manager dashboard:', error);
      res.status(500).json({ error: 'Failed to load dashboard' })
    }
  }

  // Get detailed property information
  getPropertyDetails = async (req: PropertyManagerRequest, res: Response) => {
    try {
      const { propertyId } = req.params
      
      const property = await this.propertyService.getPropertyById(propertyId)
      const performance = await this.propertyService.getPropertyPerformance(propertyId)
      const dividendHistory = await this.dividendService.getDistributionHistory(propertyId)
      const documents = await this.documentService.getPropertyDocuments(propertyId)
      const tokenHolders = await this.propertyService.getTokenHolders(propertyId)

      const propertyDetails = {
        ...property,
        performance,
        dividendHistory,
        documents,
        tokenHolders: tokenHolders.map(holder => ({
          userId: holder.userId,
          tokenAmount: holder.tokenAmount,
          percentage: (holder.tokenAmount / property.totalTokens) * 100,
          investmentDate: holder.investmentDate
        }))
      }

      res.json(propertyDetails)
    } catch (error) {
      logger.error('Error getting property details:', error);
      res.status(500).json({ error: 'Failed to load property details' })
    }
  }

  // Update property information
  updateProperty = async (req: PropertyManagerRequest, res: Response) => {
    try {
      const { propertyId } = req.params
      const updates = req.body

      // Validate allowed updates for property managers
      const allowedUpdates = [
        'description',
        'expectedYield',
        'propertyType',
        'maintenanceStatus',
        'occupancyRate',
        'monthlyRent'
      ]

      const filteredUpdates = Object.keys(updates)
        .filter(key => allowedUpdates.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key]
          return obj
        }, {} as any)

      const updatedProperty = await this.propertyService.updateProperty(propertyId, filteredUpdates)

      // Notify token holders of significant updates
      if (updates.expectedYield || updates.monthlyRent) {
        await this.notificationService.notifyTokenHolders(
          propertyId,
          'property_update',
          {
            title: 'Property Update',
            message: 'Important updates have been made to your property investment',
            propertyName: updatedProperty.name
          }
        )
      }

      res.json(updatedProperty)
    } catch (error) {
      logger.error('Error updating property:', error);
      res.status(500).json({ error: 'Failed to update property' });
    }
  }

  /**
   * Input rental income and trigger dividend distribution
   */
  inputRentalIncome = async (req: PropertyManagerRequest, res: Response) => {
    try {
      const { propertyId } = req.params
      const { amount, period, description, distributionDate } = req.body

      // Validate input
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid rental income amount is required' })
      }

      if (!period) {
        return res.status(400).json({ error: 'Income period is required' })
      }

      // Record rental income
      const incomeRecord = await this.propertyService.recordRentalIncome(propertyId, {
        amount,
        period,
        description,
        recordedBy: req.propertyManager!.id,
        recordedAt: new Date()
      })

      // Calculate and prepare dividend distribution
      const property = await this.propertyService.getPropertyById(propertyId)
      const distribution = await this.dividendService.calculateDistribution(
        propertyId,
        amount,
        property.managementFee || 0.05 // 5% default management fee
      )

      // Schedule distribution for specified date or immediate
      const scheduleDate = distributionDate ? new Date(distributionDate) : new Date()
      
      if (scheduleDate <= new Date()) {
        // Distribute immediately
        await this.dividendService.distributeDividends(propertyId, distribution.distributions)
        
        // Notify token holders
        await this.notificationService.notifyTokenHolders(
          propertyId,
          'dividend_distributed',
          {
            title: 'Dividend Payment Received',
            message: `You have received a dividend payment from ${property.name}`,
            amount: distribution.totalDistributed,
            propertyName: property.name
          }
        )

        res.json({
          incomeRecord,
          distribution: {
            ...distribution,
            status: 'distributed',
            distributedAt: new Date()
          }
        })
      } else {
        // Schedule for future distribution
        await this.dividendService.scheduleDividendDistribution(
          propertyId,
          distribution.distributions,
          scheduleDate
        )

        res.json({
          incomeRecord,
          distribution: {
            ...distribution,
            status: 'scheduled',
            scheduledFor: scheduleDate
          }
        })
      }
    } catch (error) {
      logger.error('Error processing rental income:', error);
      res.status(500).json({ error: 'Failed to process rental income' })
    }
  }

  // Upload and manage property documents
  uploadDocument = async (req: PropertyManagerRequest, res: Response) => {
    try {
      const { propertyId } = req.params
      const { documentType, title, description } = req.body
      const file = req.file

      if (!file) {
        return res.status(400).json({ error: 'Document file is required' })
      }

      if (!documentType || !title) {
        return res.status(400).json({ error: 'Document type and title are required' })
      }

      // Upload document to IPFS and store metadata
      const document = await this.documentService.uploadDocument(propertyId, {
        file: file.buffer,
        filename: file.originalname,
        mimetype: file.mimetype,
        documentType,
        title,
        description,
        uploadedBy: req.propertyManager!.id
      })

      // Notify token holders of important document updates
      const importantTypes = ['legal', 'financial', 'maintenance', 'valuation']
      if (importantTypes.includes(documentType)) {
        await this.notificationService.notifyTokenHolders(
          propertyId,
          'document_uploaded',
          {
            title: 'New Document Available',
            message: `A new ${documentType} document has been uploaded for your property`,
            documentTitle: title,
            propertyName: (await this.propertyService.getPropertyById(propertyId)).name
          }
        )
      }

      res.json(document)
    } catch (error) {
      logger.error('Error uploading document:', error);
      res.status(500).json({ error: 'Failed to upload document' })
    }
  }

  // Get property documents
  getDocuments = async (req: PropertyManagerRequest, res: Response) => {
    try {
      const { propertyId } = req.params
      const { type, limit, offset } = req.query

      const documents = await this.documentService.getPropertyDocuments(propertyId, {
        type: type as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      })

      res.json(documents)
    } catch (error) {
      logger.error('Error getting documents:', error);
      res.status(500).json({ error: 'Failed to load documents' })
    }
  }

  // Create governance proposal
  createGovernanceProposal = async (req: PropertyManagerRequest, res: Response) => {
    try {
      const { propertyId } = req.params
      const { title, description, proposalType, options, votingPeriod } = req.body

      if (!title || !description || !proposalType) {
        return res.status(400).json({ 
          error: 'Title, description, and proposal type are required' 
        })
      }

      const proposal = await this.propertyService.createGovernanceProposal(propertyId, {
        title,
        description,
        proposalType,
        options: options || ['Yes', 'No'],
        votingPeriod: votingPeriod || 7, // 7 days default
        createdBy: req.propertyManager!.id
      })

      // Notify all token holders about the new proposal
      await this.notificationService.notifyTokenHolders(
        propertyId,
        'governance_proposal',
        {
          title: 'New Governance Proposal',
          message: `A new proposal "${title}" is now open for voting`,
          proposalId: proposal.id,
          propertyName: (await this.propertyService.getPropertyById(propertyId)).name
        }
      )

      res.json(proposal)
    } catch (error) {
      logger.error('Error creating governance proposal:', error);
      res.status(500).json({ error: 'Failed to create proposal' })
    }
  }

  // Get governance proposals and voting results
  getGovernanceProposals = async (req: PropertyManagerRequest, res: Response) => {
    try {
      const { propertyId } = req.params
      const { status, limit, offset } = req.query

      const proposals = await this.propertyService.getGovernanceProposals(propertyId, {
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      })

      // Include voting results for each proposal
      const proposalsWithResults = await Promise.all(
        proposals.map(async (proposal) => {
          const votingResults = await this.propertyService.getProposalVotingResults(proposal.id)
          return {
            ...proposal,
            votingResults
          }
        })
      )

      res.json(proposalsWithResults)
    } catch (error) {
      logger.error('Error getting governance proposals:', error);
      res.status(500).json({ error: 'Failed to load proposals' })
    }
  }

  // Generate property performance report
  generatePerformanceReport = async (req: PropertyManagerRequest, res: Response) => {
    try {
      const { propertyId } = req.params
      const { startDate, endDate, reportType } = req.query

      const report = await this.propertyService.generatePerformanceReport(propertyId, {
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
        reportType: (reportType as string) || 'comprehensive'
      })

      res.json(report)
    } catch (error) {
      logger.error('Error generating performance report:', error);
      res.status(500).json({ error: 'Failed to generate report' })
    }
  }

  // Get recent activity for dashboard
  private async getRecentActivity(managerId: string) {
    try {
      // Get recent activities across all managed properties
      const activities = await this.propertyService.getManagerActivity(managerId, {
        limit: 10,
        types: ['rental_income', 'document_upload', 'governance_proposal', 'dividend_distribution']
      })

      return activities
    } catch (error) {
      logger.error('Error getting recent activity:', error);
      return []
    }
  }

  // Send notification to token holders
  sendNotification = async (req: PropertyManagerRequest, res: Response) => {
    try {
      const { propertyId } = req.params
      const { title, message, type, urgent } = req.body

      if (!title || !message) {
        return res.status(400).json({ error: 'Title and message are required' })
      }

      const notification = await this.notificationService.notifyTokenHolders(
        propertyId,
        type || 'general',
        {
          title,
          message,
          urgent: urgent || false,
          sentBy: req.propertyManager!.id,
          propertyName: (await this.propertyService.getPropertyById(propertyId)).name
        }
      )

      res.json(notification)
    } catch (error) {
      logger.error('Error sending notification:', error);
      res.status(500).json({ error: 'Failed to send notification' })
    }
  }
}