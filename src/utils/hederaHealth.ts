import { HederaService } from '../services/HederaService';
import { BlockchainUtils } from './blockchain';
import { logger } from './logger';

export interface HederaHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  network: string;
  connected: boolean;
  operatorBalance: number;
  operatorBalanceHbar: number;
  lastChecked: Date;
  responseTime: number;
  errors: string[];
  warnings: string[];
}

export interface HederaMetrics {
  totalTokensCreated: number;
  totalTransactions: number;
  averageResponseTime: number;
  successRate: number;
  lastTransactionTime?: Date;
}

export class HederaHealthMonitor {
  private static instance: HederaHealthMonitor;
  private hederaService: HederaService;
  private healthHistory: HederaHealthStatus[] = [];
  private metrics: HederaMetrics = {
    totalTokensCreated: 0,
    totalTransactions: 0,
    averageResponseTime: 0,
    successRate: 100
  };

  private constructor() {
    this.hederaService = new HederaService();
  }

  static getInstance(): HederaHealthMonitor {
    if (!HederaHealthMonitor.instance) {
      HederaHealthMonitor.instance = new HederaHealthMonitor();
    }
    return HederaHealthMonitor.instance;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HederaHealthStatus> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      logger.info('Starting Hedera health check...');

      // Check network connectivity and operator balance
      const networkStatus = await this.hederaService.getNetworkStatus();
      const responseTime = Date.now() - startTime;

      // Validate operator balance
      const minRequiredBalance = BlockchainUtils.hbarToTinybars(10); // 10 HBAR minimum
      if (networkStatus.operatorBalance < minRequiredBalance) {
        if (networkStatus.operatorBalance < BlockchainUtils.hbarToTinybars(1)) {
          errors.push('Operator balance critically low (< 1 HBAR)');
        } else {
          warnings.push('Operator balance low (< 10 HBAR)');
        }
      }

      // Check response time
      if (responseTime > 10000) { // 10 seconds
        errors.push('Network response time too high (> 10s)');
      } else if (responseTime > 5000) { // 5 seconds
        warnings.push('Network response time elevated (> 5s)');
      }

      // Determine overall status
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (!networkStatus.connected || errors.length > 0) {
        status = 'unhealthy';
      } else if (warnings.length > 0) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      const healthStatus: HederaHealthStatus = {
        status,
        network: networkStatus.network,
        connected: networkStatus.connected,
        operatorBalance: networkStatus.operatorBalance,
        operatorBalanceHbar: BlockchainUtils.tinybarsToHbar(networkStatus.operatorBalance),
        lastChecked: new Date(),
        responseTime,
        errors,
        warnings
      };

      // Store in history (keep last 100 checks)
      this.healthHistory.push(healthStatus);
      if (this.healthHistory.length > 100) {
        this.healthHistory.shift();
      }

      logger.info(`Hedera health check completed: ${status}`, {
        responseTime,
        balance: healthStatus.operatorBalanceHbar,
        errors: errors.length,
        warnings: warnings.length
      });

      return healthStatus;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Hedera health check failed:', error);

      const healthStatus: HederaHealthStatus = {
        status: 'unhealthy',
        network: process.env.HEDERA_NETWORK || 'unknown',
        connected: false,
        operatorBalance: 0,
        operatorBalanceHbar: 0,
        lastChecked: new Date(),
        responseTime,
        errors: [`Health check failed: ${errorMessage}`],
        warnings: []
      };

      this.healthHistory.push(healthStatus);
      if (this.healthHistory.length > 100) {
        this.healthHistory.shift();
      }

      return healthStatus;
    }
  }

  /**
   * Get current health status (cached)
   */
  getCurrentHealthStatus(): HederaHealthStatus | null {
    return this.healthHistory.length > 0 
      ? this.healthHistory[this.healthHistory.length - 1] 
      : null;
  }

  /**
   * Get health history
   */
  getHealthHistory(limit: number = 24): HederaHealthStatus[] {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Check if Hedera is ready for operations
   */
  async isReadyForOperations(): Promise<{
    ready: boolean;
    reason?: string;
    healthStatus: HederaHealthStatus;
  }> {
    const healthStatus = await this.performHealthCheck();

    if (healthStatus.status === 'unhealthy') {
      return {
        ready: false,
        reason: healthStatus.errors.join(', '),
        healthStatus
      };
    }

    if (healthStatus.operatorBalance < BlockchainUtils.hbarToTinybars(1)) {
      return {
        ready: false,
        reason: 'Insufficient operator balance for transactions',
        healthStatus
      };
    }

    return {
      ready: true,
      healthStatus
    };
  }

  /**
   * Update metrics after transaction
   */
  updateMetrics(transactionType: 'token_create' | 'token_transfer' | 'other', success: boolean, responseTime: number): void {
    this.metrics.totalTransactions++;
    
    if (transactionType === 'token_create' && success) {
      this.metrics.totalTokensCreated++;
    }

    // Update average response time (simple moving average)
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalTransactions - 1) + responseTime) / 
      this.metrics.totalTransactions;

    // Update success rate (last 100 transactions)
    const recentHistory = this.healthHistory.slice(-100);
    const successfulTransactions = recentHistory.filter(h => h.status !== 'unhealthy').length;
    this.metrics.successRate = recentHistory.length > 0 
      ? (successfulTransactions / recentHistory.length) * 100 
      : 100;

    this.metrics.lastTransactionTime = new Date();
  }

  /**
   * Get current metrics
   */
  getMetrics(): HederaMetrics {
    return { ...this.metrics };
  }

  /**
   * Get network statistics
   */
  getNetworkStatistics(): {
    uptime: number;
    averageResponseTime: number;
    healthyPercentage: number;
    lastHealthyCheck?: Date;
    totalChecks: number;
  } {
    const totalChecks = this.healthHistory.length;
    const healthyChecks = this.healthHistory.filter(h => h.status === 'healthy').length;
    const healthyPercentage = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 0;
    
    const averageResponseTime = totalChecks > 0 
      ? this.healthHistory.reduce((sum, h) => sum + h.responseTime, 0) / totalChecks 
      : 0;

    const lastHealthyCheck = this.healthHistory
      .slice()
      .reverse()
      .find(h => h.status === 'healthy')?.lastChecked;

    return {
      uptime: healthyPercentage,
      averageResponseTime,
      healthyPercentage,
      lastHealthyCheck,
      totalChecks
    };
  }

  /**
   * Start periodic health monitoring
   */
  startPeriodicMonitoring(intervalMinutes: number = 5): void {
    const intervalMs = intervalMinutes * 60 * 1000;
    
    logger.info(`Starting Hedera health monitoring (every ${intervalMinutes} minutes)`);

    // Perform initial check
    this.performHealthCheck().catch(error => {
      logger.error('Initial health check failed:', error);
    });

    // Set up periodic checks
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Periodic health check failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Get health summary for dashboard
   */
  getHealthSummary(): {
    status: string;
    connected: boolean;
    balance: string;
    network: string;
    lastChecked: string;
    uptime: string;
    totalTransactions: number;
    successRate: string;
  } {
    const currentHealth = this.getCurrentHealthStatus();
    const stats = this.getNetworkStatistics();

    return {
      status: currentHealth?.status || 'unknown',
      connected: currentHealth?.connected || false,
      balance: currentHealth ? `${currentHealth.operatorBalanceHbar.toFixed(2)} HBAR` : '0 HBAR',
      network: currentHealth?.network || 'unknown',
      lastChecked: currentHealth?.lastChecked.toISOString() || 'never',
      uptime: `${stats.healthyPercentage.toFixed(1)}%`,
      totalTransactions: this.metrics.totalTransactions,
      successRate: `${this.metrics.successRate.toFixed(1)}%`
    };
  }

  /**
   * Reset metrics and history
   */
  reset(): void {
    this.healthHistory = [];
    this.metrics = {
      totalTokensCreated: 0,
      totalTransactions: 0,
      averageResponseTime: 0,
      successRate: 100
    };
    logger.info('Hedera health monitor reset');
  }
}