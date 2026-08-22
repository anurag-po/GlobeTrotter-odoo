import type { User, UserProps } from '../../domain/entities/user.js';
import type { Trip, TripProps } from '../../domain/entities/trip.js';
import type { TripStop, TripStopProps } from '../../domain/entities/trip-stop.js';
import type { ItineraryItem, ItineraryItemProps } from '../../domain/entities/itinerary-item.js';
import type { City, CityProps } from '../../domain/entities/city.js';
import type { Activity, ActivityProps } from '../../domain/entities/activity.js';
import type { CommunityPost, CommunityPostProps } from '../../domain/entities/community-post.js';
import type { CommunityComment, CommunityCommentProps } from '../../domain/entities/community-comment.js';
import type { PaginatedResponse, CursorPaginatedResponse } from '../../shared/types/pagination.js';

export interface UserFilters {
  search?: string;
  status?: string;
  role?: string;
  page: number;
  pageSize: number;
}

export interface UserRepository {
  create(data: Omit<UserProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByUsernameOrEmail(identifier: string): Promise<User | null>;
  update(id: string, data: Partial<UserProps>): Promise<User>;
  softDelete(id: string): Promise<void>;
  findAll(filters: UserFilters): Promise<PaginatedResponse<User>>;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  deviceLabel?: string | null;
  expiresAt: Date;
  revokedAt?: Date | null;
}

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
}

export interface EmailVerificationTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
}

export interface AuthTokenRepository {
  createRefreshToken(data: { userId: string; tokenHash: string; deviceLabel?: string; expiresAt: Date }): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllUserRefreshTokens(userId: string): Promise<void>;

  createPasswordResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findValidPasswordResetToken(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  markPasswordResetTokenUsed(id: string): Promise<void>;

  createEmailVerificationToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findValidEmailVerificationToken(tokenHash: string): Promise<EmailVerificationTokenRecord | null>;
  markEmailVerificationTokenUsed(id: string): Promise<void>;
}

export interface CityFilters {
  query?: string;
  countryCode?: string;
  region?: string;
  page: number;
  pageSize: number;
}

export interface CityRepository {
  findById(id: string): Promise<City | null>;
  findAll(filters: CityFilters): Promise<PaginatedResponse<City>>;
  getPopular(limit: number): Promise<City[]>;
}

export interface ActivityFilters {
  cityId?: string;
  query?: string;
  category?: string;
  page: number;
  pageSize: number;
}

export interface ActivityRepository {
  findById(id: string): Promise<Activity | null>;
  findAll(filters: ActivityFilters): Promise<PaginatedResponse<Activity>>;
  findByCityId(cityId: string): Promise<Activity[]>;
  getPopular(limit: number): Promise<Activity[]>;
}

export interface TripFilters {
  userId: string;
  status?: string;
  page: number;
  pageSize: number;
}

export interface TripRepository {
  create(data: Omit<TripProps, 'id' | 'createdAt' | 'updatedAt' | 'lockVersion' | 'copyCount' | 'viewCount' | 'estimatedBudgetTotal'>): Promise<Trip>;
  findByIdAndOwner(id: string, userId: string): Promise<Trip | null>;
  findById(id: string): Promise<Trip | null>;
  findByShareToken(token: string): Promise<Trip | null>;
  findAll(filters: TripFilters): Promise<PaginatedResponse<Trip>>;
  update(id: string, userId: string, data: Partial<TripProps>, expectedVersion?: number): Promise<Trip>;
  softDelete(id: string, userId: string): Promise<void>;
  incrementCopyCount(id: string): Promise<void>;
  incrementViewCount(id: string): Promise<void>;
  findTripsForCalendar(userId: string, startDate: string, endDate: string): Promise<Trip[]>;
  findRecentByUser(userId: string, limit: number): Promise<Trip[]>;
  refreshEstimatedBudget(tripId: string): Promise<void>;
}

export interface TripStopRepository {
  create(data: Omit<TripStopProps, 'id' | 'createdAt' | 'updatedAt' | 'lockVersion'>): Promise<TripStop>;
  findByTripId(tripId: string): Promise<TripStop[]>;
  findById(id: string): Promise<TripStop | null>;
  update(id: string, data: Partial<TripStopProps>, expectedVersion?: number): Promise<TripStop>;
  delete(id: string): Promise<number>; // returns deleted sequenceOrder
  resequenceAfterDelete(tripId: string, deletedSequence: number): Promise<void>;
  reorder(tripId: string, orderedStopIds: string[]): Promise<TripStop[]>;
  getNextSequence(tripId: string): Promise<number>;
  countByTripId(tripId: string): Promise<number>;
}

export interface ItineraryItemRepository {
  create(data: Omit<ItineraryItemProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<ItineraryItem>;
  findByStopId(stopId: string): Promise<ItineraryItem[]>;
  findByTripId(tripId: string): Promise<ItineraryItem[]>;
  findById(id: string): Promise<ItineraryItem | null>;
  update(id: string, data: Partial<ItineraryItemProps>): Promise<ItineraryItem>;
  delete(id: string): Promise<void>;
  getNextSequence(stopId: string, itemDate: string): Promise<number>;
}

export interface SavedDestinationRepository {
  save(userId: string, cityId: string): Promise<void>;
  unsave(userId: string, cityId: string): Promise<void>;
  findByUserId(userId: string): Promise<City[]>;
  isSaved(userId: string, cityId: string): Promise<boolean>;
}

export interface CommunityPostFilters {
  query?: string;
  cursor?: string;
  pageSize: number;
}

export interface CommunityPostRepository {
  create(data: Omit<CommunityPostProps, 'id' | 'createdAt' | 'updatedAt' | 'likeCount' | 'commentCount'>): Promise<CommunityPost>;
  findById(id: string): Promise<CommunityPost | null>;
  findFeed(filters: CommunityPostFilters): Promise<CursorPaginatedResponse<CommunityPost>>;
  delete(id: string): Promise<void>;
  incrementLikeCount(postId: string): Promise<void>;
  decrementLikeCount(postId: string): Promise<void>;
  incrementCommentCount(postId: string): Promise<void>;
}

export interface CommunityCommentRepository {
  create(data: Omit<CommunityCommentProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<CommunityComment>;
  findByPostId(postId: string): Promise<CommunityComment[]>;
  delete(id: string): Promise<void>;
}

export interface CommunityLikeRepository {
  like(postId: string, userId: string): Promise<boolean>; // true if newly liked
  unlike(postId: string, userId: string): Promise<boolean>;
  hasLiked(postId: string, userId: string): Promise<boolean>;
}

export interface AuditLogRepository {
  log(entry: {
    actorUserId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  countRecentFailedLogins(userId: string, minutes: number): Promise<number>;
}

export interface IdempotencyRepository {
  get(userId: string, key: string): Promise<{ statusCode: number; payload: Record<string, unknown> } | null>;
  set(userId: string, key: string, statusCode: number, payload: Record<string, unknown>): Promise<void>;
}
