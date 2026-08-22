import type { UserRepository, AuthTokenRepository } from '../ports/repositories.js';
import type { EmailService, JobService } from '../ports/services.js';
import { PasswordHasher } from '../../infrastructure/auth/password-hasher.js';
import { TokenGenerator } from '../../infrastructure/auth/token-generator.js';
import { JwtService } from '../../infrastructure/auth/jwt-service.js';
import { PasswordRules } from '../../domain/rules/password-rules.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export interface RegisterUserInput {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  city?: string;
  country?: string;
  additionalInfo?: string;
  photoUrl?: string;
}

export interface AuthOutput {
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string | null;
    city?: string | null;
    country?: string | null;
    additionalInfo?: string | null;
    photoUrl?: string | null;
    role: string;
    status: string;
    hasVerifiedEmail: boolean;
    createdAt: Date;
  };
  accessToken: string;
  refreshToken: string;
}

export function makeRegisterUserUseCase(deps: {
  userRepo: UserRepository;
  authTokenRepo: AuthTokenRepository;
  emailService?: EmailService;
  jobService?: JobService;
}) {
  return async (input: RegisterUserInput): Promise<AuthOutput> => {
    // 1. Password validation (BR-009)
    PasswordRules.validate(input.password);

    // 2. Check email/username uniqueness
    const existingEmail = await deps.userRepo.findByUsernameOrEmail(input.email);
    if (existingEmail) {
      throw AppError.conflict(ErrorCodes.EMAIL_TAKEN, 'Email is already registered');
    }
    const existingUsername = await deps.userRepo.findByUsernameOrEmail(input.username);
    if (existingUsername) {
      throw AppError.conflict(ErrorCodes.USERNAME_TAKEN, 'Username is already taken');
    }

    // 3. Hash password
    const passwordHash = await PasswordHasher.hash(input.password);

    // 4. Create user
    const user = await deps.userRepo.create({
      username: input.username,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phoneNumber: input.phoneNumber || null,
      city: input.city || null,
      country: input.country || null,
      additionalInfo: input.additionalInfo || null,
      photoUrl: input.photoUrl || null,
      languagePreference: 'en',
      role: 'user',
      status: 'active',
      hasVerifiedEmail: false,
      notificationPreferences: { email: true, push: false, inApp: true },
    });

    // 5. Generate tokens
    const rawRefreshToken = TokenGenerator.generateToken();
    const refreshHash = TokenGenerator.hashToken(rawRefreshToken);
    await deps.authTokenRepo.createRefreshToken({
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    const rawVerifyToken = TokenGenerator.generateToken();
    const verifyHash = TokenGenerator.hashToken(rawVerifyToken);
    await deps.authTokenRepo.createEmailVerificationToken({
      userId: user.id,
      tokenHash: verifyHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // 6. Enqueue verification email job
    if (deps.jobService) {
      await deps.jobService.enqueue('send-verification-email', {
        userId: user.id,
        email: user.email,
        token: rawVerifyToken,
      });
    }

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
