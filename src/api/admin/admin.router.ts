import { Router, type Request, type Response, type NextFunction } from 'express';
import { updateUserStatusSchema, listUsersQuerySchema } from './admin.schemas.js';
import { requireAuth } from '../middleware/auth-guard.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { userRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import { makeListUsersUseCase, makeUpdateUserStatusUseCase } from '../../application/admin/list-users.js';
import { makeGetAnalyticsUseCase } from '../../application/admin/analytics.js';

export function createAdminRouter(deps: { repos: Repositories }): Router {
  const router = Router();

  const listUsers = makeListUsersUseCase({ userRepo: deps.repos.userRepo });
  const updateUserStatus = makeUpdateUserStatusUseCase({
    userRepo: deps.repos.userRepo,
    authTokenRepo: deps.repos.authTokenRepo,
    auditLogRepo: deps.repos.auditLogRepo,
  });
  const analytics = makeGetAnalyticsUseCase({
    cityRepo: deps.repos.cityRepo,
    activityRepo: deps.repos.activityRepo,
    tripRepo: deps.repos.tripRepo,
  });

  // GET /api/v1/admin/users
  router.get('/users', requireAuth, requireAdmin, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listUsersQuerySchema.parse(req.query);
      const result = await listUsers(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/admin/users/:id/status
  router.patch('/users/:id/status', requireAuth, requireAdmin, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.id as string;
      const input = updateUserStatusSchema.parse(req.body);
      const user = await updateUserStatus(req.currentUserId!, targetUserId, input.status);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/admin/analytics/popular-cities
  router.get('/analytics/popular-cities', requireAuth, requireAdmin, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const items = await analytics.getPopularCities(limit);
      res.status(200).json({ items });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/admin/analytics/popular-activities
  router.get('/analytics/popular-activities', requireAuth, requireAdmin, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const items = await analytics.getPopularActivities(limit);
      res.status(200).json({ items });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/admin/analytics/trends
  router.get('/analytics/trends', requireAuth, requireAdmin, userRateLimiter, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const trends = await analytics.getTrends();
      res.status(200).json(trends);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
