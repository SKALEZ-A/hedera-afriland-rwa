import { Request, Response } from 'express'
import DemoDataService from '../services/DemoDataService'
import ShowcaseScenarioService from '../services/ShowcaseScenarioService'
import { logger } from '../utils/logger'

interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    role: string
    [key: string]: any
  }
}

export class DemoController {
  /**
   * Initialize demo data
   */
  initializeDemoData = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Admin role required.'
        })
      }

      await DemoDataService.initializeDemoData()
      await DemoDataService.seedDatabase()

      res.json({
        success: true,
        message: 'Demo data initialized successfully',
        data: DemoDataService.getDemoDataSummary()
      })
    } catch (error) {
      logger.error('Error initializing demo data', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize demo data'
      })
    }
  }

  /**
   * Get demo data summary
   */
  getDemoDataSummary = async (req: Request, res: Response) => {
    try {
      const summary = DemoDataService.getDemoDataSummary()
      
      res.json({
        success: true,
        data: summary
      })
    } catch (error) {
      logger.error('Error getting demo data summary', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get demo data summary'
      })
    }
  }

  /**
   * Get demo users
   */
  getDemoUsers = async (req: Request, res: Response) => {
    try {
      const users = DemoDataService.getDemoUsers().map(user => ({
        ...user,
        password: undefined // Don't expose passwords
      }))
      
      res.json({
        success: true,
        data: users
      })
    } catch (error) {
      logger.error('Error getting demo users', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get demo users'
      })
    }
  }

  /**
   * Get demo properties
   */
  getDemoProperties = async (req: Request, res: Response) => {
    try {
      const properties = DemoDataService.getDemoProperties()
      
      res.json({
        success: true,
        data: properties
      })
    } catch (error) {
      logger.error('Error getting demo properties', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get demo properties'
      })
    }
  }

  /**
   * Get demo investments
   */
  getDemoInvestments = async (req: Request, res: Response) => {
    try {
      const investments = DemoDataService.getDemoInvestments()
      
      res.json({
        success: true,
        data: investments
      })
    } catch (error) {
      logger.error('Error getting demo investments', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get demo investments'
      })
    }
  }

  /**
   * Get demo transactions
   */
  getDemoTransactions = async (req: Request, res: Response) => {
    try {
      const transactions = DemoDataService.getDemoTransactions()
      
      res.json({
        success: true,
        data: transactions
      })
    } catch (error) {
      logger.error('Error getting demo transactions', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get demo transactions'
      })
    }
  }

  /**
   * Get all showcase scenarios
   */
  getShowcaseScenarios = async (req: Request, res: Response) => {
    try {
      const { category, difficulty } = req.query
      
      let scenarios = ShowcaseScenarioService.getScenarios()
      
      if (category) {
        scenarios = ShowcaseScenarioService.getScenariosByCategory(category as string)
      }
      
      if (difficulty) {
        scenarios = scenarios.filter(s => s.difficulty === difficulty)
      }
      
      res.json({
        success: true,
        data: {
          scenarios,
          statistics: ShowcaseScenarioService.getScenarioStatistics()
        }
      })
    } catch (error) {
      logger.error('Error getting showcase scenarios', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get showcase scenarios'
      })
    }
  }

  /**
   * Get specific showcase scenario
   */
  getShowcaseScenario = async (req: Request, res: Response) => {
    try {
      const { scenarioId } = req.params
      const scenario = ShowcaseScenarioService.getScenario(scenarioId)
      
      if (!scenario) {
        return res.status(404).json({
          success: false,
          error: 'Scenario not found'
        })
      }
      
      res.json({
        success: true,
        data: scenario
      })
    } catch (error) {
      logger.error('Error getting showcase scenario', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get showcase scenario'
      })
    }
  }

  /**
   * Start scenario execution
   */
  startScenario = async (req: Request, res: Response) => {
    try {
      const { scenarioId } = req.params
      const execution = await ShowcaseScenarioService.startScenario(scenarioId)
      
      res.json({
        success: true,
        data: execution,
        message: 'Scenario execution started'
      })
    } catch (error) {
      logger.error('Error starting scenario', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start scenario'
      })
    }
  }

  /**
   * Execute next step in scenario
   */
  executeNextStep = async (req: Request, res: Response) => {
    try {
      const { scenarioId } = req.params
      const stepResult = await ShowcaseScenarioService.executeNextStep(scenarioId)
      
      res.json({
        success: true,
        data: {
          stepResult,
          execution: ShowcaseScenarioService.getExecutionStatus(scenarioId)
        }
      })
    } catch (error) {
      logger.error('Error executing scenario step', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute step'
      })
    }
  }

  /**
   * Get scenario execution status
   */
  getScenarioStatus = async (req: Request, res: Response) => {
    try {
      const { scenarioId } = req.params
      const execution = ShowcaseScenarioService.getExecutionStatus(scenarioId)
      
      if (!execution) {
        return res.status(404).json({
          success: false,
          error: 'No active execution found for this scenario'
        })
      }
      
      res.json({
        success: true,
        data: execution
      })
    } catch (error) {
      logger.error('Error getting scenario status', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scenario status'
      })
    }
  }

  /**
   * Pause scenario execution
   */
  pauseScenario = async (req: Request, res: Response) => {
    try {
      const { scenarioId } = req.params
      ShowcaseScenarioService.pauseScenario(scenarioId)
      
      res.json({
        success: true,
        message: 'Scenario execution paused',
        data: ShowcaseScenarioService.getExecutionStatus(scenarioId)
      })
    } catch (error) {
      logger.error('Error pausing scenario', error);
      res.status(500).json({
        success: false,
        error: 'Failed to pause scenario'
      })
    }
  }

  /**
   * Resume scenario execution
   */
  resumeScenario = async (req: Request, res: Response) => {
    try {
      const { scenarioId } = req.params
      ShowcaseScenarioService.resumeScenario(scenarioId)
      
      res.json({
        success: true,
        message: 'Scenario execution resumed',
        data: ShowcaseScenarioService.getExecutionStatus(scenarioId)
      })
    } catch (error) {
      logger.error('Error resuming scenario', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resume scenario'
      })
    }
  }

  /**
   * Stop scenario execution
   */
  stopScenario = async (req: Request, res: Response) => {
    try {
      const { scenarioId } = req.params
      ShowcaseScenarioService.stopScenario(scenarioId)
      
      res.json({
        success: true,
        message: 'Scenario execution stopped'
      })
    } catch (error) {
      logger.error('Error stopping scenario', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop scenario'
      })
    }
  }

  /**
   * Generate presentation script for scenario
   */
  generatePresentationScript = async (req: Request, res: Response) => {
    try {
      const { scenarioId } = req.params
      const script = ShowcaseScenarioService.generatePresentationScript(scenarioId)
      
      res.setHeader('Content-Type', 'text/markdown')
      res.setHeader('Content-Disposition', `attachment; filename="${scenarioId}-script.md"`)
      res.send(script)
    } catch (error) {
      logger.error('Error generating presentation script', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate presentation script'
      })
    }
  }

  /**
   * Get hackathon presentation overview
   */
  getHackathonOverview = async (req: Request, res: Response) => {
    try {
      const demoSummary = DemoDataService.getDemoDataSummary()
      const scenarioStats = ShowcaseScenarioService.getScenarioStatistics()
      
      const overview = {
        platform: {
          name: 'GlobalLand RWA Platform',
          description: 'Tokenized Real Estate Investment Platform for Africa',
          version: '1.0.0',
          blockchain: 'Hedera Hashgraph',
          features: [
            'Property Tokenization',
            'Fractional Investment',
            'Automated Dividend Distribution',
            'Mobile Money Integration',
            'KYC/AML Compliance',
            'Secondary Market Trading',
            'Real-time Analytics',
            'Multi-currency Support'
          ]
        },
        demoData: demoSummary,
        scenarios: scenarioStats,
        keyMetrics: {
          totalPropertyValue: demoSummary.properties.totalValue,
          totalInvestments: demoSummary.investments.total,
          averageInvestment: demoSummary.investments.averageInvestment,
          platformUsers: demoSummary.users.total,
          countriesSupported: Object.keys(demoSummary.users.byCountry).length
        },
        technicalHighlights: [
          'Hedera Token Service (HTS) Integration',
          'Smart Contract Automation',
          'Mobile Payment Gateway Integration',
          'Real-time Monitoring & Analytics',
          'Comprehensive Security Framework',
          'Scalable Microservices Architecture'
        ],
        businessImpact: [
          'Democratizes Real Estate Investment',
          'Enables Cross-border Investment',
          'Reduces Investment Minimums',
          'Provides Liquidity to Real Estate',
          'Automates Income Distribution',
          'Increases Market Transparency'
        ]
      }
      
      res.json({
        success: true,
        data: overview
      })
    } catch (error) {
      logger.error('Error getting hackathon overview', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get hackathon overview'
      })
    }
  }

  /**
   * Get demo credentials for testing
   */
  getDemoCredentials = async (req: Request, res: Response) => {
    try {
      const credentials = {
        investors: [
          { email: 'john.investor@example.com', password: 'demo123', role: 'investor' },
          { email: 'sarah.wealth@example.com', password: 'demo123', role: 'investor' },
          { email: 'david.crypto@example.com', password: 'demo123', role: 'investor' }
        ],
        propertyManagers: [
          { email: 'jane.properties@example.com', password: 'demo123', role: 'property_manager' },
          { email: 'michael.estates@example.com', password: 'demo123', role: 'property_manager' }
        ],
        admin: [
          { email: 'admin@globalland.com', password: 'admin123', role: 'admin' }
        ],
        apiEndpoints: {
          base: process.env.API_BASE_URL || 'http://localhost:3001',
          auth: '/api/auth',
          properties: '/api/properties',
          investments: '/api/investments',
          monitoring: '/api/monitoring',
          demo: '/api/demo'
        },
        mobilePayment: {
          testPhoneNumbers: ['+254700123456', '+234801234567', '+256700123456'],
          providers: ['M_PESA_KE', 'MTN_UG', 'AIRTEL_MONEY', 'FLUTTERWAVE']
        }
      }
      
      res.json({
        success: true,
        data: credentials,
        message: 'Demo credentials for testing purposes only'
      })
    } catch (error) {
      logger.error('Error getting demo credentials', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get demo credentials'
      })
    }
  }
}