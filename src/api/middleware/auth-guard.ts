import type { Request, Response, NextFunction } from 'express';
import { JwtService } from '../../infrastructure/auth/jwt-service.js';
import { AppError } from '../../shared/errors/app-error.js';
import { correlationContext } from '../../shared/correlation.js';
import type { UserRole } from '../../domain/entities/user.js';

declare global {
  namespace Express {
    interface Request {
      currentUserId?: string;
      userRole?: UserRole;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(AppError.unauthenticated());
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(AppError.unauthenticated());
  }

  try {
    const payload = JwtService.verifyAccessToken(token);
    req.currentUserId = payload.sub;
    req.userRole = payload.role;

    const ctx = correlationContext.get();
    if (ctx) {
      ctx.userId = payload.sub;
    }

    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  try {
    const payload = JwtService.verifyAccessToken(token);
    req.currentUserId = payload.sub;
    req.userRole = payload.role;

    const ctx = correlationContext.get();
    if (ctx) {
      ctx.userId = payload.sub;
    }
  } catch {
    // Ignore optional auth failure
  }

  next();
}
