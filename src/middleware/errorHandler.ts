import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: any;
}

/**
 * Centralized error handler
 * Ensures all errors are returned as valid JSON
 * Format: { ok: false, error: { code: string, message: string, details?: any } }
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Ensure response hasn't been sent
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

  console.error('Error:', {
    code,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    statusCode,
  });

  // Always return valid JSON
  try {
    res.status(statusCode).json({
      ok: false,
      error: {
        code,
        message,
        ...(err.details && { details: err.details }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      },
    });
  } catch (jsonError) {
    // Fallback: if JSON.stringify fails, send plain text error
    console.error('Failed to send JSON error response:', jsonError);
    res.status(500).setHeader('Content-Type', 'application/json').send(
      JSON.stringify({
        ok: false,
        error: {
          code: 'JSON_SERIALIZATION_ERROR',
          message: 'An error occurred, but failed to serialize error response',
        },
      })
    );
  }
}

/**
 * 404 Not Found handler
 * Returns valid JSON response
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
