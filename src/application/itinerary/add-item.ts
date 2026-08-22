import type { TripRepository, TripStopRepository, ItineraryItemRepository, ActivityRepository } from '../ports/repositories.js';
import { TripRules } from '../../domain/rules/trip-rules.js';
import type { ItineraryItemProps, CostCategory } from '../../domain/entities/itinerary-item.js';
import { toDecimalString } from '../../shared/utils/decimal.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export interface AddItemInput {
  activityId?: string | null;
  customName?: string | null;
  costCategory: CostCategory;
  itemDate: string;
  startTime?: Date | null;
  endTime?: Date | null;
  cost?: string;
  currencyCode?: string;
  notes?: string | null;
}

export function makeAddItemUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  itineraryItemRepo: ItineraryItemRepository;
  activityRepo: ActivityRepository;
}) {
  return async (userId: string, stopId: string, input: AddItemInput): Promise<ItineraryItemProps> => {
    // 1. Verify parent stop exists
    const stop = await deps.tripStopRepo.findById(stopId);
    if (!stop) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip stop not found');

    // 2. Verify trip ownership
    const trip = await deps.tripRepo.findByIdAndOwner(stop.tripId, userId);
    if (!trip) throw AppError.forbidden('You do not have access to this trip');

    // 3. XOR check (BR-014)
    if (!input.activityId && !input.customName) {
      throw AppError.validation('Must provide either activityId or customName');
    }
    if (input.activityId && input.customName) {
      throw AppError.validation('Cannot provide both activityId and customName');
    }

    // 4. Validate item date within stop date range (BR-002)
    TripRules.validateItemDate(input.itemDate, stop.startDate, stop.endDate);

    // 5. Activity existence check if activityId provided
    if (input.activityId) {
      const activity = await deps.activityRepo.findById(input.activityId);
      if (!activity) {
        throw AppError.notFound(ErrorCodes.ACTIVITY_NOT_FOUND, 'Activity not found');
      }
    }

    const nextSeq = await deps.itineraryItemRepo.getNextSequence(stopId, input.itemDate);
    const cost = toDecimalString(input.cost);

    const item = await deps.itineraryItemRepo.create({
      tripStopId: stopId,
      activityId: input.activityId || null,
      customName: input.customName || null,
      costCategory: input.costCategory,
      itemDate: input.itemDate,
      startTime: input.startTime || null,
      endTime: input.endTime || null,
      cost,
      currencyCode: input.currencyCode || trip.currencyCode,
      sequenceOrder: nextSeq,
      notes: input.notes || null,
    });

    return item.props;
  };
}
