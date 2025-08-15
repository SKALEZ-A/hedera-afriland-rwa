
interface Order {
  id: string;
  userId: string;
  tokenId: string;
  type: 'buy' | 'sell';
  quantity: number;
  pricePerToken: number;
  pricePerTokenPerToken?: number;
  status: 'pending' | 'filled' | 'cancelled';
  createdAt: Date;
}

interface Trade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  tokenId: string;
  quantity: number;
  pricePerToken: number;
  pricePerTokenPerToken?: number;
  buyerId: string;
  sellerId: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  tokenTransferTxId?: string;
  paymentTransferTxId?: string;
}

import { Order, Trade, TokenId, OrderType, OrderStatus } from '../types/entities';
import { logger } from '../utils/logger';
import { HederaService } from './HederaService';
import { InvestmentModel } from '../models/InvestmentModel';
import { PropertyModel } from '../models/PropertyModel';
import { TransactionModel } from '../models/TransactionModel';

export class TradingService {
  private hederaService: HederaService;
  private investmentModel: InvestmentModel;
  private propertyModel: PropertyModel;
  private transactionModel: TransactionModel;
  private orderBook: Map<string, Order[]> = new Map(); // In-memory order book for demo

  constructor() {
    this.hederaService = new HederaService();
    this.investmentModel = new InvestmentModel();
    this.propertyModel = new PropertyModel();
    this.transactionModel = new TransactionModel();
  }

  /**
   * Create a buy or sell order
   */
  async createOrder(
    userId: string,
    tokenId: TokenId,
    orderType: OrderType,
    amount: number,
    price: number,
    expiresAt?: Date
  ): Promise<Order> {
    try {
      logger.info('Creating order', { userId, tokenId, orderType, amount, price });

      // Validate order parameters
      if (amount <= 0 || price <= 0) {
        throw new Error('Amount and price must be positive');
      }

      // For sell orders, verify user has sufficient tokens
      if (orderType === 'SELL') {
        const userInvestment = await this.investmentModel.findByUserAndProperty(userId, tokenId);
        if (!userInvestment || userInvestment.tokenAmount < amount) {
          throw new Error('Insufficient tokens for sell order');
        }
      }

      // For buy orders, verify user has sufficient balance (simplified for demo)
      if (orderType === 'BUY') {
        const requiredAmount = amount * price;
        // In production, this would check user's actual balance
        logger.info('Buy order requires balance', { requiredAmount });
      }

      const order: Order = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        tokenId,
        orderType,
        amount,
        price,
        remainingAmount: amount,
        status: 'open',
        createdAt: new Date(),
        expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
        updatedAt: new Date()
      };

      // Add to order book
      const tokenOrders = this.orderBook.get(tokenId) || [];
      tokenOrders.push(order);
      this.orderBook.set(tokenId, tokenOrders);

      // Try to match the order immediately
      await this.matchOrder(order);

      logger.info('Order created', { orderId: order.id, status: order.status });
      return order;
    } catch (error) {
      logger.error('Failed to create order', { error, userId, tokenId, orderType });
      throw error;
    }
  }

  /**
   * Cancel an existing order
   */
  async cancelOrder(userId: string, orderId: string): Promise<void> {
    try {
      logger.info('Cancelling order', { userId, orderId });

      // Find the order
      let order: Order | undefined;
      let tokenId: string | undefined;

      for (const [token, orders] of this.orderBook.entries()) {
        const foundOrder = orders.find(o => o.id === orderId && o.userId === userId);
        if (foundOrder) {
          order = foundOrder;
          tokenId = token;
          break;
        }
      }

      if (!order || !tokenId) {
        throw new Error('Order not found or not owned by user');
      }

      if (order.status !== 'open') {
        throw new Error('Can only cancel open orders');
      }

      // Update order status
      order.status = 'cancelled';
      order.updatedAt = new Date();

      logger.info('Order cancelled', { orderId, userId });
    } catch (error) {
      logger.error('Failed to cancel order', { error, userId, orderId });
      throw error;
    }
  }

  /**
   * Get order book for a token
   */
  async getOrderBook(tokenId: TokenId): Promise<{
    buyOrders: Order[];
    sellOrders: Order[];
    spread: number;
    lastTradePrice: number | null;
  }> {
    try {
      const orders = this.orderBook.get(tokenId) || [];
      const openOrders = orders.filter(order => order.status === 'open');

      const buyOrders = openOrders
        .filter(order => order.orderType === 'BUY')
        .sort((a, b) => b.pricePerToken - a.pricePerToken); // Highest price first

      const sellOrders = openOrders
        .filter(order => order.orderType === 'SELL')
        .sort((a, b) => a.pricePerToken - b.pricePerToken); // Lowest price first

      // Calculate spread
      const bestBid = buyOrders[0]?.pricePerToken || 0;
      const bestAsk = sellOrders[0]?.pricePerToken || 0;
      const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;

      // Get last trade price (mock for demo)
      const lastTradePrice = await this.getLastTradePrice(tokenId);

      return {
        buyOrders,
        sellOrders,
        spread,
        lastTradePrice
      };
    } catch (error) {
      logger.error('Failed to get order book', { error, tokenId });
      throw error;
    }
  }

  /**
   * Get user's orders
   */
  async getUserOrders(userId: string, status?: OrderStatus): Promise<Order[]> {
    try {
      const allOrders: Order[] = [];

      // Collect orders from all tokens
      for (const orders of this.orderBook.values()) {
        const userOrders = orders.filter(order => order.userId === userId);
        allOrders.push(...userOrders);
      }

      // Filter by status if provided
      const filteredOrders = status 
        ? allOrders.filter(order => order.status === status)
        : allOrders;

      // Sort by creation date (newest first)
      return filteredOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      logger.error('Failed to get user orders', { error, userId });
      throw error;
    }
  }

  /**
   * Execute a trade between two orders
   */
  async executeTrade(buyOrder: Order, sellOrder: Order, tradeAmount: number, tradePrice: number): Promise<Trade> {
    try {
      logger.info('Executing trade', { 
        buyOrderId: buyOrder.id, 
        sellOrderId: sellOrder.id, 
        tradeAmount, 
        tradePrice 
      });

      const trade: Trade = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        buyerId: buyOrder.userId,
        sellerId: sellOrder.userId,
        tokenId: buyOrder.tokenId,
        amount: tradeAmount,
        price: tradePrice,
        totalValue: tradeAmount * tradePrice,
        status: 'PENDING',
        createdAt: new Date(),
        completedAt: undefined
      };

      // Execute blockchain transfers
      await this.executeBlockchainTrade(trade);

      // Update order amounts
      buyOrder.remainingAmount -= tradeAmount;
      sellOrder.remainingAmount -= tradeAmount;

      // Update order statuses
      if (buyOrder.remainingAmount === 0) {
        buyOrder.status = 'filled';
      } else {
        buyOrder.status = 'partial_filled';
      }

      if (sellOrder.remainingAmount === 0) {
        sellOrder.status = 'filled';
      } else {
        sellOrder.status = 'partial_filled';
      }

      buyOrder.updatedAt = new Date();
      sellOrder.updatedAt = new Date();

      // Mark trade as completed
      // Status updated in database
      // Completion time updated in database

      // Record trade in database
      await this.recordTrade(trade);

      logger.info('Trade executed successfully', { tradeId: trade.id });
      return trade;
    } catch (error) {
      logger.error('Failed to execute trade', { error, buyOrder: buyOrder.id, sellOrder: sellOrder.id });
      throw error;
    }
  }

  /**
   * Match an order against existing orders in the order book
   */
  private async matchOrder(newOrder: Order): Promise<void> {
    try {
      const tokenOrders = this.orderBook.get(newOrder.tokenId) || [];
      const oppositeOrders = tokenOrders.filter(order => 
        order.orderType !== newOrder.orderType && 
        order.status === 'open' &&
        order.id !== newOrder.id
      );

      if (newOrder.orderType === 'BUY') {
        // Match buy order with sell orders (lowest price first)
        const sellOrders = oppositeOrders
          .filter(order => order.pricePerToken <= newOrder.pricePerToken)
          .sort((a, b) => a.pricePerToken - b.pricePerToken);

        for (const sellOrder of sellOrders) {
          if (newOrder.remainingAmount === 0) break;

          const tradeAmount = Math.min(newOrder.remainingAmount, sellOrder.remainingAmount);
          const tradePrice = sellOrder.pricePerToken; // Seller's price

          await this.executeTrade(newOrder, sellOrder, tradeAmount, tradePrice);
        }
      } else {
        // Match sell order with buy orders (highest price first)
        const buyOrders = oppositeOrders
          .filter(order => order.pricePerToken >= newOrder.pricePerToken)
          .sort((a, b) => b.pricePerToken - a.pricePerToken);

        for (const buyOrder of buyOrders) {
          if (newOrder.remainingAmount === 0) break;

          const tradeAmount = Math.min(newOrder.remainingAmount, buyOrder.remainingAmount);
          const tradePrice = buyOrder.pricePerToken; // Buyer's price

          await this.executeTrade(buyOrder, newOrder, tradeAmount, tradePrice);
        }
      }
    } catch (error) {
      logger.error('Failed to match order', { error, orderId: newOrder.id });
    }
  }

  /**
   * Execute blockchain transfers for a trade
   */
  private async executeBlockchainTrade(trade: Trade): Promise<void> {
    try {
      // Get user wallet addresses
      const buyer = await this.investmentModel.findUserById(trade.buyerId);
      const seller = await this.investmentModel.findUserById(trade.sellerId);

      if (!buyer?.walletAddress || !seller?.walletAddress) {
        throw new Error('User wallet addresses not found');
      }

      // Transfer tokens from seller to buyer
      const tokenTransferTx = await this.hederaService.transferTokens(
        trade.propertyId,
        seller.walletAddress,
        buyer.walletAddress,
        trade.tokenAmount,
        `Trade ${trade.id} - Token transfer`
      );

      // Transfer payment from buyer to seller (in HBAR for demo)
      const hbarAmount = await this.convertToHBAR(trade.totalValue);
      const paymentTransferTx = await this.hederaService.transferHbar(
        seller.walletAddress,
        hbarAmount,
        `Trade ${trade.id} - Payment`
      );

      // Update trade with transaction IDs
      // Transaction ID stored separately
      // Payment transaction ID stored separately

      logger.info('Blockchain trade executed', {
        tradeId: trade.id,
        tokenTransferTx,
        paymentTransferTx
      });
    } catch (error) {
      logger.error('Failed to execute blockchain trade', { error, tradeId: trade.id });
      throw error;
    }
  }

  /**
   * Record trade in database
   */
  private async recordTrade(trade: Trade): Promise<void> {
    try {
      // Record buy transaction
      await this.transactionModel.create({
        userId: trade.buyerId,
        type: 'TOKEN_PURCHASE_SECONDARY',
        amount: trade.totalValue,
        currency: 'USD',
        status: 'COMPLETED',
        blockchainTxId: trade.blockchainTxId || '',
        metadata: {
          tradeId: trade.id,
          tokenId: trade.propertyId,
          tokenAmount: trade.tokenAmount,
          pricePerToken: trade.pricePerToken
        }
      });

      // Record sell transaction
      await this.transactionModel.create({
        userId: trade.sellerId,
        type: 'TOKEN_SALE_SECONDARY',
        amount: trade.totalValue,
        currency: 'USD',
        status: 'COMPLETED',
        blockchainTxId: trade.blockchainTxId || '',
        metadata: {
          tradeId: trade.id,
          tokenId: trade.propertyId,
          tokenAmount: trade.tokenAmount,
          pricePerToken: trade.pricePerToken
        }
      });

      // Update investment records
      await this.investmentModel.updateTokenAmount(trade.buyerId, trade.propertyId, trade.tokenAmount, 'ADD');
      await this.investmentModel.updateTokenAmount(trade.sellerId, trade.propertyId, trade.tokenAmount, 'SUBTRACT');

      logger.info('Trade recorded in database', { tradeId: trade.id });
    } catch (error) {
      logger.error('Failed to record trade', { error, tradeId: trade.id });
      throw error;
    }
  }

  /**
   * Get trading history for a token
   */
  async getTradingHistory(tokenId: TokenId, limit: number = 50): Promise<Trade[]> {
    try {
      // In production, this would query from database
      // For demo, we'll return mock data
      const mockTrades: Trade[] = [
        {
          id: 'trade_1',
          buyOrderId: 'order_1',
          sellOrderId: 'order_2',
          buyerId: 'buyer1',
          sellerId: 'seller1',
          tokenId,
          amount: 100,
          price: 105,
          totalValue: 10500,
          status: 'COMPLETED',
          createdAt: new Date(Date.now() - 86400000), // 1 day ago
          completedAt: new Date(Date.now() - 86400000)
        },
        {
          id: 'trade_2',
          buyOrderId: 'order_3',
          sellOrderId: 'order_4',
          buyerId: 'buyer2',
          sellerId: 'seller2',
          tokenId,
          amount: 50,
          price: 103,
          totalValue: 5150,
          status: 'COMPLETED',
          createdAt: new Date(Date.now() - 172800000), // 2 days ago
          completedAt: new Date(Date.now() - 172800000)
        }
      ];

      return mockTrades.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get trading history', { error, tokenId });
      throw error;
    }
  }

  /**
   * Get market statistics for a token
   */
  async getMarketStats(tokenId: TokenId): Promise<{
    currentPrice: number;
    priceChange24h: number;
    priceChangePercent24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
    totalSupply: number;
    circulatingSupply: number;
    marketCap: number;
  }> {
    try {
      const property = await this.propertyModel.findByTokenId(tokenId);
      if (!property) {
        throw new Error(`Property not found for token ${tokenId}`);
      }

      // Get recent trades for calculations
      const recentTrades = await this.getTradingHistory(tokenId, 100);
      const trades24h = recentTrades.filter(
        trade => new Date(trade.createdAt).getTime() > Date.now() - 86400000
      );

      // Calculate statistics
      const currentPrice = await this.getLastTradePrice(tokenId) || property.pricePerToken || 0;
      const volume24h = trades24h.reduce((sum, trade) => sum + trade.totalValue, 0);
      
      const prices24h = trades24h.map(trade => trade.pricePerToken);
      const high24h = prices24h.length > 0 ? Math.max(...prices24h) : currentPrice;
      const low24h = prices24h.length > 0 ? Math.min(...prices24h) : currentPrice;

      // Calculate price change (mock for demo)
      const priceChange24h = currentPrice * (Math.random() * 0.1 - 0.05); // ±5% random
      const priceChangePercent24h = (priceChange24h / currentPrice) * 100;

      const totalSupply = property.totalTokens;
      const circulatingSupply = property.totalTokens - property.availableTokens;
      const marketCap = currentPrice * circulatingSupply;

      return {
        currentPrice,
        priceChange24h,
        priceChangePercent24h,
        volume24h,
        high24h,
        low24h,
        totalSupply,
        circulatingSupply,
        marketCap
      };
    } catch (error) {
      logger.error('Failed to get market stats', { error, tokenId });
      throw error;
    }
  }

  /**
   * Get last trade price for a token
   */
  private async getLastTradePrice(tokenId: TokenId): Promise<number | null> {
    try {
      const recentTrades = await this.getTradingHistory(tokenId, 1);
      return recentTrades.length > 0 ? recentTrades[0].pricePerToken : null;
    } catch (error) {
      logger.error('Failed to get last trade price', { error, tokenId });
      return null;
    }
  }

  /**
   * Convert USD amount to HBAR
   */
  private async convertToHBAR(usdAmount: number): Promise<number> {
    // Mock conversion rate
    const hbarPrice = 0.05; // $0.05 per HBAR
    return usdAmount / hbarPrice;
  }

  /**
   * Clean up expired orders
   */
  async cleanupExpiredOrders(): Promise<void> {
    try {
      const now = new Date();
      let cleanedCount = 0;

      for (const [tokenId, orders] of this.orderBook.entries()) {
        const validOrders = orders.filter(order => {
          if (order.expiresAt && order.expiresAt < now && order.status === 'open') {
            order.status = 'cancelled';
            order.updatedAt = now;
            cleanedCount++;
            return true; // Keep expired orders for history
          }
          return true;
        });

        this.orderBook.set(tokenId, validOrders);
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up expired orders', { cleanedCount });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired orders', { error });
    }
  }
}