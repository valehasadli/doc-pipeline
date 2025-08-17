import { Job } from 'bullmq';

import { DocumentQueue, IDocumentJobData } from '@document-processing/infrastructure/queue/DocumentQueue';

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    getWaiting: jest.fn(),
    getActive: jest.fn(),
    getCompleted: jest.fn(),
    getFailed: jest.fn(),
    close: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

describe('DocumentQueue', () => {
  let documentQueue: DocumentQueue;
  let mockQueue: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset singleton instance
    (DocumentQueue as any).instance = null;
    
    // Setup mock queue
    mockQueue = {
      add: jest.fn(),
      getWaiting: jest.fn(),
      getActive: jest.fn(),
      getCompleted: jest.fn(),
      getFailed: jest.fn(),
      close: jest.fn(),
    };
    
    // Mock Queue constructor to return our mock
    const { Queue } = require('bullmq');
    Queue.mockImplementation(() => mockQueue);
    
    // Get fresh instance
    documentQueue = DocumentQueue.getInstance();
  });

  afterEach(async () => {
    await documentQueue.close();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DocumentQueue.getInstance();
      const instance2 = DocumentQueue.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Job Management', () => {
    it('should add OCR job successfully', async () => {
      const documentId = 'doc-123';
      const filePath = '/path/to/document.pdf';
      
      const mockJob = { id: 'job-123' } as Job<IDocumentJobData>;
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await documentQueue.addOCRJob(documentId, filePath);

      expect(mockQueue.add).toHaveBeenCalledWith('ocr', {
        documentId,
        filePath,
        stage: 'ocr',
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
      expect(result).toBe(mockJob);
    });

    it('should add validation job successfully', async () => {
      const documentId = 'doc-123';
      const filePath = '/path/to/document.pdf';
      
      const mockJob = { id: 'job-124' } as Job<IDocumentJobData>;
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await documentQueue.addValidationJob(documentId, filePath);

      expect(mockQueue.add).toHaveBeenCalledWith('validation', {
        documentId,
        filePath,
        stage: 'validation',
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
      expect(result).toBe(mockJob);
    });

    it('should add persistence job successfully', async () => {
      const documentId = 'doc-123';
      const filePath = '/path/to/document.pdf';
      
      const mockJob = { id: 'job-125' } as Job<IDocumentJobData>;
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await documentQueue.addPersistenceJob(documentId, filePath);

      expect(mockQueue.add).toHaveBeenCalledWith('persistence', {
        documentId,
        filePath,
        stage: 'persistence',
      }, {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      });
      expect(result).toBe(mockJob);
    });
  });

  describe('Worker Management', () => {
    it('should create worker successfully', () => {
      const mockProcessor = jest.fn();
      const mockWorker = {
        on: jest.fn(),
        close: jest.fn(),
      };
      
      const { Worker } = require('bullmq');
      Worker.mockReturnValue(mockWorker);

      const worker = documentQueue.createWorker(mockProcessor);

      expect(Worker).toHaveBeenCalledWith(
        'document-processing',
        mockProcessor,
        expect.objectContaining({
          connection: expect.any(Object),
          concurrency: 5,
        })
      );
      expect(worker).toBe(mockWorker);
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
    });
  });

  describe('Statistics', () => {
    it('should get queue statistics successfully', async () => {
      const mockWaiting = [{ id: '1' }, { id: '2' }];
      const mockActive = [{ id: '3' }];
      const mockCompleted = [{ id: '4' }, { id: '5' }, { id: '6' }];
      const mockFailed = [{ id: '7' }];

      mockQueue.getWaiting.mockResolvedValue(mockWaiting);
      mockQueue.getActive.mockResolvedValue(mockActive);
      mockQueue.getCompleted.mockResolvedValue(mockCompleted);
      mockQueue.getFailed.mockResolvedValue(mockFailed);

      const stats = await documentQueue.getStats();

      expect(stats).toEqual({
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 1,
      });
    });

    it('should handle statistics errors gracefully', async () => {
      mockQueue.getWaiting.mockRejectedValue(new Error('Redis connection failed'));

      await expect(documentQueue.getStats()).rejects.toThrow('Redis connection failed');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when queue is accessible', async () => {
      mockQueue.getWaiting.mockResolvedValue([]);

      const health = await documentQueue.healthCheck();

      expect(health).toEqual({ healthy: true });
    });

    it('should return unhealthy status when queue is not accessible', async () => {
      const error = new Error('Redis connection failed');
      mockQueue.getWaiting.mockRejectedValue(error);

      const health = await documentQueue.healthCheck();

      expect(health).toEqual({
        healthy: false,
        error: 'Redis connection failed',
      });
    });

    it('should handle unknown errors', async () => {
      mockQueue.getWaiting.mockRejectedValue('Unknown error');

      const health = await documentQueue.healthCheck();

      expect(health).toEqual({
        healthy: false,
        error: 'Unknown error',
      });
    });
  });

  describe('Cleanup', () => {
    it('should close queue and workers successfully', async () => {
      const mockWorker = {
        on: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      };
      
      const { Worker } = require('bullmq');
      Worker.mockReturnValue(mockWorker);

      // Create a worker
      documentQueue.createWorker(jest.fn());

      mockQueue.close.mockResolvedValue(undefined);

      await documentQueue.close();

      expect(mockQueue.close).toHaveBeenCalled();
      expect(mockWorker.close).toHaveBeenCalled();
    });
  });
});
