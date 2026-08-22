import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth-guard.js';
import { userRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import { makeGetCalendarUseCase } from '../../application/calendar/get-calendar.js';

const calendarQuerySchema = z.object({
  startMonth: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).default('2026-01-01'),
  endMonth: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).default('2026-12-31'),
});

export function createCalendarRouter(deps: { repos: Repositories }): Router {
  const router = Router();
  const getCalendar = makeGetCalendarUseCase({ tripRepo: deps.repos.tripRepo });

  // GET /api/v1/trips/calendar
  router.get('/trips/calendar', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = calendarQuerySchema.parse(req.query);
      const result = await getCalendar(req.currentUserId!, query.startMonth, query.endMonth);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
