import 'reflect-metadata';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env['NODE_ENV'] = 'test';
  process.env['PORT'] = '0'; // Use random port for tests
  
  // Suppress console.log in tests unless explicitly needed
  if (!process.env['VERBOSE_TESTS']) {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
  }
});

afterAll(async () => {
  // Cleanup after all tests
  jest.restoreAllMocks();
});

// Global test timeout
jest.setTimeout(10000);
