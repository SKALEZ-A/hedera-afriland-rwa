import { logger } from '../utils/logger'
import { UserModel } from '../models/UserModel'
import { PropertyModel } from '../models/PropertyModel'
import { InvestmentModel } from '../models/InvestmentModel'
import { TransactionModel } from '../models/TransactionModel'

export interface UserEvent {
  userId: string
  event: string
  properties: Record<string, any>
  timestamp: Date
  sessionId?: string
  userAgent?: string
  ipAddress?: string
}

export interface BusinessAnalytics {
  userMetrics: {
    totalUsers: number
    activeUsers: number
    newUsers: number
    retentionRate: number
    averageSessionDuration: number
    topCountries: Array<{ country: string; count: number }>
  }
  propertyMetrics: {
    totalProperties: number
    tokenizedProperties: number
    totalValuation: number
    averagePropertyValue: number
    propertiesByType: Array<{ type: string; count: number }>
    propertiesByLocation: Array<{ location: string; count: number }>
  }
  investmentMetrics: {
    totalInvestments: number
    totalInvestmentValue: number
    averageInvestmentSize: number
    activeInvestors: number
    investmentsByProperty: Array<{ propertyId: string; count: number; value: number }>
    monthlyInvestmentTrend: Array<{ month: string; count: number; value: number }>
  }
  transactionMetrics: {
    totalTransactions: number
    successfulTransactions: number
    failedTransactions: number
    totalVolume: number
    averageTransactionValue: number
    transactionsByType: Array<{ type: string; count: number }>
    dailyTransactionTrend: Array<{ date: string; count: number; volume: number }>
  }
  performanceMetrics: {
    averageResponseTime: number
    errorRate: number
    uptime: number
    apiCallsPerDay: number
    slowestEndpoints: Array<{ endpoint: string; averageTime: number }>
  }
}

export interface UserBehaviorAnalytics {
  userId: string
  totalSessions: number
  totalPageViews: number
  averageSessionDuration: number
  lastActiveDate: Date
  favoriteFeatures: Array<{ feature: string; usage: number }>
  investmentPattern: {
    totalInvestments: number
    averageInvestmentSize: number
    preferredPropertyTypes: string[]
    riskProfile: 'conservative' | 'moderate' | 'aggressive'
  }
  engagementScore: number
}

export interface PropertyAnalytics {
  propertyId: string
  viewCount: number
  investorCount: number
  totalInvestmentValue: number
  averageInvestmentSize: number
  conversionRate: number
  popularityScore: number
  performanceMetrics: {
    dividendYield: number
    priceAppreciation: number
    totalReturn: number
  }
}

class AnalyticsService {
  private events: UserEvent[] = []
  private readonly MAX_EVENTS_IN_MEMORY = 10000

  /**
   * Track user event
   */
  trackEvent(event: Omit<UserEvent, 'timestamp'>) {
    const userEvent: UserEvent = {
      ...event,
      timestamp: new Date()
    }

    this.events.push(userEvent)

    // Keep only recent events in memory
    if (this.events.length > this.MAX_EVENTS_IN_MEMORY) {
      this.events = this.events.slice(-this.MAX_EVENTS_IN_MEMORY)
    }

    // Log event
    logger.info('User event tracked', {
      userId: userEvent.userId,
      event: userEvent.event,
      properties: userEvent.properties
    })

    // In production, you would send this to analytics platforms like:
    // - Google Analytics
    // - Mixpanel
    // - Amplitude
    // - Custom analytics database
  }

  /**
   * Track page view
   */
  trackPageView(userId: string, page: string, properties?: Record<string, any>) {
    this.trackEvent({
      userId,
      event: 'page_view',
      properties: {
        page,
        ...properties
      }
    })
  }

  /**
   * Track user action
   */
  trackUserAction(userId: string, action: string, properties?: Record<string, any>) {
    this.trackEvent({
      userId,
      event: 'user_action',
      properties: {
        action,
        ...properties
      }
    })
  }

  /**
   * Track investment event
   */
  trackInvestment(userId: string, propertyId: string, amount: number, tokenAmount: number) {
    this.trackEvent({
      userId,
      event: 'investment_made',
      properties: {
        propertyId,
        amount,
        tokenAmount,
        timestamp: new Date()
      }
    })
  }

  /**
   * Track property view
   */
  trackPropertyView(userId: string, propertyId: string, source?: string) {
    this.trackEvent({
      userId,
      event: 'property_viewed',
      properties: {
        propertyId,
        source
      }
    })
  }

  /**
   * Track transaction
   */
  trackTransaction(userId: string, transactionType: string, amount: number, status: string) {
    this.trackEvent({
      userId,
      event: 'transaction',
      properties: {
        transactionType,
        amount,
        status
      }
    })
  }

  /**
   * Get business analytics
   */
  async getBusinessAnalytics(timeRange: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<BusinessAnalytics> {
    const endDate = new Date()
    const startDate = new Date()
    
    switch (timeRange) {
      case 'day':
        startDate.setDate(endDate.getDate() - 1)
        break
      case 'week':
        startDate.setDate(endDate.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1)
        break
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1)
        break
    }

    try {
      // User metrics
      const totalUsers = await UserModel.count()
      const newUsers = await UserModel.count({
        createdAt: { $gte: startDate }
      })
      const activeUsers = this.getActiveUsersCount(startDate, endDate)

      // Property metrics
      const totalProperties = await PropertyModel.count()
      const tokenizedProperties = await PropertyModel.count({
        status: 'tokenized'
      })

      // Investment metrics
      const totalInvestments = await InvestmentModel.count()
      const investmentData = await InvestmentModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalValue: { $sum: '$investmentValue' },
            averageSize: { $avg: '$investmentValue' },
            count: { $sum: 1 }
          }
        }
      ])

      // Transaction metrics
      const transactionData = await TransactionModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalVolume: { $sum: '$amount' }
          }
        }
      ])

      return {
        userMetrics: {
          totalUsers,
          activeUsers,
          newUsers,
          retentionRate: this.calculateRetentionRate(timeRange),
          averageSessionDuration: this.calculateAverageSessionDuration(),
          topCountries: await this.getTopCountries()
        },
        propertyMetrics: {
          totalProperties,
          tokenizedProperties,
          totalValuation: await this.getTotalPropertyValuation(),
          averagePropertyValue: await this.getAveragePropertyValue(),
          propertiesByType: await this.getPropertiesByType(),
          propertiesByLocation: await this.getPropertiesByLocation()
        },
        investmentMetrics: {
          totalInvestments,
          totalInvestmentValue: investmentData[0]?.totalValue || 0,
          averageInvestmentSize: investmentData[0]?.averageSize || 0,
          activeInvestors: await this.getActiveInvestorsCount(),
          investmentsByProperty: await this.getInvestmentsByProperty(),
          monthlyInvestmentTrend: await this.getMonthlyInvestmentTrend()
        },
        transactionMetrics: {
          totalTransactions: transactionData.reduce((sum, item) => sum + item.count, 0),
          successfulTransactions: transactionData.find(item => item._id === 'completed')?.count || 0,
          failedTransactions: transactionData.find(item => item._id === 'failed')?.count || 0,
          totalVolume: transactionData.reduce((sum, item) => sum + item.totalVolume, 0),
          averageTransactionValue: await this.getAverageTransactionValue(),
          transactionsByType: await this.getTransactionsByType(),
          dailyTransactionTrend: await this.getDailyTransactionTrend()
        },
        performanceMetrics: {
          averageResponseTime: this.calculateAverageResponseTime(),
          errorRate: this.calculateErrorRate(),
          uptime: this.calculateUptime(),
          apiCallsPerDay: this.getApiCallsPerDay(),
          slowestEndpoints: this.getSlowestEndpoints()
        }
      }
    } catch (error) {
      logger.error('Failed to get business analytics', error);
      throw error;
    }
  }

  /**
   * Get user behavior analytics
   */
  async getUserBehaviorAnalytics(userId: string): Promise<UserBehaviorAnalytics> {
    const userEvents = this.events.filter(event => event.userId === userId)
    
    const sessions = this.calculateUserSessions(userEvents)
    const pageViews = userEvents.filter(event => event.event === 'page_view').length
    const averageSessionDuration = this.calculateUserAverageSessionDuration(userEvents)
    const lastActiveDate = userEvents.length > 0 
      ? new Date(Math.max(...userEvents.map(e => e.timestamp.getTime())))
      : new Date()

    const favoriteFeatures = this.calculateFavoriteFeatures(userEvents)
    const investmentPattern = await this.calculateInvestmentPattern(userId)
    const engagementScore = this.calculateEngagementScore(userEvents)

    return {
      userId,
      totalSessions: sessions,
      totalPageViews: pageViews,
      averageSessionDuration,
      lastActiveDate,
      favoriteFeatures,
      investmentPattern,
      engagementScore
    }
  }

  /**
   * Get property analytics
   */
  async getPropertyAnalytics(propertyId: string): Promise<PropertyAnalytics> {
    const propertyEvents = this.events.filter(
      event => event.properties.propertyId === propertyId
    )

    const viewCount = propertyEvents.filter(
      event => event.event === 'property_viewed'
    ).length

    const investments = await InvestmentModel.find({ propertyId })
    const investorCount = new Set(investments.map(inv => inv.userId)).size
    const totalInvestmentValue = investments.reduce((sum, inv) => sum + inv.investmentValue, 0)
    const averageInvestmentSize = investments.length > 0 
      ? totalInvestmentValue / investments.length 
      : 0

    const conversionRate = viewCount > 0 ? (investments.length / viewCount) * 100 : 0
    const popularityScore = this.calculatePropertyPopularityScore(propertyId)

    return {
      propertyId,
      viewCount,
      investorCount,
      totalInvestmentValue,
      averageInvestmentSize,
      conversionRate,
      popularityScore,
      performanceMetrics: await this.getPropertyPerformanceMetrics(propertyId)
    }
  }

  /**
   * Get funnel analysis
   */
  getFunnelAnalysis(funnelSteps: string[]): Array<{ step: string; count: number; conversionRate: number }> {
    const funnelData = funnelSteps.map((step, index) => {
      const stepEvents = this.events.filter(event => event.event === step)
      const count = stepEvents.length
      
      let conversionRate = 100
      if (index > 0) {
        const previousStepCount = funnelData[index - 1]?.count || 0
        conversionRate = previousStepCount > 0 ? (count / previousStepCount) * 100 : 0
      }

      return {
        step,
        count,
        conversionRate
      }
    })

    return funnelData
  }

  /**
   * Get cohort analysis
   */
  async getCohortAnalysis(cohortType: 'weekly' | 'monthly' = 'monthly'): Promise<Array<{
    cohort: string
    users: number
    retention: Array<{ period: number; rate: number }>
  }>> {
    // This would implement cohort analysis logic
    // For now, returning empty array as placeholder
    return []
  }

  /**
   * Get real-time analytics
   */
  getRealTimeAnalytics(): {
    activeUsers: number
    currentSessions: number
    recentEvents: UserEvent[]
    topPages: Array<{ page: string; views: number }>
  } {
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    
    const recentEvents = this.events.filter(event => event.timestamp > fiveMinutesAgo)
    const activeUsers = new Set(recentEvents.map(event => event.userId)).size
    
    const pageViews = recentEvents.filter(event => event.event === 'page_view')
    const topPages = this.calculateTopPages(pageViews)

    return {
      activeUsers,
      currentSessions: this.calculateCurrentSessions(),
      recentEvents: recentEvents.slice(-50), // Last 50 events
      topPages
    }
  }

  // Private helper methods

  private getActiveUsersCount(startDate: Date, endDate: Date): number {
    return new Set(
      this.events
        .filter(event => event.timestamp >= startDate && event.timestamp <= endDate)
        .map(event => event.userId)
    ).size
  }

  private calculateRetentionRate(timeRange: string): number {
    // Simplified retention rate calculation
    // In production, this would be more sophisticated
    return 75 // Placeholder
  }

  private calculateAverageSessionDuration(): number {
    // Simplified session duration calculation
    return 420 // 7 minutes in seconds
  }

  private async getTopCountries(): Promise<Array<{ country: string; count: number }>> {
    // This would query user location data
    return [
      { country: 'Kenya', count: 150 },
      { country: 'Nigeria', count: 120 },
      { country: 'Uganda', count: 80 }
    ]
  }

  private async getTotalPropertyValuation(): Promise<number> {
    const result = await PropertyModel.aggregate([
      { $group: { _id: null, total: { $sum: '$totalValuation' } } }
    ])
    return result[0]?.total || 0
  }

  private async getAveragePropertyValue(): Promise<number> {
    const result = await PropertyModel.aggregate([
      { $group: { _id: null, average: { $avg: '$totalValuation' } } }
    ])
    return result[0]?.average || 0
  }

  private async getPropertiesByType(): Promise<Array<{ type: string; count: number }>> {
    return await PropertyModel.aggregate([
      { $group: { _id: '$propertyType', count: { $sum: 1 } } },
      { $project: { type: '$_id', count: 1, _id: 0 } }
    ])
  }

  private async getPropertiesByLocation(): Promise<Array<{ location: string; count: number }>> {
    return await PropertyModel.aggregate([
      { $group: { _id: '$address.city', count: { $sum: 1 } } },
      { $project: { location: '$_id', count: 1, _id: 0 } }
    ])
  }

  private async getActiveInvestorsCount(): Promise<number> {
    const result = await InvestmentModel.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$userId' } },
      { $count: 'activeInvestors' }
    ])
    return result[0]?.activeInvestors || 0
  }

  private async getInvestmentsByProperty(): Promise<Array<{ propertyId: string; count: number; value: number }>> {
    return await InvestmentModel.aggregate([
      {
        $group: {
          _id: '$propertyId',
          count: { $sum: 1 },
          value: { $sum: '$investmentValue' }
        }
      },
      {
        $project: {
          propertyId: '$_id',
          count: 1,
          value: 1,
          _id: 0
        }
      }
    ])
  }

  private async getMonthlyInvestmentTrend(): Promise<Array<{ month: string; count: number; value: number }>> {
    return await InvestmentModel.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          value: { $sum: '$investmentValue' }
        }
      },
      {
        $project: {
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              { $toString: '$_id.month' }
            ]
          },
          count: 1,
          value: 1,
          _id: 0
        }
      },
      { $sort: { month: 1 } }
    ])
  }

  private async getAverageTransactionValue(): Promise<number> {
    const result = await TransactionModel.aggregate([
      { $group: { _id: null, average: { $avg: '$amount' } } }
    ])
    return result[0]?.average || 0
  }

  private async getTransactionsByType(): Promise<Array<{ type: string; count: number }>> {
    return await TransactionModel.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $project: { type: '$_id', count: 1, _id: 0 } }
    ])
  }

  private async getDailyTransactionTrend(): Promise<Array<{ date: string; count: number; volume: number }>> {
    return await TransactionModel.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          volume: { $sum: '$amount' }
        }
      },
      {
        $project: {
          date: '$_id',
          count: 1,
          volume: 1,
          _id: 0
        }
      },
      { $sort: { date: 1 } }
    ])
  }

  private calculateAverageResponseTime(): number {
    // This would calculate from performance metrics
    return 250 // milliseconds
  }

  private calculateErrorRate(): number {
    // This would calculate from error logs
    return 2.5 // percentage
  }

  private calculateUptime(): number {
    // This would calculate system uptime
    return 99.9 // percentage
  }

  private getApiCallsPerDay(): number {
    // This would count API calls
    return 15000
  }

  private getSlowestEndpoints(): Array<{ endpoint: string; averageTime: number }> {
    // This would analyze endpoint performance
    return [
      { endpoint: '/api/properties/search', averageTime: 450 },
      { endpoint: '/api/investments/portfolio', averageTime: 380 },
      { endpoint: '/api/analytics/business', averageTime: 320 }
    ]
  }

  private calculateUserSessions(userEvents: UserEvent[]): number {
    // Simplified session calculation
    return Math.ceil(userEvents.length / 10)
  }

  private calculateUserAverageSessionDuration(userEvents: UserEvent[]): number {
    // Simplified duration calculation
    return 300 // 5 minutes
  }

  private calculateFavoriteFeatures(userEvents: UserEvent[]): Array<{ feature: string; usage: number }> {
    const featureUsage: Record<string, number> = {}
    
    userEvents.forEach(event => {
      if (event.event === 'user_action') {
        const feature = event.properties.action
        featureUsage[feature] = (featureUsage[feature] || 0) + 1
      }
    })

    return Object.entries(featureUsage)
      .map(([feature, usage]) => ({ feature, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5)
  }

  private async calculateInvestmentPattern(userId: string): Promise<{
    totalInvestments: number
    averageInvestmentSize: number
    preferredPropertyTypes: string[]
    riskProfile: 'conservative' | 'moderate' | 'aggressive'
  }> {
    const investments = await InvestmentModel.find({ userId })
    
    const totalInvestments = investments.length
    const averageInvestmentSize = investments.length > 0
      ? investments.reduce((sum, inv) => sum + inv.investmentValue, 0) / investments.length
      : 0

    // This would analyze property types and risk profile
    return {
      totalInvestments,
      averageInvestmentSize,
      preferredPropertyTypes: ['residential', 'commercial'],
      riskProfile: 'moderate'
    }
  }

  private calculateEngagementScore(userEvents: UserEvent[]): number {
    // Simplified engagement score calculation
    const recentEvents = userEvents.filter(
      event => event.timestamp > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )
    
    return Math.min(recentEvents.length * 2, 100)
  }

  private calculatePropertyPopularityScore(propertyId: string): number {
    const propertyEvents = this.events.filter(
      event => event.properties.propertyId === propertyId
    )
    
    return Math.min(propertyEvents.length, 100)
  }

  private async getPropertyPerformanceMetrics(propertyId: string): Promise<{
    dividendYield: number
    priceAppreciation: number
    totalReturn: number
  }> {
    // This would calculate actual performance metrics
    return {
      dividendYield: 8.5,
      priceAppreciation: 12.3,
      totalReturn: 20.8
    }
  }

  private calculateTopPages(pageViews: UserEvent[]): Array<{ page: string; views: number }> {
    const pageCount: Record<string, number> = {}
    
    pageViews.forEach(event => {
      const page = event.properties.page
      pageCount[page] = (pageCount[page] || 0) + 1
    })

    return Object.entries(pageCount)
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
  }

  private calculateCurrentSessions(): number {
    // This would calculate active sessions
    return 45
  }
}

export default new AnalyticsService()