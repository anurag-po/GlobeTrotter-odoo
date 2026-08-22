import type { TripRepository } from '../ports/repositories.js';
import { TripRules } from '../../domain/rules/trip-rules.js';
import type { TripProps } from '../../domain/entities/trip.js';

export interface CreateTripInput {
  name: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  coverPhotoUrl?: string | null;
  currencyCode?: string;
}

export function makeCreateTripUseCase(deps: { tripRepo: TripRepository }) {
  return async (userId: string, input: CreateTripInput): Promise<TripProps> => {
    TripRules.validateTripDates(input.startDate, input.endDate);

    const trip = await deps.tripRepo.create({
      userId,
      name: input.name,
      description: input.description || null,
      coverPhotoUrl: input.coverPhotoUrl || null,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'draft',
      currencyCode: input.currencyCode || 'USD',
      isPublic: false,
      primaryTimezone: null,
      shareToken: null,
      sharedAt: null,
      sourceTripId: null,
      deletedAt: null,
    });

    return trip.props;
  };
}
