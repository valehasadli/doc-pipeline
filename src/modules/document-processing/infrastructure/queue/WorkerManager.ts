/**
 * Worker Manager for Document Processing Pipeline
 * 
 * Manages BullMQ worker lifecycle, error handling, and monitoring
 * for all document processing stages.
 */

import { Worker, WorkerOptions, Job, UnrecoverableError } from 'bullmq';

import { getBullMQRedisConfig } from '../redis/RedisConnection';

import {
  DocumentProcessingJob,
  QUEUE_NAMES,
  JobErrorType,
  IJobError,
} from './JobTypes';

/**
 * Worker Configuration Interface
 */
export interface IWorkerConfig {
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
export interface IWorkerStats {
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly concurrency: number;
  readonly processed: number;
  readonly failed: number;
}

/**
 * Worker Health Status Interface
 */
export interface IWorkerHealthStatus {
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
  private static instance: WorkerManager | undefined;
  private readonly workers: Map<string, Worker> = new Map();
  private readonly processors: Map<string, JobProcessor> = new Map();
  private readonly config: IWorkerConfig;
  private isInitialized = false;

  private constructor() {
    const concurrency = parseInt(process.env['WORKER_CONCURRENCY'] ?? '5', 10);
    this.config = {
      connection: getBullMQRedisConfig(),
      concurrency: concurrency > 0 ? concurrency : 1,
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
    // Processor registered for queue: ${queueName}
  }

  /**
   * Initialize all workers
   */
  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Initializing document processing workers

    // Create workers for each queue
    this.createWorker(QUEUE_NAMES.DOCUMENT_OCR);
    this.createWorker(QUEUE_NAMES.DOCUMENT_VALIDATION);
    this.createWorker(QUEUE_NAMES.DOCUMENT_PERSISTENCE);
    this.createWorker(QUEUE_NAMES.DOCUMENT_DLQ);

    this.isInitialized = true;
    // All document processing workers initialized
  }

  /**
   * Create a worker for a specific queue
   */
  private createWorker(queueName: string): Worker {
    const processor = this.processors.get(queueName) ?? this.createDefaultProcessor(queueName);

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
    // Worker closed

    return worker;
  }

  /**
   * Create default processor for queues without registered processors
   */
  private createDefaultProcessor(queueName: string): JobProcessor {
    return () => {
      // No processor registered for queue - job skipped
      throw new UnrecoverableError(`No processor registered for queue ${queueName}`);
    };
  }

  /**
   * Set up event handlers for worker monitoring
   */
  private setupWorkerEventHandlers(worker: Worker): void {
    worker.on('ready', () => {
      // Worker ready
    });

    worker.on('active', () => {
      // Worker processing job
    });

    worker.on('completed', () => {
      // Worker completed job successfully
      
      // Log processing time for monitoring
      // Job processing time logged
    });

    worker.on('failed', (job, error) => {
      // Worker job failed - error logged internally
      
      // Log detailed error information
      this.logJobError(job, error);
    });

    worker.on('error', () => {
      // Worker error logged internally
    });

    worker.on('stalled', () => {
      // Worker job stalled
    });

    worker.on('progress', () => {
      // Worker job progress updated
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      // Gracefully shutting down worker: ${worker.name}
      void worker.close();
    });

    process.on('SIGINT', () => {
      // Gracefully shutting down worker: ${worker.name}
      void worker.close();
    });
  }

  /**
   * Log detailed job error information
   */
  private logJobError(job: Job | undefined, error: Error): void {
    if (!job) return;

    // Log error details for monitoring and debugging
    const errorDetails = {
      jobId: job.id,
      queueName: job.queueName,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
      errorMessage: error.message,
      timestamp: new Date().toISOString(),
    };

    // In production, this would be sent to a logging service
    // For now, we'll store it for potential debugging
    if (process.env['NODE_ENV'] === 'development') {
      // Development: log to stderr for debugging
      process.stderr.write(`Job Error: ${JSON.stringify(errorDetails, null, 2)}\n`);
    }

    // Check if job should be moved to DLQ
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      // Mark job for DLQ processing - in production this would trigger DLQ movement
      process.stderr.write(`Job ${job.id} exhausted all attempts, moving to DLQ\n`);
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

    await worker.close();
    // Worker paused
  }

  /**
   * Resume a worker
   */
  public resumeWorker(queueName: string): void {
    const worker = this.getWorker(queueName);
    if (!worker) {
      throw new Error(`Worker for queue ${queueName} not found`);
    }

    worker.resume();
    // Worker resumed
  }

  /**
   * Get worker statistics
   */
  public getWorkerStats(queueName: string): {
    isRunning: boolean;
    isPaused: boolean;
    concurrency: number;
    processed: number;
    failed: number;
  } {
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
  public getAllWorkerStats(): Record<string, unknown> {
    const stats: Record<string, IWorkerStats | { error: string }> = {};

    for (const queueName of this.workers.keys()) {
      try {
        stats[queueName] = this.getWorkerStats(queueName);
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
    // Closing all workers...

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
  public healthCheck(): { healthy: boolean; workers: Record<string, IWorkerHealthStatus> } {
    const workerHealth: Record<string, IWorkerHealthStatus> = {};
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
  ): IJobError {
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
export const initializeWorkers = (): void => {
  const workerManager = getWorkerManager();
  workerManager.initialize();
};
