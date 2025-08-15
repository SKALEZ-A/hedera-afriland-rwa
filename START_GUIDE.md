# 🚀 GlobalLand RWA Platform - Startup Guide

## Quick Demo Start (Recommended)

The fastest way to preview the GlobalLand RWA Platform workflow:

### 1. **Start the Demo Server**
```bash
node demo-server.js
```

This will start a fully functional demo server at `http://localhost:3000` with:
- ✅ **Sample African Properties** (Lagos, Nairobi, Cape Town)
- ✅ **Mock Investment Data** 
- ✅ **Platform Statistics**
- ✅ **API Documentation**

### 2. **Test the API Endpoints**

**Health Check:**
```bash
curl http://localhost:3000/health
```

**View All Properties:**
```bash
curl http://localhost:3000/api/demo/properties
```

**Get Platform Statistics:**
```bash
curl http://localhost:3000/api/demo/stats
```

**Simulate Investment:**
```bash
curl -X POST http://localhost:3000/api/demo/invest \
  -H "Content-Type: application/json" \
  -d '{"propertyId": "1", "amount": 5000}'
```

**API Documentation:**
```bash
curl http://localhost:3000/api/docs
```

### 3. **Available Demo Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health status |
| `/api` | GET | API overview and endpoints |
| `/api/demo` | GET | Demo data overview |
| `/api/demo/properties` | GET | All available properties |
| `/api/demo/properties/:id` | GET | Specific property details |
| `/api/demo/users` | GET | Demo user accounts |
| `/api/demo/investments` | GET | Sample investments |
| `/api/demo/stats` | GET | Platform statistics |
| `/api/demo/invest` | POST | Simulate property investment |
| `/api/docs` | GET | Complete API documentation |

## Full Development Setup

For complete development with all features:

### 1. **Install Dependencies**
```bash
npm install
```

### 2. **Set up Environment Variables**
```bash
cp .env.example .env
# Edit .env with your actual values
```

### 3. **Required Environment Variables**

**Essential Variables:**
```bash
# Security (Required)
JWT_SECRET=your_super_secure_jwt_secret_key_minimum_32_characters_long
ENCRYPTION_KEY=your_super_secure_encryption_key_minimum_32_characters_long
HMAC_SECRET=your_hmac_secret_key_for_signatures_minimum_32_chars

# Database (Required)
DATABASE_URL=postgresql://username:password@localhost:5432/globalland_db

# Hedera Blockchain (Required)
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=your_hedera_private_key_here
```

**Optional for Full Features:**
```bash
# Payment Processing
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-your_flutterwave_key

# KYC/Compliance
JUMIO_API_TOKEN=your_jumio_api_token
ONFIDO_API_TOKEN=your_onfido_api_token

# AWS (for production backups)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_BACKUP_BUCKET=globalland-backups

# Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### 4. **Database Setup**
```bash
# Install PostgreSQL
brew install postgresql

# Start PostgreSQL
brew services start postgresql

# Create database
createdb globalland_dev

# Run migrations (when available)
npm run migrate
```

### 5. **Start Development Server**
```bash
npm run dev
```

## Docker Setup (Production)

### 1. **Start with Docker Compose**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 2. **View Logs**
```bash
docker-compose -f docker-compose.prod.yml logs -f app
```

### 3. **Stop Services**
```bash
docker-compose -f docker-compose.prod.yml down
```

## 🌟 Demo Features Showcase

### **1. Property Tokenization**
- **Lagos Premium Apartments**: $5M luxury residential complex
- **Nairobi Commercial Center**: $3M modern office complex  
- **Cape Town Waterfront**: $8M mixed-use development

### **2. Investment Simulation**
- Minimum investment: $100 (1 token)
- Fractional ownership from $100 to $1M+
- Expected yields: 10.5% - 15% annually

### **3. Platform Statistics**
- **Total Portfolio Value**: $16M across 3 African markets
- **Available Tokens**: 90,000 tokens ($9M investment opportunity)
- **Average ROI**: 12.67% annually
- **Monthly Dividends**: $1.25M distributed to investors

### **4. Key Differentiators**
- ⚡ **Sub-3 second transactions** on Hedera
- 💰 **$0.0001 transaction fees** 
- 🌍 **African market focus** with local payment methods
- 📱 **Mobile-first** experience for emerging markets
- 🔒 **Enterprise-grade security** and compliance

## 🎯 Workflow Preview

### **Investor Journey:**
1. **Browse Properties** → `GET /api/demo/properties`
2. **View Details** → `GET /api/demo/properties/1`
3. **Simulate Investment** → `POST /api/demo/invest`
4. **Check Portfolio** → `GET /api/demo/investments`
5. **View Returns** → `GET /api/demo/stats`

### **Property Manager Journey:**
1. **List Properties** → `GET /api/demo/properties`
2. **Update Property** → Property management endpoints
3. **Record Income** → Rental income tracking
4. **Distribute Dividends** → Automated distribution

### **Platform Analytics:**
1. **Market Overview** → `GET /api/demo/stats`
2. **Performance Metrics** → ROI and yield tracking
3. **User Activity** → Investment patterns
4. **Compliance Reports** → Regulatory reporting

## 🔧 Troubleshooting

### **Common Issues:**

**Port Already in Use:**
```bash
lsof -ti:3000 | xargs kill -9
```

**Missing Dependencies:**
```bash
npm install
```

**TypeScript Errors:**
```bash
# Use demo server instead
node demo-server.js
```

**Database Connection:**
```bash
# Check PostgreSQL status
brew services list | grep postgresql
```

## 📞 Support

For issues or questions:
- 📧 Email: support@globalland.app
- 📚 Documentation: `/api/docs`
- 🐛 Issues: Check console logs

---

**🎉 You're ready to showcase the GlobalLand RWA Platform!**

The demo server provides a complete preview of the real estate tokenization workflow with African market focus, Hedera blockchain integration, and comprehensive investment features.