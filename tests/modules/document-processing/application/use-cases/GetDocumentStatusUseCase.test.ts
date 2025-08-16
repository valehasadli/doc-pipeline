import { DocumentService, IDocumentStatusResponse } from '@document-processing/application/services/DocumentService';
import { GetDocumentStatusUseCase } from '@document-processing/application/use-cases/GetDocumentStatusUseCase';
import { DocumentStatus } from '@document-processing/domain';

// Mock the DocumentService
jest.mock('@document-processing/application/services/DocumentService');

describe('GetDocumentStatusUseCase', () => {
  let getStatusUseCase: GetDocumentStatusUseCase;
  let mockDocumentService: jest.Mocked<DocumentService>;

  beforeEach(() => {
    // Reset singleton
    (DocumentService as unknown as { instance: undefined }).instance = undefined;
    
    mockDocumentService = {
      getDocumentStatus: jest.fn()
    } as unknown as jest.Mocked<DocumentService>;

    // Mock DocumentService.getInstance
    (DocumentService.getInstance as jest.Mock).mockReturnValue(mockDocumentService);

    getStatusUseCase = new GetDocumentStatusUseCase();
  });

  afterEach(async () => {
    // Clean up any pending promises
    await Promise.resolve();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should use provided DocumentService instance', () => {
      const customService = {} as DocumentService;
      const useCase = new GetDocumentStatusUseCase(customService);

      expect(useCase['documentService']).toBe(customService);
    });

    it('should use singleton DocumentService when none provided', () => {
      const useCase = new GetDocumentStatusUseCase();

      expect(DocumentService.getInstance).toHaveBeenCalled();
      expect(useCase['documentService']).toBe(mockDocumentService);
    });
  });

  describe('execute', () => {
    const mockStatusResponse: IDocumentStatusResponse = {
      documentId: 'test-doc-id',
      status: DocumentStatus.UPLOADED,
      createdAt: new Date('2023-01-01T10:00:00Z'),
      updatedAt: new Date('2023-01-01T10:00:00Z'),
      ocrResult: undefined,
      validationResult: undefined
    };

    it('should execute get status successfully', async () => {
      mockDocumentService.getDocumentStatus.mockResolvedValue(mockStatusResponse);

      const result = await getStatusUseCase.execute('test-doc-id');

      expect(mockDocumentService.getDocumentStatus).toHaveBeenCalledWith('test-doc-id');
      expect(result).toEqual(mockStatusResponse);
    });

    it('should return status with OCR result', async () => {
      const statusWithOCR = {
        ...mockStatusResponse,
        status: DocumentStatus.OCR_COMPLETED,
        ocrResult: {
          extractedText: 'Sample text',
          confidence: 0.95,
          extractedAt: new Date('2023-01-01T10:05:00Z')
        }
      };

      mockDocumentService.getDocumentStatus.mockResolvedValue(statusWithOCR);

      const result = await getStatusUseCase.execute('test-doc-id');

      expect(result).toEqual(statusWithOCR);
      expect(result.ocrResult).toBeDefined();
    });

    it('should return status with validation result', async () => {
      const statusWithValidation = {
        ...mockStatusResponse,
        status: DocumentStatus.VALIDATION_COMPLETED,
        validationResult: {
          isValid: true,
          errors: [],
          validatedAt: new Date('2023-01-01T10:10:00Z')
        }
      };

      mockDocumentService.getDocumentStatus.mockResolvedValue(statusWithValidation);

      const result = await getStatusUseCase.execute('test-doc-id');

      expect(result).toEqual(statusWithValidation);
      expect(result.validationResult).toBeDefined();
    });

    it('should propagate service errors', async () => {
      mockDocumentService.getDocumentStatus.mockRejectedValue(new Error('Document not found'));

      await expect(getStatusUseCase.execute('non-existent-id'))
        .rejects.toThrow('Document not found');
    });
  });

  describe('Input Validation', () => {
    it('should throw error for empty document ID', async () => {
      await expect(getStatusUseCase.execute(''))
        .rejects.toThrow('Valid document ID is required');
    });

    it('should throw error for whitespace-only document ID', async () => {
      await expect(getStatusUseCase.execute('   '))
        .rejects.toThrow('Document ID cannot be empty');
    });

    it('should throw error for non-string document ID', async () => {
      await expect(getStatusUseCase.execute(null as unknown as string))
        .rejects.toThrow('Valid document ID is required');

      await expect(getStatusUseCase.execute(undefined as unknown as string))
        .rejects.toThrow('Valid document ID is required');

      await expect(getStatusUseCase.execute(123 as unknown as string))
        .rejects.toThrow('Valid document ID is required');
    });

    it('should accept valid document ID', async () => {
      const mockResponse = {
        documentId: 'valid-doc-id',
        status: DocumentStatus.UPLOADED,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDocumentService.getDocumentStatus.mockResolvedValue(mockResponse);

      const result = await getStatusUseCase.execute('valid-doc-id');

      expect(result).toEqual(mockResponse);
      expect(mockDocumentService.getDocumentStatus).toHaveBeenCalledWith('valid-doc-id');
    });
  });
});
