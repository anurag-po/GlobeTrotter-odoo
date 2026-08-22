import type { UserRepository, AuthTokenRepository } from '../ports/repositories.js';
import { TokenGenerator } from '../../infrastructure/auth/token-generator.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export function makeVerifyEmailUseCase(deps: {
  userRepo: UserRepository;
  authTokenRepo: AuthTokenRepository;
}) {
  return async (token: string): Promise<void> => {
    const tokenHash = TokenGenerator.hashToken(token);
    const verifyRecord = await deps.authTokenRepo.findValidEmailVerificationToken(tokenHash);

    if (!verifyRecord) {
      throw new AppError(
        ErrorCodes.INVALID_OR_EXPIRED_TOKEN,
        'Email verification token is invalid or has expired',
        400
      );
    }

    await deps.userRepo.update(verifyRecord.userId, { hasVerifiedEmail: true });
    await deps.authTokenRepo.markEmailVerificationTokenUsed(verifyRecord.id);
  };
}
