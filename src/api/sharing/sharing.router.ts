import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth-guard.js';
import { userRateLimiter, publicRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import type { JobService } from '../../application/ports/services.js';
import { makePublishTripUseCase, makeUnpublishTripUseCase } from '../../application/sharing/publish-trip.js';
import { makeGetPublicTripUseCase, makeCopyTripUseCase } from '../../application/sharing/get-public-trip.js';

export function createSharingRouter(deps: { repos: Repositories; jobService?: JobService }): {
  tripShareRouter: Router;
  publicShareRouter: Router;
} {
  const tripShareRouter = Router();
  const publicShareRouter = Router();

  const publishTrip = makePublishTripUseCase({ tripRepo: deps.repos.tripRepo });
  const unpublishTrip = makeUnpublishTripUseCase({ tripRepo: deps.repos.tripRepo });
  const getPublicTrip = makeGetPublicTripUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
    itineraryItemRepo: deps.repos.itineraryItemRepo,
    cityRepo: deps.repos.cityRepo,
    activityRepo: deps.repos.activityRepo,
    userRepo: deps.repos.userRepo,
    jobService: deps.jobService,
  });
  const copyTrip = makeCopyTripUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
    itineraryItemRepo: deps.repos.itineraryItemRepo,
  });

  // POST /api/v1/trips/:id/share
  tripShareRouter.post('/trips/:id/share', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.id as string;
      const result = await publishTrip(req.currentUserId!, tripId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/trips/:id/share
  tripShareRouter.delete('/trips/:id/share', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.id as string;
      const result = await unpublishTrip(req.currentUserId!, tripId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/public/trips/:token
  publicShareRouter.get('/trips/:token', publicRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.params.token as string;
      const trip = await getPublicTrip(token);
      res.status(200).json(trip);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/public/trips/:token/copy
  publicShareRouter.post('/trips/:token/copy', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.params.token as string;
      const newTrip = await copyTrip(req.currentUserId!, token);
      res.status(201).json(newTrip);
    } catch (err) {
      next(err);
    }
  });

  return { tripShareRouter, publicShareRouter };
}
