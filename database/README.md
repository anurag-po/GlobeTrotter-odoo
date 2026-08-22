# GlobeTrotter — PostgreSQL Database Package

This repository contains the complete, production-ready PostgreSQL 16+ database schema, migration sequence, and seed reference data for the **GlobeTrotter** travel platform.

---

## 📁 Repository Structure

```text
.
├── migrations/                        # Deterministic, ordered migration sequence
│   ├── 0001_extensions.sql           # pgcrypto, citext
│   ├── 0002_enums.sql                # User roles, statuses, trip statuses, cost categories
│   ├── 0003_functions_triggers.sql   # Reusable PL/pgSQL functions for triggers
│   ├── 0004_users.sql                # Users table with partial unique indexes
│   ├── 0005_auth_tokens.sql          # Password reset, email verification, refresh tokens
│   ├── 0006_cities.sql               # Curated cities catalog with tsvector FTS
│   ├── 0007_activities.sql           # Curated activities catalog with tsvector FTS
│   ├── 0008_trips.sql                # Trips aggregate root with optimistic locking
│   ├── 0009_trip_stops.sql           # Trip stops with deferrable sequence constraints
│   ├── 0010_itinerary_items.sql      # Itinerary line items with budget cache trigger
│   ├── 0011_saved_destinations.sql   # Wishlist junction table
│   ├── 0012_community.sql            # Posts, comments, likes with counter triggers
│   ├── 0013_popularity_events.sql    # Append-only popularity event fact tables
│   ├── 0014_audit_log.sql            # Tamper-evident immutable audit log
│   ├── 0015_idempotency_keys.sql     # API request idempotency cache
│   └── 0016_seed_reference_data.sql  # 20 global cities + 18 curated activities
├── schema/
│   └── init_database.sql             # Consolidated single-file initialization script
├── docker-compose.yml                 # Local PostgreSQL 16 service with auto-init
├── GlobeTrotter_Database_Design_PRD.md
├── GlobeTrotter_Backend_Logic_Design_PRD.md
└── README.md
```

---

## 🚀 Quick Start (Local Docker Setup)

To spin up a local PostgreSQL 16 instance with the complete schema and seed data loaded automatically:

```bash
docker-compose up -d
```

Connection details:
- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `globetrotter`
- **Username:** `globetrotter_app`
- **Password:** `globetrotter_dev_password`
- **Connection URI:** `postgres://globetrotter_app:globetrotter_dev_password@localhost:5432/globetrotter`

---

## 🛠 Applying Migrations Directly

If running migrations against an existing PostgreSQL 16 database using `psql`:

```bash
# Apply migrations sequentially
for file in migrations/*.sql; do
    echo "Applying $file..."
    psql "$DATABASE_URL" -f "$file"
done
```

Or apply the consolidated single-file script:

```bash
psql "$DATABASE_URL" -f schema/init_database.sql
```

---

## 🔑 Database Architecture Highlights

1. **Deterministic Primary Keys:**
   - Standard entities use `UUIDv4` (`gen_random_uuid()`).
   - High-throughput append-only event logs (`city_popularity_events`, `activity_popularity_events`, `audit_log`) use 64-bit `bigint GENERATED ALWAYS AS IDENTITY`.

2. **Trigger-Enforced Invariants:**
   - `set_updated_at()` automatically updates `updated_at` timestamps before every row modification.
   - `bump_lock_version()` increments `lock_version` for optimistic concurrency.
   - `refresh_trip_budget_cache()` updates `trips.estimated_budget_total = SUM(itinerary_items.cost)` in-transaction.
   - `sync_community_post_counters()` maintains `like_count` and `comment_count` on `community_posts`.
   - `record_city_popularity_event()` and `record_activity_popularity_event()` record analytics events on stop/item creation.

3. **Concurrency & Drag-to-Reorder Safety:**
   - `trip_stops.sequence_order` and `itinerary_items.sequence_order` utilize `UNIQUE (...) DEFERRABLE INITIALLY DEFERRED` to support transactional multi-row swaps.
   - `trips.lock_version` and `trip_stops.lock_version` protect against concurrent last-write-wins clobbering.

4. **Full-Text Search:**
   - `cities.search_vector` and `activities.search_vector` are generated `tsvector` columns indexed with GIN.
