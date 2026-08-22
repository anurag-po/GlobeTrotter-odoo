-- Migration 0009: Trip Stops ("Sections") Table
-- Ordered stops per trip with deferrable sequence constraint, budget amount, and popularity trigger

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
