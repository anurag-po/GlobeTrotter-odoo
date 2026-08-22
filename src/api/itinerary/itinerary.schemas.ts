import { z } from 'zod';

export const addItemSchema = z
  .object({
    activityId: z.string().uuid().nullable().optional(),
    customName: z.string().trim().min(1).max(200).nullable().optional(),
    costCategory: z.enum(['transport', 'stay', 'activity', 'meal', 'other']),
    itemDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Item date must be YYYY-MM-DD'),
    startTime: z.string().datetime().nullable().optional(),
    endTime: z.string().datetime().nullable().optional(),
    cost: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    currencyCode: z.string().trim().length(3).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const updateItemSchema = z
  .object({
    activityId: z.string().uuid().nullable().optional(),
    customName: z.string().trim().min(1).max(200).nullable().optional(),
    costCategory: z.enum(['transport', 'stay', 'activity', 'meal', 'other']).optional(),
    itemDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: z.string().datetime().nullable().optional(),
    endTime: z.string().datetime().nullable().optional(),
    cost: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    currencyCode: z.string().trim().length(3).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
