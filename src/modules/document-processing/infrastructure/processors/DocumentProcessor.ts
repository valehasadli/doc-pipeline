import { DocumentService } from '@document-processing/application/services/DocumentService';
import { Document, IOCRResult, IValidationResult } from '@document-processing/domain/entities/Document';

/**
 * Simple document processor for OCR, validation, and persistence
 * Uses the existing Document domain logic with minimal infrastructure
 */
export class DocumentProcessor {
  private static instance: DocumentProcessor | undefined;
  private readonly documentService: DocumentService;

  private constructor() {
    this.documentService = DocumentService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DocumentProcessor {
    if (!DocumentProcessor.instance) {
      DocumentProcessor.instance = new DocumentProcessor();
    }
    return DocumentProcessor.instance;
  }

  /**
   * Process OCR for a document
   */
  public async processOCR(document: Document): Promise<void> {
    // Start OCR processing
    document.startOCRProcessing();

    try {
      // Simulate OCR processing (as per interview requirements)
      const ocrResult = await this.simulateOCR(document);
      
      // Complete OCR processing with results
      document.completeOCRProcessing(ocrResult);
      
      // Update document in database
      await this.documentService.updateDocument(document);
    } catch (error) {
      // Mark OCR as failed
      document.failOCRProcessing();
      
      // Update document in database
      await this.documentService.updateDocument(document);
      throw error;
    }
  }

  /**
   * Process validation for a document
   */
  public async processValidation(document: Document): Promise<void> {
    // Start validation processing
    document.startValidationProcessing();

    try {
      // Validate document
      const validationResult = await this.validateDocument(document);
      
      // Complete validation processing
      document.completeValidationProcessing(validationResult);
      
      // Update document in database
      await this.documentService.updateDocument(document);
    } catch (error) {
      // Mark validation as failed
      document.failValidationProcessing();
      
      // Update document in database
      await this.documentService.updateDocument(document);
      throw error;
    }
  }

  /**
   * Process persistence for a document
   */
  public async processPersistence(document: Document): Promise<void> {
    // Start persistence processing
    document.startPersistenceProcessing();

    try {
      // Complete persistence processing (just mark as completed)
      document.completePersistenceProcessing();
      
      // Update document status in database
      await this.documentService.updateDocument(document);
    } catch (error) {
      // Mark persistence as failed
      document.failPersistenceProcessing();
      
      // Update document status in database
      await this.documentService.updateDocument(document);
      throw error;
    }
  }

  /**
   * Simulate OCR processing (as required by interview)
   */
  private async simulateOCR(document: Document): Promise<IOCRResult> {
    // Simulate processing delay (configurable via env)
    const ocrDelayMs = parseInt(process.env['OCR_SIMULATION_DELAY_MS'] ?? '60000', 10);
    await this.delay(ocrDelayMs);

    // Simulate OCR based on file type
    const mimeType = document.metadata.mimeType;
    let extractedText = '';
    let confidence = 0.9;

    if (mimeType.includes('text')) {
      extractedText = 'Sample text document content with important information.';
      confidence = 0.95;
    } else if (mimeType.includes('pdf')) {
      extractedText = 'Invoice #INV-2024-001\nAmount: $1,234.56\nDate: 2024-01-15\nVendor: ABC Company';
      confidence = 0.88;
    } else if (mimeType.includes('image')) {
      extractedText = 'Receipt\nStore: XYZ Market\nTotal: $45.67\nDate: 2024-01-15';
      confidence = 0.82;
    } else {
      extractedText = 'Document content extracted via OCR simulation.';
      confidence = 0.75;
    }

    return {
      extractedText,
      confidence,
      extractedAt: new Date(),
    };
  }

  /**
   * Validate document content
   */
  private async validateDocument(document: Document): Promise<IValidationResult> {
    // Simulate validation delay (configurable via env)
    const validationDelayMs = parseInt(process.env['VALIDATION_SIMULATION_DELAY_MS'] ?? '60000', 10);
    await this.delay(validationDelayMs);

    const ocrResult = document.ocrResult;
    if (!ocrResult) {
      return {
        isValid: false,
        errors: ['No OCR result available for validation'],
        validatedAt: new Date(),
      };
    }

    const errors: string[] = [];
    
    // Basic validation rules
    if (ocrResult.extractedText.length < 10) {
      errors.push('Document content too short');
    }
    
    if (ocrResult.confidence < 0.7) {
      errors.push('OCR confidence below threshold');
    }

    // Additional validation for financial documents
    const text = ocrResult.extractedText.toLowerCase();
    if (text.includes('invoice') || text.includes('receipt')) {
      if (!text.includes('$') && !text.includes('amount') && !text.includes('total')) {
        errors.push('Missing amount information in financial document');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      validatedAt: new Date(),
    };
  }


  /**
   * Utility method to simulate processing delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Convenience function to get processor instance
 */
export const getDocumentProcessor = (): DocumentProcessor => {
  return DocumentProcessor.getInstance();
};
