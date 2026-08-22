import type { CommunityLikeRepository, CommunityPostRepository } from '../ports/repositories.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';

export function makeLikePostUseCase(deps: {
  communityLikeRepo: CommunityLikeRepository;
  communityPostRepo: CommunityPostRepository;
}) {
  return async (userId: string, postId: string): Promise<{ liked: boolean; likeCount: number }> => {
    const post = await deps.communityPostRepo.findById(postId);
    if (!post) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Post not found');

    await deps.communityLikeRepo.like(postId, userId);
    const updatedPost = await deps.communityPostRepo.findById(postId);

    return {
      liked: true,
      likeCount: updatedPost?.likeCount || 0,
    };
  };
}

export function makeUnlikePostUseCase(deps: {
  communityLikeRepo: CommunityLikeRepository;
  communityPostRepo: CommunityPostRepository;
}) {
  return async (userId: string, postId: string): Promise<{ liked: boolean; likeCount: number }> => {
    const post = await deps.communityPostRepo.findById(postId);
    if (!post) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Post not found');

    await deps.communityLikeRepo.unlike(postId, userId);
    const updatedPost = await deps.communityPostRepo.findById(postId);

    return {
      liked: false,
      likeCount: updatedPost?.likeCount || 0,
    };
  };
}
