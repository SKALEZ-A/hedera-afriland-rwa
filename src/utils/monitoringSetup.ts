import { logger } from './logger'
import MonitoringService from '../services/MonitoringService'
import HealthCheckService from '../services/HealthCheckService'
import AnalyticsService from '../services/AnalyticsService'

/**
 * Initialize monitoring services
 */
export const initializeMonitoring = async (): Promise<void> => {
  try {
    logger.info('Initializing monitoring services...');

    // Start health checks
    HealthCheckService.startPeriodicChecks(30000) // Every 30 seconds
    logger.info('Health check service started');

    // Record startup metrics
    MonitoringService.recordMetric({
      name: 'system.startup',
      value: 1,
      unit: 'count',
      tags: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0'
      }
    })

    // Track application startup event
    AnalyticsService.trackEvent({
      userId: 'system',
      event: 'application_startup',
      properties: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime().toString()
      }
    })

    logger.info('Monitoring services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize monitoring services', error);
    throw error;
  }
}

/**
 * Shutdown monitoring services gracefully
 */
export const shutdownMonitoring = async (): Promise<void> => {
  try {
    logger.info('Shutting down monitoring services...');

    // Stop health checks
    HealthCheckService.stopPeriodicChecks()

    // Stop monitoring service
    MonitoringService.stop()

    // Record shutdown metrics
    MonitoringService.recordMetric({
      name: 'system.shutdown',
      value: 1,
      unit: 'count',
      tags: {
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime().toString()
      }
    })

    logger.info('Monitoring services shut down successfully');
  } catch (error) {
    logger.error('Error shutting down monitoring services', error);
  }
}

/**
 * Setup monitoring for uncaught exceptions and rejections
 */
export const setupGlobalErrorMonitoring = (): void => {
  // Monitor uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      category: 'system_error'
    })

    MonitoringService.recordMetric({
      name: 'system.uncaught_exceptions',
      value: 1,
      unit: 'count',
      tags: {
        errorType: error.name
      }
    })

    // Give time for logs to be written before exiting
    setTimeout(() => {
      process.exit(1)
    }, 1000)
  })

  // Monitor unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? {
        name: reason.name,
        message: reason.message,
        stack: reason.stack
      } : reason,
      promise: promise.toString(),
      category: 'system_error'
    })

    MonitoringService.recordMetric({
      name: 'system.unhandled_rejections',
      value: 1,
      unit: 'count',
      tags: {
        reasonType: typeof reason
      }
    })
  })

  // Monitor memory warnings
  process.on('warning', (warning: Error) => {
    logger.warn('Process Warning', {
      warning: {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      },
      category: 'system_warning'
    })

    MonitoringService.recordMetric({
      name: 'system.warnings',
      value: 1,
      unit: 'count',
      tags: {
        warningType: warning.name
      }
    })
  })

  // Monitor SIGTERM and SIGINT for graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, initiating graceful shutdown');
    await shutdownMonitoring()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, initiating graceful shutdown');
    await shutdownMonitoring()
    process.exit(0)
  })
}

/**
 * Setup periodic system metrics collection
 */
export const setupSystemMetricsCollection = (): void => {
  // Collect system metrics every minute
  setInterval(() => {
    const memoryUsage = process.memoryUsage()
    
    // Memory metrics
    MonitoringService.recordMetric({
      name: 'system.memory.heap_used',
      value: memoryUsage.heapUsed,
      unit: 'bytes'
    })

    MonitoringService.recordMetric({
      name: 'system.memory.heap_total',
      value: memoryUsage.heapTotal,
      unit: 'bytes'
    })

    MonitoringService.recordMetric({
      name: 'system.memory.external',
      value: memoryUsage.external,
      unit: 'bytes'
    })

    MonitoringService.recordMetric({
      name: 'system.memory.rss',
      value: memoryUsage.rss,
      unit: 'bytes'
    })

    // Process metrics
    MonitoringService.recordMetric({
      name: 'system.process.uptime',
      value: process.uptime(),
      unit: 'seconds'
    })

    MonitoringService.recordMetric({
      name: 'system.process.cpu_usage',
      value: process.cpuUsage().user + process.cpuUsage().system,
      unit: 'microseconds'
    })

  }, 60000) // Every minute
}

/**
 * Setup business metrics collection
 */
export const setupBusinessMetricsCollection = (): void => {
  // Collect business metrics every 5 minutes
  setInterval(async () => {
    try {
      const businessMetrics = await AnalyticsService.getBusinessAnalytics('day')
      
      // Record key business metrics
      MonitoringService.recordMetric({
        name: 'business.users.total',
        value: businessMetrics.userMetrics.totalUsers,
        unit: 'count'
      })

      MonitoringService.recordMetric({
        name: 'business.users.active',
        value: businessMetrics.userMetrics.activeUsers,
        unit: 'count'
      })

      MonitoringService.recordMetric({
        name: 'business.properties.total',
        value: businessMetrics.propertyMetrics.totalProperties,
        unit: 'count'
      })

      MonitoringService.recordMetric({
        name: 'business.investments.total_value',
        value: businessMetrics.investmentMetrics.totalInvestmentValue,
        unit: 'currency'
      })

      MonitoringService.recordMetric({
        name: 'business.transactions.success_rate',
        value: businessMetrics.transactionMetrics.totalTransactions > 0 
          ? (businessMetrics.transactionMetrics.successfulTransactions / businessMetrics.transactionMetrics.totalTransactions) * 100 
          : 100,
        unit: 'percent'
      })

    } catch (error) {
      logger.error('Error collecting business metrics', error);
    }
  }, 5 * 60 * 1000) // Every 5 minutes
}

/**
 * Setup alerting thresholds
 */
export const setupAlerting = (): void => {
  // This would integrate with external alerting systems
  // For now, we'll set up basic threshold monitoring

  setInterval(() => {
    const healthStatus = HealthCheckService.getSystemHealth()
    
    if (healthStatus.status === 'critical') {
      logger.error('CRITICAL ALERT: System health is critical', {
        category: 'alert',
        alertType: 'system_health',
        severity: 'critical',
        details: healthStatus.checks.filter(check => check.status === 'critical')
      })

      // In production, this would trigger:
      // - PagerDuty alerts
      // - Slack notifications
      // - Email alerts
      // - SMS notifications
    }

    if (healthStatus.status === 'warning') {
      logger.warn('WARNING ALERT: System health degraded', {
        category: 'alert',
        alertType: 'system_health',
        severity: 'warning',
        details: healthStatus.checks.filter(check => check.status === 'warning')
      })
    }

  }, 2 * 60 * 1000) // Every 2 minutes
}

/**
 * Initialize all monitoring components
 */
export const initializeAllMonitoring = async (): Promise<void> => {
  await initializeMonitoring()
  setupGlobalErrorMonitoring()
  setupSystemMetricsCollection()
  setupBusinessMetricsCollection()
  setupAlerting()
  
  logger.info('All monitoring components initialized successfully');
}