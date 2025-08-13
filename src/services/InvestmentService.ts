import { 
  Investment, 
  Portfolio, 
  Transaction, 
  TransactionType, 
  TransactionStatus,
  InvestmentStatus,
  PaymentRequest,
  PaymentResult,
  CurrencyCode,
  PaymentMethod
} from '../types/entities';
import { InvestmentModel } from '../models/InvestmentModel';
import { TransactionModel } from '../models/TransactionModel';
import { PropertyModel } from '../models/PropertyModel';
import { UserModel } from '../models/UserModel';
import { HederaService } from './HederaService';
import { ComplianceService } from './ComplianceService';
import { logger } from '../utils/logger';

export interface InvestmentPurchaseRequest {
  userId: string;
  propertyId: string;
  tokenAmount: number;
  paymentMethod: PaymentMethod;
  currency: CurrencyCode;
  paymentReference?: string;
}

export interface InvestmentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PortfolioPerformance {
  totalReturn: number;
  returnPercentage: number;
  dividendYield: number;
  capitalGains: number;
  performanceByProperty: Array<{
    propertyId: string;
    propertyName: string;
    return: number;
    returnPercentage: number;
    dividendYield: number;
  }>;
}

export class InvestmentService {
  private investmentModel: InvestmentModel;
  private transactionModel: TransactionModel;
  private propertyModel: PropertyModel;
  private userModel: UserModel;
  private hederaService: HederaService;
  private complianceService: ComplianceService;

  constructor() {
    this.investmentModel = new InvestmentModel();
    this.transactionModel = new TransactionModel();
    this.propertyModel = new PropertyModel();
    this.userModel = new UserModel();
    this.hederaService = new HederaService();
    this.complianceService = new ComplianceService();
  }

  /**
   * Purchase property tokens - main investment workflow
   */
  async purchaseTokens(request: InvestmentPurchaseRequest): Promise<{
    investment: Investment;
    transaction: Transaction;
    blockchainTxId: string;
  }> {
    logger.info('Starting investment purchase', { 
      userId: request.userId, 
      propertyId: request.propertyId,
      tokenAmount: request.tokenAmount 
    });

    try {
      // 1. Validate investment request
      const validation = await this.validateInvestment(request);
      if (!validation.isValid) {
        throw new Error(`Investment validation failed: ${validation.errors.join(', ')}`);
      }

      // 2. Get property and user details
      const [property, user] = await Promise.all([
        this.propertyModel.findById(request.propertyId),
        this.userModel.findById(request.userId)
      ]);

      if (!property) {
        throw new Error('Property not found');
      }
      if (!user) {
        throw new Error('User not found');
      }

      // 3. Calculate investment amounts
      const totalAmount = request.tokenAmount * property.pricePerToken;
      const platformFee = totalAmount * (property.platformFeePercentage / 100);
      const netAmount = totalAmount + platformFee;

      // 4. Create pending transaction
      const transaction = await this.transactionModel.createTransaction({
        userId: request.userId,
        propertyId: request.propertyId,
        transactionType: 'investment' as TransactionType,
        amount: totalAmount,
        currency: request.currency,
        feeAmount: platformFee,
        netAmount: netAmount,
        status: 'pending' as TransactionStatus,
        paymentMethod: request.paymentMethod,
        paymentReference: request.paymentReference,
        description: `Investment in ${property.name} - ${request.tokenAmount} tokens`
      });

      // 5. Process payment (mock implementation for now)
      const paymentResult = await this.processPayment({
        userId: request.userId,
        amount: netAmount,
        currency: request.currency,
        paymentMethod: request.paymentMethod,
        description: `Investment in ${property.name}`,
        metadata: {
          transactionId: transaction.id,
          propertyId: request.propertyId,
          tokenAmount: request.tokenAmount
        }
      });

      if (!paymentResult.success) {
        await this.transactionModel.updateTransactionStatus(transaction.id, 'failed');
        throw new Error(`Payment failed: ${paymentResult.message}`);
      }

      // 6. Update transaction with payment reference
      await this.transactionModel.updateTransaction(transaction.id, {
        status: 'processing' as TransactionStatus,
        paymentReference: paymentResult.paymentReference
      });

      // 7. Transfer tokens on Hedera
      const blockchainTxId = await this.transferTokensToInvestor(
        property.tokenId!,
        user.walletAddress!,
        request.tokenAmount
      );

      // 8. Create or update investment record
      let investment = await this.investmentModel.getInvestmentByUserAndProperty(
        request.userId, 
        request.propertyId
      );

      if (investment) {
        // Add to existing investment
        investment = await this.investmentModel.addTokensToInvestment(
          request.userId,
          request.propertyId,
          request.tokenAmount,
          property.pricePerToken
        );
      } else {
        // Create new investment
        investment = await this.investmentModel.createInvestment({
          userId: request.userId,
          propertyId: request.propertyId,
          tokenAmount: request.tokenAmount,
          purchasePricePerToken: property.pricePerToken,
          blockchainTxId: blockchainTxId
        });
      }

      if (!investment) {
        throw new Error('Failed to create investment record');
      }

      // 9. Update property available tokens
      await this.propertyModel.updateAvailableTokens(
        request.propertyId, 
        property.availableTokens - request.tokenAmount
      );

      // 10. Complete transaction
      const completedTransaction = await this.transactionModel.updateTransaction(transaction.id, {
        status: 'completed' as TransactionStatus,
        blockchainTxId: blockchainTxId,
        processedAt: new Date()
      });

      // 11. Log compliance event
      await this.complianceService.logInvestmentEvent({
        userId: request.userId,
        propertyId: request.propertyId,
        investmentAmount: totalAmount,
        tokenAmount: request.tokenAmount,
        transactionId: transaction.id,
        blockchainTxId: blockchainTxId
      });

      logger.info('Investment purchase completed successfully', {
        userId: request.userId,
        propertyId: request.propertyId,
        investmentId: investment.id,
        blockchainTxId: blockchainTxId
      });

      return {
        investment,
        transaction: completedTransaction!,
        blockchainTxId
      };

    } catch (error) {
      logger.error('Investment purchase failed', {
        userId: request.userId,
        propertyId: request.propertyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate investment request
   */
  async validateInvestment(request: InvestmentPurchaseRequest): Promise<InvestmentValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check user exists and is verified
      const user = await this.userModel.findById(request.userId);
      if (!user) {
        errors.push('User not found');
        return { isValid: false, errors, warnings };
      }

      if (user.kycStatus !== 'approved') {
        errors.push('User KYC verification required');
      }

      if (!user.walletAddress) {
        errors.push('User wallet address required');
      }

      // Check property exists and is available
      const property = await this.propertyModel.findById(request.propertyId);
      if (!property) {
        errors.push('Property not found');
        return { isValid: false, errors, warnings };
      }

      if (property.status !== 'active') {
        errors.push('Property is not available for investment');
      }

      if (!property.tokenId) {
        errors.push('Property is not tokenized');
      }

      // Check token availability
      if (request.tokenAmount <= 0) {
        errors.push('Token amount must be greater than 0');
      }

      if (request.tokenAmount > property.availableTokens) {
        errors.push(`Insufficient tokens available. Available: ${property.availableTokens}, Requested: ${request.tokenAmount}`);
      }

      // Check minimum investment
      const investmentAmount = request.tokenAmount * property.pricePerToken;
      if (investmentAmount < property.minimumInvestment) {
        errors.push(`Investment amount below minimum. Minimum: $${property.minimumInvestment}, Requested: $${investmentAmount}`);
      }

      // Check compliance limits
      const complianceCheck = await this.complianceService.checkInvestmentLimits(
        request.userId,
        investmentAmount
      );

      if (!complianceCheck.allowed) {
        errors.push(`Investment exceeds compliance limits: ${complianceCheck.reason}`);
      }

      if (complianceCheck.warnings) {
        warnings.push(...complianceCheck.warnings);
      }

      // Check for accredited investor requirements (if applicable)
      if (investmentAmount > 10000 && !user.isAccreditedInvestor) {
        warnings.push('Large investment amount - accredited investor verification recommended');
      }

    } catch (error) {
      logger.error('Investment validation error', { error });
      errors.push('Validation service error');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }  /*
*
   * Transfer tokens to investor using Hedera SDK
   */
  private async transferTokensToInvestor(
    tokenId: string, 
    investorWalletAddress: string, 
    tokenAmount: number
  ): Promise<string> {
    try {
      logger.info('Transferring tokens on Hedera', {
        tokenId,
        investorWalletAddress,
        tokenAmount
      });

      // Use HederaService to transfer tokens
      const transferResult = await this.hederaService.transferTokens(
        tokenId,
        investorWalletAddress,
        tokenAmount
      );

      if (!transferResult.success) {
        throw new Error(`Token transfer failed: ${transferResult.error}`);
      }

      logger.info('Token transfer completed', {
        tokenId,
        investorWalletAddress,
        tokenAmount,
        transactionId: transferResult.transactionId
      });

      return transferResult.transactionId!;

    } catch (error) {
      logger.error('Token transfer failed', {
        tokenId,
        investorWalletAddress,
        tokenAmount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process payment (mock implementation)
   */
  private async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResult> {
    logger.info('Processing payment', {
      userId: paymentRequest.userId,
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
      paymentMethod: paymentRequest.paymentMethod
    });

    // Mock payment processing - in real implementation, integrate with payment gateways
    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock success (90% success rate for testing)
      const isSuccess = Math.random() > 0.1;

      if (isSuccess) {
        return {
          success: true,
          transactionId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          paymentReference: `ref_${Date.now()}`,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          status: 'completed' as TransactionStatus,
          message: 'Payment processed successfully'
        };
      } else {
        return {
          success: false,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          status: 'failed' as TransactionStatus,
          message: 'Payment processing failed - insufficient funds'
        };
      }

    } catch (error) {
      logger.error('Payment processing error', { error });
      return {
        success: false,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        status: 'failed' as TransactionStatus,
        message: 'Payment service unavailable'
      };
    }
  }

  /**
   * Get user's investment portfolio
   */
  async getPortfolio(userId: string): Promise<Portfolio> {
    try {
      logger.info('Fetching user portfolio', { userId });

      const portfolio = await this.investmentModel.getUserPortfolio(userId);

      // Enrich with current property data
      const propertyIds = portfolio.investments.map(inv => inv.propertyId);
      const properties = await this.propertyModel.findByIds(propertyIds);

      // Update current values based on latest property prices
      for (const investment of portfolio.investments) {
        const property = properties.find(p => p.id === investment.propertyId);
        if (property) {
          investment.currentValue = investment.tokenAmount * property.pricePerToken;
        }
      }

      // Recalculate portfolio totals with updated values
      const totalValue = portfolio.investments.reduce((sum, inv) => sum + (inv.currentValue || 0), 0);
      const totalReturn = totalValue + portfolio.totalDividends - portfolio.investments.reduce((sum, inv) => sum + inv.totalPurchasePrice, 0);
      const returnPercentage = portfolio.investments.reduce((sum, inv) => sum + inv.totalPurchasePrice, 0) > 0 
        ? (totalReturn / portfolio.investments.reduce((sum, inv) => sum + inv.totalPurchasePrice, 0)) * 100 
        : 0;

      return {
        ...portfolio,
        totalValue,
        totalReturn,
        returnPercentage,
        properties
      };

    } catch (error) {
      logger.error('Error fetching portfolio', { userId, error });
      throw error;
    }
  }

  /**
   * Get portfolio performance analytics
   */
  async getPortfolioPerformance(userId: string): Promise<PortfolioPerformance> {
    try {
      const portfolio = await this.getPortfolio(userId);

      const totalInvested = portfolio.investments.reduce((sum, inv) => sum + inv.totalPurchasePrice, 0);
      const totalCurrentValue = portfolio.totalValue;
      const totalDividends = portfolio.totalDividends;
      
      const totalReturn = (totalCurrentValue + totalDividends) - totalInvested;
      const returnPercentage = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
      const dividendYield = totalInvested > 0 ? (totalDividends / totalInvested) * 100 : 0;
      const capitalGains = totalCurrentValue - totalInvested;

      // Calculate performance by property
      const performanceByProperty = portfolio.investments.map(investment => {
        const property = portfolio.properties.find(p => p.id === investment.propertyId);
        const currentValue = investment.currentValue || 0;
        const invested = investment.totalPurchasePrice;
        const dividends = investment.totalDividendsReceived;
        const propertyReturn = (currentValue + dividends) - invested;
        const propertyReturnPercentage = invested > 0 ? (propertyReturn / invested) * 100 : 0;
        const propertyDividendYield = invested > 0 ? (dividends / invested) * 100 : 0;

        return {
          propertyId: investment.propertyId,
          propertyName: property?.name || 'Unknown Property',
          return: propertyReturn,
          returnPercentage: propertyReturnPercentage,
          dividendYield: propertyDividendYield
        };
      });

      return {
        totalReturn,
        returnPercentage,
        dividendYield,
        capitalGains,
        performanceByProperty
      };

    } catch (error) {
      logger.error('Error calculating portfolio performance', { userId, error });
      throw error;
    }
  }

  /**
   * Get investment history for a user
   */
  async getInvestmentHistory(userId: string, limit: number = 50, offset: number = 0): Promise<{
    investments: Investment[];
    transactions: Transaction[];
    total: number;
  }> {
    try {
      const [investments, transactions] = await Promise.all([
        this.investmentModel.getUserInvestments(userId),
        this.transactionModel.getUserTransactions(userId, ['investment'], limit, offset)
      ]);

      return {
        investments,
        transactions: transactions.transactions,
        total: transactions.total
      };

    } catch (error) {
      logger.error('Error fetching investment history', { userId, error });
      throw error;
    }
  }

  /**
   * Update investment status
   */
  async updateInvestmentStatus(
    investmentId: string, 
    status: InvestmentStatus,
    userId?: string
  ): Promise<Investment | null> {
    try {
      logger.info('Updating investment status', { investmentId, status, userId });

      const investment = await this.investmentModel.updateById(investmentId, { status });
      
      if (investment && userId) {
        // Log status change for compliance
        await this.complianceService.logInvestmentStatusChange({
          investmentId,
          userId,
          oldStatus: investment.status,
          newStatus: status,
          timestamp: new Date()
        });
      }

      return investment ? this.investmentModel['mapDatabaseInvestment'](investment) : null;

    } catch (error) {
      logger.error('Error updating investment status', { investmentId, status, error });
      throw error;
    }
  }

  /**
   * Get investment statistics
   */
  async getInvestmentStats(): Promise<{
    totalInvestments: number;
    totalInvested: number;
    totalDividendsPaid: number;
    averageInvestmentSize: number;
    activeInvestors: number;
  }> {
    try {
      return await this.investmentModel.getInvestmentStats();
    } catch (error) {
      logger.error('Error fetching investment statistics', { error });
      throw error;
    }
  }

  /**
   * Send investment notification
   */
  private async sendInvestmentNotification(
    userId: string, 
    type: 'purchase_success' | 'purchase_failed' | 'dividend_received',
    data: any
  ): Promise<void> {
    try {
      // Mock notification service - in real implementation, integrate with notification service
      logger.info('Sending investment notification', { userId, type, data });
      
      // This would integrate with email/SMS/push notification services
      // For now, just log the notification
      
    } catch (error) {
      logger.error('Error sending investment notification', { userId, type, error });
      // Don't throw - notifications are not critical for the main flow
    }
  }

  /**
   * Validate user can make investment (compliance check)
   */
  private async validateUserCanInvest(userId: string, amount: number): Promise<boolean> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) return false;

      // Check KYC status
      if (user.kycStatus !== 'approved') return false;

      // Check if user has wallet
      if (!user.walletAddress) return false;

      // Check compliance limits
      const complianceCheck = await this.complianceService.checkInvestmentLimits(userId, amount);
      return complianceCheck.allowed;

    } catch (error) {
      logger.error('Error validating user investment eligibility', { userId, amount, error });
      return false;
    }
  }
}