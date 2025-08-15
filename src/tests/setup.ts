import { config } from 'dotenv';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Load test environment variables
config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Setup test database
  await setupTestDatabase();
  
  // Setup test Redis
  await setupTestRedis();
  
  // Setup test blockchain connection
  await setupTestBlockchain();
});

afterAll(async () => {
  // Cleanup test database
  await cleanupTestDatabase();
  
  // Cleanup test Redis
  await cleanupTestRedis();
  
  // Close all connections
  await closeConnections();
});

// Database setup
let testDb: Pool;

async function setupTestDatabase() {
  testDb = new Pool({
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432'),
    database: process.env.TEST_DB_NAME || 'globalland_test',
    user: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'password',
  });

  // Create test database schema
  await testDb.query(`
    CREATE SCHEMA IF NOT EXISTS test;
    SET search_path TO test;
  `);

  // Run migrations for test database
  // This would typically use your migration system
  console.log('Test database setup complete');
}

async function cleanupTestDatabase() {
  if (testDb) {
    await testDb.query('DROP SCHEMA IF EXISTS test CASCADE');
    await testDb.end();
  }
}

// Redis setup
let testRedis: Redis;

async function setupTestRedis() {
  testRedis = new Redis({
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
    db: parseInt(process.env.TEST_REDIS_DB || '1'), // Use different DB for tests
  });

  // Clear test Redis database
  await testRedis.flushdb();
  console.log('Test Redis setup complete');
}

async function cleanupTestRedis() {
  if (testRedis) {
    await testRedis.flushdb();
    await testRedis.disconnect();
  }
}

// Blockchain setup
async function setupTestBlockchain() {
  // Setup test Hedera network connection
  process.env.HEDERA_NETWORK = 'testnet';
  process.env.HEDERA_ACCOUNT_ID = process.env.TEST_HEDERA_ACCOUNT_ID;
  process.env.HEDERA_PRIVATE_KEY = process.env.TEST_HEDERA_PRIVATE_KEY;
  
  console.log('Test blockchain setup complete');
}

async function closeConnections() {
  // Close any remaining connections
  console.log('Test cleanup complete');
}

// Test utilities
export const testUtils = {
  db: () => testDb,
  redis: () => testRedis,
  
  // Create test user
  createTestUser: async (overrides = {}) => {
    const defaultUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      kycStatus: 'approved',
      ...overrides,
    };

    const result = await testDb.query(
      `INSERT INTO users (email, password, first_name, last_name, kyc_status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [defaultUser.email, defaultUser.password, defaultUser.firstName, defaultUser.lastName, defaultUser.kycStatus]
    );

    return result.rows[0];
  },

  // Create test property
  createTestProperty: async (overrides = {}) => {
    const defaultProperty = {
      name: `Test Property ${Date.now()}`,
      propertyType: 'residential',
      totalValuation: 1000000,
      totalTokens: 10000,
      pricePerToken: 100,
      status: 'active',
      ...overrides,
    };

    const result = await testDb.query(
      `INSERT INTO properties (name, property_type, total_valuation, total_tokens, price_per_token, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        defaultProperty.name,
        defaultProperty.propertyType,
        defaultProperty.totalValuation,
        defaultProperty.totalTokens,
        defaultProperty.pricePerToken,
        defaultProperty.status,
      ]
    );

    return result.rows[0];
  },

  // Create test investment
  createTestInvestment: async (userId: string, propertyId: string, overrides = {}) => {
    const defaultInvestment = {
      tokenAmount: 100,
      purchasePrice: 10000,
      status: 'active',
      ...overrides,
    };

    const result = await testDb.query(
      `INSERT INTO investments (user_id, property_id, token_amount, purchase_price, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [userId, propertyId, defaultInvestment.tokenAmount, defaultInvestment.purchasePrice, defaultInvestment.status]
    );

    return result.rows[0];
  },

  // Clean test data
  cleanTestData: async () => {
    await testDb.query('TRUNCATE TABLE investments, properties, users CASCADE');
    await testRedis.flushdb();
  },

  // Generate test JWT token
  generateTestToken: (userId: string) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  },
};