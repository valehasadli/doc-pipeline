import * as path from 'path';

import { Job } from 'bullmq';

import { Document, IDocumentMetadata } from '@document-processing/domain/entities/Document';
import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';

import { getDocumentProcessor } from '../processors/DocumentProcessor';
import { getDocumentQueue, IDocumentJobData } from '../queue/DocumentQueue';

/**
 * Simple document worker that processes jobs using BullMQ
 * Minimal implementation focused on core functionality
 */
export class DocumentWorker {
  private static instance: DocumentWorker | undefined;
  private readonly queue = getDocumentQueue();
  private readonly processor = getDocumentProcessor();

  private constructor() {}

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
    const { documentId, filePath, stage } = job.data;

    // Create or retrieve document (in real app, this would come from database)
    const document = this.getOrCreateDocument(documentId, filePath);

    // Process based on stage
    switch (stage) {
      case 'ocr':
        await this.processor.processOCR(document);
        // Queue next stage
        await this.queue.addValidationJob(documentId, filePath);
        break;

      case 'validation':
        await this.processor.processValidation(document);
        // Queue next stage
        await this.queue.addPersistenceJob(documentId, filePath);
        break;

      case 'persistence':
        await this.processor.processPersistence(document);
        break;

      default:
        throw new Error(`Unknown processing stage: ${String(stage)}`);
    }

  }

  /**
   * Get or create document instance
   * In a real application, this would retrieve from database
   */
  private getOrCreateDocument(documentId: string, filePath: string): Document {
    // For now, create a new document instance
    // In real app, this would be retrieved from database with current state
    const fileName = filePath.split('/').pop() ?? 'unknown';
    const metadata: IDocumentMetadata = {
      fileName,
      fileSize: 1024, // Would get actual file size
      mimeType: this.getMimeType(filePath),
      uploadedAt: new Date(),
    };

    return new Document(documentId, filePath, metadata, DocumentStatus.UPLOADED);
  }

  /**
   * Simple MIME type detection based on file extension
   */
  private getMimeType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase() || '.unknown';
    
    switch (extension) {
      case '.pdf':
        return 'application/pdf';
      case '.txt':
        return 'text/plain';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      default:
        return 'application/octet-stream';
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
