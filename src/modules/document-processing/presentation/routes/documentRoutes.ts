import { Router, Request, Response } from 'express';

import { DocumentController } from '@document-processing/presentation/controllers/DocumentController';
import { handleMulterErrors, handleGlobalErrors, asyncHandler } from '@document-processing/presentation/middleware/errorHandler';
import { uploadMiddleware } from '@document-processing/presentation/middleware/uploadMiddleware';
import { validateDocumentId, validateStatusQuery, validatePaginationQuery } from '@document-processing/presentation/middleware/validation';

/**
 * Document processing API routes with proper validation and error handling
 */
export function createDocumentRoutes(): Router {
  const router = Router();
  const documentController = new DocumentController();

  // Upload document with file validation
  router.post('/upload', 
    uploadMiddleware.single('file'),
    handleMulterErrors,
    asyncHandler(async (req: Request, res: Response) => {
      await documentController.uploadDocument(req, res);
    })
  );

  // Get document status with ID validation
  router.get('/:documentId',
    validateDocumentId,
    asyncHandler(async (req: Request, res: Response) => {
      await documentController.getDocumentStatus(req, res);
    })
  );

  // Get all documents with query validation
  router.get('/',
    validateStatusQuery,
    validatePaginationQuery,
    asyncHandler(async (req: Request, res: Response) => {
      await documentController.getDocuments(req, res);
    })
  );

  // Get processing statistics
  router.get('/stats/summary',
    asyncHandler(async (req: Request, res: Response) => {
      await documentController.getStatistics(req, res);
    })
  );

  // Cancel document processing with ID validation
  router.post('/:documentId/cancel',
    validateDocumentId,
    asyncHandler(async (req: Request, res: Response) => {
      await documentController.cancelDocument(req, res);
    })
  );

  // Retry failed document processing with ID validation
  router.post('/:documentId/retry',
    validateDocumentId,
    asyncHandler(async (req: Request, res: Response) => {
      await documentController.retryDocument(req, res);
    })
  );

  // Global error handler (must be last)
  router.use(handleGlobalErrors);

  return router;
}
