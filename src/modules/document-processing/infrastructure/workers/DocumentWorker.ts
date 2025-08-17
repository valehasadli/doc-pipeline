import { Job } from 'bullmq';

import { DocumentService } from '@document-processing/application/services/DocumentService';

import { DocumentProcessor } from '../processors/DocumentProcessor';
import { DocumentQueue, IDocumentJobData } from '../queue/DocumentQueue';

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
  private async processJob(job: Job<IDocumentJobData>): Promise<void> {
    const { documentId, filePath, stage, cancelled } = job.data;

    // Check if job was marked for cancellation
    if (cancelled === true) {
      throw new Error(`Job cancelled by user request`);
    }

    // Retrieve document from database
    const domainDocument = await this.documentService.findById(documentId);
    if (domainDocument === null) {
      throw new Error(`Document ${documentId} not found in repository`);
    }

    // Process based on stage
    switch (stage) {
      case 'ocr':
        await this.processor.processOCR(domainDocument);
        // Queue next stage
        await this.queue.addValidationJob(documentId, filePath);
        break;
      case 'validation':
        await this.processor.processValidation(domainDocument);
        // Queue next stage
        await this.queue.addPersistenceJob(documentId, filePath);
        break;
      case 'persistence':
        await this.processor.processPersistence(domainDocument);
        // Processing complete
        break;
      default:
        throw new Error(`Unknown processing stage: ${stage as string}`);
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
