import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth-guard.js';
import { userRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import { makeGetBudgetBreakdownUseCase } from '../../application/budget/get-budget-breakdown.js';

export function createBudgetRouter(deps: { repos: Repositories }): Router {
  const router = Router();
  const getBudget = makeGetBudgetBreakdownUseCase({
    tripRepo: deps.repos.tripRepo,
    tripStopRepo: deps.repos.tripStopRepo,
    itineraryItemRepo: deps.repos.itineraryItemRepo,
  });

  // GET /api/v1/trips/:id/budget
  router.get('/trips/:id/budget', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tripId = req.params.id as string;
      const breakdown = await getBudget(req.currentUserId!, tripId);
      res.status(200).json(breakdown);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
