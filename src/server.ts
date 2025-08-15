import app from './app';
import { logger } from './utils/logger';
// Database connection handled in app.ts
import { connectRedis } from './config/redis';
import { initializeAllMonitoring } from './utils/monitoringSetup';
import { HederaService } from './services/HederaService';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { NotificationService } from './services/NotificationService';

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    // Initialize monitoring first
    logger.info('Initializing monitoring services...');
    await initializeAllMonitoring();
    logger.info('Monitoring services initialized successfully');

    // Database connection initialized
    logger.info('Database connection ready');

    // Initialize Redis connection
    logger.info('Connecting to Redis...');
    await connectRedis();
    logger.info('Redis connected successfully');

    // Initialize Hedera service
    logger.info('Initializing Hedera service...');
    const hederaService = new HederaService();
    await hederaService.initialize();
    logger.info('Hedera service initialized successfully');

    // Create HTTP server
    const server = createServer(app);

    // Initialize WebSocket server for real-time notifications
    const wss = new WebSocketServer({ server, path: '/ws' });
    const notificationService = new NotificationService();

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const userId = url.searchParams.get('userId');

      if (userId) {
        notificationService.registerWebSocketClient(userId, ws);
        logger.info('WebSocket client connected', { userId });

        ws.send(JSON.stringify({
          type: 'connection_established',
          data: {
            message: 'Connected to GlobalLand real-time notifications',
            timestamp: new Date().toISOString()
          }
        }));
      } else {
        ws.close(1008, 'User ID required');
      }

      ws.on('error', (error) => {
        logger.error('WebSocket error', { error, userId });
      });
    });

    // Start server
    server.listen(parseInt(PORT as string), () => {
      logger.info('Server started successfully', {
        port: PORT,
        host: HOST,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      });

      // Log available endpoints
      logger.info('Available API endpoints:', {
        health: `http://${HOST}:${PORT}/health`,
        api: `http://${HOST}:${PORT}/api`,
        auth: `http://${HOST}:${PORT}/api/auth`,
        properties: `http://${HOST}:${PORT}/api/properties`,
        investments: `http://${HOST}:${PORT}/api/investments`,
        payments: `http://${HOST}:${PORT}/api/payments`,
        dividends: `http://${HOST}:${PORT}/api/dividends`,
        trading: `http://${HOST}:${PORT}/api/trading`,
        notifications: `http://${HOST}:${PORT}/api/notifications`,
        websocket: `ws://${HOST}:${PORT}/ws`
      });
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        logger.error('Server error', { error });
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
startServer();