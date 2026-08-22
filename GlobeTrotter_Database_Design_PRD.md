# GlobeTrotter — Database Design PRD (Document 1 of 2)
**Target:** PostgreSQL 16+ · **Consumer:** AI coding agent (e.g. Claude Opus 4.6, Gemini 3.7 Flash) · **Companion doc:** `GlobeTrotter_Backend_Logic_Design_PRD.md`

---

## 1. Executive Summary

GlobeTrotter is a personalized, collaborative multi-city trip-planning platform. Users authenticate, create trips composed of ordered city **stops**, attach dated **itinerary items** (activities, transport, stay, meals) with costs to each stop, track a budget vs. actual-cost breakdown, browse a curated catalog of cities/activities, view trips on a calendar, publish trips publicly for read-only sharing/copying, post to a community feed, and (for admins) view platform-wide analytics.

This document specifies the complete PostgreSQL schema, constraints, indexing, migration order, and operational rules needed to implement the persistence layer with **zero architectural ambiguity** for an AI coding agent. It is the source of truth for all data structures referenced by the Backend Logic Design PRD.

---

## 2. Source Requirements & Traceability

### 2.1 PDF requirements (Priority 1)

| ID | Screen / Feature | Summary |
|---|---|---|
| REQ-001 | Login/Signup | Email & password auth, signup link, forgot password, basic validation |
| REQ-002 | Dashboard/Home | Welcome, recent trips, "Plan New Trip", recommended destinations, budget highlights |
| REQ-003 | Create Trip | Name, start/end dates, description, optional cover photo, save |
| REQ-004 | My Trips (list) | Trip cards: name, date range, destination count, edit/view/delete |
| REQ-005 | Itinerary Builder | Add Stop, select city + travel dates, assign activities per stop, reorder cities |
| REQ-006 | Itinerary View | Day-wise layout, city headers, activity blocks with time & cost, calendar/list toggle |
| REQ-007 | City Search | Search, list with country/cost index/popularity, "Add to Trip", filter by country/region |
| REQ-008 | Activity Search | Filter by type/cost/duration, add/remove, quick view of description/images |
| REQ-009 | Trip Budget & Cost Breakdown | Breakdown by transport/stay/activities/meals, charts, avg cost/day, overbudget alerts |
| REQ-010 | Trip Calendar/Timeline | Calendar component, expandable day views, drag-to-reorder, quick edit |
| REQ-011 | Shared/Public Itinerary View | Public URL, summary, "Copy Trip", social share, read-only |
| REQ-012 | User Profile/Settings | Editable name/photo/email, language preference, delete account, saved destinations |
| REQ-013 | Admin/Analytics Dashboard | Trips created, top cities/activities, engagement stats, user management |

### 2.2 UI-inferred requirements (Priority 2)

| ID | Source screen | Inference |
|---|---|---|
| UI-001 | Screen 1 (Login) | Login identifier is a **username**, not just email; profile photo shown at login |
| UI-002 | Screen 2 (Registration) | Registration fields: first name, last name, email, phone number, city, country, free-text "additional information", photo |
| UI-003 | Screen 3 (Landing) | Home page needs: search + group-by + filter + sort controls, "Top Regional Selections" (curated/popular cities), "Previous Trips" |
| UI-004 | Screen 4 (Create Trip) | Trip creation shows immediate "suggestions for places to visit/activities" — implies the create-trip flow queries the city/activity catalog |
| UI-005 | Screen 5 (Build Itinerary) | Itinerary is built as an ordered list of **Sections** (= trip stops), each with a free-text description, a date range, and a **per-section budget**, with "Add another Section" |
| UI-006 | Screen 6 (Trip Listing) | Trips are grouped into **Ongoing / Up-coming / Completed** — confirms a derived or stored trip status/lifecycle |
| UI-007 | Screen 7 (Profile) | Profile page distinguishes **Preplanned Trips** (future/draft) vs **Previous Trips** (past), each with a "View" action |
| UI-008 | Screen 8 (Activity/City Search) | Unified search+filter+sort results list pattern reused across city search and activity search |
| UI-009 | Screen 9 (Itinerary+Budget) | Itinerary items are grouped **by day**, shown as an ordered/sequential list (arrows) with a paired **expense** field per item |
| UI-010 | Screen 10 (Community) | A community feed exists: user avatar + free-text post content, with search/group/filter/sort — confirms `community_posts` referencing a user and (optionally) a trip |
| UI-011 | Screen 11 (Calendar) | Trips render as labeled ranges on a month calendar (e.g. "NYC – GETAWAY" spanning several days) — trip start/end dates drive calendar rendering; no new entity required |
| UI-012 | Screen 12 (Admin) | Admin panel has 4 tabs: Manage Users, Popular Cities, Popular Activities, User Trends & Analytics, rendered via pie/line/bar charts — confirms aggregate analytics queries over trips/cities/activities/users |

### 2.3 Business rules (derived, Priority 1/2 combined)

| ID | Rule |
|---|---|
| BR-001 | A trip has exactly one owner (`users.id`); ownership cannot be transferred in this scope |
| BR-002 | A trip stop's date range must fall within, or reasonably align with, the parent trip's date range |
| BR-003 | Trip status (draft/planned/ongoing/completed/cancelled) is derived from dates but may be explicitly cancelled |
| BR-004 | A public trip must have a unique, unguessable share token |
| BR-005 | "Copy Trip" creates a brand-new trip (and stops/items) owned by the copying user; it never mutates the original |
| BR-006 | Budget alerts compare summed itinerary-item costs (actual) against the stop-level and trip-level budget (estimated) |
| BR-007 | Only the platform (via a seeded/admin-managed catalog) may create `cities` and `activities` records referenced by trips — users cannot silently create ad-hoc catalog entries, but **can** add custom (non-catalog) itinerary line items |

---

## 3. Assumptions & Architecture Decisions (index)

| ID | Statement |
|---|---|
| ASSUMP-001 | Login credential is `username` (per UI-001) in addition to `email` (per REQ-001); both are unique and either may be used to sign in. |
| ASSUMP-002 | Cities and Activities are a **platform-curated catalog** (seeded + admin-managed), not a live third-party API integration, since the PDF never names an external provider. Schema is designed so a future external-API sync job can populate the same tables (see ARCH-009). |
| ASSUMP-003 | "Sections" in the Itinerary Builder UI (Screen 5) map 1:1 to `trip_stops`. The per-section "budget" field maps to `trip_stops.budget_amount`. |
| ASSUMP-004 | No real-time multi-user collaborative editing (e.g. Google-Docs-style co-editing) is in scope — the PDF describes "share" only as read-only public viewing + copy. Collaboration/invite features are explicitly **out of scope** (OPEN-001). |
| ASSUMP-005 | "Recommended destinations" / "Top Regional Selections" / "suggestions" are computed from `cities.popularity_score` (and, optionally, the requesting user's country), not a bespoke ML recommendation table. |
| ASSUMP-006 | Community posts optionally reference a trip (`community_posts.trip_id NULL`-able) to support "share experience about a certain trip **or** activity." |
| ASSUMP-007 | Money is stored as `numeric(12,2)` in a single reporting currency per trip (`trips.currency_code`), with per-item `currency_code` allowed to differ where the item was catalog-sourced from a different city (see ARCH-006). |
| ASSUMP-008 | Soft delete is used for user-generated content the platform must be able to recover or audit (users, trips, community posts); hard delete is used for pure line items owned by a single parent (itinerary items) because they are always removed via their parent's edit flow. |

| ID | Decision | Rationale |
|---|---|---|
| ARCH-001 | Every table uses a `uuid` primary key (`gen_random_uuid()`) | Avoids sequential-ID enumeration on public share endpoints; safe to generate client- or server-side; merges cleanly across environments |
| ARCH-002 | All timestamps are `timestamptz`, stored in UTC | Users are global; avoids DST/local-time ambiguity; frontend converts to local display time |
| ARCH-003 | All trip/stop/itinerary **dates** (not times) are stored as `date`, with a **separate** `timestamptz` where wall-clock time matters (itinerary item start/end time) | A trip's "Start Date" is a calendar date independent of timezone; but an activity's start time is a real clock time in the destination |
| ARCH-004 | Enumerations use native PostgreSQL `ENUM` types, not free-text or lookup tables, for small closed sets (status, role, category) | Enforced at the DB level, indexable, self-documenting; sets are small and stable per the PDF's fixed feature list |
| ARCH-005 | Soft deletion via `deleted_at timestamptz NULL` on `users`, `trips`, `community_posts`, `community_comments` | These are user-facing records that must support "my deleted trip disappeared but an admin/audit trail may need it"; all other tables cascade-delete with their parent |
| ARCH-006 | Monetary columns are `numeric(12,2)` plus a `char(3)` ISO-4217 `currency_code` column wherever money is stored | Exact decimal arithmetic (no float drift); explicit currency avoids silent unit-mismatch bugs |
| ARCH-007 | Full-text search on `cities.name`/`activities.name`/`activities.description` uses a PostgreSQL `tsvector` **generated column** + GIN index, not an external search engine | Dataset is a curated catalog (thousands, not millions, of rows) — Postgres FTS is sufficient and avoids an extra infra dependency; revisit only if catalog scales past ~1M rows |
| ARCH-008 | No PostGIS extension | The catalog does not require radius/geo-shape queries per the PDF (only "filter by country/region" and simple lat/lng display on a map); plain `numeric` lat/lng columns are sufficient. Reconsider if "near me" search is added later |
| ARCH-009 | `cities` and `activities` include a nullable `external_source` + `external_ref_id` pair | Future-proofs an external catalog sync job without a schema change; unused for now (ASSUMP-002) |
| ARCH-010 | Trip cost breakdown is **computed on read** from `itinerary_items` (grouped by `cost_category`), not stored redundantly, except for a denormalized `trips.estimated_budget_total` cache | Avoids the classic "cached total drifts from source rows" bug; the single cache column is refreshed transactionally whenever items change (see §11) and exists purely to make trip-list/dashboard queries avoid an aggregate join |
| ARCH-011 | Admin analytics are served by SQL aggregate queries directly (with supporting indexes), not a separate data-warehouse/materialized-view layer | Hackathon/MVP scale; §13 lists the exact indexes needed to keep these queries fast. A materialized view refresh job is offered as an optional optimization (§9) |

### Open questions (documented, not blocking)

| ID | Question | Default taken |
|---|---|---|
| OPEN-001 | Should trips support multiple collaborators/editors? | No — single-owner only (ASSUMP-004). Schema leaves room via a future `trip_collaborators` join table but it is **not created** in this version. |
| OPEN-002 | Should "Copy Trip" copy activities that reference private/user-custom itinerary items verbatim, including their costs, or reset costs to catalog defaults? | Copy verbatim, including custom items and their recorded costs, as a new trip owned by the copier. |

---

## 4. Domain Model Overview

Core aggregates (root → children):

```
users (root)
 ├── trips (owned by user)
 │    ├── trip_stops (ordered stops / "sections")
 │    │    └── itinerary_items (day-wise activities/transport/stay/meals)
 │    └── trip_share (1:1 public sharing metadata)
 ├── saved_destinations (user ↔ cities, many-to-many)
 └── community_posts
      └── community_comments
      └── community_likes

cities (catalog, admin-owned)
 └── activities (catalog, admin-owned, belongs to a city)

auth_credentials-adjacent:
 ├── password_reset_tokens (belongs to user)
 ├── email_verification_tokens (belongs to user)
 └── refresh_tokens (belongs to user, session/device)
```

---

## 5. Database Architecture

- **PostgreSQL version:** 16.x (uses `gen_random_uuid()` from built-in `pgcrypto`/`pgcrypto`-free `uuid-ossp` alt — see §11 extensions; generated columns; native partial/expression indexes).
- **Schema strategy:** single schema `public` for MVP simplicity. **[ARCH-012]** No per-tenant schema separation — GlobeTrotter is not multi-tenant B2B software; every user is a peer in one shared database.
- **Naming conventions:**
  - Tables: `snake_case`, plural nouns (`trips`, `trip_stops`).
  - Columns: `snake_case`, singular (`user_id`, `start_date`).
  - Primary keys: always `id`.
  - Foreign keys: `<referenced_table_singular>_id` (e.g. `trip_id`, `city_id`).
  - Booleans: prefixed `is_`/`has_` (`is_public`, `has_verified_email`).
  - Enums: type name `<table>_<column>_enum` (e.g. `trip_status_enum`).
  - Indexes: `idx_<table>_<columns>`; unique constraints: `uq_<table>_<columns>`; check constraints: `ck_<table>_<rule>`; FKs: `fk_<table>_<column>`.
- **Primary key strategy:** `uuid` everywhere (ARCH-001), default `gen_random_uuid()`.
- **Foreign key strategy:** always declared with explicit `ON DELETE` behavior (never left to default `NO ACTION` implicitly — always explicit for clarity); indexed on every FK column (see §9).
- **Timestamp strategy:** `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` on every mutable table, maintained by a shared trigger (`set_updated_at()`), not application code — guarantees correctness regardless of write path.
- **Timezone strategy:** all storage in UTC (ARCH-002); each `trip` carries a `primary_timezone` (`text`, IANA name, nullable) purely for display convenience on itinerary item times.
- **Enum strategy:** native Postgres `ENUM` for small closed vocabularies (ARCH-004); `text` + `CHECK` for open-ended but constrained lists that may need frequent extension without a type-alter (e.g. `activities.category` uses `text` + CHECK so an admin can add a category value via a data migration instead of a type migration — **[ARCH-013]**).
- **JSON/JSONB usage rules:** JSONB is used **only** for genuinely unstructured, non-queried payloads: `users.notification_preferences` (small user-editable settings blob) and `community_posts.attachment_urls` (array of media URLs). **No relational data is stored as JSON** (anti-pattern, see §14).
- **Monetary types:** `numeric(12,2)` + `char(3)` currency code (ARCH-006).
- **Geographic data:** plain `numeric(9,6)` latitude/longitude columns on `cities`; no PostGIS (ARCH-008).
- **Text/search strategy:** generated `tsvector` columns + GIN indexes on `cities` and `activities` (ARCH-007).
- **Soft deletion strategy:** `deleted_at timestamptz NULL` (ARCH-005); all default queries filter `WHERE deleted_at IS NULL` at the backend query-builder level, enforced additionally by partial unique indexes (§8).
- **Audit strategy:** `created_at`/`updated_at` on all tables; a dedicated `audit_log` table (§6.16) captures security-sensitive events (login, password change, account deletion, admin actions) — **[ARCH-014]**, justified because the admin dashboard requires "user engagement stats" and security requires a durable trail independent of mutable business tables.
- **Optimistic concurrency:** `trips` and `trip_stops` include a `lock_version integer NOT NULL DEFAULT 1` column, incremented on every update, to guard against last-write-wins clobbering during itinerary drag-to-reorder edits from multiple tabs/devices — **[ARCH-015]**, justified because REQ-005/UI-005 imply frequent concurrent reordering of the same trip's stops.

---

## 6. Complete Schema

> Convention: every table lists purpose, columns (type / nullability / default / keys), constraints, and indexes. FKs are summarized here and fully enumerated in §7.

### 6.1 `users`

**Purpose:** Platform account. Owns trips, saved destinations, community posts. Root of authentication/authorization.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| username | citext | no | — | unique (UI-001) |
| email | citext | no | — | unique (REQ-001) |
| password_hash | text | no | — | bcrypt/argon2id hash; never returned by any query to the API layer |
| first_name | text | no | — | UI-002 |
| last_name | text | no | — | UI-002 |
| phone_number | text | yes | NULL | UI-002 |
| city | text | yes | NULL | UI-002 free-text home city (not FK to `cities` catalog — user's home city need not exist in the travel-destination catalog) |
| country | text | yes | NULL | UI-002; ISO-3166 alpha-2 recommended, enforced at application validation layer, not DB (free text allowed for flexibility) |
| additional_info | text | yes | NULL | UI-002 "Additional Information" |
| photo_url | text | yes | NULL | profile photo |
| language_preference | text | no | `'en'` | REQ-012, ISO-639-1 code |
| role | user_role_enum | no | `'user'` | `'user'` \| `'admin'` (REQ-013) |
| status | user_status_enum | no | `'active'` | `'active'` \| `'suspended'` \| `'deactivated'` |
| has_verified_email | boolean | no | `false` | |
| notification_preferences | jsonb | no | `'{}'::jsonb` | small user-editable settings blob |
| last_login_at | timestamptz | yes | NULL | |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | trigger-maintained |
| deleted_at | timestamptz | yes | NULL | soft delete (REQ-012 "delete account") |

Constraints: `uq_users_username` (partial, `WHERE deleted_at IS NULL`), `uq_users_email` (partial, `WHERE deleted_at IS NULL`), `ck_users_role`, `ck_users_status`.

### 6.2 `password_reset_tokens`

**Purpose:** One-time tokens for REQ-001 "Forgot Password."

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| user_id | uuid | no | — | FK → users.id |
| token_hash | text | no | — | SHA-256 of the token; raw token never stored |
| expires_at | timestamptz | no | — | |
| used_at | timestamptz | yes | NULL | set once consumed |
| created_at | timestamptz | no | `now()` | |

Constraints: `uq_password_reset_tokens_token_hash`.
Indexes: `idx_password_reset_tokens_user_id`, `idx_password_reset_tokens_expires_at` (for cleanup jobs).

### 6.3 `email_verification_tokens`

**Purpose:** Verify `users.email` post-registration. Mirrors §6.2 structure.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| user_id | uuid | no | — | FK → users.id |
| token_hash | text | no | — | unique |
| expires_at | timestamptz | no | — | |
| used_at | timestamptz | yes | NULL | |
| created_at | timestamptz | no | `now()` | |

### 6.4 `refresh_tokens`

**Purpose:** Session/device-scoped refresh tokens for JWT auth (ARCH decision in Backend PRD §6).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| user_id | uuid | no | — | FK → users.id |
| token_hash | text | no | — | unique |
| device_label | text | yes | NULL | e.g. "Chrome on macOS" |
| issued_at | timestamptz | no | `now()` | |
| expires_at | timestamptz | no | — | |
| revoked_at | timestamptz | yes | NULL | rotation/logout |
| created_at | timestamptz | no | `now()` | |

Indexes: `idx_refresh_tokens_user_id`, `idx_refresh_tokens_expires_at`.

### 6.5 `cities`

**Purpose:** Curated destination catalog. Referenced by trip stops, activities, saved destinations (REQ-007).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| name | text | no | — | |
| country | text | no | — | ISO-3166 country name |
| country_code | char(2) | no | — | ISO-3166 alpha-2 |
| region | text | yes | NULL | e.g. "Southeast Asia" — supports "filter by region" |
| cost_index | numeric(6,2) | yes | NULL | REQ-007 relative cost index |
| popularity_score | integer | no | `0` | recomputed by scheduled job (§18 backend) from trip/save counts |
| latitude | numeric(9,6) | yes | NULL | |
| longitude | numeric(9,6) | yes | NULL | |
| image_url | text | yes | NULL | |
| description | text | yes | NULL | |
| external_source | text | yes | NULL | ARCH-009 |
| external_ref_id | text | yes | NULL | ARCH-009 |
| search_vector | tsvector | no | generated (`name`, `country`, `region`) | GIN-indexed, ARCH-007 |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |

Constraints: `uq_cities_name_country` (`name`, `country_code`) — prevents duplicate catalog rows.

### 6.6 `activities`

**Purpose:** Things to do within a city (REQ-008).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| city_id | uuid | no | — | FK → cities.id |
| name | text | no | — | |
| description | text | yes | NULL | |
| category | text | no | — | CHECK IN ('sightseeing','food','adventure','culture','nightlife','shopping','relaxation','transport','other') — ARCH-013 |
| cost_estimate | numeric(12,2) | yes | NULL | typical cost |
| currency_code | char(3) | no | `'USD'` | ISO-4217 |
| duration_minutes | integer | yes | NULL | REQ-008 filter by duration |
| image_url | text | yes | NULL | |
| popularity_score | integer | no | `0` | |
| external_source | text | yes | NULL | ARCH-009 |
| external_ref_id | text | yes | NULL | ARCH-009 |
| search_vector | tsvector | no | generated (`name`, `description`) | GIN-indexed |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |

Constraints: `ck_activities_duration_positive` (`duration_minutes IS NULL OR duration_minutes > 0`), `ck_activities_cost_nonnegative`.

### 6.7 `trips`

**Purpose:** Root trip-planning aggregate (REQ-003/004).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| user_id | uuid | no | — | FK → users.id, owner (BR-001) |
| name | text | no | — | |
| description | text | yes | NULL | |
| cover_photo_url | text | yes | NULL | REQ-003 optional |
| start_date | date | no | — | |
| end_date | date | no | — | |
| status | trip_status_enum | no | `'draft'` | `'draft'`\|`'planned'`\|`'ongoing'`\|`'completed'`\|`'cancelled'` (BR-003) |
| currency_code | char(3) | no | `'USD'` | trip reporting currency (ASSUMP-007) |
| estimated_budget_total | numeric(12,2) | no | `0` | cache, ARCH-010; maintained transactionally |
| primary_timezone | text | yes | NULL | IANA tz name |
| is_public | boolean | no | `false` | REQ-011 |
| share_token | text | yes | NULL | unique when `is_public=true` (BR-004) |
| shared_at | timestamptz | yes | NULL | |
| copy_count | integer | no | `0` | "Copy Trip" popularity signal |
| view_count | integer | no | `0` | public view counter |
| source_trip_id | uuid | yes | NULL | FK → trips.id, self-ref, set when this trip was created via "Copy Trip" (BR-005) |
| lock_version | integer | no | `1` | ARCH-015 |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |
| deleted_at | timestamptz | yes | NULL | soft delete (REQ-004 "delete") |

Constraints:
- `ck_trips_dates` — `end_date >= start_date`
- `ck_trips_public_share_token` — `(is_public = false AND share_token IS NULL) OR (is_public = true AND share_token IS NOT NULL)`
- `uq_trips_share_token` (partial, `WHERE share_token IS NOT NULL`)
- `fk_trips_source_trip_id` → `trips.id` `ON DELETE SET NULL`

### 6.8 `trip_stops`

**Purpose:** Ordered city stops within a trip ("Sections" in UI-005; REQ-005).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| trip_id | uuid | no | — | FK → trips.id |
| city_id | uuid | yes | NULL | FK → cities.id; nullable to allow a free-text/custom stop not in the catalog |
| custom_place_name | text | yes | NULL | required when `city_id IS NULL` |
| sequence_order | integer | no | — | 1-based ordering within the trip (REQ-005 "reorder cities") |
| start_date | date | no | — | |
| end_date | date | no | — | |
| description | text | yes | NULL | UI-005 "necessary information about this section" |
| budget_amount | numeric(12,2) | yes | NULL | UI-005 "Budget of this section" |
| lock_version | integer | no | `1` | ARCH-015 |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |

Constraints:
- `ck_trip_stops_dates` — `end_date >= start_date`
- `ck_trip_stops_place` — `(city_id IS NOT NULL) OR (custom_place_name IS NOT NULL)`
- `uq_trip_stops_trip_sequence` (`trip_id`, `sequence_order`) — DEFERRABLE INITIALLY DEFERRED (so a single-transaction reorder that temporarily "swaps" two sequence numbers doesn't violate uniqueness mid-transaction)

### 6.9 `itinerary_items`

**Purpose:** Day-wise activity/transport/stay/meal line items within a stop (REQ-005/006, UI-009).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| trip_stop_id | uuid | no | — | FK → trip_stops.id |
| activity_id | uuid | yes | NULL | FK → activities.id; NULL when custom (BR-007) |
| custom_name | text | yes | NULL | required when `activity_id IS NULL` |
| cost_category | cost_category_enum | no | — | `'transport'`\|`'stay'`\|`'activity'`\|`'meal'`\|`'other'` (REQ-009) |
| item_date | date | no | — | which day within the stop (must be within stop's date range) |
| start_time | timestamptz | yes | NULL | wall-clock start (ARCH-003) |
| end_time | timestamptz | yes | NULL | |
| cost | numeric(12,2) | no | `0` | UI-009 "Expense" |
| currency_code | char(3) | no | `'USD'` | |
| sequence_order | integer | no | — | ordering within the day (UI-009 sequential arrows) |
| notes | text | yes | NULL | |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |

Constraints:
- `ck_itinerary_items_place` — `(activity_id IS NOT NULL) OR (custom_name IS NOT NULL)`
- `ck_itinerary_items_time_order` — `(end_time IS NULL) OR (start_time IS NULL) OR (end_time >= start_time)`
- `ck_itinerary_items_cost_nonnegative` — `cost >= 0`
- `uq_itinerary_items_stop_date_sequence` (`trip_stop_id`, `item_date`, `sequence_order`) DEFERRABLE INITIALLY DEFERRED

Deletion: hard-deleted with parent stop (`ON DELETE CASCADE`) — see ASSUMP-008.

### 6.10 `saved_destinations`

**Purpose:** User's saved/wishlist cities (REQ-012 "saved destinations list").

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| user_id | uuid | no | — | FK → users.id |
| city_id | uuid | no | — | FK → cities.id |
| created_at | timestamptz | no | `now()` | |

Constraints: `uq_saved_destinations_user_city` (`user_id`, `city_id`).

### 6.11 `community_posts`

**Purpose:** Community feed entries (UI-010): user shares an experience about a trip or activity.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| user_id | uuid | no | — | FK → users.id, author |
| trip_id | uuid | yes | NULL | FK → trips.id, `ON DELETE SET NULL` (ASSUMP-006) |
| content | text | no | — | |
| attachment_urls | jsonb | no | `'[]'::jsonb` | array of media URLs |
| like_count | integer | no | `0` | cache, maintained transactionally |
| comment_count | integer | no | `0` | cache, maintained transactionally |
| search_vector | tsvector | no | generated (`content`) | GIN-indexed |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |
| deleted_at | timestamptz | yes | NULL | soft delete (moderation) |

Constraints: `ck_community_posts_content_length` — `char_length(content) BETWEEN 1 AND 5000`.

### 6.12 `community_comments`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| post_id | uuid | no | — | FK → community_posts.id |
| user_id | uuid | no | — | FK → users.id |
| content | text | no | — | |
| created_at | timestamptz | no | `now()` | |
| updated_at | timestamptz | no | `now()` | |
| deleted_at | timestamptz | yes | NULL | soft delete |

### 6.13 `community_likes`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` | PK |
| post_id | uuid | no | — | FK → community_posts.id |
| user_id | uuid | no | — | FK → users.id |
| created_at | timestamptz | no | `now()` | |

Constraints: `uq_community_likes_post_user` (`post_id`, `user_id`) — prevents double-likes; drives idempotent like/unlike toggle.

### 6.14 `city_popularity_events` **[ARCH-016]**

**Purpose:** Append-only fact table recording "a trip stop/save touched this city," used to recompute `cities.popularity_score` and power REQ-013 "Popular cities" without expensive full-table scans of `trip_stops` at read time.

> Justification: admin analytics need city/activity popularity over arbitrary time windows (e.g. "this month"); an append-only event log is cheaper to aggregate with a time-range index than re-deriving from live operational tables on every dashboard load.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | bigint | no | `generated always as identity` | PK — sequential is fine here (internal analytics only, never exposed) |
| city_id | uuid | no | — | FK → cities.id |
| event_type | text | no | — | CHECK IN ('trip_stop_created','destination_saved') |
| user_id | uuid | yes | NULL | FK → users.id, `ON DELETE SET NULL` |
| occurred_at | timestamptz | no | `now()` | |

### 6.15 `activity_popularity_events` **[ARCH-016]**

Mirrors §6.14 for `activities` (`event_type CHECK IN ('itinerary_item_added')`).

### 6.16 `audit_log` **[ARCH-014]**

**Purpose:** Durable security/event trail (auth events, admin actions, account deletion).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | bigint | no | `generated always as identity` | PK |
| actor_user_id | uuid | yes | NULL | FK → users.id, `ON DELETE SET NULL` (must survive user deletion) |
| action | text | no | — | e.g. `'login_success'`, `'login_failed'`, `'password_reset'`, `'account_deleted'`, `'admin_user_suspended'` |
| target_type | text | yes | NULL | e.g. `'user'`, `'trip'` |
| target_id | uuid | yes | NULL | not a FK (target row may later be deleted; log must survive) |
| metadata | jsonb | no | `'{}'::jsonb` | request IP, user agent, diff summary — never secrets |
| created_at | timestamptz | no | `now()` | |

---

## 7. Relationships

| # | Source | Target | Cardinality | FK column | On Delete | Mandatory | Meaning |
|---|---|---|---|---|---|---|---|
| 1 | trips | users | N:1 | trips.user_id | CASCADE | yes | trip belongs to exactly one owner |
| 2 | trips | trips (self) | N:1 | trips.source_trip_id | SET NULL | no | "copied from" lineage (BR-005) |
| 3 | trip_stops | trips | N:1 | trip_stops.trip_id | CASCADE | yes | stop belongs to a trip |
| 4 | trip_stops | cities | N:1 | trip_stops.city_id | RESTRICT | no | stop references a catalog city (RESTRICT: cities are reference data, must not vanish under active trips — deletion handled via admin deactivation, not row delete) |
| 5 | itinerary_items | trip_stops | N:1 | itinerary_items.trip_stop_id | CASCADE | yes | item belongs to a stop |
| 6 | itinerary_items | activities | N:1 | itinerary_items.activity_id | RESTRICT | no | item optionally references catalog activity |
| 7 | activities | cities | N:1 | activities.city_id | CASCADE | yes | activity belongs to a city; if a city is ever hard-removed (admin-only, rare), its activities go with it |
| 8 | saved_destinations | users | N:1 | saved_destinations.user_id | CASCADE | yes | |
| 9 | saved_destinations | cities | N:1 | saved_destinations.city_id | CASCADE | yes | |
| 10 | community_posts | users | N:1 | community_posts.user_id | CASCADE | yes | |
| 11 | community_posts | trips | N:1 | community_posts.trip_id | SET NULL | no | |
| 12 | community_comments | community_posts | N:1 | community_comments.post_id | CASCADE | yes | |
| 13 | community_comments | users | N:1 | community_comments.user_id | CASCADE | yes | |
| 14 | community_likes | community_posts | N:1 | community_likes.post_id | CASCADE | yes | |
| 15 | community_likes | users | N:1 | community_likes.user_id | CASCADE | yes | |
| 16 | password_reset_tokens | users | N:1 | password_reset_tokens.user_id | CASCADE | yes | |
| 17 | email_verification_tokens | users | N:1 | email_verification_tokens.user_id | CASCADE | yes | |
| 18 | refresh_tokens | users | N:1 | refresh_tokens.user_id | CASCADE | yes | |
| 19 | city_popularity_events | cities | N:1 | city_popularity_events.city_id | CASCADE | yes | |
| 20 | activity_popularity_events | activities | N:1 | activity_popularity_events.activity_id | CASCADE | yes | |
| 21 | audit_log | users | N:1 | audit_log.actor_user_id | SET NULL | no | |

There are **no many-to-many relationships requiring a bridging table beyond `saved_destinations`, `community_likes`** (both modeled as explicit join tables — never as arrays/JSON). **No polymorphic relationships exist**; every FK targets exactly one table, per the anti-polymorphism guidance.

---

## 8. Constraints Summary

| Table | Constraint | Type | Rule |
|---|---|---|---|
| users | `uq_users_username` | partial unique | unique among `deleted_at IS NULL` rows |
| users | `uq_users_email` | partial unique | unique among `deleted_at IS NULL` rows |
| users | `ck_users_role` | check | `role IN ('user','admin')` (enum-enforced) |
| trips | `ck_trips_dates` | check | `end_date >= start_date` |
| trips | `ck_trips_public_share_token` | check | share_token presence tied to `is_public` |
| trips | `uq_trips_share_token` | partial unique | unique among non-null tokens |
| trip_stops | `ck_trip_stops_dates` | check | `end_date >= start_date` |
| trip_stops | `ck_trip_stops_place` | check | city_id or custom_place_name present |
| trip_stops | `uq_trip_stops_trip_sequence` | unique, deferrable | no duplicate order within a trip |
| itinerary_items | `ck_itinerary_items_place` | check | activity_id or custom_name present |
| itinerary_items | `ck_itinerary_items_cost_nonnegative` | check | `cost >= 0` |
| itinerary_items | `uq_itinerary_items_stop_date_sequence` | unique, deferrable | no duplicate order within a stop-day |
| activities | `ck_activities_cost_nonnegative` | check | `cost_estimate IS NULL OR cost_estimate >= 0` |
| activities | `ck_activities_duration_positive` | check | duration > 0 when present |
| cities | `uq_cities_name_country` | unique | no duplicate catalog rows |
| saved_destinations | `uq_saved_destinations_user_city` | unique | prevents duplicate saves |
| community_likes | `uq_community_likes_post_user` | unique | one like per user per post |
| community_posts | `ck_community_posts_content_length` | check | 1–5000 chars |

**Ownership/isolation is not a database CHECK constraint** — it is enforced at the application authorization layer (see Backend PRD §7), because Postgres row-level security is not required at this scale; however, **[ARCH-017]** every query the backend issues for user-owned resources MUST filter by `user_id = :current_user_id` (or join through it), and this rule is restated in the Backend PRD's coding-agent rules (§26) so the two layers stay consistent.

---

## 9. Indexing Strategy

| Table | Index | Type | Supports |
|---|---|---|---|
| users | `idx_users_username` (via unique constraint) | btree | login lookup by username |
| users | `idx_users_email` (via unique constraint) | btree | login lookup by email |
| users | `idx_users_role` | btree, partial (`WHERE deleted_at IS NULL`) | admin "manage users" role filter |
| trips | `idx_trips_user_id` | btree | "My Trips" list, dashboard |
| trips | `idx_trips_user_id_status` | btree composite | REQ-004/UI-006 grouped Ongoing/Upcoming/Completed |
| trips | `idx_trips_share_token` (via unique constraint) | btree | public share lookup (REQ-011) — O(1) point lookup, no enumeration risk since token is random |
| trips | `idx_trips_is_public_created_at` | btree, partial (`WHERE is_public = true AND deleted_at IS NULL`) | community/discovery browsing of public trips |
| trips | `idx_trips_start_date` | btree | calendar view range queries (UI-011) |
| trip_stops | `idx_trip_stops_trip_id_sequence` | btree composite | ordered fetch of stops for a trip (REQ-005/006) |
| trip_stops | `idx_trip_stops_city_id` | btree | "which trips touch city X" |
| itinerary_items | `idx_itinerary_items_stop_id_date_sequence` | btree composite | day-wise ordered fetch (REQ-006, UI-009) |
| itinerary_items | `idx_itinerary_items_activity_id` | btree | popularity aggregation, catalog usage stats |
| cities | `idx_cities_search_vector` | GIN | full-text city search (REQ-007) |
| cities | `idx_cities_country_code` | btree | filter by country/region (REQ-007) |
| cities | `idx_cities_popularity_score` | btree, DESC | "Top Regional Selections" (UI-003) |
| activities | `idx_activities_search_vector` | GIN | full-text activity search (REQ-008) |
| activities | `idx_activities_city_id_category` | btree composite | filter by city + type (REQ-008) |
| activities | `idx_activities_cost_estimate` | btree | filter by cost range (REQ-008) |
| activities | `idx_activities_duration_minutes` | btree | filter by duration (REQ-008) |
| saved_destinations | `idx_saved_destinations_user_id` | btree | profile "saved destinations" |
| community_posts | `idx_community_posts_created_at` | btree, DESC, partial (`WHERE deleted_at IS NULL`) | feed reverse-chronological pagination |
| community_posts | `idx_community_posts_search_vector` | GIN | feed search |
| community_posts | `idx_community_posts_trip_id` | btree | posts about a given trip |
| community_comments | `idx_community_comments_post_id_created_at` | btree composite | ordered comments per post |
| refresh_tokens | `idx_refresh_tokens_user_id` | btree | session listing/revocation |
| password_reset_tokens / email_verification_tokens | `idx_*_expires_at` | btree | expired-token cleanup job |
| city_popularity_events / activity_popularity_events | `idx_*_occurred_at` | btree | time-windowed admin analytics (REQ-013) |
| audit_log | `idx_audit_log_actor_user_id_created_at` | btree composite | admin drill-down into a user's activity |

**Rejected indexes (explicitly not created):** per-column indexes on low-cardinality boolean/enum columns used only as secondary filters (e.g. indexing `trips.currency_code` alone) — these ride along on composite indexes above where actually needed; a bare index would rarely be selective enough to beat a sequential scan at MVP data volumes.

---

## 10. PostgreSQL-Specific Design

| Feature | Used for | Why appropriate |
|---|---|---|
| `pgcrypto` extension (`gen_random_uuid()`) | all PKs | Standard, built-in, no extra service |
| `citext` extension | `users.username`, `users.email` | Case-insensitive uniqueness/lookup without app-layer `LOWER()` juggling |
| Native `ENUM` types | `trip_status_enum`, `user_role_enum`, `user_status_enum`, `cost_category_enum` | Small, stable, closed vocabularies directly from the PDF's fixed feature set (ARCH-004) |
| Generated `tsvector` columns + GIN | `cities`, `activities`, `community_posts` search | In-database full-text search without external search infra (ARCH-007) |
| Deferrable unique constraints | `trip_stops.sequence_order`, `itinerary_items.sequence_order` | Allows atomic multi-row reorder (drag-and-drop, REQ-010) within one transaction without a temporary "gap" numbering scheme |
| Partial indexes | soft-delete-aware uniqueness (`uq_users_username`, etc.), public-trip discovery index | Keeps indexes small and semantically correct (deleted rows don't participate in uniqueness) |
| Triggers | `set_updated_at()` on every mutable table; `refresh_trip_budget_cache()` on `itinerary_items`/`trip_stops` change (see §11); `sync_community_post_counters()` on like/comment insert-delete | Guarantees invariants regardless of which backend code path writes the row — critical for an AI-agent-implemented system where multiple call sites may write the same table |
| `numeric` (not `float`/`double precision`) | all money | Exact decimal arithmetic |

**Not used, deliberately:** PostGIS (ARCH-008), table partitioning (data volume does not warrant it at MVP scale — revisit `audit_log`/`*_popularity_events` partitioning by month only if the platform reaches production scale beyond a hackathon MVP), row-level security policies (ownership enforced in the application layer per ARCH-017; RLS adds operational complexity not justified here), materialized views (§9 indexes are sufficient for the specified analytics; a materialized view is listed as an *optional* future optimization, not a requirement).

---

## 11. Triggers & Functions (behavioral integrity)

| Name | Fires on | Effect |
|---|---|---|
| `set_updated_at()` | `BEFORE UPDATE` on every mutable table | Sets `NEW.updated_at = now()` |
| `bump_lock_version()` | `BEFORE UPDATE` on `trips`, `trip_stops` | `NEW.lock_version = OLD.lock_version + 1`; backend passes the expected version in its `WHERE lock_version = :expected` clause (ARCH-015 concurrency) |
| `refresh_trip_budget_cache()` | `AFTER INSERT/UPDATE/DELETE` on `itinerary_items` | Recomputes and writes `trips.estimated_budget_total = SUM(cost)` for the affected trip (joined through `trip_stops`), inside the same transaction (ARCH-010) |
| `sync_community_post_counters()` | `AFTER INSERT/DELETE` on `community_likes` and `community_comments` | Increments/decrements `community_posts.like_count`/`comment_count` |
| `record_city_popularity_event()` | `AFTER INSERT` on `trip_stops` (when `city_id IS NOT NULL`) and `saved_destinations` | Inserts into `city_popularity_events` |
| `record_activity_popularity_event()` | `AFTER INSERT` on `itinerary_items` (when `activity_id IS NOT NULL`) | Inserts into `activity_popularity_events` |

These triggers exist specifically so that cache columns (`estimated_budget_total`, `like_count`, `comment_count`) **cannot** drift from source-of-truth rows even if a future code path writes directly via SQL — they are DB-level invariants, not merely backend-service responsibilities.

---

## 12. Migrations

Migrations are ordered, forward-only SQL files (or a migration-tool equivalent such as `node-pg-migrate`/Prisma Migrate — tool choice belongs to the Backend PRD; this section defines **ordering and content only**).

```
0001_extensions.sql          -- CREATE EXTENSION pgcrypto, citext
0002_enums.sql                -- trip_status_enum, user_role_enum, user_status_enum, cost_category_enum
0003_functions_triggers.sql   -- set_updated_at(), bump_lock_version() (bodies only; attached later per-table)
0004_users.sql                 -- users table + indexes + updated_at trigger
0005_auth_tokens.sql            -- password_reset_tokens, email_verification_tokens, refresh_tokens
0006_cities.sql                  -- cities table + search_vector + indexes
0007_activities.sql               -- activities table + search_vector + indexes + FK to cities
0008_trips.sql                     -- trips table + indexes + updated_at & lock_version triggers
0009_trip_stops.sql                 -- trip_stops table + indexes + deferrable unique + triggers
0010_itinerary_items.sql             -- itinerary_items table + indexes + deferrable unique + trigger wiring for budget cache
0011_saved_destinations.sql           -- saved_destinations
0012_community.sql                     -- community_posts, community_comments, community_likes + search_vector + counter triggers
0013_popularity_events.sql              -- city_popularity_events, activity_popularity_events + recording triggers
0014_audit_log.sql                       -- audit_log
0015_seed_reference_data.sql              -- see §13 (idempotent, safe to re-run)
```

Rules for the coding agent:
- Each migration file is self-contained and re-runnable only once (standard migration-tool tracking table, e.g. `schema_migrations`).
- No migration may `DROP` a column/table that a prior migration created without an explicit, separately-reviewed migration — this PRD defines the *initial* schema only; iterative changes are out of scope here.
- Rollback (`down`) scripts must exist for every migration and must be the exact structural inverse (drop what `up` created), except for `0015` (seed data), whose rollback is a no-op — reference data is never destructively rolled back automatically.
- Production migration considerations: run `0001`–`0014` inside a single deploy window with the application in maintenance mode is **not required** (all changes are additive/new tables — no locking risk on existing large tables since this is an initial schema).

---

## 13. Seed / Reference Data

| Category | Contents | Migration |
|---|---|---|
| Static reference data (production-required) | Minimal starter set of `cities` (≥20 major global cities spanning multiple continents/regions, so REQ-007 filters have real data) and 3–5 `activities` per seeded city | `0015_seed_reference_data.sql` |
| Static reference data (production-required) | One seeded `admin` user is **not** created via SQL seed (avoid hard-coded credentials, ARCH security rule) — instead the Backend PRD defines a first-run admin-provisioning flow | N/A — see Backend PRD §24 |
| Development seed data | Additional synthetic users, trips, itinerary items, community posts for local development/demo | separate `seed/dev_fixtures.sql`, **never** executed against production (gated by `NODE_ENV`/migration-runner environment flag) |
| Test fixtures | Factory-style minimal rows created per-test by the backend's test suite (see Backend PRD §25), not stored as static SQL | N/A |

`0015_seed_reference_data.sql` must be idempotent (`INSERT ... ON CONFLICT (name, country_code) DO NOTHING` for cities, similarly for activities keyed by `(city_id, name)`).

---

## 14. Data Lifecycle

| Entity | Create | Update | Status change | Delete | Archive/Retention |
|---|---|---|---|---|---|
| users | on registration | profile edit (REQ-012) | active↔suspended (admin), active→deactivated (self) | soft delete on "delete account"; `email`/`username` released via partial-unique-index exclusion so the same email can re-register | `audit_log` rows survive independently via `SET NULL` FK |
| trips | on "Save" in Create Trip (REQ-003) | itinerary builder edits | draft→planned→ongoing→completed derived from dates by a scheduled/backend-computed status refresh (see Backend PRD §18); cancelled set explicitly by owner | soft delete on "delete" action (REQ-004) | soft-deleted trips excluded from all listings/dashboards/analytics after 30 days retained for possible restore, then a scheduled job hard-deletes rows past retention **[ARCH-018]** — balances "allow undo" with not accumulating unbounded soft-deleted rows forever |
| trip_stops / itinerary_items | via itinerary builder | via itinerary builder / drag-reorder | n/a (no independent status) | hard delete, cascades from trip or explicit stop/item removal | none — always recoverable only via trip-level soft-delete/restore |
| cities / activities | admin/catalog seed | admin edit | n/a | **never hard-deleted while referenced** (`RESTRICT` FK); admin instead sets a `is_active`-style deactivation — **[ARCH-019]** — however since the PDF does not request catalog deactivation UI, this is documented as a future extension point, not implemented in v1 (OPEN question implicitly resolved by RESTRICT behavior alone) | reference data, retained indefinitely |
| community_posts/comments | user action | edit within a short window (Backend PRD business rule) | n/a | soft delete (self or admin moderation) | permanently hard-deleted after retention window by scheduled job, mirroring trips |
| refresh_tokens | on login | — | revoked_at set on logout/rotation | hard delete via scheduled cleanup job once `expires_at < now() - retention` | short retention, security-sensitive |
| password_reset_tokens / email_verification_tokens | on request | — | used_at set on consumption | hard delete via scheduled cleanup once expired | short retention |
| audit_log | on security event | never | n/a | never deleted by the application; only a manual/compliance process would purge | long retention, append-only |

---

## 15. Security & Privacy

- **Sensitive data:** `users.password_hash` (never `SELECT`ed into any API response — backend DTOs must explicitly exclude it, see Backend PRD §4), `password_reset_tokens.token_hash`, `email_verification_tokens.token_hash`, `refresh_tokens.token_hash`. All token tables store **hashes only**, never raw tokens (ARCH decision restated from §6.2–6.4).
- **PII:** `users.email`, `phone_number`, `first_name`, `last_name`, `city`, `country`, `photo_url`. Access restricted to the owning user and admins; never included in public/community responses beyond `first_name`/`photo_url` (display name), which is an explicit, minimal allow-list — see Backend PRD DTOs.
- **What must never be logged:** raw passwords, raw tokens (reset/verification/refresh), full `password_hash` values, full credit-card-equivalent data (N/A — no payments in scope, §16 below). `audit_log.metadata` must be populated only with non-secret context (IP, user agent, action type).
- **Data isolation:** every trip/stop/itinerary/saved-destination query is scoped by `user_id` at the application layer (ARCH-017); the database enforces referential integrity but **not** row-level access — this division of responsibility is documented so the coding agent does not assume the DB alone prevents cross-user access.
- **Secrets:** database credentials, JWT signing keys, and any third-party API keys live in environment configuration (Backend PRD §24), never in any table.
- **Deletion requirements:** REQ-012 "delete account" → soft delete `users` row, revoke all `refresh_tokens`, and (per ARCH-018) retain for a bounded recovery window before hard purge; `audit_log` entries survive independently via `SET NULL`.
- **Encryption:** `password_hash` uses a strong adaptive hash (argon2id or bcrypt, cost tuned per Backend PRD) — this is an application-layer function, not a Postgres extension, so no `pgcrypto` password functions are used for hashing (those are weaker than dedicated password-hashing libraries).

---

## 16. Transactions

| Operation | Tables affected | Boundary | Isolation/locking | Rollback |
|---|---|---|---|---|
| Create trip with initial stop | `trips`, `trip_stops` | single transaction | `READ COMMITTED` (default) | full rollback on any failure |
| Reorder trip stops (drag-and-drop) | `trip_stops` (multiple rows) | single transaction, uses deferrable unique constraint (§8/§10) | `READ COMMITTED` + `lock_version` optimistic check (`WHERE id = ? AND lock_version = ?` per row) | abort entire reorder if any row's `lock_version` mismatches (conflict = someone else edited concurrently) |
| Add/edit/delete itinerary item | `itinerary_items`, cascades to `trips.estimated_budget_total` via trigger | single transaction | `READ COMMITTED` | rollback reverts both the item and the cache in one atomic unit (trigger runs in-transaction) |
| Copy Trip (BR-005) | `trips`, `trip_stops`, `itinerary_items` (bulk insert) | single transaction | `READ COMMITTED` | full rollback if any insert fails — the new trip must never exist partially |
| Delete account | `users` (soft delete), `refresh_tokens` (revoke), cascading soft/hard deletes of owned trips per §14 | single transaction | `READ COMMITTED` | full rollback on failure — never leave a half-deleted account |
| Like/unlike post | `community_likes`, `community_posts.like_count` via trigger | single transaction | `READ COMMITTED`, unique constraint prevents double-insert races | rollback on constraint violation is caught by the backend and translated to a no-op success (idempotent toggle, see Backend PRD §15) |
| Publish/unpublish trip (make public) | `trips` (`is_public`, `share_token`, `shared_at`) | single transaction | `READ COMMITTED` | rollback on failure |

---

## 17. Concurrency

| Scenario | Risk | Strategy |
|---|---|---|
| Two tabs reorder the same trip's stops simultaneously | Lost update / corrupted ordering | `lock_version` optimistic concurrency (ARCH-015) on `trips`/`trip_stops`; the losing request receives a 409 Conflict from the backend and must re-fetch |
| Two requests add itinerary items to the same day at the same time | `sequence_order` collision | Deferrable unique constraint on `(trip_stop_id, item_date, sequence_order)` catches true collisions inside the transaction; backend computes the next `sequence_order` via `SELECT ... FOR UPDATE` on the stop's item set or `MAX(sequence_order)+1` inside the same transaction |
| Duplicate "like" from a double-click/double-submit | Duplicate row | `uq_community_likes_post_user` — second insert fails harmlessly, backend treats as idempotent success |
| Duplicate "Copy Trip" double-click | Two copies created | Idempotency key pattern at the API layer (Backend PRD §15) — not a DB-level constraint, since two *legitimate* copies of the same trip are otherwise valid |
| Concurrent registration with the same username/email | Duplicate account | Partial unique indexes on `users.username`/`email` — second `INSERT` fails, backend returns `409 Conflict` |
| Budget cache drifting under concurrent item writes | Stale `estimated_budget_total` | Recomputation happens in a trigger inside the same transaction as the write, not asynchronously — always consistent at commit |

---

## 18. Database Performance

**Likely hot tables:** `trips`, `trip_stops`, `itinerary_items` (read on every dashboard/itinerary view), `cities`/`activities` (read on every search), `community_posts` (feed).

**Likely hot queries:**
- "My trips grouped by status" → `idx_trips_user_id_status`
- "Trip stops + items for itinerary view" → `idx_trip_stops_trip_id_sequence` + `idx_itinerary_items_stop_id_date_sequence`
- "City/activity search with filters" → GIN `search_vector` + composite btree filter indexes
- "Public trip by share token" → unique index, O(1)
- "Admin popular cities this month" → `idx_*_popularity_events_occurred_at` range scan + `GROUP BY city_id`
- "Community feed, newest first" → `idx_community_posts_created_at` partial index

**Pagination strategy:** **[ARCH-020]** Cursor/keyset pagination (`WHERE created_at < :cursor ORDER BY created_at DESC LIMIT :n`) for `community_posts` and any unbounded, frequently-appended feed, because offset pagination degrades on large, constantly-growing tables and feeds are read far more often than paged deep. **Offset pagination** (`LIMIT/OFFSET`) is acceptable for `trips`, `cities`, `activities` search results, since these result sets are bounded/small per user or per filtered query and users rarely page past the first few pages — the simplicity outweighs the marginal performance cost at this scale.

**N+1 avoidance:** the Backend PRD (§4, §8) mandates that itinerary-view/dashboard endpoints fetch trip + stops + items via a single joined query (or a small fixed number of batched queries keyed by parent IDs), never per-row lazy loading in application code.

**Aggregation strategy:** budget breakdown (`SUM(cost) GROUP BY cost_category`) is computed on read for the *detail* view (cheap — bounded by one trip's items) but the *cache column* (`estimated_budget_total`) is used for list/dashboard views where only the total is needed (ARCH-010), avoiding an aggregate join across every trip in a user's list.

---

## 19. Anti-Patterns (explicitly forbidden in this project)

1. **Do not** store `trip_stops`/`itinerary_items` as a JSON blob on `trips` — they are independently queried, filtered, reordered, and aggregated; this is quintessential relational data (contrast with `notification_preferences`/`attachment_urls`, which are genuinely unstructured and correctly JSONB).
2. **Do not** make `cities`/`activities` foreign keys `ON DELETE CASCADE` from a casual admin action — catalog rows are reference data; accidental deletion must not silently corrupt every trip that references them (§7, `RESTRICT`).
3. **Do not** add nullable columns "just in case" — every nullable column in §6 has a documented reason (e.g. `city_id` nullable only because custom/free-text stops are explicitly supported).
4. **Do not** use unbounded free `text` where a closed set exists — `trip_status_enum`/`cost_category_enum`/`user_role_enum` are native enums, not strings the application must validate ad hoc.
5. **Do not** enforce uniqueness, non-negativity, or date-ordering only in application code where Postgres `CHECK`/`UNIQUE` constraints can guarantee it — see §8.
6. **Do not** create a polymorphic `owner_type`/`owner_id` pattern anywhere (e.g. for likes/comments/saves) — each relationship in §7 targets exactly one table via a dedicated FK column, even though this means `community_likes` cannot "also" like a comment; if that feature is added later, it gets its own join table.
7. **Do not** store derived/aggregate values without a documented invalidation mechanism — the only two cached aggregates (`trips.estimated_budget_total`, `community_posts.like_count`/`comment_count`) are trigger-maintained, not backend-maintained, precisely to prevent drift.
8. **Do not** over-index — §9 explicitly lists rejected indexes and the reasoning for omitting them.
9. **Do not** use `ON DELETE CASCADE` from `users` in a way that destroys content an admin/compliance process may need — hence soft delete (not immediate cascade delete) on `users`, `trips`, `community_posts/comments`.
10. **Do not** store money as `float`/`double precision` — always `numeric(12,2)`.

---

## 20. Database Implementation Checklist

- [ ] PostgreSQL 16+ instance provisioned; `pgcrypto` and `citext` extensions installed (migration `0001`)
- [ ] All native enum types created (migration `0002`)
- [ ] Shared trigger functions (`set_updated_at`, `bump_lock_version`, budget-cache refresh, counter sync, popularity-event recording) created (migration `0003`, wired per-table in `0004`–`0013`)
- [ ] All 16 tables created in dependency order (`0004`–`0014`) with every column, default, and nullability exactly as specified in §6
- [ ] All FKs created with explicit `ON DELETE` behavior per §7 (no implicit defaults)
- [ ] All CHECK/UNIQUE constraints created per §8, including partial and deferrable variants
- [ ] All indexes created per §9, including GIN full-text indexes
- [ ] Generated `tsvector` columns verified to populate correctly on insert/update
- [ ] Seed reference data (`0015`) loaded idempotently; verified `SELECT count(*) FROM cities` ≥ 20 and every seeded city has ≥3 activities
- [ ] Dev fixtures load into a separate, non-production-gated script
- [ ] Transaction boundaries from §16 verified with integration tests (see Backend PRD §25) covering: reorder conflict (409), item add + budget cache consistency, copy-trip atomicity, account deletion cascade
- [ ] Concurrency tests from §17 pass: duplicate registration, duplicate like, concurrent stop reorder
- [ ] Soft-delete filtering (`deleted_at IS NULL`) verified on every default listing query
- [ ] Security review: confirmed no raw secrets/tokens ever selected into API responses or written to logs
- [ ] Rollback (`down`) migrations verified to cleanly reverse each `up` migration in a scratch database

---

*End of Document 1. See `GlobeTrotter_Backend_Logic_Design_PRD.md` for the corresponding backend logic specification, which references every table and ID scheme defined above.*
