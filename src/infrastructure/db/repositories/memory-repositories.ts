import { User, type UserProps } from '../../../domain/entities/user.js';
import { Trip, type TripProps } from '../../../domain/entities/trip.js';
import { TripStop, type TripStopProps } from '../../../domain/entities/trip-stop.js';
import { ItineraryItem, type ItineraryItemProps } from '../../../domain/entities/itinerary-item.js';
import { City, type CityProps } from '../../../domain/entities/city.js';
import { Activity, type ActivityProps } from '../../../domain/entities/activity.js';
import { CommunityPost, type CommunityPostProps } from '../../../domain/entities/community-post.js';
import { CommunityComment, type CommunityCommentProps } from '../../../domain/entities/community-comment.js';
import { generateUuid } from '../../../shared/utils/uuid.js';
import { sumDecimals } from '../../../shared/utils/decimal.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';
import type {
  UserRepository,
  UserFilters,
  AuthTokenRepository,
  RefreshTokenRecord,
  PasswordResetTokenRecord,
  EmailVerificationTokenRecord,
  CityRepository,
  CityFilters,
  ActivityRepository,
  ActivityFilters,
  TripRepository,
  TripFilters,
  TripStopRepository,
  ItineraryItemRepository,
  SavedDestinationRepository,
  CommunityPostRepository,
  CommunityPostFilters,
  CommunityCommentRepository,
  CommunityLikeRepository,
  AuditLogRepository,
  IdempotencyRepository,
} from '../../../application/ports/repositories.js';
import type { MemoryStore } from '../memory-store.js';
import type { PaginatedResponse, CursorPaginatedResponse } from '../../../shared/types/pagination.js';

export class MemoryUserRepository implements UserRepository {
  constructor(private store: MemoryStore) {}

  async create(data: Omit<UserProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const existing = await this.findByUsernameOrEmail(data.email);
    if (existing) throw AppError.conflict(ErrorCodes.EMAIL_TAKEN, 'Email is already registered');

    const existingName = await this.findByUsernameOrEmail(data.username);
    if (existingName) throw AppError.conflict(ErrorCodes.USERNAME_TAKEN, 'Username is already taken');

    const id = generateUuid();
    const props: UserProps = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.users.set(id, props);
    return new User(props);
  }

  async findById(id: string): Promise<User | null> {
    const props = this.store.users.get(id);
    if (!props || props.deletedAt) return null;
    return new User(props);
  }

  async findByUsernameOrEmail(identifier: string): Promise<User | null> {
    const clean = identifier.toLowerCase().trim();
    for (const u of this.store.users.values()) {
      if (u.deletedAt) continue;
      if (u.email.toLowerCase() === clean || u.username.toLowerCase() === clean) {
        return new User(u);
      }
    }
    return null;
  }

  async update(id: string, data: Partial<UserProps>): Promise<User> {
    const user = this.store.users.get(id);
    if (!user || user.deletedAt) throw AppError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');

    const updated: UserProps = {
      ...user,
      ...data,
      id,
      updatedAt: new Date(),
    };
    this.store.users.set(id, updated);
    return new User(updated);
  }

  async softDelete(id: string): Promise<void> {
    const user = this.store.users.get(id);
    if (user) {
      user.deletedAt = new Date();
      user.status = 'deactivated';
      user.updatedAt = new Date();
      this.store.users.set(id, user);
    }
  }

  async findAll(filters: UserFilters): Promise<PaginatedResponse<User>> {
    let list = Array.from(this.store.users.values()).filter((u) => !u.deletedAt);
    if (filters.status) {
      list = list.filter((u) => u.status === filters.status);
    }
    if (filters.role) {
      list = list.filter((u) => u.role === filters.role);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((u) => u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.firstName.toLowerCase().includes(q) || u.lastName.toLowerCase().includes(q));
    }

    const totalCount = list.length;
    const offset = (filters.page - 1) * filters.pageSize;
    const items = list.slice(offset, offset + filters.pageSize).map((p) => new User(p));

    return {
      items,
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / filters.pageSize) || 1,
    };
  }
}

export class MemoryAuthTokenRepository implements AuthTokenRepository {
  constructor(private store: MemoryStore) {}

  async createRefreshToken(data: { userId: string; tokenHash: string; deviceLabel?: string; expiresAt: Date }): Promise<void> {
    const id = generateUuid();
    this.store.refreshTokens.set(data.tokenHash, {
      id,
      userId: data.userId,
      tokenHash: data.tokenHash,
      deviceLabel: data.deviceLabel,
      expiresAt: data.expiresAt,
    });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const record = this.store.refreshTokens.get(tokenHash);
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      return null;
    }
    return record;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    const record = this.store.refreshTokens.get(tokenHash);
    if (record) {
      record.revokedAt = new Date();
      this.store.refreshTokens.set(tokenHash, record);
    }
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    for (const [hash, record] of this.store.refreshTokens.entries()) {
      if (record.userId === userId && !record.revokedAt) {
        record.revokedAt = new Date();
        this.store.refreshTokens.set(hash, record);
      }
    }
  }

  async createPasswordResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    const id = generateUuid();
    this.store.passwordResetTokens.set(data.tokenHash, {
      id,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
    });
  }

  async findValidPasswordResetToken(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    const record = this.store.passwordResetTokens.get(tokenHash);
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return null;
    }
    return record;
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    for (const [hash, record] of this.store.passwordResetTokens.entries()) {
      if (record.id === id) {
        record.usedAt = new Date();
        this.store.passwordResetTokens.set(hash, record);
      }
    }
  }

  async createEmailVerificationToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    const id = generateUuid();
    this.store.emailVerificationTokens.set(data.tokenHash, {
      id,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
    });
  }

  async findValidEmailVerificationToken(tokenHash: string): Promise<EmailVerificationTokenRecord | null> {
    const record = this.store.emailVerificationTokens.get(tokenHash);
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return null;
    }
    return record;
  }

  async markEmailVerificationTokenUsed(id: string): Promise<void> {
    for (const [hash, record] of this.store.emailVerificationTokens.entries()) {
      if (record.id === id) {
        record.usedAt = new Date();
        this.store.emailVerificationTokens.set(hash, record);
      }
    }
  }
}

export class MemoryCityRepository implements CityRepository {
  constructor(private store: MemoryStore) {}

  async findById(id: string): Promise<City | null> {
    const p = this.store.cities.get(id);
    return p ? new City(p) : null;
  }

  async findAll(filters: CityFilters): Promise<PaginatedResponse<City>> {
    let list = Array.from(this.store.cities.values());
    if (filters.countryCode) {
      list = list.filter((c) => c.countryCode.toUpperCase() === filters.countryCode?.toUpperCase());
    }
    if (filters.region) {
      list = list.filter((c) => c.region?.toLowerCase() === filters.region?.toLowerCase());
    }
    if (filters.query) {
      const q = filters.query.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q));
    }

    list.sort((a, b) => b.popularityScore - a.popularityScore);

    const totalCount = list.length;
    const offset = (filters.page - 1) * filters.pageSize;
    const items = list.slice(offset, offset + filters.pageSize).map((p) => new City(p));

    return {
      items,
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / filters.pageSize) || 1,
    };
  }

  async getPopular(limit: number): Promise<City[]> {
    return Array.from(this.store.cities.values())
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit)
      .map((p) => new City(p));
  }
}

export class MemoryActivityRepository implements ActivityRepository {
  constructor(private store: MemoryStore) {}

  async findById(id: string): Promise<Activity | null> {
    const p = this.store.activities.get(id);
    return p ? new Activity(p) : null;
  }

  async findByCityId(cityId: string): Promise<Activity[]> {
    return Array.from(this.store.activities.values())
      .filter((a) => a.cityId === cityId)
      .map((p) => new Activity(p));
  }

  async findAll(filters: ActivityFilters): Promise<PaginatedResponse<Activity>> {
    let list = Array.from(this.store.activities.values());
    if (filters.cityId) {
      list = list.filter((a) => a.cityId === filters.cityId);
    }
    if (filters.category) {
      list = list.filter((a) => a.category.toLowerCase() === filters.category?.toLowerCase());
    }
    if (filters.query) {
      const q = filters.query.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q));
    }

    list.sort((a, b) => b.popularityScore - a.popularityScore);

    const totalCount = list.length;
    const offset = (filters.page - 1) * filters.pageSize;
    const items = list.slice(offset, offset + filters.pageSize).map((p) => new Activity(p));

    return {
      items,
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / filters.pageSize) || 1,
    };
  }

  async getPopular(limit: number): Promise<Activity[]> {
    return Array.from(this.store.activities.values())
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit)
      .map((p) => new Activity(p));
  }
}

export class MemoryTripRepository implements TripRepository {
  constructor(private store: MemoryStore) {}

  async create(data: Omit<TripProps, 'id' | 'createdAt' | 'updatedAt' | 'lockVersion' | 'copyCount' | 'viewCount' | 'estimatedBudgetTotal'>): Promise<Trip> {
    const id = generateUuid();
    const props: TripProps = {
      ...data,
      id,
      estimatedBudgetTotal: '0.00',
      copyCount: 0,
      viewCount: 0,
      lockVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.trips.set(id, props);
    return new Trip(props);
  }

  async findByIdAndOwner(id: string, userId: string): Promise<Trip | null> {
    const trip = this.store.trips.get(id);
    if (!trip || trip.deletedAt || trip.userId !== userId) return null;
    return new Trip(trip);
  }

  async findById(id: string): Promise<Trip | null> {
    const trip = this.store.trips.get(id);
    if (!trip || trip.deletedAt) return null;
    return new Trip(trip);
  }

  async findByShareToken(token: string): Promise<Trip | null> {
    for (const t of this.store.trips.values()) {
      if (!t.deletedAt && t.isPublic && t.shareToken === token) {
        return new Trip(t);
      }
    }
    return null;
  }

  async findAll(filters: TripFilters): Promise<PaginatedResponse<Trip>> {
    let list = Array.from(this.store.trips.values()).filter(
      (t) => !t.deletedAt && t.userId === filters.userId
    );
    if (filters.status) {
      list = list.filter((t) => t.status === filters.status);
    }
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const totalCount = list.length;
    const offset = (filters.page - 1) * filters.pageSize;
    const items = list.slice(offset, offset + filters.pageSize).map((p) => new Trip(p));

    return {
      items,
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / filters.pageSize) || 1,
    };
  }

  async update(id: string, userId: string, data: Partial<TripProps>, expectedVersion?: number): Promise<Trip> {
    const trip = this.store.trips.get(id);
    if (!trip || trip.deletedAt || trip.userId !== userId) {
      throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip not found');
    }

    if (expectedVersion !== undefined && trip.lockVersion !== expectedVersion) {
      throw AppError.conflict(ErrorCodes.LOCK_VERSION_MISMATCH, 'Trip was updated by another request');
    }

    const updated: TripProps = {
      ...trip,
      ...data,
      id,
      userId,
      lockVersion: trip.lockVersion + 1,
      updatedAt: new Date(),
    };
    this.store.trips.set(id, updated);
    return new Trip(updated);
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const trip = this.store.trips.get(id);
    if (trip && trip.userId === userId) {
      trip.deletedAt = new Date();
      trip.updatedAt = new Date();
      this.store.trips.set(id, trip);
    }
  }

  async incrementCopyCount(id: string): Promise<void> {
    const trip = this.store.trips.get(id);
    if (trip) {
      trip.copyCount += 1;
      this.store.trips.set(id, trip);
    }
  }

  async incrementViewCount(id: string): Promise<void> {
    const trip = this.store.trips.get(id);
    if (trip) {
      trip.viewCount += 1;
      this.store.trips.set(id, trip);
    }
  }

  async findTripsForCalendar(userId: string, startDate: string, endDate: string): Promise<Trip[]> {
    return Array.from(this.store.trips.values())
      .filter((t) => !t.deletedAt && t.userId === userId && t.startDate <= endDate && t.endDate >= startDate)
      .map((p) => new Trip(p));
  }

  async findRecentByUser(userId: string, limit: number): Promise<Trip[]> {
    return Array.from(this.store.trips.values())
      .filter((t) => !t.deletedAt && t.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)
      .map((p) => new Trip(p));
  }

  async refreshEstimatedBudget(tripId: string): Promise<void> {
    const stops = Array.from(this.store.tripStops.values()).filter((s) => s.tripId === tripId);
    const stopIds = new Set(stops.map((s) => s.id));
    const items = Array.from(this.store.itineraryItems.values()).filter((i) => stopIds.has(i.tripStopId));
    const total = sumDecimals(items.map((i) => i.cost));

    const trip = this.store.trips.get(tripId);
    if (trip) {
      trip.estimatedBudgetTotal = total;
      this.store.trips.set(tripId, trip);
    }
  }
}

export class MemoryTripStopRepository implements TripStopRepository {
  constructor(private store: MemoryStore, private tripRepo: TripRepository) {}

  async create(data: Omit<TripStopProps, 'id' | 'createdAt' | 'updatedAt' | 'lockVersion'>): Promise<TripStop> {
    const id = generateUuid();
    const props: TripStopProps = {
      ...data,
      id,
      lockVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.tripStops.set(id, props);
    return new TripStop(props);
  }

  async findByTripId(tripId: string): Promise<TripStop[]> {
    return Array.from(this.store.tripStops.values())
      .filter((s) => s.tripId === tripId)
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      .map((p) => new TripStop(p));
  }

  async findById(id: string): Promise<TripStop | null> {
    const p = this.store.tripStops.get(id);
    return p ? new TripStop(p) : null;
  }

  async update(id: string, data: Partial<TripStopProps>, expectedVersion?: number): Promise<TripStop> {
    const stop = this.store.tripStops.get(id);
    if (!stop) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Trip stop not found');

    if (expectedVersion !== undefined && stop.lockVersion !== expectedVersion) {
      throw AppError.conflict(ErrorCodes.LOCK_VERSION_MISMATCH, 'Trip stop was updated by another request');
    }

    const updated: TripStopProps = {
      ...stop,
      ...data,
      id,
      lockVersion: stop.lockVersion + 1,
      updatedAt: new Date(),
    };
    this.store.tripStops.set(id, updated);
    return new TripStop(updated);
  }

  async delete(id: string): Promise<number> {
    const stop = this.store.tripStops.get(id);
    if (!stop) return 0;
    const seq = stop.sequenceOrder;
    const tripId = stop.tripId;

    // cascade items
    for (const [itemId, item] of this.store.itineraryItems.entries()) {
      if (item.tripStopId === id) {
        this.store.itineraryItems.delete(itemId);
      }
    }

    this.store.tripStops.delete(id);
    await this.tripRepo.refreshEstimatedBudget(tripId);
    return seq;
  }

  async resequenceAfterDelete(tripId: string, deletedSequence: number): Promise<void> {
    for (const stop of this.store.tripStops.values()) {
      if (stop.tripId === tripId && stop.sequenceOrder > deletedSequence) {
        stop.sequenceOrder -= 1;
        this.store.tripStops.set(stop.id, stop);
      }
    }
  }

  async reorder(tripId: string, orderedStopIds: string[]): Promise<TripStop[]> {
    for (let i = 0; i < orderedStopIds.length; i++) {
      const stopId = orderedStopIds[i];
      if (!stopId) continue;
      const stop = this.store.tripStops.get(stopId);
      if (stop && stop.tripId === tripId) {
        stop.sequenceOrder = i + 1;
        this.store.tripStops.set(stop.id, stop);
      }
    }
    return this.findByTripId(tripId);
  }

  async getNextSequence(tripId: string): Promise<number> {
    const stops = await this.findByTripId(tripId);
    if (stops.length === 0) return 1;
    return Math.max(...stops.map((s) => s.sequenceOrder)) + 1;
  }

  async countByTripId(tripId: string): Promise<number> {
    return Array.from(this.store.tripStops.values()).filter((s) => s.tripId === tripId).length;
  }
}

export class MemoryItineraryItemRepository implements ItineraryItemRepository {
  constructor(private store: MemoryStore, private tripRepo: TripRepository) {}

  async create(data: Omit<ItineraryItemProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<ItineraryItem> {
    const id = generateUuid();
    const props: ItineraryItemProps = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.itineraryItems.set(id, props);

    const stop = this.store.tripStops.get(data.tripStopId);
    if (stop) {
      await this.tripRepo.refreshEstimatedBudget(stop.tripId);
    }

    return new ItineraryItem(props);
  }

  async findByStopId(stopId: string): Promise<ItineraryItem[]> {
    return Array.from(this.store.itineraryItems.values())
      .filter((i) => i.tripStopId === stopId)
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      .map((p) => new ItineraryItem(p));
  }

  async findByTripId(tripId: string): Promise<ItineraryItem[]> {
    const stopIds = new Set(
      Array.from(this.store.tripStops.values())
        .filter((s) => s.tripId === tripId)
        .map((s) => s.id)
    );
    return Array.from(this.store.itineraryItems.values())
      .filter((i) => stopIds.has(i.tripStopId))
      .sort((a, b) => a.itemDate.localeCompare(b.itemDate) || a.sequenceOrder - b.sequenceOrder)
      .map((p) => new ItineraryItem(p));
  }

  async findById(id: string): Promise<ItineraryItem | null> {
    const p = this.store.itineraryItems.get(id);
    return p ? new ItineraryItem(p) : null;
  }

  async update(id: string, data: Partial<ItineraryItemProps>): Promise<ItineraryItem> {
    const item = this.store.itineraryItems.get(id);
    if (!item) throw AppError.notFound(ErrorCodes.TRIP_NOT_FOUND, 'Itinerary item not found');

    const updated: ItineraryItemProps = {
      ...item,
      ...data,
      id,
      updatedAt: new Date(),
    };
    this.store.itineraryItems.set(id, updated);

    const stop = this.store.tripStops.get(updated.tripStopId);
    if (stop) {
      await this.tripRepo.refreshEstimatedBudget(stop.tripId);
    }

    return new ItineraryItem(updated);
  }

  async delete(id: string): Promise<void> {
    const item = this.store.itineraryItems.get(id);
    if (item) {
      const stopId = item.tripStopId;
      this.store.itineraryItems.delete(id);
      const stop = this.store.tripStops.get(stopId);
      if (stop) {
        await this.tripRepo.refreshEstimatedBudget(stop.tripId);
      }
    }
  }

  async getNextSequence(stopId: string, itemDate: string): Promise<number> {
    const items = Array.from(this.store.itineraryItems.values()).filter(
      (i) => i.tripStopId === stopId && i.itemDate === itemDate
    );
    if (items.length === 0) return 1;
    return Math.max(...items.map((i) => i.sequenceOrder)) + 1;
  }
}

export class MemorySavedDestinationRepository implements SavedDestinationRepository {
  constructor(private store: MemoryStore) {}

  async save(userId: string, cityId: string): Promise<void> {
    const key = `${userId}:${cityId}`;
    if (this.store.savedDestinations.has(key)) return;
    this.store.savedDestinations.set(key, {
      id: generateUuid(),
      userId,
      cityId,
      createdAt: new Date(),
    });
  }

  async unsave(userId: string, cityId: string): Promise<void> {
    const key = `${userId}:${cityId}`;
    this.store.savedDestinations.delete(key);
  }

  async findByUserId(userId: string): Promise<City[]> {
    const cities: City[] = [];
    for (const item of this.store.savedDestinations.values()) {
      if (item.userId === userId) {
        const c = this.store.cities.get(item.cityId);
        if (c) cities.push(new City(c));
      }
    }
    return cities;
  }

  async isSaved(userId: string, cityId: string): Promise<boolean> {
    return this.store.savedDestinations.has(`${userId}:${cityId}`);
  }
}

export class MemoryCommunityPostRepository implements CommunityPostRepository {
  constructor(private store: MemoryStore) {}

  async create(data: Omit<CommunityPostProps, 'id' | 'createdAt' | 'updatedAt' | 'likeCount' | 'commentCount'>): Promise<CommunityPost> {
    const id = generateUuid();
    const props: CommunityPostProps = {
      ...data,
      id,
      likeCount: 0,
      commentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.communityPosts.set(id, props);
    return new CommunityPost(props);
  }

  async findById(id: string): Promise<CommunityPost | null> {
    const p = this.store.communityPosts.get(id);
    if (!p || p.deletedAt) return null;
    return new CommunityPost(p);
  }

  async findFeed(filters: CommunityPostFilters): Promise<CursorPaginatedResponse<CommunityPost>> {
    let list = Array.from(this.store.communityPosts.values()).filter((p) => !p.deletedAt);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      list = list.filter((p) => p.content.toLowerCase().includes(q));
    }
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIndex = 0;
    if (filters.cursor) {
      const cursorDate = new Date(filters.cursor).getTime();
      startIndex = list.findIndex((p) => p.createdAt.getTime() < cursorDate);
      if (startIndex === -1) startIndex = list.length;
    }

    const slice = list.slice(startIndex, startIndex + filters.pageSize);
    const lastItem = slice[slice.length - 1];
    const nextCursor = slice.length === filters.pageSize && lastItem ? lastItem.createdAt.toISOString() : null;

    return {
      items: slice.map((p) => new CommunityPost(p)),
      nextCursor,
    };
  }

  async delete(id: string): Promise<void> {
    const p = this.store.communityPosts.get(id);
    if (p) {
      p.deletedAt = new Date();
      this.store.communityPosts.set(id, p);
    }
  }

  async incrementLikeCount(postId: string): Promise<void> {
    const p = this.store.communityPosts.get(postId);
    if (p) {
      p.likeCount += 1;
      this.store.communityPosts.set(postId, p);
    }
  }

  async decrementLikeCount(postId: string): Promise<void> {
    const p = this.store.communityPosts.get(postId);
    if (p) {
      p.likeCount = Math.max(0, p.likeCount - 1);
      this.store.communityPosts.set(postId, p);
    }
  }

  async incrementCommentCount(postId: string): Promise<void> {
    const p = this.store.communityPosts.get(postId);
    if (p) {
      p.commentCount += 1;
      this.store.communityPosts.set(postId, p);
    }
  }
}

export class MemoryCommunityCommentRepository implements CommunityCommentRepository {
  constructor(private store: MemoryStore, private postRepo: CommunityPostRepository) {}

  async create(data: Omit<CommunityCommentProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<CommunityComment> {
    const id = generateUuid();
    const props: CommunityCommentProps = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.communityComments.set(id, props);
    await this.postRepo.incrementCommentCount(data.postId);
    return new CommunityComment(props);
  }

  async findByPostId(postId: string): Promise<CommunityComment[]> {
    return Array.from(this.store.communityComments.values())
      .filter((c) => c.postId === postId && !c.deletedAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((p) => new CommunityComment(p));
  }

  async delete(id: string): Promise<void> {
    const c = this.store.communityComments.get(id);
    if (c) {
      c.deletedAt = new Date();
      this.store.communityComments.set(id, c);
    }
  }
}

export class MemoryCommunityLikeRepository implements CommunityLikeRepository {
  constructor(private store: MemoryStore, private postRepo: CommunityPostRepository) {}

  async like(postId: string, userId: string): Promise<boolean> {
    const key = `${postId}:${userId}`;
    if (this.store.communityLikes.has(key)) return false;

    this.store.communityLikes.set(key, {
      id: generateUuid(),
      postId,
      userId,
      createdAt: new Date(),
    });
    await this.postRepo.incrementLikeCount(postId);
    return true;
  }

  async unlike(postId: string, userId: string): Promise<boolean> {
    const key = `${postId}:${userId}`;
    if (!this.store.communityLikes.has(key)) return false;

    this.store.communityLikes.delete(key);
    await this.postRepo.decrementLikeCount(postId);
    return true;
  }

  async hasLiked(postId: string, userId: string): Promise<boolean> {
    return this.store.communityLikes.has(`${postId}:${userId}`);
  }
}

export class MemoryAuditLogRepository implements AuditLogRepository {
  constructor(private store: MemoryStore) {}

  async log(entry: {
    actorUserId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.store.auditLogs.push({
      id: this.store.auditLogs.length + 1,
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata,
      createdAt: new Date(),
    });
  }

  async countRecentFailedLogins(userId: string, minutes: number): Promise<number> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.store.auditLogs.filter(
      (l) => l.targetId === userId && l.action === 'login_failed' && l.createdAt >= cutoff
    ).length;
  }
}

export class MemoryIdempotencyRepository implements IdempotencyRepository {
  constructor(private store: MemoryStore) {}

  async get(userId: string, key: string): Promise<{ statusCode: number; payload: Record<string, unknown> } | null> {
    const entry = this.store.idempotencyKeys.get(`${userId}:${key}`);
    if (!entry) return null;
    return {
      statusCode: entry.statusCode,
      payload: entry.payload,
    };
  }

  async set(userId: string, key: string, statusCode: number, payload: Record<string, unknown>): Promise<void> {
    this.store.idempotencyKeys.set(`${userId}:${key}`, {
      statusCode,
      payload,
      createdAt: new Date(),
    });
  }
}
