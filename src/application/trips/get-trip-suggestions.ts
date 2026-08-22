import type { TripRepository, TripStopRepository, CityRepository, ActivityRepository } from '../ports/repositories.js';
import type { CityProps } from '../../domain/entities/city.js';
import type { ActivityProps } from '../../domain/entities/activity.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export function makeGetTripSuggestionsUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  cityRepo: CityRepository;
  activityRepo: ActivityRepository;
}) {
  return async (
    userId: string,
    tripId: string
  ): Promise<{ cities: CityProps[]; activities: ActivityProps[] }> => {
    const trip = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!trip) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');
    }

    const stops = await deps.tripStopRepo.findByTripId(tripId);
    const cityIds = stops.map((s) => s.cityId).filter((id): id is string => Boolean(id));

    const activities: ActivityProps[] = [];
    for (const cityId of cityIds) {
      const cityActs = await deps.activityRepo.findByCityId(cityId);
      activities.push(...cityActs.map((a) => a.props));
    }

    const popularCities = await deps.cityRepo.getPopular(6);
    const popularActivities = await deps.activityRepo.getPopular(10);

    return {
      cities: popularCities.map((c) => c.props),
      activities: activities.length > 0 ? activities.slice(0, 10) : popularActivities.map((a) => a.props),
    };
  };
}
