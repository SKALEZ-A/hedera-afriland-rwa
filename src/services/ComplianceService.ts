import { UserModel } from '../models/UserModel';
import { Transaction, AuditLog } from '../types/entities';
import { logger } from '../utils/logger';
import { KYCService } from './KYCService';

export interface ComplianceReport {
  reportId: string;
  reportType: 'kyc_summary' | 'transaction_monitoring' | 'aml_screening' | 'suspicious_activity';
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  data: any;
  summary: {
    totalUsers: number;
    verifiedUsers: number;
    suspiciousTransactions: number;
    amlAlerts: number;
  };
}

export interface SuspiciousActivityReport {
  id: string;
  userId: string;
  transactionIds: string[];
  alertType: string;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
  detectedAt: Date;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  investigatedBy?: string;
  resolution?: string;
}

export interface TransactionMonitoringRule {
  id: string;
  name: string;
  description: string;
  ruleType: 'amount_threshold' | 'velocity' | 'pattern' | 'geographic';
  parameters: Record<string, any>;
  enabled: boolean;
  alertLevel: 'low' | 'medium' | 'high';
}

export class ComplianceService {
  private userModel: UserModel;
  // private transactionModel: TransactionModel; // Commented out as not used in current implementation
  private kycService: KYCService;
  private monitoringRules: TransactionMonitoringRule[];

  constructor() {
    this.userModel = new UserModel();
    // this.transactionModel = new TransactionModel(); // Commented out as not used in current implementation
    this.kycService = new KYCService();
    this.monitoringRules = this.initializeMonitoringRules();
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    reportType: ComplianceReport['reportType'],
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    try {
      const reportId = `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      let data: any;
      let summary: ComplianceReport['summary'];

      switch (reportType) {
        case 'kyc_summary':
          data = await this.generateKYCSummaryReport(startDate, endDate);
          break;
        case 'transaction_monitoring':
          data = await this.generateTransactionMonitoringReport(startDate, endDate);
          break;
        case 'aml_screening':
          data = await this.generateAMLScreeningReport(startDate, endDate);
          break;
        case 'suspicious_activity':
          data = await this.generateSuspiciousActivityReport(startDate, endDate);
          break;
        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      // Generate summary statistics
      summary = await this.generateReportSummary(startDate, endDate);

      const report: ComplianceReport = {
        reportId,
        reportType,
        generatedAt: new Date(),
        periodStart: startDate,
        periodEnd: endDate,
        data,
        summary
      };

      logger.info('Compliance report generated', {
        reportId,
        reportType,
        periodStart: startDate,
        periodEnd: endDate
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate compliance report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportType,
        startDate,
        endDate
      });
      throw error;
    }
  }

  /**
   * Monitor transaction for suspicious activity
   */
  async monitorTransaction(transaction: Transaction): Promise<SuspiciousActivityReport[]> {
    const alerts: SuspiciousActivityReport[] = [];

    try {
      for (const rule of this.monitoringRules) {
        if (!rule.enabled) continue;

        const alert = await this.evaluateRule(rule, transaction);
        if (alert) {
          alerts.push(alert);
        }
      }

      if (alerts.length > 0) {
        logger.warn('Suspicious activity detected', {
          transactionId: transaction.id,
          userId: transaction.userId,
          alertCount: alerts.length
        });
      }

      return alerts;
    } catch (error) {
      logger.error('Transaction monitoring failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: transaction.id
      });
      return [];
    }
  }

  /**
   * Perform enhanced due diligence on user
   */
  async performEnhancedDueDiligence(userId: string): Promise<{
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    factors: Array<{
      factor: string;
      score: number;
      description: string;
    }>;
    recommendations: string[];
  }> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Perform AML screening
      const amlResult = await this.kycService.performAMLScreening(userId);

      // Calculate risk factors
      const riskFactors = [];
      let totalRiskScore = 0;

      // Geographic risk
      const highRiskCountries = ['AFG', 'IRN', 'PRK', 'SYR', 'MMR'];
      if (user.nationality && highRiskCountries.includes(user.nationality)) {
        const factor = {
          factor: 'geographic_risk',
          score: 30,
          description: 'User from high-risk jurisdiction'
        };
        riskFactors.push(factor);
        totalRiskScore += factor.score;
      }

      // KYC status risk
      if (user.kycStatus !== 'approved') {
        const factor = {
          factor: 'kyc_status',
          score: 25,
          description: 'KYC not approved'
        };
        riskFactors.push(factor);
        totalRiskScore += factor.score;
      }

      // AML screening risk
      if (!amlResult.passed) {
        const factor = {
          factor: 'aml_screening',
          score: 40,
          description: 'Failed AML screening'
        };
        riskFactors.push(factor);
        totalRiskScore += factor.score;
      }

      // Transaction pattern risk (mock)
      const recentTransactions = await this.getRecentTransactions(userId, 30);
      if (recentTransactions.length > 50) {
        const factor = {
          factor: 'high_velocity',
          score: 20,
          description: 'High transaction velocity'
        };
        riskFactors.push(factor);
        totalRiskScore += factor.score;
      }

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (totalRiskScore >= 50) {
        riskLevel = 'high';
      } else if (totalRiskScore >= 25) {
        riskLevel = 'medium';
      }

      // Generate recommendations
      const recommendations = this.generateRiskRecommendations(riskLevel, riskFactors);

      logger.info('Enhanced due diligence completed', {
        userId,
        riskScore: totalRiskScore,
        riskLevel,
        factorCount: riskFactors.length
      });

      return {
        riskScore: totalRiskScore,
        riskLevel,
        factors: riskFactors,
        recommendations
      };
    } catch (error) {
      logger.error('Enhanced due diligence failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Record audit event
   */
  async recordAuditEvent(event: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      // In production, this would insert into audit_logs table
      logger.info('Audit event recorded', event);
    } catch (error) {
      logger.error('Failed to record audit event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event
      });
    }
  }

  /**
   * Initialize transaction monitoring rules
   */
  private initializeMonitoringRules(): TransactionMonitoringRule[] {
    return [
      {
        id: 'large_transaction',
        name: 'Large Transaction Alert',
        description: 'Alert for transactions above threshold',
        ruleType: 'amount_threshold',
        parameters: { threshold: 10000, currency: 'USD' },
        enabled: true,
        alertLevel: 'medium'
      },
      {
        id: 'high_velocity',
        name: 'High Velocity Trading',
        description: 'Alert for high frequency trading patterns',
        ruleType: 'velocity',
        parameters: { maxTransactions: 20, timeWindow: 3600 }, // 20 transactions per hour
        enabled: true,
        alertLevel: 'high'
      },
      {
        id: 'round_amount_pattern',
        name: 'Round Amount Pattern',
        description: 'Alert for suspicious round amount patterns',
        ruleType: 'pattern',
        parameters: { roundAmountThreshold: 1000 },
        enabled: true,
        alertLevel: 'low'
      }
    ];
  }

  /**
   * Evaluate monitoring rule against transaction
   */
  private async evaluateRule(
    rule: TransactionMonitoringRule,
    transaction: Transaction
  ): Promise<SuspiciousActivityReport | null> {
    switch (rule.ruleType) {
      case 'amount_threshold':
        return this.evaluateAmountThresholdRule(rule, transaction);
      case 'velocity':
        return this.evaluateVelocityRule(rule, transaction);
      case 'pattern':
        return this.evaluatePatternRule(rule, transaction);
      default:
        return null;
    }
  }

  /**
   * Evaluate amount threshold rule
   */
  private async evaluateAmountThresholdRule(
    rule: TransactionMonitoringRule,
    transaction: Transaction
  ): Promise<SuspiciousActivityReport | null> {
    const threshold = rule.parameters.threshold;
    
    if (transaction.amount >= threshold) {
      return {
        id: `SAR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: transaction.userId,
        transactionIds: [transaction.id],
        alertType: rule.name,
        riskLevel: rule.alertLevel,
        description: `Transaction amount ${transaction.amount} exceeds threshold ${threshold}`,
        detectedAt: new Date(),
        status: 'open'
      };
    }

    return null;
  }

  /**
   * Evaluate velocity rule
   */
  private async evaluateVelocityRule(
    rule: TransactionMonitoringRule,
    transaction: Transaction
  ): Promise<SuspiciousActivityReport | null> {
    const timeWindow = rule.parameters.timeWindow; // seconds
    const maxTransactions = rule.parameters.maxTransactions;
    
    const windowStart = new Date(Date.now() - timeWindow * 1000);
    const recentTransactions = await this.getTransactionsSince(transaction.userId, windowStart);
    
    if (recentTransactions.length >= maxTransactions) {
      return {
        id: `SAR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: transaction.userId,
        transactionIds: recentTransactions.map(t => t.id),
        alertType: rule.name,
        riskLevel: rule.alertLevel,
        description: `${recentTransactions.length} transactions in ${timeWindow} seconds exceeds limit ${maxTransactions}`,
        detectedAt: new Date(),
        status: 'open'
      };
    }

    return null;
  }

  /**
   * Evaluate pattern rule
   */
  private async evaluatePatternRule(
    rule: TransactionMonitoringRule,
    transaction: Transaction
  ): Promise<SuspiciousActivityReport | null> {
    const roundThreshold = rule.parameters.roundAmountThreshold;
    
    // Check if amount is suspiciously round
    if (transaction.amount >= roundThreshold && transaction.amount % roundThreshold === 0) {
      return {
        id: `SAR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: transaction.userId,
        transactionIds: [transaction.id],
        alertType: rule.name,
        riskLevel: rule.alertLevel,
        description: `Suspicious round amount pattern: ${transaction.amount}`,
        detectedAt: new Date(),
        status: 'open'
      };
    }

    return null;
  }

  /**
   * Generate KYC summary report
   */
  private async generateKYCSummaryReport(startDate: Date, endDate: Date): Promise<any> {
    const stats = await this.userModel.getUserStats();
    
    return {
      totalUsers: stats.totalUsers,
      verifiedUsers: stats.verifiedUsers,
      pendingKYC: stats.kycPendingUsers,
      kycApprovalRate: stats.totalUsers > 0 ? (stats.verifiedUsers / stats.totalUsers) * 100 : 0,
      period: { startDate, endDate }
    };
  }

  /**
   * Generate transaction monitoring report
   */
  private async generateTransactionMonitoringReport(startDate: Date, endDate: Date): Promise<any> {
    // Mock implementation - in production, query actual transaction data
    return {
      totalTransactions: 1250,
      flaggedTransactions: 23,
      falsePositives: 8,
      confirmedSuspicious: 15,
      period: { startDate, endDate }
    };
  }

  /**
   * Generate AML screening report
   */
  private async generateAMLScreeningReport(startDate: Date, endDate: Date): Promise<any> {
    // Mock implementation
    return {
      totalScreenings: 450,
      passedScreenings: 425,
      failedScreenings: 25,
      highRiskUsers: 12,
      period: { startDate, endDate }
    };
  }

  /**
   * Generate suspicious activity report
   */
  private async generateSuspiciousActivityReport(startDate: Date, endDate: Date): Promise<any> {
    // Mock implementation
    return {
      totalAlerts: 45,
      openAlerts: 12,
      resolvedAlerts: 33,
      falsePositives: 18,
      confirmedSuspicious: 15,
      period: { startDate, endDate }
    };
  }

  /**
   * Generate report summary
   */
  private async generateReportSummary(_startDate: Date, _endDate: Date): Promise<ComplianceReport['summary']> {
    const userStats = await this.userModel.getUserStats();
    
    return {
      totalUsers: userStats.totalUsers,
      verifiedUsers: userStats.verifiedUsers,
      suspiciousTransactions: 15, // Mock data
      amlAlerts: 25 // Mock data
    };
  }

  /**
   * Get recent transactions for user
   */
  private async getRecentTransactions(_userId: string, _days: number): Promise<Transaction[]> {
    // Mock implementation - in production, query actual transaction data
    return [];
  }

  /**
   * Get transactions since date
   */
  private async getTransactionsSince(_userId: string, _since: Date): Promise<Transaction[]> {
    // Mock implementation - in production, query actual transaction data
    return [];
  }

  /**
   * Generate risk recommendations
   */
  private generateRiskRecommendations(
    riskLevel: 'low' | 'medium' | 'high',
    factors: Array<{ factor: string; score: number; description: string }>
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'high') {
      recommendations.push('Require enhanced due diligence documentation');
      recommendations.push('Implement transaction monitoring with lower thresholds');
      recommendations.push('Consider account restrictions until risk is mitigated');
    }

    if (riskLevel === 'medium') {
      recommendations.push('Increase transaction monitoring frequency');
      recommendations.push('Request additional verification documents');
    }

    factors.forEach(factor => {
      switch (factor.factor) {
        case 'geographic_risk':
          recommendations.push('Verify source of funds documentation');
          break;
        case 'kyc_status':
          recommendations.push('Complete KYC verification process');
          break;
        case 'aml_screening':
          recommendations.push('Conduct manual AML review');
          break;
        case 'high_velocity':
          recommendations.push('Implement velocity limits on transactions');
          break;
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Check investment limits for compliance
   */
  async checkInvestmentLimits(userId: string, investmentAmount: number): Promise<{
    allowed: boolean;
    reason?: string;
    warnings?: string[];
  }> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        return { allowed: false, reason: 'User not found' };
      }

      const warnings: string[] = [];

      // Check KYC status
      if (user.kycStatus !== 'approved') {
        return { allowed: false, reason: 'KYC verification required' };
      }

      // Check investment limits based on verification level
      const limits = this.getInvestmentLimits(user.verificationLevel, user.isAccreditedInvestor);
      
      if (investmentAmount > limits.singleTransaction) {
        return { 
          allowed: false, 
          reason: `Investment amount exceeds single transaction limit of $${limits.singleTransaction}` 
        };
      }

      // Check daily/monthly limits (mock implementation)
      const dailyTotal = await this.getDailyInvestmentTotal(userId);
      if (dailyTotal + investmentAmount > limits.daily) {
        return { 
          allowed: false, 
          reason: `Investment would exceed daily limit of $${limits.daily}` 
        };
      }

      // Add warnings for large investments
      if (investmentAmount > 5000 && !user.isAccreditedInvestor) {
        warnings.push('Large investment amount - consider accredited investor verification');
      }

      if (investmentAmount > limits.singleTransaction * 0.8) {
        warnings.push('Investment amount approaching transaction limit');
      }

      const result: { allowed: boolean; reason?: string; warnings?: string[] } = { 
        allowed: true
      };
      
      if (warnings.length > 0) {
        result.warnings = warnings;
      }
      
      return result;

    } catch (error) {
      logger.error('Investment limit check failed', { userId, investmentAmount, error });
      return { allowed: false, reason: 'Compliance check failed' };
    }
  }

  /**
   * Log investment event for compliance
   */
  async logInvestmentEvent(event: {
    userId: string;
    propertyId: string;
    investmentAmount: number;
    tokenAmount: number;
    transactionId: string;
    blockchainTxId: string;
  }): Promise<void> {
    try {
      const auditEvent: Omit<AuditLog, 'id' | 'createdAt'> = {
        userId: event.userId,
        action: 'investment_purchase',
        resourceType: 'investment',
        resourceId: event.transactionId,
        newValues: {
          propertyId: event.propertyId,
          investmentAmount: event.investmentAmount,
          tokenAmount: event.tokenAmount,
          blockchainTxId: event.blockchainTxId
        }
      };

      await this.recordAuditEvent(auditEvent);

      logger.info('Investment event logged for compliance', {
        userId: event.userId,
        propertyId: event.propertyId,
        investmentAmount: event.investmentAmount,
        transactionId: event.transactionId
      });

    } catch (error) {
      logger.error('Failed to log investment event', { event, error });
    }
  }

  /**
   * Log investment status change for compliance
   */
  async logInvestmentStatusChange(event: {
    investmentId: string;
    userId: string;
    oldStatus: string;
    newStatus: string;
    timestamp: Date;
  }): Promise<void> {
    try {
      const auditEvent: Omit<AuditLog, 'id' | 'createdAt'> = {
        userId: event.userId,
        action: 'investment_status_change',
        resourceType: 'investment',
        resourceId: event.investmentId,
        oldValues: { status: event.oldStatus },
        newValues: { status: event.newStatus }
      };

      await this.recordAuditEvent(auditEvent);

      logger.info('Investment status change logged', {
        investmentId: event.investmentId,
        userId: event.userId,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus
      });

    } catch (error) {
      logger.error('Failed to log investment status change', { event, error });
    }
  }

  /**
   * Get investment limits based on user verification level
   */
  private getInvestmentLimits(verificationLevel: string, isAccredited: boolean): {
    singleTransaction: number;
    daily: number;
    monthly: number;
  } {
    if (isAccredited) {
      return {
        singleTransaction: 100000,
        daily: 500000,
        monthly: 2000000
      };
    }

    switch (verificationLevel) {
      case 'basic':
        return {
          singleTransaction: 1000,
          daily: 5000,
          monthly: 20000
        };
      case 'intermediate':
        return {
          singleTransaction: 10000,
          daily: 25000,
          monthly: 100000
        };
      case 'advanced':
        return {
          singleTransaction: 50000,
          daily: 100000,
          monthly: 500000
        };
      default:
        return {
          singleTransaction: 500,
          daily: 2000,
          monthly: 10000
        };
    }
  }

  /**
   * Get daily investment total for user (mock implementation)
   */
  private async getDailyInvestmentTotal(_userId: string): Promise<number> {
    // In production, this would query actual transaction data
    // For now, return a mock value
    return 0;
  }}
