import type { SavedDestinationRepository, CityRepository } from '../ports/repositories.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export function makeSaveDestinationUseCase(deps: {
  savedDestinationRepo: SavedDestinationRepository;
  cityRepo: CityRepository;
}) {
  return async (userId: string, cityId: string): Promise<void> => {
    const city = await deps.cityRepo.findById(cityId);
    if (!city) {
      throw AppError.notFound(ErrorCodes.CITY_NOT_FOUND, 'City not found');
    }
    await deps.savedDestinationRepo.save(userId, cityId);
  };
}

export function makeUnsaveDestinationUseCase(deps: {
  savedDestinationRepo: SavedDestinationRepository;
}) {
  return async (userId: string, cityId: string): Promise<void> => {
    await deps.savedDestinationRepo.unsave(userId, cityId);
  };
}
