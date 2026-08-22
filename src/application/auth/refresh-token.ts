import type { UserRepository, AuthTokenRepository } from '../ports/repositories.js';
import { TokenGenerator } from '../../infrastructure/auth/token-generator.js';
import { JwtService } from '../../infrastructure/auth/jwt-service.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export function makeRefreshTokenUseCase(deps: {
  userRepo: UserRepository;
  authTokenRepo: AuthTokenRepository;
}) {
  return async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const tokenHash = TokenGenerator.hashToken(refreshToken);
    const record = await deps.authTokenRepo.findRefreshToken(tokenHash);

    if (!record) {
      throw new AppError(ErrorCodes.INVALID_REFRESH_TOKEN, 'Invalid or expired refresh token', 401);
    }

    const user = await deps.userRepo.findById(record.userId);
    if (!user || user.status === 'suspended') {
      throw new AppError(ErrorCodes.INVALID_REFRESH_TOKEN, 'Account inactive', 401);
    }

    // Token rotation (ARCH-028)
    await deps.authTokenRepo.revokeRefreshToken(tokenHash);

    const newRawToken = TokenGenerator.generateToken();
    const newHash = TokenGenerator.hashToken(newRawToken);
    await deps.authTokenRepo.createRefreshToken({
      userId: user.id,
      tokenHash: newHash,
      deviceLabel: record.deviceLabel || undefined,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const accessToken = JwtService.signAccessToken(user.id, user.role);

    return {
      accessToken,
      refreshToken: newRawToken,
    };
  };
}
