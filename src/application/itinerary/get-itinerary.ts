import type { TripRepository, TripStopRepository, ItineraryItemRepository, ActivityRepository } from '../ports/repositories.js';
import type { TripStopProps } from '../../domain/entities/trip-stop.js';
import type { ItineraryItemProps } from '../../domain/entities/itinerary-item.js';
import type { ActivityProps } from '../../domain/entities/activity.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export interface ItineraryStopOutput extends TripStopProps {
  items: Array<ItineraryItemProps & { activity?: ActivityProps | null }>;
}

export function makeGetItineraryUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  itineraryItemRepo: ItineraryItemRepository;
  activityRepo: ActivityRepository;
}) {
  return async (userId: string, tripId: string): Promise<{ stops: ItineraryStopOutput[] }> => {
    const trip = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!trip) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');

    const stops = await deps.tripStopRepo.findByTripId(tripId);
    const result: ItineraryStopOutput[] = [];

    for (const stop of stops) {
      const items = await deps.itineraryItemRepo.findByStopId(stop.id);
      const enrichedItems: Array<ItineraryItemProps & { activity?: ActivityProps | null }> = [];

      for (const item of items) {
        let activity: ActivityProps | null = null;
        if (item.activityId) {
          const act = await deps.activityRepo.findById(item.activityId);
          if (act) activity = act.props;
        }
        enrichedItems.push({
          ...item.props,
          activity,
        });
      }

      result.push({
        ...stop.props,
        items: enrichedItems,
      });
    }

    return { stops: result };
  };
}
