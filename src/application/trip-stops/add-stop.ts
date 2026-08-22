import type { TripRepository, TripStopRepository, CityRepository } from '../ports/repositories.js';
import { TripRules } from '../../domain/rules/trip-rules.js';
import type { TripStopProps } from '../../domain/entities/trip-stop.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export interface AddStopInput {
  cityId?: string | null;
  customPlaceName?: string | null;
  startDate: string;
  endDate: string;
  description?: string | null;
  budgetAmount?: string | null;
}

export function makeAddStopUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  cityRepo: CityRepository;
}) {
  return async (userId: string, tripId: string, input: AddStopInput): Promise<TripStopProps> => {
    // 1. Verify parent trip ownership
    const trip = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!trip) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');
    }

    // 2. XOR check (BR-013)
    if (!input.cityId && !input.customPlaceName) {
      throw AppError.validation('Must provide either cityId or customPlaceName');
    }
    if (input.cityId && input.customPlaceName) {
      throw AppError.validation('Cannot provide both cityId and customPlaceName');
    }

    // 3. City existence check if cityId provided
    if (input.cityId) {
      const city = await deps.cityRepo.findById(input.cityId);
      if (!city) {
        throw AppError.notFound(ErrorCodes.CITY_NOT_FOUND, 'City not found');
      }
    }

    // 4. Validate stop date bounds (BR-002)
    TripRules.validateStopDates(input.startDate, input.endDate, trip.startDate, trip.endDate);

    // 5. Sequence calculation
    const nextSeq = await deps.tripStopRepo.getNextSequence(tripId);

    const stop = await deps.tripStopRepo.create({
      tripId,
      cityId: input.cityId || null,
      customPlaceName: input.customPlaceName || null,
      sequenceOrder: nextSeq,
      startDate: input.startDate,
      endDate: input.endDate,
      description: input.description || null,
      budgetAmount: input.budgetAmount || null,
    });

    return stop.props;
  };
}
