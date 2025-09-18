import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger, logRequest } from './shared/utils/logger';
import { DatabaseManager } from './shared/database';
import './shared/utils/express-types';

// Load environment variables
dotenv.config();

// Import route handlers
import authRoutes from './services/api-gateway/auth';
import videoRoutes from './services/video-service/routes';
import uploadRoutes from './services/upload-service/routes';
import generationRoutes from './services/generation-service/routes';
import fileRoutes from './services/file-service/routes';
import { handleSSEConnection } from './services/events/sse';

const app = express();
const PORT = process.env.PORT || 3000;

// Global middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(logRequest);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 attempts per 15 minutes
  message: {
    code: 'AUTH_RATE_LIMIT',
    message: 'Too many authentication attempts, please try again later',
  },
});

// Health check
app.get('/health', async (req, res) => {
  const dbHealth = await DatabaseManager.healthCheck();
  const status = dbHealth ? 'healthy' : 'unhealthy';
  
  res.status(dbHealth ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: dbHealth ? 'up' : 'down',
      api: 'up'
    }
  });
});

// SSE endpoint (must be before catch-all video routes)
app.get('/api/events', handleSSEConnection);

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/files', fileRoutes); // File serving for local storage (no auth required)
app.use('/', fileRoutes); // Handle all file serving routes (/uploads/*, /generated/*, /processed/*)
app.use('/api', videoRoutes); // Video service handles /videos, /projects, /templates
app.use('/api/upload', uploadRoutes);
app.use('/api/generation', generationRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.baseUrl} not found`,
  });
});

// Global error handler
app.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled Error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    user: req.user?.userId,
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    code: error.code || 'INTERNAL_SERVER_ERROR',
    message: error.message || 'Internal server error',
    ...(isDevelopment && { stack: error.stack }),
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Close server
  server.close(() => {
    logger.info('HTTP server closed.');
  });

  // Close database connection
  try {
    await DatabaseManager.disconnect();
    logger.info('Database connection closed.');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }

  process.exit(0);
};

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await DatabaseManager.connect();
    
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📱 Frontend URL: ${process.env.CORS_ORIGIN || 'http://localhost:8080'}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
let server: any;
if (require.main === module) {
  startServer().then(s => server = s);
}

export default app;