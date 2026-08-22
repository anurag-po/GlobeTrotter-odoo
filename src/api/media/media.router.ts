import { Router, type Request, type Response, type NextFunction } from 'express';
import { uploadUrlSchema } from './media.schemas.js';
import { requireAuth } from '../middleware/auth-guard.js';
import { userRateLimiter } from '../middleware/rate-limiter.js';
import type { StorageService } from '../../application/ports/services.js';
import { makeGetUploadUrlUseCase } from '../../application/media/get-upload-url.js';

export function createMediaRouter(deps: { storageService: StorageService }): Router {
  const router = Router();
  const getUploadUrl = makeGetUploadUrlUseCase({ storageService: deps.storageService });

  // POST /api/v1/media/upload-url
  router.post('/media/upload-url', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = uploadUrlSchema.parse(req.body);
      const result = await getUploadUrl(req.currentUserId!, input);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
