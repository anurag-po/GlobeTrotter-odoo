-- Migration 0005: Authentication & Verification Tokens
-- Password reset tokens, email verification tokens, and rotating refresh tokens

-- 5.1 Password Reset Tokens
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


-- 5.2 Email Verification Tokens
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


-- 5.3 Refresh Tokens (Sessions)
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
