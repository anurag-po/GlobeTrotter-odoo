import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth-guard.js';
import { userRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import { makeGetDashboardUseCase } from '../../application/dashboard/get-dashboard.js';

export function createDashboardRouter(deps: { repos: Repositories }): Router {
  const router = Router();
  const getDashboard = makeGetDashboardUseCase({
    tripRepo: deps.repos.tripRepo,
    cityRepo: deps.repos.cityRepo,
    userRepo: deps.repos.userRepo,
  });

  // GET /api/v1/dashboard
  router.get('/dashboard', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getDashboard(req.currentUserId!);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
