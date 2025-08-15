# GlobalLand RWA Platform - Deployment Guide

## Vercel Deployment

This project is configured for deployment on Vercel with the following setup:

### Configuration Files

- `vercel.json` - Vercel deployment configuration
- `api/` - Serverless functions directory
- `tsconfig.json` - TypeScript configuration

### Build Process

1. **Build Command**: `npm run build`
   - Compiles TypeScript to JavaScript
   - Copies API files to dist directory

2. **API Endpoints**:
   - `/api` - Main API endpoint
   - `/api/health` - Health check endpoint
   - `/api/docs` - API documentation

### Environment Variables

Required environment variables for production:

```
NODE_ENV=production
PORT=3001
DATABASE_URL=your_database_url
REDIS_URL=your_redis_url
HEDERA_ACCOUNT_ID=your_hedera_account_id
HEDERA_PRIVATE_KEY=your_hedera_private_key
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key
```

### Deployment Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build Project**:
   ```bash
   npm run build
   ```

3. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

### Features Included

- ✅ TypeScript compilation
- ✅ Serverless API functions
- ✅ Health monitoring
- ✅ Security middleware
- ✅ Error handling
- ✅ Environment configuration

### Post-Deployment

After deployment, verify:

1. Health endpoint: `https://your-domain.vercel.app/api/health`
2. API documentation: `https://your-domain.vercel.app/api/docs`
3. Main API: `https://your-domain.vercel.app/api`

### Troubleshooting

- Check Vercel function logs for runtime errors
- Verify environment variables are set correctly
- Ensure all dependencies are listed in package.json