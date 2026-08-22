-- Migration 0012: Community Feed, Comments, and Likes
-- Community posts with FTS, threaded comments, and likes with automated counter synchronization

-- 12.1 Community Posts
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


-- 12.2 Community Comments
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


-- 12.3 Community Likes
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
