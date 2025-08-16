import 'reflect-metadata';
import 'dotenv/config';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { MongoConnection } from '@document-processing/infrastructure/database/connection/MongoConnection';
import { DocumentWorker } from '@document-processing/infrastructure/workers/DocumentWorker';
import { createDocumentRoutes } from '@document-processing/presentation/routes/documentRoutes';
import { createHealthRoutes } from '@health/presentation/routes';

/**
 * Main Application Entry Point
 */
class Application {
  private readonly app: express.Application;
  private readonly port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env['PORT'] ?? '3000', 10);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: (process.env['NODE_ENV'] ?? 'development') === 'production' 
        ? false 
        : true,
      credentials: true,
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Compression middleware
    this.app.use(compression());

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Development logging middleware
    const nodeEnv = process.env['NODE_ENV'] ?? 'development';
    if (nodeEnv === 'development') {
      this.app.use((req, _res, next) => {
        // Development logging only
        if (process.env['NODE_ENV'] === 'development') {
          // eslint-disable-next-line no-console
          console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        }
        next();
      });
    }
  }

  private setupRoutes(): void {
    // Health check routes (no /api prefix for health checks)
    this.app.use('/', createHealthRoutes());

    // Document processing API routes
    this.app.use('/api/documents', createDocumentRoutes());

    // Root endpoint
    this.app.get('/', (_req, res) => {
      res.json({
        name: 'Document Processing Pipeline',
        version: process.env['npm_package_version'] ?? '1.0.0',
        environment: process.env['NODE_ENV'] ?? 'development',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          readiness: '/ready',
          liveness: '/ping',
        },
      });
    });

    // 404 handler
    this.app.use((_req: express.Request, res: express.Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${_req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((err: Error, _req: express.Request, res: express.Response) => {
      // Log error in development only
      const nodeEnv = process.env['NODE_ENV'] ?? 'development';
      if (nodeEnv === 'development') {
        // eslint-disable-next-line no-console
        console.error('Unhandled error:', err);
      }

      // Don't leak error details in production
      const isDevelopment = (process.env['NODE_ENV'] ?? 'development') === 'development';
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: isDevelopment ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
      });
    });
  }

  public start(): void {
    try {
      // Start server first, then initialize connections asynchronously
      this.app.listen(this.port, () => {
        // Server startup logging - using proper environment variable handling
        const nodeEnv = process.env['NODE_ENV'] ?? 'development';
        if (nodeEnv === 'development') {
          // eslint-disable-next-line no-console
          console.log(`🚀 Server running on port ${this.port}`);
          // eslint-disable-next-line no-console
          console.log(`📊 Health check: http://localhost:${this.port}/health`);
          // eslint-disable-next-line no-console
          console.log(`🔄 Readiness check: http://localhost:${this.port}/ready`);
          // eslint-disable-next-line no-console
          console.log(`💓 Liveness check: http://localhost:${this.port}/ping`);
          // eslint-disable-next-line no-console
          console.log(`🌍 Environment: ${nodeEnv}`);
        }

        // Initialize connections after server starts (non-blocking)
        void this.initializeConnections();
      });
    } catch (error) {
      const nodeEnv = process.env['NODE_ENV'] ?? 'development';
      if (nodeEnv === 'development') {
        // eslint-disable-next-line no-console
        console.error('❌ Failed to start server:', error);
      }
      process.exit(1);
    }
  }

  private async initializeConnections(): Promise<void> {
    try {
      // Initialize MongoDB connection with timeout
      // eslint-disable-next-line no-console
      console.log('🔌 Connecting to MongoDB...');
      const mongoTimeout = setTimeout(() => {
        // eslint-disable-next-line no-console
        console.log('⚠️  MongoDB connection timeout - continuing without MongoDB');
      }, 5000);
      
      await MongoConnection.getInstance().connect();
      clearTimeout(mongoTimeout);
      // eslint-disable-next-line no-console
      console.log('✅ MongoDB connected');

      // Initialize document worker
      // eslint-disable-next-line no-console
      console.log('🔄 Starting document worker...');
      const worker = DocumentWorker.getInstance();
      void worker.start();
      // eslint-disable-next-line no-console
      console.log('✅ Document worker started');
      
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('⚠️  Connection initialization failed - server running without full functionality');
      // eslint-disable-next-line no-console
      console.log('Error:', error instanceof Error ? error.message : error);
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Start the application
const application = new Application();

// Graceful shutdown handlers
process.on('SIGTERM', (): void => {
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  if (nodeEnv === 'development') {
    // eslint-disable-next-line no-console
    console.log('SIGTERM received, shutting down gracefully');
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  if (nodeEnv === 'development') {
    // eslint-disable-next-line no-console
    console.log('SIGINT received, shutting down gracefully');
  }
  process.exit(0);
});

// Start server
void application.start();

export { Application };
