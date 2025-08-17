import { Request, Response, NextFunction } from 'express';

import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';

/**
 * Validation middleware for document processing routes
 */

/**
 * Validate UUID format for documentId parameter
 */
export const validateDocumentId = (req: Request, res: Response, next: NextFunction): void => {
  const { documentId } = req.params;
  
  if (typeof documentId !== 'string' || documentId.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Missing parameter',
      message: 'Document ID is required'
    });
    return;
  }

  // UUID v4 regex pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidPattern.test(documentId)) {
    res.status(400).json({
      success: false,
      error: 'Invalid parameter',
      message: 'Document ID must be a valid UUID'
    });
    return;
  }

  next();
};

/**
 * Validate status query parameter for document filtering
 */
export const validateStatusQuery = (req: Request, res: Response, next: NextFunction): void => {
  const { status } = req.query;
  
  if (typeof status === 'string' && status.length > 0) {
    const validStatuses = Object.values(DocumentStatus);
    
    if (!validStatuses.includes(status as DocumentStatus)) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameter',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }
  }

  next();
};

/**
 * Validate pagination query parameters
 */
export const validatePaginationQuery = (req: Request, res: Response, next: NextFunction): void => {
  const { page, limit } = req.query;
  
  if (typeof page === 'string' && (isNaN(Number(page)) || Number(page) < 1)) {
    res.status(400).json({
      success: false,
      error: 'Invalid query parameter',
      message: 'Page must be a positive integer'
    });
    return;
  }
  
  if (typeof limit === 'string' && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
    res.status(400).json({
      success: false,
      error: 'Invalid query parameter',
      message: 'Limit must be between 1 and 100'
    });
    return;
  }

  next();
};
