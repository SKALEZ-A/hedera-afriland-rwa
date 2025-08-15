import { TradingService } from '../../services/TradingService';
import { Order, OrderType } from '../../types/entities';

// Mock dependencies
jest.mock('../services/HederaService');
jest.mock('../models/InvestmentModel');
jest.mock('../models/PropertyModel');
jest.mock('../models/TransactionModel');

describe('TradingService', () => {
  let tradingService: TradingService;

  beforeEach(() => {
    tradingService = new TradingService();
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create a buy order successfully', async () => {
      const order = await tradingService.createOrder(
        'user123',
        'token123',
        'BUY',
        100,
        105.50
      );

      expect(order).toMatchObject({
        userId: 'user123',
        tokenId: 'token123',
        orderType: 'BUY',
        amount: 100,
        price: 105.50,
        remainingAmount: 100,
        status: 'OPEN'
      });
      expect(order.id).toBeDefined();
      expect(order.createdAt).toBeInstanceOf(Date);
      expect(order.expiresAt).toBeInstanceOf(Date);
    });

    it('should create a sell order successfully', async () => {
      // Mock user investment
      const mockInvestmentModel = require('../../models/InvestmentModel').InvestmentModel;
      mockInvestmentModel.prototype.findByUserAndProperty.mockResolvedValue({
        userId: 'user123',
        tokenAmount: 200
      });

      const order = await tradingService.createOrder(
        'user123',
        'token123',
        'SELL',
        50,
        110.00
      );

      expect(order).toMatchObject({
        userId: 'user123',
        tokenId: 'token123',
        orderType: 'SELL',
        amount: 50,
        price: 110.00,
        remainingAmount: 50,
        status: 'OPEN'
      });
    });

    it('should reject sell order with insufficient tokens', async () => {
      const mockInvestmentModel = require('../../models/InvestmentModel').InvestmentModel;
      mockInvestmentModel.prototype.findByUserAndProperty.mockResolvedValue({
        userId: 'user123',
        tokenAmount: 30 // Less than requested 50
      });

      await expect(
        tradingService.createOrder('user123', 'token123', 'SELL', 50, 110.00)
      ).rejects.toThrow('Insufficient tokens for sell order');
    });

    it('should reject order with invalid parameters', async () => {
      await expect(
        tradingService.createOrder('user123', 'token123', 'BUY', 0, 105.50)
      ).rejects.toThrow('Amount and price must be positive');

      await expect(
        tradingService.createOrder('user123', 'token123', 'BUY', 100, -5)
      ).rejects.toThrow('Amount and price must be positive');
    });
  });

  describe('getOrderBook', () => {
    it('should return order book with buy and sell orders', async () => {
      // Create some test orders
      await tradingService.createOrder('user1', 'token123', 'BUY', 100, 105.00);
      await tradingService.createOrder('user2', 'token123', 'BUY', 50, 104.50);
      
      // Mock sell orders (need to mock investment check)
      const mockInvestmentModel = require('../../models/InvestmentModel').InvestmentModel;
      mockInvestmentModel.prototype.findByUserAndProperty.mockResolvedValue({
        tokenAmount: 200
      });
      
      await tradingService.createOrder('user3', 'token123', 'SELL', 75, 106.00);
      await tradingService.createOrder('user4', 'token123', 'SELL', 25, 107.00);

      const orderBook = await tradingService.getOrderBook('token123');

      expect(orderBook.buyOrders).toHaveLength(2);
      expect(orderBook.sellOrders).toHaveLength(2);
      
      // Buy orders should be sorted by price descending (highest first)
      expect(orderBook.buyOrders[0].price).toBe(105.00);
      expect(orderBook.buyOrders[1].price).toBe(104.50);
      
      // Sell orders should be sorted by price ascending (lowest first)
      expect(orderBook.sellOrders[0].price).toBe(106.00);
      expect(orderBook.sellOrders[1].price).toBe(107.00);
      
      // Spread should be calculated correctly
      expect(orderBook.spread).toBe(1.00); // 106.00 - 105.00
    });

    it('should return empty order book for token with no orders', async () => {
      const orderBook = await tradingService.getOrderBook('nonexistent_token');

      expect(orderBook.buyOrders).toHaveLength(0);
      expect(orderBook.sellOrders).toHaveLength(0);
      expect(orderBook.spread).toBe(0);
    });
  });

  describe('getUserOrders', () => {
    it('should return user orders', async () => {
      // Create orders for user
      await tradingService.createOrder('user123', 'token1', 'BUY', 100, 105.00);
      await tradingService.createOrder('user123', 'token2', 'BUY', 50, 200.00);

      const orders = await tradingService.getUserOrders('user123');

      expect(orders).toHaveLength(2);
      expect(orders[0].userId).toBe('user123');
      expect(orders[1].userId).toBe('user123');
      
      // Should be sorted by creation date (newest first)
      expect(orders[0].createdAt.getTime()).toBeGreaterThanOrEqual(orders[1].createdAt.getTime());
    });

    it('should filter orders by status', async () => {
      await tradingService.createOrder('user123', 'token1', 'BUY', 100, 105.00);
      
      // Cancel one order
      const allOrders = await tradingService.getUserOrders('user123');
      await tradingService.cancelOrder('user123', allOrders[0].id);

      const openOrders = await tradingService.getUserOrders('user123', 'OPEN');
      const cancelledOrders = await tradingService.getUserOrders('user123', 'CANCELLED');

      expect(openOrders).toHaveLength(0);
      expect(cancelledOrders).toHaveLength(1);
      expect(cancelledOrders[0].status).toBe('CANCELLED');
    });
  });

  describe('cancelOrder', () => {
    it('should cancel user order successfully', async () => {
      const order = await tradingService.createOrder('user123', 'token123', 'BUY', 100, 105.00);
      
      await tradingService.cancelOrder('user123', order.id);

      const userOrders = await tradingService.getUserOrders('user123');
      const cancelledOrder = userOrders.find(o => o.id === order.id);
      
      expect(cancelledOrder?.status).toBe('CANCELLED');
    });

    it('should reject cancelling non-existent order', async () => {
      await expect(
        tradingService.cancelOrder('user123', 'nonexistent_order')
      ).rejects.toThrow('Order not found or not owned by user');
    });

    it('should reject cancelling order owned by different user', async () => {
      const order = await tradingService.createOrder('user1', 'token123', 'BUY', 100, 105.00);
      
      await expect(
        tradingService.cancelOrder('user2', order.id)
      ).rejects.toThrow('Order not found or not owned by user');
    });
  });

  describe('getMarketStats', () => {
    it('should return market statistics', async () => {
      const mockProperty = {
        id: 'prop123',
        tokenId: 'token123',
        pricePerToken: 100,
        totalTokens: 10000,
        availableTokens: 2000
      };

      const mockPropertyModel = require('../../models/PropertyModel').PropertyModel;
      mockPropertyModel.prototype.findByTokenId.mockResolvedValue(mockProperty);

      const stats = await tradingService.getMarketStats('token123');

      expect(stats).toHaveProperty('currentPrice');
      expect(stats).toHaveProperty('priceChange24h');
      expect(stats).toHaveProperty('priceChangePercent24h');
      expect(stats).toHaveProperty('volume24h');
      expect(stats).toHaveProperty('high24h');
      expect(stats).toHaveProperty('low24h');
      expect(stats).toHaveProperty('totalSupply', 10000);
      expect(stats).toHaveProperty('circulatingSupply', 8000); // 10000 - 2000
      expect(stats).toHaveProperty('marketCap');
    });
  });

  describe('executeTrade', () => {
    it('should execute trade between matching orders', async () => {
      // Mock dependencies
      const mockInvestmentModel = require('../../models/InvestmentModel').InvestmentModel;
      const mockHederaService = require('../../services/HederaService').HederaService;
      const mockTransactionModel = require('../../models/TransactionModel').TransactionModel;

      mockInvestmentModel.prototype.findUserById.mockResolvedValue({
        walletAddress: 'wallet123'
      });
      mockHederaService.prototype.transferTokens.mockResolvedValue('token_tx_123');
      mockHederaService.prototype.transferHBAR.mockResolvedValue('hbar_tx_123');
      mockTransactionModel.prototype.create.mockResolvedValue(true);
      mockInvestmentModel.prototype.updateTokenAmount.mockResolvedValue(true);

      const buyOrder: Order = {
        id: 'buy_order_1',
        userId: 'buyer',
        tokenId: 'token123',
        orderType: 'BUY',
        amount: 100,
        price: 105.00,
        remainingAmount: 100,
        status: 'OPEN',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        updatedAt: new Date()
      };

      const sellOrder: Order = {
        id: 'sell_order_1',
        userId: 'seller',
        tokenId: 'token123',
        orderType: 'SELL',
        amount: 100,
        price: 104.00,
        remainingAmount: 100,
        status: 'OPEN',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        updatedAt: new Date()
      };

      const trade = await tradingService.executeTrade(buyOrder, sellOrder, 100, 104.00);

      expect(trade).toMatchObject({
        buyOrderId: 'buy_order_1',
        sellOrderId: 'sell_order_1',
        buyerId: 'buyer',
        sellerId: 'seller',
        tokenId: 'token123',
        amount: 100,
        price: 104.00,
        totalValue: 10400,
        status: 'COMPLETED'
      });

      expect(buyOrder.status).toBe('FILLED');
      expect(sellOrder.status).toBe('FILLED');
      expect(buyOrder.remainingAmount).toBe(0);
      expect(sellOrder.remainingAmount).toBe(0);
    });
  });
});