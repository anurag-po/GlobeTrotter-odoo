import { z } from 'zod';

export const addStopSchema = z
  .object({
    cityId: z.string().uuid().nullable().optional(),
    customPlaceName: z.string().trim().min(1).max(200).nullable().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
    description: z.string().trim().max(1000).nullable().optional(),
    budgetAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  })
  .strict();

export const updateStopSchema = z
  .object({
    cityId: z.string().uuid().nullable().optional(),
    customPlaceName: z.string().trim().min(1).max(200).nullable().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    budgetAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  })
  .strict();

export const reorderStopsSchema = z
  .object({
    orderedStopIds: z.array(z.string().uuid()).min(1, 'Ordered stop IDs list cannot be empty'),
  })
  .strict();
