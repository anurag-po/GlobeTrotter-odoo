import type { CommunityPostRepository, CommunityLikeRepository, UserRepository } from '../ports/repositories.js';
import type { CommunityPostProps } from '../../domain/entities/community-post.js';
import type { CursorPaginatedResponse } from '../../shared/types/pagination.js';

export interface FeedPostOutput extends CommunityPostProps {
  author: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    photoUrl?: string | null;
  };
  likedByCurrentUser: boolean;
}

export function makeListFeedUseCase(deps: {
  communityPostRepo: CommunityPostRepository;
  communityLikeRepo: CommunityLikeRepository;
  userRepo: UserRepository;
}) {
  return async (
    currentUserId: string | undefined,
    cursor: string | undefined,
    pageSize = 20
  ): Promise<CursorPaginatedResponse<FeedPostOutput>> => {
    const feed = await deps.communityPostRepo.findFeed({ cursor, pageSize });
    const items: FeedPostOutput[] = [];

    for (const post of feed.items) {
      const author = await deps.userRepo.findById(post.userId);
      const likedByCurrentUser = currentUserId
        ? await deps.communityLikeRepo.hasLiked(post.id, currentUserId)
        : false;

      items.push({
        ...post.props,
        author: {
          id: post.userId,
          username: author?.username || 'user',
          firstName: author?.firstName || 'Traveler',
          lastName: author?.lastName || '',
          photoUrl: author?.photoUrl,
        },
        likedByCurrentUser,
      });
    }

    return {
      items,
      nextCursor: feed.nextCursor,
    };
  };
}

export function makeDeletePostUseCase(deps: { communityPostRepo: CommunityPostRepository; userRepo: UserRepository }) {
  return async (userId: string, postId: string, userRole: string): Promise<void> => {
    const post = await deps.communityPostRepo.findById(postId);
    if (!post) return;

    // Author or Admin can delete
    if (post.userId !== userId && userRole !== 'admin') {
      throw new Error('Forbidden');
    }

    await deps.communityPostRepo.delete(postId);
  };
}
