import express from 'express';
import { errorHandler } from './middleware/errorMiddleware';
import { responseFormatter } from './middleware/responseFormatter';
import { logger } from './utils/logger';
import { 
  requestLoggingMiddleware, 
  errorMonitoringMiddleware,
  securityMonitoringMiddleware,
  complianceMonitoringMiddleware 
} from './middleware/monitoringMiddleware';
import { 
  securityHeaders, 
  corsConfig, 
  generalRateLimit,
  authRateLimit,
  speedLimiter,
  sanitizeInput,
  requestId,
  auditLogger,
  ddosProtection
} from './middleware/securityMiddleware';
import { AuditService } from './services/AuditService';
import { BackupService } from './services/BackupService';
import { SecurityTestingService } from './services/SecurityTestingService';
import { Pool } from 'pg';

// Import routes
import authRoutes from './routes/authRoutes';
import propertyRoutes from './routes/propertyRoutes';
import investmentRoutes from './routes/investmentRoutes';
import paymentRoutes from './routes/paymentRoutes';
import dividendRoutes from './routes/dividendRoutes';
import tradingRoutes from './routes/tradingRoutes';
import notificationRoutes from './routes/notificationRoutes';
import propertyManagerRoutes from './routes/propertyManagerRoutes';
import docsRoutes from './routes/docsRoutes';
import monitoringRoutes from './routes/monitoringRoutes';
import demoRoutes from './routes/demoRoutes';

const app = express();

// Initialize database pool
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize security services
try {
  AuditService.initialize(dbPool);
  BackupService.initialize(dbPool, {
    schedule: '0 2 * * *', // Daily at 2 AM
    retentionDays: 30,
    encryptBackups: true,
    uploadToCloud: process.env.NODE_ENV === 'production',
    cloudProvider: 'aws',
    notifyOnFailure: true
  });
  SecurityTestingService.initialize(dbPool, process.env.BASE_URL || 'http://localhost:3000');
  logger.info('Security services initialized successfully');
} catch (error) {
  logger.error('Failed to initialize security services', error);
}

// Security middleware (order matters!)
app.use(requestId); // Add request ID first
app.use(securityHeaders); // Security headers
app.use(corsConfig); // CORS configuration
app.use(ddosProtection); // DDoS protection
app.use(generalRateLimit); // General rate limiting
app.use(speedLimiter); // Speed limiting
app.use(auditLogger); // Audit logging

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for signature verification if needed
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Response formatter middleware
app.use(responseFormatter);

// Enhanced monitoring middleware
app.use(requestLoggingMiddleware);
app.use(securityMonitoringMiddleware);
app.use(complianceMonitoringMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'GlobalLand API',
      version: '1.0.0',
      description: 'Real Estate Tokenization Platform API',
      documentation: '/api/docs',
      endpoints: {
        auth: '/api/auth',
        properties: '/api/properties',
        investments: '/api/investments',
        payments: '/api/payments',
        dividends: '/api/dividends',
        trading: '/api/trading',
        notifications: '/api/notifications'
      }
    }
  });
});

// API Routes with appropriate rate limiting
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dividends', dividendRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/property-manager', propertyManagerRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/docs', docsRoutes);

// Security test endpoint (admin only)
app.get('/api/admin/security-test', async (req, res) => {
  try {
    // This would typically require admin authentication
    const report = await SecurityTestingService.generateSecurityReport();
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Security test failed', error);
    res.status(500).json({ 
      success: false,
      error: 'Security test failed' 
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Enhanced error monitoring and handling
app.use(errorMonitoringMiddleware);
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Perform final backup
  try {
    await BackupService.performIncrementalBackup();
    logger.info('Final backup completed');
  } catch (error) {
    logger.error('Final backup failed', error);
  }
  
  // Close database connections
  await dbPool.end();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Perform final backup
  try {
    await BackupService.performIncrementalBackup();
    logger.info('Final backup completed');
  } catch (error) {
    logger.error('Final backup failed', error);
  }
  
  // Close database connections
  await dbPool.end();
  
  process.exit(0);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  process.exit(1);
});

export default app;