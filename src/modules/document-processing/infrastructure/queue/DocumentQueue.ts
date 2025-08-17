import { Queue, Worker, Job } from 'bullmq';

import { Document } from '@document-processing/domain/entities/Document';
import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';

/**
 * Simple job data interface
 */
export interface IDocumentJobData {
  documentId: string;
  filePath: string;
  stage: 'ocr' | 'validation' | 'persistence';
  cancelled?: boolean;
}

/**
 * Redis connection configuration
 */
const redisHost = process.env['REDIS_HOST'] ?? 'localhost';
const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);
const redisConnection = {
  host: redisHost,
  port: redisPort,
};

/**
 * Simple document processing queue using BullMQ
 * Minimal implementation focused on core functionality
 */
export class DocumentQueue {
  private static instance: DocumentQueue | undefined;
  private readonly queue: Queue<IDocumentJobData>;
  private readonly workers: Worker<IDocumentJobData>[] = [];

  private constructor() {
    this.queue = new Queue<IDocumentJobData>('document-processing', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DocumentQueue {
    if (!DocumentQueue.instance) {
      DocumentQueue.instance = new DocumentQueue();
    }
    return DocumentQueue.instance;
  }

  /**
   * Add OCR job
   */
  public async addOCRJob(documentId: string, filePath: string): Promise<Job<IDocumentJobData>> {
    return this.queue.add('ocr', {
      documentId,
      filePath,
      stage: 'ocr',
    }, {
      attempts: 3, // Retry up to 3 times for OCR failures
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 second delay
      },
    });
  }

  /**
   * Add validation job
   */
  public async addValidationJob(documentId: string, filePath: string): Promise<Job<IDocumentJobData>> {
    return this.queue.add('validation', {
      documentId,
      filePath,
      stage: 'validation',
    }, {
      attempts: 3, // Retry up to 3 times for validation failures
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 second delay
      },
    });
  }

  /**
   * Add persistence job
   */
  public async addPersistenceJob(documentId: string, filePath: string): Promise<Job<IDocumentJobData>> {
    return this.queue.add('persistence', {
      documentId,
      filePath,
      stage: 'persistence',
    }, {
      attempts: 5, // Retry up to 5 times for persistence failures
      backoff: {
        type: 'exponential',
        delay: 3000, // Start with 3 second delay, exponentially increase
      },
    });
  }

  /**
   * Cancel job by document ID (including active jobs)
   */
  public async cancelJob(documentId: string): Promise<void> {
    // First check if document is already cancelled or completed
    try {
      const { DocumentService } = await import('@document-processing/application/services/DocumentService');
      const documentService = DocumentService.getInstance();
      const document = await documentService.findById(documentId);
      
      if (!document) {
        throw new Error(`Document with ID ${documentId} not found`);
      }
      
      if (document.status === DocumentStatus.CANCELLED) {
        throw new Error(`Document ${documentId} is already cancelled`);
      }
      
      if (document.status === DocumentStatus.COMPLETED) {
        throw new Error(`Cannot cancel completed document ${documentId}`);
      }
      
      if (document.status === DocumentStatus.FAILED) {
        throw new Error(`Document ${documentId} has already failed and cannot be cancelled`);
      }
    } catch (error) {
      // Re-throw the error to provide better feedback
      throw error;
    }

    const jobs = await this.queue.getJobs(['waiting', 'active', 'delayed']);
    const jobsToCancel = jobs.filter(job => job.data.documentId === documentId);
    
    if (jobsToCancel.length === 0) {
      throw new Error(`No active jobs found for document ${documentId}. Document may have already completed processing.`);
    }

    const errors: string[] = [];
    let cancelledCount = 0;

    // Mark the document as cancelled in the database and move file to temp
    try {
      const { DocumentService } = await import('@document-processing/application/services/DocumentService');
      
      const documentService = DocumentService.getInstance();
      const document = await documentService.findById(documentId);
      
      if (document) {
        console.log(`🔍 Cancelling document with file path: ${document.filePath}`);
        
        // Update document status to cancelled (files stay in temp)
        const cancelledDocument = new Document(
          document.id,
          document.filePath,
          document.metadata,
          DocumentStatus.CANCELLED,
          document.createdAt,
          new Date()
        );
        await documentService.updateDocument(cancelledDocument);
        console.log(`📝 Updated document status to CANCELLED: ${document.id}`);
      }
    } catch (dbError) {
      // Continue with job cancellation even if DB update fails
      console.warn(`Failed to update document status during cancellation: ${dbError}`);
    }

    for (const job of jobsToCancel) {
      try {
        const isActive = await job.isActive();
        
        if (isActive) {
          // For active jobs, update data to mark as cancelled and let the worker handle it
          try {
            await job.updateData({ ...job.data, cancelled: true });
            console.log(`🚫 \x1b[33mMarked active job ${job.id} for cancellation\x1b[0m - Document: \x1b[36m${documentId}\x1b[0m`);
            cancelledCount++;
          } catch (updateError) {
            // If we can't update data, try to remove the job
            try {
              await job.remove();
              console.log(`🗑️ \x1b[33mRemoved job ${job.id}\x1b[0m - Document: \x1b[36m${documentId}\x1b[0m`);
              cancelledCount++;
            } catch (removeError) {
              errors.push(`Failed to cancel job ${job.id}: ${removeError}`);
            }
          }
        } else {
          // For waiting/delayed jobs, remove them directly
          await job.remove();
          cancelledCount++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to cancel job ${job.id}: ${errorMsg}`);
      }
    }

    // If we couldn't cancel any jobs, throw an error
    if (cancelledCount === 0) {
      throw new Error(`Failed to cancel document: ${errors.join(', ')}`);
    }

    // If some jobs were cancelled but others failed, log warnings but don't throw
    if (errors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`Partial cancellation for document ${documentId}: ${errors.join(', ')}`);
    }
  }

  /**
   * Create worker for processing jobs
   */
  public createWorker(
    processor: (job: Job<IDocumentJobData>) => Promise<void>
  ): Worker<IDocumentJobData> {
    const worker = new Worker<IDocumentJobData>(
      'document-processing',
      processor,
      {
        connection: redisConnection,
        concurrency: 5,
      }
    );

    // Enhanced error handling with beautiful console output
    worker.on('failed', (job, err) => {
      if (job) {
        const documentId = job.data.documentId;
        const stage = job.data.stage;
        const jobId = job.id;
        const isCancelled = job.data.cancelled || err.message.includes('cancelled');
        
        if (isCancelled) {
          // eslint-disable-next-line no-console
          console.log(`\n🚫 \x1b[33mJob ${jobId} CANCELLED\x1b[0m`);
          // eslint-disable-next-line no-console
          console.log(`   📄 Document: \x1b[36m${documentId}\x1b[0m`);
          // eslint-disable-next-line no-console
          console.log(`   🔄 Stage: \x1b[35m${stage}\x1b[0m`);
          // eslint-disable-next-line no-console
          console.log(`   💬 Reason: \x1b[33mJob was cancelled\x1b[0m\n`);
        } else {
          // eslint-disable-next-line no-console
          console.log(`\n❌ \x1b[31mJob ${jobId} FAILED\x1b[0m`);
          // eslint-disable-next-line no-console
          console.log(`   📄 Document: \x1b[36m${documentId}\x1b[0m`);
          // eslint-disable-next-line no-console
          console.log(`   🔄 Stage: \x1b[35m${stage}\x1b[0m`);
          // eslint-disable-next-line no-console
          console.log(`   💬 Error: \x1b[31m${err.message}\x1b[0m\n`);
        }
      }
    });

    worker.on('completed', (job) => {
      const documentId = job.data.documentId;
      const stage = job.data.stage;
      const stageEmoji = stage === 'ocr' ? '👁️' : stage === 'validation' ? '✅' : '💾';
      
      // eslint-disable-next-line no-console
      console.log(`${stageEmoji} \x1b[32mJob ${job.id} completed\x1b[0m - Document: \x1b[36m${documentId}\x1b[0m (${stage})`);
    });

    worker.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('Worker error:', err);
    });

    this.workers.push(worker);
    return worker;
  }

  /**
   * Get queue statistics
   */
  public async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      await this.queue.getWaiting();
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close queue and workers
   */
  public async close(): Promise<void> {
    await Promise.all([
      this.queue.close(),
      ...this.workers.map(worker => worker.close()),
    ]);
  }
}

/**
 * Convenience function to get queue instance
 */
export const getDocumentQueue = (): DocumentQueue => {
  return DocumentQueue.getInstance();
};
