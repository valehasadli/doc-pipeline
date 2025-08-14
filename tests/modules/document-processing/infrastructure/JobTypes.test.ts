/**
 * Job Types Test Suite
 * 
 * Tests for document processing job type definitions,
 * interfaces, and configuration validation.
 */

import {
  DocumentMetadata,
  OCRResult,
  ValidationResult,
  OCRJob,
  ValidationJob,
  PersistenceJob,
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
  JobPriority,
  JobErrorType,
  JobError,
} from '@document-processing/infrastructure/queue/JobTypes';

describe('Document Processing Job Types', () => {
  describe('DocumentMetadata', () => {
    it('should create valid document metadata', () => {
      const metadata: DocumentMetadata = {
        originalName: 'test-invoice.pdf',
        size: 1024000,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
        uploadedBy: 'user123',
      };

      expect(metadata.originalName).toBe('test-invoice.pdf');
      expect(metadata.size).toBe(1024000);
      expect(metadata.mimeType).toBe('application/pdf');
      expect(metadata.uploadedAt).toBeInstanceOf(Date);
      expect(metadata.uploadedBy).toBe('user123');
    });

    it('should allow optional uploadedBy field', () => {
      const metadata: DocumentMetadata = {
        originalName: 'test-invoice.pdf',
        size: 1024000,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
      };

      expect(metadata.uploadedBy).toBeUndefined();
    });
  });

  describe('OCRResult', () => {
    it('should create valid OCR result', () => {
      const ocrResult: OCRResult = {
        text: 'Invoice #12345\nAmount: $100.00',
        confidence: 0.95,
        language: 'en',
        extractedAt: new Date(),
      };

      expect(ocrResult.text).toContain('Invoice #12345');
      expect(ocrResult.confidence).toBe(0.95);
      expect(ocrResult.language).toBe('en');
      expect(ocrResult.extractedAt).toBeInstanceOf(Date);
    });

    it('should handle low confidence OCR results', () => {
      const ocrResult: OCRResult = {
        text: 'Unclear text...',
        confidence: 0.45,
        language: 'unknown',
        extractedAt: new Date(),
      };

      expect(ocrResult.confidence).toBeLessThan(0.5);
      expect(ocrResult.language).toBe('unknown');
    });
  });

  describe('ValidationResult', () => {
    it('should create valid validation result with no errors', () => {
      const validationResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        validatedAt: new Date(),
      };

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      expect(validationResult.warnings).toHaveLength(0);
    });

    it('should create validation result with errors', () => {
      const validationResult: ValidationResult = {
        isValid: false,
        errors: ['Missing invoice number', 'Invalid date format'],
        warnings: ['Low OCR confidence'],
        validatedAt: new Date(),
      };

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toHaveLength(2);
      expect(validationResult.warnings).toHaveLength(1);
      expect(validationResult.errors).toContain('Missing invoice number');
    });
  });

  describe('Job Types', () => {
    const mockMetadata: DocumentMetadata = {
      originalName: 'test.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
    };

    it('should create valid OCR job', () => {
      const ocrJob: OCRJob = {
        documentId: 'doc-123',
        filePath: '/uploads/test.pdf',
        metadata: mockMetadata,
        stage: 'ocr',
        ocrConfig: {
          language: 'en',
          confidence: 0.8,
        },
      };

      expect(ocrJob.stage).toBe('ocr');
      expect(ocrJob.documentId).toBe('doc-123');
      expect(ocrJob.ocrConfig?.language).toBe('en');
    });

    it('should create valid validation job', () => {
      const mockOCRResult: OCRResult = {
        text: 'Test text',
        confidence: 0.9,
        language: 'en',
        extractedAt: new Date(),
      };

      const validationJob: ValidationJob = {
        documentId: 'doc-123',
        filePath: '/uploads/test.pdf',
        metadata: mockMetadata,
        stage: 'validation',
        ocrResult: mockOCRResult,
        validationRules: ['required_fields', 'date_format'],
      };

      expect(validationJob.stage).toBe('validation');
      expect(validationJob.ocrResult).toBeDefined();
      expect(validationJob.validationRules).toContain('required_fields');
    });

    it('should create valid persistence job', () => {
      const mockOCRResult: OCRResult = {
        text: 'Test text',
        confidence: 0.9,
        language: 'en',
        extractedAt: new Date(),
      };

      const mockValidationResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        validatedAt: new Date(),
      };

      const persistenceJob: PersistenceJob = {
        documentId: 'doc-123',
        filePath: '/uploads/test.pdf',
        metadata: mockMetadata,
        stage: 'persistence',
        ocrResult: mockOCRResult,
        validationResult: mockValidationResult,
      };

      expect(persistenceJob.stage).toBe('persistence');
      expect(persistenceJob.ocrResult).toBeDefined();
      expect(persistenceJob.validationResult).toBeDefined();
    });
  });

  describe('Queue Names', () => {
    it('should have all required queue names', () => {
      expect(QUEUE_NAMES.DOCUMENT_OCR).toBe('document-ocr');
      expect(QUEUE_NAMES.DOCUMENT_VALIDATION).toBe('document-validation');
      expect(QUEUE_NAMES.DOCUMENT_PERSISTENCE).toBe('document-persistence');
      expect(QUEUE_NAMES.DOCUMENT_DLQ).toBe('document-dlq');
    });

    it('should have unique queue names', () => {
      const queueNames = Object.values(QUEUE_NAMES);
      const uniqueNames = new Set(queueNames);
      expect(uniqueNames.size).toBe(queueNames.length);
    });
  });

  describe('Default Job Options', () => {
    it('should have valid OCR job options', () => {
      const ocrOptions = DEFAULT_JOB_OPTIONS['ocr'];

      expect(ocrOptions?.attempts).toBe(5);
      expect(ocrOptions?.backoff?.type).toBe('exponential');
      expect(ocrOptions?.backoff?.delay).toBe(2000);
      expect(ocrOptions?.removeOnComplete).toBe(100);
      expect(ocrOptions?.removeOnFail).toBe(50);
    });

    it('should have valid validation job options', () => {
      const validationOptions = DEFAULT_JOB_OPTIONS['validation'];

      expect(validationOptions?.attempts).toBe(3);
      expect(validationOptions?.backoff?.type).toBe('exponential');
      expect(validationOptions?.backoff?.delay).toBe(1000);
    });

    it('should have valid persistence job options', () => {
      const persistenceOptions = DEFAULT_JOB_OPTIONS['persistence'];

      expect(persistenceOptions?.attempts).toBe(4);
      expect(persistenceOptions?.backoff?.type).toBe('exponential');
      expect(persistenceOptions?.backoff?.delay).toBe(1500);
    });
  });

  describe('Job Priority', () => {
    it('should have correct priority values', () => {
      expect(JobPriority.LOW).toBe(1);
      expect(JobPriority.NORMAL).toBe(5);
      expect(JobPriority.HIGH).toBe(10);
      expect(JobPriority.CRITICAL).toBe(20);
    });

    it('should have ascending priority order', () => {
      expect(JobPriority.LOW).toBeLessThan(JobPriority.NORMAL);
      expect(JobPriority.NORMAL).toBeLessThan(JobPriority.HIGH);
      expect(JobPriority.HIGH).toBeLessThan(JobPriority.CRITICAL);
    });
  });

  describe('Job Error Types', () => {
    it('should have all required error types', () => {
      expect(JobErrorType.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(JobErrorType.OCR_ERROR).toBe('OCR_ERROR');
      expect(JobErrorType.PERSISTENCE_ERROR).toBe('PERSISTENCE_ERROR');
      expect(JobErrorType.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(JobErrorType.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
      expect(JobErrorType.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });

    it('should create valid job error', () => {
      const jobError: JobError = {
        type: JobErrorType.OCR_ERROR,
        message: 'OCR processing failed',
        details: { confidence: 0.2 },
        timestamp: new Date(),
        retryable: true,
      };

      expect(jobError.type).toBe(JobErrorType.OCR_ERROR);
      expect(jobError.message).toBe('OCR processing failed');
      expect(jobError.retryable).toBe(true);
      expect(jobError.details?.['confidence']).toBe(0.2);
    });
  });
});
