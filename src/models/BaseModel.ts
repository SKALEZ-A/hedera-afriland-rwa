import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

export abstract class BaseModel {
  protected static pool: Pool;
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    BaseModel.pool = getDatabase();
  }

  /**
   * Execute a query with parameters
   */
  protected async query<T extends QueryResultRow = any>(
    text: string, 
    params: any[] = []
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    
    try {
      const result = await BaseModel.pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Executed query', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
      
      return result;
    } catch (error) {
      logger.error('Database query error:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        params,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute a query within a transaction
   */
  protected async queryWithTransaction<T extends QueryResultRow = any>(
    queries: Array<{ text: string; params: any[] }>,
    callback?: (client: PoolClient) => Promise<T>
  ): Promise<T | QueryResult<T>[]> {
    const client = await BaseModel.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (callback) {
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } else {
        const results: QueryResult<T>[] = [];
        
        for (const query of queries) {
          const result = await client.query<T>(query.text, query.params);
          results.push(result);
        }
        
        await client.query('COMMIT');
        return results;
      }
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find a single record by ID
   */
  async findById<T extends QueryResultRow = any>(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await this.query<T>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find multiple records with optional conditions
   */
  async findMany<T extends QueryResultRow = any>(
    conditions: Record<string, any> = {},
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];
    let paramIndex = 1;

    // Add WHERE conditions
    if (Object.keys(conditions).length > 0) {
      const whereConditions = Object.keys(conditions).map(key => {
        params.push(conditions[key]);
        return `${key} = $${paramIndex++}`;
      });
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Add ORDER BY
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    }

    // Add LIMIT and OFFSET
    if (options.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const result = await this.query<T>(query, params);
    return result.rows;
  }

  /**
   * Create a new record
   */
  async create<T extends QueryResultRow = any>(data: Record<string, any>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`);

    const query = `
      INSERT INTO ${this.tableName} (${keys.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await this.query<T>(query, values);
    return result.rows[0];
  }

  /**
   * Update a record by ID
   */
  async updateById<T extends QueryResultRow = any>(id: string, data: Record<string, any>): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    if (keys.length === 0) {
      throw new Error('No data provided for update');
    }

    const setClause = keys.map((key, index) => `${key} = $${index + 2}`);
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.query<T>(query, [id, ...values]);
    return result.rows[0] || null;
  }

  /**
   * Delete a record by ID
   */
  async deleteById(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await this.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Count records with optional conditions
   */
  async count(conditions: Record<string, any> = {}): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: any[] = [];
    let paramIndex = 1;

    if (Object.keys(conditions).length > 0) {
      const whereConditions = Object.keys(conditions).map(key => {
        params.push(conditions[key]);
        return `${key} = $${paramIndex++}`;
      });
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    const result = await this.query<{ count: string }>(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Check if a record exists
   */
  async exists(conditions: Record<string, any>): Promise<boolean> {
    const count = await this.count(conditions);
    return count > 0;
  }

  /**
   * Execute raw SQL query
   */
  async raw<T extends QueryResultRow = any>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    return this.query<T>(query, params);
  }

  /**
   * Get table name
   */
  getTableName(): string {
    return this.tableName;
  }
}