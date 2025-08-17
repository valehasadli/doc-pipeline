import { DocumentService, IDocumentUploadRequest, IDocumentMetadata } from '@document-processing/application/services/DocumentService';
import { UploadDocumentUseCase } from '@document-processing/application/use-cases/UploadDocumentUseCase';
import { DocumentStatus } from '@document-processing/domain';

// Mock the DocumentService
jest.mock('@document-processing/application/services/DocumentService');

describe('UploadDocumentUseCase', () => {
  let uploadUseCase: UploadDocumentUseCase;
  let mockDocumentService: jest.Mocked<DocumentService>;
  let mockMetadata: IDocumentMetadata;
  let mockUploadRequest: IDocumentUploadRequest;

  beforeEach(() => {
    // Reset singleton
    (DocumentService as unknown as { instance: undefined }).instance = undefined;
    
    mockDocumentService = {
      uploadDocument: jest.fn()
    } as unknown as jest.Mocked<DocumentService>;

    // Mock DocumentService.getInstance
    (DocumentService.getInstance as jest.Mock).mockReturnValue(mockDocumentService);

    uploadUseCase = new UploadDocumentUseCase();

    mockMetadata = {
      fileName: 'test-document.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      uploadedAt: new Date('2023-01-01T10:00:00Z')
    };

    mockUploadRequest = {
      filePath: '/path/to/test-document.pdf',
      metadata: mockMetadata
    };
  });

  afterEach(async () => {
    // Clean up any pending promises
    await Promise.resolve();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should use provided DocumentService instance', () => {
      const customService = {} as DocumentService;
      const useCase = new UploadDocumentUseCase(customService);

      expect(useCase['documentService']).toBe(customService);
    });

    it('should use singleton DocumentService when none provided', () => {
      const useCase = new UploadDocumentUseCase();

      expect(DocumentService.getInstance).toHaveBeenCalled();
      expect(useCase['documentService']).toBe(mockDocumentService);
    });
  });

  describe('execute', () => {
    it('should execute upload successfully', async () => {
      const expectedResponse = {
        documentId: 'test-doc-id',
        status: DocumentStatus.UPLOADED,
        message: 'Document uploaded successfully and processing started'
      };

      mockDocumentService.uploadDocument.mockResolvedValue(expectedResponse);

      const result = await uploadUseCase.execute(mockUploadRequest);

      expect(mockDocumentService.uploadDocument).toHaveBeenCalledWith(mockUploadRequest);
      expect(result).toEqual(expectedResponse);
    });

    it('should validate request before execution', async () => {
      const invalidRequest = {
        filePath: '',
        metadata: mockMetadata
      };

      await expect(uploadUseCase.execute(invalidRequest))
        .rejects.toThrow('File path is required');

      expect(mockDocumentService.uploadDocument).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      mockDocumentService.uploadDocument.mockRejectedValue(new Error('Service error'));

      await expect(uploadUseCase.execute(mockUploadRequest))
        .rejects.toThrow('Service error');
    });
  });

  describe('Request Validation', () => {
    it('should throw error for missing file path', async () => {
      const invalidRequest = {
        filePath: '',
        metadata: mockMetadata
      };

      await expect(uploadUseCase.execute(invalidRequest))
        .rejects.toThrow('File path is required');
    });

    it('should throw error for missing file name', async () => {
      const invalidRequest = {
        filePath: '/path/to/file.pdf',
        metadata: {
          ...mockMetadata,
          fileName: ''
        }
      };

      await expect(uploadUseCase.execute(invalidRequest))
        .rejects.toThrow('File name is required');
    });

    it('should throw error for missing MIME type', async () => {
      const invalidRequest = {
        filePath: '/path/to/file.pdf',
        metadata: {
          ...mockMetadata,
          mimeType: ''
        }
      };

      await expect(uploadUseCase.execute(invalidRequest))
        .rejects.toThrow('MIME type is required');
    });

    it('should throw error for invalid file size', async () => {
      const invalidRequest = {
        filePath: '/path/to/file.pdf',
        metadata: {
          ...mockMetadata,
          fileSize: 0
        }
      };

      await expect(uploadUseCase.execute(invalidRequest))
        .rejects.toThrow('File size must be greater than 0');
    });

    it('should accept valid request', async () => {
      const expectedResponse = {
        documentId: 'test-doc-id',
        status: DocumentStatus.UPLOADED,
        message: 'Document uploaded successfully and processing started'
      };

      mockDocumentService.uploadDocument.mockResolvedValue(expectedResponse);

      const result = await uploadUseCase.execute(mockUploadRequest);

      expect(result).toEqual(expectedResponse);
      expect(mockDocumentService.uploadDocument).toHaveBeenCalledWith(mockUploadRequest);
    });
  });
});
