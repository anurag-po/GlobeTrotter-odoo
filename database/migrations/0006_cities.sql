-- Migration 0006: Cities Catalog
-- Destination catalog with popularity ranking, coordinates, cost indices, and generated tsvector for full-text search

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
