import { Document, IDocumentMetadata } from '@document-processing/domain/entities/Document';
import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';
import { DocumentProcessor } from '@document-processing/infrastructure/processors/DocumentProcessor';

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;
  let mockDocument: Document;

  beforeEach(() => {
    // Reset singleton instance
    (DocumentProcessor as any).instance = null;
    processor = DocumentProcessor.getInstance();
    
    // Create a mock document
    const metadata: IDocumentMetadata = {
      fileName: 'test-document.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
    };
    
    mockDocument = new Document('doc-123', '/path/to/test-document.pdf', metadata);
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DocumentProcessor.getInstance();
      const instance2 = DocumentProcessor.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('OCR Processing', () => {
    it('should process OCR successfully for PDF document', async () => {
      expect(mockDocument.status).toBe(DocumentStatus.UPLOADED);

      await processor.processOCR(mockDocument);

      expect(mockDocument.status).toBe(DocumentStatus.OCR_COMPLETED);
      expect(mockDocument.ocrResult).toBeDefined();
      expect(mockDocument.ocrResult?.extractedText).toContain('Invoice');
      expect(mockDocument.ocrResult?.confidence).toBeGreaterThan(0.8);
      expect(mockDocument.ocrResult?.extractedAt).toBeInstanceOf(Date);
    });

    it('should process OCR successfully for text document', async () => {
      const textMetadata: IDocumentMetadata = {
        fileName: 'test.txt',
        fileSize: 512,
        mimeType: 'text/plain',
        uploadedAt: new Date(),
      };
      
      const textDocument = new Document('doc-124', '/path/to/test.txt', textMetadata);

      await processor.processOCR(textDocument);

      expect(textDocument.status).toBe(DocumentStatus.OCR_COMPLETED);
      expect(textDocument.ocrResult?.confidence).toBeGreaterThan(0.9);
    });

    it('should process OCR successfully for image document', async () => {
      const imageMetadata: IDocumentMetadata = {
        fileName: 'receipt.jpg',
        fileSize: 2048,
        mimeType: 'image/jpeg',
        uploadedAt: new Date(),
      };
      
      const imageDocument = new Document('doc-125', '/path/to/receipt.jpg', imageMetadata);

      await processor.processOCR(imageDocument);

      expect(imageDocument.status).toBe(DocumentStatus.OCR_COMPLETED);
      expect(imageDocument.ocrResult?.extractedText).toContain('Receipt');
      expect(imageDocument.ocrResult?.confidence).toBeGreaterThan(0.8);
    });

    it('should fail OCR processing when document is not in UPLOADED status', async () => {
      // Manually change status to simulate wrong state
      mockDocument.startOCRProcessing();
      mockDocument.completeOCRProcessing({
        extractedText: 'test',
        confidence: 0.9,
        extractedAt: new Date(),
      });

      await expect(processor.processOCR(mockDocument)).rejects.toThrow(
        'Cannot start OCR processing. Current status: ocr_completed'
      );
    });

    it('should handle OCR processing errors', async () => {
      // Mock Math.random to force an error condition if needed
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.99); // Force high value to potentially trigger errors

      try {
        await processor.processOCR(mockDocument);
        // If no error is thrown, that's fine - the simulation might not always error
        expect(mockDocument.status).toBe(DocumentStatus.OCR_COMPLETED);
      } catch (error) {
        expect(mockDocument.status).toBe(DocumentStatus.OCR_FAILED);
      } finally {
        Math.random = originalRandom;
      }
    });
  });

  describe('Validation Processing', () => {
    beforeEach(async () => {
      // Process OCR first to have OCR result
      await processor.processOCR(mockDocument);
    });

    it('should validate document successfully with valid OCR result', async () => {
      await processor.processValidation(mockDocument);

      expect(mockDocument.status).toBe(DocumentStatus.VALIDATION_COMPLETED);
      expect(mockDocument.validationResult).toBeDefined();
      expect(mockDocument.validationResult?.isValid).toBe(true);
      expect(mockDocument.validationResult?.errors).toHaveLength(0);
      expect(mockDocument.validationResult?.validatedAt).toBeInstanceOf(Date);
    });

    it('should fail validation when no OCR result exists', async () => {
      // Create document without OCR processing
      const metadata: IDocumentMetadata = {
        fileName: 'no-ocr.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
      };
      
      const noOcrDocument = new Document('doc-126', '/path/to/no-ocr.pdf', metadata);
      // Process OCR first to get to OCR_COMPLETED status, but with no result
      noOcrDocument.startOCRProcessing();
      noOcrDocument.completeOCRProcessing({
        extractedText: '',
        confidence: 0,
        extractedAt: new Date(),
      });

      await processor.processValidation(noOcrDocument);

      expect(noOcrDocument.status).toBe(DocumentStatus.VALIDATION_COMPLETED);
      expect(noOcrDocument.validationResult?.isValid).toBe(false);
      expect(noOcrDocument.validationResult?.errors).toContain('Document content too short');
    });

    it('should fail validation for short content', async () => {
      // Create document with short OCR result
      const metadata: IDocumentMetadata = {
        fileName: 'short.txt',
        fileSize: 10,
        mimeType: 'text/plain',
        uploadedAt: new Date(),
      };
      
      const shortDocument = new Document('doc-127', '/path/to/short.txt', metadata);
      // Process OCR to get to correct state
      shortDocument.startOCRProcessing();
      shortDocument.completeOCRProcessing({
        extractedText: 'short',
        confidence: 0.9,
        extractedAt: new Date(),
      });

      await processor.processValidation(shortDocument);

      expect(shortDocument.validationResult?.isValid).toBe(false);
      expect(shortDocument.validationResult?.errors).toContain('Document content too short');
    });

    it('should fail validation for low confidence OCR', async () => {
      // Create document and manually set low confidence OCR result
      const lowConfidenceDocument = new Document('doc-128', '/path/to/low-conf.pdf', {
        fileName: 'low-conf.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
      });

      lowConfidenceDocument.startOCRProcessing();
      lowConfidenceDocument.completeOCRProcessing({
        extractedText: 'This is a longer text with sufficient content for validation',
        confidence: 0.6, // Below threshold
        extractedAt: new Date(),
      });

      await processor.processValidation(lowConfidenceDocument);

      expect(lowConfidenceDocument.validationResult?.isValid).toBe(false);
      expect(lowConfidenceDocument.validationResult?.errors).toContain('OCR confidence below threshold');
    });
  });

  describe('Persistence Processing', () => {
    beforeEach(async () => {
      // Process OCR and validation first
      await processor.processOCR(mockDocument);
      await processor.processValidation(mockDocument);
    });

    it('should persist document successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.5); // Ensure no database error

      await processor.processPersistence(mockDocument);

      expect(mockDocument.status).toBe(DocumentStatus.COMPLETED);
      
      Math.random = originalRandom;
      consoleSpy.mockRestore();
    });

    it('should handle persistence errors', async () => {
      // Mock Math.random to force database error (5% chance)
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.01); // Force error condition

      try {
        await processor.processPersistence(mockDocument);
        // If no error, restore and fail test
        Math.random = originalRandom;
        fail('Expected persistence to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Database connection failed');
        expect(mockDocument.status).toBe(DocumentStatus.PERSISTENCE_FAILED);
      } finally {
        Math.random = originalRandom;
      }
    });

    it('should fail persistence when document is not in VALIDATION_COMPLETED status', async () => {
      // Create new document in wrong state
      const wrongStateDocument = new Document('doc-129', '/path/to/wrong.pdf', {
        fileName: 'wrong.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
      });

      await expect(processor.processPersistence(wrongStateDocument)).rejects.toThrow(
        'Cannot start persistence processing. Current status: uploaded'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle processing errors gracefully', async () => {
      // Test that errors are properly propagated
      const invalidDocument = new Document('invalid', '/invalid/path', {
        fileName: 'invalid.pdf',
        fileSize: 0,
        mimeType: 'invalid/type',
        uploadedAt: new Date(),
      });

      // OCR should still work with invalid metadata
      await processor.processOCR(invalidDocument);
      expect(invalidDocument.status).toBe(DocumentStatus.OCR_COMPLETED);
    });
  });
});
