/**
 * Document Aggregate Root
 * 
 * Simple, focused aggregate representing a document in the processing pipeline.
 * Follows meaningful DDD principles without unnecessary complexity.
 */

import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';

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
 * Simple Document aggregate root for the interview challenge
 * Focuses on core business logic without unnecessary complexity
 */
export class Document {
  private readonly documentId: string;
  private readonly documentFilePath: string;
  private readonly documentMetadata: IDocumentMetadata;
  private documentStatus: DocumentStatus;
  private documentOcrResult?: IOCRResult;
  private documentValidationResult?: IValidationResult;
  private readonly documentCreatedAt: Date;
  private documentUpdatedAt: Date;

  constructor(
    id: string,
    filePath: string,
    metadata: IDocumentMetadata,
    status: DocumentStatus = DocumentStatus.UPLOADED,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    this.documentId = id;
    this.documentFilePath = filePath;
    this.documentMetadata = metadata;
    this.documentStatus = status;
    this.documentCreatedAt = createdAt ?? new Date();
    this.documentUpdatedAt = updatedAt ?? new Date();
  }

  // Getters
  public get id(): string {
    return this.documentId;
  }

  public get filePath(): string {
    return this.documentFilePath;
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

  public get createdAt(): Date {
    return this.documentCreatedAt;
  }

  public get updatedAt(): Date {
    return this.documentUpdatedAt;
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
    this.documentUpdatedAt = new Date();
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
    this.documentUpdatedAt = new Date();
  }

  /**
   * Fail OCR processing
   */
  public failOCRProcessing(): void {
    if (this.documentStatus !== DocumentStatus.PROCESSING_OCR) {
      throw new Error(`Cannot fail OCR processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.OCR_FAILED;
    this.documentUpdatedAt = new Date();
  }

  public markAsFailed(): void {
    this.documentStatus = DocumentStatus.FAILED;
    this.documentUpdatedAt = new Date();
  }

  /**
   * Start validation processing
   */
  public startValidationProcessing(): void {
    if (this.documentStatus !== DocumentStatus.OCR_COMPLETED) {
      throw new Error(`Cannot start validation processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.PROCESSING_VALIDATION;
    this.documentUpdatedAt = new Date();
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
    this.documentUpdatedAt = new Date();
  }

  /**
   * Fail validation processing
   */
  public failValidationProcessing(): void {
    if (this.documentStatus !== DocumentStatus.PROCESSING_VALIDATION) {
      throw new Error(`Cannot fail validation processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.VALIDATION_FAILED;
    this.documentUpdatedAt = new Date();
  }

  /**
   * Start persistence processing
   */
  public startPersistenceProcessing(): void {
    if (this.documentStatus !== DocumentStatus.VALIDATION_COMPLETED) {
      throw new Error(`Cannot start persistence processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.PROCESSING_PERSISTENCE;
    this.documentUpdatedAt = new Date();
  }

  /**
   * Complete persistence processing
   */
  public completePersistenceProcessing(): void {
    if (this.documentStatus !== DocumentStatus.PROCESSING_PERSISTENCE) {
      throw new Error(`Cannot complete persistence processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.COMPLETED;
    this.documentUpdatedAt = new Date();
  }

  /**
   * Fail persistence processing
   */
  public failPersistenceProcessing(): void {
    if (this.documentStatus !== DocumentStatus.PROCESSING_PERSISTENCE) {
      throw new Error(`Cannot fail persistence processing. Current status: ${this.documentStatus}`);
    }
    this.documentStatus = DocumentStatus.PERSISTENCE_FAILED;
    this.documentUpdatedAt = new Date();
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
      id: this.documentId,
      filePath: this.documentFilePath,
      metadata: { ...this.documentMetadata },
      status: this.documentStatus,
      ocrResult: this.documentOcrResult ? { ...this.documentOcrResult } : undefined,
      validationResult: this.documentValidationResult ? { 
        ...this.documentValidationResult, 
        errors: [...this.documentValidationResult.errors] 
      } : undefined,
      createdAt: new Date(this.documentCreatedAt),
      updatedAt: new Date(this.documentUpdatedAt)
    };
  }
}
