-- Migration 0013: Popularity Event Tables
-- High-throughput append-only logs for city and activity analytics with 64-bit identity keys

-- 13.1 City Popularity Events
CREATE TABLE city_popularity_events (
    id                      BIGINT          GENERATED ALWAYS AS IDENTITY,
    city_id                 UUID            NOT NULL,
    event_type              TEXT            NOT NULL,
    user_id                 UUID            NULL,
    occurred_at             TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_city_popularity_events PRIMARY KEY (id),
    CONSTRAINT fk_city_popularity_events_city FOREIGN KEY (city_id) REFERENCES cities (id) ON DELETE CASCADE,
    CONSTRAINT fk_city_popularity_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_city_pop_event_type CHECK (event_type IN ('trip_stop_created', 'destination_saved'))
);

CREATE INDEX idx_city_pop_events_query ON city_popularity_events (city_id, occurred_at DESC);
CREATE INDEX idx_city_pop_events_time ON city_popularity_events (occurred_at DESC);


-- 13.2 Activity Popularity Events
CREATE TABLE activity_popularity_events (
    id                      BIGINT          GENERATED ALWAYS AS IDENTITY,
    activity_id             UUID            NOT NULL,
    event_type              TEXT            NOT NULL,
    user_id                 UUID            NULL,
    occurred_at             TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_activity_popularity_events PRIMARY KEY (id),
    CONSTRAINT fk_activity_popularity_events_act FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_popularity_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_act_pop_event_type CHECK (event_type IN ('itinerary_item_added'))
);

CREATE INDEX idx_act_pop_events_query ON activity_popularity_events (activity_id, occurred_at DESC);
CREATE INDEX idx_act_pop_events_time ON activity_popularity_events (occurred_at DESC);
