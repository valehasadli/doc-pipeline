import { DocumentService } from '@document-processing/application/services/DocumentService';
import { GetDocumentsUseCase } from '@document-processing/application/use-cases/GetDocumentsUseCase';
import { Document, DocumentStatus } from '@document-processing/domain';

// Mock the DocumentService
jest.mock('@document-processing/application/services/DocumentService');

describe('GetDocumentsUseCase', () => {
  let getDocumentsUseCase: GetDocumentsUseCase;
  let mockDocumentService: jest.Mocked<DocumentService>;

  beforeEach(() => {
    // Reset singleton
    (DocumentService as unknown as { instance: undefined }).instance = undefined;
    
    mockDocumentService = {
      getDocuments: jest.fn()
    } as unknown as jest.Mocked<DocumentService>;

    // Mock DocumentService.getInstance
    (DocumentService.getInstance as jest.Mock).mockReturnValue(mockDocumentService);

    getDocumentsUseCase = new GetDocumentsUseCase();
  });

  afterEach(async () => {
    // Clean up any pending promises
    await Promise.resolve();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should use provided DocumentService instance', () => {
      const customService = {} as DocumentService;
      const useCase = new GetDocumentsUseCase(customService);

      expect(useCase['documentService']).toBe(customService);
    });

    it('should use singleton DocumentService when none provided', () => {
      const useCase = new GetDocumentsUseCase();

      expect(DocumentService.getInstance).toHaveBeenCalled();
      expect(useCase['documentService']).toBe(mockDocumentService);
    });
  });

  describe('execute', () => {
    const mockMetadata = {
      fileName: 'test.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      uploadedAt: new Date('2023-01-01T10:00:00Z')
    };

    const mockDocuments: Document[] = [
      new Document('doc-1', '/path/to/doc1.pdf', mockMetadata, DocumentStatus.UPLOADED),
      new Document('doc-2', '/path/to/doc2.pdf', mockMetadata, DocumentStatus.COMPLETED)
    ];

    it('should execute get all documents successfully', async () => {
      mockDocumentService.getDocuments.mockResolvedValue(mockDocuments);

      const result = await getDocumentsUseCase.execute();

      expect(mockDocumentService.getDocuments).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockDocuments);
    });

    it('should execute get documents with status filter', async () => {
      const uploadedDocuments = mockDocuments.slice(0, 1);
      mockDocumentService.getDocuments.mockResolvedValue(uploadedDocuments);

      const result = await getDocumentsUseCase.execute(DocumentStatus.UPLOADED);

      expect(mockDocumentService.getDocuments).toHaveBeenCalledWith(DocumentStatus.UPLOADED);
      expect(result).toEqual(uploadedDocuments);
    });

    it('should return empty array when no documents match filter', async () => {
      mockDocumentService.getDocuments.mockResolvedValue([]);

      const result = await getDocumentsUseCase.execute(DocumentStatus.FAILED);

      expect(mockDocumentService.getDocuments).toHaveBeenCalledWith(DocumentStatus.FAILED);
      expect(result).toEqual([]);
    });

    it('should handle all document statuses', async () => {
      const statuses = Object.values(DocumentStatus);

      for (const status of statuses) {
        mockDocumentService.getDocuments.mockResolvedValue([]);
        
        await getDocumentsUseCase.execute(status);
        
        expect(mockDocumentService.getDocuments).toHaveBeenCalledWith(status);
      }
    });

    it('should propagate service errors', async () => {
      mockDocumentService.getDocuments.mockRejectedValue(new Error('Service error'));

      await expect(getDocumentsUseCase.execute()).rejects.toThrow('Service error');
    });
  });
});
