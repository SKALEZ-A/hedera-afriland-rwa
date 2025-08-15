import { logger } from '../utils/logger'
import DemoDataService from './DemoDataService'
import AnalyticsService from './AnalyticsService'
import MonitoringService from './MonitoringService'

export interface ShowcaseScenario {
  id: string
  title: string
  description: string
  duration: number // in seconds
  steps: ShowcaseStep[]
  category: 'user_journey' | 'business_flow' | 'technical_demo' | 'analytics'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
}

export interface ShowcaseStep {
  id: string
  title: string
  description: string
  action: string
  endpoint?: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  payload?: any
  expectedResult: string
  visualElements?: string[]
  duration: number
}

export interface ScenarioExecution {
  scenarioId: string
  startTime: Date
  currentStep: number
  status: 'running' | 'completed' | 'paused' | 'failed'
  results: StepResult[]
}

export interface StepResult {
  stepId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: Date
  endTime?: Date
  result?: any
  error?: string
}

class ShowcaseScenarioService {
  private scenarios: ShowcaseScenario[] = []
  private activeExecutions: Map<string, ScenarioExecution> = new Map()

  constructor() {
    this.initializeScenarios()
  }

  /**
   * Initialize all showcase scenarios
   */
  private initializeScenarios(): void {
    this.scenarios = [
      // User Journey Scenarios
      {
        id: 'investor-onboarding',
        title: 'Complete Investor Onboarding Journey',
        description: 'Demonstrates the full investor onboarding process from registration to first investment',
        duration: 300, // 5 minutes
        category: 'user_journey',
        difficulty: 'beginner',
        tags: ['onboarding', 'kyc', 'investment', 'user-experience'],
        steps: [
          {
            id: 'register',
            title: 'User Registration',
            description: 'New investor creates an account',
            action: 'POST /api/auth/register',
            endpoint: '/api/auth/register',
            method: 'POST',
            payload: {
              email: 'demo.investor@example.com',
              password: 'SecurePass123!',
              firstName: 'Demo',
              lastName: 'Investor',
              phoneNumber: '+254700123456',
              country: 'Kenya'
            },
            expectedResult: 'User account created successfully with JWT token',
            visualElements: ['registration-form', 'success-message'],
            duration: 30
          },
          {
            id: 'kyc-upload',
            title: 'KYC Document Upload',
            description: 'User uploads identity documents for verification',
            action: 'POST /api/kyc/documents',
            endpoint: '/api/kyc/documents',
            method: 'POST',
            payload: {
              documentType: 'national_id',
              document: 'base64_encoded_document'
            },
            expectedResult: 'Documents uploaded and queued for verification',
            visualElements: ['document-upload', 'verification-status'],
            duration: 45
          },
          {
            id: 'kyc-approval',
            title: 'KYC Approval (Admin)',
            description: 'Admin reviews and approves KYC documents',
            action: 'POST /api/kyc/approve/{userId}',
            expectedResult: 'User KYC status updated to approved',
            visualElements: ['admin-dashboard', 'approval-notification'],
            duration: 30
          },
          {
            id: 'browse-properties',
            title: 'Browse Available Properties',
            description: 'User explores available investment properties',
            action: 'GET /api/properties',
            endpoint: '/api/properties',
            method: 'GET',
            expectedResult: 'List of tokenized properties with details',
            visualElements: ['property-grid', 'filters', 'property-cards'],
            duration: 60
          },
          {
            id: 'property-details',
            title: 'View Property Details',
            description: 'User examines detailed property information',
            action: 'GET /api/properties/{propertyId}',
            expectedResult: 'Comprehensive property details including financials',
            visualElements: ['property-detail-page', 'financial-metrics', 'location-map'],
            duration: 45
          },
          {
            id: 'make-investment',
            title: 'Make Investment',
            description: 'User purchases property tokens',
            action: 'POST /api/investments',
            endpoint: '/api/investments',
            method: 'POST',
            payload: {
              propertyId: 'demo-property-id',
              tokenAmount: 100,
              paymentMethod: 'mobile_money'
            },
            expectedResult: 'Investment created and payment processed',
            visualElements: ['investment-form', 'payment-processing', 'confirmation'],
            duration: 90
          }
        ]
      },

      // Business Flow Scenarios
      {
        id: 'property-tokenization',
        title: 'Property Tokenization Process',
        description: 'Shows how property managers tokenize real estate assets',
        duration: 240, // 4 minutes
        category: 'business_flow',
        difficulty: 'intermediate',
        tags: ['tokenization', 'property-management', 'blockchain', 'hedera'],
        steps: [
          {
            id: 'property-registration',
            title: 'Register New Property',
            description: 'Property manager adds a new property to the platform',
            action: 'POST /api/properties',
            endpoint: '/api/properties',
            method: 'POST',
            payload: {
              name: 'Demo Luxury Apartments',
              propertyType: 'residential',
              totalValuation: 25000000,
              totalTokens: 25000,
              address: {
                addressLine1: '123 Demo Street',
                city: 'Nairobi',
                country: 'Kenya'
              }
            },
            expectedResult: 'Property registered in the system',
            visualElements: ['property-form', 'valuation-calculator'],
            duration: 60
          },
          {
            id: 'document-upload',
            title: 'Upload Property Documents',
            description: 'Upload legal documents and certificates',
            action: 'POST /api/properties/{propertyId}/documents',
            expectedResult: 'Documents uploaded and linked to property',
            visualElements: ['document-manager', 'file-upload'],
            duration: 45
          },
          {
            id: 'blockchain-tokenization',
            title: 'Create Blockchain Tokens',
            description: 'Generate HTS tokens on Hedera network',
            action: 'POST /api/properties/{propertyId}/tokenize',
            expectedResult: 'HTS tokens created with unique token ID',
            visualElements: ['blockchain-transaction', 'token-creation-status'],
            duration: 90
          },
          {
            id: 'property-activation',
            title: 'Activate Property for Investment',
            description: 'Make property available for public investment',
            action: 'PUT /api/properties/{propertyId}/activate',
            expectedResult: 'Property status changed to active and visible to investors',
            visualElements: ['property-status', 'public-listing'],
            duration: 45
          }
        ]
      },

      // Technical Demo Scenarios
      {
        id: 'blockchain-integration',
        title: 'Hedera Blockchain Integration Demo',
        description: 'Demonstrates blockchain operations and smart contract interactions',
        duration: 180, // 3 minutes
        category: 'technical_demo',
        difficulty: 'advanced',
        tags: ['blockchain', 'hedera', 'smart-contracts', 'hts'],
        steps: [
          {
            id: 'account-balance',
            title: 'Check Hedera Account Balance',
            description: 'Query current HBAR balance',
            action: 'GET /api/blockchain/balance',
            expectedResult: 'Current account balance in HBAR',
            visualElements: ['balance-display', 'account-info'],
            duration: 30
          },
          {
            id: 'create-token',
            title: 'Create HTS Token',
            description: 'Create a new Hedera Token Service token',
            action: 'POST /api/blockchain/tokens/create',
            payload: {
              name: 'Demo Property Token',
              symbol: 'DPT',
              totalSupply: 10000,
              decimals: 0
            },
            expectedResult: 'New HTS token created with token ID',
            visualElements: ['token-creation', 'transaction-hash'],
            duration: 60
          },
          {
            id: 'token-transfer',
            title: 'Transfer Tokens',
            description: 'Transfer tokens between accounts',
            action: 'POST /api/blockchain/tokens/transfer',
            payload: {
              tokenId: 'demo-token-id',
              fromAccount: 'sender-account',
              toAccount: 'receiver-account',
              amount: 100
            },
            expectedResult: 'Tokens transferred successfully',
            visualElements: ['transfer-form', 'transaction-status'],
            duration: 60
          },
          {
            id: 'smart-contract',
            title: 'Execute Smart Contract',
            description: 'Call smart contract function for dividend distribution',
            action: 'POST /api/blockchain/contracts/execute',
            expectedResult: 'Smart contract executed successfully',
            visualElements: ['contract-interface', 'execution-result'],
            duration: 30
          }
        ]
      },

      // Analytics Demo Scenarios
      {
        id: 'analytics-dashboard',
        title: 'Real-time Analytics Dashboard',
        description: 'Showcases platform analytics and business intelligence features',
        duration: 150, // 2.5 minutes
        category: 'analytics',
        difficulty: 'intermediate',
        tags: ['analytics', 'dashboard', 'metrics', 'business-intelligence'],
        steps: [
          {
            id: 'business-metrics',
            title: 'View Business Metrics',
            description: 'Display key business performance indicators',
            action: 'GET /api/monitoring/analytics/business',
            endpoint: '/api/monitoring/analytics/business',
            method: 'GET',
            expectedResult: 'Comprehensive business analytics data',
            visualElements: ['metrics-dashboard', 'kpi-cards', 'charts'],
            duration: 45
          },
          {
            id: 'user-analytics',
            title: 'User Behavior Analytics',
            description: 'Show user engagement and activity patterns',
            action: 'GET /api/monitoring/analytics/realtime',
            expectedResult: 'Real-time user activity data',
            visualElements: ['user-activity-chart', 'engagement-metrics'],
            duration: 30
          },
          {
            id: 'property-performance',
            title: 'Property Performance Analysis',
            description: 'Analyze individual property investment performance',
            action: 'GET /api/monitoring/analytics/property/{propertyId}',
            expectedResult: 'Property-specific performance metrics',
            visualElements: ['property-analytics', 'roi-charts', 'comparison-table'],
            duration: 45
          },
          {
            id: 'system-health',
            title: 'System Health Monitoring',
            description: 'Display platform health and performance metrics',
            action: 'GET /api/monitoring/health',
            endpoint: '/api/monitoring/health',
            method: 'GET',
            expectedResult: 'System health status and metrics',
            visualElements: ['health-dashboard', 'performance-graphs', 'alert-status'],
            duration: 30
          }
        ]
      },

      // Mobile Experience Scenario
      {
        id: 'mobile-investment',
        title: 'Mobile Investment Experience',
        description: 'Demonstrates the mobile app investment flow with mobile payments',
        duration: 200, // 3.3 minutes
        category: 'user_journey',
        difficulty: 'beginner',
        tags: ['mobile', 'mobile-payments', 'user-experience', 'investment'],
        steps: [
          {
            id: 'mobile-login',
            title: 'Mobile App Login',
            description: 'User logs into mobile app with biometric authentication',
            action: 'Mobile App Authentication',
            expectedResult: 'User authenticated with biometric verification',
            visualElements: ['mobile-login', 'biometric-prompt'],
            duration: 30
          },
          {
            id: 'mobile-browse',
            title: 'Browse Properties on Mobile',
            description: 'User browses properties with mobile-optimized interface',
            action: 'Mobile Property Browsing',
            expectedResult: 'Properties displayed in mobile-friendly format',
            visualElements: ['mobile-property-list', 'swipe-gestures'],
            duration: 45
          },
          {
            id: 'mobile-payment',
            title: 'Mobile Money Payment',
            description: 'User pays for investment using M-Pesa',
            action: 'POST /api/mobile-payments/initiate',
            payload: {
              propertyId: 'demo-property',
              tokenAmount: 50,
              phoneNumber: '+254700123456',
              provider: 'M_PESA_KE',
              currency: 'KES'
            },
            expectedResult: 'Mobile payment initiated successfully',
            visualElements: ['mobile-payment', 'mpesa-prompt'],
            duration: 90
          },
          {
            id: 'push-notification',
            title: 'Real-time Notifications',
            description: 'User receives push notifications for investment updates',
            action: 'Push Notification Demo',
            expectedResult: 'Notifications delivered to mobile device',
            visualElements: ['push-notification', 'notification-center'],
            duration: 35
          }
        ]
      },

      // Dividend Distribution Scenario
      {
        id: 'dividend-distribution',
        title: 'Automated Dividend Distribution',
        description: 'Shows how rental income is distributed to token holders',
        duration: 180, // 3 minutes
        category: 'business_flow',
        difficulty: 'intermediate',
        tags: ['dividends', 'automation', 'smart-contracts', 'income-distribution'],
        steps: [
          {
            id: 'income-recording',
            title: 'Record Rental Income',
            description: 'Property manager records monthly rental income',
            action: 'POST /api/properties/{propertyId}/income',
            payload: {
              amount: 500000,
              currency: 'KES',
              type: 'rental',
              description: 'Monthly rental collection'
            },
            expectedResult: 'Rental income recorded in the system',
            visualElements: ['income-form', 'financial-dashboard'],
            duration: 45
          },
          {
            id: 'dividend-calculation',
            title: 'Calculate Dividend Distribution',
            description: 'System calculates proportional dividends for all token holders',
            action: 'POST /api/dividends/calculate/{propertyId}',
            expectedResult: 'Dividend amounts calculated for each investor',
            visualElements: ['calculation-engine', 'distribution-preview'],
            duration: 30
          },
          {
            id: 'smart-contract-distribution',
            title: 'Execute Smart Contract Distribution',
            description: 'Smart contract automatically distributes dividends',
            action: 'POST /api/dividends/distribute/{propertyId}',
            expectedResult: 'Dividends distributed to all token holders',
            visualElements: ['blockchain-transactions', 'distribution-status'],
            duration: 75
          },
          {
            id: 'investor-notification',
            title: 'Notify Investors',
            description: 'Investors receive notifications about dividend payments',
            action: 'Automated Notifications',
            expectedResult: 'All investors notified of dividend receipt',
            visualElements: ['notification-system', 'investor-dashboard'],
            duration: 30
          }
        ]
      }
    ]

    logger.info('Showcase scenarios initialized', {
      totalScenarios: this.scenarios.length,
      categories: [...new Set(this.scenarios.map(s => s.category))],
      difficulties: [...new Set(this.scenarios.map(s => s.difficulty))]
    })
  }

  /**
   * Get all available scenarios
   */
  getScenarios(): ShowcaseScenario[] {
    return this.scenarios
  }

  /**
   * Get scenario by ID
   */
  getScenario(scenarioId: string): ShowcaseScenario | undefined {
    return this.scenarios.find(s => s.id === scenarioId)
  }

  /**
   * Get scenarios by category
   */
  getScenariosByCategory(category: string): ShowcaseScenario[] {
    return this.scenarios.filter(s => s.category === category)
  }

  /**
   * Get scenarios by difficulty
   */
  getScenariosByDifficulty(difficulty: string): ShowcaseScenario[] {
    return this.scenarios.filter(s => s.difficulty === difficulty)
  }

  /**
   * Start scenario execution
   */
  async startScenario(scenarioId: string): Promise<ScenarioExecution> {
    const scenario = this.getScenario(scenarioId)
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`)
    }

    const execution: ScenarioExecution = {
      scenarioId,
      startTime: new Date(),
      currentStep: 0,
      status: 'running',
      results: scenario.steps.map(step => ({
        stepId: step.id,
        status: 'pending'
      }))
    }

    this.activeExecutions.set(scenarioId, execution)

    logger.info('Scenario execution started', {
      scenarioId,
      title: scenario.title,
      totalSteps: scenario.steps.length
    })

    // Track scenario start event
    AnalyticsService.trackEvent({
      userId: 'demo-system',
      event: 'scenario_started',
      properties: {
        scenarioId,
        title: scenario.title,
        category: scenario.category,
        difficulty: scenario.difficulty
      }
    })

    return execution
  }

  /**
   * Execute next step in scenario
   */
  async executeNextStep(scenarioId: string): Promise<StepResult> {
    const execution = this.activeExecutions.get(scenarioId)
    if (!execution) {
      throw new Error(`No active execution found for scenario: ${scenarioId}`)
    }

    const scenario = this.getScenario(scenarioId)
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`)
    }

    if (execution.currentStep >= scenario.steps.length) {
      execution.status = 'completed'
      throw new Error('All steps completed')
    }

    const step = scenario.steps[execution.currentStep]
    const stepResult = execution.results[execution.currentStep]

    stepResult.status = 'running'
    stepResult.startTime = new Date()

    try {
      logger.info('Executing scenario step', {
        scenarioId,
        stepId: step.id,
        stepTitle: step.title
      })

      // Simulate step execution
      const result = await this.executeStep(step)

      stepResult.status = 'completed'
      stepResult.endTime = new Date()
      stepResult.result = result

      execution.currentStep++

      // Check if scenario is complete
      if (execution.currentStep >= scenario.steps.length) {
        execution.status = 'completed'
        
        // Track scenario completion
        AnalyticsService.trackEvent({
          userId: 'demo-system',
          event: 'scenario_completed',
          properties: {
            scenarioId,
            title: scenario.title,
            duration: Date.now() - execution.startTime.getTime()
          }
        })
      }

      return stepResult
    } catch (error) {
      stepResult.status = 'failed'
      stepResult.endTime = new Date()
      stepResult.error = error instanceof Error ? error.message : 'Unknown error'
      execution.status = 'failed'

      logger.error('Scenario step failed', {
        scenarioId,
        stepId: step.id,
        error
      })

      throw error;
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: ShowcaseStep): Promise<any> {
    // Simulate API call or action execution
    await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay

    // Record performance metric
    MonitoringService.recordPerformance({
      operation: `demo_step_${step.id}`,
      duration: 1000,
      success: true,
      metadata: {
        stepTitle: step.title,
        action: step.action
      }
    })

    // Return mock result based on step type
    switch (step.action) {
      case 'POST /api/auth/register':
        return {
          success: true,
          data: {
            user: { id: 'demo-user-id', email: 'demo.investor@example.com' },
            token: 'demo-jwt-token'
          }
        }

      case 'GET /api/properties':
        return {
          success: true,
          data: DemoDataService.getDemoProperties().slice(0, 6)
        }

      case 'GET /api/monitoring/health':
        return {
          success: true,
          data: {
            status: 'healthy',
            checks: {
              database: { status: 'healthy' },
              redis: { status: 'healthy' },
              blockchain: { status: 'healthy' }
            }
          }
        }

      default:
        return {
          success: true,
          message: `Step ${step.id} executed successfully`,
          data: { stepId: step.id, timestamp: new Date() }
        }
    }
  }

  /**
   * Get scenario execution status
   */
  getExecutionStatus(scenarioId: string): ScenarioExecution | undefined {
    return this.activeExecutions.get(scenarioId)
  }

  /**
   * Pause scenario execution
   */
  pauseScenario(scenarioId: string): void {
    const execution = this.activeExecutions.get(scenarioId)
    if (execution && execution.status === 'running') {
      execution.status = 'paused'
      logger.info('Scenario execution paused', { scenarioId });
    }
  }

  /**
   * Resume scenario execution
   */
  resumeScenario(scenarioId: string): void {
    const execution = this.activeExecutions.get(scenarioId)
    if (execution && execution.status === 'paused') {
      execution.status = 'running'
      logger.info('Scenario execution resumed', { scenarioId });
    }
  }

  /**
   * Stop scenario execution
   */
  stopScenario(scenarioId: string): void {
    const execution = this.activeExecutions.get(scenarioId)
    if (execution) {
      execution.status = 'completed'
      this.activeExecutions.delete(scenarioId)
      logger.info('Scenario execution stopped', { scenarioId });
    }
  }

  /**
   * Get scenario statistics
   */
  getScenarioStatistics(): {
    totalScenarios: number
    byCategory: Record<string, number>
    byDifficulty: Record<string, number>
    averageDuration: number
    activeExecutions: number
  } {
    const byCategory: Record<string, number> = {}
    const byDifficulty: Record<string, number> = {}
    let totalDuration = 0

    this.scenarios.forEach(scenario => {
      byCategory[scenario.category] = (byCategory[scenario.category] || 0) + 1
      byDifficulty[scenario.difficulty] = (byDifficulty[scenario.difficulty] || 0) + 1
      totalDuration += scenario.duration
    })

    return {
      totalScenarios: this.scenarios.length,
      byCategory,
      byDifficulty,
      averageDuration: this.scenarios.length > 0 ? totalDuration / this.scenarios.length : 0,
      activeExecutions: this.activeExecutions.size
    }
  }

  /**
   * Generate scenario presentation script
   */
  generatePresentationScript(scenarioId: string): string {
    const scenario = this.getScenario(scenarioId)
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`)
    }

    let script = `# ${scenario.title}\n\n`
    script += `**Duration:** ${Math.floor(scenario.duration / 60)} minutes ${scenario.duration % 60} seconds\n`
    script += `**Category:** ${scenario.category}\n`
    script += `**Difficulty:** ${scenario.difficulty}\n\n`
    script += `${scenario.description}\n\n`
    script += `## Steps:\n\n`

    scenario.steps.forEach((step, index) => {
      script += `### ${index + 1}. ${step.title}\n`
      script += `**Duration:** ${step.duration} seconds\n\n`
      script += `${step.description}\n\n`
      script += `**Action:** ${step.action}\n`
      script += `**Expected Result:** ${step.expectedResult}\n\n`
      
      if (step.visualElements && step.visualElements.length > 0) {
        script += `**Visual Elements:** ${step.visualElements.join(', ')}\n\n`
      }
      
      script += `---\n\n`
    })

    return script
  }
}

export default new ShowcaseScenarioService()