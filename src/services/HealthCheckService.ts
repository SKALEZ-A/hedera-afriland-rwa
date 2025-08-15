import { logger } from '../utils/logger'
import { Pool } from 'pg'
import Redis from 'ioredis'
import { HederaService } from './HederaService'
import axios from 'axios'
import os from 'os'
import process from 'process'

export interface HealthCheck {
  name: string
  status: 'healthy' | 'warning' | 'critical'
  responseTime: number
  message?: string
  details?: any
  lastChecked: Date
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  timestamp: Date
  uptime: number
  version: string
  environment: string
  checks: HealthCheck[]
  summary: {
    healthy: number
    warning: number
    critical: number
    total: number
  }
}

class HealthCheckService {
  private checks: Map<string, HealthCheck> = new Map()
  private checkInterval?: NodeJS.Timeout
  private isRunning = false

  constructor() {
    this.initializeChecks()
  }

  /**
   * Initialize health checks
   */
  private initializeChecks() {
    // Register all health checks
    this.registerCheck('database', this.checkDatabase.bind(this))
    this.registerCheck('redis', this.checkRedis.bind(this))
    this.registerCheck('blockchain', this.checkBlockchain.bind(this))
    this.registerCheck('external_apis', this.checkExternalAPIs.bind(this))
    this.registerCheck('file_system', this.checkFileSystem.bind(this))
    this.registerCheck('memory', this.checkMemory.bind(this))
    this.registerCheck('cpu', this.checkCPU.bind(this))
    this.registerCheck('disk_space', this.checkDiskSpace.bind(this))
  }

  /**
   * Register a health check
   */
  private registerCheck(name: string, checkFunction: () => Promise<Omit<HealthCheck, 'name' | 'lastChecked'>>) {
    // Initialize with unknown status
    this.checks.set(name, {
      name,
      status: 'warning',
      responseTime: 0,
      message: 'Not yet checked',
      lastChecked: new Date()
    })
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(intervalMs: number = 30000) {
    if (this.isRunning) {
      logger.warn('Health checks already running')
      return
    }

    this.isRunning = true
    logger.info('Starting periodic health checks', { intervalMs });

    // Run initial check
    this.runAllChecks()

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.runAllChecks()
    }, intervalMs)
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = undefined
    }
    this.isRunning = false
    logger.info('Stopped periodic health checks');
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<SystemHealth> {
    const startTime = Date.now()
    logger.debug('Running all health checks')

    const checkPromises = Array.from(this.checks.keys()).map(async (checkName) => {
      try {
        const result = await this.runSingleCheck(checkName)
        this.checks.set(checkName, result)
        return result
      } catch (error) {
        logger.error(`Health check failed: ${checkName}`, error);
        const failedCheck: HealthCheck = {
          name: checkName,
          status: 'critical',
          responseTime: Date.now() - startTime,
          message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date()
        }
        this.checks.set(checkName, failedCheck)
        return failedCheck
      }
    })

    const results = await Promise.all(checkPromises)
    const systemHealth = this.buildSystemHealth(results)

    // Log overall health status
    logger.health('system', systemHealth.status, {
      duration: Date.now() - startTime,
      summary: systemHealth.summary
    })

    return systemHealth
  }

  /**
   * Run a single health check
   */
  private async runSingleCheck(checkName: string): Promise<HealthCheck> {
    const startTime = Date.now()

    let result: Omit<HealthCheck, 'name' | 'lastChecked'>

    switch (checkName) {
      case 'database':
        result = await this.checkDatabase()
        break
      case 'redis':
        result = await this.checkRedis()
        break
      case 'blockchain':
        result = await this.checkBlockchain()
        break
      case 'external_apis':
        result = await this.checkExternalAPIs()
        break
      case 'file_system':
        result = await this.checkFileSystem()
        break
      case 'memory':
        result = await this.checkMemory()
        break
      case 'cpu':
        result = await this.checkCPU()
        break
      case 'disk_space':
        result = await this.checkDiskSpace()
        break
      default:
        throw new Error(`Unknown health check: ${checkName}`)
    }

    return {
      name: checkName,
      ...result,
      responseTime: Date.now() - startTime,
      lastChecked: new Date()
    }
  }

  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth {
    const checks = Array.from(this.checks.values())
    return this.buildSystemHealth(checks)
  }

  /**
   * Get specific health check
   */
  getHealthCheck(name: string): HealthCheck | undefined {
    return this.checks.get(name)
  }

  /**
   * Build system health summary
   */
  private buildSystemHealth(checks: HealthCheck[]): SystemHealth {
    const summary = {
      healthy: checks.filter(c => c.status === 'healthy').length,
      warning: checks.filter(c => c.status === 'warning').length,
      critical: checks.filter(c => c.status === 'critical').length,
      total: checks.length
    }

    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (summary.critical > 0) {
      overallStatus = 'critical'
    } else if (summary.warning > 0) {
      overallStatus = 'warning'
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary
    }
  }

  // Individual health check implementations

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<Omit<HealthCheck, 'name' | 'lastChecked'>> {
    try {
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'globalland',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        connectionTimeoutMillis: 5000
      })

      const startTime = Date.now()
      const result = await pool.query('SELECT 1 as health_check')
      const responseTime = Date.now() - startTime
      
      await pool.end()

      if (result.rows[0].health_check === 1) {
        return {
          status: responseTime > 1000 ? 'warning' : 'healthy',
          responseTime,
          message: responseTime > 1000 ? 'Database responding slowly' : 'Database connection healthy',
          details: { responseTime }
        }
      } else {
        return {
          status: 'critical',
          responseTime,
          message: 'Database query returned unexpected result'
        }
      }
    } catch (error) {
      return {
        status: 'critical',
        responseTime: 0,
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<Omit<HealthCheck, 'name' | 'lastChecked'>> {
    let redis: Redis | null = null
    
    try {
      redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        connectTimeout: 5000,
        lazyConnect: true
      })

      const startTime = Date.now()
      await redis.ping()
      const responseTime = Date.now() - startTime

      return {
        status: responseTime > 500 ? 'warning' : 'healthy',
        responseTime,
        message: responseTime > 500 ? 'Redis responding slowly' : 'Redis connection healthy',
        details: { responseTime }
      }
    } catch (error) {
      return {
        status: 'critical',
        responseTime: 0,
        message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    } finally {
      if (redis) {
        await redis.disconnect()
      }
    }
  }

  /**
   * Check blockchain connectivity
   */
  private async checkBlockchain(): Promise<Omit<HealthCheck, 'name' | 'lastChecked'>> {
    try {
      const hederaService = new HederaService()
      const startTime = Date.now()
      
      // Check if we can connect to Hedera network
      const accountBalance = await hederaService.getAccountBalance()
      const responseTime = Date.now() - startTime

      return {
        status: responseTime > 2000 ? 'warning' : 'healthy',
        responseTime,
        message: responseTime > 2000 ? 'Blockchain responding slowly' : 'Blockchain connection healthy',
        details: { 
          responseTime,
          accountBalance: accountBalance.toString()
        }
      }
    } catch (error) {
      return {
        status: 'critical',
        responseTime: 0,
        message: `Blockchain connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Check external APIs
   */
  private async checkExternalAPIs(): Promise<Omit<HealthCheck, 'name' | 'lastChecked'>> {
    const apis = [
      { name: 'Stripe', url: 'https://api.stripe.com/v1' },
      // Add other external APIs as needed
    ]

    const results = await Promise.allSettled(
      apis.map(async (api) => {
        const startTime = Date.now()
        try {
          await axios.get(api.url, { timeout: 5000 })
          return {
            name: api.name,
            status: 'healthy' as const,
            responseTime: Date.now() - startTime
          }
        } catch (error) {
          return {
            name: api.name,
            status: 'critical' as const,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
    )

    const apiResults = results.map(result => 
      result.status === 'fulfilled' ? result.value : { status: 'critical', error: 'Promise rejected' }
    )

    const criticalApis = apiResults.filter(r => r.status === 'critical')
    const avgResponseTime = apiResults.reduce((sum, r) => sum + (r.responseTime || 0), 0) / apiResults.length

    return {
      status: criticalApis.length > 0 ? 'critical' : avgResponseTime > 2000 ? 'warning' : 'healthy',
      responseTime: avgResponseTime,
      message: criticalApis.length > 0 
        ? `${criticalApis.length} external APIs are down`
        : 'All external APIs are healthy',
      details: { apis: apiResults }
    }
  }

  /**
   * Check file system
   */
  private async checkFileSystem(): Promise<Omit<HealthCheck, 'name' | 'lastChecked'>> {
    try {
      const fs = require('fs').promises
      const testFile = '/tmp/health-check-test.txt'
      const testContent = 'health check test'

      const startTime = Date.now()
      
      // Write test file
      await fs.writeFile(testFile, testContent)
      
      // Read test file
      const content = await fs.readFile(testFile, 'utf8')
      
      // Delete test file
      await fs.unlink(testFile)
      
      const responseTime = Date.now() - startTime

      if (content === testContent) {
        return {
          status: responseTime > 100 ? 'warning' : 'healthy',
          responseTime,
          message: responseTime > 100 ? 'File system responding slowly' : 'File system healthy'
        }
      } else {
        return {
          status: 'critical',
          responseTime,
          message: 'File system read/write test failed'
        }
      }
    } catch (error) {
      return {
        status: 'critical',
        responseTime: 0,
        message: `File system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<Omit<HealthCheck, 'name' | 'lastChecked'>> {
    const memoryUsage = process.memoryUsage()
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const memoryUsagePercent = (usedMemory / totalMemory) * 100

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    let message = 'Memory usage is normal'

    if (memoryUsagePercent > 90) {
      status = 'critical'
      message = 'Memory usage is critically high'
    } else if (memoryUsagePercent > 80) {
      status = 'warning'
      message = 'Memory usage is high'
    }

    return {
      status,
      responseTime: 0,
      message,
      details: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        systemMemoryUsage: memoryUsagePercent,
        totalMemory,
        freeMemory
      }
    }
  }

  /**
   * Check CPU usage
   */
  private async checkCPU(): Promise<Omit<HealthCheck, 'name' | 'lastChecked'>> {
    const loadAverage = os.loadavg()
    const cpuCount = os.cpus().length
    const cpuUsage = (loadAverage[0] / cpuCount) * 100

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    let message = 'CPU usage is normal'

    if (cpuUsage > 90) {
      status = 'critical'
      message = 'CPU usage is critically high'
    } else if (cpuUsage > 70) {
      status = 'warning'
      message = 'CPU usage is high'
    }

    return {
      status,
      responseTime: 0,
      message,
      details: {
        loadAverage,
        cpuCount,
        cpuUsage
      }
    }
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<Omit<HealthCheck, 'name' | 'lastChecked'>> {
    try {
      const { execSync } = require('child_process')
      const diskUsage = execSync('df -h /', { encoding: 'utf8' })
      const lines = diskUsage.trim().split('\n')
      const data = lines[1].split(/\s+/)
      const usagePercent = parseInt(data[4].replace('%', ''))

      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      let message = 'Disk space is sufficient'

      if (usagePercent > 90) {
        status = 'critical'
        message = 'Disk space is critically low'
      } else if (usagePercent > 80) {
        status = 'warning'
        message = 'Disk space is running low'
      }

      return {
        status,
        responseTime: 0,
        message,
        details: {
          filesystem: data[0],
          size: data[1],
          used: data[2],
          available: data[3],
          usagePercent
        }
      }
    } catch (error) {
      return {
        status: 'warning',
        responseTime: 0,
        message: 'Could not check disk space',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }
}

export default new HealthCheckService()