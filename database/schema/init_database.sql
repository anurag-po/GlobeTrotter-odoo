-- =============================================================================
-- GLOBETROTTER DATABASE DEFINITIVE DDL SPECIFICATION (POSTGRESQL 16+)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- SECTION 1: EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- -----------------------------------------------------------------------------
-- SECTION 2: CUSTOM ENUM TYPES
-- -----------------------------------------------------------------------------
CREATE TYPE user_role_enum AS ENUM ('user', 'admin');
CREATE TYPE user_status_enum AS ENUM ('active', 'suspended', 'deactivated');
CREATE TYPE trip_status_enum AS ENUM ('draft', 'planned', 'ongoing', 'completed', 'cancelled');
CREATE TYPE cost_category_enum AS ENUM ('transport', 'stay', 'activity', 'meal', 'other');

-- -----------------------------------------------------------------------------
-- SECTION 3: SHARED TRIGGER FUNCTIONS
-- -----------------------------------------------------------------------------

-- 3.1 Automatic updated_at timestamp maintenance
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.2 Optimistic concurrency version bumper
CREATE OR REPLACE FUNCTION bump_lock_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.lock_version = OLD.lock_version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.3 Trip budget cache synchronizer
CREATE OR REPLACE FUNCTION refresh_trip_budget_cache()
RETURNS TRIGGER AS $$
DECLARE
    target_trip_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        SELECT s.trip_id INTO target_trip_id 
        FROM trip_stops s 
        WHERE s.id = OLD.trip_stop_id;
    ELSE
        SELECT s.trip_id INTO target_trip_id 
        FROM trip_stops s 
        WHERE s.id = NEW.trip_stop_id;
    END IF;

    IF target_trip_id IS NOT NULL THEN
        UPDATE trips
        SET estimated_budget_total = COALESCE((
            SELECT SUM(i.cost)
            FROM trip_stops s
            JOIN itinerary_items i ON i.trip_stop_id = s.id
            WHERE s.trip_id = target_trip_id
        ), 0.00)
        WHERE id = target_trip_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3.4 Community post like and comment counter synchronizer
CREATE OR REPLACE FUNCTION sync_community_post_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (TG_TABLE_NAME = 'community_likes') THEN
            UPDATE community_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
        ELSIF (TG_TABLE_NAME = 'community_comments') THEN
            UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (TG_TABLE_NAME = 'community_likes') THEN
            UPDATE community_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
        ELSIF (TG_TABLE_NAME = 'community_comments') THEN
            UPDATE community_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3.5 City popularity event recorder
CREATE OR REPLACE FUNCTION record_city_popularity_event()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_TABLE_NAME = 'trip_stops' AND NEW.city_id IS NOT NULL) THEN
        INSERT INTO city_popularity_events (city_id, event_type, user_id, occurred_at)
        SELECT NEW.city_id, 'trip_stop_created', t.user_id, now()
        FROM trips t WHERE t.id = NEW.trip_id;
    ELSIF (TG_TABLE_NAME = 'saved_destinations') THEN
        INSERT INTO city_popularity_events (city_id, event_type, user_id, occurred_at)
        VALUES (NEW.city_id, 'destination_saved', NEW.user_id, now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.6 Activity popularity event recorder
CREATE OR REPLACE FUNCTION record_activity_popularity_event()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.activity_id IS NOT NULL) THEN
        INSERT INTO activity_popularity_events (activity_id, event_type, user_id, occurred_at)
        SELECT NEW.activity_id, 'itinerary_item_added', t.user_id, now()
        FROM trip_stops s
        JOIN trips t ON t.id = s.trip_id
        WHERE s.id = NEW.trip_stop_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- SECTION 4: TABLE DEFINITIONS & CONSTRAINTS
-- -----------------------------------------------------------------------------

-- 4.1 USERS
CREATE TABLE users (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    username                CITEXT          NOT NULL,
    email                   CITEXT          NOT NULL,
    password_hash           TEXT            NOT NULL,
    first_name              TEXT            NOT NULL,
    last_name               TEXT            NOT NULL,
    phone_number            TEXT            NULL,
    city                    TEXT            NULL,
    country                 TEXT            NULL,
    additional_info         TEXT            NULL,
    photo_url               TEXT            NULL,
    language_preference     TEXT            NOT NULL DEFAULT 'en',
    role                    user_role_enum  NOT NULL DEFAULT 'user',
    status                  user_status_enum NOT NULL DEFAULT 'active',
    has_verified_email      BOOLEAN         NOT NULL DEFAULT FALSE,
    notification_preferences JSONB         NOT NULL DEFAULT '{}'::jsonb,
    last_login_at           TIMESTAMPTZ     NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ     NULL,

    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT ck_users_first_name CHECK (char_length(trim(first_name)) > 0),
    CONSTRAINT ck_users_last_name CHECK (char_length(trim(last_name)) > 0),
    CONSTRAINT ck_users_language CHECK (char_length(language_preference) >= 2),
    CONSTRAINT ck_users_notif_prefs CHECK (jsonb_typeof(notification_preferences) = 'object')
);

CREATE UNIQUE INDEX uq_users_username_active ON users (username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_users_email_active ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role_status ON users (role, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4.2 PASSWORD RESET TOKENS
CREATE TABLE password_reset_tokens (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL,
    token_hash              TEXT            NOT NULL,
    expires_at              TIMESTAMPTZ     NOT NULL,
    used_at                 TIMESTAMPTZ     NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_password_reset_tokens PRIMARY KEY (id),
    CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_password_reset_tokens_hash UNIQUE (token_hash),
    CONSTRAINT ck_password_reset_tokens_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens (user_id);
CREATE INDEX idx_password_reset_tokens_lookup ON password_reset_tokens (token_hash) WHERE used_at IS NULL;
CREATE INDEX idx_password_reset_tokens_cleanup ON password_reset_tokens (expires_at);


-- 4.3 EMAIL VERIFICATION TOKENS
CREATE TABLE email_verification_tokens (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL,
    token_hash              TEXT            NOT NULL,
    expires_at              TIMESTAMPTZ     NOT NULL,
    used_at                 TIMESTAMPTZ     NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_email_verification_tokens PRIMARY KEY (id),
    CONSTRAINT fk_email_verification_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_email_verification_tokens_hash UNIQUE (token_hash),
    CONSTRAINT ck_email_verification_tokens_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_email_verification_tokens_user ON email_verification_tokens (user_id);
CREATE INDEX idx_email_verification_tokens_lookup ON email_verification_tokens (token_hash) WHERE used_at IS NULL;
CREATE INDEX idx_email_verification_tokens_cleanup ON email_verification_tokens (expires_at);


-- 4.4 REFRESH TOKENS
CREATE TABLE refresh_tokens (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL,
    token_hash              TEXT            NOT NULL,
    device_label            TEXT            NULL,
    issued_at               TIMESTAMPTZ     NOT NULL DEFAULT now(),
    expires_at              TIMESTAMPTZ     NOT NULL,
    revoked_at              TIMESTAMPTZ     NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT ck_refresh_tokens_expiry CHECK (expires_at > issued_at)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_lookup ON refresh_tokens (token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_cleanup ON refresh_tokens (expires_at);


-- 4.5 CITIES CATALOG
CREATE TABLE cities (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    name                    TEXT            NOT NULL,
    country                 TEXT            NOT NULL,
    country_code            CHAR(2)         NOT NULL,
    region                  TEXT            NULL,
    cost_index              NUMERIC(6,2)    NULL,
    popularity_score        INTEGER         NOT NULL DEFAULT 0,
    latitude                NUMERIC(9,6)    NULL,
    longitude               NUMERIC(9,6)    NULL,
    image_url               TEXT            NULL,
    description             TEXT            NULL,
    external_source         TEXT            NULL,
    external_ref_id         TEXT            NULL,
    search_vector           TSVECTOR        GENERATED ALWAYS AS (
                                setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                                setweight(to_tsvector('english', coalesce(country, '')), 'B') ||
                                setweight(to_tsvector('english', coalesce(region, '')), 'C')
                            ) STORED,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_cities PRIMARY KEY (id),
    CONSTRAINT uq_cities_name_country UNIQUE (name, country_code),
    CONSTRAINT ck_cities_cost_index CHECK (cost_index IS NULL OR cost_index >= 0),
    CONSTRAINT ck_cities_popularity CHECK (popularity_score >= 0),
    CONSTRAINT ck_cities_coords CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude BETWEEN -90.0 AND 90.0 AND longitude BETWEEN -180.0 AND 180.0)
    )
);

CREATE INDEX idx_cities_search_vector ON cities USING gin (search_vector);
CREATE INDEX idx_cities_country_code ON cities (country_code);
CREATE INDEX idx_cities_region ON cities (region) WHERE region IS NOT NULL;
CREATE INDEX idx_cities_popularity ON cities (popularity_score DESC);
CREATE INDEX idx_cities_cost_index ON cities (cost_index) WHERE cost_index IS NOT NULL;

CREATE TRIGGER trg_cities_updated_at
BEFORE UPDATE ON cities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4.6 ACTIVITIES CATALOG
CREATE TABLE activities (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    city_id                 UUID            NOT NULL,
    name                    TEXT            NOT NULL,
    description             TEXT            NULL,
    category                TEXT            NOT NULL,
    cost_estimate           NUMERIC(12,2)   NULL,
    currency_code           CHAR(3)         NOT NULL DEFAULT 'USD',
    duration_minutes        INTEGER         NULL,
    image_url               TEXT            NULL,
    popularity_score        INTEGER         NOT NULL DEFAULT 0,
    external_source         TEXT            NULL,
    external_ref_id         TEXT            NULL,
    search_vector           TSVECTOR        GENERATED ALWAYS AS (
                                setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                                setweight(to_tsvector('english', coalesce(description, '')), 'B')
                            ) STORED,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_activities PRIMARY KEY (id),
    CONSTRAINT fk_activities_city FOREIGN KEY (city_id) REFERENCES cities (id) ON DELETE CASCADE,
    CONSTRAINT ck_activities_category CHECK (category IN (
        'sightseeing', 'food', 'adventure', 'culture', 
        'nightlife', 'shopping', 'relaxation', 'transport', 'other'
    )),
    CONSTRAINT ck_activities_cost CHECK (cost_estimate IS NULL OR cost_estimate >= 0),
    CONSTRAINT ck_activities_duration CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    CONSTRAINT ck_activities_popularity CHECK (popularity_score >= 0)
);

CREATE INDEX idx_activities_search_vector ON activities USING gin (search_vector);
CREATE INDEX idx_activities_city_category ON activities (city_id, category);
CREATE INDEX idx_activities_popularity ON activities (city_id, popularity_score DESC);
CREATE INDEX idx_activities_cost ON activities (cost_estimate) WHERE cost_estimate IS NOT NULL;
CREATE INDEX idx_activities_duration ON activities (duration_minutes) WHERE duration_minutes IS NOT NULL;

CREATE TRIGGER trg_activities_updated_at
BEFORE UPDATE ON activities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4.7 TRIPS
CREATE TABLE trips (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL,
    name                    TEXT            NOT NULL,
    description             TEXT            NULL,
    cover_photo_url         TEXT            NULL,
    start_date              DATE            NOT NULL,
    end_date                DATE            NOT NULL,
    status                  trip_status_enum NOT NULL DEFAULT 'draft',
    currency_code           CHAR(3)         NOT NULL DEFAULT 'USD',
    estimated_budget_total  NUMERIC(12,2)   NOT NULL DEFAULT 0.00,
    primary_timezone        TEXT            NULL,
    is_public               BOOLEAN         NOT NULL DEFAULT FALSE,
    share_token             TEXT            NULL,
    shared_at               TIMESTAMPTZ     NULL,
    copy_count              INTEGER         NOT NULL DEFAULT 0,
    view_count              INTEGER         NOT NULL DEFAULT 0,
    source_trip_id          UUID            NULL,
    lock_version            INTEGER         NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ     NULL,

    CONSTRAINT pk_trips PRIMARY KEY (id),
    CONSTRAINT fk_trips_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_trips_source_trip FOREIGN KEY (source_trip_id) REFERENCES trips (id) ON DELETE SET NULL,
    CONSTRAINT ck_trips_dates CHECK (end_date >= start_date),
    CONSTRAINT ck_trips_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
    CONSTRAINT ck_trips_budget_pos CHECK (estimated_budget_total >= 0),
    CONSTRAINT ck_trips_copy_count CHECK (copy_count >= 0),
    CONSTRAINT ck_trips_view_count CHECK (view_count >= 0),
    CONSTRAINT ck_trips_share_integrity CHECK (
        (is_public = FALSE AND share_token IS NULL) OR
        (is_public = TRUE AND share_token IS NOT NULL)
    )
);

CREATE INDEX idx_trips_user_active ON trips (user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_trips_user_created ON trips (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_trips_share_token ON trips (share_token) WHERE share_token IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_trips_public_feed ON trips (created_at DESC) WHERE is_public = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_trips_calendar ON trips (user_id, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_trips_source_trip ON trips (source_trip_id) WHERE source_trip_id IS NOT NULL;

CREATE TRIGGER trg_trips_updated_at
BEFORE UPDATE ON trips
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_trips_lock_version
BEFORE UPDATE ON trips
FOR EACH ROW EXECUTE FUNCTION bump_lock_version();


-- 4.8 TRIP STOPS ("SECTIONS")
CREATE TABLE trip_stops (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    trip_id                 UUID            NOT NULL,
    city_id                 UUID            NULL,
    custom_place_name       TEXT            NULL,
    sequence_order          INTEGER         NOT NULL,
    start_date              DATE            NOT NULL,
    end_date                DATE            NOT NULL,
    description             TEXT            NULL,
    budget_amount           NUMERIC(12,2)   NULL,
    lock_version            INTEGER         NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_trip_stops PRIMARY KEY (id),
    CONSTRAINT fk_trip_stops_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
    CONSTRAINT fk_trip_stops_city FOREIGN KEY (city_id) REFERENCES cities (id) ON DELETE RESTRICT,
    CONSTRAINT ck_trip_stops_dates CHECK (end_date >= start_date),
    CONSTRAINT ck_trip_stops_place CHECK (
        (city_id IS NOT NULL AND custom_place_name IS NULL) OR
        (city_id IS NULL AND custom_place_name IS NOT NULL)
    ),
    CONSTRAINT ck_trip_stops_seq_pos CHECK (sequence_order > 0),
    CONSTRAINT ck_trip_stops_budget_pos CHECK (budget_amount IS NULL OR budget_amount >= 0),
    CONSTRAINT uq_trip_stops_trip_sequence UNIQUE (trip_id, sequence_order) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_trip_stops_trip_sequence ON trip_stops (trip_id, sequence_order);
CREATE INDEX idx_trip_stops_city_id ON trip_stops (city_id) WHERE city_id IS NOT NULL;
CREATE INDEX idx_trip_stops_dates ON trip_stops (trip_id, start_date, end_date);

CREATE TRIGGER trg_trip_stops_updated_at
BEFORE UPDATE ON trip_stops
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_trip_stops_lock_version
BEFORE UPDATE ON trip_stops
FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

CREATE TRIGGER trg_trip_stops_popularity_event
AFTER INSERT ON trip_stops
FOR EACH ROW EXECUTE FUNCTION record_city_popularity_event();


-- 4.9 ITINERARY ITEMS
CREATE TABLE itinerary_items (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    trip_stop_id            UUID            NOT NULL,
    activity_id             UUID            NULL,
    custom_name             TEXT            NULL,
    cost_category           cost_category_enum NOT NULL,
    item_date               DATE            NOT NULL,
    start_time              TIMESTAMPTZ     NULL,
    end_time                TIMESTAMPTZ     NULL,
    cost                    NUMERIC(12,2)   NOT NULL DEFAULT 0.00,
    currency_code           CHAR(3)         NOT NULL DEFAULT 'USD',
    sequence_order          INTEGER         NOT NULL,
    notes                   TEXT            NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_itinerary_items PRIMARY KEY (id),
    CONSTRAINT fk_itinerary_items_stop FOREIGN KEY (trip_stop_id) REFERENCES trip_stops (id) ON DELETE CASCADE,
    CONSTRAINT fk_itinerary_items_activity FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE RESTRICT,
    CONSTRAINT ck_itinerary_items_place CHECK (
        (activity_id IS NOT NULL AND custom_name IS NULL) OR
        (activity_id IS NULL AND custom_name IS NOT NULL)
    ),
    CONSTRAINT ck_itinerary_items_cost_pos CHECK (cost >= 0.00),
    CONSTRAINT ck_itinerary_items_seq_pos CHECK (sequence_order > 0),
    CONSTRAINT ck_itinerary_items_time_order CHECK (
        end_time IS NULL OR start_time IS NULL OR end_time >= start_time
    ),
    CONSTRAINT uq_itinerary_items_stop_date_seq UNIQUE (trip_stop_id, item_date, sequence_order) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_itinerary_items_stop_date_seq ON itinerary_items (trip_stop_id, item_date, sequence_order);
CREATE INDEX idx_itinerary_items_activity_id ON itinerary_items (activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX idx_itinerary_items_category_cost ON itinerary_items (trip_stop_id, cost_category, cost);

CREATE TRIGGER trg_itinerary_items_updated_at
BEFORE UPDATE ON itinerary_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_itinerary_items_budget_sync
AFTER INSERT OR UPDATE OR DELETE ON itinerary_items
FOR EACH ROW EXECUTE FUNCTION refresh_trip_budget_cache();

CREATE TRIGGER trg_itinerary_items_popularity_event
AFTER INSERT ON itinerary_items
FOR EACH ROW EXECUTE FUNCTION record_activity_popularity_event();


-- 4.10 SAVED DESTINATIONS (WISHLIST)
CREATE TABLE saved_destinations (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL,
    city_id                 UUID            NOT NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_saved_destinations PRIMARY KEY (id),
    CONSTRAINT fk_saved_destinations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_destinations_city FOREIGN KEY (city_id) REFERENCES cities (id) ON DELETE CASCADE,
    CONSTRAINT uq_saved_destinations_user_city UNIQUE (user_id, city_id)
);

CREATE INDEX idx_saved_destinations_user_created ON saved_destinations (user_id, created_at DESC);
CREATE INDEX idx_saved_destinations_city_id ON saved_destinations (city_id);

CREATE TRIGGER trg_saved_destinations_popularity_event
AFTER INSERT ON saved_destinations
FOR EACH ROW EXECUTE FUNCTION record_city_popularity_event();


-- 4.11 COMMUNITY POSTS
CREATE TABLE community_posts (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL,
    trip_id                 UUID            NULL,
    content                 TEXT            NOT NULL,
    attachment_urls         JSONB           NOT NULL DEFAULT '[]'::jsonb,
    like_count              INTEGER         NOT NULL DEFAULT 0,
    comment_count           INTEGER         NOT NULL DEFAULT 0,
    search_vector           TSVECTOR        GENERATED ALWAYS AS (
                                to_tsvector('english', coalesce(content, ''))
                            ) STORED,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ     NULL,

    CONSTRAINT pk_community_posts PRIMARY KEY (id),
    CONSTRAINT fk_community_posts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_community_posts_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE SET NULL,
    CONSTRAINT ck_community_posts_content_len CHECK (char_length(trim(content)) BETWEEN 1 AND 5000),
    CONSTRAINT ck_community_posts_like_pos CHECK (like_count >= 0),
    CONSTRAINT ck_community_posts_comment_pos CHECK (comment_count >= 0),
    CONSTRAINT ck_community_posts_attachments CHECK (jsonb_typeof(attachment_urls) = 'array')
);

CREATE INDEX idx_community_posts_feed_cursor ON community_posts (created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_community_posts_search ON community_posts USING gin (search_vector);
CREATE INDEX idx_community_posts_user ON community_posts (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_community_posts_trip ON community_posts (trip_id) WHERE trip_id IS NOT NULL;

CREATE TRIGGER trg_community_posts_updated_at
BEFORE UPDATE ON community_posts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4.12 COMMUNITY COMMENTS
CREATE TABLE community_comments (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    post_id                 UUID            NOT NULL,
    user_id                 UUID            NOT NULL,
    content                 TEXT            NOT NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ     NULL,

    CONSTRAINT pk_community_comments PRIMARY KEY (id),
    CONSTRAINT fk_community_comments_post FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
    CONSTRAINT fk_community_comments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_community_comments_content CHECK (char_length(trim(content)) BETWEEN 1 AND 2000)
);

CREATE INDEX idx_community_comments_post_thread ON community_comments (post_id, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX idx_community_comments_user ON community_comments (user_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_community_comments_updated_at
BEFORE UPDATE ON community_comments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_community_comments_counter_sync
AFTER INSERT OR DELETE ON community_comments
FOR EACH ROW EXECUTE FUNCTION sync_community_post_counters();


-- 4.13 COMMUNITY LIKES
CREATE TABLE community_likes (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    post_id                 UUID            NOT NULL,
    user_id                 UUID            NOT NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_community_likes PRIMARY KEY (id),
    CONSTRAINT fk_community_likes_post FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
    CONSTRAINT fk_community_likes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_community_likes_post_user UNIQUE (post_id, user_id)
);

CREATE INDEX idx_community_likes_post_user ON community_likes (post_id, user_id);
CREATE INDEX idx_community_likes_user_posts ON community_likes (user_id, created_at DESC);

CREATE TRIGGER trg_community_likes_counter_sync
AFTER INSERT OR DELETE ON community_likes
FOR EACH ROW EXECUTE FUNCTION sync_community_post_counters();


-- 4.14 CITY POPULARITY EVENTS
CREATE TABLE city_popularity_events (
    id                      BIGINT          GENERATED ALWAYS AS IDENTITY,
    city_id                 UUID            NOT NULL,
    event_type              TEXT            NOT NULL,
    user_id                 UUID            NULL,
    occurred_at             TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_city_popularity_events PRIMARY KEY (id),
    CONSTRAINT fk_city_popularity_events_city FOREIGN KEY (city_id) REFERENCES cities (id) ON DELETE CASCADE,
    CONSTRAINT fk_city_popularity_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_city_pop_event_type CHECK (event_type IN ('trip_stop_created', 'destination_saved'))
);

CREATE INDEX idx_city_pop_events_query ON city_popularity_events (city_id, occurred_at DESC);
CREATE INDEX idx_city_pop_events_time ON city_popularity_events (occurred_at DESC);


-- 4.15 ACTIVITY POPULARITY EVENTS
CREATE TABLE activity_popularity_events (
    id                      BIGINT          GENERATED ALWAYS AS IDENTITY,
    activity_id             UUID            NOT NULL,
    event_type              TEXT            NOT NULL,
    user_id                 UUID            NULL,
    occurred_at             TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_activity_popularity_events PRIMARY KEY (id),
    CONSTRAINT fk_activity_popularity_events_act FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_popularity_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_act_pop_event_type CHECK (event_type IN ('itinerary_item_added'))
);

CREATE INDEX idx_act_pop_events_query ON activity_popularity_events (activity_id, occurred_at DESC);
CREATE INDEX idx_act_pop_events_time ON activity_popularity_events (occurred_at DESC);


-- 4.16 AUDIT LOG
CREATE TABLE audit_log (
    id                      BIGINT          GENERATED ALWAYS AS IDENTITY,
    actor_user_id           UUID            NULL,
    action                  TEXT            NOT NULL,
    target_type             TEXT            NULL,
    target_id               UUID            NULL,
    metadata                JSONB           NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_audit_log PRIMARY KEY (id),
    CONSTRAINT fk_audit_log_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_audit_log_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_audit_log_actor_time ON audit_log (actor_user_id, created_at DESC);
CREATE INDEX idx_audit_log_target ON audit_log (target_type, target_id, created_at DESC);
CREATE INDEX idx_audit_log_action_time ON audit_log (action, created_at DESC);


-- 4.17 IDEMPOTENCY KEYS
CREATE TABLE idempotency_keys (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL,
    idempotency_key         TEXT            NOT NULL,
    request_path            TEXT            NOT NULL,
    response_code           INTEGER         NOT NULL,
    response_body           JSONB           NOT NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    expires_at              TIMESTAMPTZ     NOT NULL,

    CONSTRAINT pk_idempotency_keys PRIMARY KEY (id),
    CONSTRAINT fk_idempotency_keys_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_idempotency_keys_user_key UNIQUE (user_id, idempotency_key),
    CONSTRAINT ck_idempotency_keys_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_idempotency_keys_lookup ON idempotency_keys (user_id, idempotency_key);
CREATE INDEX idx_idempotency_keys_cleanup ON idempotency_keys (expires_at);

-- -----------------------------------------------------------------------------
-- SECTION 5: SEED REFERENCE DATA (CITIES & ACTIVITIES)
-- -----------------------------------------------------------------------------

-- 5.1 Starter Global Cities (>= 20 major destinations)
INSERT INTO cities (id, name, country, country_code, region, cost_index, popularity_score, latitude, longitude, description)
VALUES
    ('a0000001-0000-0000-0000-000000000001', 'Paris', 'France', 'FR', 'Western Europe', 85.50, 98, 48.856614, 2.352222, 'The City of Light, famous for romance, art, and cuisine.'),
    ('a0000001-0000-0000-0000-000000000002', 'Tokyo', 'Japan', 'JP', 'East Asia', 82.00, 99, 35.676192, 139.650311, 'Ultra-modern metropolis blended with timeless historic temples.'),
    ('a0000001-0000-0000-0000-000000000003', 'New York City', 'United States', 'US', 'North America', 100.00, 97, 40.712776, -74.005974, 'The premier global hub for culture, theater, dining, and skyline architecture.'),
    ('a0000001-0000-0000-0000-000000000004', 'Rome', 'Italy', 'IT', 'Southern Europe', 74.20, 95, 41.902782, 12.496366, 'The Eternal City, home of the Colosseum and historic Vatican City.'),
    ('a0000001-0000-0000-0000-000000000005', 'London', 'United Kingdom', 'GB', 'Western Europe', 92.40, 96, 51.507351, -0.127758, 'Historic capital on the Thames rich in royalty, museums, and theater.'),
    ('a0000001-0000-0000-0000-000000000006', 'Barcelona', 'Spain', 'ES', 'Southern Europe', 68.90, 92, 41.385064, 2.173404, 'Famous for Gaudí architecture, Mediterranean beaches, and tapas culture.'),
    ('a0000001-0000-0000-0000-000000000007', 'Bangkok', 'Thailand', 'TH', 'Southeast Asia', 45.30, 91, 13.756331, 100.501765, 'Vibrant street life, ornate shrines, and culinary excellence.'),
    ('a0000001-0000-0000-0000-000000000008', 'Sydney', 'Australia', 'AU', 'Oceania', 84.10, 88, -33.868820, 151.209296, 'Harbor city famous for the Sydney Opera House and Bondi Beach.'),
    ('a0000001-0000-0000-0000-000000000009', 'Cape Town', 'South Africa', 'ZA', 'Southern Africa', 48.70, 86, -33.924869, 18.424055, 'Coastal gem crowned by Table Mountain and Cape Point vineyards.'),
    ('a0000001-0000-0000-0000-000000000010', 'Dubai', 'United Arab Emirates', 'AE', 'Middle East', 88.00, 90, 25.204849, 55.270783, 'Modern luxury destination known for Burj Khalifa and desert safaris.'),
    ('a0000001-0000-0000-0000-000000000011', 'Singapore', 'Singapore', 'SG', 'Southeast Asia', 89.50, 89, 1.352083, 103.819836, 'Futuristic garden city renowned for Marina Bay and hawker markets.'),
    ('a0000001-0000-0000-0000-000000000012', 'Amsterdam', 'Netherlands', 'NL', 'Western Europe', 81.30, 89, 52.367573, 4.904138, 'Charming canals, world-class cycling, and Van Gogh artistry.'),
    ('a0000001-0000-0000-0000-000000000013', 'Cairo', 'Egypt', 'EG', 'North Africa', 35.80, 84, 30.044420, 31.235712, 'Historic home of the Giza Pyramids and ancient Nile treasures.'),
    ('a0000001-0000-0000-0000-000000000014', 'Rio de Janeiro', 'Brazil', 'BR', 'South America', 52.00, 85, -22.906847, -43.172896, 'Famous for Christ the Redeemer, Copacabana, and vibrant samba.'),
    ('a0000001-0000-0000-0000-000000000015', 'Seoul', 'South Korea', 'KR', 'East Asia', 76.50, 93, 37.566535, 126.977969, 'High-tech trendsetter with K-culture, royal palaces, and night markets.'),
    ('a0000001-0000-0000-0000-000000000016', 'Istanbul', 'Turkey', 'TR', 'Eurasia', 46.20, 91, 41.008238, 28.978359, 'Historic crossroads of Europe and Asia across the Bosphorus strait.'),
    ('a0000001-0000-0000-0000-000000000017', 'Buenos Aires', 'Argentina', 'AR', 'South America', 44.10, 82, -34.603722, -58.381593, 'The Paris of South America, known for tango, steak, and vibrant barrios.'),
    ('a0000001-0000-0000-0000-000000000018', 'Berlin', 'Germany', 'DE', 'Western Europe', 72.40, 87, 52.520007, 13.404954, 'Renowned for contemporary history, creative arts, and nightlife.'),
    ('a0000001-0000-0000-0000-000000000019', 'San Francisco', 'United States', 'US', 'North America', 98.60, 86, 37.774929, -122.419416, 'Iconic Golden Gate Bridge, cable cars, and Pacific bay views.'),
    ('a0000001-0000-0000-0000-000000000020', 'Kyoto', 'Japan', 'JP', 'East Asia', 71.00, 94, 35.011636, 135.768029, 'Ancient imperial capital famous for serene bamboo groves and shrines.')
ON CONFLICT (name, country_code) DO NOTHING;

-- 5.2 Curated Activities for Seeded Cities
INSERT INTO activities (city_id, name, description, category, cost_estimate, currency_code, duration_minutes, popularity_score)
VALUES
    -- Paris
    ('a0000001-0000-0000-0000-000000000001', 'Eiffel Tower Summit Access', 'Elevator ticket to the top observatory of the Eiffel Tower.', 'sightseeing', 35.00, 'EUR', 120, 99),
    ('a0000001-0000-0000-0000-000000000001', 'Louvre Museum Guided Tour', 'Skip-the-line guided masterpiece tour including Mona Lisa.', 'culture', 65.00, 'EUR', 180, 98),
    ('a0000001-0000-0000-0000-000000000001', 'Seine River Dinner Cruise', 'Romantic evening cruise with 3-course French dining.', 'food', 110.00, 'EUR', 150, 92),
    -- Tokyo
    ('a0000001-0000-0000-0000-000000000002', 'teamLab Planets Digital Art Museum', 'Immersive body-interactive digital art exhibition in Toyosu.', 'culture', 30.00, 'USD', 120, 97),
    ('a0000001-0000-0000-0000-000000000002', 'Tsukiji Outer Market Food Tour', 'Taste fresh sushi, tamagoyaki, and street seafood.', 'food', 55.00, 'USD', 180, 94),
    ('a0000001-0000-0000-0000-000000000002', 'Shibuya Crossing & Sky Observatory', 'View the world-famous scramble crossing from 229m high.', 'sightseeing', 18.00, 'USD', 90, 96),
    -- New York City
    ('a0000001-0000-0000-0000-000000000003', 'Broadway Musical Tickets', 'Orchestra seating for an award-winning Broadway production.', 'culture', 145.00, 'USD', 160, 96),
    ('a0000001-0000-0000-0000-000000000003', 'Statue of Liberty & Ellis Island Ferry', 'Round-trip ferry with grounds access to Lady Liberty.', 'sightseeing', 25.00, 'USD', 240, 93),
    ('a0000001-0000-0000-0000-000000000003', 'Central Park Guided Bicycle Tour', 'Scenic 2-hour bike ride through historic Central Park landmarks.', 'adventure', 40.00, 'USD', 120, 89),
    -- Rome
    ('a0000001-0000-0000-0000-000000000004', 'Colosseum & Roman Forum Tour', 'Priority entrance and gladiator arena floor guided experience.', 'culture', 58.00, 'EUR', 180, 97),
    ('a0000001-0000-0000-0000-000000000004', 'Vatican Museums & Sistine Chapel', 'Skip-the-line entrance to Michelangelo’s masterpieces.', 'culture', 45.00, 'EUR', 210, 98),
    ('a0000001-0000-0000-0000-000000000004', 'Trastevere Evening Food & Wine Tasting', 'Stroll through medieval alleys tasting pasta, cheeses, and prosecco.', 'food', 75.00, 'EUR', 180, 91),
    -- London
    ('a0000001-0000-0000-0000-000000000005', 'Tower of London & Crown Jewels', 'Explore royal history and view the glittering Crown Jewels.', 'culture', 38.00, 'GBP', 150, 94),
    ('a0000001-0000-0000-0000-000000000005', 'London Eye Standard Experience', 'Iconic 30-minute flight in a glass observation capsule.', 'sightseeing', 34.00, 'GBP', 45, 92),
    ('a0000001-0000-0000-0000-000000000005', 'West End Afternoon Tea & Theatre Tour', 'Traditional British afternoon tea combined with a historic theatre walk.', 'food', 60.00, 'GBP', 120, 88),
    -- Barcelona
    ('a0000001-0000-0000-0000-000000000006', 'Sagrada Familia Fast-Track & Towers', 'Guided tour of Antoni Gaudí’s unmissable basilica and tower views.', 'culture', 42.00, 'EUR', 120, 98),
    ('a0000001-0000-0000-0000-000000000006', 'Park Güell Monumental Zone Access', 'Stroll through the iconic mosaic salamander and panoramic vistas.', 'sightseeing', 14.00, 'EUR', 90, 95),
    ('a0000001-0000-0000-0000-000000000006', 'Gothic Quarter Tapas & Wine Tour', 'Taste authentic Iberian ham, patatas bravas, and regional wines.', 'food', 65.00, 'EUR', 180, 93)
ON CONFLICT DO NOTHING;

COMMIT;
