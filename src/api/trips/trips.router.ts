import { Router, type Request, type Response, type NextFunction } from 'express';
import { createTripSchema, updateTripSchema, listTripsQuerySchema } from './trips.schemas.js';
import { requireAuth } from '../middleware/auth-guard.js';
import { userRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import { makeCreateTripUseCase } from '../../application/trips/create-trip.js';
import { makeGetTripUseCase } from '../../application/trips/get-trip.js';
import { makeListTripsUseCase } from '../../application/trips/list-trips.js';
import { makeUpdateTripUseCase } from '../../application/trips/update-trip.js';
import { makeDeleteTripUseCase } from '../../application/trips/delete-trip.js';
import { makeGetTripSuggestionsUseCase } from '../../application/trips/get-trip-suggestions.js';

export function createTripsRouter(deps: { repos: Repositories }): Router {
  const router = Router();

  const createTrip = makeCreateTripUseCase({ tripRepo: deps.repos.tripRepo });
  const getTrip = makeGetTripUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
    cityRepo: deps.repos.cityRepo,
  });
  const listTrips = makeListTripsUseCase({ tripRepo: deps.repos.tripRepo });
  const updateTrip = makeUpdateTripUseCase({ tripRepo: deps.repos.tripRepo });
  const deleteTrip = makeDeleteTripUseCase({ tripRepo: deps.repos.tripRepo });
  const getSuggestions = makeGetTripSuggestionsUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
    cityRepo: deps.repos.cityRepo,
    activityRepo: deps.repos.activityRepo,
  });

  // POST /api/v1/trips
  router.post('/', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createTripSchema.parse(req.body);
      const trip = await createTrip(req.currentUserId!, input);
      res.status(201).json(trip);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/trips
  router.get('/', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listTripsQuerySchema.parse(req.query);
      const result = await listTrips({
        userId: req.currentUserId!,
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/trips/:id
  router.get('/:id', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.id as string;
      const trip = await getTrip(req.currentUserId!, tripId);
      res.setHeader('ETag', `"${trip.lockVersion}"`);
      res.status(200).json(trip);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/trips/:id
  router.patch('/:id', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.id as string;
      const input = updateTripSchema.parse(req.body);
      const ifMatch = req.headers['if-match'];
      const lockVersion = ifMatch ? parseInt(ifMatch.replace(/"/g, ''), 10) : undefined;

      const trip = await updateTrip(req.currentUserId!, tripId, input, lockVersion);
      res.setHeader('ETag', `"${trip.lockVersion}"`);
      res.status(200).json(trip);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/trips/:id
  router.delete('/:id', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.id as string;
      await deleteTrip(req.currentUserId!, tripId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/trips/:id/suggestions
  router.get('/:id/suggestions', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.id as string;
      const suggestions = await getSuggestions(req.currentUserId!, tripId);
      res.status(200).json(suggestions);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
