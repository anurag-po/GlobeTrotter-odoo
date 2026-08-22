import type { TripRepository } from '../ports/repositories.js';
import { TripRules } from '../../domain/rules/trip-rules.js';
import { TripStateMachine } from '../../domain/state-machines/trip-status.js';
import type { TripProps, TripStatus } from '../../domain/entities/trip.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export interface UpdateTripInput {
  name?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string;
  coverPhotoUrl?: string | null;
  status?: TripStatus;
  currencyCode?: string;
}

export function makeUpdateTripUseCase(deps: { tripRepo: TripRepository }) {
  return async (
    userId: string,
    tripId: string,
    input: UpdateTripInput,
    expectedLockVersion?: number
  ): Promise<TripProps> => {
    const existing = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!existing) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');
    }

    const newStart = input.startDate || existing.startDate;
    const newEnd = input.endDate || existing.endDate;
    TripRules.validateTripDates(newStart, newEnd);

    if (input.status && input.status !== existing.status) {
      TripStateMachine.assertTransition(existing.status, input.status);
    }

    const updated = await deps.tripRepo.update(
      tripId,
      userId,
      {
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        startDate: newStart,
        endDate: newEnd,
        coverPhotoUrl: input.coverPhotoUrl !== undefined ? input.coverPhotoUrl : existing.coverPhotoUrl,
        status: input.status ?? existing.status,
        currencyCode: input.currencyCode ?? existing.currencyCode,
      },
      expectedLockVersion
    );

    return updated.props;
  };
}
