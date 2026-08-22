import type { CityRepository, CityFilters } from '../ports/repositories.js';
import type { CityProps } from '../../domain/entities/city.js';
import type { PaginatedResponse } from '../../shared/types/pagination.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export function makeSearchCitiesUseCase(deps: { cityRepo: CityRepository }) {
  return async (filters: CityFilters): Promise<PaginatedResponse<CityProps>> => {
    const result = await deps.cityRepo.findAll(filters);
    return {
      ...result,
      items: result.items.map((c) => c.props),
    };
  };
}

export function makeGetCityUseCase(deps: { cityRepo: CityRepository }) {
  return async (cityId: string): Promise<CityProps> => {
    const city = await deps.cityRepo.findById(cityId);
    if (!city) {
      throw AppError.notFound(ErrorCodes.CITY_NOT_FOUND, 'City not found');
    }
    return city.props;
  };
}
