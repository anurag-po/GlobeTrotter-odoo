-- Migration 0015: Idempotency Keys Table
-- Persists API response payloads keyed by user and client idempotency token for retry safety (24h TTL)

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
