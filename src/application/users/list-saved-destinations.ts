import type { SavedDestinationRepository } from '../ports/repositories.js';
import type { CityProps } from '../../domain/entities/city.js';

export function makeListSavedDestinationsUseCase(deps: { savedDestinationRepo: SavedDestinationRepository }) {
  return async (userId: string): Promise<CityProps[]> => {
    const cities = await deps.savedDestinationRepo.findByUserId(userId);
    return cities.map((c) => c.props);
  };
}
