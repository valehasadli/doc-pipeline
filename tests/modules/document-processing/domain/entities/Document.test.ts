import { Document, IDocumentMetadata, IOCRResult, IValidationResult } from '@document-processing/domain/entities/Document';
import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';

describe('Document', () => {
  let mockMetadata: IDocumentMetadata;
  let mockOCRResult: IOCRResult;
  let mockValidationResult: IValidationResult;

  beforeEach(() => {
    mockMetadata = {
      fileName: 'test-document.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      uploadedAt: new Date('2023-01-01T10:00:00Z')
    };

    mockOCRResult = {
      extractedText: 'Sample extracted text',
      confidence: 0.95,
      extractedAt: new Date('2023-01-01T10:05:00Z')
    };

    mockValidationResult = {
      isValid: true,
      errors: [],
      validatedAt: new Date('2023-01-01T10:10:00Z')
    };
  });

  describe('Constructor and Getters', () => {
    it('should create a document with required properties', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);

      expect(document.id).toBe('doc-123');
      expect(document.filePath).toBe('/path/to/file.pdf');
      expect(document.metadata).toEqual(mockMetadata);
      expect(document.status).toBe(DocumentStatus.UPLOADED);
      expect(document.ocrResult).toBeUndefined();
      expect(document.validationResult).toBeUndefined();
      expect(document.createdAt).toBeInstanceOf(Date);
      expect(document.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a document with custom status', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata, DocumentStatus.PROCESSING_OCR);

      expect(document.status).toBe(DocumentStatus.PROCESSING_OCR);
    });

    it('should return immutable metadata', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
      const metadata = document.metadata;

      metadata.fileName = 'modified.pdf';
      expect(document.metadata.fileName).toBe('test-document.pdf');
    });
  });

  describe('OCR Processing', () => {
    let document: Document;

    beforeEach(() => {
      document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
    });

    it('should start OCR processing from UPLOADED status', async () => {
      const initialUpdatedAt = document.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 5));
      document.startOCRProcessing();

      expect(document.status).toBe(DocumentStatus.PROCESSING_OCR);
      expect(document.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should not start OCR processing from non-UPLOADED status', () => {
      document.startOCRProcessing(); // Move to PROCESSING_OCR

      expect(() => document.startOCRProcessing()).toThrow(
        'Cannot start OCR processing. Current status: processing_ocr'
      );
    });

    it('should complete OCR processing successfully', async () => {
      document.startOCRProcessing();
      const initialUpdatedAt = document.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 1));
      document.completeOCRProcessing(mockOCRResult);

      expect(document.status).toBe(DocumentStatus.OCR_COMPLETED);
      expect(document.ocrResult).toEqual(mockOCRResult);
      expect(document.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should not complete OCR processing from wrong status', () => {
      expect(() => document.completeOCRProcessing(mockOCRResult)).toThrow(
        'Cannot complete OCR processing. Current status: uploaded'
      );
    });

    it('should fail OCR processing', async () => {
      document.startOCRProcessing();
      const initialUpdatedAt = document.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 1));
      document.failOCRProcessing();

      expect(document.status).toBe(DocumentStatus.OCR_FAILED);
      expect(document.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should not fail OCR processing from wrong status', () => {
      expect(() => document.failOCRProcessing()).toThrow(
        'Cannot fail OCR processing. Current status: uploaded'
      );
    });

    it('should create immutable copy of OCR result', () => {
      document.startOCRProcessing();
      document.completeOCRProcessing(mockOCRResult);

      const ocrResult = document.ocrResult;
      expect(ocrResult).toBeDefined();
      
      // Modify the returned result
      (ocrResult as IOCRResult).extractedText = 'Modified text';
      
      // Original should remain unchanged
      expect(document.ocrResult?.extractedText).toBe('Sample extracted text');
    });
  });

  describe('Validation Processing', () => {
    let document: Document;

    beforeEach(() => {
      document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
      document.startOCRProcessing();
      document.completeOCRProcessing(mockOCRResult);
    });

    it('should start validation processing from OCR_COMPLETED status', async () => {
      const initialUpdatedAt = document.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 1));
      document.startValidationProcessing();

      expect(document.status).toBe(DocumentStatus.PROCESSING_VALIDATION);
      expect(document.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should not start validation processing from wrong status', () => {
      document.startValidationProcessing(); // Move to PROCESSING_VALIDATION

      expect(() => document.startValidationProcessing()).toThrow(
        'Cannot start validation processing. Current status: processing_validation'
      );
    });

    it('should complete validation processing successfully', async () => {
      document.startValidationProcessing();
      const initialUpdatedAt = document.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 1));
      document.completeValidationProcessing(mockValidationResult);

      expect(document.status).toBe(DocumentStatus.VALIDATION_COMPLETED);
      expect(document.validationResult).toEqual(mockValidationResult);
      expect(document.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should not complete validation processing from wrong status', () => {
      expect(() => document.completeValidationProcessing(mockValidationResult)).toThrow(
        'Cannot complete validation processing. Current status: ocr_completed'
      );
    });

    it('should fail validation processing', async () => {
      document.startValidationProcessing();
      const initialUpdatedAt = document.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 1));
      document.failValidationProcessing();

      expect(document.status).toBe(DocumentStatus.VALIDATION_FAILED);
      expect(document.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should not fail validation processing from wrong status', () => {
      expect(() => document.failValidationProcessing()).toThrow(
        'Cannot fail validation processing. Current status: ocr_completed'
      );
    });

    it('should create immutable copy of validation result', () => {
      document.startValidationProcessing();
      document.completeValidationProcessing(mockValidationResult);

      const validationResult = document.validationResult;
      expect(validationResult).toBeDefined();
      
      // Modify the returned result
      (validationResult as IValidationResult).errors.push('New error');
      
      // Original should remain unchanged
      expect(document.validationResult?.errors).toEqual([]);
    });
  });

  describe('Persistence Processing', () => {
    let document: Document;

    beforeEach(() => {
      document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
      document.startOCRProcessing();
      document.completeOCRProcessing(mockOCRResult);
      document.startValidationProcessing();
      document.completeValidationProcessing(mockValidationResult);
    });

    it('should start persistence processing from VALIDATION_COMPLETED status', async () => {
      const initialUpdatedAt = document.updatedAt;
      
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 5));
      document.startPersistenceProcessing();

      expect(document.status).toBe(DocumentStatus.PROCESSING_PERSISTENCE);
      expect(document.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should not start persistence processing from wrong status', () => {
      document.startPersistenceProcessing(); // Move to PROCESSING_PERSISTENCE

      expect(() => document.startPersistenceProcessing()).toThrow(
        'Cannot start persistence processing. Current status: processing_persistence'
      );
    });

    it('should complete persistence processing successfully', async () => {
      document.startPersistenceProcessing();
      const initialUpdatedAt = document.updatedAt;
      
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      document.completePersistenceProcessing();

      expect(document.status).toBe(DocumentStatus.COMPLETED);
      expect(document.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should not complete persistence processing from wrong status', () => {
      expect(() => document.completePersistenceProcessing()).toThrow(
        'Cannot complete persistence processing. Current status: validation_completed'
      );
    });

    it('should fail persistence processing', async () => {
      document.startPersistenceProcessing();
      const initialUpdatedAt = document.updatedAt;
      
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      document.failPersistenceProcessing();

      expect(document.status).toBe(DocumentStatus.PERSISTENCE_FAILED);
      expect(document.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should not fail persistence processing from wrong status', () => {
      expect(() => document.failPersistenceProcessing()).toThrow(
        'Cannot fail persistence processing. Current status: validation_completed'
      );
    });
  });

  describe('General Failure Handling', () => {
    it('should mark document as failed from any status', async () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
      const initialUpdatedAt = document.updatedAt;
      
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      document.markAsFailed();

      expect(document.status).toBe(DocumentStatus.FAILED);
      expect(document.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should mark document as failed from processing status', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
      document.startOCRProcessing();

      document.markAsFailed();

      expect(document.status).toBe(DocumentStatus.FAILED);
    });
  });

  describe('Utility Methods', () => {
    it('should correctly identify completed documents', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);

      expect(document.isCompleted()).toBe(false);

      // Complete full workflow
      document.startOCRProcessing();
      document.completeOCRProcessing(mockOCRResult);
      document.startValidationProcessing();
      document.completeValidationProcessing(mockValidationResult);
      document.startPersistenceProcessing();
      document.completePersistenceProcessing();

      expect(document.isCompleted()).toBe(true);
    });

    it('should correctly identify failed documents', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);

      expect(document.hasFailed()).toBe(false);

      document.startOCRProcessing();
      document.failOCRProcessing();

      expect(document.hasFailed()).toBe(true);
    });

    it('should identify validation failed documents', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
      document.startOCRProcessing();
      document.completeOCRProcessing(mockOCRResult);
      document.startValidationProcessing();
      document.failValidationProcessing();

      expect(document.hasFailed()).toBe(true);
    });

    it('should identify persistence failed documents', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
      document.startOCRProcessing();
      document.completeOCRProcessing(mockOCRResult);
      document.startValidationProcessing();
      document.completeValidationProcessing(mockValidationResult);
      document.startPersistenceProcessing();
      document.failPersistenceProcessing();

      expect(document.hasFailed()).toBe(true);
    });

    it('should not identify general FAILED status as hasFailed', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
      document.markAsFailed();

      expect(document.hasFailed()).toBe(false); // markAsFailed sets FAILED, not specific failure states
    });
  });

  describe('Persistence Data', () => {
    it('should return complete persistence data', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
      document.startOCRProcessing();
      document.completeOCRProcessing(mockOCRResult);
      document.startValidationProcessing();
      document.completeValidationProcessing(mockValidationResult);

      const persistenceData = document.toPersistenceData();

      expect(persistenceData).toEqual({
        id: 'doc-123',
        filePath: '/path/to/file.pdf',
        metadata: mockMetadata,
        status: DocumentStatus.VALIDATION_COMPLETED,
        ocrResult: mockOCRResult,
        validationResult: mockValidationResult,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      });
    });

    it('should return persistence data without optional results', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);

      const persistenceData = document.toPersistenceData();

      expect(persistenceData.ocrResult).toBeUndefined();
      expect(persistenceData.validationResult).toBeUndefined();
    });

    it('should return immutable copies in persistence data', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
      document.startOCRProcessing();
      document.completeOCRProcessing(mockOCRResult);

      const persistenceData = document.toPersistenceData();
      
      // Modify returned data
      persistenceData.metadata.fileName = 'modified.pdf';
      if (persistenceData.ocrResult) {
        persistenceData.ocrResult.extractedText = 'Modified text';
      }

      // Original document should be unchanged
      expect(document.metadata.fileName).toBe('test-document.pdf');
      expect(document.ocrResult?.extractedText).toBe('Sample extracted text');
    });

    it('should return new Date instances in persistence data', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);
      const persistenceData = document.toPersistenceData();

      expect(persistenceData.createdAt).not.toBe(document.createdAt);
      expect(persistenceData.updatedAt).not.toBe(document.updatedAt);
      expect(persistenceData.createdAt.getTime()).toBe(document.createdAt.getTime());
      expect(persistenceData.updatedAt.getTime()).toBe(document.updatedAt.getTime());
    });
  });

  describe('State Transitions', () => {
    it('should follow complete happy path workflow', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);

      // Initial state
      expect(document.status).toBe(DocumentStatus.UPLOADED);
      expect(document.isCompleted()).toBe(false);
      expect(document.hasFailed()).toBe(false);

      // OCR workflow
      document.startOCRProcessing();
      expect(document.status).toBe(DocumentStatus.PROCESSING_OCR);
      
      document.completeOCRProcessing(mockOCRResult);
      expect(document.status).toBe(DocumentStatus.OCR_COMPLETED);
      expect(document.ocrResult).toBeDefined();

      // Validation workflow
      document.startValidationProcessing();
      expect(document.status).toBe(DocumentStatus.PROCESSING_VALIDATION);
      
      document.completeValidationProcessing(mockValidationResult);
      expect(document.status).toBe(DocumentStatus.VALIDATION_COMPLETED);
      expect(document.validationResult).toBeDefined();

      // Persistence workflow
      document.startPersistenceProcessing();
      expect(document.status).toBe(DocumentStatus.PROCESSING_PERSISTENCE);
      
      document.completePersistenceProcessing();
      expect(document.status).toBe(DocumentStatus.COMPLETED);
      expect(document.isCompleted()).toBe(true);
    });

    it('should handle OCR failure path', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);

      document.startOCRProcessing();
      document.failOCRProcessing();

      expect(document.status).toBe(DocumentStatus.OCR_FAILED);
      expect(document.hasFailed()).toBe(true);
      expect(document.isCompleted()).toBe(false);

      // Should not be able to proceed to validation
      expect(() => document.startValidationProcessing()).toThrow();
    });

    it('should handle validation failure path', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);

      document.startOCRProcessing();
      document.completeOCRProcessing(mockOCRResult);
      document.startValidationProcessing();
      document.failValidationProcessing();

      expect(document.status).toBe(DocumentStatus.VALIDATION_FAILED);
      expect(document.hasFailed()).toBe(true);
      expect(document.isCompleted()).toBe(false);

      // Should not be able to proceed to persistence
      expect(() => document.startPersistenceProcessing()).toThrow();
    });

    it('should handle persistence failure path', () => {
      const document = new Document('doc-123', '/path/to/file.pdf', mockMetadata);

      document.startOCRProcessing();
      document.completeOCRProcessing(mockOCRResult);
      document.startValidationProcessing();
      document.completeValidationProcessing(mockValidationResult);
      document.startPersistenceProcessing();
      document.failPersistenceProcessing();

      expect(document.status).toBe(DocumentStatus.PERSISTENCE_FAILED);
      expect(document.hasFailed()).toBe(true);
      expect(document.isCompleted()).toBe(false);
    });
  });
});
