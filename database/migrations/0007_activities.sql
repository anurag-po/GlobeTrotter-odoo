-- Migration 0007: Activities Catalog
-- Points of interest and activities within cities with duration, cost estimates, and full-text search

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
