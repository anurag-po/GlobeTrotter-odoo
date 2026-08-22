import { Router, type Request, type Response, type NextFunction } from 'express';
import { createPostSchema, createCommentSchema, feedQuerySchema } from './community.schemas.js';
import { requireAuth, optionalAuth } from '../middleware/auth-guard.js';
import { userRateLimiter, publicRateLimiter } from '../middleware/rate-limiter.js';
import type { Repositories } from '../../infrastructure/db/repositories/index.js';
import { makeCreatePostUseCase } from '../../application/community/create-post.js';
import { makeListFeedUseCase, makeDeletePostUseCase } from '../../application/community/list-feed.js';
import { makeAddCommentUseCase } from '../../application/community/add-comment.js';
import { makeLikePostUseCase, makeUnlikePostUseCase } from '../../application/community/like-post.js';

export function createCommunityRouter(deps: { repos: Repositories }): Router {
  const router = Router();

  const createPost = makeCreatePostUseCase({ communityPostRepo: deps.repos.communityPostRepo });
  const listFeed = makeListFeedUseCase({
    communityPostRepo: deps.repos.communityPostRepo,
    communityLikeRepo: deps.repos.communityLikeRepo,
    userRepo: deps.repos.userRepo,
  });
  const deletePost = makeDeletePostUseCase({
    communityPostRepo: deps.repos.communityPostRepo,
    userRepo: deps.repos.userRepo,
  });
  const addComment = makeAddCommentUseCase({
    communityCommentRepo: deps.repos.communityCommentRepo,
    userRepo: deps.repos.userRepo,
  });
  const likePost = makeLikePostUseCase({
    communityLikeRepo: deps.repos.communityLikeRepo,
    communityPostRepo: deps.repos.communityPostRepo,
  });
  const unlikePost = makeUnlikePostUseCase({
    communityLikeRepo: deps.repos.communityLikeRepo,
    communityPostRepo: deps.repos.communityPostRepo,
  });

  // GET /api/v1/community/posts
  router.get('/posts', optionalAuth, publicRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = feedQuerySchema.parse(req.query);
      const feed = await listFeed(req.currentUserId, query.cursor, query.pageSize);
      res.status(200).json(feed);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/community/posts
  router.post('/posts', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createPostSchema.parse(req.body);
      const post = await createPost(req.currentUserId!, input);
      res.status(201).json(post);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/community/posts/:id
  router.delete('/posts/:id', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postId = req.params.id as string;
      await deletePost(req.currentUserId!, postId, req.userRole || 'user');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/community/posts/:id/comments
  router.post('/posts/:id/comments', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postId = req.params.id as string;
      const input = createCommentSchema.parse(req.body);
      const comment = await addComment(req.currentUserId!, postId, input.content);
      res.status(201).json(comment);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/community/posts/:id/like
  router.post('/posts/:id/like', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postId = req.params.id as string;
      const result = await likePost(req.currentUserId!, postId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/community/posts/:id/like
  router.delete('/posts/:id/like', requireAuth, userRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postId = req.params.id as string;
      const result = await unlikePost(req.currentUserId!, postId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
