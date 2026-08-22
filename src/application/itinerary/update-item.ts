import type { TripRepository, TripStopRepository, ItineraryItemRepository } from '../ports/repositories.js';
import { TripRules } from '../../domain/rules/trip-rules.js';
import type { ItineraryItemProps, CostCategory } from '../../domain/entities/itinerary-item.js';
import { toDecimalString } from '../../shared/utils/decimal.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export interface UpdateItemInput {
  activityId?: string | null;
  customName?: string | null;
  costCategory?: CostCategory;
  itemDate?: string;
  startTime?: Date | null;
  endTime?: Date | null;
  cost?: string;
  currencyCode?: string;
  notes?: string | null;
}

export function makeUpdateItemUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  itineraryItemRepo: ItineraryItemRepository;
}) {
  return async (
    userId: string,
    stopId: string,
    itemId: string,
    input: UpdateItemInput
  ): Promise<ItineraryItemProps> => {
    const stop = await deps.tripStopRepo.findById(stopId);
    if (!stop) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip stop not found');

    const trip = await deps.tripRepo.findByIdAndOwner(stop.tripId, userId);
    if (!trip) throw AppError.forbidden('You do not have access to this trip');

    const item = await deps.itineraryItemRepo.findById(itemId);
    if (!item || item.tripStopId !== stopId) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Itinerary item not found');
    }

    const newItemDate = input.itemDate || item.itemDate;
    TripRules.validateItemDate(newItemDate, stop.startDate, stop.endDate);

    const updated = await deps.itineraryItemRepo.update(itemId, {
      activityId: input.activityId !== undefined ? input.activityId : item.activityId,
      customName: input.customName !== undefined ? input.customName : item.customName,
      costCategory: input.costCategory ?? item.costCategory,
      itemDate: newItemDate,
      startTime: input.startTime !== undefined ? input.startTime : item.startTime,
      endTime: input.endTime !== undefined ? input.endTime : item.endTime,
      cost: input.cost ? toDecimalString(input.cost) : item.cost,
      currencyCode: input.currencyCode ?? item.currencyCode,
      notes: input.notes !== undefined ? input.notes : item.notes,
    });

    return updated.props;
  };
}

export function makeDeleteItemUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  itineraryItemRepo: ItineraryItemRepository;
}) {
  return async (userId: string, stopId: string, itemId: string): Promise<void> => {
    const stop = await deps.tripStopRepo.findById(stopId);
    if (!stop) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip stop not found');

    const trip = await deps.tripRepo.findByIdAndOwner(stop.tripId, userId);
    if (!trip) throw AppError.forbidden('You do not have access to this trip');

    const item = await deps.itineraryItemRepo.findById(itemId);
    if (!item || item.tripStopId !== stopId) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Itinerary item not found');
    }

    await deps.itineraryItemRepo.delete(itemId);
  };
}
