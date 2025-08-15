import { logger } from '../utils/logger';
import { PropertyModel } from '../models/PropertyModel';
import { InvestmentModel } from '../models/InvestmentModel';
import { TransactionModel } from '../models/TransactionModel';
import { HederaService } from './HederaService';
import { NotificationService } from './NotificationService';

export interface DividendDistribution {
  userId: string;
  amount: number;
  tokenAmount: number;
  percentage: number;
}

export interface DividendCalculation {
  totalIncome: number;
  managementFee: number;
  netDistribution: number;
  distributions: DividendDistribution[];
}

export class DividendService {
  private hederaService: HederaService;
  private notificationService: NotificationService;

  constructor() {
    this.hederaService = new HederaService();
    this.notificationService = new NotificationService();
  }

  /**
   * Calculate dividend distribution for a property
   */
  async calculateDividendDistribution(
    propertyId: string,
    totalIncome: number,
    managementFeePercentage: number = 0.1
  ): Promise<DividendCalculation> {
    try {
      logger.info(`Calculating dividend distribution for property ${propertyId}`);

      // Get all token holders for the property
      const investments = await InvestmentModel.findByPropertyId(propertyId);
      
      if (investments.length === 0) {
        throw new Error('No token holders found for property');
      }

      // Calculate total tokens
      const totalTokens = investments.reduce((sum, inv) => sum + inv.tokenAmount, 0);
      
      // Calculate management fee
      const managementFee = totalIncome * managementFeePercentage;
      const netDistribution = totalIncome - managementFee;

      // Calculate individual distributions
      const distributions: DividendDistribution[] = investments.map(investment => {
        const percentage = investment.tokenAmount / totalTokens;
        const amount = netDistribution * percentage;
        
        return {
          userId: investment.userId,
          amount,
          tokenAmount: investment.tokenAmount,
          percentage
        };
      });

      const calculation: DividendCalculation = {
        totalIncome,
        managementFee,
        netDistribution,
        distributions
      };

      logger.info('Dividend calculation completed', {
        propertyId,
        totalIncome,
        netDistribution,
        distributionCount: distributions.length
      });

      return calculation;

    } catch (error) {
      logger.error('Error calculating dividend distribution:', error);
      throw error;
    }
  }

  /**
   * Distribute dividends to token holders
   */
  async distributeDividends(
    propertyId: string,
    calculation: DividendCalculation
  ): Promise<void> {
    try {
      logger.info(`Starting dividend distribution for property ${propertyId}`);

      const distributionPromises = calculation.distributions.map(async (distribution) => {
        try {
          // Record the dividend transaction
          await TransactionModel.create({
            userId: distribution.userId,
            type: 'dividend',
            amount: distribution.amount,
            currency: 'USD',
            status: 'completed',
            metadata: {
              propertyId,
              tokenAmount: distribution.tokenAmount,
              percentage: distribution.percentage
            }
          });

          // Send notification to user
          await this.notificationService.sendNotification({
            userId: distribution.userId,
            type: 'dividend_received',
            title: 'Dividend Payment Received',
            message: `You have received $${distribution.amount.toFixed(2)} in dividends from your property investment.`,
            data: {
              propertyId,
              amount: distribution.amount,
              tokenAmount: distribution.tokenAmount
            }
          });

          logger.info(`Dividend distributed to user ${distribution.userId}: $${distribution.amount}`);

        } catch (error) {
          logger.error(`Failed to distribute dividend to user ${distribution.userId}:`, error);
          throw error;
        }
      });

      await Promise.all(distributionPromises);

      logger.info(`Dividend distribution completed for property ${propertyId}`);

    } catch (error) {
      logger.error('Error distributing dividends:', error);
      throw error;
    }
  }

  /**
   * Get dividend history for a property
   */
  async getDividendHistory(propertyId: string): Promise<any[]> {
    try {
      const transactions = await TransactionModel.findByType('dividend');
      return transactions.filter(tx => tx.metadata?.propertyId === propertyId);
    } catch (error) {
      logger.error('Error getting dividend history:', error);
      throw error;
    }
  }

  /**
   * Get dividend history for a user
   */
  async getUserDividendHistory(userId: string): Promise<any[]> {
    try {
      return await TransactionModel.findByUserIdAndType(userId, 'dividend');
    } catch (error) {
      logger.error('Error getting user dividend history:', error);
      throw error;
    }
  }
}