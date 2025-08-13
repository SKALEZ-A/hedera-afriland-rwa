# GlobalLand RWA Platform - Development Guide

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Environment Setup

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start with Docker (Recommended):**
```bash
docker-compose up -d
```

4. **Or start manually:**
```bash
# Start PostgreSQL and Redis locally
npm run dev
```

### Hedera Configuration

1. **Create Hedera Testnet Account:**
   - Go to [Hedera Portal](https://portal.hedera.com/)
   - Create testnet account
   - Get Account ID and Private Key

2. **Update .env file:**
```bash
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_PRIVATE_KEY=YOUR_PRIVATE_KEY
```

### Development Commands

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── models/          # Data models
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
└── tests/           # Test files
```

### API Endpoints

- **Health Check:** `GET /health`
- **API Info:** `GET /api/v1`

### Database Schema

Database migrations and schema will be created in subsequent tasks.

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern=auth

# Run tests with coverage
npm test -- --coverage
```

### Logging

Logs are written to:
- Console (development)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

### Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Rebuild and start
docker-compose up --build
```

### Next Steps

1. Complete Task 2: Implement core data models and database schema
2. Complete Task 3: Build Hedera blockchain integration layer
3. Continue with remaining tasks in sequence

### Troubleshooting

**Database Connection Issues:**
- Ensure PostgreSQL is running
- Check connection parameters in .env
- Verify database exists

**Hedera Connection Issues:**
- Verify account ID and private key
- Check network setting (testnet/mainnet)
- Ensure account has sufficient HBAR balance

**Redis Connection Issues:**
- Ensure Redis is running
- Check Redis configuration in .env
- Verify Redis is accessible on specified port