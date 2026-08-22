import { z } from 'zod';

export const updateUserStatusSchema = z
  .object({
    status: z.enum(['active', 'suspended']),
  })
  .strict();

export const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'suspended', 'deactivated']).optional(),
  role: z.enum(['user', 'admin']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
