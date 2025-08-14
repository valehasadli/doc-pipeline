import { Queue, Worker, Job } from 'bullmq';

/**
 * Simple job data interface
 */
export interface IDocumentJobData {
  documentId: string;
  filePath: string;
  stage: 'ocr' | 'validation' | 'persistence';
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
    });
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
    worker.on('failed', () => {
      // Handle job failure
    });

    worker.on('completed', () => {
      // Handle job completion
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
