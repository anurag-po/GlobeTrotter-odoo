import type { TripStatus } from '../entities/trip.js';
import { AppError } from '../../shared/errors/app-error.js';

export const TripStateMachine = {
  isValidTransition(current: TripStatus, next: TripStatus, stopCount = 0): boolean {
    if (current === next) return true;

    // Terminal states
    if (current === 'completed' || current === 'cancelled') {
      return false;
    }

    switch (current) {
      case 'draft':
        if (next === 'planned') return stopCount >= 1;
        if (next === 'cancelled') return true;
        return false;

      case 'planned':
        if (next === 'ongoing') return true;
        if (next === 'cancelled') return true;
        if (next === 'draft') return true;
        return false;

      case 'ongoing':
        if (next === 'completed') return true;
        if (next === 'cancelled') return true;
        return false;

      default:
        return false;
    }
  },

  assertTransition(current: TripStatus, next: TripStatus, stopCount = 0): void {
    if (!this.isValidTransition(current, next, stopCount)) {
      throw AppError.validation(
        `Invalid trip status transition from '${current}' to '${next}'`
      );
    }
  },
};
