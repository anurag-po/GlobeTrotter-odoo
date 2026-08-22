import type { UserRepository, AuthTokenRepository, AuditLogRepository } from '../ports/repositories.js';
import { PasswordHasher } from '../../infrastructure/auth/password-hasher.js';
import { TokenGenerator } from '../../infrastructure/auth/token-generator.js';
import { PasswordRules } from '../../domain/rules/password-rules.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export function makeResetPasswordUseCase(deps: {
  userRepo: UserRepository;
  authTokenRepo: AuthTokenRepository;
  auditLogRepo: AuditLogRepository;
}) {
  return async (token: string, newPassword: string): Promise<void> => {
    PasswordRules.validate(newPassword);

    const tokenHash = TokenGenerator.hashToken(token);
    const resetRecord = await deps.authTokenRepo.findValidPasswordResetToken(tokenHash);

    if (!resetRecord) {
      throw new AppError(
        ErrorCodes.INVALID_OR_EXPIRED_TOKEN,
        'Password reset token is invalid or has expired',
        400
      );
    }

    const passwordHash = await PasswordHasher.hash(newPassword);
    await deps.userRepo.update(resetRecord.userId, { passwordHash });
    await deps.authTokenRepo.markPasswordResetTokenUsed(resetRecord.id);

    // Invalidate all active user sessions
    await deps.authTokenRepo.revokeAllUserRefreshTokens(resetRecord.userId);

    await deps.auditLogRepo.log({
      actorUserId: resetRecord.userId,
      action: 'password_reset_completed',
      targetType: 'user',
      targetId: resetRecord.userId,
    });
  };
}
