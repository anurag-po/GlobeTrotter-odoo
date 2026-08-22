-- Migration 0008: Trips Table
-- Root trip aggregate, status, dates, sharing, copy lineage, and optimistic lock versioning

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
