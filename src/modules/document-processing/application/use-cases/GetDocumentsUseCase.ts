import { DocumentService } from '@document-processing/application/services/DocumentService';
import { DocumentStatus } from '@document-processing/domain';
import { Document } from '@document-processing/domain/entities/Document';

/**
 * Use case for retrieving multiple documents with optional filtering
 */
export class GetDocumentsUseCase {
  private readonly documentService: DocumentService;

  constructor(documentService?: DocumentService) {
    this.documentService = documentService ?? DocumentService.getInstance();
  }

  /**
   * Execute the get documents use case
   */
  public async execute(status?: DocumentStatus): Promise<Document[]> {
    return await this.documentService.getDocuments(status);
  }
}
