import { Router, type Request, type Response, type NextFunction } from 'express';
import { addItemSchema, updateItemSchema } from './itinerary.schemas.js';
import { requireAuth } from '../middleware/auth-guard.js';
import { userRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import { makeAddItemUseCase } from '../../application/itinerary/add-item.js';
import { makeUpdateItemUseCase, makeDeleteItemUseCase } from '../../application/itinerary/update-item.js';
import { makeGetItineraryUseCase } from '../../application/itinerary/get-itinerary.js';

export function createItineraryRouter(deps: { repos: Repositories }): {
  tripStopItemsRouter: Router;
  tripItineraryRouter: Router;
} {
  const tripStopItemsRouter = Router({ mergeParams: true });
  const tripItineraryRouter = Router({ mergeParams: true });

  const addItem = makeAddItemUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
    itineraryItemRepo: deps.repos.itineraryItemRepo,
    activityRepo: deps.repos.activityRepo,
  });

  const updateItem = makeUpdateItemUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
    itineraryItemRepo: deps.repos.itineraryItemRepo,
  });

  const deleteItem = makeDeleteItemUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
    itineraryItemRepo: deps.repos.itineraryItemRepo,
  });

  const getItinerary = makeGetItineraryUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
    itineraryItemRepo: deps.repos.itineraryItemRepo,
    activityRepo: deps.repos.activityRepo,
  });

  // POST /api/v1/trip-stops/:stopId/items
  tripStopItemsRouter.post('/:stopId/items', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stopId = req.params.stopId as string;
      const input = addItemSchema.parse(req.body);
      const item = await addItem(req.currentUserId!, stopId, {
        ...input,
        startTime: input.startTime ? new Date(input.startTime) : null,
        endTime: input.endTime ? new Date(input.endTime) : null,
      });
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/trip-stops/:stopId/items/:itemId
  tripStopItemsRouter.patch('/:stopId/items/:itemId', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stopId = req.params.stopId as string;
      const itemId = req.params.itemId as string;
      const input = updateItemSchema.parse(req.body);
      const item = await updateItem(req.currentUserId!, stopId, itemId, {
        ...input,
        startTime: input.startTime ? new Date(input.startTime) : undefined,
        endTime: input.endTime ? new Date(input.endTime) : undefined,
      });
      res.status(200).json(item);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/trip-stops/:stopId/items/:itemId
  tripStopItemsRouter.delete('/:stopId/items/:itemId', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stopId = req.params.stopId as string;
      const itemId = req.params.itemId as string;
      await deleteItem(req.currentUserId!, stopId, itemId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/trips/:tripId/itinerary
  tripItineraryRouter.get('/:tripId/itinerary', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.tripId as string;
      const result = await getItinerary(req.currentUserId!, tripId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return { tripStopItemsRouter, tripItineraryRouter };
}
