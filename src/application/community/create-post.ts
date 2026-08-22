import type { CommunityPostRepository } from '../ports/repositories.js';
import type { CommunityPostProps } from '../../domain/entities/community-post.js';
import { AppError } from '../../shared/errors/app-error.js';

export interface CreatePostInput {
  content: string;
  tripId?: string | null;
  attachmentUrls?: string[];
}

export function makeCreatePostUseCase(deps: { communityPostRepo: CommunityPostRepository }) {
  return async (userId: string, input: CreatePostInput): Promise<CommunityPostProps> => {
    if (!input.content || input.content.trim().length === 0 || input.content.length > 5000) {
      throw AppError.validation('Post content must be between 1 and 5000 characters');
    }

    if (input.attachmentUrls && input.attachmentUrls.length > 4) {
      throw AppError.validation('A post can have at most 4 attachments');
    }

    const post = await deps.communityPostRepo.create({
      userId,
      tripId: input.tripId || null,
      content: input.content.trim(),
      attachmentUrls: input.attachmentUrls || [],
      deletedAt: null,
    });

    return post.props;
  };
}
