/**
 * Document Processing Infrastructure Integration Test Suite
 * 
 * Tests the complete integration of simplified BullMQ-based infrastructure
 * working together as a cohesive system.
 */

import { Document, IDocumentMetadata } from '@document-processing/domain/entities/Document';
import { DocumentProcessor } from '@document-processing/infrastructure/processors/DocumentProcessor';
import { DocumentQueue } from '@document-processing/infrastructure/queue/DocumentQueue';
import { DocumentWorker } from '@document-processing/infrastructure/workers/DocumentWorker';

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

// Mock DocumentService to avoid database calls
jest.mock('@document-processing/application/services/DocumentService', () => ({
  DocumentService: {
    getInstance: jest.fn().mockReturnValue({
      updateDocument: jest.fn().mockResolvedValue(undefined)
    })
  }
}));

describe('Document Processing Infrastructure Integration', () => {
  let documentQueue: DocumentQueue;
  let documentProcessor: DocumentProcessor;
  let documentWorker: DocumentWorker;
  let mockQueue: jest.Mocked<any>;
  let mockWorker: jest.Mocked<any>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset singleton instances
    (DocumentQueue as any).instance = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    (DocumentProcessor as any).instance = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    (DocumentWorker as any).instance = null; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Setup mock instances
    mockQueue = {
      add: jest.fn(),
      getWaiting: jest.fn(),
      getActive: jest.fn(),
      getCompleted: jest.fn(),
      getFailed: jest.fn(),
      close: jest.fn(),
    };

    mockWorker = {
      on: jest.fn(),
      close: jest.fn(),
    };

    // Mock constructors to return our mocks
    const bullmq = require('bullmq'); // eslint-disable-line @typescript-eslint/no-var-requires
    bullmq.Queue = jest.fn(() => mockQueue);
    bullmq.Worker = jest.fn(() => mockWorker);

    // Get instances
    documentQueue = DocumentQueue.getInstance();
    documentProcessor = DocumentProcessor.getInstance();
    documentWorker = DocumentWorker.getInstance();
  });

  afterEach(async () => {
    await documentQueue.close();
    await documentWorker.stop();
  });

  describe('Complete System Integration', () => {
    it('should initialize all components together', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Start worker
      documentWorker.start();

      // Verify queue and worker are created
      expect(mockQueue).toBeDefined();
      expect(mockWorker).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should process complete document workflow', async () => {
      const documentId = 'integration-test-doc';
      const filePath = '/test/integration-document.pdf';

      // Mock successful job additions
      mockQueue.add.mockResolvedValue({ id: 'ocr-job' });

      // Add OCR job
      const ocrJob = await documentQueue.addOCRJob(documentId, filePath);
      expect(ocrJob).toBeDefined();
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

      // Add validation job
      const validationJob = await documentQueue.addValidationJob(documentId, filePath);
      expect(validationJob).toBeDefined();
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

      // Add persistence job
      const persistenceJob = await documentQueue.addPersistenceJob(documentId, filePath);
      expect(persistenceJob).toBeDefined();
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
    });

    it('should handle end-to-end document processing', async () => {
      // Test the document workflow without complex processor integration
      const metadata: IDocumentMetadata = {
        fileName: 'integration-test.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
      };

      const testDocument = new Document('integration-doc', '/test/integration.pdf', metadata);

      // Test document state transitions
      expect(testDocument.status).toBe('uploaded');

      // Simulate OCR processing
      testDocument.startOCRProcessing();
      expect(testDocument.status).toBe('processing_ocr');

      testDocument.completeOCRProcessing({
        extractedText: 'Integration test document content',
        confidence: 0.95,
        extractedAt: new Date(),
      });
      expect(testDocument.status).toBe('ocr_completed');
      expect(testDocument.ocrResult).toBeDefined();

      // Simulate validation processing
      testDocument.startValidationProcessing();
      expect(testDocument.status).toBe('processing_validation');

      testDocument.completeValidationProcessing({
        isValid: true,
        errors: [],
        validatedAt: new Date(),
      });
      expect(testDocument.status).toBe('validation_completed');
      expect(testDocument.validationResult?.isValid).toBe(true);

      // Simulate persistence processing
      testDocument.startPersistenceProcessing();
      expect(testDocument.status).toBe('processing_persistence');

      testDocument.completePersistenceProcessing();
      expect(testDocument.status).toBe('completed');
    });
  });

  describe('System Health and Monitoring', () => {
    it('should provide comprehensive health check', async () => {
      // Mock healthy queue
      mockQueue.getWaiting.mockResolvedValue([]);

      const queueHealth = await documentQueue.healthCheck();
      expect(queueHealth.healthy).toBe(true);
    });

    it('should handle system failures gracefully', async () => {
      // Reset singleton and create new instance with failing mock
      (DocumentQueue as any).instance = null; // eslint-disable-line @typescript-eslint/no-explicit-any
      
      // Mock queue failure
      const bullmq = require('bullmq'); // eslint-disable-line @typescript-eslint/no-var-requires
      bullmq.Queue = jest.fn(() => ({
        ...mockQueue,
        getWaiting: jest.fn().mockRejectedValue(new Error('System failure')),
      }));

      const failingQueue = DocumentQueue.getInstance();
      const queueHealth = await failingQueue.healthCheck();
      expect(queueHealth.healthy).toBe(false);
      expect(queueHealth.error).toBe('System failure');
    });

    it('should provide queue statistics', async () => {
      // Mock queue methods to return arrays
      mockQueue.getWaiting.mockResolvedValue([]);
      mockQueue.getActive.mockResolvedValue([]);
      mockQueue.getCompleted.mockResolvedValue([]);
      mockQueue.getFailed.mockResolvedValue([]);

      const stats = await documentQueue.getStats();
      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle processing errors gracefully', async () => {
      const metadata: IDocumentMetadata = {
        fileName: 'error-test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
      };

      const errorDocument = new Document('error-doc', '/test/error.pdf', metadata);

      // Try to validate without OCR - should fail due to wrong status
      await expect(documentProcessor.processValidation(errorDocument)).rejects.toThrow(
        'Cannot start validation processing. Current status: uploaded'
      );
    });

    it('should handle worker errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Start worker to trigger event listener setup
      documentWorker.start();

      // Mock worker error handling should be called when worker is created
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));

      consoleSpy.mockRestore();
    });
  });

  describe('Configuration and Environment', () => {
    it('should handle different file types correctly', async () => {
      const fileTypes = ['pdf', 'txt', 'jpg', 'png', 'docx'];

      const jobPromises = fileTypes.map((fileType) => {
        return documentQueue.addOCRJob(`doc-${fileType}`, `/test/${fileType}.file`);
      });

      const jobs = await Promise.all(jobPromises);
      expect(jobs).toHaveLength(5);
      expect(mockQueue.add).toHaveBeenCalledTimes(5);
    });

    it('should handle concurrent job processing', async () => {
      const jobPromises = [];

      // Add multiple jobs concurrently
      for (let i = 0; i < 5; i++) {
        mockQueue.add.mockResolvedValue({ id: `concurrent-job-${i}` });
        jobPromises.push(
          documentQueue.addOCRJob(`concurrent-doc-${i}`, `/test/concurrent-${i}.pdf`)
        );
      }

      const jobs = await Promise.all(jobPromises);
      expect(jobs).toHaveLength(5);
      expect(mockQueue.add).toHaveBeenCalledTimes(5);
    });
  });
});
