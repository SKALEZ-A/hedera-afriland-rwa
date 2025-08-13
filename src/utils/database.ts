import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getDatabase } from '../config/database';
import { logger } from './logger';

export class DatabaseUtils {
  private static pool: Pool;

  static initialize() {
    DatabaseUtils.pool = getDatabase();
  }

  /**
   * Run database migrations
   */
  static async runMigrations(): Promise<void> {
    try {
      logger.info('Starting database migrations...');

      // Create migrations table if it doesn't exist
      await DatabaseUtils.createMigrationsTable();

      // Read and execute schema.sql
      const schemaPath = join(process.cwd(), 'database', 'schema.sql');
      const schemaSql = readFileSync(schemaPath, 'utf8');

      // Split by semicolon and execute each statement
      const statements = schemaSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        try {
          await DatabaseUtils.pool.query(statement);
        } catch (error: any) {
          // Ignore "already exists" errors
          if (!error.message.includes('already exists')) {
            logger.error('Migration error:', error);
            throw error;
          }
        }
      }

      // Record migration
      await DatabaseUtils.recordMigration('initial_schema', 'Initial database schema');

      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Database migration failed:', error);
      throw error;
    }
  }

  /**
   * Create migrations tracking table
   */
  private static async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await DatabaseUtils.pool.query(query);
  }

  /**
   * Record a migration as executed
   */
  private static async recordMigration(name: string, description: string): Promise<void> {
    const query = `
      INSERT INTO migrations (name, description)
      VALUES ($1, $2)
      ON CONFLICT (name) DO NOTHING
    `;

    await DatabaseUtils.pool.query(query, [name, description]);
  }

  /**
   * Check if migration has been executed
   */
  static async isMigrationExecuted(name: string): Promise<boolean> {
    const query = 'SELECT COUNT(*) as count FROM migrations WHERE name = $1';
    const result = await DatabaseUtils.pool.query<{ count: string }>(query, [name]);
    return parseInt(result.rows[0].count, 10) > 0;
  }

  /**
   * Seed database with sample data
   */
  static async seedDatabase(): Promise<void> {
    try {
      logger.info('Starting database seeding...');

      // Check if already seeded
      if (await DatabaseUtils.isMigrationExecuted('seed_sample_data')) {
        logger.info('Database already seeded, skipping...');
        return;
      }

      // Create sample users
      await DatabaseUtils.createSampleUsers();

      // Create sample properties
      await DatabaseUtils.createSampleProperties();

      // Record seeding
      await DatabaseUtils.recordMigration('seed_sample_data', 'Sample data for development');

      logger.info('Database seeding completed successfully');
    } catch (error) {
      logger.error('Database seeding failed:', error);
      throw error;
    }
  }

  /**
   * Create sample users for development
   */
  private static async createSampleUsers(): Promise<void> {
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;

    const sampleUsers = [
      {
        email: 'admin@globalland.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        kycStatus: 'approved',
        verificationLevel: 'advanced',
        isAccredited: true
      },
      {
        email: 'investor@example.com',
        password: 'investor123',
        firstName: 'John',
        lastName: 'Investor',
        kycStatus: 'approved',
        verificationLevel: 'intermediate',
        nationality: 'USA'
      },
      {
        email: 'manager@example.com',
        password: 'manager123',
        firstName: 'Property',
        lastName: 'Manager',
        kycStatus: 'approved',
        verificationLevel: 'advanced',
        nationality: 'NGA'
      }
    ];

    for (const user of sampleUsers) {
      const passwordHash = await bcrypt.hash(user.password, saltRounds);
      
      const query = `
        INSERT INTO users (
          email, password_hash, first_name, last_name, 
          kyc_status, verification_level, is_accredited_investor, nationality,
          email_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (email) DO NOTHING
      `;

      await DatabaseUtils.pool.query(query, [
        user.email,
        passwordHash,
        user.firstName,
        user.lastName,
        user.kycStatus,
        user.verificationLevel,
        user.isAccredited || false,
        user.nationality || null,
        true
      ]);
    }

    logger.info('Sample users created');
  }

  /**
   * Create sample properties for development
   */
  private static async createSampleProperties(): Promise<void> {
    const sampleProperties = [
      {
        name: 'Lagos Premium Apartments',
        description: 'Luxury residential complex in Victoria Island, Lagos',
        propertyType: 'residential',
        addressLine1: '123 Ahmadu Bello Way',
        city: 'Lagos',
        country: 'NGA',
        totalValuation: 5000000,
        totalTokens: 50000,
        pricePerToken: 100,
        expectedAnnualYield: 12.5,
        propertySize: 2500,
        yearBuilt: 2020
      },
      {
        name: 'Nairobi Commercial Center',
        description: 'Modern office complex in Westlands, Nairobi',
        propertyType: 'commercial',
        addressLine1: '456 Waiyaki Way',
        city: 'Nairobi',
        country: 'KEN',
        totalValuation: 3000000,
        totalTokens: 30000,
        pricePerToken: 100,
        expectedAnnualYield: 15.0,
        propertySize: 1800,
        yearBuilt: 2019
      },
      {
        name: 'Cape Town Waterfront',
        description: 'Mixed-use development at V&A Waterfront',
        propertyType: 'mixed_use',
        addressLine1: '789 Dock Road',
        city: 'Cape Town',
        country: 'ZAF',
        totalValuation: 8000000,
        totalTokens: 80000,
        pricePerToken: 100,
        expectedAnnualYield: 10.5,
        propertySize: 4000,
        yearBuilt: 2021
      }
    ];

    for (const property of sampleProperties) {
      const query = `
        INSERT INTO properties (
          name, description, property_type, address_line1, city, country,
          total_valuation, total_tokens, available_tokens, price_per_token,
          expected_annual_yield, property_size, year_built, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;

      await DatabaseUtils.pool.query(query, [
        property.name,
        property.description,
        property.propertyType,
        property.addressLine1,
        property.city,
        property.country,
        property.totalValuation,
        property.totalTokens,
        property.totalTokens, // available_tokens = total_tokens initially
        property.pricePerToken,
        property.expectedAnnualYield,
        property.propertySize,
        property.yearBuilt,
        'active'
      ]);
    }

    logger.info('Sample properties created');
  }

  /**
   * Clean database (for testing)
   */
  static async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production environment');
    }

    const tables = [
      'audit_logs',
      'notifications',
      'user_sessions',
      'market_trades',
      'market_orders',
      'dividend_payments',
      'dividend_distributions',
      'transactions',
      'investments',
      'property_documents',
      'properties',
      'users',
      'migrations'
    ];

    for (const table of tables) {
      await DatabaseUtils.pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
    }

    logger.info('Database cleaned');
  }

  /**
   * Get database health status
   */
  static async getHealthStatus(): Promise<{
    connected: boolean;
    totalConnections: number;
    idleConnections: number;
    waitingCount: number;
  }> {
    try {
      await DatabaseUtils.pool.query('SELECT 1');
      
      return {
        connected: true,
        totalConnections: DatabaseUtils.pool.totalCount,
        idleConnections: DatabaseUtils.pool.idleCount,
        waitingCount: DatabaseUtils.pool.waitingCount
      };
    } catch (error) {
      return {
        connected: false,
        totalConnections: 0,
        idleConnections: 0,
        waitingCount: 0
      };
    }
  }
}