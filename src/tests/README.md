# Comprehensive Testing Suite

This directory contains a comprehensive testing suite for the GlobalLand RWA Platform. The test suite is designed to ensure high code quality, security, and performance across all components of the system.

## Test Structure

```
src/tests/
├── unit/                    # Unit tests for individual components
│   ├── services/           # Service layer tests
│   ├── controllers/        # Controller tests
│   ├── models/            # Model tests
│   └── utils/             # Utility function tests
├── integration/            # Integration tests
│   ├── api/               # API endpoint tests
│   ├── database/          # Database integration tests
│   └── external/          # External service integration tests
├── e2e/                   # End-to-end tests
│   ├── critical-flows/    # Critical user journey tests
│   └── scenarios/         # Business scenario tests
├── performance/           # Performance and load tests
├── security/              # Security and vulnerability tests
├── blockchain/            # Blockchain-specific tests
├── helpers/               # Test helper utilities
└── setup.ts              # Global test setup
```

## Test Categories

### 1. Unit Tests (`npm run test:unit`)
- **Purpose**: Test individual functions, methods, and components in isolation
- **Coverage Target**: 90%+ for services, 85%+ for controllers
- **Execution Time**: < 30 seconds
- **Examples**:
  - Service method validation
  - Business logic correctness
  - Error handling
  - Data transformation

### 2. Integration Tests (`npm run test:integration`)
- **Purpose**: Test interactions between components and external systems
- **Coverage Target**: 85%+ for critical paths
- **Execution Time**: < 2 minutes
- **Examples**:
  - API endpoint functionality
  - Database operations
  - External service integrations
  - Authentication flows

### 3. End-to-End Tests (`npm run test:e2e`)
- **Purpose**: Test complete user journeys and business workflows
- **Coverage Target**: All critical user paths
- **Execution Time**: < 5 minutes
- **Examples**:
  - Complete investment flow
  - Property management workflow
  - Trading scenarios
  - Error recovery flows

### 4. Performance Tests (`npm run test:performance`)
- **Purpose**: Validate system performance under various load conditions
- **Metrics**: Response time, throughput, resource usage
- **Execution Time**: < 10 minutes
- **Examples**:
  - Concurrent user simulation
  - Database query performance
  - Memory usage validation
  - Stress testing

### 5. Security Tests (`npm run test:security`)
- **Purpose**: Identify security vulnerabilities and ensure proper protection
- **Coverage**: Authentication, authorization, input validation, data security
- **Execution Time**: < 3 minutes
- **Examples**:
  - SQL injection prevention
  - XSS attack prevention
  - Authentication bypass attempts
  - Rate limiting validation

### 6. Blockchain Tests (`npm run test:blockchain`)
- **Purpose**: Test blockchain-specific functionality and Hedera integration
- **Coverage**: Smart contracts, token operations, transaction handling
- **Execution Time**: < 5 minutes
- **Examples**:
  - Token creation and transfer
  - Smart contract interactions
  - Transaction validation
  - Network error handling

## Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run specific test category
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
npm run test:security
npm run test:blockchain

# Run comprehensive test suite
npm run test:comprehensive

# Run all tests with coverage
npm run test:all
```

### Comprehensive Test Runner

The comprehensive test runner provides advanced testing capabilities:

```bash
# Run all tests with detailed output
npm run test:comprehensive

# Run tests in parallel for faster execution
npm run test:comprehensive -- --parallel

# Skip optional tests (performance, security)
npm run test:comprehensive -- --skip-optional

# Run with verbose output
npm run test:comprehensive -- --verbose

# Generate coverage reports
npm run test:comprehensive -- --coverage

# Check prerequisites
npm run test:comprehensive -- --check

# List available test suites
npm run test:comprehensive -- --list

# Run specific test suite
npm run test:comprehensive unit
npm run test:comprehensive integration
```

## Test Configuration

### Coverage Thresholds

| Component | Branches | Functions | Lines | Statements |
|-----------|----------|-----------|-------|------------|
| Services  | 85%      | 90%       | 90%   | 90%        |
| Controllers | 80%    | 85%       | 85%   | 85%        |
| Middleware | 75%     | 80%       | 80%   | 80%        |
| Global    | 80%      | 85%       | 85%   | 85%        |

### Performance Benchmarks

| Metric | Fast | Normal | Slow | Batch |
|--------|------|--------|------|-------|
| Response Time | <100ms | <500ms | <1000ms | <5000ms |
| Throughput | >100 RPS | >50 RPS | >10 RPS | >5 RPS |
| Memory Usage | <100MB | <500MB | <1000MB | <2000MB |

### Security Checks

- **Authentication**: Token validation, expiration, signature verification
- **Authorization**: Role-based access, resource ownership, privilege escalation
- **Input Validation**: SQL injection, XSS, NoSQL injection, command injection
- **Rate Limiting**: Brute force protection, API flooding, resource exhaustion
- **Data Security**: Sensitive data exposure, error information leakage

## Test Environment Setup

### Prerequisites

1. **Node.js** (v18+)
2. **PostgreSQL** (test database)
3. **Redis** (test instance)
4. **Hedera Testnet** credentials
5. **Environment Variables** (`.env.test`)

### Environment Variables

Create a `.env.test` file with test-specific configuration:

```env
NODE_ENV=test
PORT=3001

# Test Database
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=globalland_test
TEST_DB_USER=postgres
TEST_DB_PASSWORD=password

# Test Redis
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6379
TEST_REDIS_DB=1

# Test Hedera
TEST_HEDERA_ACCOUNT_ID=0.0.123456
TEST_HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
HEDERA_NETWORK=testnet

# Test JWT
JWT_SECRET=test-jwt-secret-key

# Test External Services
STRIPE_TEST_SECRET_KEY=sk_test_...
SENDGRID_API_KEY=SG.test...
```

### Database Setup

```sql
-- Create test database
CREATE DATABASE globalland_test;

-- Create test user (optional)
CREATE USER test_user WITH PASSWORD 'test_password';
GRANT ALL PRIVILEGES ON DATABASE globalland_test TO test_user;
```

## Writing Tests

### Unit Test Example

```typescript
import { PropertyService } from '../../../services/PropertyService'
import { PropertyModel } from '../../../models/PropertyModel'

jest.mock('../../../models/PropertyModel')

describe('PropertyService', () => {
  let service: PropertyService
  
  beforeEach(() => {
    service = new PropertyService()
    jest.clearAllMocks()
  })

  it('should create property successfully', async () => {
    const propertyData = {
      name: 'Test Property',
      propertyType: 'residential',
      totalValuation: 1000000
    }

    const mockProperty = { id: '123', ...propertyData }
    PropertyModel.create = jest.fn().mockResolvedValue(mockProperty)

    const result = await service.createProperty(propertyData)

    expect(PropertyModel.create).toHaveBeenCalledWith(propertyData)
    expect(result).toEqual(mockProperty)
  })
})
```

### Integration Test Example

```typescript
import request from 'supertest'
import { app } from '../../../app'
import { testUtils } from '../../setup'

describe('Property API', () => {
  let userToken: string

  beforeAll(async () => {
    const user = await testUtils.createTestUser()
    userToken = testUtils.generateTestToken(user.id)
  })

  it('should create property via API', async () => {
    const propertyData = {
      name: 'API Test Property',
      propertyType: 'residential',
      totalValuation: 1000000
    }

    const response = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userToken}`)
      .send(propertyData)
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(response.body.data.name).toBe(propertyData.name)
  })
})
```

### E2E Test Example

```typescript
describe('Investment Flow E2E', () => {
  it('should complete full investment journey', async () => {
    // 1. User registration
    const user = await registerUser()
    
    // 2. KYC verification
    await completeKYC(user)
    
    // 3. Browse properties
    const properties = await browseProperties()
    
    // 4. Make investment
    const investment = await makeInvestment(user, properties[0])
    
    // 5. Verify investment
    expect(investment.status).toBe('active')
  })
})
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run comprehensive tests
        run: npm run test:all
        env:
          NODE_ENV: test
          TEST_DB_HOST: localhost
          TEST_REDIS_HOST: localhost
      
      - name: Upload coverage
        uses: codecov/codecov-action@v1
```

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests independent and isolated

### Mocking Strategy
- Mock external dependencies
- Use real database for integration tests
- Mock time-dependent operations
- Avoid over-mocking

### Data Management
- Use test utilities for data creation
- Clean up test data after each test
- Use transactions for database tests
- Avoid shared test data

### Performance Considerations
- Run tests in parallel when possible
- Use appropriate timeouts
- Monitor test execution time
- Optimize slow tests

### Security Testing
- Test all authentication scenarios
- Validate authorization rules
- Check input validation
- Test rate limiting

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure test database is running
   - Check connection credentials
   - Verify database permissions

2. **Redis Connection Errors**
   - Ensure Redis is running
   - Check Redis configuration
   - Verify connection settings

3. **Timeout Errors**
   - Increase test timeout for slow operations
   - Check for hanging promises
   - Verify async/await usage

4. **Memory Leaks**
   - Close database connections
   - Clear timers and intervals
   - Properly mock external services

5. **Flaky Tests**
   - Avoid time-dependent assertions
   - Use proper async handling
   - Ensure test isolation

### Debug Commands

```bash
# Run tests with debug output
DEBUG=* npm test

# Run specific test file
npm test -- --testPathPattern=PropertyService

# Run tests in watch mode
npm run test:watch

# Generate detailed coverage report
npm run test:coverage

# Check test prerequisites
npm run test:comprehensive -- --check
```

## Reporting

### Coverage Reports
- **HTML Report**: `coverage/lcov-report/index.html`
- **JSON Report**: `coverage/coverage-final.json`
- **LCOV Report**: `coverage/lcov.info`

### Test Results
- **Console Output**: Real-time test results
- **JUnit XML**: `coverage/junit.xml`
- **HTML Report**: `coverage/html-report/test-report.html`

### Performance Metrics
- Response time percentiles
- Throughput measurements
- Memory usage tracking
- Database query performance

## Contributing

When adding new features:

1. Write unit tests for new functions
2. Add integration tests for new endpoints
3. Update E2E tests for new user flows
4. Consider security implications
5. Add performance tests for critical paths
6. Update test documentation

### Test Review Checklist

- [ ] All tests pass locally
- [ ] Coverage thresholds met
- [ ] Security tests included
- [ ] Performance impact assessed
- [ ] Documentation updated
- [ ] CI/CD pipeline passes