import { Request, Response } from 'express';
import multer from 'multer';

import { UploadDocumentUseCase, GetDocumentStatusUseCase, GetDocumentsUseCase } from '@document-processing/application';
import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';

/**
 * Document processing REST API controller
 */
export class DocumentController {
  private readonly uploadDocumentUseCase: UploadDocumentUseCase;
  private readonly getDocumentStatusUseCase: GetDocumentStatusUseCase;
  private readonly getDocumentsUseCase: GetDocumentsUseCase;

  constructor() {
    this.uploadDocumentUseCase = new UploadDocumentUseCase();
    this.getDocumentStatusUseCase = new GetDocumentStatusUseCase();
    this.getDocumentsUseCase = new GetDocumentsUseCase();
  }

  /**
   * Upload a document for processing
   */
  public uploadDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: 'No file uploaded',
          message: 'Please provide a file to upload'
        });
        return;
      }

      const uploadRequest = {
        filePath: req.file.path,
        metadata: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadedAt: new Date()
        }
      };

      const result = await this.uploadDocumentUseCase.execute(uploadRequest);

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Get document status and details
   */
  public getDocumentStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;

      if (documentId === undefined || documentId === '') {
        res.status(400).json({
          error: 'Missing document ID',
          message: 'Document ID is required'
        });
        return;
      }

      const result = await this.getDocumentStatusUseCase.execute(documentId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Document not found',
          message: error.message
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get document status',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Get all documents with optional status filter
   */
  public getDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.query;
      
      let statusFilter: DocumentStatus | undefined;
      if (typeof status === 'string' && status !== '') {
        if (Object.values(DocumentStatus).includes(status as DocumentStatus)) {
          statusFilter = status as DocumentStatus;
        } else {
          res.status(400).json({
            error: 'Invalid status filter',
            message: `Status must be one of: ${Object.values(DocumentStatus).join(', ')}`
          });
          return;
        }
      }

      const result = await this.getDocumentsUseCase.execute(statusFilter);

      res.status(200).json({
        success: true,
        data: {
          documents: result.map(doc => ({
            documentId: doc.id,
            status: doc.status,
            filePath: doc.filePath,
            metadata: doc.metadata,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            ocrResult: doc.ocrResult,
            validationResult: doc.validationResult
          })),
          count: result.length
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get documents',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Get processing statistics
   */
  public getStatistics = async (_req: Request, res: Response): Promise<void> => {
    try {
      // Access DocumentService directly for statistics
      const { DocumentService } = await import('@document-processing/application/services/DocumentService');
      const documentService = DocumentService.getInstance();
      const stats = await documentService.getStatistics();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get statistics',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Cancel document processing
   */
  public cancelDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;

      if (documentId === undefined || documentId === '') {
        res.status(400).json({
          error: 'Missing document ID',
          message: 'Document ID is required'
        });
        return;
      }

      // Access DocumentService directly for cancellation
      const { DocumentService } = await import('@document-processing/application/services/DocumentService');
      const documentService = DocumentService.getInstance();
      await documentService.cancelDocument(documentId);

      res.status(200).json({
        success: true,
        message: 'Document processing cancelled successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Document not found',
          message: error.message
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to cancel document',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Retry failed document processing
   */
  public retryDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;

      if (documentId === undefined || documentId === '') {
        res.status(400).json({
          error: 'Missing document ID',
          message: 'Document ID is required'
        });
        return;
      }

      // Access DocumentService directly for retry
      const { DocumentService } = await import('@document-processing/application/services/DocumentService');
      const documentService = DocumentService.getInstance();
      await documentService.retryDocument(documentId);

      res.status(200).json({
        success: true,
        message: 'Document processing restarted successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Document not found',
          message: error.message
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to retry document',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };
}

/**
 * Multer configuration for file uploads
 */
export const uploadMiddleware = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept common document types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, images, and text documents are allowed.'));
    }
  }
});
