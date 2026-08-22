import type { TripRepository } from '../ports/repositories.js';
import { generateShareToken } from '../../domain/value-objects/share-token.js';
import { config } from '../../config/index.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export function makePublishTripUseCase(deps: { tripRepo: TripRepository }) {
  return async (
    userId: string,
    tripId: string
  ): Promise<{ isPublic: boolean; shareUrl: string; shareToken: string }> => {
    const trip = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!trip) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');

    // If already public, return existing token
    if (trip.isPublic && trip.shareToken) {
      return {
        isPublic: true,
        shareToken: trip.shareToken,
        shareUrl: `${config.PUBLIC_APP_BASE_URL}/trips/share/${trip.shareToken}`,
      };
    }

    const shareToken = generateShareToken();
    await deps.tripRepo.update(tripId, userId, {
      isPublic: true,
      shareToken,
      sharedAt: new Date(),
    });

    return {
      isPublic: true,
      shareToken,
      shareUrl: `${config.PUBLIC_APP_BASE_URL}/trips/share/${shareToken}`,
    };
  };
}

export function makeUnpublishTripUseCase(deps: { tripRepo: TripRepository }) {
  return async (userId: string, tripId: string): Promise<{ isPublic: boolean }> => {
    const trip = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!trip) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');

    // ARCH-036: clear token completely
    await deps.tripRepo.update(tripId, userId, {
      isPublic: false,
      shareToken: null,
      sharedAt: null,
    });

    return { isPublic: false };
  };
}
