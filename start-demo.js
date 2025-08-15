#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting GlobalLand RWA Platform Demo...\n');

// Check if .env exists, if not copy from .env.example
if (!fs.existsSync('.env')) {
  console.log('📝 Creating .env file from .env.example...');
  fs.copyFileSync('.env.example', '.env');
}

// Update .env with demo values
const envContent = `
# Demo Configuration - GlobalLand RWA Platform
NODE_ENV=development
PORT=3000
API_VERSION=v1
BASE_URL=http://localhost:3000

# Demo Database (Mock for quick start)
DATABASE_URL=postgresql://demo:demo@localhost:5432/demo_db

# Demo JWT Secret
JWT_SECRET=demo_jwt_secret_key_for_development_only_32_chars
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=demo_refresh_secret_key_for_development_32_chars
JWT_REFRESH_EXPIRES_IN=7d

# Demo Encryption
ENCRYPTION_KEY=demo_encryption_key_for_development_only_32_chars
HMAC_SECRET=demo_hmac_secret_key_for_development_only_32_chars

# Demo Hedera (Testnet)
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=demo_private_key_for_development_only

# Demo Services (Mock)
STRIPE_SECRET_KEY=sk_test_demo_key
KYC_PROVIDER=mock
SMTP_HOST=localhost
SMTP_PORT=587

# Demo URLs
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Rate Limiting (Relaxed for demo)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
`;

fs.writeFileSync('.env', envContent);
console.log('✅ Environment configured for demo\n');

// Create logs directory
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
  console.log('📁 Created logs directory\n');
}

// Try to build the project
console.log('🔨 Building the project...');
const buildProcess = spawn('npm', ['run', 'build'], { 
  stdio: 'inherit',
  shell: true 
});

buildProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Build successful!');
    console.log('\n🚀 Starting the server...');
    
    // Start the server
    const serverProcess = spawn('npm', ['start'], { 
      stdio: 'inherit',
      shell: true 
    });
    
    serverProcess.on('close', (serverCode) => {
      console.log(`\n🛑 Server stopped with code ${serverCode}`);
    });
    
    // Show helpful information
    setTimeout(() => {
      console.log('\n' + '='.repeat(60));
      console.log('🌟 GlobalLand RWA Platform Demo is starting!');
      console.log('='.repeat(60));
      console.log('📍 API Server: http://localhost:3000');
      console.log('📍 Health Check: http://localhost:3000/health');
      console.log('📍 API Documentation: http://localhost:3000/api/docs');
      console.log('📍 Demo Endpoints: http://localhost:3000/api/demo');
      console.log('='.repeat(60));
      console.log('💡 Press Ctrl+C to stop the server');
      console.log('='.repeat(60) + '\n');
    }, 2000);
    
  } else {
    console.log(`\n❌ Build failed with code ${code}`);
    console.log('💡 Try running: npm install && npm run build');
  }
});

buildProcess.on('error', (error) => {
  console.error('❌ Build error:', error.message);
});