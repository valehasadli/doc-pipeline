import { DocumentService, IDocumentUploadRequest, IDocumentUploadResponse } from '@document-processing/application/services/DocumentService';
import { IUseCase } from '@shared/domain/types/common';

/**
 * Use case for uploading and starting document processing
 * Implements shared IUseCase interface
 */
export class UploadDocumentUseCase implements IUseCase<IDocumentUploadRequest, IDocumentUploadResponse> {
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
    // Basic required field validation
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

    // Business rule validation (not presentation concerns)
    // File type validation is now handled by multer middleware at presentation layer
    
    // Business rule: File size limit
    const maxSizeBytes = parseInt(process.env['MAX_FILE_SIZE'] ?? '10485760', 10);
    if (request.metadata.fileSize > maxSizeBytes) {
      throw new Error(`File size exceeds maximum allowed size of ${Math.round(maxSizeBytes / 1024 / 1024)}MB`);
    }

    // Business rule: File name length limit
    if (request.metadata.fileName.length > 255) {
      throw new Error('File name too long (maximum 255 characters)');
    }

    // Note: Empty file check is redundant with fileSize <= 0 check above
  }
}
