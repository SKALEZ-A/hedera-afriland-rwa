import { Request, Response } from 'express';
import { InvestmentService, InvestmentPurchaseRequest } from '../services/InvestmentService';
import { PaymentMethod, CurrencyCode } from '../types/entities';
import { logger } from '../utils/logger';

export class InvestmentController {
  private investmentService: InvestmentService;

  constructor() {
    this.investmentService = new InvestmentService();
  }

  /**
   * Purchase property tokens
   * POST /api/investments/purchase
   */
  purchaseTokens = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const {
        propertyId,
        tokenAmount,
        paymentMethod,
        currency,
        paymentReference
      } = req.body;

      // Validate required fields
      if (!propertyId || !tokenAmount || !paymentMethod || !currency) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['propertyId', 'tokenAmount', 'paymentMethod', 'currency']
        });
        return;
      }

      // Validate token amount
      if (tokenAmount <= 0 || !Number.isInteger(tokenAmount)) {
        res.status(400).json({
          error: 'Token amount must be a positive integer'
        });
        return;
      }

      // Validate payment method
      const validPaymentMethods: PaymentMethod[] = ['card', 'bank_transfer', 'mobile_money', 'crypto', 'hbar'];
      if (!validPaymentMethods.includes(paymentMethod)) {
        res.status(400).json({
          error: 'Invalid payment method',
          validMethods: validPaymentMethods
        });
        return;
      }

      // Validate currency
      const validCurrencies: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'NGN', 'KES', 'ZAR', 'GHS', 'UGX', 'HBAR'];
      if (!validCurrencies.includes(currency)) {
        res.status(400).json({
          error: 'Invalid currency',
          validCurrencies: validCurrencies
        });
        return;
      }

      const purchaseRequest: InvestmentPurchaseRequest = {
        userId,
        propertyId,
        tokenAmount,
        paymentMethod,
        currency,
        paymentReference
      };

      logger.info('Processing investment purchase request', {
        userId,
        propertyId,
        tokenAmount,
        paymentMethod,
        currency
      });

      const result = await this.investmentService.purchaseTokens(purchaseRequest);

      res.status(201).json({
        success: true,
        message: 'Investment purchase completed successfully',
        data: {
          investment: result.investment,
          transaction: result.transaction,
          blockchainTxId: result.blockchainTxId
        }
      });

    } catch (error) {
      logger.error('Investment purchase failed', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Error) {
        if (error.message.includes('validation failed')) {
          res.status(400).json({
            error: 'Investment validation failed',
            message: error.message
          });
          return;
        }

        if (error.message.includes('insufficient')) {
          res.status(400).json({
            error: 'Insufficient resources',
            message: error.message
          });
          return;
        }

        if (error.message.includes('Payment failed')) {
          res.status(402).json({
            error: 'Payment processing failed',
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        error: 'Investment purchase failed',
        message: 'An unexpected error occurred'
      });
    }
  };

  /**
   * Validate investment before purchase
   * POST /api/investments/validate
   */
  validateInvestment = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const {
        propertyId,
        tokenAmount,
        paymentMethod,
        currency
      } = req.body;

      if (!propertyId || !tokenAmount || !paymentMethod || !currency) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['propertyId', 'tokenAmount', 'paymentMethod', 'currency']
        });
        return;
      }

      const validationRequest: InvestmentPurchaseRequest = {
        userId,
        propertyId,
        tokenAmount,
        paymentMethod,
        currency
      };

      const validation = await this.investmentService.validateInvestment(validationRequest);

      res.json({
        success: true,
        data: {
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings
        }
      });

    } catch (error) {
      logger.error('Investment validation failed', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Investment validation failed',
        message: 'An unexpected error occurred'
      });
    }
  };

  /**
   * Get user's investment portfolio
   * GET /api/investments/portfolio
   */
  getPortfolio = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const portfolio = await this.investmentService.getPortfolio(userId);

      res.json({
        success: true,
        data: portfolio
      });

    } catch (error) {
      logger.error('Failed to fetch portfolio', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to fetch portfolio',
        message: 'An unexpected error occurred'
      });
    }
  };

  /**
   * Get portfolio performance analytics
   * GET /api/investments/portfolio/performance
   */
  getPortfolioPerformance = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const performance = await this.investmentService.getPortfolioPerformance(userId);

      res.json({
        success: true,
        data: performance
      });

    } catch (error) {
      logger.error('Failed to fetch portfolio performance', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to fetch portfolio performance',
        message: 'An unexpected error occurred'
      });
    }
  };

  /**
   * Get investment history
   * GET /api/investments/history
   */
  getInvestmentHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      if (limit > 100) {
        res.status(400).json({
          error: 'Limit cannot exceed 100'
        });
        return;
      }

      const history = await this.investmentService.getInvestmentHistory(userId, limit, offset);

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      logger.error('Failed to fetch investment history', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to fetch investment history',
        message: 'An unexpected error occurred'
      });
    }
  };

  /**
   * Get investment statistics (admin only)
   * GET /api/investments/stats
   */
  getInvestmentStats = async (req: Request, res: Response): Promise<void> => {
    try {
      // Check if user is admin (this would be implemented in auth middleware)
      if (!req.user?.isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const stats = await this.investmentService.getInvestmentStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Failed to fetch investment statistics', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to fetch investment statistics',
        message: 'An unexpected error occurred'
      });
    }
  };

  /**
   * Update investment status (admin only)
   * PUT /api/investments/:investmentId/status
   */
  updateInvestmentStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      // Check if user is admin
      if (!req.user?.isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { investmentId } = req.params;
      const { status } = req.body;

      if (!investmentId || !status) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['investmentId', 'status']
        });
        return;
      }

      const validStatuses = ['active', 'sold', 'partial_sold'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          error: 'Invalid status',
          validStatuses: validStatuses
        });
        return;
      }

      const updatedInvestment = await this.investmentService.updateInvestmentStatus(
        investmentId,
        status,
        req.user.id
      );

      if (!updatedInvestment) {
        res.status(404).json({
          error: 'Investment not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Investment status updated successfully',
        data: updatedInvestment
      });

    } catch (error) {
      logger.error('Failed to update investment status', {
        investmentId: req.params.investmentId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to update investment status',
        message: 'An unexpected error occurred'
      });
    }
  };
}