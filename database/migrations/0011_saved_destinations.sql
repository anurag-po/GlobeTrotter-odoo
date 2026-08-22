-- Migration 0011: Saved Destinations Table
-- User wishlist/bookmarks junction table with popularity event capture trigger

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
