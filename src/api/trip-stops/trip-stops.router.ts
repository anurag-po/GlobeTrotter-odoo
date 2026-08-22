import { Router, type Request, type Response, type NextFunction } from 'express';
import { addStopSchema, updateStopSchema, reorderStopsSchema } from './trip-stops.schemas.js';
import { requireAuth } from '../middleware/auth-guard.js';
import { userRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import { makeAddStopUseCase } from '../../application/trip-stops/add-stop.js';
import {
  makeUpdateStopUseCase,
  makeDeleteStopUseCase,
  makeReorderStopsUseCase,
} from '../../application/trip-stops/update-stop.js';

export function createTripStopsRouter(deps: { repos: Repositories }): Router {
  const router = Router({ mergeParams: true });

  const addStop = makeAddStopUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
    cityRepo: deps.repos.cityRepo,
  });

  const updateStop = makeUpdateStopUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
    cityRepo: deps.repos.cityRepo,
  });

  const deleteStop = makeDeleteStopUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
  });

  const reorderStops = makeReorderStopsUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
  });

  // POST /api/v1/trips/:tripId/stops
  router.post('/:tripId/stops', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.tripId as string;
      const input = addStopSchema.parse(req.body);
      const stop = await addStop(req.currentUserId!, tripId, input);
      res.status(201).json(stop);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/trips/:tripId/stops/reorder
  router.patch('/:tripId/stops/reorder', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.tripId as string;
      const input = reorderStopsSchema.parse(req.body);
      const stops = await reorderStops(req.currentUserId!, tripId, input.orderedStopIds);
      res.status(200).json(stops);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/trips/:tripId/stops/:stopId
  router.patch('/:tripId/stops/:stopId', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.tripId as string;
      const stopId = req.params.stopId as string;
      const input = updateStopSchema.parse(req.body);
      const ifMatch = req.headers['if-match'];
      const lockVersion = ifMatch ? parseInt(ifMatch.replace(/"/g, ''), 10) : undefined;

      const stop = await updateStop(req.currentUserId!, tripId, stopId, input, lockVersion);
      res.setHeader('ETag', `"${stop.lockVersion}"`);
      res.status(200).json(stop);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/trips/:tripId/stops/:stopId
  router.delete('/:tripId/stops/:stopId', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.tripId as string;
      const stopId = req.params.stopId as string;
      await deleteStop(req.currentUserId!, tripId, stopId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
