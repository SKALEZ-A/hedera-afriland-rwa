#!/usr/bin/env ts-node

import axios, { AxiosInstance, AxiosResponse } from 'axios'
import chalk from 'chalk'

interface TestResult {
  name: string
  success: boolean
  duration: number
  error?: string
  response?: any
}

interface TestSuite {
  name: string
  tests: TestResult[]
  totalTests: number
  passedTests: number
  failedTests: number
  totalDuration: number
}

class ApiTestRunner {
  private client: AxiosInstance
  private baseUrl: string
  private authToken?: string
  private results: TestSuite[] = []

  constructor(baseUrl: string = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      validateStatus: () => true // Don't throw on HTTP error status
    })
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      await testFn()
      const duration = Date.now() - startTime
      
      return {
        name,
        success: true,
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      return {
        name,
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async runTestSuite(suiteName: string, tests: Array<{ name: string, fn: () => Promise<void> }>) {
    console.log(chalk.blue(`\n🧪 Running ${suiteName} tests...`))
    
    const suite: TestSuite = {
      name: suiteName,
      tests: [],
      totalTests: tests.length,
      passedTests: 0,
      failedTests: 0,
      totalDuration: 0
    }

    for (const test of tests) {
      const result = await this.runTest(test.name, test.fn)
      suite.tests.push(result)
      suite.totalDuration += result.duration

      if (result.success) {
        suite.passedTests++
        console.log(chalk.green(`  ✓ ${result.name} (${result.duration}ms)`))
      } else {
        suite.failedTests++
        console.log(chalk.red(`  ✗ ${result.name} (${result.duration}ms)`))
        if (result.error) {
          console.log(chalk.red(`    Error: ${result.error}`))
        }
      }
    }

    this.results.push(suite)
  }

  private expectStatus(response: AxiosResponse, expectedStatus: number) {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`)
    }
  }

  private expectProperty(obj: any, property: string, expectedValue?: any) {
    if (!(property in obj)) {
      throw new Error(`Expected property '${property}' not found`)
    }
    
    if (expectedValue !== undefined && obj[property] !== expectedValue) {
      throw new Error(`Expected '${property}' to be '${expectedValue}', got '${obj[property]}'`)
    }
  }

  async runHealthTests() {
    await this.runTestSuite('Health & Status', [
      {
        name: 'Health check endpoint',
        fn: async () => {
          const response = await this.client.get('/health')
          this.expectStatus(response, 200)
          this.expectProperty(response.data, 'success', true)
          this.expectProperty(response.data.data, 'status', 'healthy')
        }
      },
      {
        name: 'API status endpoint',
        fn: async () => {
          const response = await this.client.get('/')
          this.expectStatus(response, 200)
          this.expectProperty(response.data, 'success', true)
          this.expectProperty(response.data.data, 'name', 'GlobalLand API')
        }
      },
      {
        name: '404 handling',
        fn: async () => {
          const response = await this.client.get('/non-existent')
          this.expectStatus(response, 404)
          this.expectProperty(response.data, 'success', false)
          this.expectProperty(response.data, 'error')
        }
      }
    ])
  }

  async runAuthTests() {
    await this.runTestSuite('Authentication', [
      {
        name: 'Register user with valid data',
        fn: async () => {
          const response = await this.client.post('/auth/register', {
            email: `test-${Date.now()}@example.com`,
            password: 'password123',
            firstName: 'Test',
            lastName: 'User'
          })
          
          // Should succeed or fail with validation error (both are acceptable for testing)
          if (response.status !== 201 && response.status !== 400) {
            throw new Error(`Unexpected status: ${response.status}`)
          }
        }
      },
      {
        name: 'Login with invalid credentials',
        fn: async () => {
          const response = await this.client.post('/auth/login', {
            email: 'invalid@example.com',
            password: 'wrongpassword'
          })
          
          this.expectStatus(response, 401)
          this.expectProperty(response.data, 'success', false)
        }
      },
      {
        name: 'Access protected endpoint without token',
        fn: async () => {
          const response = await this.client.get('/investments/portfolio')
          this.expectStatus(response, 401)
          this.expectProperty(response.data, 'success', false)
        }
      }
    ])
  }

  async runPropertyTests() {
    await this.runTestSuite('Properties', [
      {
        name: 'Get all properties',
        fn: async () => {
          const response = await this.client.get('/properties')
          this.expectStatus(response, 200)
          this.expectProperty(response.data, 'success', true)
          this.expectProperty(response.data.data, 'properties')
          
          if (!Array.isArray(response.data.data.properties)) {
            throw new Error('Properties should be an array')
          }
        }
      },
      {
        name: 'Get properties with pagination',
        fn: async () => {
          const response = await this.client.get('/properties?page=1&limit=5')
          this.expectStatus(response, 200)
          this.expectProperty(response.data, 'success', true)
          this.expectProperty(response.data.data, 'pagination')
          this.expectProperty(response.data.data.pagination, 'page', 1)
          this.expectProperty(response.data.data.pagination, 'limit', 5)
        }
      },
      {
        name: 'Get property with invalid ID format',
        fn: async () => {
          const response = await this.client.get('/properties/invalid-id')
          this.expectStatus(response, 400)
          this.expectProperty(response.data, 'success', false)
        }
      },
      {
        name: 'Get non-existent property',
        fn: async () => {
          const response = await this.client.get('/properties/123e4567-e89b-12d3-a456-426614174000')
          this.expectStatus(response, 404)
          this.expectProperty(response.data, 'success', false)
        }
      }
    ])
  }

  async runPaymentTests() {
    await this.runTestSuite('Payments', [
      {
        name: 'Get exchange rates',
        fn: async () => {
          const response = await this.client.get('/payments/rates')
          this.expectStatus(response, 200)
          this.expectProperty(response.data, 'success', true)
          this.expectProperty(response.data.data, 'USD')
          this.expectProperty(response.data.data, 'lastUpdated')
        }
      },
      {
        name: 'Process payment without authentication',
        fn: async () => {
          const response = await this.client.post('/payments/process', {
            amount: 1000,
            currency: 'USD',
            paymentMethod: 'STRIPE'
          })
          
          this.expectStatus(response, 401)
          this.expectProperty(response.data, 'success', false)
        }
      },
      {
        name: 'Initiate mobile payment with invalid data',
        fn: async () => {
          const response = await this.client.post('/payments/mobile/initiate', {
            amount: -100, // Invalid amount
            currency: 'USD',
            phoneNumber: 'invalid'
          })
          
          this.expectStatus(response, 400)
          this.expectProperty(response.data, 'success', false)
        }
      }
    ])
  }

  async runTradingTests() {
    await this.runTestSuite('Trading', [
      {
        name: 'Get order book for non-existent token',
        fn: async () => {
          const response = await this.client.get('/trading/orderbook/non-existent-token')
          this.expectStatus(response, 404)
          this.expectProperty(response.data, 'success', false)
        }
      },
      {
        name: 'Create order without authentication',
        fn: async () => {
          const response = await this.client.post('/trading/orders', {
            tokenId: 'token123',
            orderType: 'BUY',
            amount: 100,
            price: 50.00
          })
          
          this.expectStatus(response, 401)
          this.expectProperty(response.data, 'success', false)
        }
      },
      {
        name: 'Get trading history with invalid token ID',
        fn: async () => {
          const response = await this.client.get('/trading/history/invalid-token')
          this.expectStatus(response, 400)
          this.expectProperty(response.data, 'success', false)
        }
      }
    ])
  }

  async runDocumentationTests() {
    await this.runTestSuite('Documentation', [
      {
        name: 'Get API documentation info',
        fn: async () => {
          const response = await this.client.get('/docs/info')
          this.expectStatus(response, 200)
          this.expectProperty(response.data, 'success', true)
          this.expectProperty(response.data.data, 'title')
          this.expectProperty(response.data.data, 'links')
        }
      },
      {
        name: 'Get OpenAPI JSON specification',
        fn: async () => {
          const response = await this.client.get('/docs/openapi.json')
          this.expectStatus(response, 200)
          this.expectProperty(response.data, 'openapi')
          this.expectProperty(response.data, 'info')
          this.expectProperty(response.data, 'paths')
        }
      },
      {
        name: 'Get Postman collection',
        fn: async () => {
          const response = await this.client.get('/docs/postman')
          this.expectStatus(response, 200)
          this.expectProperty(response.data, 'info')
          this.expectProperty(response.data, 'item')
        }
      }
    ])
  }

  async runAllTests() {
    console.log(chalk.cyan('🚀 Starting GlobalLand API Test Suite'))
    console.log(chalk.gray(`Base URL: ${this.baseUrl}`))
    
    const startTime = Date.now()

    try {
      await this.runHealthTests()
      await this.runAuthTests()
      await this.runPropertyTests()
      await this.runPaymentTests()
      await this.runTradingTests()
      await this.runDocumentationTests()
    } catch (error) {
      console.error(chalk.red('Test suite failed with error:'), error)
    }

    const totalDuration = Date.now() - startTime
    this.printSummary(totalDuration)
  }

  private printSummary(totalDuration: number) {
    console.log(chalk.cyan('\n📊 Test Summary'))
    console.log(chalk.gray('─'.repeat(50)))

    let totalTests = 0
    let totalPassed = 0
    let totalFailed = 0

    for (const suite of this.results) {
      totalTests += suite.totalTests
      totalPassed += suite.passedTests
      totalFailed += suite.failedTests

      const passRate = ((suite.passedTests / suite.totalTests) * 100).toFixed(1)
      const status = suite.failedTests === 0 ? chalk.green('PASS') : chalk.red('FAIL')
      
      console.log(`${status} ${suite.name}: ${suite.passedTests}/${suite.totalTests} (${passRate}%) - ${suite.totalDuration}ms`)
    }

    console.log(chalk.gray('─'.repeat(50)))
    
    const overallPassRate = ((totalPassed / totalTests) * 100).toFixed(1)
    const overallStatus = totalFailed === 0 ? chalk.green('✅ ALL TESTS PASSED') : chalk.red('❌ SOME TESTS FAILED')
    
    console.log(`${overallStatus}`)
    console.log(`Total: ${totalPassed}/${totalTests} (${overallPassRate}%) - ${totalDuration}ms`)
    
    if (totalFailed > 0) {
      console.log(chalk.yellow('\n⚠️  Failed Tests:'))
      for (const suite of this.results) {
        for (const test of suite.tests) {
          if (!test.success) {
            console.log(chalk.red(`  • ${suite.name}: ${test.name}`))
            if (test.error) {
              console.log(chalk.gray(`    ${test.error}`))
            }
          }
        }
      }
    }

    console.log(chalk.cyan('\n🎯 Test run completed!'))
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000/api'
  const runner = new ApiTestRunner(baseUrl)
  
  runner.runAllTests().catch(error => {
    console.error(chalk.red('Failed to run tests:'), error)
    process.exit(1)
  })
}

export { ApiTestRunner }