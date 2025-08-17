
import { DocumentService } from '@document-processing/application/services/DocumentService';
import { Document, IOCRResult, IValidationResult } from '@document-processing/domain/entities/Document';
import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';
import { IFileStorageProvider } from '@document-processing/infrastructure/storage/interfaces/IFileStorageProvider';
import { StorageProviderFactory } from '@document-processing/infrastructure/storage/StorageProviderFactory';

/**
 * Simple document processor for OCR, validation, and persistence
 * Uses the existing Document domain logic with minimal infrastructure
 */
export class DocumentProcessor {
  private static instance: DocumentProcessor | undefined;
  private readonly documentService: DocumentService;
  private readonly storageProvider: IFileStorageProvider;

  private constructor() {
    this.documentService = DocumentService.getInstance();
    this.storageProvider = StorageProviderFactory.create();
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
      // Simulate OCR processing
      const ocrResult = await this.simulateOCR(document);
      
      // Complete OCR processing with results
      document.completeOCRProcessing(ocrResult);
      
      // Update document in database
      await this.documentService.updateDocument(document);
    } catch (error) {
      // Check if this is a cancellation error
      const isCancellation = error instanceof Error && error.message.includes('cancelled');
      
      if (isCancellation) {
        // Mark document as cancelled
        document.markAsCancelled();
      } else {
        // Mark OCR as failed for actual processing errors
        document.failOCRProcessing();
      }
      
      // Files stay in temp folder on failure/cancellation
      
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
      // Check if this is a cancellation error
      const isCancellation = error instanceof Error && error.message.includes('cancelled');
      
      if (isCancellation) {
        // Mark document as cancelled
        document.markAsCancelled();
      } else {
        // Mark validation as failed for actual processing errors
        document.failValidationProcessing();
      }
      
      // Files stay in temp folder on failure/cancellation
      
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
      // Move file from temporary to permanent storage
      await this.moveFileToPermStorage(document);
      
      // Complete persistence processing
      document.completePersistenceProcessing();
      
      // Update document status in database
      await this.documentService.updateDocument(document);
    } catch (error) {
      // Check if this is a cancellation error
      const isCancellation = error instanceof Error && error.message.includes('cancelled');
      
      if (isCancellation) {
        // Mark document as cancelled
        document.markAsCancelled();
      } else {
        // Mark persistence as failed for actual processing errors
        document.failPersistenceProcessing();
      }
      
      // Files stay in temp folder on failure/cancellation
      
      // Update document status in database
      await this.documentService.updateDocument(document);
      throw error;
    }
  }


  /**
   * Move file from temp to permanent storage
   */
  private async moveFileToPermStorage(document: Document): Promise<void> {
    const tempPath = this.getRelativePath(document.filePath);
    const permPath = this.generatePermPath(document);
    
    // File already in permanent storage
    if (await this.storageProvider.exists(permPath)) {
      return;
    }

    // Move with retry
    await this.retryOperation(() => this.storageProvider.move(tempPath, permPath));
    
    // Verify move succeeded
    if (!(await this.storageProvider.exists(permPath))) {
      throw new Error('File move failed verification');
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    const baseDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await this.delay(baseDelay * Math.pow(2, attempt - 1));
      }
    }
    throw new Error('Retry operation failed');
  }

  /**
   * Get relative path for storage provider
   */
  private getRelativePath(filePath: string): string {
    return filePath.replace(/^uploads\//, '');
  }

  /**
   * Generate permanent storage path
   */
  private generatePermPath(document: Document): string {
    const filename = document.filePath.split('/').pop() ?? 'unknown';
    return `permanent/${document.id}_${filename}`;
  }


  /**
   * Simulate OCR processing (as required by interview)
   */
  private async simulateOCR(document: Document): Promise<IOCRResult> {
    // Check if document was cancelled before processing
    const currentDoc = await this.documentService.findById(document.id);
    if (currentDoc?.status === DocumentStatus.FAILED || currentDoc?.status === DocumentStatus.CANCELLED) {
      throw new Error(`Document ${document.id} was cancelled during OCR processing`);
    }

    // Simulate processing delay (configurable via env)
    const processingDelayMs = parseInt(process.env['OCR_PROCESSING_DELAY_MS'] ?? '1000', 10);
    await this.delay(processingDelayMs, document.id);
    
    // Check again after delay in case it was cancelled during processing
    const updatedDoc = await this.documentService.findById(document.id);
    if (updatedDoc?.status === DocumentStatus.FAILED || updatedDoc?.status === DocumentStatus.CANCELLED) {
      throw new Error(`Document ${document.id} was cancelled during OCR processing`);
    }
    
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
    // Check if document was cancelled before processing
    const currentDoc = await this.documentService.findById(document.id);
    if (currentDoc?.status === DocumentStatus.FAILED || currentDoc?.status === DocumentStatus.CANCELLED) {
      throw new Error(`Document ${document.id} was cancelled during validation processing`);
    }

    // Simulate validation delay (configurable via env)
    const validationDelayMs = parseInt(process.env['VALIDATION_SIMULATION_DELAY_MS'] ?? '60000', 10);
    await this.delay(validationDelayMs, document.id);
    
    // Check again after delay in case it was cancelled during processing
    const updatedDoc = await this.documentService.findById(document.id);
    if (updatedDoc?.status === DocumentStatus.FAILED || updatedDoc?.status === DocumentStatus.CANCELLED) {
      throw new Error(`Document ${document.id} was cancelled during validation processing`);
    }

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
   * Utility method to simulate processing delays with cancellation checks
   */
  private async delay(ms: number, documentId?: string): Promise<void> {
    if (!documentId || documentId.trim() === '') {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkCancellation = async (): Promise<void> => {
        try {
          const document = await this.documentService.findById(documentId);
          if (document?.status === DocumentStatus.FAILED || document?.status === DocumentStatus.CANCELLED) {
            reject(new Error(`Document ${documentId} was cancelled during processing`));
            return;
          }
          
          const elapsed = Date.now() - startTime;
          if (elapsed >= ms) {
            resolve();
          } else {
            // Check again in 1 second or when delay should complete, whichever is sooner
            const nextCheck = Math.min(1000, ms - elapsed);
            setTimeout(() => { void checkCancellation(); }, nextCheck);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      // Start the first check
      void checkCancellation();
    });
  }
}

/**
 * Convenience function to get processor instance
 */
export const getDocumentProcessor = (): DocumentProcessor => {
  return DocumentProcessor.getInstance();
};
