import { Router, type Request, type Response, type NextFunction } from 'express';
import { cityQuerySchema, activityQuerySchema } from './catalog.schemas.js';
import { publicRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import { makeSearchCitiesUseCase, makeGetCityUseCase } from '../../application/catalog/search-cities.js';
import { makeSearchActivitiesUseCase, makeGetActivityUseCase } from '../../application/catalog/search-activities.js';

export function createCatalogRouter(deps: { repos: Repositories }): {
  citiesRouter: Router;
  activitiesRouter: Router;
} {
  const citiesRouter = Router();
  const activitiesRouter = Router();

  const searchCities = makeSearchCitiesUseCase({ cityRepo: deps.repos.cityRepo });
  const getCity = makeGetCityUseCase({ cityRepo: deps.repos.cityRepo });
  const searchActivities = makeSearchActivitiesUseCase({ activityRepo: deps.repos.activityRepo });
  const getActivity = makeGetActivityUseCase({ activityRepo: deps.repos.activityRepo });

  // GET /api/v1/cities
  citiesRouter.get('/', publicRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = cityQuerySchema.parse(req.query);
      const result = await searchCities({
        query: query.q,
        countryCode: query.countryCode,
        region: query.region,
        page: query.page,
        pageSize: query.pageSize,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/cities/:id
  citiesRouter.get('/:id', publicRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cityId = req.params.id as string;
      const city = await getCity(cityId);
      res.status(200).json(city);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/activities
  activitiesRouter.get('/', publicRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = activityQuerySchema.parse(req.query);
      const result = await searchActivities({
        cityId: query.cityId,
        query: query.q,
        category: query.category,
        page: query.page,
        pageSize: query.pageSize,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/activities/:id
  activitiesRouter.get('/:id', publicRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const activityId = req.params.id as string;
      const act = await getActivity(activityId);
      res.status(200).json(act);
    } catch (err) {
      next(err);
    }
  });

  return { citiesRouter, activitiesRouter };
}
