import { BaseModel } from './BaseModel';
import { Investment, Portfolio } from '../types/entities';

export class InvestmentModel extends BaseModel {
  constructor() {
    super('investments');
  }

  /**
   * Create a new investment
   */
  async createInvestment(investmentData: {
    userId: string;
    propertyId: string;
    tokenAmount: number;
    purchasePricePerToken: number;
    blockchainTxId?: string;
  }): Promise<Investment> {
    const totalPurchasePrice = investmentData.tokenAmount * investmentData.purchasePricePerToken;

    const investmentToCreate = {
      user_id: investmentData.userId,
      property_id: investmentData.propertyId,
      token_amount: investmentData.tokenAmount,
      purchase_price_per_token: investmentData.purchasePricePerToken,
      total_purchase_price: totalPurchasePrice,
      current_value: totalPurchasePrice, // Initially same as purchase price
      blockchain_tx_id: investmentData.blockchainTxId,
    };

    const investment = await this.create<any>(investmentToCreate);
    return this.mapDatabaseInvestment(investment);
  }

  /**
   * Get user's investments
   */
  async getUserInvestments(userId: string): Promise<Investment[]> {
    const query = `
      SELECT i.*, p.name as property_name, p.price_per_token as current_price_per_token
      FROM investments i
      JOIN properties p ON i.property_id = p.id
      WHERE i.user_id = $1 AND i.status = 'active'
      ORDER BY i.created_at DESC
    `;
    
    const result = await this.query<any>(query, [userId]);
    return result.rows.map(row => this.mapDatabaseInvestment(row));
  }

  /**
   * Get investment by user and property
   */
  async getInvestmentByUserAndProperty(userId: string, propertyId: string): Promise<Investment | null> {
    const query = 'SELECT * FROM investments WHERE user_id = $1 AND property_id = $2';
    const result = await this.query<any>(query, [userId, propertyId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDatabaseInvestment(result.rows[0]);
  }

  /**
   * Update investment token amount (for additional purchases)
   */
  async addTokensToInvestment(
    userId: string, 
    propertyId: string, 
    additionalTokens: number,
    pricePerToken: number
  ): Promise<Investment | null> {
    const additionalValue = additionalTokens * pricePerToken;
    
    const query = `
      UPDATE investments 
      SET 
        token_amount = token_amount + $3,
        total_purchase_price = total_purchase_price + $4,
        current_value = current_value + $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND property_id = $2
      RETURNING *
    `;
    
    const result = await this.query<any>(query, [userId, propertyId, additionalTokens, additionalValue]);
    return result.rows.length > 0 ? this.mapDatabaseInvestment(result.rows[0]) : null;
  }

  /**
   * Update investment current value
   */
  async updateCurrentValue(investmentId: string, currentValue: number): Promise<Investment | null> {
    const result = await this.updateById(investmentId, { current_value: currentValue });
    return result ? this.mapDatabaseInvestment(result) : null;
  }

  /**
   * Add dividend to investment
   */
  async addDividend(investmentId: string, dividendAmount: number): Promise<Investment | null> {
    const query = `
      UPDATE investments 
      SET 
        total_dividends_received = total_dividends_received + $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.query<any>(query, [investmentId, dividendAmount]);
    return result.rows.length > 0 ? this.mapDatabaseInvestment(result.rows[0]) : null;
  }

  /**
   * Get user's portfolio summary
   */
  async getUserPortfolio(userId: string): Promise<Portfolio> {
    const query = `
      SELECT 
        i.*,
        p.name as property_name,
        p.price_per_token as current_price_per_token,
        p.property_type,
        p.country,
        p.expected_annual_yield
      FROM investments i
      JOIN properties p ON i.property_id = p.id
      WHERE i.user_id = $1 AND i.status = 'active'
      ORDER BY i.created_at DESC
    `;
    
    const result = await this.query<any>(query, [userId]);
    const investments = result.rows.map(row => this.mapDatabaseInvestment(row));

    // Calculate portfolio totals
    const totalInvestments = investments.length;
    const totalValue = investments.reduce((sum, inv) => sum + (inv.currentValue || 0), 0);
    const totalDividends = investments.reduce((sum, inv) => sum + inv.totalDividendsReceived, 0);
    const totalPurchasePrice = investments.reduce((sum, inv) => sum + inv.totalPurchasePrice, 0);
    const totalReturn = totalValue + totalDividends - totalPurchasePrice;
    const returnPercentage = totalPurchasePrice > 0 ? (totalReturn / totalPurchasePrice) * 100 : 0;

    return {
      userId,
      totalInvestments,
      totalValue,
      totalDividends,
      totalReturn,
      returnPercentage,
      investments,
      properties: [] // Will be populated by service layer
    };
  }

  /**
   * Get property investors
   */
  async getPropertyInvestors(propertyId: string): Promise<{
    totalInvestors: number;
    totalInvested: number;
    investors: Array<{
      userId: string;
      tokenAmount: number;
      totalInvested: number;
      investmentDate: Date;
    }>;
  }> {
    const query = `
      SELECT 
        i.user_id,
        i.token_amount,
        i.total_purchase_price,
        i.created_at,
        u.first_name,
        u.last_name
      FROM investments i
      JOIN users u ON i.user_id = u.id
      WHERE i.property_id = $1 AND i.status = 'active'
      ORDER BY i.token_amount DESC
    `;
    
    const result = await this.query<any>(query, [propertyId]);
    
    const investors = result.rows.map(row => ({
      userId: row.user_id,
      tokenAmount: parseInt(row.token_amount, 10),
      totalInvested: parseFloat(row.total_purchase_price),
      investmentDate: row.created_at
    }));

    const totalInvestors = investors.length;
    const totalInvested = investors.reduce((sum, inv) => sum + inv.totalInvested, 0);

    return {
      totalInvestors,
      totalInvested,
      investors
    };
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
    const query = `
      SELECT 
        COUNT(*) as total_investments,
        COUNT(DISTINCT user_id) as active_investors,
        COALESCE(SUM(total_purchase_price), 0) as total_invested,
        COALESCE(SUM(total_dividends_received), 0) as total_dividends_paid,
        COALESCE(AVG(total_purchase_price), 0) as average_investment_size
      FROM investments
      WHERE status = 'active'
    `;

    const result = await this.query<{
      total_investments: string;
      active_investors: string;
      total_invested: string;
      total_dividends_paid: string;
      average_investment_size: string;
    }>(query);

    const row = result.rows[0];
    return {
      totalInvestments: parseInt(row.total_investments, 10),
      activeInvestors: parseInt(row.active_investors, 10),
      totalInvested: parseFloat(row.total_invested),
      totalDividendsPaid: parseFloat(row.total_dividends_paid),
      averageInvestmentSize: parseFloat(row.average_investment_size)
    };
  }

  /**
   * Find investment by user and property
   */
  async findByUserAndProperty(userId: string, propertyId: string): Promise<Investment | null> {
    return this.getInvestmentByUserAndProperty(userId, propertyId);
  }

  /**
   * Find user by ID (for compatibility)
   */
  async findUserById(userId: string): Promise<any> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.query<any>(query, [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update token amount for user
   */
  async updateTokenAmount(userId: string, tokenId: string, amount: number, operation: 'ADD' | 'SUBTRACT'): Promise<void> {
    const operator = operation === 'ADD' ? '+' : '-';
    const query = `
      UPDATE investments 
      SET token_amount = token_amount ${operator} $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND property_id = $2
    `;
    await this.query(query, [userId, tokenId, amount]);
  }

  /**
   * Map database row to Investment entity
   */
  private mapDatabaseInvestment(row: any): Investment {
    return {
      id: row.id,
      userId: row.user_id,
      propertyId: row.property_id,
      tokenAmount: parseInt(row.token_amount, 10),
      purchasePricePerToken: parseFloat(row.purchase_price_per_token),
      totalPurchasePrice: parseFloat(row.total_purchase_price),
      purchaseDate: row.purchase_date || row.created_at,
      ...(row.current_value && { currentValue: parseFloat(row.current_value) }),
      totalDividendsReceived: parseFloat(row.total_dividends_received || '0'),
      status: row.status,
      blockchainTxId: row.blockchain_tx_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async count(filter: any = {}): Promise<number> {
    // Placeholder implementation
    return 0;
  }

  static async find(filter: any = {}): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

  static async create(data: any): Promise<any> {
    // Placeholder implementation
    return { id: 'placeholder', ...data };
  }

  static async deleteMany(filter: any = {}): Promise<void> {
    // Placeholder implementation
  }

  static async aggregate(pipeline: any[]): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

  static async findByPropertyId(propertyId: string): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

  static async findByType(type: string): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

  static async findByUserIdAndType(userId: string, type: string): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

}