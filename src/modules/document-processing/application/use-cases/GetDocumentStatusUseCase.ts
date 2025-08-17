import { DocumentService, IDocumentStatusResponse } from '@document-processing/application/services/DocumentService';
import { IUseCase } from '@shared/domain/types/common';

/**
 * Use case for retrieving document status and details
 * Implements shared IUseCase interface
 */
export class GetDocumentStatusUseCase implements IUseCase<string, IDocumentStatusResponse> {
  private readonly documentService: DocumentService;

  constructor(documentService?: DocumentService) {
    this.documentService = documentService ?? DocumentService.getInstance();
  }

  /**
   * Execute the get document status use case
   */
  public async execute(documentId: string): Promise<IDocumentStatusResponse> {
    // Validate input
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Valid document ID is required');
    }

    if (documentId.trim().length === 0) {
      throw new Error('Document ID cannot be empty');
    }

    // Execute through document service
    return await this.documentService.getDocumentStatus(documentId);
  }
}
