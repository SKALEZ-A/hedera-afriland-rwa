import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { errorHandler, notFound } from './middleware/errorMiddleware';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { initializeHedera } from './config/hedera';
import { HederaHealthChecker } from './utils/hederaHealth';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const hederaHealth = await HederaHealthChecker.performHealthCheck();
    
    res.status(hederaHealth.isHealthy ? 200 : 503).json({
      status: hederaHealth.isHealthy ? 'OK' : 'UNHEALTHY',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      hedera: {
        network: hederaHealth.network,
        operatorAccount: hederaHealth.operatorAccountId,
        balance: hederaHealth.accountBalance,
        isHealthy: hederaHealth.isHealthy,
        errors: hederaHealth.errors,
        warnings: hederaHealth.warnings
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      error: 'Health check failed'
    });
  }
});

// Import routes
import authRoutes from './routes/authRoutes';
import propertyRoutes from './routes/propertyRoutes';
import investmentRoutes from './routes/investmentRoutes';

// API routes
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'GlobalLand RWA Platform API',
    version: '1.0.0',
    documentation: '/api/v1/docs'
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Property management routes
app.use('/api/properties', propertyRoutes);

// Investment routes
app.use('/api/investments', investmentRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start server
async function startServer() {
  try {
    // Initialize database connection
    await connectDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis connection
    await connectRedis();
    logger.info('Redis connected successfully');

    // Initialize Hedera client
    await initializeHedera();
    logger.info('Hedera client initialized successfully');

    // Start Hedera health monitoring
    HederaHealthChecker.startPeriodicHealthCheck(300000); // Every 5 minutes
    logger.info('Hedera health monitoring started');

    // Start the server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, io };