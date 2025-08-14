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
export interface DomainEvent {
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
export interface DocumentUploadedEvent extends DomainEvent {
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
export interface DocumentStatusChangedEvent extends DomainEvent {
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
export interface DocumentProcessingStartedEvent extends DomainEvent {
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
export interface DocumentProcessingCompletedEvent extends DomainEvent {
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
export interface DocumentProcessingFailedEvent extends DomainEvent {
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
export interface DocumentOCRCompletedEvent extends DomainEvent {
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
export interface DocumentValidationCompletedEvent extends DomainEvent {
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
export interface DocumentFullyProcessedEvent extends DomainEvent {
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
export interface DocumentMovedToDLQEvent extends DomainEvent {
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
export interface DocumentRetryAttemptedEvent extends DomainEvent {
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
  | DocumentUploadedEvent
  | DocumentStatusChangedEvent
  | DocumentProcessingStartedEvent
  | DocumentProcessingCompletedEvent
  | DocumentProcessingFailedEvent
  | DocumentOCRCompletedEvent
  | DocumentValidationCompletedEvent
  | DocumentFullyProcessedEvent
  | DocumentMovedToDLQEvent
  | DocumentRetryAttemptedEvent;

/**
 * Event factory functions
 */
export class DocumentEventFactory {
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

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
  ): DocumentUploadedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentUploaded',
      aggregateId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as DocumentUploadedEvent;
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
  ): DocumentStatusChangedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentStatusChanged',
      aggregateId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as DocumentStatusChangedEvent;
  }

  public static createDocumentProcessingStartedEvent(
    documentId: string,
    payload: DocumentProcessingStartedEvent['payload'],
    metadata?: Record<string, unknown>
  ): DocumentProcessingStartedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentProcessingStarted',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as DocumentProcessingStartedEvent;
  }

  public static createDocumentProcessingCompletedEvent(
    documentId: string,
    payload: DocumentProcessingCompletedEvent['payload'],
    metadata?: Record<string, unknown>
  ): DocumentProcessingCompletedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentProcessingCompleted',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as DocumentProcessingCompletedEvent;
  }

  public static createDocumentProcessingFailedEvent(
    documentId: string,
    payload: DocumentProcessingFailedEvent['payload'],
    metadata?: Record<string, unknown>
  ): DocumentProcessingFailedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentProcessingFailed',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as DocumentProcessingFailedEvent;
  }

  public static createDocumentOCRCompletedEvent(
    documentId: string,
    payload: DocumentOCRCompletedEvent['payload'],
    metadata?: Record<string, unknown>
  ): DocumentOCRCompletedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentOCRCompleted',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as DocumentOCRCompletedEvent;
  }

  public static createDocumentValidationCompletedEvent(
    documentId: string,
    payload: DocumentValidationCompletedEvent['payload'],
    metadata?: Record<string, unknown>
  ): DocumentValidationCompletedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentValidationCompleted',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as DocumentValidationCompletedEvent;
  }

  public static createDocumentFullyProcessedEvent(
    documentId: string,
    payload: DocumentFullyProcessedEvent['payload'],
    metadata?: Record<string, unknown>
  ): DocumentFullyProcessedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentFullyProcessed',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as DocumentFullyProcessedEvent;
  }

  public static createDocumentMovedToDLQEvent(
    documentId: string,
    payload: DocumentMovedToDLQEvent['payload'],
    metadata?: Record<string, unknown>
  ): DocumentMovedToDLQEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentMovedToDLQ',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as DocumentMovedToDLQEvent;
  }

  public static createDocumentRetryAttemptedEvent(
    documentId: string,
    payload: DocumentRetryAttemptedEvent['payload'],
    metadata?: Record<string, unknown>
  ): DocumentRetryAttemptedEvent {
    return {
      eventId: DocumentEventFactory.generateEventId(),
      eventType: 'DocumentRetryAttempted',
      aggregateId: documentId,
      aggregateType: 'Document',
      eventVersion: 1,
      occurredAt: new Date(),
      payload,
      ...(metadata && { metadata }),
    } as DocumentRetryAttemptedEvent;
  }
}

/**
 * Event publisher interface
 */
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishBatch(events: DomainEvent[]): Promise<void>;
}

/**
 * Event handler interface
 */
export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
  canHandle(eventType: string): boolean;
}
