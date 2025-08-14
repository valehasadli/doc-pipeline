/**
 * Queue Manager Test Suite
 * 
 * Tests for BullMQ queue management, job scheduling,
 * and queue operations.
 */

import { Queue, Job } from 'bullmq';
import {
  QueueManager,
  getQueueManager,
  initializeQueues,
} from '@document-processing/infrastructure/queue/QueueManager';
import {
  QUEUE_NAMES,
  JobErrorType,
  JobError,
  DocumentMetadata,
  OCRResult,
  ValidationResult,
  JobPriority,
} from '@document-processing/infrastructure/queue/JobTypes';

// Mock BullMQ
jest.mock('bullmq');
const MockedQueue = Queue as jest.MockedClass<typeof Queue>;

// Mock Redis connection
jest.mock('@document-processing/infrastructure/redis/RedisConnection', () => ({
  getBullMQRedisConfig: jest.fn(() => ({
    host: 'localhost',
    port: 6379,
    lazyConnect: true,
  })),
}));

describe('Queue Manager', () => {
  let mockQueue: jest.Mocked<Queue>;
  let mockJob: jest.Mocked<Job>;

  beforeEach(() => {
    // Clear all instances and calls
    MockedQueue.mockClear();
    
    // Create mock queue instance
    mockQueue = {
      add: jest.fn(),
      getWaiting: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getCompleted: jest.fn().mockResolvedValue([]),
      getFailed: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
      pause: jest.fn(),
      resume: jest.fn(),
      clean: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      name: 'test-queue',
      token: 'test-token',
      jobsOpts: {},
      opts: {},
    } as unknown as jest.Mocked<Queue>;

    // Create mock job instance
    mockJob = {
      id: 'test-job-id',
      data: {
        documentId: 'test-doc-id',
        filePath: '/test/path',
        metadata: { fileName: 'test.pdf' },
        stage: 'ocr',
      },
      opts: { attempts: 3 },
      queueName: 'test-queue',
      attemptsMade: 1,
      name: 'test-job',
      queueQualifiedName: 'test-queue',
      progress: 0,
      returnvalue: null,
      stacktrace: [],
      delay: 0,
      timestamp: Date.now(),
    } as unknown as jest.Mocked<Job>;

    MockedQueue.mockImplementation(() => mockQueue);
    mockQueue.add.mockResolvedValue(mockJob);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = QueueManager.getInstance();
      const instance2 = QueueManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Queue Initialization', () => {
    let queueManager: QueueManager;

    beforeEach(() => {
      queueManager = QueueManager.getInstance();
    });

    it('should initialize all required queues', async () => {
      await queueManager.initialize();
      
      expect(MockedQueue).toHaveBeenCalledTimes(4); // OCR, Validation, Persistence, DLQ
      expect(MockedQueue).toHaveBeenCalledWith(
        QUEUE_NAMES.DOCUMENT_OCR,
        expect.objectContaining({
          connection: expect.any(Object),
          defaultJobOptions: expect.any(Object),
        })
      );
    });

    it('should set up event handlers for each queue', async () => {
      await queueManager.initialize();
      
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('waiting', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('active', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('stalled', expect.any(Function));
    });

    it('should not reinitialize if already initialized', async () => {
      await queueManager.initialize();
      MockedQueue.mockClear();
      
      await queueManager.initialize();
      
      expect(MockedQueue).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      MockedQueue.mockImplementation(() => {
        throw new Error('Queue creation failed');
      });
      
      await expect(queueManager.initialize()).rejects.toThrow('Queue creation failed');
    });
  });

  describe('Queue Access', () => {
    let queueManager: QueueManager;

    beforeEach(async () => {
      queueManager = QueueManager.getInstance();
      await queueManager.initialize();
    });

    it('should return queue by name', () => {
      const queue = queueManager.getQueue(QUEUE_NAMES.DOCUMENT_OCR);
      
      expect(queue).toBe(mockQueue);
    });

    it('should return undefined for non-existent queue', () => {
      const queue = queueManager.getQueue('non-existent-queue');
      
      expect(queue).toBeUndefined();
    });
  });

  describe('Job Management', () => {
    let queueManager: QueueManager;
    const mockMetadata: DocumentMetadata = {
      originalName: 'test.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
    };

    beforeEach(async () => {
      queueManager = QueueManager.getInstance();
      await queueManager.initialize();
    });

    describe('OCR Jobs', () => {
      it('should add OCR job to queue', async () => {
        const job = await queueManager.addOCRJob(
          'doc-123',
          '/uploads/test.pdf',
          mockMetadata
        );
        
        expect(mockQueue.add).toHaveBeenCalledWith(
          'process-ocr',
          expect.objectContaining({
            documentId: 'doc-123',
            filePath: '/uploads/test.pdf',
            stage: 'ocr',
            metadata: mockMetadata,
          }),
          expect.objectContaining({
            attempts: 5,
            priority: JobPriority.NORMAL,
          })
        );
        expect(job).toBe(mockJob);
      });

      it('should add OCR job with custom options', async () => {
        await queueManager.addOCRJob(
          'doc-123',
          '/uploads/test.pdf',
          mockMetadata,
          { priority: JobPriority.HIGH, delay: 1000 }
        );
        
        expect(mockQueue.add).toHaveBeenCalledWith(
          'process-ocr',
          expect.any(Object),
          expect.objectContaining({
            priority: JobPriority.HIGH,
            delay: 1000,
          })
        );
      });

      it('should throw error if OCR queue not initialized', async () => {
        const uninitializedManager = QueueManager.getInstance();
        // Don't initialize
        
        await expect(
          uninitializedManager.addOCRJob('doc-123', '/uploads/test.pdf', mockMetadata)
        ).rejects.toThrow('OCR queue not initialized');
      });
    });

    describe('Validation Jobs', () => {
      const mockOCRResult: OCRResult = {
        text: 'Test text',
        confidence: 0.9,
        language: 'en',
        extractedAt: new Date(),
      };

      it('should add validation job to queue', async () => {
        const job = await queueManager.addValidationJob(
          'doc-123',
          '/uploads/test.pdf',
          mockMetadata,
          mockOCRResult
        );
        
        expect(mockQueue.add).toHaveBeenCalledWith(
          'process-validation',
          expect.objectContaining({
            documentId: 'doc-123',
            stage: 'validation',
            ocrResult: mockOCRResult,
          }),
          expect.objectContaining({
            attempts: 3,
          })
        );
        expect(job).toBe(mockJob);
      });
    });

    describe('Persistence Jobs', () => {
      const mockOCRResult: OCRResult = {
        text: 'Test text',
        confidence: 0.9,
        language: 'en',
        extractedAt: new Date(),
      };

      const mockValidationResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        validatedAt: new Date(),
      };

      it('should add persistence job to queue', async () => {
        const job = await queueManager.addPersistenceJob(
          'doc-123',
          '/uploads/test.pdf',
          mockMetadata,
          mockOCRResult,
          mockValidationResult
        );
        
        expect(mockQueue.add).toHaveBeenCalledWith(
          'process-persistence',
          expect.objectContaining({
            documentId: 'doc-123',
            stage: 'persistence',
            ocrResult: mockOCRResult,
            validationResult: mockValidationResult,
          }),
          expect.objectContaining({
            attempts: 4,
          })
        );
        expect(job).toBe(mockJob);
      });
    });

    describe('Dead Letter Queue', () => {
      it('should add job to DLQ', async () => {
        const originalJob = mockJob;
        const error = {
          type: JobErrorType.OCR_ERROR,
          message: 'OCR processing failed',
          timestamp: new Date(),
          retryable: true,
        } as JobError;
        
        const dlqJob = await queueManager.addToDLQ(originalJob, error);
        
        expect(mockQueue.add).toHaveBeenCalledWith(
          'dlq-job',
          expect.objectContaining({
            originalJobId: originalJob.id,
            originalJobData: originalJob.data,
            error,
          }),
          expect.objectContaining({
            priority: JobPriority.LOW,
            attempts: 1,
          })
        );
        expect(dlqJob).toBe(mockJob);
      });
    });
  });

  describe('Queue Statistics', () => {
    let queueManager: QueueManager;

    beforeEach(async () => {
      queueManager = QueueManager.getInstance();
      await queueManager.initialize();
      
      // Mock queue statistics
      mockQueue.getWaiting.mockResolvedValue([mockJob]);
      mockQueue.getActive.mockResolvedValue([mockJob, mockJob]);
      mockQueue.getCompleted.mockResolvedValue([mockJob, mockJob, mockJob]);
      mockQueue.getFailed.mockResolvedValue([]);
      mockQueue.getDelayed.mockResolvedValue([mockJob]);
    });

    it('should get queue statistics', async () => {
      const stats = await queueManager.getQueueStats(QUEUE_NAMES.DOCUMENT_OCR);
      
      expect(stats).toEqual({
        waiting: 1,
        active: 2,
        completed: 3,
        failed: 0,
        delayed: 1,
      });
    });

    it('should get all queue statistics', async () => {
      const allStats = await queueManager.getAllQueueStats();
      
      expect(allStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_OCR);
      expect(allStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_VALIDATION);
      expect(allStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_PERSISTENCE);
      expect(allStats).toHaveProperty(QUEUE_NAMES.DOCUMENT_DLQ);
    });

    it('should handle statistics errors gracefully', async () => {
      mockQueue.getWaiting.mockRejectedValue(new Error('Stats failed'));
      
      const allStats = await queueManager.getAllQueueStats();
      
      expect(allStats[QUEUE_NAMES.DOCUMENT_OCR]).toHaveProperty('error');
    });
  });

  describe('Queue Operations', () => {
    let queueManager: QueueManager;

    beforeEach(async () => {
      queueManager = QueueManager.getInstance();
      await queueManager.initialize();
    });

    it('should pause queue', async () => {
      await queueManager.pauseQueue(QUEUE_NAMES.DOCUMENT_OCR);
      
      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it('should resume queue', async () => {
      await queueManager.resumeQueue(QUEUE_NAMES.DOCUMENT_OCR);
      
      expect(mockQueue.resume).toHaveBeenCalled();
    });

    it('should clean queue', async () => {
      await queueManager.cleanQueue(QUEUE_NAMES.DOCUMENT_OCR, 3600000);
      
      expect(mockQueue.clean).toHaveBeenCalledWith(3600000, 100, 'completed');
      expect(mockQueue.clean).toHaveBeenCalledWith(3600000, 50, 'failed');
    });

    it('should close all queues', async () => {
      await queueManager.close();
      
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    let queueManager: QueueManager;

    beforeEach(async () => {
      queueManager = QueueManager.getInstance();
      await queueManager.initialize();
    });

    it('should return healthy status when all queues are working', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 10,
        failed: 0,
        delayed: 0,
      });
      
      const health = await queueManager.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.queues[QUEUE_NAMES.DOCUMENT_OCR]?.healthy).toBe(true);
    });

    it('should return unhealthy status when queue fails', async () => {
      mockQueue.getJobCounts.mockRejectedValue(new Error('Queue error'));
      
      const health = await queueManager.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.queues[QUEUE_NAMES.DOCUMENT_OCR]?.healthy).toBe(false);
      expect(health.queues[QUEUE_NAMES.DOCUMENT_OCR]?.error).toBe('Queue error');
    });
  });

  describe('Convenience Functions', () => {
    it('should provide getQueueManager convenience function', () => {
      const manager = getQueueManager();
      
      expect(manager).toBeInstanceOf(QueueManager);
    });

    it('should provide initializeQueues convenience function', async () => {
      await initializeQueues();
      
      expect(MockedQueue).toHaveBeenCalled();
    });
  });
});
