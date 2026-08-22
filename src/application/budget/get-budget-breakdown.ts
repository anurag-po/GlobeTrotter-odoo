import type { TripRepository, TripStopRepository, ItineraryItemRepository } from '../ports/repositories.js';
import { sumDecimals, toDecimalString, isGreaterThan, subtractDecimals } from '../../shared/utils/decimal.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';
import { parseISO, differenceInCalendarDays } from 'date-fns';

export interface BudgetBreakdownOutput {
  currencyCode: string;
  totalEstimated: string;
  totalActual: string;
  byCategory: Record<string, string>;
  byStop: Array<{
    stopId: string;
    budgeted: string | null;
    actual: string;
    isOverBudget: boolean;
  }>;
  averageCostPerDay: string;
  overBudgetAlerts: Array<{
    stopId: string;
    budgeted: string;
    actual: string;
    overageAmount: string;
  }>;
}

export function makeGetBudgetBreakdownUseCase(deps: {
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  itineraryItemRepo: ItineraryItemRepository;
}) {
  return async (userId: string, tripId: string): Promise<BudgetBreakdownOutput> => {
    const trip = await deps.tripRepo.findByIdAndOwner(tripId, userId);
    if (!trip) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');

    const stops = await deps.tripStopRepo.findByTripId(tripId);
    const items = await deps.itineraryItemRepo.findByTripId(tripId);

    const byCategory: Record<string, string> = {
      transport: '0.00',
      stay: '0.00',
      activity: '0.00',
      meal: '0.00',
      other: '0.00',
    };

    for (const cat of Object.keys(byCategory)) {
      const catItems = items.filter((i) => i.costCategory === cat);
      byCategory[cat] = sumDecimals(catItems.map((i) => i.cost));
    }

    const byStop: BudgetBreakdownOutput['byStop'] = [];
    const overBudgetAlerts: BudgetBreakdownOutput['overBudgetAlerts'] = [];

    for (const stop of stops) {
      const stopItems = items.filter((i) => i.tripStopId === stop.id);
      const actual = sumDecimals(stopItems.map((i) => i.cost));
      const budgeted = stop.budgetAmount ? toDecimalString(stop.budgetAmount) : null;
      const isOverBudget = budgeted ? isGreaterThan(actual, budgeted) : false;

      byStop.push({
        stopId: stop.id,
        budgeted,
        actual,
        isOverBudget,
      });

      if (isOverBudget && budgeted) {
        overBudgetAlerts.push({
          stopId: stop.id,
          budgeted,
          actual,
          overageAmount: subtractDecimals(actual, budgeted),
        });
      }
    }

    const totalActual = sumDecimals(items.map((i) => i.cost));
    const totalDays = Math.max(1, differenceInCalendarDays(parseISO(trip.endDate), parseISO(trip.startDate)) + 1);
    const avgPerDay = toDecimalString(Number(totalActual) / totalDays);

    return {
      currencyCode: trip.currencyCode,
      totalEstimated: trip.estimatedBudgetTotal,
      totalActual,
      byCategory,
      byStop,
      averageCostPerDay: avgPerDay,
      overBudgetAlerts,
    };
  };
}
