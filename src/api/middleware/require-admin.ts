import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/app-error.js';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.currentUserId || req.userRole !== 'admin') {
    return next(AppError.forbidden('Admin role required'));
  }
  next();
}
