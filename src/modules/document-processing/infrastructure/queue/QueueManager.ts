/**
 * Queue Manager for Document Processing Pipeline
 * 
 * Manages BullMQ queues for document processing stages with proper
 * error handling, retry logic, and monitoring capabilities.
 */

import { Queue, Job, JobsOptions } from 'bullmq';
import { getBullMQRedisConfig } from '../redis/RedisConnection';
import {
  QUEUE_NAMES,
  DocumentProcessingJob,
  OCRJob,
  ValidationJob,
  PersistenceJob,
  JobError,
  DEFAULT_JOB_OPTIONS,
  JobPriority,
} from './JobTypes';

/**
 * Queue Configuration Interface
 */
export interface QueueConfig {
  readonly connection: ReturnType<typeof getBullMQRedisConfig>;
  readonly defaultJobOptions: JobsOptions;
}

/**
 * Queue Statistics Interface
 */
export interface QueueStats {
  readonly waiting: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly delayed: number;
}

/**
 * Queue Health Status Interface
 */
export interface QueueHealthStatus {
  readonly healthy: boolean;
  readonly error?: string;
  readonly stats?: QueueStats;
}

/**
 * Queue Manager Class
 * 
 * Centralizes queue management for all document processing stages
 */
export class QueueManager {
  private static instance: QueueManager;
  private readonly queues: Map<string, Queue<DocumentProcessingJob>> = new Map();
  private config: QueueConfig;
  private isInitialized = false;

  private constructor() {
    this.config = {
      connection: getBullMQRedisConfig(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Initialize all queues
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🚀 Initializing document processing queues...');

      // Create all queues
      await this.createQueue(QUEUE_NAMES.DOCUMENT_OCR, DEFAULT_JOB_OPTIONS['ocr'] || {});
      await this.createQueue(QUEUE_NAMES.DOCUMENT_VALIDATION, DEFAULT_JOB_OPTIONS['validation'] || {});
      await this.createQueue(QUEUE_NAMES.DOCUMENT_PERSISTENCE, DEFAULT_JOB_OPTIONS['persistence'] || {});
      await this.createQueue(QUEUE_NAMES.DOCUMENT_DLQ, {
        attempts: 1,
        backoff: { type: 'fixed', delay: 0 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      });

      this.isInitialized = true;
      console.log('✅ All document processing queues initialized');
    } catch (error) {
      console.error('❌ Failed to initialize queues:', error);
      throw error;
    }
  }

  /**
   * Create a queue with configuration
   */
  private async createQueue(queueName: string, jobOptions: Partial<JobsOptions>): Promise<Queue<DocumentProcessingJob>> {
    let queue: Queue<DocumentProcessingJob>;
    switch (queueName) {
      case QUEUE_NAMES.DOCUMENT_OCR:
        queue = new Queue<OCRJob>(queueName, {
          connection: this.config.connection,
          defaultJobOptions: jobOptions || {},
        });
        break;
      case QUEUE_NAMES.DOCUMENT_VALIDATION:
        queue = new Queue<ValidationJob>(queueName, {
          connection: this.config.connection,
          defaultJobOptions: jobOptions || {},
        });
        break;
      case QUEUE_NAMES.DOCUMENT_PERSISTENCE:
        queue = new Queue<PersistenceJob>(queueName, {
          connection: this.config.connection,
          defaultJobOptions: jobOptions || {},
        });
        break;
      default:
        queue = new Queue<DocumentProcessingJob>(queueName, {
          connection: this.config.connection,
          defaultJobOptions: jobOptions,
        });
    }

    // Set up queue event handlers
    this.setupQueueEventHandlers(queue);

    this.queues.set(queueName, queue);
    console.log(`📋 Queue created: ${queueName}`);

    return queue;
  }

  /**
   * Set up event handlers for queue monitoring
   */
  private setupQueueEventHandlers(queue: Queue<DocumentProcessingJob>): void {
    queue.on('error', (error: Error) => {
      console.error(`❌ Queue ${queue.name} error:`, error);
    });

    queue.on('waiting', (job: Job<DocumentProcessingJob>) => {
      console.log(`⏳ Job ${job.id} waiting in queue ${queue.name}`);
    });

    (queue as any).on('active', (job: Job<DocumentProcessingJob>) => {
      console.log(`📋 Job ${job.id} is now active in queue ${queue.name}`);
    });

    (queue as any).on('completed', (job: Job<DocumentProcessingJob>) => {
      console.log(`✅ Job ${job.id} completed in queue ${queue.name}`);
    });

    (queue as any).on('failed', (job: Job<DocumentProcessingJob>, err: Error) => {
      console.error(`❌ Job ${job.id} failed in queue ${queue.name}:`, err.message);
    });

    (queue as any).on('stalled', (job: Job<DocumentProcessingJob>) => {
      console.warn(`⏸️ Job ${job.id} stalled in queue ${queue.name}`);
    });
  }

  /**
   * Get a queue by name
   */
  public getQueue(queueName: string): Queue<DocumentProcessingJob> | undefined {
    return this.queues.get(queueName);
  }

  /**
   * Add OCR job to queue
   */
  public async addOCRJob(
    documentId: string,
    filePath: string,
    metadata: OCRJob['metadata'],
    options?: Partial<JobsOptions>
  ): Promise<Job<OCRJob>> {
    const ocrQueue = this.queues.get(QUEUE_NAMES.DOCUMENT_OCR);
    if (!ocrQueue) {
      throw new Error('OCR queue not initialized');
    }

    const job = await ocrQueue.add(
      `ocr-${documentId}`,
      {
        documentId,
        filePath,
        metadata,
        stage: 'ocr' as const,
      },
      {
        priority: options?.priority || (JobPriority as any)['ocr'] || 0,
        ...options,
      }
    );

    return job as unknown as Job<OCRJob>;
  }

  /**
   * Add validation job to queue
   */
  public async addValidationJob(
    documentId: string,
    filePath: string,
    metadata: ValidationJob['metadata'],
    ocrResult: ValidationJob['ocrResult'],
    options?: Partial<JobsOptions>
  ): Promise<Job<ValidationJob>> {
    const validationQueue = this.queues.get(QUEUE_NAMES.DOCUMENT_VALIDATION);
    if (!validationQueue) {
      throw new Error('Validation queue not initialized');
    }

    const job = await validationQueue.add(
      `validation-${documentId}`,
      {
        documentId,
        filePath,
        metadata,
        ocrResult,
        stage: 'validation' as const,
      },
      {
        priority: options?.priority || (JobPriority as any)['validation'] || 0,
        ...options,
      }
    );

    return job as unknown as Job<ValidationJob>;
  }

  /**
   * Add persistence job to queue
   */
  public async addPersistenceJob(
    documentId: string,
    filePath: string,
    metadata: PersistenceJob['metadata'],
    ocrResult: PersistenceJob['ocrResult'],
    validationResult: PersistenceJob['validationResult'],
    options?: Partial<JobsOptions>
  ): Promise<Job<PersistenceJob>> {
    const persistenceQueue = this.queues.get(QUEUE_NAMES.DOCUMENT_PERSISTENCE);
    if (!persistenceQueue) {
      throw new Error('Persistence queue not initialized');
    }

    const job = await persistenceQueue.add(
      `persistence-${documentId}`,
      {
        documentId,
        filePath,
        metadata,
        ocrResult,
        validationResult,
        stage: 'persistence' as const,
      },
      {
        priority: options?.priority || (JobPriority as any)['persistence'] || 0,
        ...options,
      }
    );

    return job as unknown as Job<PersistenceJob>;
  }

  /**
   * Add job to Dead Letter Queue
   */
  public async addToDLQ(
    originalJob: Job<DocumentProcessingJob>,
    error: JobError
  ): Promise<Job> {
    const dlqQueue = this.queues.get(QUEUE_NAMES.DOCUMENT_DLQ);
    if (!dlqQueue) {
      throw new Error('DLQ not initialized');
    }

    const dlqData = {
      originalJobId: originalJob.id,
      originalJobData: originalJob.data,
      originalQueueName: originalJob.queueName,
      error,
      failedAt: new Date(),
      attemptsMade: originalJob.attemptsMade,
      stage: 'dlq' as const,
      documentId: originalJob.data.documentId,
      filePath: originalJob.data.filePath,
      metadata: originalJob.data.metadata,
    } as unknown as DocumentProcessingJob;

    return dlqQueue.add('dlq-job', dlqData, {
      priority: (JobPriority as any)['low'] || 0,
      attempts: 1,
    });
  }

  /**
   * Get queue statistics
   */
  public async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Get all queue statistics
   */
  public async getAllQueueStats(): Promise<Record<string, QueueStats | { error: string }>> {
    const stats: Record<string, QueueStats | { error: string }> = {};

    for (const queueName of Object.values(QUEUE_NAMES)) {
      try {
        stats[queueName] = await this.getQueueStats(queueName);
      } catch (error) {
        stats[queueName] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    return stats;
  }

  /**
   * Pause a queue
   */
  public async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    console.log(`⏸️ Queue ${queueName} paused`);
  }

  /**
   * Resume a queue
   */
  public async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    console.log(`▶️ Queue ${queueName} resumed`);
  }

  /**
   * Clean completed jobs from a queue
   */
  public async cleanQueue(
    queueName: string,
    grace: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.clean(grace, 100, 'completed');
    await queue.clean(grace, 50, 'failed');
    console.log(`🧹 Queue ${queueName} cleaned`);
  }

  /**
   * Close all queues
   */
  public async close(): Promise<void> {
    console.log('🔄 Closing all queues...');

    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);

    this.queues.clear();
    this.isInitialized = false;

    console.log('✅ All queues closed');
  }

  /**
   * Health check for all queues
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    queues: Record<string, { healthy: boolean; error?: string }>;
  }> {
    const queueHealth: Record<string, { healthy: boolean; error?: string }> = {};
    let allHealthy = true;

    for (const [queueName, queue] of this.queues) {
      try {
        // Try to get queue info to test connectivity
        await queue.getJobCounts();
        queueHealth[queueName] = { healthy: true };
      } catch (error) {
        queueHealth[queueName] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        allHealthy = false;
      }
    }

    return {
      healthy: allHealthy,
      queues: queueHealth,
    };
  }
}

/**
 * Convenience function to get queue manager instance
 */
export const getQueueManager = (): QueueManager => {
  return QueueManager.getInstance();
};

/**
 * Initialize queues (convenience function)
 */
export const initializeQueues = async (): Promise<void> => {
  const queueManager = getQueueManager();
  await queueManager.initialize();
};
