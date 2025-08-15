module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/tests/**',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/server.ts',
    '!src/app.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 4,
  verbose: true,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/tests/unit/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts']
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts']
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/src/tests/e2e/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
      testTimeout: 60000
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/src/tests/performance/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
      testTimeout: 120000
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/src/tests/security/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
      testTimeout: 30000
    },
    {
      displayName: 'blockchain',
      testMatch: ['<rootDir>/src/tests/blockchain/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
      testTimeout: 45000
    },
    {
      displayName: 'api',
      testMatch: ['<rootDir>/src/tests/integration/api/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
      testTimeout: 30000
    }
  ]
};