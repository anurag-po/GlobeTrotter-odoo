-- Migration 0014: Audit Log Table
-- Tamper-evident, append-only log for security, auth, and administrative actions

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
