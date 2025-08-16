import { DocumentService, IDocumentUploadRequest, IDocumentUploadResponse } from '@document-processing/application/services/DocumentService';

/**
 * Use case for uploading and starting document processing
 */
export class UploadDocumentUseCase {
  private readonly documentService: DocumentService;

  constructor(documentService?: DocumentService) {
    this.documentService = documentService ?? DocumentService.getInstance();
  }

  /**
   * Execute the upload document use case
   */
  public async execute(request: IDocumentUploadRequest): Promise<IDocumentUploadResponse> {
    // Validate input
    this.validateRequest(request);

    // Execute upload through document service
    return await this.documentService.uploadDocument(request);
  }

  private validateRequest(request: IDocumentUploadRequest): void {
    if (!request.filePath) {
      throw new Error('File path is required');
    }

    if (!request.metadata.fileName) {
      throw new Error('File name is required');
    }

    if (!request.metadata.mimeType) {
      throw new Error('MIME type is required');
    }

    if (request.metadata.fileSize <= 0) {
      throw new Error('File size must be greater than 0');
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];

    if (!allowedMimeTypes.includes(request.metadata.mimeType)) {
      throw new Error(`Unsupported file type: ${request.metadata.mimeType}`);
    }

    // Validate file size (max 10MB)
    const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
    if (request.metadata.fileSize > maxFileSize) {
      throw new Error('File size exceeds maximum limit of 10MB');
    }
  }
}
