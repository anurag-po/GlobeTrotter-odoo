import { z } from 'zod';

export const createTripSchema = z
  .object({
    name: z.string().trim().min(1, 'Trip name is required').max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
    coverPhotoUrl: z.string().url().nullable().optional(),
    currencyCode: z.string().trim().length(3).optional(),
  })
  .strict();

export const updateTripSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    coverPhotoUrl: z.string().url().nullable().optional(),
    status: z.enum(['draft', 'planned', 'ongoing', 'completed', 'cancelled']).optional(),
    currencyCode: z.string().trim().length(3).optional(),
  })
  .strict();

export const listTripsQuerySchema = z.object({
  status: z.enum(['draft', 'planned', 'ongoing', 'completed', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
