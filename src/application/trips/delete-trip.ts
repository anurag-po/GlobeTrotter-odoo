import type { TripRepository } from '../ports/repositories.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export function makeDeleteTripUseCase(deps: { tripRepo: TripRepository }) {
  return async (userId: string, tripId: string): Promise<void> => {
    const existing = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!existing) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');
    }
    await deps.tripRepo.softDelete(tripId, userId);
  };
}
