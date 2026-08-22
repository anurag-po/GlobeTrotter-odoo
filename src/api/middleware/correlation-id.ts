import type { Request, Response, NextFunction } from 'express';
import { generateUuid } from '../../shared/utils/uuid.js';
import { correlationContext } from '../../shared/correlation.js';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUuid();
  res.setHeader('X-Correlation-Id', correlationId);

  correlationContext.run({ correlationId }, () => {
    next();
  });
}
