import { logger } from '../utils/logger'
import { performance } from 'perf_hooks'
import os from 'os'
import process from 'process'

export interface MetricData {
  name: string
  value: number
  unit: string
  timestamp: Date
  tags?: Record<string, string>
  metadata?: Record<string, any>
}

export interface PerformanceMetric {
  operation: string
  duration: number
  success: boolean
  timestamp: Date
  metadata?: Record<string, any>
}

export interface SystemMetrics {
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    used: number
    free: number
    total: number
    heapUsed: number
    heapTotal: number
    external: number
  }
  process: {
    uptime: number
    pid: number
    version: string
    platform: string
  }
  timestamp: Date
}

export interface BusinessMetrics {
  users: {
    total: number
    active: number
    newRegistrations: number
    kycApproved: number
  }
  properties: {
    total: number
    tokenized: number
    totalValuation: number
    averageValuation: number
  }
  investments: {
    total: number
    totalValue: number
    averageInvestment: number
    activeInvestors: number
  }
  transactions: {
    total: number
    successful: number
    failed: number
    totalVolume: number
  }
  timestamp: Date
}

class MonitoringService {
  private metrics: MetricData[] = []
  private performanceMetrics: PerformanceMetric[] = []
  private systemMetricsInterval?: NodeJS.Timeout
  private businessMetricsInterval?: NodeJS.Timeout
  private alertThresholds: Record<string, number> = {}

  constructor() {
    this.initializeAlertThresholds()
    this.startSystemMetricsCollection()
    this.startBusinessMetricsCollection()
  }

  private initializeAlertThresholds() {
    this.alertThresholds = {
      'cpu.usage': 80, // 80% CPU usage
      'memory.usage': 85, // 85% memory usage
      'response.time': 2000, // 2 seconds response time
      'error.rate': 5, // 5% error rate
      'database.connections': 80, // 80% of max connections
      'blockchain.failures': 10 // 10% blockchain failure rate
    }
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: Omit<MetricData, 'timestamp'>) {
    const metricData: MetricData = {
      ...metric,
      timestamp: new Date()
    }

    this.metrics.push(metricData)
    
    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }

    // Check for alerts
    this.checkAlerts(metricData)

    // Log metric
    logger.info('Metric recorded', {
      metric: metricData.name,
      value: metricData.value,
      unit: metricData.unit,
      tags: metricData.tags
    })
  }

  /**
   * Record performance metric
   */
  recordPerformance(metric: Omit<PerformanceMetric, 'timestamp'>) {
    const performanceMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date()
    }

    this.performanceMetrics.push(performanceMetric)

    // Keep only last 1000 performance metrics
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000)
    }

    // Log performance metric
    logger.info('Performance metric recorded', {
      operation: performanceMetric.operation,
      duration: performanceMetric.duration,
      success: performanceMetric.success
    })

    // Check for performance alerts
    if (performanceMetric.duration > this.alertThresholds['response.time']) {
      this.sendAlert('slow_response', {
        operation: performanceMetric.operation,
        duration: performanceMetric.duration,
        threshold: this.alertThresholds['response.time']
      })
    }
  }

  /**
   * Measure and record operation performance
   */
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now()
    let success = true
    let error: Error | null = null

    try {
      const result = await fn()
      return result
    } catch (err) {
      success = false
      error = err as Error
      throw err
    } finally {
      const duration = performance.now() - startTime

      this.recordPerformance({
        operation,
        duration,
        success,
        metadata: {
          ...metadata,
          error: error?.message
        }
      })
    }
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage()
    
    return {
      cpu: {
        usage: this.getCpuUsage(),
        loadAverage: os.loadavg()
      },
      memory: {
        used: memoryUsage.rss,
        free: os.freemem(),
        total: os.totalmem(),
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version,
        platform: process.platform
      },
      timestamp: new Date()
    }
  }

  /**
   * Get business metrics
   */
  async getBusinessMetrics(): Promise<BusinessMetrics> {
    // This would typically query the database for real metrics
    // For now, we'll return mock data structure
    return {
      users: {
        total: 0,
        active: 0,
        newRegistrations: 0,
        kycApproved: 0
      },
      properties: {
        total: 0,
        tokenized: 0,
        totalValuation: 0,
        averageValuation: 0
      },
      investments: {
        total: 0,
        totalValue: 0,
        averageInvestment: 0,
        activeInvestors: 0
      },
      transactions: {
        total: 0,
        successful: 0,
        failed: 0,
        totalVolume: 0
      },
      timestamp: new Date()
    }
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(limit: number = 100): MetricData[] {
    return this.metrics.slice(-limit)
  }

  /**
   * Get recent performance metrics
   */
  getRecentPerformanceMetrics(limit: number = 100): PerformanceMetric[] {
    return this.performanceMetrics.slice(-limit)
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(name: string, limit: number = 100): MetricData[] {
    return this.metrics
      .filter(metric => metric.name === name)
      .slice(-limit)
  }

  /**
   * Get performance metrics by operation
   */
  getPerformanceMetricsByOperation(operation: string, limit: number = 100): PerformanceMetric[] {
    return this.performanceMetrics
      .filter(metric => metric.operation === operation)
      .slice(-limit)
  }

  /**
   * Calculate average response time for operation
   */
  getAverageResponseTime(operation: string, timeWindow: number = 300000): number {
    const cutoff = new Date(Date.now() - timeWindow)
    const recentMetrics = this.performanceMetrics.filter(
      metric => metric.operation === operation && metric.timestamp > cutoff
    )

    if (recentMetrics.length === 0) return 0

    const totalDuration = recentMetrics.reduce((sum, metric) => sum + metric.duration, 0)
    return totalDuration / recentMetrics.length
  }

  /**
   * Calculate success rate for operation
   */
  getSuccessRate(operation: string, timeWindow: number = 300000): number {
    const cutoff = new Date(Date.now() - timeWindow)
    const recentMetrics = this.performanceMetrics.filter(
      metric => metric.operation === operation && metric.timestamp > cutoff
    )

    if (recentMetrics.length === 0) return 100

    const successfulOperations = recentMetrics.filter(metric => metric.success).length
    return (successfulOperations / recentMetrics.length) * 100
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical'
    checks: Record<string, { status: string; value?: number; threshold?: number }>
  } {
    const systemMetrics = this.getSystemMetrics()
    const checks: Record<string, { status: string; value?: number; threshold?: number }> = {}

    // CPU check
    const cpuUsage = systemMetrics.cpu.usage
    checks.cpu = {
      status: cpuUsage > 90 ? 'critical' : cpuUsage > 70 ? 'warning' : 'healthy',
      value: cpuUsage,
      threshold: 70
    }

    // Memory check
    const memoryUsage = (systemMetrics.memory.used / systemMetrics.memory.total) * 100
    checks.memory = {
      status: memoryUsage > 90 ? 'critical' : memoryUsage > 80 ? 'warning' : 'healthy',
      value: memoryUsage,
      threshold: 80
    }

    // Response time check
    const avgResponseTime = this.getAverageResponseTime('api_request')
    checks.responseTime = {
      status: avgResponseTime > 2000 ? 'critical' : avgResponseTime > 1000 ? 'warning' : 'healthy',
      value: avgResponseTime,
      threshold: 1000
    }

    // Success rate check
    const successRate = this.getSuccessRate('api_request')
    checks.successRate = {
      status: successRate < 95 ? 'critical' : successRate < 98 ? 'warning' : 'healthy',
      value: successRate,
      threshold: 98
    }

    // Overall status
    const criticalChecks = Object.values(checks).filter(check => check.status === 'critical')
    const warningChecks = Object.values(checks).filter(check => check.status === 'warning')

    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (criticalChecks.length > 0) {
      overallStatus = 'critical'
    } else if (warningChecks.length > 0) {
      overallStatus = 'warning'
    }

    return {
      status: overallStatus,
      checks
    }
  }

  /**
   * Start collecting system metrics
   */
  private startSystemMetricsCollection() {
    this.systemMetricsInterval = setInterval(() => {
      const systemMetrics = this.getSystemMetrics()

      // Record individual metrics
      this.recordMetric({
        name: 'system.cpu.usage',
        value: systemMetrics.cpu.usage,
        unit: 'percent'
      })

      this.recordMetric({
        name: 'system.memory.usage',
        value: (systemMetrics.memory.used / systemMetrics.memory.total) * 100,
        unit: 'percent'
      })

      this.recordMetric({
        name: 'system.memory.heap_used',
        value: systemMetrics.memory.heapUsed,
        unit: 'bytes'
      })

      this.recordMetric({
        name: 'system.process.uptime',
        value: systemMetrics.process.uptime,
        unit: 'seconds'
      })

    }, 30000) // Collect every 30 seconds
  }

  /**
   * Start collecting business metrics
   */
  private startBusinessMetricsCollection() {
    this.businessMetricsInterval = setInterval(async () => {
      try {
        const businessMetrics = await this.getBusinessMetrics()

        // Record business metrics
        this.recordMetric({
          name: 'business.users.total',
          value: businessMetrics.users.total,
          unit: 'count'
        })

        this.recordMetric({
          name: 'business.properties.total',
          value: businessMetrics.properties.total,
          unit: 'count'
        })

        this.recordMetric({
          name: 'business.investments.total_value',
          value: businessMetrics.investments.totalValue,
          unit: 'currency'
        })

        this.recordMetric({
          name: 'business.transactions.success_rate',
          value: businessMetrics.transactions.total > 0 
            ? (businessMetrics.transactions.successful / businessMetrics.transactions.total) * 100 
            : 100,
          unit: 'percent'
        })

      } catch (error) {
        logger.error('Failed to collect business metrics', error);
      }
    }, 60000) // Collect every minute
  }

  /**
   * Check for alerts
   */
  private checkAlerts(metric: MetricData) {
    const threshold = this.alertThresholds[metric.name]
    if (threshold && metric.value > threshold) {
      this.sendAlert('threshold_exceeded', {
        metric: metric.name,
        value: metric.value,
        threshold,
        unit: metric.unit
      })
    }
  }

  /**
   * Send alert
   */
  private sendAlert(type: string, data: Record<string, any>) {
    logger.warn('Alert triggered', {
      type,
      data,
      timestamp: new Date()
    })

    // Here you would integrate with alerting systems like:
    // - PagerDuty
    // - Slack
    // - Email notifications
    // - SMS alerts
  }

  /**
   * Get CPU usage (simplified calculation)
   */
  private getCpuUsage(): number {
    // This is a simplified CPU usage calculation
    // In production, you might want to use a more sophisticated method
    const loadAvg = os.loadavg()[0]
    const cpuCount = os.cpus().length
    return Math.min((loadAvg / cpuCount) * 100, 100)
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    metrics: MetricData[]
    performance: PerformanceMetric[]
    system: SystemMetrics
    timestamp: Date
  } {
    return {
      metrics: this.getRecentMetrics(),
      performance: this.getRecentPerformanceMetrics(),
      system: this.getSystemMetrics(),
      timestamp: new Date()
    }
  }

  /**
   * Cleanup and stop monitoring
   */
  stop() {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval)
    }
    if (this.businessMetricsInterval) {
      clearInterval(this.businessMetricsInterval)
    }
  }
}

export default new MonitoringService()