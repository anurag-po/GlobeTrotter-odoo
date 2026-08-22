import type { UserRepository, AuthTokenRepository, TripRepository, AuditLogRepository } from '../ports/repositories.js';
import { PasswordHasher } from '../../infrastructure/auth/password-hasher.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export function makeDeleteAccountUseCase(deps: {
  userRepo: UserRepository;
  authTokenRepo: AuthTokenRepository;
  tripRepo: TripRepository;
  auditLogRepo: AuditLogRepository;
}) {
  return async (userId: string, passwordConfirmation: string): Promise<void> => {
    const user = await deps.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
    }

    // BR-017: Re-authenticate before account deletion
    const isMatch = await PasswordHasher.verify(user.passwordHash, passwordConfirmation);
    if (!isMatch) {
      throw new AppError(ErrorCodes.INVALID_PASSWORD, 'Incorrect password', 401);
    }

    // 1. Soft-delete user
    await deps.userRepo.softDelete(userId);

    // 2. Revoke all active sessions
    await deps.authTokenRepo.revokeAllUserRefreshTokens(userId);

    // 3. Log audit trail
    await deps.auditLogRepo.log({
      actorUserId: userId,
      action: 'account_deleted',
      targetType: 'user',
      targetId: userId,
    });
  };
}
