/**
 * Document Aggregate Root
 * 
 * Simple, focused aggregate representing a document in the processing pipeline.
 * Follows meaningful DDD principles without unnecessary complexity.
 */

import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';
import { AggregateRoot } from '@shared/domain/base/AggregateRoot';

/**
 * Document metadata interface
 */
export interface IDocumentMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

/**
 * OCR result interface
 */
export interface IOCRResult {
  extractedText: string;
  confidence: number;
  extractedAt: Date;
}

/**
 * Validation result interface
 */
export interface IValidationResult {
  isValid: boolean;
  errors: string[];
  validatedAt: Date;
}

/**
 * Document entity class extending AggregateRoot for proper DDD implementation
 * Focuses on core business logic with event sourcing capabilities
 */
export class Document extends AggregateRoot {
  private readonly documentFilePath: string;
  private readonly documentMetadata: IDocumentMetadata;
  private documentStatus: DocumentStatus;
  private documentOcrResult?: IOCRResult;
  private documentValidationResult?: IValidationResult;

  constructor(
    id: string,
    filePath: string,
    metadata: IDocumentMetadata,
    status: DocumentStatus = DocumentStatus.UPLOADED,
    createdAt?: Date,
    updatedAt?: Date,
    version?: number
  ) {
    super(id, createdAt, updatedAt, version);
    this.documentFilePath = filePath;
    this.documentMetadata = metadata;
    this.documentStatus = status;
    
    // Emit domain event for document creation
    if (!createdAt) {
      this.addDomainEvent(
        this.createDomainEvent('DocumentCreated', {
          documentId: this.id,
          fileName: metadata.fileName,
          fileSize: metadata.fileSize,
          mimeType: metadata.mimeType,
          status: status
        })
      );
    }
  }

  // Getters
  public get filePath(): string {
    return this.documentFilePath;
  }

  /**
   * Update file path after moving to permanent storage
   */
  public updateFilePath(newPath: string): void {
    if (this.documentStatus !== DocumentStatus.PROCESSING_PERSISTENCE) {
      throw new Error(`Cannot update file path. Current status: ${this.documentStatus}`);
    }
    // Use Object.defineProperty to update readonly property
    Object.defineProperty(this, 'documentFilePath', {
      value: newPath,
      writable: false,
      enumerable: true,
      configurable: false
    });
    this.updatedAt = new Date();
  }

  public get metadata(): IDocumentMetadata {
    return { ...this.documentMetadata };
  }

  public get status(): DocumentStatus {
    return this.documentStatus;
  }

  public get ocrResult(): IOCRResult | undefined {
    return this.documentOcrResult ? { ...this.documentOcrResult } : undefined;
  }

  public get validationResult(): IValidationResult | undefined {
    return this.documentValidationResult ? { 
      ...this.documentValidationResult,
      errors: [...this.documentValidationResult.errors]
    } : undefined;
  }

  // Business logic methods

  /**
   * Start OCR processing
   */
  public startOCRProcessing(): void {
    if (this.documentStatus !== DocumentStatus.UPLOADED) {
      throw new Error(`Cannot start OCR processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.PROCESSING_OCR;
    this.updatedAt = new Date();
  }

  /**
   * Complete OCR processing
   */
  public completeOCRProcessing(ocrResult: IOCRResult): void {
    if (this.documentStatus !== DocumentStatus.PROCESSING_OCR) {
      throw new Error(`Cannot complete OCR processing. Current status: ${this.documentStatus}`);
    }
    this.documentOcrResult = { ...ocrResult };
    this.documentStatus = DocumentStatus.OCR_COMPLETED;
    this.updatedAt = new Date();
  }

  /**
   * Fail OCR processing
   */
  public failOCRProcessing(): void {
    if (this.documentStatus !== DocumentStatus.PROCESSING_OCR) {
      throw new Error(`Cannot fail OCR processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.OCR_FAILED;
    this.updatedAt = new Date();
  }

  public markAsFailed(): void {
    this.documentStatus = DocumentStatus.FAILED;
    this.updatedAt = new Date();
  }

  public markAsCancelled(): void {
    this.documentStatus = DocumentStatus.CANCELLED;
    this.updatedAt = new Date();
  }

  /**
   * Start validation processing
   */
  public startValidationProcessing(): void {
    if (this.documentStatus !== DocumentStatus.OCR_COMPLETED) {
      throw new Error(`Cannot start validation processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.PROCESSING_VALIDATION;
    this.updatedAt = new Date();
  }

  /**
   * Complete validation processing
   */
  public completeValidationProcessing(validationResult: IValidationResult): void {
    if (this.documentStatus !== DocumentStatus.PROCESSING_VALIDATION) {
      throw new Error(`Cannot complete validation processing. Current status: ${this.documentStatus}`);
    }
    this.documentValidationResult = { 
      ...validationResult, 
      errors: [...validationResult.errors] 
    };
    this.documentStatus = DocumentStatus.VALIDATION_COMPLETED;
    this.updatedAt = new Date();
  }

  /**
   * Fail validation processing
   */
  public failValidationProcessing(): void {
    if (this.documentStatus !== DocumentStatus.PROCESSING_VALIDATION) {
      throw new Error(`Cannot fail validation processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.VALIDATION_FAILED;
    this.updatedAt = new Date();
  }

  /**
   * Start persistence processing
   */
  public startPersistenceProcessing(): void {
    if (this.documentStatus !== DocumentStatus.VALIDATION_COMPLETED && 
        this.documentStatus !== DocumentStatus.PERSISTENCE_FAILED) {
      throw new Error(`Cannot start persistence processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.PROCESSING_PERSISTENCE;
    this.updatedAt = new Date();
  }

  /**
   * Complete persistence processing
   */
  public completePersistenceProcessing(): void {
    if (this.documentStatus !== DocumentStatus.PROCESSING_PERSISTENCE) {
      throw new Error(`Cannot complete persistence processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.COMPLETED;
    this.updatedAt = new Date();
  }

  /**
   * Fail persistence processing
   */
  public failPersistenceProcessing(): void {
    if (this.documentStatus !== DocumentStatus.PROCESSING_PERSISTENCE) {
      throw new Error(`Cannot fail persistence processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.PERSISTENCE_FAILED;
    this.updatedAt = new Date();
  }

  // Utility methods

  /**
   * Check if document processing is completed
   */
  public isCompleted(): boolean {
    return this.documentStatus === DocumentStatus.COMPLETED;
  }

  /**
   * Check if document processing has failed
   */
  public hasFailed(): boolean {
    return [
      DocumentStatus.OCR_FAILED,
      DocumentStatus.VALIDATION_FAILED,
      DocumentStatus.PERSISTENCE_FAILED
    ].includes(this.documentStatus);
  }

  /**
   * Get document data for persistence
   */
  public toPersistenceData(): {
    id: string;
    filePath: string;
    metadata: IDocumentMetadata;
    status: DocumentStatus;
    ocrResult: IOCRResult | undefined;
    validationResult: IValidationResult | undefined;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      filePath: this.documentFilePath,
      metadata: { ...this.documentMetadata },
      status: this.documentStatus,
      ocrResult: this.documentOcrResult ? { ...this.documentOcrResult } : undefined,
      validationResult: this.documentValidationResult ? { 
        ...this.documentValidationResult, 
        errors: [...this.documentValidationResult.errors] 
      } : undefined,
      createdAt: new Date(this.createdAt),
      updatedAt: new Date(this.updatedAt)
    };
  }
}
