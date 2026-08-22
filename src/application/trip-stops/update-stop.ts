import type { TripRepository, TripStopRepository, CityRepository } from '../ports/repositories.js';
import { TripRules } from '../../domain/rules/trip-rules.js';
import type { TripStopProps } from '../../domain/entities/trip-stop.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export interface UpdateStopInput {
  cityId?: string | null;
  customPlaceName?: string | null;
  startDate?: string;
  endDate?: string;
  description?: string | null;
  budgetAmount?: string | null;
}

export function makeUpdateStopUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  cityRepo: CityRepository;
}) {
  return async (
    userId: string,
    tripId: string,
    stopId: string,
    input: UpdateStopInput,
    expectedLockVersion?: number
  ): Promise<TripStopProps> => {
    const trip = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!trip) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');

    const stop = await deps.tripStopRepo.findById(stopId);
    if (!stop || stop.tripId !== tripId) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip stop not found');
    }

    const newStart = input.startDate || stop.startDate;
    const newEnd = input.endDate || stop.endDate;
    TripRules.validateStopDates(newStart, newEnd, trip.startDate, trip.endDate);

    const updated = await deps.tripStopRepo.update(
      stopId,
      {
        cityId: input.cityId !== undefined ? input.cityId : stop.cityId,
        customPlaceName: input.customPlaceName !== undefined ? input.customPlaceName : stop.customPlaceName,
        startDate: newStart,
        endDate: newEnd,
        description: input.description !== undefined ? input.description : stop.description,
        budgetAmount: input.budgetAmount !== undefined ? input.budgetAmount : stop.budgetAmount,
      },
      expectedLockVersion
    );

    return updated.props;
  };
}

export function makeDeleteStopUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
}) {
  return async (userId: string, tripId: string, stopId: string): Promise<void> => {
    const trip = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!trip) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');

    const stop = await deps.tripStopRepo.findById(stopId);
    if (!stop || stop.tripId !== tripId) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip stop not found');
    }

    const deletedSeq = await deps.tripStopRepo.delete(stopId);
    await deps.tripStopRepo.resequenceAfterDelete(tripId, deletedSeq);
  };
}

export function makeReorderStopsUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
}) {
  return async (userId: string, tripId: string, orderedStopIds: string[]): Promise<TripStopProps[]> => {
    const trip = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!trip) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');

    const count = await deps.tripStopRepo.countByTripId(tripId);
    if (orderedStopIds.length !== count) {
      throw AppError.validation('Ordered stop IDs list must contain all stop IDs for the trip');
    }

    const stops = await deps.tripStopRepo.reorder(tripId, orderedStopIds);
    return stops.map((s) => s.props);
  };
}
