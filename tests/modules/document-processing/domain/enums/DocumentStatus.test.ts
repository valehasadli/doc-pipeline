/**
 * Document Status Enum Test Suite
 * 
 * Tests for document status transitions, validations, and utility functions.
 */

import {
  DocumentStatus,
  isValidStatusTransition,
  getValidNextStatuses,
  isStatusInCategory,
  InvalidStatusTransitionError,
  STATUS_CATEGORIES,
  isProcessingStatus,
  isTerminalStatus,
  isErrorStatus,
  isSuccessStatus,
  getProcessingStage,
} from '@document-processing/domain';

describe('Document Status Enum', () => {
  describe('Status Values', () => {
    it('should have all required status values', () => {
      expect(DocumentStatus.UPLOADED).toBe('uploaded');
      expect(DocumentStatus.QUEUED).toBe('queued');
      expect(DocumentStatus.PROCESSING_OCR).toBe('processing_ocr');
      expect(DocumentStatus.PROCESSING_VALIDATION).toBe('processing_validation');
      expect(DocumentStatus.PROCESSING_PERSISTENCE).toBe('processing_persistence');
      expect(DocumentStatus.OCR_COMPLETED).toBe('ocr_completed');
      expect(DocumentStatus.VALIDATION_COMPLETED).toBe('validation_completed');
      expect(DocumentStatus.COMPLETED).toBe('completed');
      expect(DocumentStatus.OCR_FAILED).toBe('ocr_failed');
      expect(DocumentStatus.VALIDATION_FAILED).toBe('validation_failed');
      expect(DocumentStatus.PERSISTENCE_FAILED).toBe('persistence_failed');
      expect(DocumentStatus.FAILED).toBe('failed');
      expect(DocumentStatus.DEAD_LETTER).toBe('dead_letter');
    });
  });

  describe('Status Transitions', () => {
    it('should allow valid transitions from UPLOADED', () => {
      expect(isValidStatusTransition(DocumentStatus.UPLOADED, DocumentStatus.QUEUED)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.UPLOADED, DocumentStatus.FAILED)).toBe(true);
    });

    it('should reject invalid transitions from UPLOADED', () => {
      expect(isValidStatusTransition(DocumentStatus.UPLOADED, DocumentStatus.PROCESSING_OCR)).toBe(false);
      expect(isValidStatusTransition(DocumentStatus.UPLOADED, DocumentStatus.COMPLETED)).toBe(false);
    });

    it('should allow valid transitions from QUEUED', () => {
      expect(isValidStatusTransition(DocumentStatus.QUEUED, DocumentStatus.PROCESSING_OCR)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.QUEUED, DocumentStatus.FAILED)).toBe(true);
    });

    it('should allow valid transitions from PROCESSING_OCR', () => {
      expect(isValidStatusTransition(DocumentStatus.PROCESSING_OCR, DocumentStatus.OCR_COMPLETED)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.PROCESSING_OCR, DocumentStatus.OCR_FAILED)).toBe(true);
    });

    it('should allow retry transitions from failed states', () => {
      expect(isValidStatusTransition(DocumentStatus.OCR_FAILED, DocumentStatus.PROCESSING_OCR)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.VALIDATION_FAILED, DocumentStatus.PROCESSING_VALIDATION)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.PERSISTENCE_FAILED, DocumentStatus.PROCESSING_PERSISTENCE)).toBe(true);
    });

    it('should allow transitions to dead letter queue from failed states', () => {
      expect(isValidStatusTransition(DocumentStatus.OCR_FAILED, DocumentStatus.DEAD_LETTER)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.VALIDATION_FAILED, DocumentStatus.DEAD_LETTER)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.PERSISTENCE_FAILED, DocumentStatus.DEAD_LETTER)).toBe(true);
    });

    it('should not allow transitions from terminal states', () => {
      expect(getValidNextStatuses(DocumentStatus.COMPLETED)).toEqual([]);
      expect(isValidStatusTransition(DocumentStatus.COMPLETED, DocumentStatus.QUEUED)).toBe(false);
    });

    it('should allow manual retry from FAILED state', () => {
      expect(isValidStatusTransition(DocumentStatus.FAILED, DocumentStatus.QUEUED)).toBe(true);
    });

    it('should allow recovery from DEAD_LETTER state', () => {
      expect(isValidStatusTransition(DocumentStatus.DEAD_LETTER, DocumentStatus.QUEUED)).toBe(true);
    });
  });

  describe('Status Categories', () => {
    it('should correctly categorize initial statuses', () => {
      expect(isStatusInCategory(DocumentStatus.UPLOADED, 'INITIAL')).toBe(true);
      expect(isStatusInCategory(DocumentStatus.QUEUED, 'INITIAL')).toBe(true);
      expect(isStatusInCategory(DocumentStatus.PROCESSING_OCR, 'INITIAL')).toBe(false);
    });

    it('should correctly categorize processing statuses', () => {
      expect(isProcessingStatus(DocumentStatus.PROCESSING_OCR)).toBe(true);
      expect(isProcessingStatus(DocumentStatus.PROCESSING_VALIDATION)).toBe(true);
      expect(isProcessingStatus(DocumentStatus.PROCESSING_PERSISTENCE)).toBe(true);
      expect(isProcessingStatus(DocumentStatus.UPLOADED)).toBe(false);
    });

    it('should correctly categorize success statuses', () => {
      expect(isSuccessStatus(DocumentStatus.OCR_COMPLETED)).toBe(true);
      expect(isSuccessStatus(DocumentStatus.VALIDATION_COMPLETED)).toBe(true);
      expect(isSuccessStatus(DocumentStatus.COMPLETED)).toBe(true);
      expect(isSuccessStatus(DocumentStatus.OCR_FAILED)).toBe(false);
    });

    it('should correctly categorize error statuses', () => {
      expect(isErrorStatus(DocumentStatus.OCR_FAILED)).toBe(true);
      expect(isErrorStatus(DocumentStatus.VALIDATION_FAILED)).toBe(true);
      expect(isErrorStatus(DocumentStatus.PERSISTENCE_FAILED)).toBe(true);
      expect(isErrorStatus(DocumentStatus.FAILED)).toBe(true);
      expect(isErrorStatus(DocumentStatus.COMPLETED)).toBe(false);
    });

    it('should correctly categorize terminal statuses', () => {
      expect(isTerminalStatus(DocumentStatus.COMPLETED)).toBe(true);
      expect(isTerminalStatus(DocumentStatus.FAILED)).toBe(true);
      expect(isTerminalStatus(DocumentStatus.DEAD_LETTER)).toBe(true);
      expect(isTerminalStatus(DocumentStatus.PROCESSING_OCR)).toBe(false);
    });
  });

  describe('Processing Stages', () => {
    it('should correctly identify OCR stage', () => {
      expect(getProcessingStage(DocumentStatus.PROCESSING_OCR)).toBe('ocr');
      expect(getProcessingStage(DocumentStatus.OCR_COMPLETED)).toBe('ocr');
      expect(getProcessingStage(DocumentStatus.OCR_FAILED)).toBe('ocr');
    });

    it('should correctly identify validation stage', () => {
      expect(getProcessingStage(DocumentStatus.PROCESSING_VALIDATION)).toBe('validation');
      expect(getProcessingStage(DocumentStatus.VALIDATION_COMPLETED)).toBe('validation');
      expect(getProcessingStage(DocumentStatus.VALIDATION_FAILED)).toBe('validation');
    });

    it('should correctly identify persistence stage', () => {
      expect(getProcessingStage(DocumentStatus.PROCESSING_PERSISTENCE)).toBe('persistence');
      expect(getProcessingStage(DocumentStatus.PERSISTENCE_FAILED)).toBe('persistence');
    });

    it('should correctly identify completed stage', () => {
      expect(getProcessingStage(DocumentStatus.COMPLETED)).toBe('completed');
    });

    it('should return null for non-processing stages', () => {
      expect(getProcessingStage(DocumentStatus.UPLOADED)).toBeNull();
      expect(getProcessingStage(DocumentStatus.QUEUED)).toBeNull();
      expect(getProcessingStage(DocumentStatus.FAILED)).toBeNull();
    });
  });

  describe('Utility Functions', () => {
    it('should get valid next statuses', () => {
      const validNext = getValidNextStatuses(DocumentStatus.UPLOADED);
      expect(validNext).toContain(DocumentStatus.QUEUED);
      expect(validNext).toContain(DocumentStatus.FAILED);
      expect(validNext).not.toContain(DocumentStatus.PROCESSING_OCR);
    });

    it('should return empty array for terminal statuses', () => {
      expect(getValidNextStatuses(DocumentStatus.COMPLETED)).toEqual([]);
    });
  });

  describe('Invalid Status Transition Error', () => {
    it('should create error with correct message', () => {
      const error = new InvalidStatusTransitionError(
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING_OCR
      );

      expect(error.name).toBe('InvalidStatusTransitionError');
      expect(error.fromStatus).toBe(DocumentStatus.UPLOADED);
      expect(error.toStatus).toBe(DocumentStatus.PROCESSING_OCR);
      expect(error.message).toContain('Invalid status transition');
      expect(error.message).toContain('uploaded');
      expect(error.message).toContain('processing_ocr');
    });

    it('should include valid transitions in error message', () => {
      const error = new InvalidStatusTransitionError(
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING_OCR
      );

      expect(error.message).toContain('queued');
      expect(error.message).toContain('failed');
    });
  });

  describe('Status Categories Constants', () => {
    it('should have correct initial statuses', () => {
      expect(STATUS_CATEGORIES.INITIAL).toContain(DocumentStatus.UPLOADED);
      expect(STATUS_CATEGORIES.INITIAL).toContain(DocumentStatus.QUEUED);
      expect(STATUS_CATEGORIES.INITIAL).toHaveLength(2);
    });

    it('should have correct processing statuses', () => {
      expect(STATUS_CATEGORIES.PROCESSING).toContain(DocumentStatus.PROCESSING_OCR);
      expect(STATUS_CATEGORIES.PROCESSING).toContain(DocumentStatus.PROCESSING_VALIDATION);
      expect(STATUS_CATEGORIES.PROCESSING).toContain(DocumentStatus.PROCESSING_PERSISTENCE);
      expect(STATUS_CATEGORIES.PROCESSING).toHaveLength(3);
    });

    it('should have correct success statuses', () => {
      expect(STATUS_CATEGORIES.SUCCESS).toContain(DocumentStatus.OCR_COMPLETED);
      expect(STATUS_CATEGORIES.SUCCESS).toContain(DocumentStatus.VALIDATION_COMPLETED);
      expect(STATUS_CATEGORIES.SUCCESS).toContain(DocumentStatus.COMPLETED);
      expect(STATUS_CATEGORIES.SUCCESS).toHaveLength(3);
    });

    it('should have correct error statuses', () => {
      expect(STATUS_CATEGORIES.ERROR).toContain(DocumentStatus.OCR_FAILED);
      expect(STATUS_CATEGORIES.ERROR).toContain(DocumentStatus.VALIDATION_FAILED);
      expect(STATUS_CATEGORIES.ERROR).toContain(DocumentStatus.PERSISTENCE_FAILED);
      expect(STATUS_CATEGORIES.ERROR).toContain(DocumentStatus.FAILED);
      expect(STATUS_CATEGORIES.ERROR).toContain(DocumentStatus.CANCELLED);
      expect(STATUS_CATEGORIES.ERROR).toHaveLength(5);
    });

    it('should have correct terminal statuses', () => {
      expect(STATUS_CATEGORIES.TERMINAL).toContain(DocumentStatus.COMPLETED);
      expect(STATUS_CATEGORIES.TERMINAL).toContain(DocumentStatus.FAILED);
      expect(STATUS_CATEGORIES.TERMINAL).toContain(DocumentStatus.CANCELLED);
      expect(STATUS_CATEGORIES.TERMINAL).toContain(DocumentStatus.DEAD_LETTER);
      expect(STATUS_CATEGORIES.TERMINAL).toHaveLength(4);
    });
  });

  describe('Complete Workflow Validation', () => {
    it('should support complete happy path workflow', () => {
      // Happy path: uploaded -> queued -> processing_ocr -> ocr_completed -> 
      // processing_validation -> validation_completed -> processing_persistence -> completed
      
      expect(isValidStatusTransition(DocumentStatus.UPLOADED, DocumentStatus.QUEUED)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.QUEUED, DocumentStatus.PROCESSING_OCR)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.PROCESSING_OCR, DocumentStatus.OCR_COMPLETED)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.OCR_COMPLETED, DocumentStatus.PROCESSING_VALIDATION)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.PROCESSING_VALIDATION, DocumentStatus.VALIDATION_COMPLETED)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.VALIDATION_COMPLETED, DocumentStatus.PROCESSING_PERSISTENCE)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.PROCESSING_PERSISTENCE, DocumentStatus.COMPLETED)).toBe(true);
    });

    it('should support error and retry workflows', () => {
      // Error path: processing_ocr -> ocr_failed -> processing_ocr (retry)
      expect(isValidStatusTransition(DocumentStatus.PROCESSING_OCR, DocumentStatus.OCR_FAILED)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.OCR_FAILED, DocumentStatus.PROCESSING_OCR)).toBe(true);
      
      // Dead letter path: ocr_failed -> dead_letter -> queued (recovery)
      expect(isValidStatusTransition(DocumentStatus.OCR_FAILED, DocumentStatus.DEAD_LETTER)).toBe(true);
      expect(isValidStatusTransition(DocumentStatus.DEAD_LETTER, DocumentStatus.QUEUED)).toBe(true);
    });
  });
});
