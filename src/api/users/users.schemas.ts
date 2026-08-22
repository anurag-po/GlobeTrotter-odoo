import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(50).optional(),
    lastName: z.string().trim().min(1).max(50).optional(),
    phoneNumber: z.string().trim().nullable().optional(),
    city: z.string().trim().nullable().optional(),
    country: z.string().trim().nullable().optional(),
    additionalInfo: z.string().trim().max(1000).nullable().optional(),
    photoUrl: z.string().url().nullable().optional(),
    languagePreference: z.string().min(2).max(10).optional(),
    notificationPreferences: z.record(z.unknown()).optional(),
  })
  .strict();

export const deleteAccountSchema = z
  .object({
    password: z.string().min(1, 'Password confirmation is required'),
  })
  .strict();

export const saveDestinationSchema = z
  .object({
    cityId: z.string().uuid('Invalid city UUID'),
  })
  .strict();
