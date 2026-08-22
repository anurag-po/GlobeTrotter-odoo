import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';
import { logger } from '../../shared/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || 'root';
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }

    res.status(400).json({
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Request validation failed',
        details,
      },
    });
    return;
  }

  // 2. Domain AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`Internal server error: ${err.message}`, { stack: err.stack });
    } else {
      logger.warn(`Operational error: ${err.message}`, { code: err.code, statusCode: err.statusCode });
    }

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // 3. Unhandled Runtime Error
  logger.error(`Unhandled exception: ${err.message}`, { stack: err.stack });

  res.status(500).json({
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'An unexpected internal error occurred',
      details: null,
    },
  });
}
