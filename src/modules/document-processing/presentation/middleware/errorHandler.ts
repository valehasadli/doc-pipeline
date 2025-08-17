import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

/**
 * Route handler function type
 */
type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Standardized error response interface
 */
export interface IErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

/**
 * Create standardized error response
 */
export const createErrorResponse = (error: string, message: string, details?: unknown): IErrorResponse => ({
  success: false,
  error,
  message,
  details,
  timestamp: new Date().toISOString()
});

/**
 * Multer error handler middleware
 */
export const handleMulterErrors = (error: unknown, _req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof multer.MulterError) {
    let errorResponse: IErrorResponse;
    
    switch (error.code as string) {
      case 'UNEXPECTED_FIELD':
        errorResponse = createErrorResponse(
          'Invalid field name',
          'Please use "file" as the field name for file upload'
        );
        res.status(400).json(errorResponse);
        return;
        
      case 'LIMIT_FILE_SIZE':
        errorResponse = createErrorResponse(
          'File too large',
          'File size must be less than 10MB'
        );
        res.status(413).json(errorResponse);
        return;
        
      case 'LIMIT_FILE_COUNT':
        errorResponse = createErrorResponse(
          'Too many files',
          'Only one file can be uploaded at a time'
        );
        res.status(400).json(errorResponse);
        return;
        
      case 'LIMIT_UNEXPECTED_FILE':
        errorResponse = createErrorResponse(
          'Unexpected file field',
          'File field not expected'
        );
        res.status(400).json(errorResponse);
        return;
        
      default:
        errorResponse = createErrorResponse(
          'Upload error',
          error.message || 'An error occurred during file upload'
        );
        res.status(400).json(errorResponse);
        return;
    }
  }
  
  // Handle file type validation errors
  if (error instanceof Error && error.message.includes('Invalid file type')) {
    const errorResponse = createErrorResponse(
      'Invalid file type',
      'Only PDF, images, and text documents are allowed',
      { supportedTypes: ['pdf', 'jpeg', 'jpg', 'png', 'gif', 'txt', 'doc', 'docx'] }
    );
    res.status(400).json(errorResponse);
    return;
  }

  next(error);
};

/**
 * Global error handler middleware
 */
export const handleGlobalErrors = (error: unknown, _req: Request, res: Response): void => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', error);
  
  // Don't send error details in production
  const isDevelopment = process.env['NODE_ENV'] === 'development';
  
  const errorDetails = error instanceof Error ? { stack: error.stack, details: error.message } : undefined;
  const errorResponse = createErrorResponse(
    'Internal server error',
    'An unexpected error occurred',
    isDevelopment ? errorDetails : undefined
  );
  
  res.status(500).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
