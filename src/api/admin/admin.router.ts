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
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 50;
      const result = await deps.repos.userRepo.findAll({
        page,
        pageSize,
        search: req.query.search as string,
        status: req.query.status as string,
        role: req.query.role as string,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/admin/users/:id/status
  router.patch('/users/:id/status', requireAuth, requireAdmin, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.id as string;
      const { status } = req.body;
      const user = await deps.repos.userRepo.update(targetUserId, { status });
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/admin/users/:id/role
  router.patch('/users/:id/role', requireAuth, requireAdmin, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.id as string;
      const { role } = req.body;
      const user = await deps.repos.userRepo.update(targetUserId, { role });
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/admin/users/:id (Purge / Accept Data Deletion)
  router.delete('/users/:id', requireAuth, requireAdmin, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.id as string;
      await deps.repos.userRepo.softDelete(targetUserId);
      res.status(200).json({ success: true, message: 'User data purged successfully' });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/admin/users (Create new Admin)
  router.post('/users', requireAuth, requireAdmin, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName, username, role } = req.body;
      const { PasswordHasher } = await import('../../infrastructure/auth/password-hasher.js');
      const passwordHash = await PasswordHasher.hash(password || 'AdminPassword123!');
      const user = await deps.repos.userRepo.create({
        email,
        passwordHash,
        username: username || email.split('@')[0],
        firstName: firstName || 'Admin',
        lastName: lastName || 'User',
        role: role || 'admin',
        status: 'active',
        hasVerifiedEmail: true,
      });
      res.status(201).json(user);
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
