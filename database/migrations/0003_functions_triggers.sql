-- Migration 0003: Functions & Triggers
-- Declares reusable trigger functions for timestamps, lock versioning, budget calculations, counter synchronization, and event recording

-- 3.1 Automatic updated_at timestamp maintenance
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.2 Optimistic concurrency version bumper
CREATE OR REPLACE FUNCTION bump_lock_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.lock_version = OLD.lock_version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.3 Trip budget cache synchronizer
CREATE OR REPLACE FUNCTION refresh_trip_budget_cache()
RETURNS TRIGGER AS $$
DECLARE
    target_trip_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        SELECT s.trip_id INTO target_trip_id 
        FROM trip_stops s 
        WHERE s.id = OLD.trip_stop_id;
    ELSE
        SELECT s.trip_id INTO target_trip_id 
        FROM trip_stops s 
        WHERE s.id = NEW.trip_stop_id;
    END IF;

    IF target_trip_id IS NOT NULL THEN
        UPDATE trips
        SET estimated_budget_total = COALESCE((
            SELECT SUM(i.cost)
            FROM trip_stops s
            JOIN itinerary_items i ON i.trip_stop_id = s.id
            WHERE s.trip_id = target_trip_id
        ), 0.00)
        WHERE id = target_trip_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3.4 Community post like and comment counter synchronizer
CREATE OR REPLACE FUNCTION sync_community_post_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (TG_TABLE_NAME = 'community_likes') THEN
            UPDATE community_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
        ELSIF (TG_TABLE_NAME = 'community_comments') THEN
            UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (TG_TABLE_NAME = 'community_likes') THEN
            UPDATE community_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
        ELSIF (TG_TABLE_NAME = 'community_comments') THEN
            UPDATE community_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3.5 City popularity event recorder
CREATE OR REPLACE FUNCTION record_city_popularity_event()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_TABLE_NAME = 'trip_stops' AND NEW.city_id IS NOT NULL) THEN
        INSERT INTO city_popularity_events (city_id, event_type, user_id, occurred_at)
        SELECT NEW.city_id, 'trip_stop_created', t.user_id, now()
        FROM trips t WHERE t.id = NEW.trip_id;
    ELSIF (TG_TABLE_NAME = 'saved_destinations') THEN
        INSERT INTO city_popularity_events (city_id, event_type, user_id, occurred_at)
        VALUES (NEW.city_id, 'destination_saved', NEW.user_id, now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.6 Activity popularity event recorder
CREATE OR REPLACE FUNCTION record_activity_popularity_event()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.activity_id IS NOT NULL) THEN
        INSERT INTO activity_popularity_events (activity_id, event_type, user_id, occurred_at)
        SELECT NEW.activity_id, 'itinerary_item_added', t.user_id, now()
        FROM trip_stops s
        JOIN trips t ON t.id = s.trip_id
        WHERE s.id = NEW.trip_stop_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
