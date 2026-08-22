import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schemas.js';
import { authRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import type { JobService } from '../../application/ports/services.js';
import { makeRegisterUserUseCase } from '../../application/auth/register-user.js';
import { makeLoginUserUseCase } from '../../application/auth/login-user.js';
import { makeRefreshTokenUseCase } from '../../application/auth/refresh-token.js';
import { makeLogoutUserUseCase } from '../../application/auth/logout-user.js';
import { makeForgotPasswordUseCase } from '../../application/auth/forgot-password.js';
import { makeResetPasswordUseCase } from '../../application/auth/reset-password.js';
import { makeVerifyEmailUseCase } from '../../application/auth/verify-email.js';

export function createAuthRouter(deps: { repos: Repositories; jobService?: JobService }): Router {
  const router = Router();

  const registerUser = makeRegisterUserUseCase({
    userRepo: deps.repos.userRepo,
    authTokenRepo: deps.repos.authTokenRepo,
    jobService: deps.jobService,
  });

  const loginUser = makeLoginUserUseCase({
    userRepo: deps.repos.userRepo,
    authTokenRepo: deps.repos.authTokenRepo,
    auditLogRepo: deps.repos.auditLogRepo,
  });

  const refreshToken = makeRefreshTokenUseCase({
    userRepo: deps.repos.userRepo,
    authTokenRepo: deps.repos.authTokenRepo,
  });

  const logoutUser = makeLogoutUserUseCase({
    authTokenRepo: deps.repos.authTokenRepo,
  });

  const forgotPassword = makeForgotPasswordUseCase({
    userRepo: deps.repos.userRepo,
    authTokenRepo: deps.repos.authTokenRepo,
    auditLogRepo: deps.repos.auditLogRepo,
    jobService: deps.jobService,
  });

  const resetPassword = makeResetPasswordUseCase({
    userRepo: deps.repos.userRepo,
    authTokenRepo: deps.repos.authTokenRepo,
    auditLogRepo: deps.repos.auditLogRepo,
  });

  const verifyEmail = makeVerifyEmailUseCase({
    userRepo: deps.repos.userRepo,
    authTokenRepo: deps.repos.authTokenRepo,
  });

  // POST /api/v1/auth/register
  router.post('/register', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = registerSchema.parse(req.body);
      const result = await registerUser(input);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/auth/login
  router.post('/login', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = loginSchema.parse(req.body);
      const result = await loginUser(input);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/auth/refresh
  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = refreshTokenSchema.parse(req.body);
      const result = await refreshToken(input.refreshToken);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/auth/logout
  router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = refreshTokenSchema.parse(req.body);
      await logoutUser(input.refreshToken);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/auth/forgot-password
  router.post('/forgot-password', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = forgotPasswordSchema.parse(req.body);
      await forgotPassword(input.email);
      res.status(200).json({ message: 'If your email is registered, you will receive a password reset link.' });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/auth/reset-password
  router.post('/reset-password', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = resetPasswordSchema.parse(req.body);
      await resetPassword(input.token, input.newPassword);
      res.status(200).json({ message: 'Password has been reset successfully.' });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/auth/verify-email
  router.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = verifyEmailSchema.parse(req.body);
      await verifyEmail(input.token);
      res.status(200).json({ message: 'Email has been verified successfully.' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
