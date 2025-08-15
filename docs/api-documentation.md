# GlobalLand API Documentation

## Overview

The GlobalLand API provides comprehensive endpoints for real estate tokenization, investment management, and trading on the Hedera blockchain. This RESTful API enables developers to build applications that interact with tokenized real estate assets.

**Base URL:** `https://api.globalland.com/api`  
**Version:** 1.0.0  
**Authentication:** Bearer Token (JWT)

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Get Authentication Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh-token-here",
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "kycStatus": "APPROVED"
    }
  }
}
```

## Error Handling

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "details": {
    // Additional error details (optional)
  }
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

- **General API:** 100 requests per 15 minutes per IP
- **Authentication:** 10 requests per 15 minutes per IP

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

## Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890"
}
```

#### Login
```http
POST /api/auth/login
```

#### Refresh Token
```http
POST /api/auth/refresh
```

#### Logout
```http
POST /api/auth/logout
```

### Properties

#### Get All Properties
```http
GET /api/properties
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `location` (string): Filter by location
- `minPrice` (number): Minimum price filter
- `maxPrice` (number): Maximum price filter
- `propertyType` (string): Property type filter

**Response:**
```json
{
  "success": true,
  "data": {
    "properties": [
      {
        "id": "prop123",
        "tokenId": "token123",
        "name": "Lagos Luxury Apartments",
        "description": "Premium residential complex in Victoria Island",
        "location": {
          "city": "Lagos",
          "country": "Nigeria",
          "address": "123 Victoria Island"
        },
        "valuation": 5000000,
        "totalTokens": 50000,
        "availableTokens": 25000,
        "pricePerToken": 100,
        "expectedYield": 0.12,
        "propertyType": "RESIDENTIAL",
        "images": ["image1.jpg", "image2.jpg"],
        "status": "ACTIVE"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

#### Get Property Details
```http
GET /api/properties/:id
```

#### Create Property (Property Manager)
```http
POST /api/properties
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Nairobi Office Complex",
  "description": "Modern office building in Westlands",
  "location": {
    "city": "Nairobi",
    "country": "Kenya",
    "address": "456 Westlands Road"
  },
  "valuation": 3000000,
  "totalTokens": 30000,
  "pricePerToken": 100,
  "expectedYield": 0.10,
  "propertyType": "COMMERCIAL"
}
```

### Investments

#### Get User Portfolio
```http
GET /api/investments/portfolio
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalValue": 15000,
    "totalInvested": 12000,
    "totalReturns": 3000,
    "totalDividends": 1500,
    "investments": [
      {
        "id": "inv123",
        "propertyId": "prop123",
        "propertyName": "Lagos Luxury Apartments",
        "tokenAmount": 100,
        "investmentValue": 10000,
        "currentValue": 11500,
        "totalDividends": 800,
        "purchaseDate": "2024-01-15T10:00:00Z",
        "performance": {
          "totalReturn": 1500,
          "totalReturnPercent": 15.0,
          "annualizedReturn": 18.5
        }
      }
    ]
  }
}
```

#### Purchase Investment
```http
POST /api/investments/purchase
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "propertyId": "prop123",
  "tokenAmount": 50,
  "paymentMethod": "STRIPE",
  "paymentMethodId": "pm_1234567890"
}
```

#### Get Investment History
```http
GET /api/investments/history
Authorization: Bearer <token>
```

### Payments

#### Process Payment
```http
POST /api/payments/process
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "amount": 5000,
  "currency": "USD",
  "paymentMethod": "STRIPE",
  "paymentMethodId": "pm_1234567890",
  "propertyId": "prop123",
  "tokenAmount": 50
}
```

#### Get Exchange Rates
```http
GET /api/payments/rates
```

**Response:**
```json
{
  "success": true,
  "data": {
    "USD": 1.0,
    "EUR": 0.85,
    "KES": 150.0,
    "NGN": 800.0,
    "HBAR": 0.05,
    "lastUpdated": "2024-01-15T10:00:00Z"
  }
}
```

#### Initiate Mobile Payment
```http
POST /api/payments/mobile/initiate
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "amount": 10000,
  "currency": "KES",
  "phoneNumber": "+254700000000",
  "provider": "M_PESA",
  "propertyId": "prop123",
  "tokenAmount": 100
}
```

### Dividends

#### Get Distribution History
```http
GET /api/dividends/:tokenId/history
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tokenId": "token123",
    "history": [
      {
        "distributionDate": "2024-01-01T00:00:00Z",
        "totalAmount": 50000,
        "recipientCount": 500,
        "averageAmount": 100,
        "status": "COMPLETED"
      }
    ]
  }
}
```

#### Calculate Projected Dividends
```http
POST /api/dividends/:tokenId/projected
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "tokenAmount": 100,
  "projectionMonths": 12
}
```

#### Claim Pending Dividends
```http
POST /api/dividends/:tokenId/claim
Authorization: Bearer <token>
```

### Trading

#### Create Order
```http
POST /api/trading/orders
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "tokenId": "token123",
  "orderType": "BUY",
  "amount": 50,
  "price": 105.50,
  "expiresAt": "2024-01-30T23:59:59Z"
}
```

#### Get Order Book
```http
GET /api/trading/orderbook/:tokenId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tokenId": "token123",
    "buyOrders": [
      {
        "id": "order123",
        "userId": "user456",
        "price": 105.00,
        "remainingAmount": 100,
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ],
    "sellOrders": [
      {
        "id": "order124",
        "userId": "user789",
        "price": 106.00,
        "remainingAmount": 75,
        "createdAt": "2024-01-15T11:00:00Z"
      }
    ],
    "spread": 1.00,
    "lastTradePrice": 105.25
  }
}
```

#### Get Market Stats
```http
GET /api/trading/stats/:tokenId
```

#### Get Trading History
```http
GET /api/trading/history/:tokenId
```

#### Cancel Order
```http
DELETE /api/trading/orders/:orderId
Authorization: Bearer <token>
```

### Notifications

#### Get Notification History
```http
GET /api/notifications/history
Authorization: Bearer <token>
```

#### Update Notification Preferences
```http
PUT /api/notifications/preferences
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "email": true,
  "sms": false,
  "push": true,
  "realTime": true
}
```

#### Send Test Notification
```http
POST /api/notifications/test
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "templateId": "investment_confirmation",
  "testData": {
    "propertyName": "Test Property",
    "investmentAmount": "1000.00"
  }
}
```

## WebSocket API

### Real-time Notifications

Connect to WebSocket for real-time updates:

```javascript
const ws = new WebSocket('wss://api.globalland.com/ws?userId=your-user-id');

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('Received notification:', notification);
};
```

**Message Format:**
```json
{
  "type": "dividend_payment",
  "data": {
    "propertyName": "Lagos Luxury Apartments",
    "dividendAmount": "125.50",
    "transactionId": "tx_123456"
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## SDK Examples

### JavaScript/Node.js

```javascript
const GlobalLandAPI = require('@globalland/api-client');

const client = new GlobalLandAPI({
  baseURL: 'https://api.globalland.com/api',
  apiKey: 'your-api-key'
});

// Get properties
const properties = await client.properties.getAll({
  location: 'Lagos',
  minPrice: 50,
  maxPrice: 200
});

// Purchase investment
const investment = await client.investments.purchase({
  propertyId: 'prop123',
  tokenAmount: 100,
  paymentMethod: 'STRIPE'
});
```

### Python

```python
from globalland import GlobalLandClient

client = GlobalLandClient(
    base_url='https://api.globalland.com/api',
    api_key='your-api-key'
)

# Get portfolio
portfolio = client.investments.get_portfolio()

# Create buy order
order = client.trading.create_order(
    token_id='token123',
    order_type='BUY',
    amount=50,
    price=105.50
)
```

## Webhooks

### Payment Webhooks

Configure webhook endpoints to receive payment status updates:

```http
POST /your-webhook-endpoint
Content-Type: application/json
X-GlobalLand-Signature: sha256=signature

{
  "event": "payment.completed",
  "data": {
    "paymentId": "pay_123456",
    "userId": "user123",
    "amount": 5000,
    "currency": "USD",
    "status": "COMPLETED",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

### Dividend Webhooks

```http
POST /your-webhook-endpoint
Content-Type: application/json

{
  "event": "dividend.distributed",
  "data": {
    "tokenId": "token123",
    "totalAmount": 50000,
    "recipientCount": 500,
    "distributionDate": "2024-01-15T10:00:00Z"
  }
}
```

## Testing

### Sandbox Environment

Use the sandbox environment for testing:

**Base URL:** `https://sandbox-api.globalland.com/api`

### Test Data

The sandbox includes test properties and users:

- **Test Property:** Lagos Test Apartments (token123)
- **Test User:** test@globalland.com / password123
- **Test Payment Methods:** Use Stripe test cards

### Postman Collection

Import our Postman collection for easy API testing:
[Download Collection](https://api.globalland.com/postman/collection.json)

## Support

- **Documentation:** https://docs.globalland.com
- **Support Email:** support@globalland.com
- **Developer Discord:** https://discord.gg/globalland
- **Status Page:** https://status.globalland.com

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Property tokenization endpoints
- Investment management
- Trading system
- Payment processing
- Notification system