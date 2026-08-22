-- Migration 0004: Users Table
-- Core authentication root, user profiles, and role definitions

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
