import { Job } from 'bullmq';

import { getDocumentProcessor } from '@document-processing/infrastructure/processors/DocumentProcessor';
import { getDocumentQueue } from '@document-processing/infrastructure/queue/DocumentQueue';
import { DocumentWorker } from '@document-processing/infrastructure/workers/DocumentWorker';

// Mock the dependencies
jest.mock('@document-processing/infrastructure/queue/DocumentQueue');
jest.mock('@document-processing/infrastructure/processors/DocumentProcessor');

describe('DocumentWorker', () => {
  let worker: DocumentWorker;
  let mockQueue: jest.Mocked<any>;
  let mockProcessor: jest.Mocked<any>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Reset singleton instance
    (DocumentWorker as any).instance = null; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Setup mocks
    mockQueue = {
      createWorker: jest.fn(),
      addValidationJob: jest.fn(),
      addPersistenceJob: jest.fn(),
      close: jest.fn(),
    };

    mockProcessor = {
      processOCR: jest.fn(),
      processValidation: jest.fn(),
      processPersistence: jest.fn(),
    };

    // Mock the getter functions
    (getDocumentQueue as jest.Mock).mockReturnValue(mockQueue);
    (getDocumentProcessor as jest.Mock).mockReturnValue(mockProcessor);

    worker = DocumentWorker.getInstance();
  });

  afterEach(async () => {
    await worker.stop();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DocumentWorker.getInstance();
      const instance2 = DocumentWorker.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Worker Lifecycle', () => {
    it('should start worker successfully', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      worker.start();

      expect(mockQueue.createWorker).toHaveBeenCalledWith(expect.any(Function));
      
      consoleSpy.mockRestore();
    });

    it('should stop worker successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockQueue.close.mockResolvedValue(undefined);

      await worker.stop();

      expect(mockQueue.close).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Job Processing', () => {
    let jobProcessor: (job: Job<any>) => Promise<void>;

    beforeEach(() => {
      worker.start();
      jobProcessor = mockQueue.createWorker.mock.calls[0][0];
    });

    describe('OCR Job Processing', () => {
      it('should process OCR job successfully', async () => {
        const mockJob = {
          data: {
            documentId: 'doc-123',
            filePath: '/path/to/document.pdf',
            stage: 'ocr',
          },
        } as Job<any>;

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        mockProcessor.processOCR.mockResolvedValue(undefined);
        mockQueue.addValidationJob.mockResolvedValue({ id: 'validation-job' });

        await jobProcessor(mockJob);

        expect(mockProcessor.processOCR).toHaveBeenCalledWith(expect.any(Object));
        expect(mockQueue.addValidationJob).toHaveBeenCalledWith('doc-123', '/path/to/document.pdf');
        
        consoleSpy.mockRestore();
      });

      it('should handle OCR processing errors', async () => {
        const mockJob = {
          data: {
            documentId: 'doc-123',
            filePath: '/path/to/document.pdf',
            stage: 'ocr',
          },
        } as Job<any>;

        const error = new Error('OCR processing failed');
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        mockProcessor.processOCR.mockRejectedValue(error);

        await expect(jobProcessor(mockJob)).rejects.toThrow('OCR processing failed');
        
        consoleSpy.mockRestore();
      });
    });

    describe('Validation Job Processing', () => {
      it('should process validation job successfully', async () => {
        const job = { data: { documentId: 'test-doc', filePath: '/test/path', stage: 'validation' } } as jest.Mocked<any>;

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        mockProcessor.processValidation.mockResolvedValue(undefined);
        mockQueue.addPersistenceJob.mockResolvedValue({ id: 'persistence-job' });

        await jobProcessor(job);

        expect(mockProcessor.processValidation).toHaveBeenCalledWith(expect.any(Object));
        expect(mockQueue.addPersistenceJob).toHaveBeenCalledWith('test-doc', '/test/path');
        
        consoleSpy.mockRestore();
      });
    });

    describe('Persistence Job Processing', () => {
      it('should process persistence job successfully', async () => {
        const job = { data: { documentId: 'test-doc', filePath: '/test/path', stage: 'persistence' } } as jest.Mocked<any>;

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        mockProcessor.processPersistence.mockResolvedValue(undefined);

        await jobProcessor(job);

        expect(mockProcessor.processPersistence).toHaveBeenCalledWith(expect.any(Object));
        
        consoleSpy.mockRestore();
      });
    });

    describe('Unknown Stage Handling', () => {
      it('should handle unknown processing stage', async () => {
        const job = { data: { documentId: 'test-doc', filePath: '/test/path', stage: 'unknown' } } as jest.Mocked<any>;

        await expect(jobProcessor(job)).rejects.toThrow('Unknown processing stage: unknown');
      });
    });

    describe('Document Creation', () => {
      it('should create document with correct metadata for PDF', async () => {
        const mockJob = {
          data: {
            documentId: 'doc-123',
            filePath: '/path/to/document.pdf',
            stage: 'ocr',
          },
        } as Job<any>;

        mockProcessor.processOCR.mockImplementation((document: any) => {
          expect(document.id).toBe('doc-123');
          expect(document.filePath).toBe('/path/to/document.pdf');
          expect(document.metadata.fileName).toBe('document.pdf');
          expect(document.metadata.mimeType).toBe('application/pdf');
          expect(document.metadata.fileSize).toBe(1024);
          expect(document.metadata.uploadedAt).toBeInstanceOf(Date);
        });

        await jobProcessor(mockJob);
      });

      it('should create document with correct metadata for text file', async () => {
        const job = { data: { documentId: 'test-doc', filePath: '/test/document.txt', stage: 'ocr' } } as jest.Mocked<any>;

        mockProcessor.processOCR.mockImplementation((document: any) => {
          expect(document.metadata.fileName).toBe('document.txt');
          expect(document.metadata.mimeType).toBe('text/plain');
        });

        await jobProcessor(job);
      });

      it('should create document with correct metadata for image file', async () => {
        const mockJob = {
          data: {
            documentId: 'doc-125',
            filePath: '/path/to/receipt.jpg',
            stage: 'ocr',
          },
        } as Job<any>;

        mockProcessor.processOCR.mockImplementation((document: any) => {
          expect(document.metadata.fileName).toBe('receipt.jpg');
          expect(document.metadata.mimeType).toBe('image/jpeg');
        });

        await jobProcessor(mockJob);
      });

      it('should handle unknown file extensions', async () => {
        const mockJob = {
          data: {
            documentId: 'doc-126',
            filePath: '/path/to/unknown.xyz',
            stage: 'ocr',
          },
        } as Job<any>;

        mockProcessor.processOCR.mockImplementation((document: jest.Mocked<any>) => {
          expect(document.metadata.fileName).toBe('unknown.xyz');
          expect(document.metadata.mimeType).toBe('application/octet-stream');
        });

        await jobProcessor(mockJob);
      });

      it('should handle files without extensions', async () => {
        const mockJob = {
          data: {
            documentId: 'doc-127',
            filePath: '/path/to/document',
            stage: 'ocr',
          },
        } as Job<any>;

        mockProcessor.processOCR.mockImplementation((document: any) => {
          expect(document.metadata.fileName).toBe('document');
          expect(document.metadata.mimeType).toBe('application/octet-stream');
        });

        await jobProcessor(mockJob);
      });
    });
  });
});
