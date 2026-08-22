import type { UserRepository, AuthTokenRepository, AuditLogRepository } from '../ports/repositories.js';
import { PasswordHasher } from '../../infrastructure/auth/password-hasher.js';
import { TokenGenerator } from '../../infrastructure/auth/token-generator.js';
import { JwtService } from '../../infrastructure/auth/jwt-service.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';
import type { AuthOutput } from './register-user.js';

export interface LoginUserInput {
  identifier: string; // username OR email
  password: string;
}

export function makeLoginUserUseCase(deps: {
  userRepo: UserRepository;
  authTokenRepo: AuthTokenRepository;
  auditLogRepo: AuditLogRepository;
}) {
  return async (input: LoginUserInput): Promise<AuthOutput> => {
    // 1. Identifier lookup (case-insensitive)
    const user = await deps.userRepo.findByUsernameOrEmail(input.identifier);
    if (!user) {
      throw AppError.invalidCredentials();
    }

    // 2. Status check
    if (user.status === 'suspended') {
      throw new AppError(ErrorCodes.ACCOUNT_SUSPENDED, 'Account has been suspended', 403);
    }
    if (user.deletedAt) {
      throw AppError.invalidCredentials();
    }

    // 3. Lockout check (5 failed attempts in 15 mins - BR-018)
    const recentFailures = await deps.auditLogRepo.countRecentFailedLogins(user.id, 15);
    if (recentFailures >= 5) {
      throw AppError.accountLocked();
    }

    // 4. Verify password
    const isMatch = await PasswordHasher.verify(user.passwordHash, input.password);
    if (!isMatch) {
      await deps.auditLogRepo.log({
        actorUserId: user.id,
        action: 'login_failed',
        targetType: 'user',
        targetId: user.id,
      });
      throw AppError.invalidCredentials();
    }

    // 5. Success actions
    await deps.userRepo.update(user.id, { lastLoginAt: new Date() });
    await deps.auditLogRepo.log({
      actorUserId: user.id,
      action: 'login_success',
      targetType: 'user',
      targetId: user.id,
    });

    const rawRefreshToken = TokenGenerator.generateToken();
    const refreshHash = TokenGenerator.hashToken(rawRefreshToken);
    await deps.authTokenRepo.createRefreshToken({
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    const accessToken = JwtService.signAccessToken(user.id, user.role);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        city: user.city,
        country: user.country,
        additionalInfo: user.additionalInfo,
        photoUrl: user.photoUrl,
        role: user.role,
        status: user.status,
        hasVerifiedEmail: user.hasVerifiedEmail,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  };
}
