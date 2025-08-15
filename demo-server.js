const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Demo data
const demoProperties = [
  {
    id: '1',
    name: 'Lagos Premium Apartments',
    description: 'Luxury residential complex in Victoria Island, Lagos',
    location: {
      country: 'Nigeria',
      city: 'Lagos',
      address: 'Victoria Island, Lagos'
    },
    totalValuation: 5000000,
    totalTokens: 50000,
    pricePerToken: 100,
    availableTokens: 30000,
    propertyType: 'residential',
    expectedYield: 12.5,
    images: ['/images/lagos-apartments.jpg'],
    status: 'active'
  },
  {
    id: '2',
    name: 'Nairobi Commercial Center',
    description: 'Modern office complex in Westlands, Nairobi',
    location: {
      country: 'Kenya',
      city: 'Nairobi',
      address: 'Westlands, Nairobi'
    },
    totalValuation: 3000000,
    totalTokens: 30000,
    pricePerToken: 100,
    availableTokens: 15000,
    propertyType: 'commercial',
    expectedYield: 15.0,
    images: ['/images/nairobi-center.jpg'],
    status: 'active'
  },
  {
    id: '3',
    name: 'Cape Town Waterfront',
    description: 'Mixed-use development at V&A Waterfront',
    location: {
      country: 'South Africa',
      city: 'Cape Town',
      address: 'V&A Waterfront, Cape Town'
    },
    totalValuation: 8000000,
    totalTokens: 80000,
    pricePerToken: 100,
    availableTokens: 45000,
    propertyType: 'mixed_use',
    expectedYield: 10.5,
    images: ['/images/cape-town-waterfront.jpg'],
    status: 'active'
  }
];

const demoUsers = [
  {
    id: '1',
    email: 'demo@globalland.app',
    firstName: 'Demo',
    lastName: 'User',
    kycStatus: 'verified',
    portfolio: {
      totalInvestment: 50000,
      totalTokens: 500,
      properties: 2,
      monthlyDividends: 520.83
    }
  }
];

const demoInvestments = [
  {
    id: '1',
    userId: '1',
    propertyId: '1',
    tokenAmount: 300,
    purchasePrice: 30000,
    currentValue: 32500,
    dividendsReceived: 3250,
    purchaseDate: '2024-01-15'
  },
  {
    id: '2',
    userId: '1',
    propertyId: '2',
    tokenAmount: 200,
    purchasePrice: 20000,
    currentValue: 21800,
    dividendsReceived: 2500,
    purchaseDate: '2024-02-20'
  }
];

// Routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to GlobalLand RWA Platform API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      properties: '/api/properties',
      demo: '/api/demo',
      docs: '/api/docs'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: 'demo'
    }
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'GlobalLand API',
      version: '1.0.0',
      description: 'Real Estate Tokenization Platform API',
      documentation: '/api/docs',
      demo: '/api/demo',
      endpoints: {
        properties: '/api/properties',
        investments: '/api/investments',
        users: '/api/users',
        demo: '/api/demo'
      }
    }
  });
});

// Demo endpoints
app.get('/api/demo', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'GlobalLand Demo Data',
      totalProperties: demoProperties.length,
      totalUsers: demoUsers.length,
      totalInvestments: demoInvestments.length,
      endpoints: {
        properties: '/api/demo/properties',
        users: '/api/demo/users',
        investments: '/api/demo/investments',
        stats: '/api/demo/stats'
      }
    }
  });
});

app.get('/api/demo/properties', (req, res) => {
  res.json({
    success: true,
    data: demoProperties,
    meta: {
      total: demoProperties.length,
      page: 1,
      limit: 10
    }
  });
});

app.get('/api/demo/properties/:id', (req, res) => {
  const property = demoProperties.find(p => p.id === req.params.id);
  if (!property) {
    return res.status(404).json({
      success: false,
      error: 'Property not found'
    });
  }
  res.json({
    success: true,
    data: property
  });
});

app.get('/api/demo/users', (req, res) => {
  res.json({
    success: true,
    data: demoUsers,
    meta: {
      total: demoUsers.length
    }
  });
});

app.get('/api/demo/investments', (req, res) => {
  res.json({
    success: true,
    data: demoInvestments,
    meta: {
      total: demoInvestments.length
    }
  });
});

app.get('/api/demo/stats', (req, res) => {
  const totalValuation = demoProperties.reduce((sum, p) => sum + p.totalValuation, 0);
  const totalTokens = demoProperties.reduce((sum, p) => sum + p.totalTokens, 0);
  const availableTokens = demoProperties.reduce((sum, p) => sum + p.availableTokens, 0);
  
  res.json({
    success: true,
    data: {
      platform: {
        totalProperties: demoProperties.length,
        totalValuation,
        totalTokens,
        availableTokens,
        tokensSold: totalTokens - availableTokens,
        averageYield: 12.67
      },
      markets: {
        nigeria: { properties: 1, valuation: 5000000 },
        kenya: { properties: 1, valuation: 3000000 },
        southAfrica: { properties: 1, valuation: 8000000 }
      },
      performance: {
        monthlyDividends: 1250000,
        averageROI: 12.67,
        occupancyRate: 95.5
      }
    }
  });
});

// Investment simulation endpoints
app.post('/api/demo/invest', (req, res) => {
  const { propertyId, amount } = req.body;
  const property = demoProperties.find(p => p.id === propertyId);
  
  if (!property) {
    return res.status(404).json({
      success: false,
      error: 'Property not found'
    });
  }
  
  const tokens = Math.floor(amount / property.pricePerToken);
  
  res.json({
    success: true,
    data: {
      investmentId: `inv_${Date.now()}`,
      propertyId,
      propertyName: property.name,
      amount,
      tokens,
      pricePerToken: property.pricePerToken,
      expectedAnnualDividend: (amount * property.expectedYield / 100),
      status: 'confirmed',
      timestamp: new Date().toISOString()
    }
  });
});

// Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'GlobalLand RWA Platform API Documentation',
      version: '1.0.0',
      description: 'Real Estate Tokenization Platform built on Hedera Hashgraph',
      baseUrl: `http://localhost:${PORT}`,
      endpoints: [
        {
          method: 'GET',
          path: '/health',
          description: 'Health check endpoint'
        },
        {
          method: 'GET',
          path: '/api/demo/properties',
          description: 'Get all demo properties'
        },
        {
          method: 'GET',
          path: '/api/demo/properties/:id',
          description: 'Get specific property by ID'
        },
        {
          method: 'GET',
          path: '/api/demo/stats',
          description: 'Get platform statistics'
        },
        {
          method: 'POST',
          path: '/api/demo/invest',
          description: 'Simulate property investment',
          body: {
            propertyId: 'string',
            amount: 'number'
          }
        }
      ],
      features: [
        'Property tokenization on Hedera Hashgraph',
        'Fractional real estate investment',
        'Multi-currency payment support',
        'Automated dividend distribution',
        'KYC/AML compliance',
        'Secondary market trading',
        'Mobile-first experience'
      ]
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api',
      'GET /api/demo',
      'GET /api/demo/properties',
      'GET /api/demo/stats',
      'GET /api/docs'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🌟 GlobalLand RWA Platform Demo Server');
  console.log('='.repeat(60));
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log(`📍 Health Check: http://localhost:${PORT}/health`);
  console.log(`📍 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`📍 Demo Properties: http://localhost:${PORT}/api/demo/properties`);
  console.log(`📍 Platform Stats: http://localhost:${PORT}/api/demo/stats`);
  console.log('='.repeat(60));
  console.log('🚀 Ready to showcase the GlobalLand RWA Platform!');
  console.log('💡 Press Ctrl+C to stop the server');
  console.log('='.repeat(60) + '\n');
});