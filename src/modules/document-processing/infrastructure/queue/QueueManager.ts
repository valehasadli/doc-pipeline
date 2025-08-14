/**
 * Queue Manager for Document Processing Pipeline
 * 
 * Manages BullMQ queues for document processing stages with proper
 * error handling, retry logic, and monitoring capabilities.
 */

import { Queue, Job, JobsOptions } from 'bullmq';

import { getBullMQRedisConfig } from '../redis/RedisConnection';

import {
  DocumentProcessingJob,
  IOCRJob,
  IValidationJob,
  IPersistenceJob,
  IJobError,
  DEFAULT_JOB_OPTIONS,
  JobPriority,
  QUEUE_NAMES,
} from './JobTypes';

/**
 * Queue Configuration Interface
 */
export interface IQueueConfig {
  readonly connection: ReturnType<typeof getBullMQRedisConfig>;
  readonly defaultJobOptions: JobsOptions;
}

/**
 * Queue Statistics Interface
 */
export interface IQueueStats {
  readonly waiting: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly delayed: number;
}

/**
 * Queue Health Status Interface
 */
export interface IQueueHealthStatus {
  readonly healthy: boolean;
  readonly error?: string;
  readonly stats?: IQueueStats;
}

/**
 * Queue Manager Class
 * 
 * Centralizes queue management for all document processing stages
 */
export class QueueManager {
  private static instance: QueueManager | undefined;
  private readonly queues: Map<string, Queue<DocumentProcessingJob>> = new Map();
  private readonly config: IQueueConfig;
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
  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // 🚀 Initializing document processing queues...

    // Create all queues
    const ocrOptions = DEFAULT_JOB_OPTIONS['ocr'] ?? {};
    this.createQueue(QUEUE_NAMES.DOCUMENT_OCR, ocrOptions);
    const validationOptions = DEFAULT_JOB_OPTIONS['validation'] ?? {};
    this.createQueue(QUEUE_NAMES.DOCUMENT_VALIDATION, validationOptions);
    const persistenceOptions = DEFAULT_JOB_OPTIONS['persistence'] ?? {};
    this.createQueue(QUEUE_NAMES.DOCUMENT_PERSISTENCE, persistenceOptions);
    this.createQueue(QUEUE_NAMES.DOCUMENT_DLQ, {
      attempts: 1,
      backoff: { type: 'fixed', delay: 0 },
      removeOnComplete: 10,
    });

    this.isInitialized = true;
    // ✅ All document processing queues initialized
  }

  /**
   * Create a queue with configuration
   */
  private createQueue(queueName: string, jobOptions: Partial<JobsOptions>): Queue<DocumentProcessingJob> {
    let queue: Queue<DocumentProcessingJob>;
    switch (queueName) {
      case QUEUE_NAMES.DOCUMENT_OCR:
        queue = new Queue<IOCRJob>(queueName, {
          connection: this.config.connection,
          defaultJobOptions: jobOptions,
        });
        break;
      case QUEUE_NAMES.DOCUMENT_VALIDATION:
        queue = new Queue<IValidationJob>(queueName, {
          connection: this.config.connection,
          defaultJobOptions: jobOptions,
        });
        break;
      case QUEUE_NAMES.DOCUMENT_PERSISTENCE:
        queue = new Queue<IPersistenceJob>(queueName, {
          connection: this.config.connection,
          defaultJobOptions: jobOptions,
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
    // 📋 Queue created: ${queueName}

    return queue;
  }

  /**
   * Set up event handlers for queue monitoring
   */
  private setupQueueEventHandlers(queue: Queue<DocumentProcessingJob>): void {
    queue.on('error', () => {
      // ❌ Queue error occurred
    });

    queue.on('waiting', () => {
      // ⏳ Job waiting in queue
    });

    // Note: 'active', 'completed', 'failed', 'stalled' events are handled by Workers, not Queues
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
  public async addIOCRJob(
    documentId: string,
    filePath: string,
    metadata: IOCRJob['metadata'],
    options?: Partial<JobsOptions>
  ): Promise<Job<IOCRJob>> {
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
        priority: options?.priority ?? JobPriority.NORMAL,
        ...options,
      }
    );

    return job as unknown as Job<IOCRJob>;
  }

  /**
   * Add OCR job to queue (alias for addIOCRJob)
   */
  public async addOCRJob(
    documentId: string,
    filePath: string,
    metadata: IOCRJob['metadata'],
    options?: Partial<JobsOptions>
  ): Promise<Job<IOCRJob>> {
    return this.addIOCRJob(documentId, filePath, metadata, options);
  }

  /**
   * Add validation job to queue
   */
  public async addIValidationJob(
    documentId: string,
    filePath: string,
    metadata: IValidationJob['metadata'],
    ocrResult: IValidationJob['ocrResult'],
    options?: Partial<JobsOptions>
  ): Promise<Job<IValidationJob>> {
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
        priority: options?.priority ?? JobPriority.NORMAL,
        ...options,
      }
    );

    return job as unknown as Job<IValidationJob>;
  }

  /**
   * Add validation job to queue (alias for addIValidationJob)
   */
  public async addValidationJob(
    documentId: string,
    filePath: string,
    metadata: IValidationJob['metadata'],
    ocrResult: IValidationJob['ocrResult'],
    options?: Partial<JobsOptions>
  ): Promise<Job<IValidationJob>> {
    return this.addIValidationJob(documentId, filePath, metadata, ocrResult, options);
  }

  /**
   * Add persistence job to queue
   */
  public async addIPersistenceJob(
    documentId: string,
    filePath: string,
    metadata: IPersistenceJob['metadata'],
    ocrResult: IPersistenceJob['ocrResult'],
    validationResult: IPersistenceJob['validationResult'],
    options?: Partial<JobsOptions>
  ): Promise<Job<IPersistenceJob>> {
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
        priority: options?.priority ?? JobPriority.NORMAL,
        ...options,
      }
    );

    return job as unknown as Job<IPersistenceJob>;
  }

  /**
   * Add persistence job to queue (alias for addIPersistenceJob)
   */
  public async addPersistenceJob(
    documentId: string,
    filePath: string,
    metadata: IPersistenceJob['metadata'],
    ocrResult: IPersistenceJob['ocrResult'],
    validationResult: IPersistenceJob['validationResult'],
    options?: Partial<JobsOptions>
  ): Promise<Job<IPersistenceJob>> {
    return this.addIPersistenceJob(documentId, filePath, metadata, ocrResult, validationResult, options);
  }

  /**
   * Add job to Dead Letter Queue
   */
  public async addToDLQ(
    originalJob: Job<DocumentProcessingJob>,
    error: IJobError
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
      priority: JobPriority.LOW,
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
  public async getAllQueueStats(): Promise<Record<string, IQueueStats | { error: string }>> {
    const stats: Record<string, IQueueStats | { error: string }> = {};

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
    // ⏸️ Queue paused
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
    // ▶️ Queue resumed
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
    // Queue cleaned
  }

  /**
   * Close all queues
   */
  public async close(): Promise<void> {
    // Closing all queues...

    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);

    this.queues.clear();
    this.isInitialized = false;

    // All queues closed
  }

  /**
   * Health check for all queues
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    queues: Record<string, IQueueHealthStatus>;
  }> {
    const queueHealth: Record<string, IQueueHealthStatus> = {};
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
export const initializeQueues = (): void => {
  const queueManager = getQueueManager();
  queueManager.initialize();
};
