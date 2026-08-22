import type { Generated, ColumnType } from 'kysely';

export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'deactivated';
export type TripStatus = 'draft' | 'planned' | 'ongoing' | 'completed' | 'cancelled';
export type CostCategory = 'transport' | 'stay' | 'activity' | 'meal' | 'other';

export interface UsersTable {
  id: Generated<string>;
  username: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  city: string | null;
  country: string | null;
  additional_info: string | null;
  photo_url: string | null;
  language_preference: Generated<string>;
  role: Generated<UserRole>;
  status: Generated<UserStatus>;
  has_verified_email: Generated<boolean>;
  notification_preferences: Generated<Record<string, unknown>>;
  last_login_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface PasswordResetTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Generated<Date>;
}

export interface EmailVerificationTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Generated<Date>;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  device_label: string | null;
  issued_at: Generated<Date>;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Generated<Date>;
}

export interface CitiesTable {
  id: Generated<string>;
  name: string;
  country: string;
  country_code: string;
  region: string | null;
  cost_index: number | null;
  popularity_score: Generated<number>;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  description: string | null;
  external_source: string | null;
  external_ref_id: string | null;
  search_vector?: unknown;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ActivitiesTable {
  id: Generated<string>;
  city_id: string;
  name: string;
  description: string | null;
  category: string;
  cost_estimate: string | null;
  currency_code: Generated<string>;
  duration_minutes: number | null;
  image_url: string | null;
  popularity_score: Generated<number>;
  external_source: string | null;
  external_ref_id: string | null;
  search_vector?: unknown;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface TripsTable {
  id: Generated<string>;
  user_id: string;
  name: string;
  description: string | null;
  cover_photo_url: string | null;
  start_date: string;
  end_date: string;
  status: Generated<TripStatus>;
  currency_code: Generated<string>;
  estimated_budget_total: Generated<string>;
  primary_timezone: string | null;
  is_public: Generated<boolean>;
  share_token: string | null;
  shared_at: Date | null;
  copy_count: Generated<number>;
  view_count: Generated<number>;
  source_trip_id: string | null;
  lock_version: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface TripStopsTable {
  id: Generated<string>;
  trip_id: string;
  city_id: string | null;
  custom_place_name: string | null;
  sequence_order: number;
  start_date: string;
  end_date: string;
  description: string | null;
  budget_amount: string | null;
  lock_version: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ItineraryItemsTable {
  id: Generated<string>;
  trip_stop_id: string;
  activity_id: string | null;
  custom_name: string | null;
  cost_category: CostCategory;
  item_date: string;
  start_time: Date | null;
  end_time: Date | null;
  cost: Generated<string>;
  currency_code: Generated<string>;
  sequence_order: number;
  notes: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SavedDestinationsTable {
  id: Generated<string>;
  user_id: string;
  city_id: string;
  created_at: Generated<Date>;
}

export interface CommunityPostsTable {
  id: Generated<string>;
  user_id: string;
  trip_id: string | null;
  content: string;
  attachment_urls: Generated<string[]>;
  like_count: Generated<number>;
  comment_count: Generated<number>;
  search_vector?: unknown;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface CommunityCommentsTable {
  id: Generated<string>;
  post_id: string;
  user_id: string;
  content: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface CommunityLikesTable {
  id: Generated<string>;
  post_id: string;
  user_id: string;
  created_at: Generated<Date>;
}

export interface CityPopularityEventsTable {
  id: Generated<number>;
  city_id: string;
  event_type: string;
  user_id: string | null;
  occurred_at: Generated<Date>;
}

export interface ActivityPopularityEventsTable {
  id: Generated<number>;
  activity_id: string;
  event_type: string;
  user_id: string | null;
  occurred_at: Generated<Date>;
}

export interface AuditLogTable {
  id: Generated<number>;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: ColumnType<Record<string, unknown>, Record<string, unknown> | undefined, Record<string, unknown> | undefined>;
  created_at: Generated<Date>;
}

export interface IdempotencyKeysTable {
  id: Generated<string>;
  user_id: string;
  idempotency_key: string;
  status_code: number;
  response_payload: Record<string, unknown>;
  created_at: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  password_reset_tokens: PasswordResetTokensTable;
  email_verification_tokens: EmailVerificationTokensTable;
  refresh_tokens: RefreshTokensTable;
  cities: CitiesTable;
  activities: ActivitiesTable;
  trips: TripsTable;
  trip_stops: TripStopsTable;
  itinerary_items: ItineraryItemsTable;
  saved_destinations: SavedDestinationsTable;
  community_posts: CommunityPostsTable;
  community_comments: CommunityCommentsTable;
  community_likes: CommunityLikesTable;
  city_popularity_events: CityPopularityEventsTable;
  activity_popularity_events: ActivityPopularityEventsTable;
  audit_log: AuditLogTable;
  idempotency_keys: IdempotencyKeysTable;
}
