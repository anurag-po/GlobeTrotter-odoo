import type { TripRepository, TripStopRepository, CityRepository } from '../ports/repositories.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';
import type { TripProps } from '../../domain/entities/trip.js';
import type { TripStopProps } from '../../domain/entities/trip-stop.js';
import type { CityProps } from '../../domain/entities/city.js';

export interface TripDetailOutput extends TripProps {
  stops: Array<TripStopProps & { city?: CityProps | null }>;
}

export function makeGetTripUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  cityRepo: CityRepository;
}) {
  return async (userId: string, tripId: string): Promise<TripDetailOutput> => {
    const trip = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!trip) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');
    }

    const stops = await deps.tripStopRepo.findByTripId(tripId);
    const enrichedStops: Array<TripStopProps & { city?: CityProps | null }> = [];

    for (const stop of stops) {
      let city: CityProps | null = null;
      if (stop.cityId) {
        const cityEntity = await deps.cityRepo.findById(stop.cityId);
        if (cityEntity) city = cityEntity.props;
      }
      enrichedStops.push({
        ...stop.props,
        city,
      });
    }

    return {
      ...trip.props,
      stops: enrichedStops,
    };
  };
}
