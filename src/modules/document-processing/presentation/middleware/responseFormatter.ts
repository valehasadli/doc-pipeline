import { Response } from 'express';

/**
 * Standardized success response interface
 */
export interface ISuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string | undefined;
  timestamp: string;
}

/**
 * Paginated response interface
 */
export interface IPaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  message?: string | undefined;
  timestamp: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Create standardized success response
 */
export const createSuccessResponse = <T>(data: T, message?: string): ISuccessResponse<T> => ({
  success: true,
  data,
  message: message ?? undefined,
  timestamp: new Date().toISOString()
});

/**
 * Create paginated response
 */
export const createPaginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): IPaginatedResponse<T> => ({
  success: true,
  data,
  message: message ?? undefined,
  timestamp: new Date().toISOString(),
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  }
});

/**
 * Response helper methods
 */
export class ResponseFormatter {
  /**
   * Send success response
   */
  static success<T>(res: Response, data: T, message?: string, statusCode = 200): void {
    res.status(statusCode).json(createSuccessResponse(data, message));
  }

  /**
   * Send created response
   */
  static created<T>(res: Response, data: T, message?: string): void {
    ResponseFormatter.success(res, data, message, 201);
  }

  /**
   * Send paginated response
   */
  static paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string
  ): void {
    res.status(200).json(createPaginatedResponse(data, page, limit, total, message));
  }

  /**
   * Send no content response
   */
  static noContent(res: Response): void {
    res.status(204).send();
  }
}
