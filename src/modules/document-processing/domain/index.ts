/**
 * Document Processing Domain Layer
 * 
 * Exports all domain entities, value objects, enums, and events
 * for clean imports throughout the application.
 */

// Enums
export * from './enums/DocumentStatus';

// Entities
export * from './entities/Document';
export * from './entities/ProcessingStatus';

// Events
export * from './events/DocumentEvents';

// Re-export commonly used types for convenience
export type {
  DocumentMetadata,
  OCRResult,
  ValidationResult,
  PersistenceResult,
} from './entities/Document';

export type {
  StatusChange,
} from './entities/ProcessingStatus';
