export const coverageConfig = {
  // Coverage thresholds
  thresholds: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Specific thresholds for critical modules
    './src/services/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/controllers/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/middleware/': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,js}',
    '!src/**/*.spec.{ts,js}',
    '!src/tests/**',
    '!src/server.ts', // Entry point
    '!src/app.ts', // App setup
    '!src/config/**', // Configuration files
    '!src/types/**', // Type definitions
    '!src/migrations/**', // Database migrations
    '!src/seeds/**' // Database seeds
  ],

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Coverage path ignore patterns
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/src/tests/',
    '/src/migrations/',
    '/src/seeds/',
    '/src/config/database.ts' // Database config might have environment-specific code
  ]
}

export const testCategories = {
  unit: {
    displayName: 'Unit Tests',
    testMatch: ['**/tests/unit/**/*.test.ts'],
    collectCoverage: true,
    coverageThreshold: {
      global: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90
      }
    }
  },

  integration: {
    displayName: 'Integration Tests',
    testMatch: ['**/tests/integration/**/*.test.ts'],
    collectCoverage: true,
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
    testTimeout: 30000
  },

  e2e: {
    displayName: 'End-to-End Tests',
    testMatch: ['**/tests/e2e/**/*.test.ts'],
    collectCoverage: false, // E2E tests don't need coverage
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
    testTimeout: 60000
  },

  performance: {
    displayName: 'Performance Tests',
    testMatch: ['**/tests/performance/**/*.test.ts'],
    collectCoverage: false,
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
    testTimeout: 120000, // 2 minutes for performance tests
    maxWorkers: 1 // Run performance tests sequentially
  },

  security: {
    displayName: 'Security Tests',
    testMatch: ['**/tests/security/**/*.test.ts'],
    collectCoverage: false,
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
    testTimeout: 30000
  },

  blockchain: {
    displayName: 'Blockchain Tests',
    testMatch: ['**/tests/blockchain/**/*.test.ts'],
    collectCoverage: true,
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
    testTimeout: 45000 // Blockchain operations can be slow
  }
}

export const performanceMetrics = {
  // Response time thresholds (in milliseconds)
  responseTime: {
    fast: 100,      // Very fast endpoints
    normal: 500,    // Normal endpoints
    slow: 1000,     // Complex operations
    batch: 5000     // Batch operations
  },

  // Throughput thresholds (requests per second)
  throughput: {
    minimum: 10,    // Minimum acceptable RPS
    target: 50,     // Target RPS
    maximum: 100    // Maximum expected RPS
  },

  // Memory usage thresholds (in MB)
  memory: {
    baseline: 100,  // Baseline memory usage
    warning: 500,   // Warning threshold
    critical: 1000  // Critical threshold
  },

  // Database performance thresholds
  database: {
    connectionTime: 100,    // Max connection time (ms)
    queryTime: 500,         // Max query time (ms)
    transactionTime: 1000   // Max transaction time (ms)
  }
}

export const securityChecks = {
  // Authentication checks
  authentication: [
    'missing_token',
    'invalid_token',
    'expired_token',
    'malformed_token',
    'wrong_signature'
  ],

  // Authorization checks
  authorization: [
    'role_escalation',
    'resource_access',
    'cross_user_access',
    'admin_bypass'
  ],

  // Input validation checks
  inputValidation: [
    'sql_injection',
    'xss_attacks',
    'nosql_injection',
    'command_injection',
    'path_traversal',
    'buffer_overflow'
  ],

  // Rate limiting checks
  rateLimiting: [
    'brute_force_login',
    'api_flooding',
    'resource_exhaustion'
  ],

  // Data security checks
  dataSecurity: [
    'sensitive_data_exposure',
    'error_information_leakage',
    'debug_information',
    'stack_traces'
  ]
}

export default {
  coverageConfig,
  testCategories,
  performanceMetrics,
  securityChecks
}