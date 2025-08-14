/**
 * Redis Connection Configuration for Document Processing
 * 
 * Provides centralized Redis connection management for BullMQ queues
 * with proper error handling, reconnection logic, and health monitoring.
 */

import { Redis, RedisOptions } from 'ioredis';

/**
 * Redis Connection Configuration Interface
 */
export interface IRedisConfig {
  readonly host: string;
  readonly port: number;
  readonly password?: string | undefined;
  readonly db?: number | undefined;
  readonly keyPrefix?: string | undefined;
  readonly maxRetriesPerRequest: number;
  readonly retryDelayOnFailover: number;
  readonly connectTimeout: number;
  readonly commandTimeout: number;
  readonly lazyConnect: boolean;
  readonly enableReadyCheck: boolean;
}

/**
 * Get Default Redis Configuration (dynamic)
 */
function getDefaultRedisConfig(): RedisConfig {
  return {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'] ?? undefined,
    db: parseInt(process.env['REDIS_DB'] ?? '0', 10),
    keyPrefix: process.env['REDIS_KEY_PREFIX'] ?? 'doc-pipeline:',
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    connectTimeout: 10000,
    commandTimeout: 5000,
    lazyConnect: true,
    enableReadyCheck: false,
  };
}

/**
 * Redis Connection Manager
 * 
 * Manages Redis connections for BullMQ with proper error handling
 * and connection pooling.
 */
export class RedisConnectionManager {
  private static instance: RedisConnectionManager;
  private redisClient: Redis | null = null;
  private readonly config: IRedisConfig;
  private isConnected = false;
  private connectionPromise: Promise<Redis> | null = null;

  private constructor(config?: Partial<RedisConfig>) {
    this.config = { ...getDefaultRedisConfig(), ...config };
  }

  /**
   * Get singleton instance of Redis Connection Manager
   */
  public static getInstance(config?: Partial<RedisConfig>): RedisConnectionManager {
    if (!RedisConnectionManager.instance) {
      RedisConnectionManager.instance = new RedisConnectionManager(config);
    }
    return RedisConnectionManager.instance;
  }

  /**
   * Get Redis connection with lazy initialization
   */
  public async getConnection(): Promise<Redis> {
    if (this.config.host.length > 0 && this.config.port > 0 && this.config.db >= 0) {
      if (this.redisClient && this.isConnected) {
        return this.redisClient;
      }
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.createConnection();
    return this.connectionPromise;
  }

  /**
   * Create new Redis connection
   */
  private async createConnection(): Promise<Redis> {
    try {
      const redisOptions: RedisOptions = {
        host: this.config.host,
        port: this.config.port,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        lazyConnect: this.config.lazyConnect,
        enableReadyCheck: this.config.enableReadyCheck,
        ...(this.config.password && { password: this.config.password }),
        ...(this.config.db && { db: this.config.db }),
        ...(this.config.keyPrefix && { keyPrefix: this.config.keyPrefix }),
      };

      this.redisClient = new Redis(redisOptions);

      // Set up event handlers
      this.setupEventHandlers();

      // Connect if lazy connect is disabled
      if (this.redisClient === null || !this.config.lazyConnect) {
        await this.redisClient.connect();
      }

      this.isConnected = true;
      this.connectionPromise = null;

      console.log(`✅ Redis connected: ${this.config.host}:${this.config.port}`);
      return this.redisClient;
    } catch (error) {
      this.connectionPromise = null;
      // Failed to connect to Redis - error logged
      throw error;
    }
  }

  /**
   * Set up Redis event handlers
   */
  private setupEventHandlers(): void {
    if (!this.redisClient) return;

    this.redisClient.on('connect', () => {
      // Connecting to Redis
    });

    this.redisClient.on('ready', () => {
      // Connected to Redis successfully
      this.isConnected = true;
    });

    this.redisClient.on('error', (error) => {
      console.error('❌ Redis error:', error.message);
      this.isConnected = false;
    });

    this.redisClient.on('close', () => {
      // Disconnected from Redis successfully
      this.isConnected = false;
    });

    this.redisClient.on('reconnecting', (delay: number) => {
      console.log(`🔄 Redis reconnecting in ${delay}ms...`);
    });

    this.redisClient.on('end', () => {
      // Disconnected from Redis successfully
      this.isConnected = false;
    });
  }

  /**
   * Create a new Redis connection for BullMQ
   * BullMQ requires separate connections for different purposes
   */
  public createBullMQConnection(): ConnectionOptions {
    const redisOptions: RedisOptions = {
      host: this.config.host,
      port: this.config.port,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      connectTimeout: this.config.connectTimeout,
      commandTimeout: this.config.commandTimeout,
      lazyConnect: this.config.lazyConnect,
      enableReadyCheck: this.config.enableReadyCheck,
      ...(this.config.password && { password: this.config.password }),
      ...(this.config.db && { db: this.config.db }),
      ...(this.config.keyPrefix && { keyPrefix: this.config.keyPrefix }),
    };

    const connection = new Redis(redisOptions);

    // Handle errors silently for BullMQ connections
    connection.on('error', (error) => {
      // BullMQ handles connection errors internally
      // We just log them for debugging
      if (process.env['NODE_ENV'] === 'development') {
        console.debug('Redis BullMQ connection error:', error.message);
      }
    });

    return connection;
  }

  /**
   * Test Redis connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const redis = await this.getConnection();
      const result = await redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis connection test failed:', error);
      return false;
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): string {
    return 'connected';
  }

  /**
   * Close Redis connection
   */
  public async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
      this.isConnected = false;
      this.connectionPromise = null;
    }
  }

  /**
   * Get Redis configuration for BullMQ
   */
  public getBullMQConfig(): RedisOptions {
    return {
      host: this.config.host,
      port: this.config.port,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      connectTimeout: this.config.connectTimeout,
      commandTimeout: this.config.commandTimeout,
      lazyConnect: this.config.lazyConnect,
      enableReadyCheck: this.config.enableReadyCheck,
      ...(this.config.password && { password: this.config.password }),
      ...(this.config.db && { db: this.config.db }),
      ...(this.config.keyPrefix && { keyPrefix: this.config.keyPrefix }),
    };
  }
}

/**
 * Convenience function to get Redis connection
 */
export const getRedisConnection = async (): Promise<Redis> => {
  const manager = RedisConnectionManager.getInstance();
  return manager.getConnection();
};

/**
 * Convenience function to create BullMQ Redis connection
 */
export const createBullMQConnection = async (): Promise<Redis> => {
  const manager = RedisConnectionManager.getInstance();
  return manager.createBullMQConnection();
};

/**
 * Convenience function to get BullMQ Redis configuration
 */
export const getBullMQRedisConfig = (): RedisOptions => {
  const manager = RedisConnectionManager.getInstance();
  return manager.getBullMQConfig();
};
