import { BaseModel } from './BaseModel';
import { Transaction, TransactionType, TransactionStatus, CurrencyCode, PaymentMethod } from '../types/entities';

export class TransactionModel extends BaseModel {
  constructor() {
    super('transactions');
  }

  /**
   * Create a new transaction
   */
  async createTransaction(transactionData: {
    userId: string;
    propertyId?: string;
    investmentId?: string;
    transactionType: TransactionType;
    amount: number;
    currency?: CurrencyCode;
    feeAmount?: number;
    netAmount?: number;
    paymentMethod?: PaymentMethod;
    paymentReference?: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<Transaction> {
    const feeAmount = transactionData.feeAmount || 0;
    const netAmount = transactionData.netAmount || (transactionData.amount + feeAmount);

    const transactionToCreate = {
      user_id: transactionData.userId,
      property_id: transactionData.propertyId,
      investment_id: transactionData.investmentId,
      transaction_type: transactionData.transactionType,
      amount: transactionData.amount,
      currency: transactionData.currency || 'USD',
      fee_amount: feeAmount,
      net_amount: netAmount,
      payment_method: transactionData.paymentMethod,
      payment_reference: transactionData.paymentReference,
      description: transactionData.description,
      metadata: transactionData.metadata ? JSON.stringify(transactionData.metadata) : null,
    };

    const transaction = await this.create<any>(transactionToCreate);
    return this.mapDatabaseTransaction(transaction);
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    transactionId: string, 
    status: TransactionStatus,
    blockchainTxId?: string
  ): Promise<Transaction | null> {
    const updateData: any = { status };
    
    if (blockchainTxId) {
      updateData.blockchain_tx_id = blockchainTxId;
    }
    
    if (status === 'completed') {
      updateData.processed_at = new Date();
    }

    const result = await this.updateById(transactionId, updateData);
    return result ? this.mapDatabaseTransaction(result) : null;
  }

  /**
   * Update transaction with additional data
   */
  async updateTransaction(
    transactionId: string, 
    updateData: Partial<{
      status: TransactionStatus;
      blockchainTxId: string;
      paymentReference: string;
      processedAt: Date;
      metadata: Record<string, any>;
    }>
  ): Promise<Transaction | null> {
    const dbUpdateData: any = {};
    
    if (updateData.status) dbUpdateData.status = updateData.status;
    if (updateData.blockchainTxId) dbUpdateData.blockchain_tx_id = updateData.blockchainTxId;
    if (updateData.paymentReference) dbUpdateData.payment_reference = updateData.paymentReference;
    if (updateData.processedAt) dbUpdateData.processed_at = updateData.processedAt;
    if (updateData.metadata) dbUpdateData.metadata = JSON.stringify(updateData.metadata);

    const result = await this.updateById(transactionId, dbUpdateData);
    return result ? this.mapDatabaseTransaction(result) : null;
  }

  /**
   * Get user transactions
   */
  async getUserTransactions(
    userId: string,
    types?: TransactionType[],
    limit?: number,
    offset?: number
  ): Promise<{ transactions: Transaction[]; total: number }> {
    // Get total count first
    let countQuery = 'SELECT COUNT(*) as total FROM transactions WHERE user_id = $1';
    let countParams: any[] = [userId];
    
    if (types && types.length > 0) {
      const placeholders = types.map((_, index) => `$${index + 2}`).join(',');
      countQuery += ` AND transaction_type IN (${placeholders})`;
      countParams.push(...types);
    }
    
    const countResult = await this.query<{ total: string }>(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get transactions with pagination
    let query = `
      SELECT t.*, p.name as property_name
      FROM transactions t
      LEFT JOIN properties p ON t.property_id = p.id
      WHERE t.user_id = $1
    `;
    
    const params: any[] = [userId];
    let paramIndex = 2;

    if (types && types.length > 0) {
      const placeholders = types.map(() => `$${paramIndex++}`).join(',');
      query += ` AND t.transaction_type IN (${placeholders})`;
      params.push(...types);
    }

    query += ' ORDER BY t.created_at DESC';

    if (limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(limit);
    }

    if (offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(offset);
    }

    const result = await this.query<any>(query, params);
    const transactions = result.rows.map(row => this.mapDatabaseTransaction(row));
    
    return { transactions, total };
  }

  /**
   * Get property transactions
   */
  async getPropertyTransactions(propertyId: string): Promise<Transaction[]> {
    const query = `
      SELECT t.*, u.first_name, u.last_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.property_id = $1
      ORDER BY t.created_at DESC
    `;
    
    const result = await this.query<any>(query, [propertyId]);
    return result.rows.map(row => this.mapDatabaseTransaction(row));
  }

  /**
   * Get transactions by status
   */
  async getTransactionsByStatus(status: TransactionStatus): Promise<Transaction[]> {
    const query = `
      SELECT t.*, p.name as property_name, u.first_name, u.last_name
      FROM transactions t
      LEFT JOIN properties p ON t.property_id = p.id
      JOIN users u ON t.user_id = u.id
      WHERE t.status = $1
      ORDER BY t.created_at DESC
    `;
    
    const result = await this.query<any>(query, [status]);
    return result.rows.map(row => this.mapDatabaseTransaction(row));
  }

  /**
   * Map database row to Transaction entity
   */
  private mapDatabaseTransaction(row: any): Transaction {
    return {
      id: row.id,
      userId: row.user_id,
      propertyId: row.property_id,
      investmentId: row.investment_id,
      transactionType: row.transaction_type,
      amount: parseFloat(row.amount),
      currency: row.currency,
      feeAmount: parseFloat(row.fee_amount || '0'),
      netAmount: parseFloat(row.net_amount),
      status: row.status,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      blockchainTxId: row.blockchain_tx_id,
      description: row.description,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      processedAt: row.processed_at,
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