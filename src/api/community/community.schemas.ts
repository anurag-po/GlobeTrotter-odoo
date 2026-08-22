import { z } from 'zod';

export const createPostSchema = z
  .object({
    content: z.string().trim().min(1, 'Post content is required').max(5000),
    tripId: z.string().uuid().nullable().optional(),
    attachmentUrls: z.array(z.string().url()).max(4, 'Maximum 4 attachments allowed').optional(),
  })
  .strict();

export const createCommentSchema = z
  .object({
    content: z.string().trim().min(1, 'Comment is required').max(1000),
  })
  .strict();

export const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
