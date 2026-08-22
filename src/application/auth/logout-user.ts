import type { AuthTokenRepository } from '../ports/repositories.js';
import { TokenGenerator } from '../../infrastructure/auth/token-generator.js';

export function makeLogoutUserUseCase(deps: { authTokenRepo: AuthTokenRepository }) {
  return async (refreshToken: string): Promise<void> => {
    if (!refreshToken) return;
    const tokenHash = TokenGenerator.hashToken(refreshToken);
    await deps.authTokenRepo.revokeRefreshToken(tokenHash);
  };
}
