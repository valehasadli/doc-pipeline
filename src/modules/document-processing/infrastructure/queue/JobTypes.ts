/**
 * Job Types and Interfaces for Document Processing Pipeline
 * 
 * Defines all job data structures and queue configurations
 * for the BullMQ-based document processing system.
 */

export interface DocumentMetadata {
  readonly originalName: string;
  readonly size: number;
  readonly mimeType: string;
  readonly uploadedAt: Date;
  readonly uploadedBy?: string;
}

export interface OCRResult {
  readonly text: string;
  readonly confidence: number;
  readonly language: string;
  readonly extractedAt: Date;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly validatedAt: Date;
}

/**
 * Base job data structure for all document processing jobs
 */
export interface BaseDocumentJob {
  readonly documentId: string;
  readonly filePath: string;
  readonly metadata: DocumentMetadata;
  readonly attemptNumber?: number;
  readonly previousError?: string;
}

/**
 * OCR Processing Job
 */
export interface OCRJob extends BaseDocumentJob {
  readonly stage: 'ocr';
  readonly ocrConfig?: {
    readonly language?: string;
    readonly confidence?: number;
  };
}

/**
 * Validation Processing Job
 */
export interface ValidationJob extends BaseDocumentJob {
  readonly stage: 'validation';
  readonly ocrResult: OCRResult;
  readonly validationRules?: string[];
}

/**
 * Persistence Processing Job
 */
export interface PersistenceJob extends BaseDocumentJob {
  readonly stage: 'persistence';
  readonly ocrResult: OCRResult;
  readonly validationResult: ValidationResult;
}

/**
 * Union type for all document processing jobs
 */
export type DocumentProcessingJob = OCRJob | ValidationJob | PersistenceJob;

/**
 * Queue Names
 */
export const QUEUE_NAMES = {
  DOCUMENT_OCR: 'document-ocr',
  DOCUMENT_VALIDATION: 'document-validation',
  DOCUMENT_PERSISTENCE: 'document-persistence',
  DOCUMENT_DLQ: 'document-dlq', // Dead Letter Queue
} as const;

/**
 * Job Options Configuration
 */
export interface JobOptionsConfig {
  readonly attempts: number;
  readonly backoff: {
    readonly type: 'exponential' | 'fixed';
    readonly delay: number;
  };
  readonly removeOnComplete: number;
  readonly removeOnFail: number;
  readonly delay?: number;
  readonly priority?: number;
}

/**
 * Default job options for different stages
 */
export const DEFAULT_JOB_OPTIONS: Record<string, JobOptionsConfig> = {
  ocr: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  validation: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  persistence: {
    attempts: 4,
    backoff: {
      type: 'exponential',
      delay: 1500,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
};

/**
 * Job Priority Levels
 */
export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20,
}

/**
 * Error Types for Job Processing
 */
export enum JobErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  OCR_ERROR = 'OCR_ERROR',
  PERSISTENCE_ERROR = 'PERSISTENCE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Job Error Interface
 */
export interface JobError {
  readonly type: JobErrorType;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: Date;
  readonly retryable: boolean;
}
