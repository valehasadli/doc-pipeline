/**
 * Document Processing Infrastructure Module
 * 
 * Exports all infrastructure components for the document processing pipeline
 */

// Queue Infrastructure
export * from './queue/JobTypes';
export * from './queue/QueueManager';
export * from './queue/WorkerManager';

// Redis Infrastructure
export * from './redis/RedisConnection';

// Re-export commonly used types and functions
export {
  getQueueManager,
  initializeQueues,
} from './queue/QueueManager';

export {
  getWorkerManager,
  initializeWorkers,
} from './queue/WorkerManager';

export {
  getRedisConnection,
  createBullMQConnection,
  getBullMQRedisConfig,
} from './redis/RedisConnection';
