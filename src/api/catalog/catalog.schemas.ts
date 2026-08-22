import { z } from 'zod';

export const cityQuerySchema = z.object({
  q: z.string().trim().optional(),
  countryCode: z.string().trim().length(2).optional(),
  region: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const activityQuerySchema = z.object({
  cityId: z.string().uuid().optional(),
  q: z.string().trim().optional(),
  category: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
