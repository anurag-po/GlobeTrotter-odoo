-- Migration 0010: Itinerary Items Table
-- Day-wise scheduled activities, transport, accommodation, meals, costs, and budget-cache synchronization trigger

CREATE TABLE itinerary_items (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    trip_stop_id            UUID            NOT NULL,
    activity_id             UUID            NULL,
    custom_name             TEXT            NULL,
    cost_category           cost_category_enum NOT NULL,
    item_date               DATE            NOT NULL,
    start_time              TIMESTAMPTZ     NULL,
    end_time                TIMESTAMPTZ     NULL,
    cost                    NUMERIC(12,2)   NOT NULL DEFAULT 0.00,
    currency_code           CHAR(3)         NOT NULL DEFAULT 'USD',
    sequence_order          INTEGER         NOT NULL,
    notes                   TEXT            NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_itinerary_items PRIMARY KEY (id),
    CONSTRAINT fk_itinerary_items_stop FOREIGN KEY (trip_stop_id) REFERENCES trip_stops (id) ON DELETE CASCADE,
    CONSTRAINT fk_itinerary_items_activity FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE RESTRICT,
    CONSTRAINT ck_itinerary_items_place CHECK (
        (activity_id IS NOT NULL AND custom_name IS NULL) OR
        (activity_id IS NULL AND custom_name IS NOT NULL)
    ),
    CONSTRAINT ck_itinerary_items_cost_pos CHECK (cost >= 0.00),
    CONSTRAINT ck_itinerary_items_seq_pos CHECK (sequence_order > 0),
    CONSTRAINT ck_itinerary_items_time_order CHECK (
        end_time IS NULL OR start_time IS NULL OR end_time >= start_time
    ),
    CONSTRAINT uq_itinerary_items_stop_date_seq UNIQUE (trip_stop_id, item_date, sequence_order) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_itinerary_items_stop_date_seq ON itinerary_items (trip_stop_id, item_date, sequence_order);
CREATE INDEX idx_itinerary_items_activity_id ON itinerary_items (activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX idx_itinerary_items_category_cost ON itinerary_items (trip_stop_id, cost_category, cost);

CREATE TRIGGER trg_itinerary_items_updated_at
BEFORE UPDATE ON itinerary_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_itinerary_items_budget_sync
AFTER INSERT OR UPDATE OR DELETE ON itinerary_items
FOR EACH ROW EXECUTE FUNCTION refresh_trip_budget_cache();

CREATE TRIGGER trg_itinerary_items_popularity_event
AFTER INSERT ON itinerary_items
FOR EACH ROW EXECUTE FUNCTION record_activity_popularity_event();
