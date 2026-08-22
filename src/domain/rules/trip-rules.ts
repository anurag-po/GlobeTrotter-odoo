import { isValidDateString, isDateWithinRange, isRangeWithinRange } from '../../shared/utils/date.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export const TripRules = {
  validateTripDates(startDate: string, endDate: string): void {
    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      throw AppError.validation('Trip dates must be valid YYYY-MM-DD format');
    }
    if (startDate > endDate) {
      throw AppError.validation('Trip start date must be before or equal to end date');
    }
  },

  validateStopDates(stopStart: string, stopEnd: string, tripStart: string, tripEnd: string): void {
    if (!isValidDateString(stopStart) || !isValidDateString(stopEnd)) {
      throw AppError.validation('Stop dates must be valid YYYY-MM-DD format');
    }
    if (stopStart > stopEnd) {
      throw AppError.validation('Stop start date must be before or equal to end date');
    }
    if (!isRangeWithinRange(stopStart, stopEnd, tripStart, tripEnd)) {
      throw new AppError(
        ErrorCodes.STOP_DATES_OUTSIDE_TRIP_RANGE,
        `Stop dates (${stopStart} to ${stopEnd}) must fall within trip date range (${tripStart} to ${tripEnd})`,
        400
      );
    }
  },

  validateItemDate(itemDate: string, stopStart: string, stopEnd: string): void {
    if (!isValidDateString(itemDate)) {
      throw AppError.validation('Item date must be valid YYYY-MM-DD format');
    }
    if (!isDateWithinRange(itemDate, stopStart, stopEnd)) {
      throw new AppError(
        ErrorCodes.ITEM_DATE_OUTSIDE_STOP_RANGE,
        `Item date (${itemDate}) must fall within stop date range (${stopStart} to ${stopEnd})`,
        400
      );
    }
  },
};
