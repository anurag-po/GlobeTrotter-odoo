import type { TripRepository } from '../ports/repositories.js';
import type { TripStatus } from '../../domain/entities/trip.js';

export interface CalendarEntry {
  tripId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
}

export function makeGetCalendarUseCase(deps: { tripRepo: TripRepository }) {
  return async (userId: string, startMonth: string, endMonth: string): Promise<{ entries: CalendarEntry[] }> => {
    const trips = await deps.tripRepo.findTripsForCalendar(userId, startMonth, endMonth);
    return {
      entries: trips.map((t) => ({
        tripId: t.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        status: t.status,
      })),
    };
  };
}
