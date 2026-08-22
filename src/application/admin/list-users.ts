import type { UserRepository, UserFilters, AuthTokenRepository, AuditLogRepository } from '../ports/repositories.js';
import type { UserProps, UserStatus } from '../../domain/entities/user.js';
import { UserStateMachine } from '../../domain/state-machines/user-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';
import type { PaginatedResponse } from '../../shared/types/pagination.js';

export function makeListUsersUseCase(deps: { userRepo: UserRepository }) {
  return async (filters: UserFilters): Promise<PaginatedResponse<UserProps>> => {
    const result = await deps.userRepo.findAll(filters);
    return {
      ...result,
      items: result.items.map((u) => u.props),
    };
  };
}

export function makeUpdateUserStatusUseCase(deps: {
  userRepo: UserRepository;
  authTokenRepo: AuthTokenRepository;
  auditLogRepo: AuditLogRepository;
}) {
  return async (adminUserId: string, targetUserId: string, newStatus: UserStatus): Promise<UserProps> => {
    const target = await deps.userRepo.findById(targetUserId);
    if (!target) throw AppError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');

    // BR-016 / ARCH-030: Admin cannot suspend another admin
    UserStateMachine.assertStatusChange(target.role, target.status, newStatus);

    const updated = await deps.userRepo.update(targetUserId, { status: newStatus });

    // Revoke sessions if suspended
    if (newStatus === 'suspended') {
      await deps.authTokenRepo.revokeAllUserRefreshTokens(targetUserId);
    }

    await deps.auditLogRepo.log({
      actorUserId: adminUserId,
      action: newStatus === 'suspended' ? 'admin_user_suspended' : 'admin_user_activated',
      targetType: 'user',
      targetId: targetUserId,
    });

    return updated.props;
  };
}
