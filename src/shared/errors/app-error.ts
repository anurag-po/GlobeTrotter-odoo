import { ErrorCodes, type ErrorCode } from './error-codes.js';

export interface ErrorDetails {
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: ErrorDetails | null;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 400,
    details: ErrorDetails | null = null,
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static validation(message: string, details: ErrorDetails | null = null): AppError {
    return new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, details);
  }

  static unauthenticated(message = 'Authentication required'): AppError {
    return new AppError(ErrorCodes.UNAUTHENTICATED, message, 401);
  }

  static invalidCredentials(message = 'Invalid email/username or password'): AppError {
    return new AppError(ErrorCodes.INVALID_CREDENTIALS, message, 401);
  }

  static forbidden(message = 'You do not have permission to access this resource'): AppError {
    return new AppError(ErrorCodes.FORBIDDEN, message, 403);
  }

  static notFound(code: ErrorCode, message: string): AppError {
    return new AppError(code, message, 404);
  }

  static conflict(code: ErrorCode, message: string, details: ErrorDetails | null = null): AppError {
    return new AppError(code, message, 409, details);
  }

  static accountLocked(message = 'Account is temporarily locked due to multiple failed login attempts. Please try again later.'): AppError {
    return new AppError(ErrorCodes.ACCOUNT_LOCKED, message, 423);
  }

  static internal(message = 'An unexpected internal error occurred'): AppError {
    return new AppError(ErrorCodes.INTERNAL_ERROR, message, 500, null, false);
  }
}
