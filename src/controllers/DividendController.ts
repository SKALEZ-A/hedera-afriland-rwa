import { Request, Response } from 'express';
import { DividendService } from '../services/DividendService';
import { logger } from '../utils/logger';

export class DividendController {
  private dividendService: DividendService;

  constructor() {
    this.dividendService = new DividendService();
  }

  /**
   * Calculate dividend distribution for a property
   */
  calculateDistribution = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const { totalIncome } = req.body;

      if (!totalIncome || totalIncome <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valid total income amount is required'
        });
        return;
      }

      const distributions = await this.dividendService.calculateDistribution(tokenId, totalIncome);

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          totalIncome,
          distributions,
          summary: {
            totalRecipients: distributions.length,
            totalDistributable: distributions.reduce((sum, dist) => sum + dist.dividendAmount, 0),
            averageDistribution: distributions.length > 0 
              ? distributions.reduce((sum, dist) => sum + dist.dividendAmount, 0) / distributions.length 
              : 0
          }
        }
      });
    } catch (error) {
      logger.error('Failed to calculate dividend distribution', { 
        error, 
        tokenId: req.params.tokenId,
        userId: req.user?.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to calculate dividend distribution'
      });
    }
  };

  /**
   * Distribute dividends to token holders
   */
  distributeDividends = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const { totalIncome } = req.body;

      if (!totalIncome || totalIncome <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valid total income amount is required'
        });
        return;
      }

      // Calculate distributions first
      const distributions = await this.dividendService.calculateDistribution(tokenId, totalIncome);

      if (distributions.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No token holders found for distribution'
        });
        return;
      }

      // Execute the distribution
      await this.dividendService.distributeDividends(tokenId, distributions);

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          totalIncome,
          distributionCount: distributions.length,
          message: 'Dividend distribution completed successfully'
        }
      });
    } catch (error) {
      logger.error('Failed to distribute dividends', { 
        error, 
        tokenId: req.params.tokenId,
        userId: req.user?.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to distribute dividends'
      });
    }
  };

  /**
   * Get distribution history for a property
   */
  getDistributionHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const history = await this.dividendService.getDistributionHistory(tokenId);

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          history,
          summary: {
            totalDistributions: history.length,
            totalAmount: history.reduce((sum, dist) => sum + dist.totalAmount, 0),
            averageDistribution: history.length > 0 
              ? history.reduce((sum, dist) => sum + dist.totalAmount, 0) / history.length 
              : 0
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get distribution history', { 
        error, 
        tokenId: req.params.tokenId 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get distribution history'
      });
    }
  };

  /**
   * Set management fees for a property
   */
  setManagementFees = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const { feePercentage } = req.body;

      if (typeof feePercentage !== 'number' || feePercentage < 0 || feePercentage > 0.1) {
        res.status(400).json({
          success: false,
          error: 'Fee percentage must be between 0 and 0.1 (10%)'
        });
        return;
      }

      await this.dividendService.setManagementFees(tokenId, feePercentage);

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          feePercentage,
          message: 'Management fees updated successfully'
        }
      });
    } catch (error) {
      logger.error('Failed to set management fees', { 
        error, 
        tokenId: req.params.tokenId,
        userId: req.user?.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to set management fees'
      });
    }
  };

  /**
   * Calculate projected dividends for an investment
   */
  calculateProjectedDividends = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const { tokenAmount, projectionMonths = 12 } = req.body;

      if (!tokenAmount || tokenAmount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Valid token amount is required'
        });
        return;
      }

      const projection = await this.dividendService.calculateProjectedDividends(
        tokenId, 
        tokenAmount, 
        projectionMonths
      );

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          tokenAmount,
          projectionMonths,
          ...projection
        }
      });
    } catch (error) {
      logger.error('Failed to calculate projected dividends', { 
        error, 
        tokenId: req.params.tokenId 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to calculate projected dividends'
      });
    }
  };

  /**
   * Claim pending dividends for a user
   */
  claimDividends = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const userId = req.user?.id!;

      const claimedAmount = await this.dividendService.claimDividends(userId, tokenId);

      if (claimedAmount === 0) {
        res.status(200).json({
          success: true,
          data: {
            message: 'No pending dividends to claim',
            claimedAmount: 0
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          claimedAmount,
          message: 'Dividends claimed successfully'
        }
      });
    } catch (error) {
      logger.error('Failed to claim dividends', { 
        error, 
        tokenId: req.params.tokenId,
        userId: req.user?.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to claim dividends'
      });
    }
  };

  /**
   * Get pending dividends for the current user
   */
  getPendingDividends = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id!;
      const pendingDividends = await this.dividendService.getPendingDividends(userId);

      res.status(200).json({
        success: true,
        data: pendingDividends
      });
    } catch (error) {
      logger.error('Failed to get pending dividends', { 
        error, 
        userId: req.user?.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get pending dividends'
      });
    }
  };

  /**
   * Get dividend analytics for a property
   */
  getDividendAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const history = await this.dividendService.getDistributionHistory(tokenId);

      // Calculate analytics
      const totalDistributions = history.length;
      const totalAmount = history.reduce((sum, dist) => sum + dist.totalAmount, 0);
      const averageDistribution = totalDistributions > 0 ? totalAmount / totalDistributions : 0;
      
      // Calculate monthly trends (last 12 months)
      const monthlyTrends = history
        .slice(0, 12)
        .map(dist => ({
          month: dist.distributionDate.toISOString().substring(0, 7), // YYYY-MM format
          amount: dist.totalAmount,
          recipientCount: dist.recipientCount
        }))
        .reverse();

      // Calculate yield metrics
      const lastDistribution = history[0];
      const annualizedYield = lastDistribution 
        ? (lastDistribution.totalAmount * 12) / (lastDistribution.recipientCount * 100) // Assuming $100 per token
        : 0;

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          analytics: {
            totalDistributions,
            totalAmount,
            averageDistribution,
            annualizedYield,
            monthlyTrends,
            lastDistribution: lastDistribution ? {
              date: lastDistribution.distributionDate,
              amount: lastDistribution.totalAmount,
              recipients: lastDistribution.recipientCount
            } : null
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get dividend analytics', { 
        error, 
        tokenId: req.params.tokenId 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get dividend analytics'
      });
    }
  };
}