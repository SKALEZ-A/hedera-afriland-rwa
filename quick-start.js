#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 GlobalLand RWA Platform - Quick Start Demo\n');

// Create minimal .env for demo
const envContent = `NODE_ENV=development
PORT=3000
API_VERSION=v1
BASE_URL=http://localhost:3000
DATABASE_URL=demo://localhost/demo
JWT_SECRET=demo_jwt_secret_key_for_development_only_32_chars_long
ENCRYPTION_KEY=demo_encryption_key_for_development_only_32_chars
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=demo_private_key
LOG_LEVEL=info
RATE_LIMIT_MAX_REQUESTS=1000
`;

fs.writeFileSync('.env', envContent);
console.log('✅ Demo environment configured\n');

// Create logs directory
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

console.log('🚀 Starting server with ts-node (bypassing build)...\n');

// Start with ts-node to bypass TypeScript compilation issues
const serverProcess = spawn('npx', ['ts-node', '--transpile-only', 'src/server.ts'], { 
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'development' }
});

serverProcess.on('close', (code) => {
  console.log(`\n🛑 Server stopped with code ${code}`);
});

serverProcess.on('error', (error) => {
  console.error('❌ Server error:', error.message);
  console.log('\n💡 Trying alternative approach...');
  
  // Fallback: try with node directly
  const fallbackProcess = spawn('node', ['-r', 'ts-node/register', 'src/server.ts'], { 
    stdio: 'inherit',
    shell: true 
  });
  
  fallbackProcess.on('error', (fallbackError) => {
    console.error('❌ Fallback also failed:', fallbackError.message);
    console.log('\n💡 Please install ts-node: npm install -g ts-node');
  });
});

// Show helpful information after a delay
setTimeout(() => {
  console.log('\n' + '='.repeat(60));
  console.log('🌟 GlobalLand RWA Platform Demo');
  console.log('='.repeat(60));
  console.log('📍 API Server: http://localhost:3000');
  console.log('📍 Health Check: http://localhost:3000/health');
  console.log('📍 API Docs: http://localhost:3000/api');
  console.log('📍 Demo Data: http://localhost:3000/api/demo');
  console.log('='.repeat(60));
  console.log('💡 Press Ctrl+C to stop the server');
  console.log('='.repeat(60) + '\n');
}, 3000);