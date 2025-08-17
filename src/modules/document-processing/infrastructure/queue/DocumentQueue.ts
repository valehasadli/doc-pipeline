import { Queue, Worker, Job } from 'bullmq';

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
    const jobs = await this.queue.getJobs(['waiting', 'active', 'delayed']);
    const jobsToCancel = jobs.filter(job => job.data.documentId === documentId);
    
    if (jobsToCancel.length === 0) {
      throw new Error(`No jobs found for document ${documentId}`);
    }

    const errors: string[] = [];
    let cancelledCount = 0;

    for (const job of jobsToCancel) {
      try {
        // For active jobs, try to move them to failed state first
        if (await job.isActive()) {
          await job.moveToFailed(new Error('Job cancelled by user'), '0');
          cancelledCount++;
        } else {
          // For waiting/delayed jobs, remove them normally
          await job.remove();
          cancelledCount++;
        }
      } catch (error) {
        // If job is locked and we can't move it to failed, try alternative approach
        if (error instanceof Error && error.message.includes('locked')) {
          try {
            // Mark job as failed to signal cancellation to worker
            await job.updateData({ ...job.data, cancelled: true });
            // eslint-disable-next-line no-console
            console.log(`Marked job ${job.id} for cancellation - worker will handle gracefully`);
            cancelledCount++;
          } catch (updateError) {
            errors.push(`Job ${job.id} is currently being processed and cannot be cancelled`);
          }
        } else {
          errors.push(`Failed to cancel job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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

    // Basic error handling
    worker.on('failed', (job, err) => {
      // eslint-disable-next-line no-console
      console.error(`Job ${job?.id ?? 'unknown'} failed for document ${job?.data.documentId ?? 'unknown'}:`, err);
    });

    worker.on('completed', (job) => {
      // eslint-disable-next-line no-console
      console.log(`Job ${job.id} completed successfully for document ${job.data.documentId} (stage: ${job.data.stage})`);
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
