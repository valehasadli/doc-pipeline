import { Router } from 'express';

import { DocumentController, uploadMiddleware } from '@document-processing/presentation/controllers/DocumentController';

/**
 * Document processing API routes
 */
export function createDocumentRoutes(): Router {
  const router = Router();
  const documentController = new DocumentController();

  // Upload document
  router.post('/upload', uploadMiddleware.single('file'), (req, res) => {
    void documentController.uploadDocument(req, res);
  });

  // Get document status
  router.get('/:documentId', (req, res) => {
    void documentController.getDocumentStatus(req, res);
  });

  // Get all documents (with optional status filter)
  router.get('/', (req, res) => {
    void documentController.getDocuments(req, res);
  });

  // Get processing statistics
  router.get('/stats/summary', (req, res) => {
    void documentController.getStatistics(req, res);
  });

  // Cancel document processing
  router.post('/:documentId/cancel', (req, res) => {
    void documentController.cancelDocument(req, res);
  });

  // Retry failed document processing
  router.post('/:documentId/retry', (req, res) => {
    void documentController.retryDocument(req, res);
  });

  return router;
}
