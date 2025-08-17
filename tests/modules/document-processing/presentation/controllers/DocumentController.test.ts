import request from 'supertest';
import express from 'express';
import { DocumentController } from '@document-processing/presentation/controllers/DocumentController';
import { GetDocumentsUseCase } from '@document-processing/application/use-cases/GetDocumentsUseCase';
import { DocumentStatus } from '@document-processing/domain';

// Mock all use cases
jest.mock('@document-processing/application/use-cases/GetDocumentsUseCase');
jest.mock('@document-processing/application/use-cases/UploadDocumentUseCase');
jest.mock('@document-processing/application/use-cases/GetDocumentStatusUseCase');

describe('DocumentController', () => {
  let app: express.Application;
  let documentController: DocumentController;
  let mockGetDocumentsUseCase: jest.Mocked<GetDocumentsUseCase>;

  beforeEach(() => {
    // Mock the constructor dependencies
    const MockGetDocumentsUseCase = GetDocumentsUseCase as jest.MockedClass<typeof GetDocumentsUseCase>;
    mockGetDocumentsUseCase = {
      execute: jest.fn()
    } as any;
    MockGetDocumentsUseCase.mockImplementation(() => mockGetDocumentsUseCase);

    // Create controller (constructor will use mocked dependencies)
    documentController = new DocumentController();

    // Setup express app
    app = express();
    app.use(express.json());
    
    // Setup routes
    app.get('/api/documents', documentController.getDocuments);
    app.get('/api/documents/stats/summary', documentController.getStatistics);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/documents', () => {
    it('should return all documents successfully', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          status: DocumentStatus.COMPLETED,
          filePath: '/uploads/doc1.pdf',
          metadata: {
            fileName: 'doc1.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            uploadedAt: new Date()
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          ocrResult: {
            extractedText: 'Sample text',
            confidence: 0.95,
            extractedAt: new Date()
          },
          validationResult: {
            isValid: true,
            errors: [],
            validatedAt: new Date()
          }
        }
      ];

      mockGetDocumentsUseCase.execute.mockResolvedValue(mockDocuments as any);

      const response = await request(app)
        .get('/api/documents')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          documents: expect.arrayContaining([
            expect.objectContaining({
              documentId: 'doc-1',
              status: DocumentStatus.COMPLETED,
              filePath: '/uploads/doc1.pdf'
            })
          ]),
          count: 1
        }
      });

      expect(mockGetDocumentsUseCase.execute).toHaveBeenCalledWith(undefined);
    });

    it('should filter documents by status', async () => {
      mockGetDocumentsUseCase.execute.mockResolvedValue([]);

      await request(app)
        .get('/api/documents?status=completed')
        .expect(200);

      expect(mockGetDocumentsUseCase.execute).toHaveBeenCalledWith(DocumentStatus.COMPLETED);
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .get('/api/documents?status=invalid-status')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid status filter',
        message: 'Status must be one of: uploaded, queued, processing_ocr, processing_validation, processing_persistence, ocr_completed, validation_completed, completed, ocr_failed, validation_failed, persistence_failed, failed, cancelled, dead_letter'
      });
    });

    it('should handle service errors', async () => {
      mockGetDocumentsUseCase.execute.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/documents')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get documents',
        message: 'Service error'
      });
    });
  });

  describe('GET /api/documents/stats/summary', () => {
    it('should return statistics successfully', async () => {
      // Mock DocumentService for statistics
      const mockStats = {
        total: 10,
        byStatus: {
          [DocumentStatus.COMPLETED]: 5,
          [DocumentStatus.FAILED]: 2,
          [DocumentStatus.UPLOADED]: 3
        },
        queueStats: {
          waiting: 1,
          active: 0,
          completed: 8,
          failed: 1
        }
      };

      // Mock the dynamic import
      jest.doMock('@document-processing/application/services/DocumentService', () => ({
        DocumentService: {
          getInstance: jest.fn().mockReturnValue({
            getStatistics: jest.fn().mockResolvedValue(mockStats)
          })
        }
      }));

      const response = await request(app)
        .get('/api/documents/stats/summary')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockStats
      });
    });

    it('should handle statistics errors', async () => {
      // Mock the DocumentService module before the request
      const mockDocumentService = {
        getStatistics: jest.fn().mockRejectedValue(new Error('Stats error'))
      };
      
      jest.doMock('@document-processing/application/services/DocumentService', () => ({
        DocumentService: {
          getInstance: jest.fn().mockReturnValue(mockDocumentService)
        }
      }));

      // Clear module cache to force re-import
      jest.resetModules();

      const response = await request(app)
        .get('/api/documents/stats/summary')
        .expect(500);

      expect(response.body.error).toBe('Failed to get statistics');
      expect(response.body.message).toContain('Stats error');
    });
  });
});
