import { globalMemoryStore } from '../memory-store.js';
import {
  MemoryUserRepository,
  MemoryAuthTokenRepository,
  MemoryCityRepository,
  MemoryActivityRepository,
  MemoryTripRepository,
  MemoryTripStopRepository,
  MemoryItineraryItemRepository,
  MemorySavedDestinationRepository,
  MemoryCommunityPostRepository,
  MemoryCommunityCommentRepository,
  MemoryCommunityLikeRepository,
  MemoryAuditLogRepository,
  MemoryIdempotencyRepository,
} from './memory-repositories.js';
import type {
  UserRepository,
  AuthTokenRepository,
  CityRepository,
  ActivityRepository,
  TripRepository,
  TripStopRepository,
  ItineraryItemRepository,
  SavedDestinationRepository,
  CommunityPostRepository,
  CommunityCommentRepository,
  CommunityLikeRepository,
  AuditLogRepository,
  IdempotencyRepository,
} from '../../../application/ports/repositories.js';

export interface Repositories {
  userRepo: UserRepository;
  authTokenRepo: AuthTokenRepository;
  cityRepo: CityRepository;
  activityRepo: ActivityRepository;
  tripRepo: TripRepository;
  tripStopRepo: TripStopRepository;
  itineraryItemRepo: ItineraryItemRepository;
  savedDestinationRepo: SavedDestinationRepository;
  communityPostRepo: CommunityPostRepository;
  communityCommentRepo: CommunityCommentRepository;
  communityLikeRepo: CommunityLikeRepository;
  auditLogRepo: AuditLogRepository;
  idempotencyRepo: IdempotencyRepository;
}

export function createMemoryRepositories(store = globalMemoryStore): Repositories {
  const userRepo = new MemoryUserRepository(store);
  const authTokenRepo = new MemoryAuthTokenRepository(store);
  const cityRepo = new MemoryCityRepository(store);
  const activityRepo = new MemoryActivityRepository(store);
  const tripRepo = new MemoryTripRepository(store);
  const tripStopRepo = new MemoryTripStopRepository(store, tripRepo);
  const itineraryItemRepo = new MemoryItineraryItemRepository(store, tripRepo);
  const savedDestinationRepo = new MemorySavedDestinationRepository(store);
  const communityPostRepo = new MemoryCommunityPostRepository(store);
  const communityCommentRepo = new MemoryCommunityCommentRepository(store, communityPostRepo);
  const communityLikeRepo = new MemoryCommunityLikeRepository(store, communityPostRepo);
  const auditLogRepo = new MemoryAuditLogRepository(store);
  const idempotencyRepo = new MemoryIdempotencyRepository(store);

  return {
    userRepo,
    authTokenRepo,
    cityRepo,
    activityRepo,
    tripRepo,
    tripStopRepo,
    itineraryItemRepo,
    savedDestinationRepo,
    communityPostRepo,
    communityCommentRepo,
    communityLikeRepo,
    auditLogRepo,
    idempotencyRepo,
  };
}

export const defaultRepositories = createMemoryRepositories();
