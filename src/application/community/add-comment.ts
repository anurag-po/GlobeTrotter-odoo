import type { CommunityCommentRepository, UserRepository } from '../ports/repositories.js';
import type { CommunityCommentProps } from '../../domain/entities/community-comment.js';
import { AppError } from '../../shared/errors/app-error.js';

export interface CommentOutput extends CommunityCommentProps {
  author: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    photoUrl?: string | null;
  };
}

export function makeAddCommentUseCase(deps: {
  communityCommentRepo: CommunityCommentRepository;
  userRepo: UserRepository;
}) {
  return async (userId: string, postId: string, content: string): Promise<CommentOutput> => {
    if (!content || content.trim().length === 0 || content.length > 1000) {
      throw AppError.validation('Comment must be between 1 and 1000 characters');
    }

    const comment = await deps.communityCommentRepo.create({
      postId,
      userId,
      content: content.trim(),
      deletedAt: null,
    });

    const user = await deps.userRepo.findById(userId);

    return {
      ...comment.props,
      author: {
        id: userId,
        username: user?.username || 'user',
        firstName: user?.firstName || 'Traveler',
        lastName: user?.lastName || '',
        photoUrl: user?.photoUrl,
      },
    };
  };
}
