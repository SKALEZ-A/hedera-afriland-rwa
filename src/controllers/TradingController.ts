import { Request, Response } from 'express';
import { TradingService } from '../services/TradingService';
import { logger } from '../utils/logger';
import { OrderType } from '../types/entities';

export class TradingController {
  private tradingService: TradingService;

  constructor() {
    this.tradingService = new TradingService();
  }

  /**
   * Create a buy or sell order
   */
  createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id!;
      const {
        tokenId,
        orderType,
        amount,
        price,
        expiresAt
      } = req.body;

      if (!['BUY', 'SELL'].includes(orderType)) {
        res.status(400).json({
          success: false,
          error: 'Order type must be BUY or SELL'
        });
        return;
      }

      const order = await this.tradingService.createOrder(
        userId,
        tokenId,
        orderType as OrderType,
        amount,
        price,
        expiresAt ? new Date(expiresAt) : undefined
      );

      res.status(201).json({
        success: true,
        data: order
      });
    } catch (error) {
      logger.error('Failed to create order', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create order'
      });
    }
  };

  /**
   * Cancel an existing order
   */
  cancelOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id!;
      const { orderId } = req.params;

      await this.tradingService.cancelOrder(userId, orderId);

      res.status(200).json({
        success: true,
        data: {
          message: 'Order cancelled successfully',
          orderId
        }
      });
    } catch (error) {
      logger.error('Failed to cancel order', { error, userId: req.user?.id, orderId: req.params.orderId });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel order'
      });
    }
  };

  /**
   * Get order book for a token
   */
  getOrderBook = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const orderBook = await this.tradingService.getOrderBook(tokenId);

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          ...orderBook
        }
      });
    } catch (error) {
      logger.error('Failed to get order book', { error, tokenId: req.params.tokenId });
      res.status(500).json({
        success: false,
        error: 'Failed to get order book'
      });
    }
  };

  /**
   * Get user's orders
   */
  getUserOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id!;
      const { status } = req.query;

      const orders = await this.tradingService.getUserOrders(
        userId,
        status as any
      );

      res.status(200).json({
        success: true,
        data: {
          orders,
          summary: {
            totalOrders: orders.length,
            openOrders: orders.filter(o => o.status === 'OPEN').length,
            filledOrders: orders.filter(o => o.status === 'FILLED').length,
            cancelledOrders: orders.filter(o => o.status === 'CANCELLED').length
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get user orders', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get user orders'
      });
    }
  };

  /**
   * Get trading history for a token
   */
  getTradingHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const trades = await this.tradingService.getTradingHistory(tokenId, limit);

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          trades,
          summary: {
            totalTrades: trades.length,
            totalVolume: trades.reduce((sum, trade) => sum + trade.totalValue, 0),
            averagePrice: trades.length > 0 
              ? trades.reduce((sum, trade) => sum + trade.price, 0) / trades.length 
              : 0
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get trading history', { error, tokenId: req.params.tokenId });
      res.status(500).json({
        success: false,
        error: 'Failed to get trading history'
      });
    }
  };

  /**
   * Get market statistics for a token
   */
  getMarketStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const stats = await this.tradingService.getMarketStats(tokenId);

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          ...stats
        }
      });
    } catch (error) {
      logger.error('Failed to get market stats', { error, tokenId: req.params.tokenId });
      res.status(500).json({
        success: false,
        error: 'Failed to get market stats'
      });
    }
  };

  /**
   * Get market overview (multiple tokens)
   */
  getMarketOverview = async (req: Request, res: Response): Promise<void> => {
    try {
      // Mock market overview data for demo
      const marketOverview = {
        totalMarketCap: 50000000, // $50M
        totalVolume24h: 2500000,  // $2.5M
        totalProperties: 25,
        activeTraders: 1250,
        topPerformers: [
          {
            tokenId: 'token_lagos_luxury_001',
            name: 'Lagos Luxury Apartments',
            currentPrice: 105.50,
            priceChange24h: 5.50,
            priceChangePercent24h: 5.5,
            volume24h: 125000
          },
          {
            tokenId: 'token_nairobi_office_001',
            name: 'Nairobi Office Complex',
            currentPrice: 98.75,
            priceChange24h: 3.25,
            priceChangePercent24h: 3.4,
            volume24h: 89000
          },
          {
            tokenId: 'token_cape_town_retail_001',
            name: 'Cape Town Retail Center',
            currentPrice: 112.30,
            priceChange24h: -2.10,
            priceChangePercent24h: -1.8,
            volume24h: 156000
          }
        ]
      };

      res.status(200).json({
        success: true,
        data: marketOverview
      });
    } catch (error) {
      logger.error('Failed to get market overview', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get market overview'
      });
    }
  };

  /**
   * Get order details
   */
  getOrderDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id!;
      const { orderId } = req.params;

      const userOrders = await this.tradingService.getUserOrders(userId);
      const order = userOrders.find(o => o.id === orderId);

      if (!order) {
        res.status(404).json({
          success: false,
          error: 'Order not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: order
      });
    } catch (error) {
      logger.error('Failed to get order details', { error, orderId: req.params.orderId });
      res.status(500).json({
        success: false,
        error: 'Failed to get order details'
      });
    }
  };

  /**
   * Get price chart data for a token
   */
  getPriceChart = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const { period = '24h' } = req.query;

      // Mock price chart data for demo
      const now = new Date();
      const dataPoints = [];
      const intervals = period === '24h' ? 24 : period === '7d' ? 7 * 24 : 30 * 24;
      const intervalMs = period === '24h' ? 3600000 : period === '7d' ? 3600000 : 3600000; // 1 hour

      let basePrice = 100;
      for (let i = intervals; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - (i * intervalMs));
        const priceVariation = (Math.random() - 0.5) * 10; // ±$5 variation
        const price = Math.max(basePrice + priceVariation, 50); // Minimum $50
        
        dataPoints.push({
          timestamp,
          price,
          volume: Math.random() * 10000 + 1000 // Random volume
        });
        
        basePrice = price;
      }

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          period,
          dataPoints
        }
      });
    } catch (error) {
      logger.error('Failed to get price chart', { error, tokenId: req.params.tokenId });
      res.status(500).json({
        success: false,
        error: 'Failed to get price chart'
      });
    }
  };

  /**
   * Get liquidity information for a token
   */
  getLiquidity = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.params;
      const orderBook = await this.tradingService.getOrderBook(tokenId);

      // Calculate liquidity metrics
      const totalBuyVolume = orderBook.buyOrders.reduce((sum, order) => sum + (order.remainingAmount * order.price), 0);
      const totalSellVolume = orderBook.sellOrders.reduce((sum, order) => sum + (order.remainingAmount * order.price), 0);
      const totalLiquidity = totalBuyVolume + totalSellVolume;

      const bestBid = orderBook.buyOrders[0]?.price || 0;
      const bestAsk = orderBook.sellOrders[0]?.price || 0;
      const midPrice = (bestBid + bestAsk) / 2;

      res.status(200).json({
        success: true,
        data: {
          tokenId,
          totalLiquidity,
          totalBuyVolume,
          totalSellVolume,
          bestBid,
          bestAsk,
          midPrice,
          spread: orderBook.spread,
          spreadPercent: midPrice > 0 ? (orderBook.spread / midPrice) * 100 : 0
        }
      });
    } catch (error) {
      logger.error('Failed to get liquidity info', { error, tokenId: req.params.tokenId });
      res.status(500).json({
        success: false,
        error: 'Failed to get liquidity info'
      });
    }
  };
}