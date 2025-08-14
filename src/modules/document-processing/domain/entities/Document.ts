/**
 * Document Aggregate Root
 * 
 * The main business entity representing a document in the processing pipeline.
 * Encapsulates all business logic related to document lifecycle, status transitions,
 * and event generation.
 */

import {
  DocumentStatus,
  ProcessingStatus,
  DocumentEventFactory,
  DomainEvent,
  EventPublisher,
} from '../index';

/**
 * Document metadata interface
 */
export interface DocumentMetadata {
  readonly originalName: string;
  readonly size: number;
  readonly mimeType: string;
  readonly uploadedAt: Date;
  readonly uploadedBy?: string;
  readonly checksum?: string;
  readonly tags?: string[];
}

/**
 * OCR result interface
 */
export interface OCRResult {
  readonly text: string;
  readonly confidence: number;
  readonly language: string;
  readonly extractedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly validatedAt: Date;
  readonly validationRules?: string[];
}

/**
 * Persistence result interface
 */
export interface PersistenceResult {
  readonly persistedAt: Date;
  readonly storageLocation: string;
  readonly backupLocation?: string;
  readonly indexedAt?: Date;
}

/**
 * Document aggregate root
 */
export class Document {
  private _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly _id: string,
    private readonly _filePath: string,
    private readonly _metadata: DocumentMetadata,
    private _processingStatus: ProcessingStatus,
    private _ocrResult?: OCRResult,
    private _validationResult?: ValidationResult,
    private _persistenceResult?: PersistenceResult,
    private readonly _createdAt: Date = new Date(),
    private _updatedAt: Date = new Date()
  ) {}

  /**
   * Create a new document
   */
  public static create(
    id: string,
    filePath: string,
    metadata: DocumentMetadata
  ): Document {
    const document = new Document(
      id,
      filePath,
      metadata,
      ProcessingStatus.create(DocumentStatus.UPLOADED)
    );

    // Raise domain event
    const uploadedEvent = DocumentEventFactory.createDocumentUploadedEvent(
      id,
      {
        documentId: id,
        originalName: metadata.originalName,
        filePath,
        size: metadata.size,
        mimeType: metadata.mimeType,
        ...(metadata.uploadedBy && { uploadedBy: metadata.uploadedBy }),
        uploadedAt: metadata.uploadedAt,
      }
    );

    document.addDomainEvent(uploadedEvent);
    return document;
  }

  /**
   * Reconstitute document from persistence
   */
  public static fromData(data: {
    id: string;
    filePath: string;
    metadata: DocumentMetadata;
    processingStatus: ProcessingStatus;
    ocrResult?: OCRResult;
    validationResult?: ValidationResult;
    persistenceResult?: PersistenceResult;
    createdAt: Date;
    updatedAt: Date;
  }): Document {
    return new Document(
      data.id,
      data.filePath,
      data.metadata,
      data.processingStatus,
      data.ocrResult,
      data.validationResult,
      data.persistenceResult,
      data.createdAt,
      data.updatedAt
    );
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get filePath(): string {
    return this._filePath;
  }

  public get metadata(): DocumentMetadata {
    return this._metadata;
  }

  public get processingStatus(): ProcessingStatus {
    return this._processingStatus;
  }

  public get currentStatus(): DocumentStatus {
    return this._processingStatus.currentStatus;
  }

  public get ocrResult(): OCRResult | undefined {
    return this._ocrResult;
  }

  public get validationResult(): ValidationResult | undefined {
    return this._validationResult;
  }

  public get persistenceResult(): PersistenceResult | undefined {
    return this._persistenceResult;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get domainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }

  // Business methods

  /**
   * Queue document for processing
   */
  public queueForProcessing(reason?: string): void {
    this.transitionStatus(DocumentStatus.QUEUED, reason);
  }

  /**
   * Start OCR processing
   */
  public startOCRProcessing(jobId: string): void {
    this.transitionStatus(
      DocumentStatus.PROCESSING_OCR, 
      'OCR processing started',
      { jobId }
    );

    const event = DocumentEventFactory.createDocumentProcessingStartedEvent(
      this._id,
      {
        documentId: this._id,
        stage: 'ocr',
        jobId,
        attemptNumber: this._processingStatus.retryCount + 1,
        startedAt: new Date(),
      }
    );

    this.addDomainEvent(event);
  }

  /**
   * Complete OCR processing
   */
  public completeOCRProcessing(ocrResult: OCRResult, jobId: string): void {
    this._ocrResult = ocrResult;
    this.transitionStatus(
      DocumentStatus.OCR_COMPLETED,
      'OCR processing completed',
      { jobId, confidence: ocrResult.confidence }
    );

    const processingDuration = this._processingStatus.getProcessingDuration() || 0;

    const completedEvent = DocumentEventFactory.createDocumentProcessingCompletedEvent(
      this._id,
      {
        documentId: this._id,
        stage: 'ocr',
        jobId,
        completedAt: new Date(),
        processingDuration,
        result: { confidence: ocrResult.confidence, textLength: ocrResult.text.length },
      }
    );

    const ocrEvent = DocumentEventFactory.createDocumentOCRCompletedEvent(
      this._id,
      {
        documentId: this._id,
        ocrResult,
        processingDuration,
      }
    );

    this.addDomainEvent(completedEvent);
    this.addDomainEvent(ocrEvent);
  }

  /**
   * Fail OCR processing
   */
  public failOCRProcessing(error: string, jobId: string, willRetry: boolean = false): void {
    this._processingStatus = this._processingStatus.withError(error);
    
    if (willRetry) {
      this._processingStatus = this._processingStatus.incrementRetryCount();
    } else {
      this.transitionStatus(DocumentStatus.OCR_FAILED, 'OCR processing failed', { jobId, error });
    }

    const event = DocumentEventFactory.createDocumentProcessingFailedEvent(
      this._id,
      {
        documentId: this._id,
        stage: 'ocr',
        jobId,
        failedAt: new Date(),
        error: {
          type: 'OCR_ERROR',
          message: error,
          retryable: willRetry,
        },
        attemptNumber: this._processingStatus.retryCount,
        willRetry,
      }
    );

    this.addDomainEvent(event);
  }

  /**
   * Start validation processing
   */
  public startValidationProcessing(jobId: string): void {
    this.transitionStatus(
      DocumentStatus.PROCESSING_VALIDATION,
      'Validation processing started',
      { jobId }
    );

    const event = DocumentEventFactory.createDocumentProcessingStartedEvent(
      this._id,
      {
        documentId: this._id,
        stage: 'validation',
        jobId,
        attemptNumber: this._processingStatus.retryCount + 1,
        startedAt: new Date(),
      }
    );

    this.addDomainEvent(event);
  }

  /**
   * Complete validation processing
   */
  public completeValidationProcessing(validationResult: ValidationResult, jobId: string): void {
    this._validationResult = validationResult;
    this.transitionStatus(
      DocumentStatus.VALIDATION_COMPLETED,
      'Validation processing completed',
      { jobId, isValid: validationResult.isValid }
    );

    const processingDuration = this._processingStatus.getProcessingDuration() || 0;

    const completedEvent = DocumentEventFactory.createDocumentProcessingCompletedEvent(
      this._id,
      {
        documentId: this._id,
        stage: 'validation',
        jobId,
        completedAt: new Date(),
        processingDuration,
        result: { 
          isValid: validationResult.isValid, 
          errorCount: validationResult.errors.length,
          warningCount: validationResult.warnings.length 
        },
      }
    );

    const validationEvent = DocumentEventFactory.createDocumentValidationCompletedEvent(
      this._id,
      {
        documentId: this._id,
        validationResult,
        processingDuration,
      }
    );

    this.addDomainEvent(completedEvent);
    this.addDomainEvent(validationEvent);
  }

  /**
   * Fail validation processing
   */
  public failValidationProcessing(error: string, jobId: string, willRetry: boolean = false): void {
    this._processingStatus = this._processingStatus.withError(error);
    
    if (willRetry) {
      this._processingStatus = this._processingStatus.incrementRetryCount();
    } else {
      this.transitionStatus(DocumentStatus.VALIDATION_FAILED, 'Validation processing failed', { jobId, error });
    }

    const event = DocumentEventFactory.createDocumentProcessingFailedEvent(
      this._id,
      {
        documentId: this._id,
        stage: 'validation',
        jobId,
        failedAt: new Date(),
        error: {
          type: 'VALIDATION_ERROR',
          message: error,
          retryable: willRetry,
        },
        attemptNumber: this._processingStatus.retryCount,
        willRetry,
      }
    );

    this.addDomainEvent(event);
  }

  /**
   * Start persistence processing
   */
  public startPersistenceProcessing(jobId: string): void {
    this.transitionStatus(
      DocumentStatus.PROCESSING_PERSISTENCE,
      'Persistence processing started',
      { jobId }
    );

    const event = DocumentEventFactory.createDocumentProcessingStartedEvent(
      this._id,
      {
        documentId: this._id,
        stage: 'persistence',
        jobId,
        attemptNumber: this._processingStatus.retryCount + 1,
        startedAt: new Date(),
      }
    );

    this.addDomainEvent(event);
  }

  /**
   * Complete persistence processing and mark document as fully processed
   */
  public completePersistenceProcessing(persistenceResult: PersistenceResult, jobId: string): void {
    this._persistenceResult = persistenceResult;
    this.transitionStatus(
      DocumentStatus.COMPLETED,
      'Document processing completed',
      { jobId }
    );

    const totalProcessingDuration = this._processingStatus.getProcessingDuration() || 0;

    const completedEvent = DocumentEventFactory.createDocumentProcessingCompletedEvent(
      this._id,
      {
        documentId: this._id,
        stage: 'persistence',
        jobId,
        completedAt: new Date(),
        processingDuration: totalProcessingDuration,
        result: { storageLocation: persistenceResult.storageLocation },
      }
    );

    // Create fully processed event with stage breakdown
    const fullyProcessedEvent = DocumentEventFactory.createDocumentFullyProcessedEvent(
      this._id,
      {
        documentId: this._id,
        completedAt: new Date(),
        totalProcessingDuration,
        finalStatus: DocumentStatus.COMPLETED,
        stages: {
          ocr: { 
            duration: 0, // Would need to track individual stage durations
            completedAt: this._ocrResult?.extractedAt || new Date() 
          },
          validation: { 
            duration: 0,
            completedAt: this._validationResult?.validatedAt || new Date() 
          },
          persistence: { 
            duration: 0,
            completedAt: persistenceResult.persistedAt 
          },
        },
      }
    );

    this.addDomainEvent(completedEvent);
    this.addDomainEvent(fullyProcessedEvent);
  }

  /**
   * Fail persistence processing
   */
  public failPersistenceProcessing(error: string, jobId: string, willRetry: boolean = false): void {
    this._processingStatus = this._processingStatus.withError(error);
    
    if (willRetry) {
      this._processingStatus = this._processingStatus.incrementRetryCount();
    } else {
      this.transitionStatus(DocumentStatus.PERSISTENCE_FAILED, 'Persistence processing failed', { jobId, error });
    }

    const event = DocumentEventFactory.createDocumentProcessingFailedEvent(
      this._id,
      {
        documentId: this._id,
        stage: 'persistence',
        jobId,
        failedAt: new Date(),
        error: {
          type: 'PERSISTENCE_ERROR',
          message: error,
          retryable: willRetry,
        },
        attemptNumber: this._processingStatus.retryCount,
        willRetry,
      }
    );

    this.addDomainEvent(event);
  }

  /**
   * Move document to dead letter queue
   */
  public moveToDLQ(originalJobId: string, stage: 'ocr' | 'validation' | 'persistence', finalError: string): void {
    this.transitionStatus(DocumentStatus.DEAD_LETTER, 'Moved to dead letter queue');

    const event = DocumentEventFactory.createDocumentMovedToDLQEvent(
      this._id,
      {
        documentId: this._id,
        originalJobId,
        stage,
        finalError: {
          type: `${stage.toUpperCase()}_ERROR`,
          message: finalError,
          timestamp: new Date(),
        },
        totalAttempts: this._processingStatus.retryCount,
        movedAt: new Date(),
      }
    );

    this.addDomainEvent(event);
  }

  /**
   * Retry processing from a specific stage
   */
  public retryProcessing(stage: 'ocr' | 'validation' | 'persistence', reason: string): void {
    // Reset to appropriate status for retry
    let targetStatus: DocumentStatus;
    switch (stage) {
      case 'ocr':
        targetStatus = DocumentStatus.QUEUED;
        break;
      case 'validation':
        targetStatus = DocumentStatus.OCR_COMPLETED;
        break;
      case 'persistence':
        targetStatus = DocumentStatus.VALIDATION_COMPLETED;
        break;
    }

    this.transitionStatus(targetStatus, `Retry ${stage} processing: ${reason}`);

    const event = DocumentEventFactory.createDocumentRetryAttemptedEvent(
      this._id,
      {
        documentId: this._id,
        stage,
        attemptNumber: this._processingStatus.retryCount + 1,
        previousError: this._processingStatus.errorDetails || 'Unknown error',
        retryReason: reason,
        scheduledAt: new Date(),
      }
    );

    this.addDomainEvent(event);
  }

  // Status checks
  public isProcessing(): boolean {
    return this._processingStatus.isProcessing();
  }

  public isCompleted(): boolean {
    return this._processingStatus.isCompleted();
  }

  public isFailed(): boolean {
    return this._processingStatus.isFailed();
  }

  public hasOCRResult(): boolean {
    return this._ocrResult !== undefined;
  }

  public hasValidationResult(): boolean {
    return this._validationResult !== undefined;
  }

  public hasPersistenceResult(): boolean {
    return this._persistenceResult !== undefined;
  }

  // Event management
  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  public async publishEvents(eventPublisher: EventPublisher): Promise<void> {
    if (this._domainEvents.length > 0) {
      await eventPublisher.publishBatch(this._domainEvents);
      this.clearDomainEvents();
    }
  }

  // Private methods
  public markAsCompleted(persistenceResult: PersistenceResult): void {
    const oldStatus = this._processingStatus.currentStatus;
    this._processingStatus = this._processingStatus.transitionTo(
      DocumentStatus.COMPLETED,
      'Document fully processed'
    );
    this._persistenceResult = persistenceResult;
    this._updatedAt = new Date();

    // Calculate total processing duration
    const totalDuration = this._processingStatus.getProcessingDuration();

    const statusChangedEvent = DocumentEventFactory.createDocumentStatusChangedEvent(
      this._id,
      {
        documentId: this._id,
        fromStatus: oldStatus,
        toStatus: DocumentStatus.COMPLETED,
        reason: 'Document fully processed',
        processingStage: 'persistence',
        retryCount: this._processingStatus.retryCount,
        processingDuration: totalDuration || 0,
      }
    );

    this.addDomainEvent(statusChangedEvent);
  }

  private transitionStatus(
    newStatus: DocumentStatus,
    reason?: string,
    metadata?: Record<string, unknown>
  ): void {
    const oldStatus = this._processingStatus.currentStatus;
    this._processingStatus = this._processingStatus.transitionTo(newStatus, reason, metadata);
    this._updatedAt = new Date();

    // Always raise status changed event
    const processingStage = this.getProcessingStage(newStatus);
    const statusChangedEvent = DocumentEventFactory.createDocumentStatusChangedEvent(
      this._id,
      {
        documentId: this._id,
        fromStatus: oldStatus,
        toStatus: newStatus,
        reason: reason || 'Unknown reason',
        ...(processingStage && { processingStage }),
        retryCount: this._processingStatus.retryCount,
        processingDuration: this._processingStatus.getProcessingDuration() || 0,
      }
    );

    this.addDomainEvent(statusChangedEvent);
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  private getProcessingStage(status: DocumentStatus): string | undefined {
    switch (status) {
      case DocumentStatus.PROCESSING_OCR:
      case DocumentStatus.OCR_COMPLETED:
      case DocumentStatus.OCR_FAILED:
        return 'ocr';
      case DocumentStatus.PROCESSING_VALIDATION:
      case DocumentStatus.VALIDATION_COMPLETED:
      case DocumentStatus.VALIDATION_FAILED:
        return 'validation';
      case DocumentStatus.PROCESSING_PERSISTENCE:
      case DocumentStatus.PERSISTENCE_FAILED:
        return 'persistence';
      case DocumentStatus.COMPLETED:
        return 'completed';
      default:
        return undefined;
    }
  }

  // Serialization
  public toJSON(): {
    id: string;
    filePath: string;
    metadata: DocumentMetadata;
    processingStatus: ReturnType<ProcessingStatus['toJSON']>;
    ocrResult?: OCRResult;
    validationResult?: ValidationResult;
    persistenceResult?: PersistenceResult;
    createdAt: string;
    updatedAt: string;
  } {
    const result: {
      id: string;
      filePath: string;
      metadata: DocumentMetadata;
      processingStatus: ReturnType<ProcessingStatus['toJSON']>;
      ocrResult?: OCRResult;
      validationResult?: ValidationResult;
      persistenceResult?: PersistenceResult;
      createdAt: string;
      updatedAt: string;
    } = {
      id: this._id,
      filePath: this._filePath,
      metadata: this._metadata,
      processingStatus: this._processingStatus.toJSON(),
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };

    if (this._ocrResult) {
      result.ocrResult = this._ocrResult;
    }
    if (this._validationResult) {
      result.validationResult = this._validationResult;
    }
    if (this._persistenceResult) {
      result.persistenceResult = this._persistenceResult;
    }

    return result;
  }
}
