/**
 * Document Processing Infrastructure Integration Test Suite
 * 
 * Tests the complete integration of Redis, Queue Manager, and Worker Manager
 * working together as a cohesive system.
 */

import { Redis } from 'ioredis';
import { Queue, Worker, Job } from 'bullmq';
import {
  RedisConnectionManager,
  QueueManager,
  WorkerManager,
  QUEUE_NAMES,
  DocumentMetadata,
  OCRResult,
  ValidationResult,
  JobPriority,
  JobErrorType,
  DocumentProcessingJob,
} from '@document-processing/infrastructure';

// Mock external dependencies
jest.mock('ioredis');
jest.mock('bullmq');

const MockedRedis = Redis as jest.MockedClass<typeof Redis>;
const MockedQueue = Queue as jest.MockedClass<typeof Queue>;
const MockedWorker = Worker as jest.MockedClass<typeof Worker>;

describe('Document Processing Infrastructure Integration', () => {
  let mockRedis: jest.Mocked<Pick<Redis, 'connect' | 'ping' | 'quit' | 'disconnect' | 'on'>>;
  let mockQueue: jest.Mocked<Pick<Queue, 'add' | 'getWaiting' | 'getActive' | 'getCompleted' | 'getFailed' | 'getDelayed' | 'getJobCounts' | 'pause' | 'resume' | 'clean' | 'close' | 'on' | 'name'>>;
  let mockWorker: jest.Mocked<Pick<Worker, 'close' | 'pause' | 'resume' | 'isRunning' | 'isPaused' | 'on' | 'name'>>;
  let mockJob: jest.Mocked<Pick<Job<DocumentProcessingJob>, 'id' | 'data' | 'queueName' | 'attemptsMade' | 'opts'>>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup Redis mock
    mockRedis = {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
      on: jest.fn(),
    };
    MockedRedis.mockImplementation(() => mockRedis as unknown as Redis);

    // Setup Queue mock
    mockQueue = {
      add: jest.fn(),
      getWaiting: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getCompleted: jest.fn().mockResolvedValue([]),
      getFailed: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      }),
      pause: jest.fn(),
      resume: jest.fn(),
      clean: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      name: 'test-queue',
    };
    MockedQueue.mockImplementation(() => mockQueue as unknown as Queue);

    // Setup Worker mock
    mockWorker = {
      close: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      isRunning: jest.fn().mockReturnValue(true),
      isPaused: jest.fn().mockReturnValue(false),
      on: jest.fn(),
      name: 'test-worker',
    };
    MockedWorker.mockImplementation(() => mockWorker as unknown as Worker);

    // Setup Job mock
    mockJob = {
      id: 'job-123',
      data: {} as DocumentProcessingJob,
      queueName: 'test-queue',
      attemptsMade: 0,
      opts: { attempts: 3 },
    };
    mockQueue.add.mockResolvedValue(mockJob as unknown as Job);
  });

  describe('Complete System Integration', () => {
    it('should initialize all components together', async () => {
      // Initialize Redis connection
      const redisManager = RedisConnectionManager.getInstance();
      const redisConnection = await redisManager.getConnection();

      // Initialize Queue Manager
      const queueManager = QueueManager.getInstance();
      await queueManager.initialize();

      // Initialize Worker Manager
      const workerManager = WorkerManager.getInstance();
      await workerManager.initialize();

      // Verify Redis connection
      expect(redisConnection).toBe(mockRedis);
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));

      // Verify queues created
      expect(MockedQueue).toHaveBeenCalledTimes(4); // OCR, Validation, Persistence, DLQ
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));

      // Verify workers created
      expect(MockedWorker).toHaveBeenCalledTimes(4);
      expect(mockWorker.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('should handle complete job processing workflow', async () => {
      // Initialize system
      const queueManager = QueueManager.getInstance();
      await queueManager.initialize();

      const workerManager = WorkerManager.getInstance();
      await workerManager.initialize();

      // Mock document metadata
      const metadata: DocumentMetadata = {
        originalName: 'invoice.pdf',
        size: 2048000,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
        uploadedBy: 'user123',
      };

      // Step 1: Add OCR job
      const ocrJob = await queueManager.addOCRJob(
        'doc-456',
        '/uploads/invoice.pdf',
        metadata,
        { priority: JobPriority.HIGH }
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-ocr',
        expect.objectContaining({
          documentId: 'doc-456',
          stage: 'ocr',
          metadata,
        }),
        expect.objectContaining({
          priority: JobPriority.HIGH,
        })
      );

      // Step 2: Simulate OCR completion and add validation job
      const ocrResult: OCRResult = {
        text: 'Invoice #INV-2024-001\nAmount: $1,500.00\nDate: 2024-01-15',
        confidence: 0.92,
        language: 'en',
        extractedAt: new Date(),
      };

      const validationJob = await queueManager.addValidationJob(
        'doc-456',
        '/uploads/invoice.pdf',
        metadata,
        ocrResult
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-validation',
        expect.objectContaining({
          documentId: 'doc-456',
          stage: 'validation',
          ocrResult,
        }),
        expect.any(Object)
      );

      // Step 3: Simulate validation completion and add persistence job
      const validationResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['OCR confidence below 95%'],
        validatedAt: new Date(),
      };

      const persistenceJob = await queueManager.addPersistenceJob(
        'doc-456',
        '/uploads/invoice.pdf',
        metadata,
        ocrResult,
        validationResult
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-persistence',
        expect.objectContaining({
          documentId: 'doc-456',
          stage: 'persistence',
          ocrResult,
          validationResult,
        }),
        expect.any(Object)
      );

      // Verify all jobs created
      expect(ocrJob).toBe(mockJob);
      expect(validationJob).toBe(mockJob);
      expect(persistenceJob).toBe(mockJob);
    });

    it('should handle error scenarios and DLQ processing', async () => {
      const queueManager = QueueManager.getInstance();
      await queueManager.initialize();

      // Simulate failed job
      const failedJob = mockJob;
      failedJob.attemptsMade = 3; // Exhausted all attempts

      const error = {
        type: JobErrorType.OCR_ERROR,
        message: 'OCR service unavailable',
        timestamp: new Date(),
        retryable: false,
      };

      // Add to DLQ
      const dlqJob = await queueManager.addToDLQ(failedJob as unknown as Job<DocumentProcessingJob>, error);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'dlq-job',
        expect.objectContaining({
          originalJobId: failedJob.id,
          originalJobData: failedJob.data,
          error,
          failedAt: expect.any(Date),
          attemptsMade: 3,
        }),
        expect.objectContaining({
          priority: JobPriority.LOW,
          attempts: 1,
        })
      );

      expect(dlqJob).toBe(mockJob);
    });
  });

  describe('System Health and Monitoring', () => {
    it('should provide comprehensive health check', async () => {
      // Initialize all components
      const redisManager = RedisConnectionManager.getInstance();
      const queueManager = QueueManager.getInstance();
      const workerManager = WorkerManager.getInstance();

      await queueManager.initialize();
      await workerManager.initialize();

      // Test Redis health
      const redisHealthy = await redisManager.testConnection();
      expect(redisHealthy).toBe(true);

      // Test queue health
      const queueHealth = await queueManager.healthCheck();
      expect(queueHealth.healthy).toBe(true);
      expect(queueHealth.queues).toHaveProperty(QUEUE_NAMES.DOCUMENT_OCR);

      // Test worker health
      const workerHealth = await workerManager.healthCheck();
      expect(workerHealth.healthy).toBe(true);
      expect(workerHealth.workers).toHaveProperty(QUEUE_NAMES.DOCUMENT_OCR);
    });

    it('should provide system statistics', async () => {
      const queueManager = QueueManager.getInstance();
      await queueManager.initialize();

      const workerManager = WorkerManager.getInstance();
      await workerManager.initialize();

      // Get queue statistics
      const queueStats = await queueManager.getAllQueueStats();
      expect(queueStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_OCR);
      expect(queueStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_VALIDATION);
      expect(queueStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_PERSISTENCE);
      expect(queueStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_DLQ);

      // Get worker statistics
      const workerStats = await workerManager.getAllWorkerStats();
      expect(workerStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_OCR);
      expect(workerStats[QUEUE_NAMES.DOCUMENT_OCR]).toMatchObject({
        isRunning: true,
        isPaused: false,
        concurrency: expect.any(Number),
      });
    });
  });

  describe('System Operations', () => {
    it('should support queue and worker operations', async () => {
      const queueManager = QueueManager.getInstance();
      const workerManager = WorkerManager.getInstance();

      await queueManager.initialize();
      await workerManager.initialize();

      // Pause queue and worker
      await queueManager.pauseQueue(QUEUE_NAMES.DOCUMENT_OCR);
      await workerManager.pauseWorker(QUEUE_NAMES.DOCUMENT_OCR);

      expect(mockQueue.pause).toHaveBeenCalled();
      expect(mockWorker.pause).toHaveBeenCalled();

      // Resume queue and worker
      await queueManager.resumeQueue(QUEUE_NAMES.DOCUMENT_OCR);
      await workerManager.resumeWorker(QUEUE_NAMES.DOCUMENT_OCR);

      expect(mockQueue.resume).toHaveBeenCalled();
      expect(mockWorker.resume).toHaveBeenCalled();

      // Clean queue
      await queueManager.cleanQueue(QUEUE_NAMES.DOCUMENT_OCR, 3600000);
      expect(mockQueue.clean).toHaveBeenCalledWith(3600000, 100, 'completed');
    });

    it('should support graceful shutdown', async () => {
      const redisManager = RedisConnectionManager.getInstance();
      const queueManager = QueueManager.getInstance();
      const workerManager = WorkerManager.getInstance();

      await queueManager.initialize();
      await workerManager.initialize();

      // Shutdown all components
      await workerManager.close();
      await queueManager.close();
      await redisManager.close();

      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('Configuration and Environment', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should respect environment configuration', () => {
      process.env['REDIS_HOST'] = 'production-redis';
      process.env['REDIS_PORT'] = '6380';
      process.env['WORKER_CONCURRENCY'] = '10';

      // Re-import to get new environment values
      const { RedisConnectionManager: EnvRedisManager } = require('@document-processing/infrastructure/redis/RedisConnection');
      
      const redisManager = EnvRedisManager.getInstance();
      const config = redisManager.getBullMQConfig();

      expect(config.host).toBe('production-redis');
      expect(config.port).toBe(6380);
    });

    it('should use default configuration when environment is not set', () => {
      delete process.env['REDIS_HOST'];
      delete process.env['REDIS_PORT'];
      delete process.env['WORKER_CONCURRENCY'];

      const { RedisConnectionManager: DefaultRedisManager } = require('@document-processing/infrastructure/redis/RedisConnection');
      
      const redisManager = DefaultRedisManager.getInstance();
      const config = redisManager.getBullMQConfig();

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(6379);
    });
  });

  describe('Error Resilience', () => {
    it('should handle Redis connection failures gracefully', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Redis unavailable'));

      const redisManager = RedisConnectionManager.getInstance();
      const isHealthy = await redisManager.testConnection();

      expect(isHealthy).toBe(false);
    });

    it('should handle queue operation failures', async () => {
      mockQueue.getJobCounts.mockRejectedValue(new Error('Queue error'));

      const queueManager = QueueManager.getInstance();
      await queueManager.initialize();

      const health = await queueManager.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it('should handle worker operation failures', async () => {
      mockWorker.isRunning.mockImplementation(() => {
        throw new Error('Worker error');
      });

      const workerManager = WorkerManager.getInstance();
      await workerManager.initialize();

      const health = await workerManager.healthCheck();
      expect(health.healthy).toBe(false);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent job additions', async () => {
      const queueManager = QueueManager.getInstance();
      await queueManager.initialize();

      const metadata: DocumentMetadata = {
        originalName: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
      };

      // Add multiple jobs concurrently
      const jobPromises = Array.from({ length: 10 }, (_, i) =>
        queueManager.addOCRJob(`doc-${i}`, `/uploads/test-${i}.pdf`, metadata)
      );

      const jobs = await Promise.all(jobPromises);

      expect(jobs).toHaveLength(10);
      expect(mockQueue.add).toHaveBeenCalledTimes(10);
    });

    it('should support different job priorities', async () => {
      const queueManager = QueueManager.getInstance();
      await queueManager.initialize();

      const metadata: DocumentMetadata = {
        originalName: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
      };

      // Add jobs with different priorities
      await queueManager.addOCRJob('doc-low', '/uploads/low.pdf', metadata, {
        priority: JobPriority.LOW,
      });

      await queueManager.addOCRJob('doc-high', '/uploads/high.pdf', metadata, {
        priority: JobPriority.HIGH,
      });

      await queueManager.addOCRJob('doc-critical', '/uploads/critical.pdf', metadata, {
        priority: JobPriority.CRITICAL,
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-ocr',
        expect.objectContaining({ documentId: 'doc-low' }),
        expect.objectContaining({ priority: JobPriority.LOW })
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-ocr',
        expect.objectContaining({ documentId: 'doc-high' }),
        expect.objectContaining({ priority: JobPriority.HIGH })
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-ocr',
        expect.objectContaining({ documentId: 'doc-critical' }),
        expect.objectContaining({ priority: JobPriority.CRITICAL })
      );
    });
  });
});
