import {
  DocumentService,
  IDocumentMetadata,
  IDocumentUploadRequest,
  IDocumentUploadResponse,
  IDocumentStatusResponse
} from '@document-processing/application/services/DocumentService';

import {
  UploadDocumentUseCase,
  GetDocumentStatusUseCase,
  GetDocumentsUseCase
} from '@document-processing/application';

describe('Application Layer Exports', () => {
  describe('Service Exports', () => {
    it('should export DocumentService class', () => {
      expect(DocumentService).toBeDefined();
      expect(typeof DocumentService).toBe('function');
    });

    it('should export service interfaces', () => {
      // These are TypeScript interfaces, so we can't test them directly at runtime
      // But we can test that they work with actual objects
      const metadata: IDocumentMetadata = {
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date()
      };

      const uploadRequest: IDocumentUploadRequest = {
        filePath: '/path/to/file.pdf',
        metadata
      };

      const uploadResponse: IDocumentUploadResponse = {
        documentId: 'test-id',
        status: 'uploaded' as any,
        message: 'Success'
      };

      const statusResponse: IDocumentStatusResponse = {
        documentId: 'test-id',
        status: 'uploaded' as any,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(metadata).toBeDefined();
      expect(uploadRequest).toBeDefined();
      expect(uploadResponse).toBeDefined();
      expect(statusResponse).toBeDefined();
    });
  });

  describe('Use Case Exports', () => {
    it('should export UploadDocumentUseCase', () => {
      expect(UploadDocumentUseCase).toBeDefined();
      expect(typeof UploadDocumentUseCase).toBe('function');
    });

    it('should export GetDocumentStatusUseCase', () => {
      expect(GetDocumentStatusUseCase).toBeDefined();
      expect(typeof GetDocumentStatusUseCase).toBe('function');
    });

    it('should export GetDocumentsUseCase', () => {
      expect(GetDocumentsUseCase).toBeDefined();
      expect(typeof GetDocumentsUseCase).toBe('function');
    });
  });

  describe('Integration', () => {
    it('should allow use cases to work with service interfaces', () => {
      // This test ensures that the exported types work together
      const uploadUseCase = new UploadDocumentUseCase();
      const getStatusUseCase = new GetDocumentStatusUseCase();
      const getDocumentsUseCase = new GetDocumentsUseCase();

      expect(uploadUseCase).toBeInstanceOf(UploadDocumentUseCase);
      expect(getStatusUseCase).toBeInstanceOf(GetDocumentStatusUseCase);
      expect(getDocumentsUseCase).toBeInstanceOf(GetDocumentsUseCase);
    });
  });
});
