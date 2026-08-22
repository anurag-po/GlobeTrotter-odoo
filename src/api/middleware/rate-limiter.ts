import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config/index.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

interface RateLimitBucket {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) {
  const store = new Map<string, RateLimitBucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!config.RATE_LIMIT_ENABLED || config.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
      return next();
    }

    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip || req.socket.remoteAddress || 'unknown');

    const now = Date.now();
    let bucket = store.get(key);

    if (!bucket || now > bucket.resetTime) {
      bucket = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      store.set(key, bucket);
      return next();
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      return next(new AppError(ErrorCodes.RATE_LIMITED, 'Too many requests, please try again later', 429));
    }

    next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
});

export const publicRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
});

export const userRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.currentUserId || req.ip || 'unknown',
});
