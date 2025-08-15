import { Request, Response } from 'express'
import MonitoringService from '../services/MonitoringService'
import AnalyticsService from '../services/AnalyticsService'
import HealthCheckService from '../services/HealthCheckService'
import { logger } from '../utils/logger'

interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    role: string
    [key: string]: any
  }
}

export class MonitoringController {
  /**
   * Get system health status
   */
  getHealthStatus = async (req: Request, res: Response) => {
    try {
      const healthStatus = await HealthCheckService.runAllChecks()
      
      res.json({
        success: true,
        data: healthStatus
      })
    } catch (error) {
      logger.error('Error getting health status', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health status'
      })
    }
  }

  /**
   * Get specific health check
   */
  getHealthCheck = async (req: Request, res: Response) => {
    try {
      const { checkName } = req.params
      const healthCheck = HealthCheckService.getHealthCheck(checkName)
      
      if (!healthCheck) {
        return res.status(404).json({
          success: false,
          error: 'Health check not found'
        })
      }

      res.json({
        success: true,
        data: healthCheck
      })
    } catch (error) {
      logger.error('Error getting health check', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health check'
      })
    }
  }

  /**
   * Get system metrics
   */
  getSystemMetrics = async (req: Request, res: Response) => {
    try {
      const systemMetrics = MonitoringService.getSystemMetrics()
      
      res.json({
        success: true,
        data: systemMetrics
      })
    } catch (error) {
      logger.error('Error getting system metrics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system metrics'
      })
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics = async (req: Request, res: Response) => {
    try {
      const { operation, limit } = req.query
      
      let metrics
      if (operation) {
        metrics = MonitoringService.getPerformanceMetricsByOperation(
          operation as string,
          parseInt(limit as string) || 100
        )
      } else {
        metrics = MonitoringService.getRecentPerformanceMetrics(
          parseInt(limit as string) || 100
        )
      }
      
      res.json({
        success: true,
        data: metrics
      })
    } catch (error) {
      logger.error('Error getting performance metrics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance metrics'
      })
    }
  }

  /**
   * Get custom metrics
   */
  getCustomMetrics = async (req: Request, res: Response) => {
    try {
      const { name, limit } = req.query
      
      let metrics
      if (name) {
        metrics = MonitoringService.getMetricsByName(
          name as string,
          parseInt(limit as string) || 100
        )
      } else {
        metrics = MonitoringService.getRecentMetrics(
          parseInt(limit as string) || 100
        )
      }
      
      res.json({
        success: true,
        data: metrics
      })
    } catch (error) {
      logger.error('Error getting custom metrics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get custom metrics'
      })
    }
  }

  /**
   * Get business analytics
   */
  getBusinessAnalytics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Admin role required.'
        })
      }

      const { timeRange } = req.query
      const analytics = await AnalyticsService.getBusinessAnalytics(
        timeRange as 'day' | 'week' | 'month' | 'year'
      )
      
      res.json({
        success: true,
        data: analytics
      })
    } catch (error) {
      logger.error('Error getting business analytics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get business analytics'
      })
    }
  }

  /**
   * Get user behavior analytics
   */
  getUserBehaviorAnalytics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params
      
      // Users can only access their own analytics, admins can access any
      if (req.user?.role !== 'admin' && req.user?.id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        })
      }

      const analytics = await AnalyticsService.getUserBehaviorAnalytics(userId)
      
      res.json({
        success: true,
        data: analytics
      })
    } catch (error) {
      logger.error('Error getting user behavior analytics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user behavior analytics'
      })
    }
  }

  /**
   * Get property analytics
   */
  getPropertyAnalytics = async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params
      const analytics = await AnalyticsService.getPropertyAnalytics(propertyId)
      
      res.json({
        success: true,
        data: analytics
      })
    } catch (error) {
      logger.error('Error getting property analytics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get property analytics'
      })
    }
  }

  /**
   * Get real-time analytics
   */
  getRealTimeAnalytics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Admin role required.'
        })
      }

      const analytics = AnalyticsService.getRealTimeAnalytics()
      
      res.json({
        success: true,
        data: analytics
      })
    } catch (error) {
      logger.error('Error getting real-time analytics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get real-time analytics'
      })
    }
  }

  /**
   * Get funnel analysis
   */
  getFunnelAnalysis = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Admin role required.'
        })
      }

      const { steps } = req.body
      
      if (!steps || !Array.isArray(steps)) {
        return res.status(400).json({
          success: false,
          error: 'Steps array is required'
        })
      }

      const funnelAnalysis = AnalyticsService.getFunnelAnalysis(steps)
      
      res.json({
        success: true,
        data: funnelAnalysis
      })
    } catch (error) {
      logger.error('Error getting funnel analysis', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get funnel analysis'
      })
    }
  }

  /**
   * Track user event
   */
  trackEvent = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { event, properties } = req.body
      const userId = req.user?.id
      
      if (!event) {
        return res.status(400).json({
          success: false,
          error: 'Event name is required'
        })
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
      }

      AnalyticsService.trackEvent({
        userId,
        event,
        properties: properties || {},
        sessionId: req.headers['x-session-id'] as string,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      })
      
      res.json({
        success: true,
        message: 'Event tracked successfully'
      })
    } catch (error) {
      logger.error('Error tracking event', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track event'
      })
    }
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Admin role required.'
        })
      }

      const metrics = MonitoringService.exportMetrics()
      
      // Set appropriate headers for metrics export
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="metrics-${Date.now()}.json"`)
      
      res.json(metrics)
    } catch (error) {
      logger.error('Error exporting metrics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export metrics'
      })
    }
  }

  /**
   * Get average response time for operation
   */
  getAverageResponseTime = async (req: Request, res: Response) => {
    try {
      const { operation } = req.params
      const { timeWindow } = req.query
      
      const averageTime = MonitoringService.getAverageResponseTime(
        operation,
        parseInt(timeWindow as string) || 300000
      )
      
      res.json({
        success: true,
        data: {
          operation,
          averageResponseTime: averageTime,
          timeWindow: parseInt(timeWindow as string) || 300000
        }
      })
    } catch (error) {
      logger.error('Error getting average response time', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get average response time'
      })
    }
  }

  /**
   * Get success rate for operation
   */
  getSuccessRate = async (req: Request, res: Response) => {
    try {
      const { operation } = req.params
      const { timeWindow } = req.query
      
      const successRate = MonitoringService.getSuccessRate(
        operation,
        parseInt(timeWindow as string) || 300000
      )
      
      res.json({
        success: true,
        data: {
          operation,
          successRate,
          timeWindow: parseInt(timeWindow as string) || 300000
        }
      })
    } catch (error) {
      logger.error('Error getting success rate', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get success rate'
      })
    }
  }

  /**
   * Get monitoring dashboard data
   */
  getDashboardData = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user has admin role
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Admin role required.'
        })
      }

      const [
        healthStatus,
        systemMetrics,
        businessAnalytics,
        realTimeAnalytics
      ] = await Promise.all([
        HealthCheckService.getSystemHealth(),
        MonitoringService.getSystemMetrics(),
        AnalyticsService.getBusinessAnalytics('day'),
        AnalyticsService.getRealTimeAnalytics()
      ])
      
      res.json({
        success: true,
        data: {
          health: healthStatus,
          system: systemMetrics,
          business: businessAnalytics,
          realTime: realTimeAnalytics,
          timestamp: new Date()
        }
      })
    } catch (error) {
      logger.error('Error getting dashboard data', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard data'
      })
    }
  }
}