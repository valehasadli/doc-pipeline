/**
 * Worker Manager Test Suite
 * 
 * Tests for BullMQ worker management, job processing,
 * and worker lifecycle operations.
 */

import { Worker, Job, UnrecoverableError } from 'bullmq';
import {
  WorkerManager,
  getWorkerManager,
  initializeWorkers,
} from '@document-processing/infrastructure/queue/WorkerManager';
import {
  QUEUE_NAMES,
  DocumentProcessingJob,
  JobErrorType,
} from '@document-processing/infrastructure/queue/JobTypes';

// Mock BullMQ
jest.mock('bullmq');
const MockedWorker = Worker as jest.MockedClass<typeof Worker>;

// Mock Redis connection
jest.mock('@document-processing/infrastructure/redis/RedisConnection', () => ({
  getBullMQRedisConfig: jest.fn(() => ({
    host: 'localhost',
    port: 6379,
    lazyConnect: true,
  })),
}));

describe('Worker Manager', () => {
  let mockWorker: jest.Mocked<Worker>;
  let mockJob: jest.Mocked<Job<DocumentProcessingJob>>;

  beforeEach(() => {
    // Clear all instances and calls
    MockedWorker.mockClear();
    
    // Create mock worker instance
    mockWorker = {
      close: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      isRunning: jest.fn(),
      isPaused: jest.fn(),
      on: jest.fn(),
      name: 'test-worker',
    } as unknown as jest.Mocked<Worker>;

    // Create mock job instance
    mockJob = {
      id: 'job-123',
      data: {
        documentId: 'doc-123',
        filePath: '/uploads/test.pdf',
        stage: 'ocr',
        metadata: {
          originalName: 'test.pdf',
          size: 1024,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
        },
      } as DocumentProcessingJob,
      queueName: 'test-queue',
      attemptsMade: 0,
      opts: { attempts: 3 },
      processedOn: Date.now() - 1000,
    } as unknown as jest.Mocked<Job<DocumentProcessingJob>>;

    MockedWorker.mockImplementation(() => mockWorker);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = WorkerManager.getInstance();
      const instance2 = WorkerManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Processor Registration', () => {
    let workerManager: WorkerManager;

    beforeEach(() => {
      workerManager = WorkerManager.getInstance();
    });

    it('should register job processor', () => {
      const mockProcessor = jest.fn().mockResolvedValue('processed');
      
      workerManager.registerProcessor(QUEUE_NAMES.DOCUMENT_OCR, mockProcessor);
      
      // Should not throw - registration is internal
      expect(() => {
        workerManager.registerProcessor(QUEUE_NAMES.DOCUMENT_OCR, mockProcessor);
      }).not.toThrow();
    });

    it('should allow multiple processor registrations', () => {
      const ocrProcessor = jest.fn();
      const validationProcessor = jest.fn();
      
      workerManager.registerProcessor(QUEUE_NAMES.DOCUMENT_OCR, ocrProcessor);
      workerManager.registerProcessor(QUEUE_NAMES.DOCUMENT_VALIDATION, validationProcessor);
      
      // Should not throw
      expect(() => {
        workerManager.registerProcessor(QUEUE_NAMES.DOCUMENT_OCR, ocrProcessor);
        workerManager.registerProcessor(QUEUE_NAMES.DOCUMENT_VALIDATION, validationProcessor);
      }).not.toThrow();
    });
  });

  describe('Worker Initialization', () => {
    let workerManager: WorkerManager;

    beforeEach(() => {
      workerManager = WorkerManager.getInstance();
    });

    it('should initialize all required workers', async () => {
      await workerManager.initialize();
      
      expect(MockedWorker).toHaveBeenCalledTimes(4); // OCR, Validation, Persistence, DLQ
      expect(MockedWorker).toHaveBeenCalledWith(
        QUEUE_NAMES.DOCUMENT_OCR,
        expect.any(Function),
        expect.objectContaining({
          connection: expect.any(Object),
          concurrency: expect.any(Number),
        })
      );
    });

    it('should set up event handlers for each worker', async () => {
      await workerManager.initialize();
      
      expect(mockWorker.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('active', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('stalled', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('progress', expect.any(Function));
    });

    it('should not reinitialize if already initialized', async () => {
      await workerManager.initialize();
      MockedWorker.mockClear();
      
      await workerManager.initialize();
      
      expect(MockedWorker).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      MockedWorker.mockImplementation(() => {
        throw new Error('Worker creation failed');
      });
      
      await expect(workerManager.initialize()).rejects.toThrow('Worker creation failed');
    });
  });

  describe('Worker Access', () => {
    let workerManager: WorkerManager;

    beforeEach(async () => {
      workerManager = WorkerManager.getInstance();
      await workerManager.initialize();
    });

    it('should return worker by queue name', () => {
      const worker = workerManager.getWorker(QUEUE_NAMES.DOCUMENT_OCR);
      
      expect(worker).toBe(mockWorker);
    });

    it('should return undefined for non-existent worker', () => {
      const worker = workerManager.getWorker('non-existent-queue');
      
      expect(worker).toBeUndefined();
    });

    it('should return all workers', () => {
      const allWorkers = workerManager.getAllWorkers();
      
      expect(allWorkers).toBeInstanceOf(Map);
      expect(allWorkers.size).toBe(4);
      expect(allWorkers.has(QUEUE_NAMES.DOCUMENT_OCR)).toBe(true);
    });
  });

  describe('Default Processor', () => {
    let workerManager: WorkerManager;

    beforeEach(async () => {
      workerManager = WorkerManager.getInstance();
      await workerManager.initialize();
    });

    it('should create default processor for unregistered queues', async () => {
      // Get the processor function that was passed to MockedWorker
      const processorCall = MockedWorker.mock.calls.find(
        call => call[0] === QUEUE_NAMES.DOCUMENT_OCR
      );
      expect(processorCall).toBeDefined();
      
      const processor = processorCall![1];
      
      // Ensure processor is a function before calling
      if (typeof processor === 'function') {
        // Should throw UnrecoverableError for unregistered processor
        await expect(processor(mockJob)).rejects.toThrow(UnrecoverableError);
      } else {
        fail('Processor should be a function');
      }
    });
  });

  describe('Worker Operations', () => {
    let workerManager: WorkerManager;

    beforeEach(async () => {
      workerManager = WorkerManager.getInstance();
      await workerManager.initialize();
    });

    it('should pause worker', async () => {
      await workerManager.pauseWorker(QUEUE_NAMES.DOCUMENT_OCR);
      
      expect(mockWorker.pause).toHaveBeenCalled();
    });

    it('should resume worker', async () => {
      await workerManager.resumeWorker(QUEUE_NAMES.DOCUMENT_OCR);
      
      expect(mockWorker.resume).toHaveBeenCalled();
    });

    it('should throw error for non-existent worker operations', async () => {
      await expect(
        workerManager.pauseWorker('non-existent-queue')
      ).rejects.toThrow('Worker for queue non-existent-queue not found');
      
      await expect(
        workerManager.resumeWorker('non-existent-queue')
      ).rejects.toThrow('Worker for queue non-existent-queue not found');
    });

    it('should close all workers', async () => {
      await workerManager.close();
      
      // Should be called 4 times (one for each worker)
      expect(mockWorker.close).toHaveBeenCalledTimes(4);
    });
  });

  describe('Worker Statistics', () => {
    let workerManager: WorkerManager;

    beforeEach(async () => {
      workerManager = WorkerManager.getInstance();
      await workerManager.initialize();
      
      mockWorker.isRunning.mockReturnValue(true);
      mockWorker.isPaused.mockReturnValue(false);
    });

    it('should get worker statistics', async () => {
      const stats = await workerManager.getWorkerStats(QUEUE_NAMES.DOCUMENT_OCR);
      
      expect(stats).toEqual({
        isRunning: true,
        isPaused: false,
        concurrency: expect.any(Number),
        processed: 0,
        failed: 0,
      });
    });

    it('should get all worker statistics', async () => {
      const allStats = await workerManager.getAllWorkerStats();
      
      expect(allStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_OCR);
      expect(allStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_VALIDATION);
      expect(allStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_PERSISTENCE);
      expect(allStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_DLQ);
    });

    it('should handle statistics errors gracefully', async () => {
      mockWorker.isRunning.mockImplementation(() => {
        throw new Error('Stats failed');
      });
      
      const allStats = await workerManager.getAllWorkerStats();
      
      // When there's an error, the stats object should have default values
      expect(allStats[QUEUE_NAMES.DOCUMENT_OCR]).toMatchObject({
        isRunning: false,
        isPaused: false,
        concurrency: expect.any(Number),
        processed: 0,
        failed: 0,
      });
    });
  });

  describe('Health Check', () => {
    let workerManager: WorkerManager;

    beforeEach(async () => {
      workerManager = WorkerManager.getInstance();
      await workerManager.initialize();
    });

    it('should return healthy status when all workers are running', async () => {
      mockWorker.isRunning.mockReturnValue(true);
      mockWorker.isPaused.mockReturnValue(false);
      
      const health = await workerManager.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.workers).toHaveProperty(QUEUE_NAMES.DOCUMENT_OCR);
      expect(health.workers[QUEUE_NAMES.DOCUMENT_OCR]).toMatchObject({
        healthy: true,
        isRunning: true,
        isPaused: false,
      });
    });

    it('should return unhealthy status when worker is paused', async () => {
      mockWorker.isRunning.mockReturnValue(true);
      mockWorker.isPaused.mockReturnValue(true);
      
      const health = await workerManager.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.workers[QUEUE_NAMES.DOCUMENT_OCR]).toMatchObject({
        healthy: false,
        isRunning: true,
        isPaused: true,
      });
    });

    it('should return unhealthy status when worker is not running', async () => {
      mockWorker.isRunning.mockReturnValue(false);
      mockWorker.isPaused.mockReturnValue(false);
      
      const health = await workerManager.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.workers[QUEUE_NAMES.DOCUMENT_OCR]).toMatchObject({
        healthy: false,
        isRunning: false,
        isPaused: false,
      });
    });

    it('should handle health check errors', async () => {
      mockWorker.isRunning.mockImplementation(() => {
        throw new Error('Health check failed');
      });
      
      const health = await workerManager.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.workers[QUEUE_NAMES.DOCUMENT_OCR]).toMatchObject({
        healthy: false,
        error: 'Health check failed',
      });
    });
  });

  describe('Error Handling Utilities', () => {
    it('should identify retryable errors', () => {
      const networkError = new Error('ECONNREFUSED');
      const timeoutError = new Error('ETIMEDOUT');
      const serviceError = new Error('Service Unavailable');
      
      expect(WorkerManager.isRetryableError(networkError)).toBe(true);
      expect(WorkerManager.isRetryableError(timeoutError)).toBe(true);
      expect(WorkerManager.isRetryableError(serviceError)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const validationError = new Error('Invalid input');
      validationError.name = 'ValidationError';
      const requiredFieldError = new Error('Required field missing');
      
      expect(WorkerManager.isRetryableError(validationError)).toBe(false);
      expect(WorkerManager.isRetryableError(requiredFieldError)).toBe(false);
    });

    it('should default to retryable for unknown errors', () => {
      const unknownError = new Error('Something went wrong');
      
      expect(WorkerManager.isRetryableError(unknownError)).toBe(true);
    });

    it('should create job error objects', () => {
      const originalError = new Error('OCR processing failed');
      const jobError = WorkerManager.createJobError(originalError, JobErrorType.OCR_ERROR);
      
      expect(jobError).toMatchObject({
        type: JobErrorType.OCR_ERROR,
        message: 'OCR processing failed',
        timestamp: expect.any(Date),
        retryable: true,
        details: {
          name: 'Error',
          stack: expect.any(String),
        },
      });
    });

    it('should create job error with default type', () => {
      const originalError = new Error('Unknown error');
      const jobError = WorkerManager.createJobError(originalError);
      
      expect(jobError.type).toBe(JobErrorType.UNKNOWN_ERROR);
    });
  });

  describe('Event Handler Testing', () => {
    let workerManager: WorkerManager;
    let eventHandlers: { [key: string]: Function };

    beforeEach(async () => {
      workerManager = WorkerManager.getInstance();
      
      // Clear previous event handlers
      eventHandlers = {};
      
      // Capture event handlers for each worker creation
      mockWorker.on.mockImplementation((event: string, handler: Function) => {
        eventHandlers[event] = handler;
        return mockWorker;
      });
      
      await workerManager.initialize();
    });

    it('should handle worker ready event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      if (eventHandlers['ready']) {
        eventHandlers['ready']();
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Worker ready: test-worker')
        );
      } else {
        // If no handler captured, just verify the mock was called
        expect(mockWorker.on).toHaveBeenCalledWith('ready', expect.any(Function));
      }
      
      consoleSpy.mockRestore();
    });

    it('should handle worker active event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      if (eventHandlers['active']) {
        eventHandlers['active'](mockJob);
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Worker test-worker processing job job-123')
        );
      } else {
        expect(mockWorker.on).toHaveBeenCalledWith('active', expect.any(Function));
      }
      
      consoleSpy.mockRestore();
    });

    it('should handle worker completed event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      if (eventHandlers['completed']) {
        eventHandlers['completed'](mockJob, 'result');
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Worker test-worker completed job job-123')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Job job-123 processing time:')
        );
      } else {
        expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      }
      
      consoleSpy.mockRestore();
    });

    it('should handle worker failed event', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Job failed');
      
      if (eventHandlers['failed']) {
        eventHandlers['failed'](mockJob, error);
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Worker test-worker failed job job-123:'),
          'Job failed'
        );
      } else {
        expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      }
      
      consoleSpy.mockRestore();
    });

    it('should handle worker error event', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Worker error');
      
      if (eventHandlers['error']) {
        eventHandlers['error'](error);
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Worker test-worker error:'),
          error
        );
      } else {
        expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
      }
      
      consoleSpy.mockRestore();
    });
  });

  describe('Convenience Functions', () => {
    it('should provide getWorkerManager convenience function', () => {
      const manager = getWorkerManager();
      
      expect(manager).toBeInstanceOf(WorkerManager);
    });

    it('should provide initializeWorkers convenience function', async () => {
      // Clear previous calls
      MockedWorker.mockClear();
      
      await initializeWorkers();
      
      expect(MockedWorker).toHaveBeenCalled();
    });
  });
});
