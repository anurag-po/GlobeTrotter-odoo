import type { UserRepository, AuthTokenRepository, AuditLogRepository } from '../ports/repositories.js';
import type { JobService } from '../ports/services.js';
import { TokenGenerator } from '../../infrastructure/auth/token-generator.js';

export function makeForgotPasswordUseCase(deps: {
  userRepo: UserRepository;
  authTokenRepo: AuthTokenRepository;
  auditLogRepo: AuditLogRepository;
  jobService?: JobService;
}) {
  return async (email: string): Promise<void> => {
    const user = await deps.userRepo.findByUsernameOrEmail(email);
    // Always return silently to prevent enumeration
    if (!user) return;

    const rawToken = TokenGenerator.generateToken();
    const tokenHash = TokenGenerator.hashToken(rawToken);

    await deps.authTokenRepo.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    await deps.auditLogRepo.log({
      actorUserId: user.id,
      action: 'password_reset_requested',
      targetType: 'user',
      targetId: user.id,
    });

    if (deps.jobService) {
      await deps.jobService.enqueue('send-password-reset-email', {
        userId: user.id,
        email: user.email,
        token: rawToken,
      });
    }
  };
}
