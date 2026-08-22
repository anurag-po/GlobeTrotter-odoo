import type { TripRepository, TripFilters } from '../ports/repositories.js';
import type { TripProps } from '../../domain/entities/trip.js';
import type { PaginatedResponse } from '../../shared/types/pagination.js';

export function makeListTripsUseCase(deps: { tripRepo: TripRepository }) {
  return async (filters: TripFilters): Promise<PaginatedResponse<TripProps>> => {
    const result = await deps.tripRepo.findAll(filters);
    return {
      ...result,
      items: result.items.map((t) => t.props),
    };
  };
}
