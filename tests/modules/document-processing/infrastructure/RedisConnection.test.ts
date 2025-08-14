/**
 * Redis Connection Manager Test Suite
 * 
 * Tests for Redis connection management, configuration,
 * and BullMQ integration.
 */

import { Redis } from 'ioredis';
import {
  RedisConnectionManager,
  getRedisConnection,
  createBullMQConnection,
  getBullMQRedisConfig,
} from '@document-processing/infrastructure/redis/RedisConnection';

// Mock ioredis
jest.mock('ioredis', () => {
  return {
    Redis: jest.fn(),
  };
});
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('Redis Connection Manager', () => {
  let mockRedisInstance: jest.Mocked<Pick<Redis, 'connect' | 'ping' | 'quit' | 'disconnect' | 'on'>>;

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods
    jest.clearAllMocks();
    
    // Reset the singleton instance for each test
    (RedisConnectionManager as any).instance = undefined;
    
    // Create a properly typed partial mock Redis instance
    mockRedisInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
      on: jest.fn(),
    } as jest.Mocked<Pick<Redis, 'connect' | 'ping' | 'quit' | 'disconnect' | 'on'>>;

    (MockedRedis as unknown as jest.Mock).mockImplementation(() => mockRedisInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RedisConnectionManager.getInstance();
      const instance2 = RedisConnectionManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should accept configuration on first instantiation', () => {
      const config = { host: 'test-host', port: 6380 };
      const instance = RedisConnectionManager.getInstance(config);
      
      expect(instance).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    let connectionManager: RedisConnectionManager;

    beforeEach(() => {
      connectionManager = RedisConnectionManager.getInstance();
    });

    it('should create Redis connection with default configuration', async () => {
      const connection = await connectionManager.getConnection();
      
      expect(MockedRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          lazyConnect: true,
          enableReadyCheck: false,
        })
      );
      expect(connection).toBe(mockRedisInstance);
    });

    it('should set up event handlers on connection', async () => {
      await connectionManager.getConnection();
      
      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('end', expect.any(Function));
    });

    it('should reuse existing connection', async () => {
      const connection1 = await connectionManager.getConnection();
      const connection2 = await connectionManager.getConnection();
      
      expect(connection1).toBe(connection2);
      expect(MockedRedis).toHaveBeenCalledTimes(1);
    });

    it('should test connection with ping', async () => {
      const isConnected = await connectionManager.testConnection();
      
      expect(mockRedisInstance.ping).toHaveBeenCalled();
      expect(isConnected).toBe(true);
    });

    it('should handle connection test failure', async () => {
      mockRedisInstance.ping.mockRejectedValue(new Error('Connection failed'));
      
      const isConnected = await connectionManager.testConnection();
      
      expect(isConnected).toBe(false);
    });

    it('should close connection properly', async () => {
      await connectionManager.getConnection();
      await connectionManager.close();
      
      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });
  });

  describe('BullMQ Integration', () => {
    let connectionManager: RedisConnectionManager;

    beforeEach(() => {
      connectionManager = RedisConnectionManager.getInstance();
    });

    it('should create separate BullMQ connection', async () => {
      const bullmqConfig = connectionManager.getBullMQConfig();
      
      expect(MockedRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          lazyConnect: true,
          enableReadyCheck: false,
        })
      );
      expect(bullmqConfig).toHaveProperty('host');
      expect(bullmqConfig).toHaveProperty('port');
      expect(bullmqConfig).toHaveProperty('lazyConnect');
      expect(bullmqConfig).toHaveProperty('enableReadyCheck');
    });

    it('should return BullMQ configuration', () => {
      const config = connectionManager.getBullMQConfig();
      
      expect(config).toMatchObject({
        host: 'localhost',
        port: 6379,
        lazyConnect: true,
        enableReadyCheck: false,
      });
    });

    it('should handle BullMQ connection errors silently', async () => {
      connectionManager.getBullMQConfig();
      
      // Verify error handler is set up
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Connection Status', () => {
    let connectionManager: RedisConnectionManager;

    beforeEach(() => {
      connectionManager = RedisConnectionManager.getInstance();
    });

    it('should return connection status', () => {
      const status = connectionManager.getConnectionStatus();
      
      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('config');
      expect(typeof status.isConnected).toBe('boolean');
      expect(typeof status.config).toBe('object');
    });

    it('should include configuration in status', () => {
      const status = connectionManager.getConnectionStatus();
      
      expect(status.config).toMatchObject({
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        commandTimeout: 5000,
      });
    });
  });

  describe('Environment Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
      // Reset the singleton instance for environment tests
      (RedisConnectionManager as any).instance = undefined;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use environment variables when provided', () => {
      process.env['REDIS_HOST'] = 'test-host';
      process.env['REDIS_PORT'] = '6380';
      process.env['REDIS_PASSWORD'] = 'test-pass';
      process.env['REDIS_DB'] = '2';
      process.env['REDIS_KEY_PREFIX'] = 'test:';
      
      // Create a new instance with environment variables
      const redisManager = RedisConnectionManager.getInstance();
      const config = redisManager.getBullMQConfig();
      
      expect(config.host).toBe('test-host');
      expect(config.port).toBe(6380);
      expect(config.password).toBe('test-pass');
      expect(config.db).toBe(2);
      expect(config.keyPrefix).toBe('test:');
    });

    it('should fall back to defaults when environment variables are not set', () => {
      delete process.env['REDIS_HOST'];
      delete process.env['REDIS_PORT'];

      const { RedisConnectionManager: DefaultConnectionManager } = require('@document-processing/infrastructure/redis/RedisConnection');
      const manager = DefaultConnectionManager.getInstance();
      const config = manager.getBullMQConfig();

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(6379);
    });
  });

  describe('Convenience Functions', () => {
    it('should provide getRedisConnection convenience function', async () => {
      const connection = await getRedisConnection();
      
      expect(connection).toBe(mockRedisInstance);
      expect(MockedRedis).toHaveBeenCalled();
    });

    it('should provide createBullMQConnection convenience function', async () => {
      const connection = await createBullMQConnection();
      
      expect(connection).toBe(mockRedisInstance);
      expect(MockedRedis).toHaveBeenCalled();
    });

    it('should provide getBullMQRedisConfig convenience function', () => {
      const config = getBullMQRedisConfig();
      
      expect(config).toMatchObject({
        host: 'localhost',
        port: 6379,
        lazyConnect: true,
        enableReadyCheck: false,
      });
    });
  });

  describe('Error Handling', () => {
    let connectionManager: RedisConnectionManager;

    beforeEach(() => {
      connectionManager = RedisConnectionManager.getInstance();
    });

    it('should handle Redis connection errors', async () => {
      // Reset singleton to force new connection attempt
      (RedisConnectionManager as any).instance = undefined;
      const newConnectionManager = RedisConnectionManager.getInstance();
      
      MockedRedis.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      await expect(newConnectionManager.getConnection()).rejects.toThrow('Redis connection failed');
    });

    it('should handle ping errors in test connection', async () => {
      mockRedisInstance.ping.mockRejectedValue(new Error('Ping failed'));
      
      const isConnected = await connectionManager.testConnection();
      
      expect(isConnected).toBe(false);
    });

    it('should handle close errors gracefully', async () => {
      mockRedisInstance.quit.mockRejectedValue(new Error('Close failed'));
      
      // Should not throw
      await expect(connectionManager.close()).resolves.toBeUndefined();
    });
  });
});
