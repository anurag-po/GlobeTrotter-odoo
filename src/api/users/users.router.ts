import { Router, type Request, type Response, type NextFunction } from 'express';
import { updateProfileSchema, deleteAccountSchema, saveDestinationSchema } from './users.schemas.js';
import { requireAuth } from '../middleware/auth-guard.js';
import { userRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import { makeGetProfileUseCase } from '../../application/users/get-profile.js';
import { makeUpdateProfileUseCase } from '../../application/users/update-profile.js';
import { makeDeleteAccountUseCase } from '../../application/users/delete-account.js';
import { makeListSavedDestinationsUseCase } from '../../application/users/list-saved-destinations.js';
import { makeSaveDestinationUseCase, makeUnsaveDestinationUseCase } from '../../application/users/save-destination.js';

export function createUsersRouter(deps: { repos: Repositories }): Router {
  const router = Router();

  const getProfile = makeGetProfileUseCase({ userRepo: deps.repos.userRepo });
  const updateProfile = makeUpdateProfileUseCase({ userRepo: deps.repos.userRepo });
  const deleteAccount = makeDeleteAccountUseCase({
    userRepo: deps.repos.userRepo,
    authTokenRepo: deps.repos.authTokenRepo,
    tripRepo: deps.repos.tripRepo,
    auditLogRepo: deps.repos.auditLogRepo,
  });
  const listSaved = makeListSavedDestinationsUseCase({ savedDestinationRepo: deps.repos.savedDestinationRepo });
  const saveDest = makeSaveDestinationUseCase({
    savedDestinationRepo: deps.repos.savedDestinationRepo,
    cityRepo: deps.repos.cityRepo,
  });
  const unsaveDest = makeUnsaveDestinationUseCase({ savedDestinationRepo: deps.repos.savedDestinationRepo });

  // GET /api/v1/users/me
  router.get('/me', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getProfile(req.currentUserId!);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/v1/users/me
  router.patch('/me', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = updateProfileSchema.parse(req.body);
      const user = await updateProfile(req.currentUserId!, input);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/users/me
  router.delete('/me', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = deleteAccountSchema.parse(req.body);
      await deleteAccount(req.currentUserId!, input.password);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/users/me/saved-destinations
  router.get('/me/saved-destinations', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await listSaved(req.currentUserId!);
      res.status(200).json({ items });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/users/me/saved-destinations
  router.post('/me/saved-destinations', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = saveDestinationSchema.parse(req.body);
      await saveDest(req.currentUserId!, input.cityId);
      res.status(201).json({ message: 'Destination saved' });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/users/me/saved-destinations/:cityId
  router.delete('/me/saved-destinations/:cityId', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cityId = req.params.cityId as string;
      await unsaveDest(req.currentUserId!, cityId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
