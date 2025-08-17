import 'reflect-metadata';
import mongoose from 'mongoose';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env['NODE_ENV'] = 'test';
  process.env['PORT'] = '0'; // Use random port for tests
  process.env['MONGODB_URI'] = 'mongodb://admin:password@localhost:27017/document-pipeline-test?authSource=admin';
  
  // Suppress console.log in tests unless explicitly needed
  if (!process.env['VERBOSE_TESTS']) {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
  }
});

afterAll(async () => {
  // Close all MongoDB connections
  await mongoose.disconnect();
  
  // Cleanup after all tests
  jest.restoreAllMocks();
  
  // Force cleanup of any remaining timers
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // Allow pending promises to resolve
  await new Promise(resolve => setImmediate(resolve));
});

// Global test timeout
jest.setTimeout(30000);
