/**
 * Health Service - Application Layer
 */

export interface IHealthStatus {
  readonly status: 'healthy' | 'unhealthy';
  readonly timestamp: string;
  readonly uptime: number;
  readonly version: string;
  readonly services: Record<string, IServiceHealth>;
}

export interface IReadinessStatus {
  readonly ready: boolean;
  readonly timestamp: string;
  readonly services: Record<string, IServiceHealth>;
}

export interface IServiceHealth {
  readonly status: 'up' | 'down';
  readonly responseTime?: number;
  readonly error?: string;
}

export class HealthService {
  private readonly startTime: Date = new Date();
  private readonly version: string = process.env['npm_package_version'] ?? '1.0.0';

  public async checkHealth(): Promise<IHealthStatus> {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

    const services = await this.checkServices();
    const allServicesHealthy = Object.values(services).every(
      service => service.status === 'up'
    );

    return {
      status: allServicesHealthy ? 'healthy' : 'unhealthy',
      timestamp,
      uptime,
      version: this.version,
      services,
    };
  }

  public async checkReadiness(): Promise<IReadinessStatus> {
    const timestamp = new Date().toISOString();
    const services = await this.checkCriticalServices();
    
    const allCriticalServicesReady = Object.values(services).every(
      service => service.status === 'up'
    );

    return {
      ready: allCriticalServicesReady,
      timestamp,
      services,
    };
  }

  private async checkServices(): Promise<Record<string, IServiceHealth>> {
    const services: Record<string, IServiceHealth> = {};

    // Check MongoDB connection
    services['mongodb'] = await this.checkMongoDB();
    
    // Check Redis connection
    services['redis'] = await this.checkRedis();
    
    // Check file system
    services['filesystem'] = await this.checkFileSystem();

    return services;
  }

  private async checkCriticalServices(): Promise<Record<string, IServiceHealth>> {
    // For readiness, we only check critical services needed for startup
    return {
      mongodb: await this.checkMongoDB(),
      redis: await this.checkRedis(),
    };
  }

  private async checkMongoDB(): Promise<IServiceHealth> {
    let connection: import('mongoose').Connection | null = null;
    try {
      const startTime = Date.now();
      
      // Import Mongoose
      const mongoose = await import('mongoose');
      
      // Create MongoDB connection with shorter timeouts
      connection = mongoose.default.createConnection('mongodb://localhost:27017/document-pipeline', {
        serverSelectionTimeoutMS: 1000,
        connectTimeoutMS: 1000,
        socketTimeoutMS: 1000,
        bufferCommands: false,
      });
      
      // Handle connection errors to prevent app crashes
      connection.on('error', () => {
        // Silently handle errors - they'll be caught by the try/catch
      });
      
      // Wait for connection to be established
      await connection.asPromise();
      
      // Test MongoDB connection with ping
      const db = connection.db;
      if (!db) {
        throw new Error('Failed to get database instance');
      }
      await db.admin().ping();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'up',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'MongoDB connection failed',
      };
    } finally {
      // Ensure connection is always closed
      if (connection !== null) {
        try {
          await connection.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  private async checkRedis(): Promise<IServiceHealth> {
    let redis: import('ioredis').Redis | null = null;
    try {
      const startTime = Date.now();
      
      // Import Redis client
      const { Redis } = await import('ioredis');
      
      // Create Redis connection with error handling
      redis = new Redis({
        host: 'localhost',
        port: 6379,
        connectTimeout: 1000,
        commandTimeout: 1000,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
      });
      
      // Handle Redis errors to prevent app crashes
      redis.on('error', () => {
        // Silently handle errors - they'll be caught by the try/catch
      });
      
      // Test Redis connection with PING
      await redis.ping();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'up',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Redis connection failed',
      };
    } finally {
      // Ensure connection is always closed
      if (redis !== null) {
        try {
          redis.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }
    }
  }

  private async checkFileSystem(): Promise<IServiceHealth> {
    try {
      const startTime = Date.now();
      
      // Check if we can write to the uploads directory
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const uploadsPath = process.env['LOCAL_STORAGE_PATH'] ?? './uploads';
      const uploadsDir = path.join(process.cwd(), uploadsPath);
      
      // Ensure filesystem directory exists
      await fs.mkdir(uploadsDir, { recursive: true });
      
      // Try to write a test file
      const testFile = path.join(uploadsDir, '.health-check');
      await fs.writeFile(testFile, 'health-check', 'utf8');
      await fs.unlink(testFile);
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'up',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'File system error',
      };
    }
  }
}
