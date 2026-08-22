import type { TripRepository, TripStopRepository, ItineraryItemRepository, CityRepository, ActivityRepository, UserRepository } from '../ports/repositories.js';
import type { JobService } from '../ports/services.js';
import type { TripProps } from '../../domain/entities/trip.js';
import type { TripStopProps } from '../../domain/entities/trip-stop.js';
import type { ItineraryItemProps } from '../../domain/entities/itinerary-item.js';
import type { CityProps } from '../../domain/entities/city.js';
import type { ActivityProps } from '../../domain/entities/activity.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export interface PublicTripOutput {
  id: string;
  name: string;
  description: string | null | undefined;
  coverPhotoUrl: string | null | undefined;
  startDate: string;
  endDate: string;
  currencyCode: string;
  estimatedBudgetTotal: string;
  ownerFirstName: string;
  stops: Array<
    TripStopProps & {
      city?: CityProps | null;
      items: Array<ItineraryItemProps & { activity?: ActivityProps | null }>;
    }
  >;
}

export function makeGetPublicTripUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  itineraryItemRepo: ItineraryItemRepository;
  cityRepo: CityRepository;
  activityRepo: ActivityRepository;
  userRepo: UserRepository;
  jobService?: JobService;
}) {
  return async (shareToken: string): Promise<PublicTripOutput> => {
    const trip = await deps.tripRepo.findByShareToken(shareToken);
    if (!trip || !trip.isPublic) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND_OR_NOT_PUBLIC, 'Trip not found or is private');
    }

    // Fire-and-forget view count increment (BR-021)
    if (deps.jobService) {
      deps.jobService.enqueue('increment-view-count', { tripId: trip.id }).catch(() => {});
    } else {
      deps.tripRepo.incrementViewCount(trip.id).catch(() => {});
    }

    const owner = await deps.userRepo.findById(trip.userId);
    const stops = await deps.tripStopRepo.findByTripId(trip.id);

    const enrichedStops: PublicTripOutput['stops'] = [];

    for (const stop of stops) {
      let city: CityProps | null = null;
      if (stop.cityId) {
        const c = await deps.cityRepo.findById(stop.cityId);
        if (c) city = c.props;
      }

      const items = await deps.itineraryItemRepo.findByStopId(stop.id);
      const enrichedItems: Array<ItineraryItemProps & { activity?: ActivityProps | null }> = [];

      for (const item of items) {
        let activity: ActivityProps | null = null;
        if (item.activityId) {
          const a = await deps.activityRepo.findById(item.activityId);
          if (a) activity = a.props;
        }
        enrichedItems.push({
          ...item.props,
          activity,
        });
      }

      enrichedStops.push({
        ...stop.props,
        city,
        items: enrichedItems,
      });
    }

    return {
      id: trip.id,
      name: trip.name,
      description: trip.description,
      coverPhotoUrl: trip.coverPhotoUrl,
      startDate: trip.startDate,
      endDate: trip.endDate,
      currencyCode: trip.currencyCode,
      estimatedBudgetTotal: trip.estimatedBudgetTotal,
      ownerFirstName: owner?.firstName || 'Traveler',
      stops: enrichedStops,
    };
  };
}

export function makeCopyTripUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  itineraryItemRepo: ItineraryItemRepository;
}) {
  return async (userId: string, shareToken: string): Promise<TripProps> => {
    const sourceTrip = await deps.tripRepo.findByShareToken(shareToken);
    if (!sourceTrip || !sourceTrip.isPublic) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND_OR_NOT_PUBLIC, 'Trip not found or is private');
    }

    // BR-005: Create new trip owned by copier
    const newTrip = await deps.tripRepo.create({
      userId,
      name: `Copy of ${sourceTrip.name}`,
      description: sourceTrip.description,
      coverPhotoUrl: sourceTrip.coverPhotoUrl,
      startDate: sourceTrip.startDate,
      endDate: sourceTrip.endDate,
      status: 'draft',
      currencyCode: sourceTrip.currencyCode,
      isPublic: false,
      primaryTimezone: sourceTrip.primaryTimezone,
      shareToken: null,
      sharedAt: null,
      sourceTripId: sourceTrip.id,
      deletedAt: null,
    });

    const stops = await deps.tripStopRepo.findByTripId(sourceTrip.id);

    for (const stop of stops) {
      const newStop = await deps.tripStopRepo.create({
        tripId: newTrip.id,
        cityId: stop.cityId,
        customPlaceName: stop.customPlaceName,
        sequenceOrder: stop.sequenceOrder,
        startDate: stop.startDate,
        endDate: stop.endDate,
        description: stop.description,
        budgetAmount: stop.budgetAmount,
      });

      const items = await deps.itineraryItemRepo.findByStopId(stop.id);
      for (const item of items) {
        await deps.itineraryItemRepo.create({
          tripStopId: newStop.id,
          activityId: item.activityId,
          customName: item.customName,
          costCategory: item.costCategory,
          itemDate: item.itemDate,
          startTime: item.startTime,
          endTime: item.endTime,
          cost: item.cost,
          currencyCode: item.currencyCode,
          sequenceOrder: item.sequenceOrder,
          notes: item.notes,
        });
      }
    }

    // BR-022: increment copy_count on source trip
    await deps.tripRepo.incrementCopyCount(sourceTrip.id);

    return newTrip.props;
  };
}
