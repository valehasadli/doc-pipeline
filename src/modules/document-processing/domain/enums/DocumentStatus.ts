/**
 * Document Processing Status Enum & State Transitions
 * 
 * Defines all possible states a document can be in during processing
 * and the valid transitions between states.
 */

/**
 * Document processing status enumeration
 */
export enum DocumentStatus {
  // Initial states
  UPLOADED = 'uploaded',
  QUEUED = 'queued',
  
  // Processing states
  PROCESSING_OCR = 'processing_ocr',
  PROCESSING_VALIDATION = 'processing_validation',
  PROCESSING_PERSISTENCE = 'processing_persistence',
  
  // Success states
  OCR_COMPLETED = 'ocr_completed',
  VALIDATION_COMPLETED = 'validation_completed',
  COMPLETED = 'completed',
  
  // Error states
  OCR_FAILED = 'ocr_failed',
  VALIDATION_FAILED = 'validation_failed',
  PERSISTENCE_FAILED = 'persistence_failed',
  FAILED = 'failed',
  
  // Dead letter queue
  DEAD_LETTER = 'dead_letter',
}

/**
 * Valid state transitions mapping
 * Each status maps to an array of valid next statuses
 */
export const VALID_STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  // Initial states
  [DocumentStatus.UPLOADED]: [
    DocumentStatus.QUEUED,
    DocumentStatus.FAILED, // Direct failure during upload validation
  ],
  
  [DocumentStatus.QUEUED]: [
    DocumentStatus.PROCESSING_OCR,
    DocumentStatus.FAILED, // Queue processing failure
  ],
  
  // OCR processing
  [DocumentStatus.PROCESSING_OCR]: [
    DocumentStatus.OCR_COMPLETED,
    DocumentStatus.OCR_FAILED,
  ],
  
  [DocumentStatus.OCR_COMPLETED]: [
    DocumentStatus.PROCESSING_VALIDATION,
    DocumentStatus.FAILED, // Unexpected failure after OCR
  ],
  
  [DocumentStatus.OCR_FAILED]: [
    DocumentStatus.PROCESSING_OCR, // Retry OCR
    DocumentStatus.FAILED,
    DocumentStatus.DEAD_LETTER,
  ],
  
  // Validation processing
  [DocumentStatus.PROCESSING_VALIDATION]: [
    DocumentStatus.VALIDATION_COMPLETED,
    DocumentStatus.VALIDATION_FAILED,
  ],
  
  [DocumentStatus.VALIDATION_COMPLETED]: [
    DocumentStatus.PROCESSING_PERSISTENCE,
    DocumentStatus.FAILED, // Unexpected failure after validation
  ],
  
  [DocumentStatus.VALIDATION_FAILED]: [
    DocumentStatus.PROCESSING_VALIDATION, // Retry validation
    DocumentStatus.FAILED,
    DocumentStatus.DEAD_LETTER,
  ],
  
  // Persistence processing
  [DocumentStatus.PROCESSING_PERSISTENCE]: [
    DocumentStatus.COMPLETED,
    DocumentStatus.PERSISTENCE_FAILED,
  ],
  
  [DocumentStatus.PERSISTENCE_FAILED]: [
    DocumentStatus.PROCESSING_PERSISTENCE, // Retry persistence
    DocumentStatus.FAILED,
    DocumentStatus.DEAD_LETTER,
  ],
  
  // Terminal states
  [DocumentStatus.COMPLETED]: [], // No transitions from completed
  [DocumentStatus.FAILED]: [
    DocumentStatus.QUEUED, // Manual retry from beginning
  ],
  [DocumentStatus.DEAD_LETTER]: [
    DocumentStatus.QUEUED, // Manual recovery
  ],
};

/**
 * Status categories for easier querying and filtering
 */
export const STATUS_CATEGORIES = {
  INITIAL: [DocumentStatus.UPLOADED, DocumentStatus.QUEUED],
  PROCESSING: [
    DocumentStatus.PROCESSING_OCR,
    DocumentStatus.PROCESSING_VALIDATION,
    DocumentStatus.PROCESSING_PERSISTENCE,
  ],
  SUCCESS: [
    DocumentStatus.OCR_COMPLETED,
    DocumentStatus.VALIDATION_COMPLETED,
    DocumentStatus.COMPLETED,
  ],
  ERROR: [
    DocumentStatus.OCR_FAILED,
    DocumentStatus.VALIDATION_FAILED,
    DocumentStatus.PERSISTENCE_FAILED,
    DocumentStatus.FAILED,
  ],
  TERMINAL: [
    DocumentStatus.COMPLETED,
    DocumentStatus.FAILED,
    DocumentStatus.DEAD_LETTER,
  ],
} as const;

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  fromStatus: DocumentStatus,
  toStatus: DocumentStatus
): boolean {
  const validTransitions = VALID_STATUS_TRANSITIONS[fromStatus];
  return validTransitions.includes(toStatus);
}

/**
 * Get all valid next statuses for a given status
 */
export function getValidNextStatuses(status: DocumentStatus): DocumentStatus[] {
  return VALID_STATUS_TRANSITIONS[status];
}

/**
 * Check if a status is in a specific category
 */
export function isStatusInCategory(
  status: DocumentStatus,
  category: keyof typeof STATUS_CATEGORIES
): boolean {
  return (STATUS_CATEGORIES[category] as readonly DocumentStatus[]).includes(status);
}

/**
 * Check if a status represents a processing state
 */
export function isProcessingStatus(status: DocumentStatus): boolean {
  return isStatusInCategory(status, 'PROCESSING');
}

/**
 * Check if a status represents a terminal state (no further transitions)
 */
export function isTerminalStatus(status: DocumentStatus): boolean {
  return isStatusInCategory(status, 'TERMINAL');
}

/**
 * Check if a status represents an error state
 */
export function isErrorStatus(status: DocumentStatus): boolean {
  return isStatusInCategory(status, 'ERROR');
}

/**
 * Check if a status represents a successful state
 */
export function isSuccessStatus(status: DocumentStatus): boolean {
  return isStatusInCategory(status, 'SUCCESS');
}

/**
 * Get the processing stage from a status
 */
export function getProcessingStage(status: DocumentStatus): string | null {
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
      return null;
  }
}

/**
 * Status transition error
 */
export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly fromStatus: DocumentStatus,
    public readonly toStatus: DocumentStatus
  ) {
    super(
      `Invalid status transition from '${fromStatus}' to '${toStatus}'. ` +
      `Valid transitions from '${fromStatus}' are: ${getValidNextStatuses(fromStatus).join(', ')}`
    );
    this.name = 'InvalidStatusTransitionError';
  }
}
