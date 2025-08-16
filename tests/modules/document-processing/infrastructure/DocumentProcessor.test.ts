import { Document, IDocumentMetadata } from '@document-processing/domain/entities/Document';
import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';

describe('Document Processing Workflow', () => {
  const createMockDocument = (id = 'doc-123'): Document => {
    const metadata: IDocumentMetadata = {
      fileName: 'test-document.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
    };
    
    return new Document(id, '/path/to/test-document.pdf', metadata);
  };

  it('should process document through complete workflow', () => {
    const mockDocument = createMockDocument();
    
    // Initial state
    expect(mockDocument.status).toBe(DocumentStatus.UPLOADED);
    
    // Simulate OCR processing
    mockDocument.startOCRProcessing();
    expect(mockDocument.status).toBe(DocumentStatus.PROCESSING_OCR);
    
    mockDocument.completeOCRProcessing({
      extractedText: 'Invoice #INV-2024-001\nAmount: $1,234.56\nDate: 2024-01-15\nVendor: ABC Company',
      confidence: 0.88,
      extractedAt: new Date(),
    });
    expect(mockDocument.status).toBe(DocumentStatus.OCR_COMPLETED);
    expect(mockDocument.ocrResult).toBeDefined();
    
    // Simulate validation processing
    mockDocument.startValidationProcessing();
    expect(mockDocument.status).toBe(DocumentStatus.PROCESSING_VALIDATION);
    
    mockDocument.completeValidationProcessing({
      isValid: true,
      errors: [],
      validatedAt: new Date(),
    });
    expect(mockDocument.status).toBe(DocumentStatus.VALIDATION_COMPLETED);
    expect(mockDocument.validationResult?.isValid).toBe(true);
    
    // Simulate persistence processing
    mockDocument.startPersistenceProcessing();
    expect(mockDocument.status).toBe(DocumentStatus.PROCESSING_PERSISTENCE);
    
    mockDocument.completePersistenceProcessing();
    expect(mockDocument.status).toBe(DocumentStatus.COMPLETED);
  });

  it('should handle OCR failure correctly', () => {
    const mockDocument = createMockDocument();
    
    mockDocument.startOCRProcessing();
    expect(mockDocument.status).toBe(DocumentStatus.PROCESSING_OCR);
    
    mockDocument.failOCRProcessing();
    expect(mockDocument.status).toBe(DocumentStatus.OCR_FAILED);
  });

  it('should handle validation failure correctly', () => {
    const mockDocument = createMockDocument();
    
    // Complete OCR first
    mockDocument.startOCRProcessing();
    mockDocument.completeOCRProcessing({
      extractedText: 'Short',
      confidence: 0.5,
      extractedAt: new Date(),
    });
    
    // Start validation
    mockDocument.startValidationProcessing();
    expect(mockDocument.status).toBe(DocumentStatus.PROCESSING_VALIDATION);
    
    mockDocument.completeValidationProcessing({
      isValid: false,
      errors: ['Document content too short', 'OCR confidence below threshold'],
      validatedAt: new Date(),
    });
    expect(mockDocument.status).toBe(DocumentStatus.VALIDATION_COMPLETED);
    expect(mockDocument.validationResult?.isValid).toBe(false);
    expect(mockDocument.validationResult?.errors).toHaveLength(2);
  });

  it('should handle persistence failure correctly', () => {
    const mockDocument = createMockDocument();
    
    // Complete OCR and validation first
    mockDocument.startOCRProcessing();
    mockDocument.completeOCRProcessing({
      extractedText: 'Valid document content',
      confidence: 0.9,
      extractedAt: new Date(),
    });
    
    mockDocument.startValidationProcessing();
    mockDocument.completeValidationProcessing({
      isValid: true,
      errors: [],
      validatedAt: new Date(),
    });
    
    // Start persistence
    mockDocument.startPersistenceProcessing();
    expect(mockDocument.status).toBe(DocumentStatus.PROCESSING_PERSISTENCE);
    
    mockDocument.failPersistenceProcessing();
    expect(mockDocument.status).toBe(DocumentStatus.PERSISTENCE_FAILED);
  });

  it('should validate document status transitions', () => {
    const mockDocument = createMockDocument();
    
    // Test invalid transitions
    expect(() => mockDocument.startValidationProcessing()).toThrow(
      'Cannot start validation processing. Current status: uploaded'
    );
    
    expect(() => mockDocument.startPersistenceProcessing()).toThrow(
      'Cannot start persistence processing. Current status: uploaded'
    );
    
    // Complete OCR first
    mockDocument.startOCRProcessing();
    mockDocument.completeOCRProcessing({
      extractedText: 'Test content',
      confidence: 0.9,
      extractedAt: new Date(),
    });
    
    // Now validation should work
    mockDocument.startValidationProcessing();
    expect(mockDocument.status).toBe(DocumentStatus.PROCESSING_VALIDATION);
  });

  it('should handle document creation with different file types', () => {
    const textMetadata: IDocumentMetadata = {
      fileName: 'test.txt',
      fileSize: 512,
      mimeType: 'text/plain',
      uploadedAt: new Date(),
    };
    
    const textDocument = new Document('doc-124', '/path/to/test.txt', textMetadata);
    expect(textDocument.status).toBe(DocumentStatus.UPLOADED);
    expect(textDocument.metadata.fileName).toBe('test.txt');
    expect(textDocument.metadata.mimeType).toBe('text/plain');
  });
});
