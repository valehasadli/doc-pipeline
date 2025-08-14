/**
 * Document Domain Events
 * 
 * Events that are raised when significant changes occur to documents
 * during the processing pipeline. These events can be used for
 * notifications, auditing, and triggering side effects.
 */

import { DocumentStatus } from '../enums/DocumentStatus';

/**
 * Base domain event interface
 */
export interface IDomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventVersion: number;
  readonly occurredAt: Date;
  readonly metadata?: Record<string, unknown>;
}



/**
 * Document uploaded event
 */
export interface IDocumentUploadedEvent extends IDomainEvent {
  readonly eventType: 'DocumentUploaded';
  readonly payload: {
    readonly documentId: string;
    readonly originalName: string;
    readonly filePath: string;
    readonly size: number;
    readonly mimeType: string;
    readonly uploadedBy?: string;
    readonly uploadedAt: Date;
  };
}

/**
 * Document status changed event
 */
export interface IDocumentStatusChangedEvent extends IDomainEvent {
  readonly eventType: 'DocumentStatusChanged';
  readonly payload: {
    readonly documentId: string;
    readonly fromStatus: DocumentStatus | null;
    readonly toStatus: DocumentStatus;
    readonly reason?: string;
    readonly processingStage?: string;
    readonly retryCount: number;
    readonly processingDuration?: number;
  };
}

/**
 * Document processing started event
 */
export interface IDocumentProcessingStartedEvent extends IDomainEvent {
  readonly eventType: 'DocumentProcessingStarted';
  readonly payload: {
    readonly documentId: string;
    readonly stage: 'ocr' | 'validation' | 'persistence';
    readonly jobId: string;
    readonly attemptNumber: number;
    readonly startedAt: Date;
  };
}

/**
 * Document processing completed event
 */
export interface IDocumentProcessingCompletedEvent extends IDomainEvent {
  readonly eventType: 'DocumentProcessingCompleted';
  readonly payload: {
    readonly documentId: string;
    readonly stage: 'ocr' | 'validation' | 'persistence';
    readonly jobId: string;
    readonly completedAt: Date;
    readonly processingDuration: number;
    readonly result?: Record<string, unknown>;
  };
}

/**
 * Document processing failed event
 */
export interface IDocumentProcessingFailedEvent extends IDomainEvent {
  readonly eventType: 'DocumentProcessingFailed';
  readonly payload: {
    readonly documentId: string;
    readonly stage: 'ocr' | 'validation' | 'persistence';
    readonly jobId: string;
    readonly failedAt: Date;
    readonly error: {
      readonly type: string;
      readonly message: string;
      readonly retryable: boolean;
    };
    readonly attemptNumber: number;
    readonly willRetry: boolean;
  };
}

/**
 * Document OCR completed event
 */
export interface IDocumentOCRCompletedEvent extends IDomainEvent {
  readonly eventType: 'DocumentOCRCompleted';
  readonly payload: {
    readonly documentId: string;
    readonly ocrResult: {
      readonly text: string;
      readonly confidence: number;
      readonly language: string;
      readonly extractedAt: Date;
    };
    readonly processingDuration: number;
  };
}

/**
 * Document validation completed event
 */
export interface IDocumentValidationCompletedEvent extends IDomainEvent {
  readonly eventType: 'DocumentValidationCompleted';
  readonly payload: {
    readonly documentId: string;
    readonly validationResult: {
      readonly isValid: boolean;
      readonly errors: string[];
      readonly warnings: string[];
      readonly validatedAt: Date;
    };
    readonly processingDuration: number;
  };
}

/**
 * Document fully processed event
 */
export interface IDocumentFullyProcessedEvent extends IDomainEvent {
  readonly eventType: 'DocumentFullyProcessed';
  readonly payload: {
    readonly documentId: string;
    readonly completedAt: Date;
    readonly totalProcessingDuration: number;
    readonly finalStatus: DocumentStatus.COMPLETED;
    readonly stages: {
      readonly ocr: { duration: number; completedAt: Date };
      readonly validation: { duration: number; completedAt: Date };
      readonly persistence: { duration: number; completedAt: Date };
    };
  };
}

/**
 * Document moved to dead letter queue event
 */
export interface IDocumentMovedToDLQEvent extends IDomainEvent {
  readonly eventType: 'DocumentMovedToDLQ';
  readonly payload: {
    readonly documentId: string;
    readonly originalJobId: string;
    readonly stage: 'ocr' | 'validation' | 'persistence';
    readonly finalError: {
      readonly type: string;
      readonly message: string;
      readonly timestamp: Date;
    };
    readonly totalAttempts: number;
    readonly movedAt: Date;
  };
}

/**
 * Document retry attempted event
 */
export interface IDocumentRetryAttemptedEvent extends IDomainEvent {
  readonly eventType: 'DocumentRetryAttempted';
  readonly payload: {
    readonly documentId: string;
    readonly stage: 'ocr' | 'validation' | 'persistence';
    readonly attemptNumber: number;
    readonly previousError: string;
    readonly retryReason: string;
    readonly scheduledAt: Date;
  };
}

/**
 * Union type of all document events
 */
export type DocumentEvent =
  | IDocumentUploadedEvent
  | IDocumentStatusChangedEvent
  | IDocumentProcessingStartedEvent
  | IDocumentProcessingCompletedEvent
  | IDocumentProcessingFailedEvent
  | IDocumentOCRCompletedEvent
  | IDocumentValidationCompletedEvent
  | IDocumentFullyProcessedEvent
  | IDocumentMovedToDLQEvent
  | IDocumentRetryAttemptedEvent;

/**
 * Event factory functions
 */
export class DocumentEventFactory {
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public static createIDocumentUploadedEvent(
    aggregateId: string,
    payload: {
      documentId: string;
      originalName: string;
      filePath: string;
      size: number;
      mimeType: string;
      uploadedBy?: string;
      uploadedAt: Date;
    },
    metadata?: Record<string, unknown>
  ): IDocumentUploadedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentUploaded',
      aggregateId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as IDocumentUploadedEvent;
  }

  /**
   * Alias for createIDocumentUploadedEvent (backward compatibility)
   */
  public static createDocumentUploadedEvent(
    aggregateId: string,
    payload: {
      documentId: string;
      originalName: string;
      filePath: string;
      size: number;
      mimeType: string;
      uploadedBy?: string;
      uploadedAt: Date;
    },
    metadata?: Record<string, unknown>
  ): IDocumentUploadedEvent {
    return DocumentEventFactory.createIDocumentUploadedEvent(aggregateId, payload, metadata);
  }

  public static createDocumentStatusChangedEvent(
    aggregateId: string,
    payload: {
      documentId: string;
      fromStatus: DocumentStatus | null;
      toStatus: DocumentStatus;
      reason?: string;
      processingStage?: string;
      retryCount: number;
      processingDuration?: number;
    },
    metadata?: Record<string, unknown>
  ): IDocumentStatusChangedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentStatusChanged',
      aggregateId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as IDocumentStatusChangedEvent;
  }

  public static createDocumentProcessingStartedEvent(
    documentId: string,
    payload: IDocumentProcessingStartedEvent['payload'],
    metadata?: Record<string, unknown>
  ): IDocumentProcessingStartedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentProcessingStarted',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as IDocumentProcessingStartedEvent;
  }

  public static createDocumentProcessingCompletedEvent(
    documentId: string,
    payload: IDocumentProcessingCompletedEvent['payload'],
    metadata?: Record<string, unknown>
  ): IDocumentProcessingCompletedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentProcessingCompleted',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as IDocumentProcessingCompletedEvent;
  }

  public static createDocumentProcessingFailedEvent(
    documentId: string,
    payload: IDocumentProcessingFailedEvent['payload'],
    metadata?: Record<string, unknown>
  ): IDocumentProcessingFailedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentProcessingFailed',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as IDocumentProcessingFailedEvent;
  }

  public static createDocumentOCRCompletedEvent(
    documentId: string,
    payload: IDocumentOCRCompletedEvent['payload'],
    metadata?: Record<string, unknown>
  ): IDocumentOCRCompletedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentOCRCompleted',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as IDocumentOCRCompletedEvent;
  }

  public static createDocumentValidationCompletedEvent(
    documentId: string,
    payload: IDocumentValidationCompletedEvent['payload'],
    metadata?: Record<string, unknown>
  ): IDocumentValidationCompletedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentValidationCompleted',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as IDocumentValidationCompletedEvent;
  }

  public static createDocumentFullyProcessedEvent(
    documentId: string,
    payload: IDocumentFullyProcessedEvent['payload'],
    metadata?: Record<string, unknown>
  ): IDocumentFullyProcessedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentFullyProcessed',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as IDocumentFullyProcessedEvent;
  }

  public static createDocumentMovedToDLQEvent(
    documentId: string,
    payload: IDocumentMovedToDLQEvent['payload'],
    metadata?: Record<string, unknown>
  ): IDocumentMovedToDLQEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentMovedToDLQ',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as IDocumentMovedToDLQEvent;
  }

  public static createDocumentRetryAttemptedEvent(
    documentId: string,
    payload: IDocumentRetryAttemptedEvent['payload'],
    metadata?: Record<string, unknown>
  ): IDocumentRetryAttemptedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentRetryAttempted',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as IDocumentRetryAttemptedEvent;
  }
}

/**
 * Event publisher interface
 */
export interface IEventPublisher {
  publish(event: IDomainEvent): Promise<void>;
  publishBatch(events: IDomainEvent[]): Promise<void>;
}

/**
 * Event handler interface
 */
export interface IEventHandler<T extends IDomainEvent = IDomainEvent> {
  handle(event: T): Promise<void>;
  canHandle(eventType: string): boolean;
}

// Type aliases for cleaner names (backward compatibility)
export type DomainEvent = IDomainEvent;
export type EventPublisher = IEventPublisher;
export type EventHandler<T extends IDomainEvent = IDomainEvent> = IEventHandler<T>;
