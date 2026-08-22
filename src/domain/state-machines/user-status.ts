import type { UserStatus } from '../entities/user.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export const UserStateMachine = {
  assertStatusChange(
    targetUserRole: string,
    currentStatus: UserStatus,
    newStatus: UserStatus
  ): void {
    if (targetUserRole === 'admin' && newStatus === 'suspended') {
      throw new AppError(
        ErrorCodes.CANNOT_MODIFY_ADMIN,
        'Admin users cannot be suspended',
        403
      );
    }

    if (currentStatus === 'deactivated' && newStatus !== 'deactivated') {
      throw AppError.validation('Deactivated accounts cannot be modified');
    }
  },
};
