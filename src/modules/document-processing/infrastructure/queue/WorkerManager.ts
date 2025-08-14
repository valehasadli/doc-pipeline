/**
 * Worker Manager for Document Processing Pipeline
 * 
 * Manages BullMQ worker lifecycle, error handling, and monitoring
 * for all document processing stages.
 */

import { Worker, WorkerOptions, Job, UnrecoverableError } from 'bullmq';
import { getBullMQRedisConfig } from '../redis/RedisConnection';
import {
  QUEUE_NAMES,
  DocumentProcessingJob,
} from './JobTypes';
import {
  JobError,
  JobErrorType,
} from './JobTypes';

/**
 * Worker Configuration Interface
 */
export interface WorkerConfig {
  readonly connection: ReturnType<typeof getBullMQRedisConfig>;
  readonly concurrency: number;
  readonly maxStalledCount: number;
  readonly stalledInterval: number;
  readonly maxMemoryUsage: number;
}

/**
 * Job Processor Function Type
 */
export type JobProcessor<T = DocumentProcessingJob> = (job: Job<T>) => Promise<void | unknown>;

/**
 * Worker Statistics Interface
 */
export interface WorkerStats {
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly concurrency: number;
  readonly processed: number;
  readonly failed: number;
}

/**
 * Worker Health Status Interface
 */
export interface WorkerHealthStatus {
  readonly healthy: boolean;
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly error?: string;
}

/**
 * Worker Manager Class
 * 
 * Manages all workers for document processing pipeline
 */
export class WorkerManager {
  private static instance: WorkerManager;
  private workers: Map<string, Worker> = new Map();
  private processors: Map<string, JobProcessor> = new Map();
  private config: WorkerConfig;
  private isInitialized = false;

  private constructor() {
    const concurrency = process.env['WORKER_CONCURRENCY'] ?? '1';
    this.config = {
      connection: getBullMQRedisConfig(),
      concurrency: parseInt(concurrency, 10),
      maxStalledCount: 3,
      stalledInterval: 30000, // 30 seconds
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  /**
   * Register a job processor
   */
  public registerProcessor(queueName: string, processor: JobProcessor): void {
    this.processors.set(queueName, processor);
    console.log(`📝 Processor registered for queue: ${queueName}`);
  }

  /**
   * Initialize all workers
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🚀 Initializing document processing workers...');

      // Create workers for each queue
      await this.createWorker(QUEUE_NAMES.DOCUMENT_OCR);
      await this.createWorker(QUEUE_NAMES.DOCUMENT_VALIDATION);
      await this.createWorker(QUEUE_NAMES.DOCUMENT_PERSISTENCE);
      await this.createWorker(QUEUE_NAMES.DOCUMENT_DLQ);

      this.isInitialized = true;
      console.log('✅ All document processing workers initialized');
    } catch (error) {
      console.error('❌ Failed to initialize workers:', error);
      throw error;
    }
  }

  /**
   * Create a worker for a specific queue
   */
  private async createWorker(queueName: string): Promise<Worker> {
    const processor = this.processors.get(queueName) || this.createDefaultProcessor(queueName);

    const workerOptions: WorkerOptions = {
      connection: this.config.connection,
      concurrency: this.config.concurrency,
      maxStalledCount: this.config.maxStalledCount,
      stalledInterval: this.config.stalledInterval,
      // Worker settings for BullMQ compatibility
    };

    const worker = new Worker(queueName, processor, workerOptions);

    // Set up worker event handlers
    this.setupWorkerEventHandlers(worker);

    this.workers.set(queueName, worker);
    console.log(`👷 Worker created for queue: ${queueName}`);

    return worker;
  }

  /**
   * Create default processor for queues without registered processors
   */
  private createDefaultProcessor(queueName: string): JobProcessor {
    return async (job: Job<DocumentProcessingJob>) => {
      console.warn(`⚠️ No processor registered for queue ${queueName}, job ${job.id} skipped`);
      throw new UnrecoverableError(`No processor registered for queue ${queueName}`);
    };
  }

  /**
   * Set up event handlers for worker monitoring
   */
  private setupWorkerEventHandlers(worker: Worker): void {
    worker.on('ready', () => {
      console.log(`✅ Worker ready: ${worker.name}`);
    });

    worker.on('active', (job) => {
      // Worker closed successfullyssing job ${job.id}`);
    });

    worker.on('completed', (job) => {
      // Worker completed job successfully
      
      // Log processing time for monitoring
      const processingTime = Date.now() - job.processedOn!;
      console.log(`⏱️ Job ${job.id} processing time: ${processingTime}ms`);
    });

    worker.on('failed', (job, error) => {
      const jobId = job?.id || 'unknown';
      // Worker job failed - error logged internally
      
      // Log detailed error information
      this.logJobError(job, error);
    });

    worker.on('error', (error) => {
      console.error(`❌ Worker ${worker.name} error:`, error);
    });

    worker.on('stalled', (jobId) => {
      console.warn(`⚠️ Worker ${worker.name} job ${jobId} stalled`);
    });

    worker.on('progress', (job, progress) => {
      // Worker job progress updated: ${progress}%`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log(`🔄 Gracefully shutting down worker: ${worker.name}`);
      worker.close();
    });

    process.on('SIGINT', () => {
      console.log(`🔄 Gracefully shutting down worker: ${worker.name}`);
      worker.close();
    });
  }

  /**
   * Log detailed job error information
   */
  private logJobError(job: Job | undefined, error: Error): void {
    if (!job) return;

    const errorInfo = {
      jobId: job.id,
      queueName: job.queueName,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      errorMessage: error.message,
      errorStack: error.stack,
      jobData: job.data,
      timestamp: new Date().toISOString(),
    };

    console.error('📋 Job Error Details:', JSON.stringify(errorInfo, null, 2));

    // Check if job should be moved to DLQ
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      console.warn(`💀 Job ${job.id} exhausted all attempts, should be moved to DLQ`);
    }
  }

  /**
   * Get a worker by queue name
   */
  public getWorker(queueName: string): Worker | undefined {
    return this.workers.get(queueName);
  }

  /**
   * Get all workers
   */
  public getAllWorkers(): Map<string, Worker> {
    return new Map(this.workers);
  }

  /**
   * Pause a worker
   */
  public async pauseWorker(queueName: string): Promise<void> {
    const worker = this.getWorker(queueName);
    if (!worker) {
      throw new Error(`Worker for queue ${queueName} not found`);
    }

    void worker.close();
    console.log(`⏸️ Worker paused: ${queueName}`);
  }

  /**
   * Resume a worker
   */
  public async resumeWorker(queueName: string): Promise<void> {
    const worker = this.getWorker(queueName);
    if (!worker) {
      throw new Error(`Worker for queue ${queueName} not found`);
    }

    await worker.resume();
    console.log(`▶️ Worker resumed: ${queueName}`);
  }

  /**
   * Get worker statistics
   */
  public async getWorkerStats(queueName: string): Promise<{
    isRunning: boolean;
    isPaused: boolean;
    concurrency: number;
    processed: number;
    failed: number;
  }> {
    const worker = this.getWorker(queueName);
    if (!worker) {
      throw new Error(`Worker for queue ${queueName} not found`);
    }

    return {
      isRunning: worker.isRunning(),
      isPaused: worker.isPaused(),
      concurrency: this.config.concurrency,
      processed: 0, // BullMQ doesn't provide this directly
      failed: 0,    // BullMQ doesn't provide this directly
    };
  }

  /**
   * Get all worker statistics
   */
  public async getAllWorkerStats(): Promise<Record<string, unknown>> {
    const stats: Record<string, WorkerStats | { error: string }> = {};

    for (const queueName of this.workers.keys()) {
      try {
        stats[queueName] = await this.getWorkerStats(queueName);
      } catch (error) {
        stats[queueName] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    return stats;
  }

  /**
   * Close all workers
   */
  public async close(): Promise<void> {
    console.log('🔄 Closing all workers...');

    const closePromises = Array.from(this.workers.values()).map(worker => worker.close());
    await Promise.all(closePromises);

    this.workers.clear();
    this.processors.clear();
    this.isInitialized = false;

    // All workers closed successfully
  }

  /**
   * Health check for all workers
   */
  public healthCheck(): { healthy: boolean; workers: Record<string, { healthy: boolean; error?: string }> } {
    const workerHealth: Record<string, WorkerHealthStatus> = {};
    let allHealthy = true;

    for (const [queueName, worker] of this.workers) {
      try {
        const isRunning = worker.isRunning();
        const isPaused = worker.isPaused();
        const healthy = isRunning && !isPaused;

        workerHealth[queueName] = {
          healthy,
          isRunning,
          isPaused,
        };

        if (!healthy) {
          allHealthy = false;
        }
      } catch (error) {
        workerHealth[queueName] = {
          healthy: false,
          isRunning: false,
          isPaused: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        allHealthy = false;
      }
    }

    return {
      healthy: allHealthy,
      workers: workerHealth,
    };
  }

  /**
   * Utility method to determine if an error is retryable
   */
  public static isRetryableError(error: Error): boolean {
    // Network errors are usually retryable
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND')) {
      return true;
    }

    // Service unavailable errors are retryable
    if (error.message.includes('Service Unavailable') ||
        error.message.includes('Internal Server Error')) {
      return true;
    }

    // Validation errors are not retryable
    if (error.name === 'ValidationError' ||
        error.message.includes('Invalid') ||
        error.message.includes('Required field')) {
      return false;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Create a job error object
   */
  public static createJobError(
    error: Error,
    type: JobErrorType = JobErrorType.UNKNOWN_ERROR
  ): JobError {
    return {
      type,
      message: error.message,
      details: {
        name: error.name,
        stack: error.stack,
      },
      timestamp: new Date(),
      retryable: WorkerManager.isRetryableError(error),
    };
  }
}

/**
 * Convenience function to get worker manager instance
 */
export const getWorkerManager = (): WorkerManager => {
  return WorkerManager.getInstance();
};

/**
 * Initialize workers (convenience function)
 */
export const initializeWorkers = async (): Promise<void> => {
  const workerManager = getWorkerManager();
  await workerManager.initialize();
};
