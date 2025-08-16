import { v4 as uuidv4 } from 'uuid';

import { Document, DocumentStatus } from '@document-processing/domain';
import { MongoDocumentRepository, IDocumentRepository } from '@document-processing/infrastructure/database';
import { DocumentQueue } from '@document-processing/infrastructure/queue/DocumentQueue';

export interface IDocumentMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface IDocumentUploadRequest {
  filePath: string;
  metadata: IDocumentMetadata;
}

export interface IDocumentUploadResponse {
  documentId: string;
  status: DocumentStatus;
  message: string;
}

export interface IDocumentStatusResponse {
  documentId: string;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
  ocrResult?: unknown;
  validationResult?: unknown;
}

/**
 * Application service for document processing operations
 * Orchestrates business logic between domain and infrastructure layers
 */
export class DocumentService {
  private static instance: DocumentService | undefined;
  private readonly documentQueue: DocumentQueue;
  private readonly documentRepository: IDocumentRepository;

  private constructor() {
    this.documentQueue = DocumentQueue.getInstance();
    this.documentRepository = new MongoDocumentRepository();
  }

  public static getInstance(): DocumentService {
    if (!DocumentService.instance) {
      DocumentService.instance = new DocumentService();
    }
    return DocumentService.instance;
  }

  /**
   * Upload and start processing a document
   */
  public async uploadDocument(request: IDocumentUploadRequest): Promise<IDocumentUploadResponse> {
    try {
      // Generate unique document ID
      const documentId = uuidv4();

      // Create document entity
      const document = new Document(
        documentId,
        request.filePath,
        request.metadata,
        DocumentStatus.UPLOADED
      );

      // Store document in database
      await this.documentRepository.save(document);

      // Start processing by adding OCR job to queue
      await this.documentQueue.addOCRJob(documentId, request.filePath);

      return {
        documentId,
        status: document.status,
        message: 'Document uploaded successfully and processing started'
      };
    } catch (error) {
      throw new Error(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document status and details
   */
  public async getDocumentStatus(documentId: string): Promise<IDocumentStatusResponse> {
    const document = await this.documentRepository.findById(documentId);
    
    if (document === null) {
      throw new Error(`Document with ID ${documentId} not found`);
    }

    return {
      documentId: document.id,
      status: document.status,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      ocrResult: document.ocrResult,
      validationResult: document.validationResult
    };
  }

  /**
   * Get all documents with optional status filter
   */
  public async getDocuments(status?: DocumentStatus): Promise<Document[]> {
    if (status === undefined) {
      return await this.documentRepository.findAll();
    }
    
    return await this.documentRepository.findByStatus(status);
  }

  /**
   * Cancel document processing
   */
  public async cancelDocument(documentId: string): Promise<void> {
    const document = await this.documentRepository.findById(documentId);
    
    if (document === null) {
      throw new Error(`Document with ID ${documentId} not found`);
    }

    // Cancel processing jobs in queue
    await this.documentQueue.cancelJob(documentId);
    
    // Update document status to cancelled
    document.markAsFailed();
    
    await this.documentRepository.update(document);
  }

  /**
   * Retry failed document processing
   */
  public async retryDocument(documentId: string): Promise<void> {
    const document = await this.documentRepository.findById(documentId);
    
    if (document === null) {
      throw new Error(`Document with ID ${documentId} not found`);
    }

    if (!document.hasFailed() && document.status !== DocumentStatus.FAILED) {
      throw new Error('Can only retry failed documents');
    }

    // Create new document instance with UPLOADED status to restart processing
    const newDocument = new Document(
      document.id,
      document.filePath,
      document.metadata,
      DocumentStatus.UPLOADED
    );

    // Update stored document
    await this.documentRepository.update(newDocument);

    // Restart processing
    await this.documentQueue.addOCRJob(documentId, document.filePath);
  }

  /**
   * Get processing statistics
   */
  public async getStatistics(): Promise<{
    total: number;
    byStatus: Record<DocumentStatus, number>;
  }> {
    return await this.documentRepository.getStatistics();
  }

  /**
   * Update document after processing step
   */
  public async updateDocument(document: Document): Promise<void> {
    await this.documentRepository.update(document);
  }

  /**
   * Find document by ID (returns domain entity)
   */
  public async findById(documentId: string): Promise<Document | null> {
    return await this.documentRepository.findById(documentId);
  }

  /**
   * Clear all documents (for testing)
   */
  public clearDocuments(): void {
    // Note: This is for testing only - in production, use proper database cleanup
  }
}
