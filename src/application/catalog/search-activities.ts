import type { ActivityRepository, ActivityFilters } from '../ports/repositories.js';
import type { ActivityProps } from '../../domain/entities/activity.js';
import type { PaginatedResponse } from '../../shared/types/pagination.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export function makeSearchActivitiesUseCase(deps: { activityRepo: ActivityRepository }) {
  return async (filters: ActivityFilters): Promise<PaginatedResponse<ActivityProps>> => {
    const result = await deps.activityRepo.findAll(filters);
    return {
      ...result,
      items: result.items.map((a) => a.props),
    };
  };
}

export function makeGetActivityUseCase(deps: { activityRepo: ActivityRepository }) {
  return async (activityId: string): Promise<ActivityProps> => {
    const act = await deps.activityRepo.findById(activityId);
    if (!act) {
      throw AppError.notFound(ErrorCodes.ACTIVITY_NOT_FOUND, 'Activity not found');
    }
    return act.props;
  };
}
