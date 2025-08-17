import { Job } from 'bullmq';

import { DocumentService } from '@document-processing/application/services/DocumentService';
import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';
import { DocumentProcessor } from '@document-processing/infrastructure/processors/DocumentProcessor';
import { DocumentQueue , IDocumentJobData } from '@document-processing/infrastructure/queue/DocumentQueue';

/**
 * Simple document worker that processes jobs using BullMQ
 * Minimal implementation focused on core functionality
 */
export class DocumentWorker {
  private static instance: DocumentWorker | undefined;
  private readonly queue: DocumentQueue;
  private readonly processor: DocumentProcessor;
  private readonly documentService: DocumentService;

  private constructor() {
    this.queue = DocumentQueue.getInstance();
    this.processor = DocumentProcessor.getInstance();
    this.documentService = DocumentService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DocumentWorker {
    if (!DocumentWorker.instance) {
      DocumentWorker.instance = new DocumentWorker();
    }
    return DocumentWorker.instance;
  }

  /**
   * Start the worker to process jobs
   */
  public start(): void {
    this.queue.createWorker(async (job: Job<IDocumentJobData>) => {
      await this.processJob(job);
    });

  }

  /**
   * Process a single job
   */
  public async processJob(job: Job<IDocumentJobData>): Promise<void> {
    const { documentId, stage } = job.data;
    
    if (job.data.cancelled === true) {
      throw new Error('Job was cancelled');
    }
    
    const documentService = DocumentService.getInstance();
    const document = await documentService.findById(documentId);
    
    if (!document) {
      throw new Error(`Document with ID ${documentId} not found`);
    }

    // Check if document is completed (but allow failed states for retry)
    if (document.status === DocumentStatus.COMPLETED) {
      throw new Error(`Document ${documentId} is already completed`);
    }

    if (document.status === DocumentStatus.FAILED || document.status === DocumentStatus.CANCELLED) {
      throw new Error(`Document ${documentId} was cancelled or failed`);
    }

    // Additional cancellation check - check if job was marked for cancellation
    const { filePath } = job.data;
    
    switch (stage) {
      case 'ocr': {
        await this.processor.processOCR(document);
        await this.checkCancellation(job, documentId);
        const updatedAfterOCR = await this.documentService.findById(documentId);
        if (updatedAfterOCR && !updatedAfterOCR.validationResult) {
          await this.queue.addValidationJob(documentId, filePath);
        }
        break;
      }
      case 'validation': {
        await this.processor.processValidation(document);
        await this.checkCancellation(job, documentId);
        const updatedAfterValidation = await this.documentService.findById(documentId);
        if (updatedAfterValidation && updatedAfterValidation.status !== DocumentStatus.COMPLETED) {
          await this.queue.addPersistenceJob(documentId, filePath);
        }
        break;
      }
      case 'persistence': {
        await this.processor.processPersistence(document);
        await this.checkCancellation(job, documentId);
        break;
      }
      default:
        throw new Error(`Unknown processing stage: ${stage as string}`);
    }

  }

  /**
   * Check if job or document was cancelled during processing
   */
  private async checkCancellation(job: Job<IDocumentJobData>, documentId: string): Promise<void> {
    if (job.data.cancelled === true) {
      throw new Error(`Job ${documentId} was cancelled`);
    }
    
    // Check document status from database for additional cancellation verification
    const document = await this.documentService.findById(documentId);
    if (document?.status === DocumentStatus.CANCELLED || document?.status === DocumentStatus.FAILED) {
      throw new Error(`Document ${documentId} was cancelled or failed`);
    }
  }

  /**
   * Stop the worker
   */
  public async stop(): Promise<void> {
    await this.queue.close();
  }
}

/**
 * Convenience function to get worker instance
 */
export const getDocumentWorker = (): DocumentWorker => {
  return DocumentWorker.getInstance();
};
