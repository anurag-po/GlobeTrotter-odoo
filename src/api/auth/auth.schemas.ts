import { z } from 'zod';

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128)
      .regex(/(?=.*[a-zA-Z])(?=.*\d)/, 'Password must contain at least one letter and one number'),
    firstName: z.string().trim().min(1, 'First name is required').max(50),
    lastName: z.string().trim().min(1, 'Last name is required').max(50),
    phoneNumber: z.string().trim().optional(),
    city: z.string().trim().optional(),
    country: z.string().trim().optional(),
    additionalInfo: z.string().trim().max(1000).optional(),
    photoUrl: z.string().url().optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1, 'Username or email is required'),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().email('Invalid email address'),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128)
      .regex(/(?=.*[a-zA-Z])(?=.*\d)/, 'Password must contain at least one letter and one number'),
  })
  .strict();

export const verifyEmailSchema = z
  .object({
    token: z.string().min(1, 'Verification token is required'),
  })
  .strict();
