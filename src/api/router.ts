import { Router } from 'express';
import type { Repositories } from '../infrastructure/db/repositories/index.js';
import type { StorageService, JobService } from '../application/ports/services.js';
import { createAuthRouter } from './auth/auth.router.js';
import { createUsersRouter } from './users/users.router.js';
import { createCatalogRouter } from './catalog/catalog.router.js';
import { createTripsRouter } from './trips/trips.router.js';
import { createTripStopsRouter } from './trip-stops/trip-stops.router.js';
import { createItineraryRouter } from './itinerary/itinerary.router.js';
import { createBudgetRouter } from './budget/budget.router.js';
import { createCalendarRouter } from './calendar/calendar.router.js';
import { createSharingRouter } from './sharing/sharing.router.js';
import { createCommunityRouter } from './community/community.router.js';
import { createAdminRouter } from './admin/admin.router.js';
import { createDashboardRouter } from './dashboard/dashboard.router.js';
import { createMediaRouter } from './media/media.router.js';

export function createApiRouter(deps: {
  repos: Repositories;
  storageService: StorageService;
  jobService?: JobService;
}): Router {
  const router = Router();

  const authRouter = createAuthRouter(deps);
  const usersRouter = createUsersRouter(deps);
  const { citiesRouter, activitiesRouter } = createCatalogRouter(deps);
  const tripsRouter = createTripsRouter(deps);
  const tripStopsRouter = createTripStopsRouter(deps);
  const { tripStopItemsRouter, tripItineraryRouter } = createItineraryRouter(deps);
  const budgetRouter = createBudgetRouter(deps);
  const calendarRouter = createCalendarRouter(deps);
  const { tripShareRouter, publicShareRouter } = createSharingRouter(deps);
  const communityRouter = createCommunityRouter(deps);
  const adminRouter = createAdminRouter(deps);
  const dashboardRouter = createDashboardRouter(deps);
  const mediaRouter = createMediaRouter(deps);

  // Mount routes - specific routes first
  router.use('/auth', authRouter);
  router.use('/users', usersRouter);
  router.use('/cities', citiesRouter);
  router.use('/activities', activitiesRouter);
  router.use('/', calendarRouter); // /trips/calendar
  router.use('/', budgetRouter);   // /trips/:id/budget
  router.use('/', tripShareRouter); // /trips/:id/share
  router.use('/trips', tripStopsRouter); // /trips/:tripId/stops
  router.use('/trips', tripItineraryRouter); // /trips/:tripId/itinerary
  router.use('/trips', tripsRouter); // /trips, /trips/:id
  router.use('/trip-stops', tripStopItemsRouter);
  router.use('/public', publicShareRouter);
  router.use('/community', communityRouter);
  router.use('/admin', adminRouter);
  router.use('/', dashboardRouter);
  router.use('/', mediaRouter);

  return router;
}
