import { User, type UserProps } from '../../domain/entities/user.js';
import { Trip, type TripProps } from '../../domain/entities/trip.js';
import { TripStop, type TripStopProps } from '../../domain/entities/trip-stop.js';
import { ItineraryItem, type ItineraryItemProps } from '../../domain/entities/itinerary-item.js';
import { City, type CityProps } from '../../domain/entities/city.js';
import { Activity, type ActivityProps } from '../../domain/entities/activity.js';
import { CommunityPost, type CommunityPostProps } from '../../domain/entities/community-post.js';
import { CommunityComment, type CommunityCommentProps } from '../../domain/entities/community-comment.js';
import { CommunityLike, type CommunityLikeProps } from '../../domain/entities/community-like.js';
import { SavedDestination, type SavedDestinationProps } from '../../domain/entities/saved-destination.js';
import type {
  RefreshTokenRecord,
  PasswordResetTokenRecord,
  EmailVerificationTokenRecord,
} from '../../application/ports/repositories.js';

export class MemoryStore {
  public users: Map<string, UserProps> = new Map();
  public refreshTokens: Map<string, RefreshTokenRecord> = new Map();
  public passwordResetTokens: Map<string, PasswordResetTokenRecord> = new Map();
  public emailVerificationTokens: Map<string, EmailVerificationTokenRecord> = new Map();
  public cities: Map<string, CityProps> = new Map();
  public activities: Map<string, ActivityProps> = new Map();
  public trips: Map<string, TripProps> = new Map();
  public tripStops: Map<string, TripStopProps> = new Map();
  public itineraryItems: Map<string, ItineraryItemProps> = new Map();
  public savedDestinations: Map<string, SavedDestinationProps> = new Map();
  public communityPosts: Map<string, CommunityPostProps> = new Map();
  public communityComments: Map<string, CommunityCommentProps> = new Map();
  public communityLikes: Map<string, CommunityLikeProps> = new Map();
  public auditLogs: Array<{
    id: number;
    actorUserId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
  }> = [];
  public idempotencyKeys: Map<string, { statusCode: number; payload: Record<string, unknown>; createdAt: Date }> = new Map();

  constructor() {
    this.seedDefaultData();
  }

  public clear(): void {
    this.users.clear();
    this.refreshTokens.clear();
    this.passwordResetTokens.clear();
    this.emailVerificationTokens.clear();
    this.trips.clear();
    this.tripStops.clear();
    this.itineraryItems.clear();
    this.savedDestinations.clear();
    this.communityPosts.clear();
    this.communityComments.clear();
    this.communityLikes.clear();
    this.auditLogs = [];
    this.idempotencyKeys.clear();
    this.seedDefaultData();
  }

  private seedDefaultData(): void {
    const seedCities: CityProps[] = [
      { id: '11111111-1111-1111-1111-111111111101', name: 'Paris', country: 'France', countryCode: 'FR', region: 'Europe', costIndex: 4, popularityScore: 98, latitude: 48.8566, longitude: 2.3522, imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34', description: 'The City of Light', createdAt: new Date(), updatedAt: new Date() },
      { id: '11111111-1111-1111-1111-111111111102', name: 'Tokyo', country: 'Japan', countryCode: 'JP', region: 'Asia', costIndex: 4, popularityScore: 99, latitude: 35.6762, longitude: 139.6503, imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26', description: 'Metropolis of modern tech and ancient shrines', createdAt: new Date(), updatedAt: new Date() },
      { id: '11111111-1111-1111-1111-111111111103', name: 'Rome', country: 'Italy', countryCode: 'IT', region: 'Europe', costIndex: 3, popularityScore: 95, latitude: 41.9028, longitude: 12.4964, imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5', description: 'The Eternal City', createdAt: new Date(), updatedAt: new Date() },
      { id: '11111111-1111-1111-1111-111111111104', name: 'New York', country: 'United States', countryCode: 'US', region: 'North America', costIndex: 5, popularityScore: 96, latitude: 40.7128, longitude: -74.006, imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9', description: 'The city that never sleeps', createdAt: new Date(), updatedAt: new Date() },
      { id: '11111111-1111-1111-1111-111111111105', name: 'London', country: 'United Kingdom', countryCode: 'GB', region: 'Europe', costIndex: 4, popularityScore: 94, latitude: 51.5074, longitude: -0.1278, imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad', description: 'Historic capital on the River Thames', createdAt: new Date(), updatedAt: new Date() },
      { id: '11111111-1111-1111-1111-111111111106', name: 'Kyoto', country: 'Japan', countryCode: 'JP', region: 'Asia', costIndex: 3, popularityScore: 92, latitude: 35.0116, longitude: 135.7681, imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e', description: 'City of ten thousand shrines', createdAt: new Date(), updatedAt: new Date() },
      { id: '11111111-1111-1111-1111-111111111107', name: 'Barcelona', country: 'Spain', countryCode: 'ES', region: 'Europe', costIndex: 3, popularityScore: 91, latitude: 41.3851, longitude: 2.1734, imageUrl: 'https://images.unsplash.com/photo-1583422409516-2895a77efded', description: 'Gaudí architecture and Mediterranean coast', createdAt: new Date(), updatedAt: new Date() },
      { id: '11111111-1111-1111-1111-111111111108', name: 'Sydney', country: 'Australia', countryCode: 'AU', region: 'Oceania', costIndex: 4, popularityScore: 89, latitude: -33.8688, longitude: 151.2093, imageUrl: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9', description: 'Harbour city with iconic Opera House', createdAt: new Date(), updatedAt: new Date() },
    ];

    for (const city of seedCities) {
      this.cities.set(city.id, city);
    }

    const seedActivities: ActivityProps[] = [
      { id: '22222222-2222-2222-2222-222222222201', cityId: '11111111-1111-1111-1111-111111111101', name: 'Eiffel Tower Summit Tour', category: 'sightseeing', costEstimate: '35.00', currencyCode: 'EUR', durationMinutes: 150, popularityScore: 98, description: 'Iconic tower summit ascent with panoramic city view', createdAt: new Date(), updatedAt: new Date() },
      { id: '22222222-2222-2222-2222-222222222202', cityId: '11111111-1111-1111-1111-111111111101', name: 'Louvre Museum Guided Tour', category: 'culture', costEstimate: '45.00', currencyCode: 'EUR', durationMinutes: 180, popularityScore: 96, description: 'Explore masterpieces including Mona Lisa', createdAt: new Date(), updatedAt: new Date() },
      { id: '22222222-2222-2222-2222-222222222203', cityId: '11111111-1111-1111-1111-111111111102', name: 'Shibuya Crossing & Street Food Walking Tour', category: 'food', costEstimate: '50.00', currencyCode: 'JPY', durationMinutes: 120, popularityScore: 95, description: 'Tasting local yakitori, ramen, and takoyaki', createdAt: new Date(), updatedAt: new Date() },
      { id: '22222222-2222-2222-2222-222222222204', cityId: '11111111-1111-1111-1111-111111111103', name: 'Colosseum & Roman Forum Tour', category: 'sightseeing', costEstimate: '40.00', currencyCode: 'EUR', durationMinutes: 180, popularityScore: 97, description: 'Walk through ancient gladiatorial grounds', createdAt: new Date(), updatedAt: new Date() },
    ];

    for (const act of seedActivities) {
      this.activities.set(act.id, act);
    }

    // Seed Designated Admin User
    const adminUser: UserProps = {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin1234',
      email: 'admin1234@temporaryaccount.none',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$vU0o1Gz92bJvH7C10H2jKg$Z5i1r7HjH0FjW4Zq4lKk1jG0t3vX4bV1yU9w2kP4mQo', // AdminPassword123!
      firstName: 'GlobeTrotter',
      lastName: 'Admin',
      phoneNumber: '+19999999999',
      city: 'Admin HQ',
      country: 'Global',
      additionalInfo: 'Primary System Administrator for GlobeTrotter',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      languagePreference: 'en',
      role: 'admin',
      status: 'active',
      hasVerifiedEmail: true,
      notificationPreferences: { email: true, push: true, inApp: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);

    // Seed Anurag's Registered Account
    const anuragUser: UserProps = {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'anuragpo',
      email: 'anuragpo393@gmail.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$vU0o1Gz92bJvH7C10H2jKg$Z5i1r7HjH0FjW4Zq4lKk1jG0t3vX4bV1yU9w2kP4mQo',
      firstName: 'Anurag',
      lastName: 'P O',
      phoneNumber: '+919876543210',
      city: 'Bangalore',
      country: 'India',
      additionalInfo: 'Registered GlobeTrotter Explorer',
      languagePreference: 'en',
      role: 'user',
      status: 'active',
      hasVerifiedEmail: true,
      notificationPreferences: { email: true, push: true, inApp: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(anuragUser.id, anuragUser);
  }
}

export const globalMemoryStore = new MemoryStore();
