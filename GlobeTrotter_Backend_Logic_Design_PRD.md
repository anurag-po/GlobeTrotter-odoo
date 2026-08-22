# GlobeTrotter — Backend Logic Design PRD (Document 2 of 2)
**Target:** TypeScript · **Consumer:** AI coding agent · **Companion doc:** `GlobeTrotter_Database_Design_PRD.md` (all table/column/ID references below map 1:1 to that document)

---

## 1. Executive Summary

This document specifies the backend service that implements GlobeTrotter's product requirements (REQ-001…013), UI-inferred behaviors (UI-001…012), and business rules (BR-001…007) against the PostgreSQL schema defined in the Database Design PRD. It defines architecture, modules, API contracts, validation, workflows, state machines, error handling, security, and testing to a level of precision an AI coding agent can implement without inventing product behavior.

---

## 2. Source Requirements & Traceability

Reuses the exact ID scheme from the Database PRD (`REQ-*`, `UI-*`, `BR-*`, `ASSUMP-*`, `ARCH-*`, `OPEN-*`). New backend-only IDs introduced in this document continue the same numbering (`ARCH-021+`, `ASSUMP-009+`) so the two documents never collide.

| PDF/UI Requirement | Backend Module | Primary Endpoints |
|---|---|---|
| REQ-001, UI-001 | `auth` | `POST /auth/register`, `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| REQ-002, UI-003 | `dashboard` | `GET /dashboard` |
| REQ-003, UI-004 | `trips` | `POST /trips`, `GET /trips/:id/suggestions` |
| REQ-004, UI-006 | `trips` | `GET /trips`, `GET/PATCH/DELETE /trips/:id` |
| REQ-005, UI-005 | `trip-stops`, `itinerary-items` | `POST/PATCH/DELETE /trips/:id/stops`, `PATCH /trips/:id/stops/reorder`, `POST/PATCH/DELETE /trip-stops/:id/items` |
| REQ-006, UI-009 | `itinerary` | `GET /trips/:id/itinerary` |
| REQ-007 | `catalog` | `GET /cities` |
| REQ-008 | `catalog` | `GET /activities` |
| REQ-009 | `budget` | `GET /trips/:id/budget` |
| REQ-010, UI-011 | `calendar` | `GET /trips/calendar` |
| REQ-011 | `sharing` | `POST /trips/:id/share`, `GET /public/trips/:token`, `POST /public/trips/:token/copy` |
| REQ-012, UI-007 | `users` | `GET/PATCH /users/me`, `DELETE /users/me`, `GET/POST/DELETE /users/me/saved-destinations` |
| REQ-013, UI-012 | `admin` | `GET /admin/users`, `GET /admin/analytics/*` |
| UI-010 | `community` | `GET/POST /community/posts`, `POST /community/posts/:id/comments`, `POST /community/posts/:id/like` |

---

## 3. Assumptions & Architecture Decisions (backend-specific)

| ID | Statement |
|---|---|
| ASSUMP-009 | Authentication is stateless JWT (short-lived access token) + rotating refresh token stored server-side (`refresh_tokens` table), since the PDF specifies only "Login button" with no session-technology mandate. |
| ASSUMP-010 | "Group by" controls visible in every list/search UI (Screens 3, 6, 8, 10, 11, 12) map to a constrained, whitelisted `groupBy` query parameter per endpoint (e.g. trips: `status`; cities: `country`), not free-form dynamic grouping — prevents arbitrary/unsafe query construction. |
| ASSUMP-011 | Trip status transitions (`draft → planned → ongoing → completed`) are computed by a **scheduled job** comparing `now()` to `start_date`/`end_date`, not solely on-write, so a trip's status stays correct even if nobody touches it near its start date. |

| ID | Decision | Rationale |
|---|---|---|
| ARCH-021 | **Layered modular monolith**, Node.js + TypeScript, Express (or Fastify) as HTTP transport | PDF/UI describe a cohesive single product with no independent scaling/deployment needs described — a modular monolith minimizes operational complexity while §5 module boundaries keep it decomposable later if needed |
| ARCH-022 | ORM/query layer: a typed query builder (e.g. Kysely or Drizzle) over raw `pg`, **not** a full ActiveRecord-style ORM | Schema in the Database PRD relies heavily on DB-level triggers/constraints (budget cache, lock_version, deferrable uniqueness) that a typed query builder respects without fighting an ORM's own change-tracking/versioning assumptions |
| ARCH-023 | Validation library: Zod (or equivalent schema-validation library) shared between request DTO validation and TypeScript type inference | Single source of truth for both runtime validation and compile-time types — reduces drift between the two |
| ARCH-024 | Background jobs: a lightweight in-process/DB-backed job queue (e.g. `pg-boss`, which persists jobs in Postgres) rather than a separate message broker (Redis/RabbitMQ/SQS) | Keeps infrastructure minimal (one database) while still providing durable retries or delayed jobs for §18; acceptable at MVP scale — revisit only if job throughput becomes a bottleneck |
| ARCH-025 | API versioning via URL prefix `/api/v1` | Simple, explicit, cache-friendly; avoids header-based versioning complexity not justified for this scope |
| ARCH-026 | All monetary/date arithmetic in the backend uses a decimal-safe library (e.g. `decimal.js`) when manipulating `numeric` values returned as strings from `pg`, never native JS `number` | Prevents floating-point rounding errors on currency, consistent with DB `numeric(12,2)` |

---

## 4. Backend Architecture

```
┌─────────────────────────────────────────────┐
│ API / Transport                              │  Express routers, HTTP concerns only:
│  - route definitions, middleware pipeline     │  auth guard, request parsing, response
│  - request → DTO validation (Zod)             │  shaping, HTTP status mapping
└───────────────────┬───────────────────────────┘
                     ▼
┌─────────────────────────────────────────────┐
│ Application / Use Cases                       │  One function per business operation
│  - orchestrates domain + infra                │  (CreateTripUseCase, ReorderStopsUseCase…)
│  - owns transaction boundaries                 │  Pure orchestration, no SQL, no HTTP
└───────────────────┬───────────────────────────┘
                     ▼
┌─────────────────────────────────────────────┐
│ Domain                                        │  Entities, value objects, business rules,
│  - Trip, TripStop, ItineraryItem, Budget       │  state machines (§13), pure functions,
│  - invariant checks independent of storage      │  framework-free
└───────────────────┬───────────────────────────┘
                     ▼
┌─────────────────────────────────────────────┐
│ Infrastructure                                │  Repositories (typed query builder),
│  - Postgres repositories                       │  password hasher, JWT signer, email
│  - external service adapters                   │  sender, job queue, S3-compatible
│  - job queue, cache adapters                    │  storage adapter
└───────────────────┬───────────────────────────┘
                     ▼
              PostgreSQL / External Services
```

**Dependency direction:** strictly downward. Domain never imports Infrastructure or Application. Application never imports API/Transport. Controllers never issue SQL directly (restated in §26 coding-agent rules).

**Project structure:**

```
src/
  api/                 # routers, middleware, DTO schemas (Zod), error-to-HTTP mapping
    auth/
    trips/
    trip-stops/
    itinerary/
    catalog/
    budget/
    calendar/
    sharing/
    users/
    community/
    admin/
  application/          # use-case classes/functions, one per business operation
  domain/                # entities, value objects, state machines, pure business rules
  infrastructure/
    db/                    # migrations (owned by Database PRD), repositories, typed schema
    auth/                   # password hashing, JWT
    storage/                 # photo/media upload adapter
    email/                    # transactional email adapter
    jobs/                      # scheduled + queued job definitions (ARCH-024)
  config/                       # environment loading & validation (§24)
  shared/                        # error types, logging, pagination helpers, result types
```

**Configuration strategy:** all runtime configuration loaded once at boot via a validated environment schema (Zod), fails fast on missing/invalid config (§24). **Environment strategy:** `development`, `test`, `production`, each with its own `.env.*` file (never committed) and distinct database.

---

## 5. Module Boundaries

| Module | Purpose | Owned tables | Public operations | Depends on |
|---|---|---|---|---|
| `auth` | Registration, login, tokens, password reset | `users` (write on register), `password_reset_tokens`, `email_verification_tokens`, `refresh_tokens` | register, login, refresh, logout, forgotPassword, resetPassword, verifyEmail | `users` module (for profile creation), `email` infra |
| `users` | Profile CRUD, saved destinations, account deletion | `users`, `saved_destinations` | getProfile, updateProfile, deleteAccount, listSavedDestinations, saveDestination, unsaveDestination | `catalog` (city existence check) |
| `catalog` | City/activity search & retrieval | `cities`, `activities` | searchCities, getCity, searchActivities, getActivity | none (leaf module) |
| `trips` | Trip CRUD, status, dashboard, ownership | `trips` | createTrip, getTrip, listTrips, updateTrip, deleteTrip, getSuggestions | `catalog` |
| `trip-stops` | Stop management, reordering | `trip_stops` | addStop, updateStop, deleteStop, reorderStops | `trips`, `catalog` |
| `itinerary` | Itinerary items, day-wise view | `itinerary_items` | addItem, updateItem, deleteItem, getItinerary | `trip-stops`, `catalog` |
| `budget` | Cost breakdown & alerts | reads `trips`, `trip_stops`, `itinerary_items` (no owned tables) | getBudgetBreakdown | `trips`, `itinerary` |
| `calendar` | Calendar/timeline aggregation across trips | reads `trips`, `trip_stops` | getCalendar | `trips` |
| `sharing` | Public sharing, copy trip | `trips` (share fields), triggers full clone via `trips`/`trip_stops`/`itinerary_items` | publishTrip, unpublishTrip, getPublicTrip, copyTrip | `trips`, `trip-stops`, `itinerary` |
| `community` | Feed, comments, likes | `community_posts`, `community_comments`, `community_likes` | createPost, listFeed, deletePost, addComment, toggleLike | `users`, `trips` (optional link) |
| `admin` | User management, analytics | reads all tables; writes `users.status`, `users.role` | listUsers, suspendUser, getPopularCities, getPopularActivities, getUserTrends | all modules (read-only aggregation) |
| `dashboard` | Home-screen aggregation | reads `trips`, `cities` | getDashboard | `trips`, `catalog` |

No module accesses another module's owned tables directly — cross-module reads go through the owning module's repository/use-case, never a raw join across module boundaries in application code (the **database** may still be joined efficiently inside a single module's repository query, e.g. `trip-stops` joining `cities` for display, since `cities` is a stable read-only catalog dependency explicitly listed above).

**Events emitted/consumed:** see §22 (kept minimal — this is a modular monolith, not an event-sourced system; events are used only where async decoupling genuinely helps, i.e. popularity-event recording and analytics refresh).

---

## 6. Authentication

**Registration (REQ-001, UI-002):**
- Fields: `username`, `email`, `password`, `firstName`, `lastName`, `phoneNumber?`, `city?`, `country?`, `additionalInfo?`, `photoUrl?`.
- Password requirements: minimum 8 characters, at least one letter and one digit — **[ARCH-027]**, a reasonable baseline since the PDF only says "basic validation."
- Password hashed with argon2id (or bcrypt, cost factor ≥ 12) before persisting to `users.password_hash`.
- On success: create `users` row, issue an `email_verification_tokens` row, send verification email (async job, §18), return access+refresh tokens immediately (**[ASSUMPTION] users are not blocked from using the app pending email verification**, since the PDF does not describe an email-gated flow — verification is encouraged but not enforced for core features; it IS required before certain sensitive actions are added in the future, e.g. payments, which are out of scope).

**Login (REQ-001, UI-001):**
- Accepts `identifier` (username OR email, ASSUMP-001) + `password`.
- Look up user by `username` or `email` (both partial-unique, case-insensitive via `citext`).
- Verify password hash; on failure, write `audit_log` action `login_failed`, return generic `401 INVALID_CREDENTIALS` (never reveal whether the identifier existed — prevents user enumeration).
- On success: update `last_login_at`, write `audit_log` action `login_success`, issue access token (JWT, 15 min expiry) + refresh token (opaque random string, hashed into `refresh_tokens.token_hash`, 30-day expiry).

**Token refresh:** `POST /auth/refresh` — validates refresh token hash + `expires_at`/`revoked_at`, issues new access token, **rotates** the refresh token (old one revoked, new one issued) — **[ARCH-028]** rotation on every use prevents replay of a stolen-but-unused refresh token going undetected.

**Logout:** revokes the presented refresh token (`revoked_at = now()`).

**Forgot password / reset (REQ-001):**
- `POST /auth/forgot-password { email }` → always returns `200` regardless of whether the email exists (prevents enumeration); if it exists, creates a `password_reset_tokens` row (1-hour expiry) and sends a reset email async.
- `POST /auth/reset-password { token, newPassword }` → validates token hash + expiry + unused, updates `password_hash`, marks token `used_at`, revokes **all** existing refresh tokens for that user (force re-login everywhere), writes `audit_log` action `password_reset`.

**Session invalidation:** account deletion (§8) and password reset both revoke all refresh tokens. Admin-suspend (§9) also revokes all refresh tokens for the suspended user.

**Suspicious activity handling [ARCH-029]:** login endpoint is rate-limited (§23) per IP and per identifier; 5 consecutive failed logins for the same identifier within 15 minutes triggers a temporary 15-minute lockout (checked via a count of recent `login_failed` `audit_log` rows for that user, or an in-memory/Redis-free counter keyed by identifier — implemented via a short-lived DB-backed counter to avoid adding Redis as a dependency, consistent with ARCH-024's minimal-infra stance).

**OAuth/social login:** **Not applicable** — the PDF specifies only email/password (REQ-001); no social provider is mentioned. Not implemented in v1.

---

## 7. Authorization

**Roles:** `user`, `admin` (`users.role`).

| Resource / Operation | Who may perform it |
|---|---|
| Read/update/delete own `trips`, `trip_stops`, `itinerary_items`, `saved_destinations`, profile | The owning `user` only (`trips.user_id = currentUser.id`, checked on every access — ARCH-017) |
| Read another user's trip | Only if `trips.is_public = true` **and** accessed via the public share endpoint (`GET /public/trips/:token`) — never via the authenticated `GET /trips/:id` route for a non-owner, even if public (**[BR-008]** the authenticated detail route is owner-only; public viewing always goes through the dedicated public/share surface, which returns a reduced, read-only DTO — keeps authorization logic in exactly one place) |
| Copy a public trip | Any authenticated user, via `POST /public/trips/:token/copy` |
| Create/read/search `cities`/`activities` (catalog) | Read: any authenticated user (or unauthenticated, for public trip browsing — **[ASSUMPTION]** catalog search is public/unauthenticated since it's discovery content, not personal data). Write (admin-managed catalog maintenance): `admin` only, via `admin` module endpoints not exposed in the consumer-facing UI screens but included for completeness — **[OPEN-003]** the PDF's UI mockups show no catalog-authoring screen; catalog writes are therefore assumed to happen via seed data + a minimal admin-only CRUD API, not a dedicated UI. |
| Community posts/comments | Create: any authenticated user, as themselves only. Delete: the author, or an `admin` (moderation) |
| Like/unlike | Any authenticated user, on their own like record only |
| Admin dashboard (`/admin/*`) | `admin` role only — enforced by a dedicated `requireAdmin` middleware, checked in addition to (not instead of) authentication |
| Suspend/manage users | `admin` only; an admin cannot suspend another admin via this API (**[ARCH-030]** prevents accidental lockout/privilege escalation abuse; superuser operations, if ever needed, happen via direct DB access, out of scope) |

**Enforcement pattern [ARCH-031]:** every use case that touches a user-owned resource receives `currentUserId` explicitly (never reads it from a global/thread-local) and the repository query includes `WHERE user_id = :currentUserId` (or an explicit ownership check after fetch, followed by a `403 FORBIDDEN` if mismatched) — restated from Database PRD ARCH-017 to keep both documents consistent.

---

## 8. API Specification

> Base path: `/api/v1`. All authenticated endpoints require `Authorization: Bearer <accessToken>`. All list endpoints support pagination per §21.

### 8.1 Auth (`auth` module)

```
POST /auth/register
Purpose: Create a new account (REQ-001, UI-002).
Auth: none.
Body: { username, email, password, firstName, lastName, phoneNumber?, city?, country?, additionalInfo?, photoUrl? }
Validation: see §9.
Success: 201 Created → { user: PublicUserDTO, accessToken, refreshToken }
Errors: 400 VALIDATION_ERROR, 409 USERNAME_TAKEN, 409 EMAIL_TAKEN

POST /auth/login
Purpose: Authenticate (REQ-001, UI-001).
Auth: none.
Body: { identifier, password }
Success: 200 OK → { user: PublicUserDTO, accessToken, refreshToken }
Errors: 400 VALIDATION_ERROR, 401 INVALID_CREDENTIALS, 423 ACCOUNT_LOCKED, 403 ACCOUNT_SUSPENDED

POST /auth/refresh
Body: { refreshToken }
Success: 200 OK → { accessToken, refreshToken }
Errors: 401 INVALID_REFRESH_TOKEN

POST /auth/logout
Auth: required (access token) or refresh token in body.
Body: { refreshToken }
Success: 204 No Content

POST /auth/forgot-password
Body: { email }
Success: 200 OK (always, regardless of existence)

POST /auth/reset-password
Body: { token, newPassword }
Success: 200 OK
Errors: 400 INVALID_OR_EXPIRED_TOKEN

POST /auth/verify-email
Body: { token }
Success: 200 OK
Errors: 400 INVALID_OR_EXPIRED_TOKEN
```

### 8.2 Users (`users` module) — REQ-012, UI-007

```
GET /users/me
Auth: required.
Success: 200 OK → PrivateUserDTO

PATCH /users/me
Auth: required.
Body: partial { firstName?, lastName?, phoneNumber?, city?, country?, additionalInfo?, photoUrl?, languagePreference?, notificationPreferences? }
Note: email/username change NOT supported via this endpoint in v1 — [ASSUMPTION] the mockup shows an editable email field, but changing a login identifier safely requires re-verification; out of scope, tracked as OPEN-004. PATCH silently ignores an `email`/`username` field if sent (documented, not a validation error, to avoid breaking naive clients) — [ARCH-032].
Success: 200 OK → PrivateUserDTO
Errors: 400 VALIDATION_ERROR

DELETE /users/me
Auth: required.
Body: { password } (re-authentication required for destructive action)
Success: 204 No Content
Errors: 401 INVALID_PASSWORD

GET /users/me/saved-destinations
Auth: required.
Success: 200 OK → { items: CityDTO[] }

POST /users/me/saved-destinations
Body: { cityId }
Success: 201 Created
Errors: 404 CITY_NOT_FOUND, 409 ALREADY_SAVED (idempotent — see §15)

DELETE /users/me/saved-destinations/:cityId
Success: 204 No Content
```

### 8.3 Catalog (`catalog` module) — REQ-007, REQ-008

```
GET /cities
Auth: optional.
Query: q?, country?, region?, sortBy? (popularity|name|costIndex), page?, pageSize?
Success: 200 OK → PaginatedResponse<CityDTO>

GET /cities/:id
Success: 200 OK → CityDTO
Errors: 404 CITY_NOT_FOUND

GET /activities
Query: cityId?, q?, category?, minCost?, maxCost?, minDuration?, maxDuration?, sortBy? (popularity|cost|duration), page?, pageSize?
Success: 200 OK → PaginatedResponse<ActivityDTO>

GET /activities/:id
Success: 200 OK → ActivityDTO
Errors: 404 ACTIVITY_NOT_FOUND
```

### 8.4 Trips (`trips` module) — REQ-003/004, UI-004/006

```
POST /trips
Purpose: Create a trip (REQ-003).
Auth: required.
Body: { name, description?, startDate, endDate, coverPhotoUrl?, currencyCode? }
Validation: endDate >= startDate; name 1–200 chars.
Success: 201 Created → TripDTO
Errors: 400 VALIDATION_ERROR

GET /trips
Auth: required.
Query: status? (draft|planned|ongoing|completed|cancelled), groupBy? (status), sortBy? (startDate|createdAt), page?, pageSize?
Success: 200 OK → PaginatedResponse<TripSummaryDTO> (grouped client-side by returned `status` field when groupBy=status; UI-006's three buckets are a status filter, not a distinct query)
Note: response also includes `preplanned` vs `previous` classification per item — [UI-007] derived as `preplanned = status IN (draft, planned, ongoing)`, `previous = status = completed` (cancelled trips shown only when explicitly filtered).

GET /trips/:id
Auth: required, owner only.
Success: 200 OK → TripDetailDTO (includes stops + summary budget)
Errors: 404 TRIP_NOT_FOUND, 403 FORBIDDEN

PATCH /trips/:id
Auth: required, owner only.
Body: partial { name?, description?, startDate?, endDate?, coverPhotoUrl?, status? (cancel only), currencyCode? }
Headers: If-Match: <lockVersion> — [ARCH-033] optimistic concurrency exposed via standard If-Match/ETag semantics
Success: 200 OK → TripDTO
Errors: 400 VALIDATION_ERROR, 404 TRIP_NOT_FOUND, 403 FORBIDDEN, 409 LOCK_VERSION_MISMATCH

DELETE /trips/:id
Auth: required, owner only.
Success: 204 No Content
Errors: 404 TRIP_NOT_FOUND, 403 FORBIDDEN

GET /trips/:id/suggestions
Purpose: "Suggestions for Places to Visit/Activities" shown during trip creation (UI-004).
Auth: required, owner only (or unauthenticated-safe variant used pre-save — see BR note below).
Query: none (uses trip's date range/existing stops if any) — [ASSUMPTION] for a not-yet-created trip, the frontend calls a stateless variant `GET /catalog/suggestions?limit=6` returning top-popularity cities; once a trip exists, `/trips/:id/suggestions` returns cities/activities related to the trip's existing stops' regions.
Success: 200 OK → { cities: CityDTO[], activities: ActivityDTO[] }
```

### 8.5 Trip Stops (`trip-stops` module) — REQ-005, UI-005

```
POST /trips/:tripId/stops
Auth: required, owner only.
Body: { cityId? , customPlaceName?, startDate, endDate, description?, budgetAmount? }
Validation: exactly one of cityId/customPlaceName; startDate/endDate within trip's date bounds (BR-002, soft check — see §9); assigns next sequenceOrder.
Success: 201 Created → TripStopDTO
Errors: 400 VALIDATION_ERROR, 404 TRIP_NOT_FOUND / CITY_NOT_FOUND, 403 FORBIDDEN

PATCH /trips/:tripId/stops/:stopId
Body: partial { cityId?, customPlaceName?, startDate?, endDate?, description?, budgetAmount? }
Headers: If-Match: <lockVersion>
Success: 200 OK → TripStopDTO
Errors: 400, 404, 403, 409 LOCK_VERSION_MISMATCH

DELETE /trips/:tripId/stops/:stopId
Success: 204 No Content (cascades itinerary items per DB PRD §7)
Errors: 404, 403

PATCH /trips/:tripId/stops/reorder
Purpose: Drag-to-reorder (REQ-005, REQ-010).
Body: { orderedStopIds: string[] } (complete new order)
Success: 200 OK → TripStopDTO[]
Errors: 400 VALIDATION_ERROR (ids don't match existing set), 404, 403, 409 CONFLICT
```

### 8.6 Itinerary Items (`itinerary` module) — REQ-005/006, UI-009

```
POST /trip-stops/:stopId/items
Body: { activityId?, customName?, costCategory, itemDate, startTime?, endTime?, cost, currencyCode?, notes? }
Validation: exactly one of activityId/customName; itemDate within stop's date range; cost >= 0; assigns next sequenceOrder for that day.
Success: 201 Created → ItineraryItemDTO
Errors: 400, 404, 403

PATCH /trip-stops/:stopId/items/:itemId
Body: partial (same fields)
Success: 200 OK → ItineraryItemDTO
Errors: 400, 404, 403

DELETE /trip-stops/:stopId/items/:itemId
Success: 204 No Content
Errors: 404, 403

GET /trips/:tripId/itinerary
Purpose: Full day-wise itinerary view (REQ-006, UI-009).
Query: view? (list|calendar) — controls response shaping only, both variants return the same underlying data
Success: 200 OK → { stops: [{ stop: TripStopDTO, days: [{ date, items: ItineraryItemDTO[] }] }] }
Errors: 404, 403
```

### 8.7 Budget (`budget` module) — REQ-009

```
GET /trips/:id/budget
Auth: required, owner only.
Success: 200 OK → BudgetBreakdownDTO {
  currencyCode,
  totalEstimated,      // sum of all stop.budgetAmount, or trip-level fallback
  totalActual,          // sum of all itinerary_items.cost (== trips.estimated_budget_total cache)
  byCategory: { transport, stay, activity, meal, other }, // sums of itinerary_items.cost
  byStop: [{ stopId, budgeted, actual, isOverBudget }],
  averageCostPerDay,
  overBudgetAlerts: [{ stopId, budgeted, actual, overageAmount }]
}
Errors: 404, 403
```

### 8.8 Calendar (`calendar` module) — REQ-010, UI-011

```
GET /trips/calendar
Auth: required.
Query: month (YYYY-MM), timezone? 
Purpose: Month-grid view of the user's trips (UI-011).
Success: 200 OK → { entries: [{ tripId, name, startDate, endDate, status }] }
Errors: 400 INVALID_MONTH
```

### 8.9 Sharing (`sharing` module) — REQ-011

```
POST /trips/:id/share
Auth: required, owner only.
Success: 200 OK → { isPublic: true, shareUrl, shareToken }
Errors: 404, 403

DELETE /trips/:id/share
Purpose: Unpublish.
Success: 200 OK → { isPublic: false }
Errors: 404, 403

GET /public/trips/:token
Auth: none.
Success: 200 OK → PublicTripDTO (read-only: name, description, dates, stops, items — no budget-vs-actual owner-only fields beyond aggregate totals which are useful for inspiration, no owner PII beyond first name)
Errors: 404 TRIP_NOT_FOUND_OR_NOT_PUBLIC
Side effect: increments trips.view_count (async, fire-and-forget, §16 eventual-consistency operation)

POST /public/trips/:token/copy
Auth: required (must be logged in to own the copy).
Success: 201 Created → TripDTO (new trip owned by current user, BR-005)
Errors: 404 TRIP_NOT_FOUND_OR_NOT_PUBLIC, 401 UNAUTHENTICATED
```

### 8.10 Community (`community` module) — UI-010

```
GET /community/posts
Query: q?, tripId?, userId?, cursor?, pageSize? (cursor-based, §21)
Success: 200 OK → CursorPaginatedResponse<CommunityPostDTO>

POST /community/posts
Body: { content, tripId?, attachmentUrls? }
Validation: content 1–5000 chars.
Success: 201 Created → CommunityPostDTO
Errors: 400

DELETE /community/posts/:id
Auth: author or admin.
Success: 204 No Content
Errors: 404, 403

POST /community/posts/:id/comments
Body: { content }
Success: 201 Created → CommunityCommentDTO
Errors: 400, 404

POST /community/posts/:id/like
Purpose: Idempotent toggle-on.
Success: 200 OK → { liked: true, likeCount }

DELETE /community/posts/:id/like
Purpose: Idempotent toggle-off.
Success: 200 OK → { liked: false, likeCount }
```

### 8.11 Dashboard (`dashboard` module) — REQ-002, UI-003

```
GET /dashboard
Auth: required.
Success: 200 OK → {
  welcomeName,
  recentTrips: TripSummaryDTO[],       // last 3–5 updated
  recommendedDestinations: CityDTO[],   // top popularity_score
  budgetHighlights: { totalPlannedThisYear, tripsOverBudgetCount }
}
```

### 8.12 Admin (`admin` module) — REQ-013, UI-012

```
GET /admin/users
Auth: admin only.
Query: q?, status?, role?, page?, pageSize?
Success: 200 OK → PaginatedResponse<AdminUserDTO>

PATCH /admin/users/:id/status
Body: { status: 'active' | 'suspended' }
Success: 200 OK → AdminUserDTO
Errors: 403 CANNOT_MODIFY_ADMIN (ARCH-030), 404

GET /admin/analytics/popular-cities
Query: from?, to?, limit? (default 10)
Success: 200 OK → { items: [{ cityId, name, eventCount }] }  // aggregated from city_popularity_events

GET /admin/analytics/popular-activities
Query: from?, to?, limit?
Success: 200 OK → { items: [{ activityId, name, eventCount }] }

GET /admin/analytics/trends
Query: from?, to?, granularity? (day|week|month)
Success: 200 OK → {
  tripsCreatedOverTime: [{ bucket, count }],
  activeUsersOverTime: [{ bucket, count }],
  totalTrips, totalUsers, totalCommunityPosts
}
```

**Idempotency behavior:** POST endpoints that are naturally re-triggerable by network retries (`saveDestination`, `like`) are designed idempotent by unique-constraint semantics (§15). `POST /trips` and `POST /trip-stops/:id/items` are **not** naturally idempotent (legitimately creating two similar trips is valid) — see §15 for the explicit idempotency-key mechanism offered for these.

**Rate limiting:** global default 100 req/min per authenticated user, 20 req/min per unauthenticated IP for public endpoints; `auth` login/register endpoints have a stricter 10 req/min per IP (§23).

---

## 9. DTO / Request-Response Contracts

```ts
// ---- Users ----
interface PublicUserDTO {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
}

interface PrivateUserDTO extends PublicUserDTO {
  email: string;
  phoneNumber: string | null;
  city: string | null;
  country: string | null;
  additionalInfo: string | null;
  languagePreference: string;
  role: 'user' | 'admin';
  notificationPreferences: Record<string, unknown>;
  createdAt: string; // ISO 8601
}
// password_hash is NEVER included in any DTO.

// ---- Catalog ----
interface CityDTO {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region: string | null;
  costIndex: number | null;
  popularityScore: number;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  description: string | null;
}

interface ActivityDTO {
  id: string;
  cityId: string;
  name: string;
  description: string | null;
  category: string;
  costEstimate: number | null;
  currencyCode: string;
  durationMinutes: number | null;
  imageUrl: string | null;
  popularityScore: number;
}

// ---- Trips ----
type TripStatus = 'draft' | 'planned' | 'ongoing' | 'completed' | 'cancelled';

interface TripSummaryDTO {
  id: string;
  name: string;
  coverPhotoUrl: string | null;
  startDate: string; // date
  endDate: string;
  status: TripStatus;
  destinationCount: number;
  estimatedBudgetTotal: string; // decimal-as-string, ARCH-026
  currencyCode: string;
}

interface TripDTO extends TripSummaryDTO {
  description: string | null;
  isPublic: boolean;
  shareUrl: string | null;
  lockVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface TripDetailDTO extends TripDTO {
  stops: TripStopDTO[];
}

interface TripStopDTO {
  id: string;
  tripId: string;
  cityId: string | null;
  city: CityDTO | null;
  customPlaceName: string | null;
  sequenceOrder: number;
  startDate: string;
  endDate: string;
  description: string | null;
  budgetAmount: string | null;
  lockVersion: number;
}

interface ItineraryItemDTO {
  id: string;
  tripStopId: string;
  activityId: string | null;
  activity: ActivityDTO | null;
  customName: string | null;
  costCategory: 'transport' | 'stay' | 'activity' | 'meal' | 'other';
  itemDate: string;
  startTime: string | null; // ISO 8601 datetime
  endTime: string | null;
  cost: string;
  currencyCode: string;
  sequenceOrder: number;
  notes: string | null;
}

interface CreateTripRequest {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  coverPhotoUrl?: string;
  currencyCode?: string;
}

interface BudgetBreakdownDTO {
  currencyCode: string;
  totalEstimated: string;
  totalActual: string;
  byCategory: Record<'transport' | 'stay' | 'activity' | 'meal' | 'other', string>;
  byStop: Array<{ stopId: string; budgeted: string | null; actual: string; isOverBudget: boolean }>;
  averageCostPerDay: string;
  overBudgetAlerts: Array<{ stopId: string; budgeted: string; actual: string; overageAmount: string }>;
}

// ---- Community ----
interface CommunityPostDTO {
  id: string;
  author: PublicUserDTO;
  tripId: string | null;
  content: string;
  attachmentUrls: string[];
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
  createdAt: string;
}

// ---- Generic wrappers ----
interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface CursorPaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}
```

All monetary fields are transmitted as **decimal strings**, not JS `number`, to avoid float precision loss end-to-end (ARCH-026); the frontend is responsible for display formatting.

---

## 10. Validation

| Layer | Examples | Library/Mechanism |
|---|---|---|
| Syntactic (shape/type) | field presence, string length, date format (`YYYY-MM-DD`), enum membership, UUID format | Zod schemas per endpoint, applied in API layer middleware before the request reaches the use case |
| Business validation | `endDate >= startDate`; stop dates within trip's date range (BR-002, soft-enforced: on violation return `400 STOP_DATES_OUTSIDE_TRIP_RANGE` rather than silently clamping); exactly-one-of (`cityId` XOR `customPlaceName`); cost `>= 0`; content length 1–5000 | Application/domain layer (pure functions in `domain/`, unit-tested independently of HTTP) |
| Authorization validation | ownership checks, role checks | Application layer, before any write; see §7 |
| Database integrity validation | uniqueness (username/email/share_token), FK existence, CHECK constraints | Postgres itself is the final backstop (Database PRD §8) — the backend must translate constraint-violation errors (Postgres error code `23505` unique_violation, `23503` foreign_key_violation, `23514` check_violation) into the appropriate `409`/`400` API error, never leak the raw SQL error (§14) |
| Query parameters | `page`/`pageSize` bounds (1–100, default 20), `sortBy` whitelist per endpoint, `groupBy` whitelist (ASSUMP-010), date range parsing | Zod schemas on query params |
| File uploads | see §19 | MIME/size validation before storage adapter call |
| External API responses | N/A — no external API is called synchronously in this version (ASSUMP-002); email-sending adapter response is validated for delivery-acceptance status only | N/A |

---

## 11. Business Workflows

### 11.1 Create Trip (REQ-003)

1. **Trigger:** `POST /trips`.
2. **Preconditions:** user authenticated.
3. **Validation:** name non-empty ≤200 chars; `endDate >= startDate`; dates are valid calendar dates.
4. **Authorization:** any authenticated user may create a trip for themselves (`user_id` always taken from the authenticated token, never from the request body).
5. **DB reads:** none required beyond auth lookup.
6. **Business rules:** `status` initialized to `'draft'`; `estimated_budget_total` initialized to `0`.
7. **DB writes:** single `INSERT INTO trips`.
8. **Transaction boundary:** single-statement, implicit transaction.
9. **External calls:** none.
10. **Events:** none.
11. **Notifications:** none.
12. **Response:** `201` + `TripDTO`.
13. **Failure behavior:** validation errors → `400`; unexpected DB error → `500 INTERNAL_ERROR` (generic, logged with correlation ID).
14. **Retry behavior:** safe for the client to retry on network failure, but **not idempotent** by design (§15) — a retry may create a duplicate trip; frontend should use the idempotency-key pattern if retry safety is required.
15. **Idempotency:** optional, via `Idempotency-Key` header (§15).

### 11.2 Build Itinerary — Add Stop, Add Item, Reorder (REQ-005, UI-005)

1. **Trigger:** `POST /trips/:tripId/stops` (add stop), `POST /trip-stops/:stopId/items` (add item), `PATCH /trips/:tripId/stops/reorder` (reorder).
2. **Preconditions:** trip exists and is owned by the requester; trip is not soft-deleted.
3. **Validation:** exactly one of `cityId`/`customPlaceName`; stop dates checked against trip range (BR-002); item date checked against stop range.
4. **Authorization:** owner-only (§7).
5. **DB reads:** fetch trip (ownership + date bounds), fetch existing stops (to compute next `sequenceOrder`).
6. **Business rules:** `sequenceOrder` = `MAX(existing) + 1`, computed inside the write transaction to avoid a race (§17 concurrency).
7. **DB writes:** `INSERT INTO trip_stops` / `INSERT INTO itinerary_items`. The `itinerary_items` write triggers the DB-level budget-cache refresh (Database PRD §11) automatically.
8. **Transaction boundary:** the sequence-number computation and the insert happen in one transaction (`SELECT ... FOR UPDATE` on the parent's existing rows, or rely on the deferrable unique constraint + retry-on-conflict pattern — **[ARCH-034]** implementation uses `SELECT COALESCE(MAX(sequence_order),0)+1 ... FOR UPDATE` scoped to the parent id to serialize concurrent inserts for the *same* parent without locking unrelated rows).
9. **External calls:** none.
10. **Events:** `city_popularity_events`/`activity_popularity_events` rows are written by DB trigger, not application code (Database PRD §11) — the backend does not duplicate this logic.
11. **Notifications:** none.
12. **Response:** `201` + created resource DTO.
13. **Failure behavior:** date-range violation → `400 STOP_DATES_OUTSIDE_TRIP_RANGE` / `400 ITEM_DATE_OUTSIDE_STOP_RANGE`; ownership mismatch → `403`.
14. **Retry:** safe to retry on network failure for `add`, not idempotent (duplicate stop is a valid retry outcome the user must dedupe visually) — acceptable since the destructive/duplicate risk is low and reversible (delete).
15. **Reorder is idempotent by construction:** submitting the same `orderedStopIds` array twice produces the same end state.

### 11.3 Publish / Copy Trip (REQ-011, BR-004/005)

**Publish:**
1. Trigger: `POST /trips/:id/share`.
2. Preconditions: owner, trip not deleted.
3. Business rule: generate a cryptographically random `share_token` (256-bit, base62-encoded) if not already public; set `is_public = true`, `shared_at = now()`.
4. DB write: single `UPDATE trips`.
5. Response: `shareUrl = {PUBLIC_APP_BASE_URL}/trips/shared/{token}`.

**Copy Trip (BR-005):**
1. Trigger: `POST /public/trips/:token/copy`.
2. Preconditions: token resolves to an `is_public = true`, non-deleted trip; requester authenticated.
3. Validation: none beyond token resolution.
4. Authorization: any authenticated user.
5. DB reads: fetch source trip + all stops + all items (owner-agnostic, since it's public).
6. Business rules: new trip gets `user_id = requester`, `status = 'draft'`, `is_public = false`, `share_token = NULL`, `source_trip_id = originalTrip.id` (BR-005 lineage), fresh `id`s for trip/stops/items but **identical relative dates** (offset-preserving — **[ASSUMPTION]** dates are copied verbatim, not shifted to "start today," since the PDF doesn't specify date-shifting behavior; documented as OPEN-005 for future UX refinement), costs copied verbatim (OPEN-002 resolution).
7. DB writes: bulk `INSERT` into `trips`, `trip_stops`, `itinerary_items` inside **one transaction**.
8. Side effect: increment `trips.copy_count` on the source trip (same transaction).
9. Response: `201` + new `TripDTO`.
10. Failure behavior: any insert failure rolls back the entire copy — never leaves a partial trip (Database PRD §16).
11. Idempotency: **not** idempotent by design (each call is a deliberate new copy); double-submission risk mitigated client-side by disabling the button after first click plus optional `Idempotency-Key` support (§15).

### 11.4 Budget Breakdown & Over-Budget Alerts (REQ-009)

1. Trigger: `GET /trips/:id/budget`.
2. Preconditions: owner.
3. DB reads: single query joining `trip_stops` + `itinerary_items` for the trip, `GROUP BY cost_category` and `GROUP BY trip_stop_id`.
4. Business rules: `isOverBudget = actual > budgeted` per stop (only when `budgeted IS NOT NULL`); `averageCostPerDay = totalActual / (trip.endDate - trip.startDate + 1)`; alerts list = stops where `isOverBudget = true`.
5. Response: `BudgetBreakdownDTO`.
6. No writes — pure read/aggregation workflow.

### 11.5 Trip Status Lifecycle Refresh (BR-003, ASSUMP-011)

Handled as a scheduled job (§18), not a per-request computation, so status is correct even for trips nobody opens:
- `draft` trips are **never** auto-transitioned (only the user moving it forward, e.g. by adding stops/publishing, or explicitly nothing in this PDF triggers draft→planned — **[ASSUMPTION]** a trip becomes `planned` the moment it has at least one `trip_stop`, checked by the same nightly job).
- `planned → ongoing`: `start_date <= today <= end_date`.
- `ongoing → completed`: `today > end_date`.
- `cancelled` is a terminal state set only by explicit user action (`PATCH /trips/:id { status: 'cancelled' }`) and is never auto-transitioned out of.

### 11.6 Account Deletion (REQ-012)

1. Trigger: `DELETE /users/me`.
2. Preconditions: authenticated; correct password re-entered.
3. Validation: password matches.
4. Business rules: soft-delete `users` row (`deleted_at = now()`), revoke all `refresh_tokens`, soft-delete all owned `trips` (cascading soft-delete — **[ARCH-035]** implemented as an explicit `UPDATE trips SET deleted_at = now() WHERE user_id = :id AND deleted_at IS NULL` in the same transaction, not a DB cascade, because soft-delete cannot be expressed as an `ON DELETE CASCADE` FK action).
5. DB writes: all in one transaction.
6. Response: `204`.
7. Failure: password mismatch → `401`.

---

## 12. State Machines

### 12.1 Trip status (`trips.status`)

```
States: draft, planned, ongoing, completed, cancelled

Allowed transitions:
draft     → planned    (system, on first stop added — §11.5)
draft     → cancelled  (user)
planned   → ongoing    (system, start_date reached)
planned   → cancelled  (user)
ongoing   → completed  (system, end_date passed)
ongoing   → cancelled  (user, with confirmation — trip already underway)

Forbidden transitions:
completed → (any)      — terminal
cancelled → (any)      — terminal
ongoing   → planned    — no going backward
completed → ongoing    — no going backward

Transition requirements:
draft → planned requires >= 1 trip_stop row to exist
any → cancelled requires the requester to be the trip owner

Side effects:
→ cancelled: no cascading side effects beyond the status write itself (itinerary data is preserved, not deleted)
→ completed: eligible for inclusion in community "previous trips" prompts (no automatic post creation — user-initiated only)
```

### 12.2 Public sharing state (`trips.is_public` + `share_token`)

```
States: private (is_public=false, share_token=NULL), public (is_public=true, share_token=<value>)

Transitions:
private → public   (POST /trips/:id/share)  — generates token
public  → private  (DELETE /trips/:id/share) — [ARCH-036] token is cleared (NULL), not reused if re-published, so an old shared link never silently resurrects
public  → public   (re-POST /trips/:id/share while already public) — no-op, returns existing token unchanged
```

### 12.3 Community like (`community_likes` existence)

```
States: not-liked, liked

Transitions:
not-liked → liked      (POST .../like)   — idempotent: if already liked, return current state as success, no error
liked     → not-liked  (DELETE .../like) — idempotent: if not liked, return current state as success, no error
```

---

## 13. External Integrations

**Email delivery (transactional):** used for verification emails, password-reset emails. **[ARCH-037]** Provider-agnostic adapter interface (`EmailSender.send({to, template, data})`); a concrete provider (e.g. any SMTP-compatible or transactional-email API) is selected at deployment time via configuration, not hard-coded — the PDF does not mandate a specific provider.
- Timeout: 5s per send attempt.
- Retry: 3 attempts with exponential backoff, executed inside the background job (§18), never inline in the HTTP request path (email sending must never block registration/password-reset responses).
- Failure behavior: after exhausting retries, log + move to dead-letter (job marked `failed`, visible to admins via job-status inspection); the user-facing action (registration, reset-request) has already succeeded regardless — email delivery failure does not roll back the account/token creation.
- Caching: N/A.
- Observability: log send attempts, provider response status, latency; never log the full email body/recipient PII beyond a hashed identifier in metrics.

**Media/photo storage:** used for `photoUrl`/`coverPhotoUrl`/community attachments (§19). **[ARCH-038]** S3-compatible object storage adapter behind an interface, provider chosen at deploy time (not mandated by the PDF).

**No other third-party API is required by the PDF.** Catalog data (`cities`/`activities`) is treated as internally-curated per ASSUMP-002; the `external_source`/`external_ref_id` columns exist purely to allow a future sync job to be added without a schema change — **not implemented in this version** and no external travel-data API is called.

---

## 14. Error Handling

**Error envelope (uniform across all endpoints):**

```json
{
  "error": {
    "code": "TRIP_NOT_FOUND",
    "message": "The requested trip could not be found.",
    "details": null
  }
}
```

| Category | HTTP | Example codes |
|---|---|---|
| Validation | 400 | `VALIDATION_ERROR`, `STOP_DATES_OUTSIDE_TRIP_RANGE`, `ITEM_DATE_OUTSIDE_STOP_RANGE` |
| Authentication | 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN`, `INVALID_PASSWORD` |
| Authorization | 403 | `FORBIDDEN`, `ACCOUNT_SUSPENDED`, `CANNOT_MODIFY_ADMIN` |
| Not found | 404 | `TRIP_NOT_FOUND`, `CITY_NOT_FOUND`, `ACTIVITY_NOT_FOUND`, `USER_NOT_FOUND` |
| Conflict | 409 | `USERNAME_TAKEN`, `EMAIL_TAKEN`, `LOCK_VERSION_MISMATCH`, `ALREADY_SAVED` |
| Rate limit | 429 | `RATE_LIMITED` |
| Locked | 423 | `ACCOUNT_LOCKED` |
| Server | 500 | `INTERNAL_ERROR` (generic; never leaks stack traces, SQL text, or internal file paths to the client) |

**Rules:**
- Postgres constraint-violation errors are caught at the repository boundary and translated to the codes above (unique_violation → `409`, check_violation → `400`, foreign_key_violation → `400 INVALID_REFERENCE`), never surfaced raw.
- All 500-level errors are logged server-side with a `correlationId` (also returned in the response for support purposes) but the client never sees internals.
- Unexpected/unhandled exceptions are caught by a top-level Express error middleware, always converted to the envelope above.

---

## 15. Idempotency

| Operation | Risk if duplicated | Strategy |
|---|---|---|
| `saveDestination` | Duplicate save | DB unique constraint (`uq_saved_destinations_user_city`) → backend catches `23505` and returns `201`-equivalent success (or `200` "already saved") instead of an error — genuinely idempotent |
| `like` / `unlike` | Duplicate like row | DB unique constraint + idempotent toggle response (§12.3) |
| `POST /trips`, `POST /trips/:id/stops`, `POST .../items` | Duplicate resource on client retry | **[ARCH-039]** Optional `Idempotency-Key` request header: backend stores `(userId, idempotencyKey) → responsePayload` for 24h (small dedicated table or the job-queue's Postgres store) and replays the stored response on a repeated key instead of re-executing; if the header is absent, the operation proceeds normally (not idempotent) — this keeps the common case simple while offering safety for clients that want it |
| `POST /public/trips/:token/copy` | Duplicate copy | Same `Idempotency-Key` mechanism as above; without the header, duplicate copies are accepted as legitimate (a user may intentionally copy twice) |
| Webhooks | N/A — no inbound webhooks in this system (no payment/external-write-back integration in scope) | Not applicable |
| Background jobs (§18) | Duplicate side effects (e.g. double-sending an email) | Each job is keyed by a natural idempotency key (e.g. `email_verification:{userId}:{tokenId}`) recorded by the job queue; retries of the same job id do not re-enqueue |

---

## 16. Transactions & Consistency

Restates Database PRD §16 from the backend's perspective — every use case in §11 explicitly opens exactly one DB transaction per write operation (via the query-builder's transaction API), never spans an HTTP-request-external resource (e.g. never holds a DB transaction open while awaiting an email-send call — email sending is deferred to an async job precisely so it never sits inside a DB transaction).

**Must be atomic:** create trip, add/edit/delete stop, add/edit/delete item, reorder stops, copy trip, account deletion, publish/unpublish.

**Can be eventually consistent:** `trips.view_count` increment on public view (fire-and-forget, tolerable to lose an increment under a crash — **[ARCH-040]**), popularity-event-driven `popularity_score` recomputation (nightly batch, §18), analytics aggregates (computed on read from event tables, always slightly-lagging by definition of "this month so far" but never stale by more than the query's own execution time — no separate caching layer needed at this scale).

**Must happen after commit:** email sending (job enqueued after the registration/reset transaction commits, using a transactional-outbox-lite pattern — **[ARCH-041]** the job is enqueued via `pg-boss` inside the *same* transaction as the DB write, since `pg-boss` itself is Postgres-backed, giving true at-least-once delivery without a separate outbox table).

**Must be retried:** email send job (3x, §13), popularity-score recompute job (next scheduled run naturally retries).

**Must not be retried automatically:** account deletion (destructive; a failed attempt surfaces an error to the user rather than silently retrying), copy-trip without an idempotency key (retrying blindly could create unwanted duplicates — left to explicit user action).

---

## 17. Events

**[ARCH-042]** GlobeTrotter does not need a general-purpose event bus — the only "event-like" behaviors are:
1. DB-level trigger-recorded popularity events (Database PRD §11) — not application-level events at all, intentionally kept in the database to guarantee they fire regardless of code path.
2. Job-queue messages (§18), which are the closest analog to events but are consumed by exactly one worker each (point-to-point jobs, not broadcast pub/sub).

No `EventEmitter`/message-bus abstraction is introduced in the application layer, since introducing one here would add indirection without a corresponding requirement (avoiding unjustified event-driven architecture per the prompt's own guidance).

---

## 18. Background Jobs & Scheduled Tasks

| Job | Trigger | Schedule | Input | Work | DB effects | Retry | Failure behavior |
|---|---|---|---|---|---|---|---|
| `send-verification-email` | enqueued on registration | immediate (queued) | `userId`, `tokenId` | render + send email | none | 3x exponential backoff | dead-letter after 3 failures, logged, user can request re-send |
| `send-password-reset-email` | enqueued on forgot-password | immediate | `userId`, `tokenId` | render + send email | none | 3x | same as above |
| `refresh-trip-statuses` | scheduled | nightly, 00:10 UTC | none | evaluate every non-cancelled, non-completed, non-deleted trip's dates and update `status` per §12.1 | bulk `UPDATE trips` | re-run next night naturally corrects any missed trip | logged; a missed run just delays a status flip by up to 24h, non-critical |
| `recompute-popularity-scores` | scheduled | nightly, 00:30 UTC | none | aggregate `city_popularity_events`/`activity_popularity_events` over a trailing 90-day window into `cities.popularity_score`/`activities.popularity_score` | bulk `UPDATE cities`, `UPDATE activities` | next scheduled run | logged; stale popularity for one extra day is acceptable |
| `cleanup-expired-tokens` | scheduled | daily, 02:00 UTC | none | delete expired `password_reset_tokens`, `email_verification_tokens`, `refresh_tokens` past retention | `DELETE` | next run | non-critical, purely hygienic |
| `purge-soft-deleted-records` | scheduled | daily, 02:30 UTC | none | hard-delete `users`/`trips`/`community_posts`/`community_comments` past the retention window defined in Database PRD §14 (ARCH-018) | `DELETE` | next run | logged; delay is acceptable, never silently skips without logging a count |

All scheduled jobs are implemented via the same `pg-boss`-backed queue (ARCH-024) using its cron-like scheduling API, keeping a single operational mechanism for both "run once soon" and "run on a schedule" jobs.

---

## 19. File / Media Handling

**Applies to:** `users.photo_url`, `trips.cover_photo_url`, `community_posts.attachment_urls`, `activities.image_url`/`cities.image_url` (admin-managed, not user-uploaded).

- **Upload flow:** client requests a pre-signed upload URL (`POST /media/upload-url { contentType, purpose }`) → backend validates `contentType` against an allow-list and returns a short-lived signed PUT URL to object storage → client uploads directly to storage → client submits the resulting public/object URL as `photoUrl`/`coverPhotoUrl`/etc. on the relevant resource endpoint. **[ARCH-043]** Direct-to-storage upload avoids proxying large binaries through the API server.
- **Validation:** MIME allow-list `image/jpeg`, `image/png`, `image/webp`; max size 5 MB (profile/cover photos), 10 MB per community attachment, max 4 attachments per post.
- **Storage:** S3-compatible bucket, private-by-default with public-read only for the specific object once confirmed attached (or a CDN-fronted public bucket for simplicity — **[ARCH-044]** given no sensitive-content requirement on these images, a public-read bucket with unguessable object keys is acceptable and simpler than signed-URL-on-read).
- **Access control:** upload URLs are single-use, expire in 5 minutes, scoped to the requesting user's namespace within the bucket key (`{userId}/{uuid}.{ext}`).
- **Deletion:** when a `photoUrl`/`coverPhotoUrl` is replaced or the parent record is deleted, the old object is scheduled for deletion via a background job (not synchronous, to avoid coupling the API request to storage-provider latency).
- **Metadata:** original filename is not persisted (only the generated object key/URL) to avoid leaking local filesystem info.

---

## 20. Search

**Searchable entities:** `cities` (REQ-007), `activities` (REQ-008), `community_posts` (UI-010).

- **Searchable fields:** cities — `name`, `country`, `region` (via `search_vector`); activities — `name`, `description` (via `search_vector`); community posts — `content`.
- **Filtering:** cities by `country`/`region`; activities by `category`/cost range/duration range; community posts by `tripId`/`userId`.
- **Ranking:** Postgres `ts_rank` against the query's `plainto_tsquery`, combined with a secondary sort on `popularity_score DESC` as a tiebreaker for catalog search (so equally-relevant results favor well-known destinations).
- **Pagination:** offset-based for catalog (bounded result sets, §21), cursor-based for community feed.
- **PostgreSQL search chosen over an external engine** per Database PRD ARCH-007 — no typo-tolerance/fuzzy matching is implemented in v1 (`pg_trgm` trigram similarity is a documented, low-effort future enhancement if search quality proves insufficient, but is not required by the PDF and is therefore not built now).

---

## 21. Pagination / Filtering / Sorting

| Endpoint family | Mechanism | Default page size | Max page size | Sort fields |
|---|---|---|---|---|
| `GET /trips` | offset | 20 | 50 | `startDate`, `createdAt`, `updatedAt` |
| `GET /cities`, `GET /activities` | offset | 20 | 50 | `popularity` (default), `name`, `costIndex`/`cost` |
| `GET /community/posts` | **cursor** (`created_at` + `id` composite cursor, base64-encoded) | 20 | 50 | fixed: `createdAt DESC` (feed is always reverse-chronological) |
| `GET /admin/users` | offset | 25 | 100 | `createdAt`, `username` |

All list responses use stable sorting (a secondary tiebreaker on `id` is always appended server-side to every `ORDER BY` to guarantee deterministic pagination even when the primary sort key has ties).

---

## 22. Observability

- **Structured logging:** JSON logs with `timestamp`, `level`, `correlationId`, `userId` (if authenticated), `route`, `durationMs`.
- **Request/correlation IDs:** every inbound request gets a `correlationId` (from an incoming `X-Correlation-Id` header if present, else generated), propagated through all logs and background jobs enqueued from that request, and returned in error responses.
- **Metrics:** request count/latency per route+status, DB query latency histogram, job success/failure counts, login success/failure rate, active-user counts (for admin dashboard cross-check).
- **Tracing:** not required at this scale — **[ARCH-045]** deferred; the modular monolith's single-process nature makes correlation-ID-tagged structured logs sufficient for debugging without a distributed tracing system.
- **Business metrics to track:** trips created/day, itinerary items added/day, public shares/day, copy-trip conversions, community posts/day.
- **Never logged:** passwords, password hashes, raw tokens (access/refresh/reset/verification), full request bodies for auth endpoints (log only the route + outcome, not the body).

---

## 23. Security

- **Authentication/authorization:** covered in §6/§7.
- **Input validation:** Zod schemas on every request boundary (§10); reject unknown fields (`.strict()` mode) to prevent mass-assignment surprises.
- **SQL injection:** eliminated by construction — the typed query builder (ARCH-022) always parameterizes; raw SQL string interpolation is forbidden (§26 coding-agent rule).
- **XSS:** community post `content` and any free-text fields are stored as-is (not sanitized/HTML-stripped at write time, since they are plain text, not rendered as HTML) but the **frontend** must render them as text, never `dangerouslySetInnerHTML`-equivalent, without escaping — noted here since it affects the API contract (content is plain text, not markdown/HTML).
- **CSRF:** not applicable in the classic sense — the API is a bearer-token JSON API (no cookie-based session), so CSRF (which relies on ambient cookie auth) does not apply; if a cookie-based refresh-token flow is later added, CSRF tokens would need revisiting.
- **SSRF:** `photoUrl`/`coverPhotoUrl`/`attachmentUrls` submitted by clients are validated as URLs pointing to the platform's own storage domain only (allow-list check) — the backend never fetches arbitrary user-supplied URLs server-side, eliminating SSRF risk from this vector.
- **Rate limiting:** per §8 — global 100 req/min/user, 20 req/min/IP unauthenticated, 10 req/min/IP on auth endpoints; implemented via a Postgres-backed or in-process sliding-window limiter (no Redis dependency required at this scale, consistent with ARCH-024).
- **Brute-force protection:** login lockout per §6 (ARCH-029).
- **Secrets:** never hard-coded; loaded from environment (§24); JWT signing key rotated via configuration, not code change.
- **Encryption:** passwords hashed (never encrypted/reversible); all traffic assumed to run behind TLS termination (deployment concern, not application code, but the app must never accept plaintext-HTTP-only in production config).
- **Secure headers:** standard hardening middleware (e.g. Helmet-equivalent) — `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, disabled `X-Powered-By`.
- **File upload security:** MIME/size allow-list (§19); uploaded object keys are UUID-based, never derived from user-supplied filenames (path traversal prevention).
- **Webhook verification:** N/A, no inbound webhooks.
- **Dependency security:** standard `npm audit`/lockfile discipline — a process concern for the coding agent to follow (pin versions, no `*` ranges) rather than a runtime feature.
- **Sensitive logging:** restated from §22.

---

## 24. Configuration

| Variable | Required | Example | Notes |
|---|---|---|---|
| `NODE_ENV` | yes | `production` | `development`\|`test`\|`production` |
| `PORT` | yes | `3000` | |
| `DATABASE_URL` | yes | `postgres://...` | includes credentials — never logged |
| `JWT_ACCESS_SECRET` | yes | (random 256-bit) | |
| `JWT_ACCESS_TTL_MINUTES` | no | `15` | default `15` |
| `JWT_REFRESH_TTL_DAYS` | no | `30` | default `30` |
| `PASSWORD_HASH_COST` | no | `12` | argon2id/bcrypt cost |
| `PUBLIC_APP_BASE_URL` | yes | `https://globetrotter.app` | used to build `shareUrl` |
| `EMAIL_PROVIDER_API_KEY` | yes (non-test) | — | secret |
| `EMAIL_FROM_ADDRESS` | yes | `no-reply@globetrotter.app` | |
| `OBJECT_STORAGE_BUCKET` | yes | — | |
| `OBJECT_STORAGE_ACCESS_KEY` / `SECRET` | yes | — | secret |
| `RATE_LIMIT_ENABLED` | no | `true` | disabled only in `test` |
| `LOG_LEVEL` | no | `info` | |

Configuration is loaded once at process start via a Zod schema (`config/env.ts`); the process exits immediately with a clear error if required variables are missing or malformed — never falls back to an insecure implicit default for secrets. Development/test configs use `.env.development`/`.env.test` (gitignored) with clearly fake, non-production values.

---

## 25. Testing Strategy

- **Unit tests:** domain layer state machines (§12), pure business-rule functions (budget calculation, date-range validation, sequence-order assignment logic), DTO mapping functions. No DB/HTTP involved.
- **Integration tests:** repository layer against a real (containerized/test) Postgres instance — verifies constraints from the Database PRD actually reject invalid data (e.g. attempting to insert an `itinerary_item` with a negative cost fails), verifies triggers (budget-cache refresh, counter sync) fire correctly, verifies transaction rollback behavior (§16 scenarios).
- **API tests:** every endpoint in §8 — happy path + each documented error code, using a test HTTP client against the running app with a test database.
- **End-to-end tests (critical workflows):** register → login → create trip → add stop → add item → view budget → publish → copy (as a second user) → verify the copy is independent; account deletion → verify trips disappear from listings but audit trail persists.
- **External integration tests:** email adapter and storage adapter tested against mocks/fakes in CI; optionally against a real sandbox provider in a separate, manually-triggered suite.
- **Database tests:** constraint tests (unique, check, FK cascade/restrict behavior) run as part of the integration suite (Database PRD §20 checklist), not a separate suite.

**Minimum critical test suite before "done":**
1. Auth: register/login/refresh/logout/forgot-reset happy paths + key failure modes (duplicate email, wrong password, expired token).
2. Trip CRUD + ownership enforcement (a user cannot read/edit another user's private trip).
3. Itinerary builder: add/edit/delete/reorder stop and item, including the concurrent-reorder conflict test (§17).
4. Budget breakdown correctness against a known fixture (assert exact category sums and over-budget flags).
5. Sharing: publish, public view (unauthenticated), copy (creates independent trip, verified via mutating the copy and asserting the original is unchanged).
6. Community: post/comment/like idempotency (double-like doesn't duplicate).
7. Admin: role enforcement (non-admin gets 403 on every `/admin/*` route), analytics endpoints return correctly-shaped aggregates against seeded data.
8. Account deletion cascades correctly and revokes sessions.

---

## 26. AI Coding Agent Implementation Rules

The coding agent **MUST**:
- Follow the module boundaries (§5), layering (§4), and dependency direction exactly.
- Implement every endpoint in §8 with the exact request/response contracts in §9 — no silent field renames or shape changes.
- Enforce authorization exactly as specified in §7 for every resource access, server-side, even if the frontend already restricts navigation.
- Use the query builder (ARCH-022) for all database access — never raw string-concatenated SQL.
- Wrap every multi-statement business operation in a database transaction as specified in §16.
- Implement idempotency exactly where specified in §15, using the exact mechanisms described (unique constraints, `Idempotency-Key` header), not ad hoc alternatives.
- Validate every external input (request body, query params, path params) via the schemas implied in §9/§10 before it reaches the domain layer.
- Add tests per §25 for every new business behavior introduced.
- Preserve the DTO contracts in §9 for backward compatibility — additive changes (new optional fields) are acceptable; breaking a documented field is not, without updating this document.
- Keep the Database PRD and this PRD in sync — any schema change required to support a backend feature must be reflected back into the Database PRD's migration sequence, not implemented as an undocumented ad hoc migration.

The coding agent **MUST NOT**:
- Invent product features not present in REQ-*/UI-*/BR-* or explicitly marked `[ARCHITECTURE DECISION]`/`[ASSUMPTION]` in either PRD.
- Create new database tables or columns not defined in the Database PRD without documenting the addition there first.
- Create endpoints not listed in §8 without extending this document.
- Store relational data (trips/stops/items/etc.) as JSON for convenience — this is explicitly forbidden by Database PRD §19.
- Access the database directly from a controller/route handler — all access goes through a repository called from an application/use-case layer function.
- Trust frontend-side validation as sufficient — every rule in §10 is re-checked server-side regardless of what the client already validated.
- Trust or persist unvalidated external input verbatim (e.g. a submitted `photoUrl` must be checked against the allow-listed storage domain before being saved, per §23).
- Expose internal error details (stack traces, SQL text, file paths) in any API response (§14).
- Hard-code any secret, API key, or credential in source code (§24) — all such values come from environment configuration.
- Silently weaken an authorization check "to make a test pass" or "to unblock a feature" — any such change requires updating §7 explicitly.
- Silently change a business rule (e.g. loosening `endDate >= startDate`) without marking the change as a documented `[ASSUMPTION]`/`[ARCHITECTURE DECISION]` update to this PRD.

---

## 27. Definition of Done

- [ ] **Architecture:** layered structure (§4) implemented; module boundaries (§5) respected; no cross-layer violations found in review.
- [ ] **Database integration:** repositories implemented for every module against the exact schema in the Database PRD; all migrations from Database PRD §12 applied cleanly to a fresh database.
- [ ] **Authentication:** register/login/refresh/logout/forgot-password/reset-password/email-verification all implemented and tested (§6, §25).
- [ ] **Authorization:** every endpoint in §8 enforces the rule specified in §7; verified by tests asserting 403s for non-owners/non-admins.
- [ ] **APIs:** all endpoints in §8 implemented with contracts from §9; OpenAPI/Swagger spec generated (or hand-written) matching this document exactly — **[ARCH-046]** recommended so the frontend team/agent has a machine-checkable contract.
- [ ] **Validation:** all rules in §10 implemented and covered by tests for both valid and invalid inputs.
- [ ] **Business workflows:** all workflows in §11 implemented exactly as specified, including failure/retry/idempotency behavior.
- [ ] **State machines:** trip status (§12.1) and sharing state (§12.2) transitions implemented and forbidden transitions actively rejected (not just "not offered by the UI").
- [ ] **External integrations:** email and storage adapters implemented behind the interfaces in §13/§19, with retry/failure behavior as specified.
- [ ] **Background jobs:** all jobs in §18 implemented, scheduled correctly, and independently testable by invoking their handler directly.
- [ ] **Error handling:** every error path returns the envelope in §14 with the correct HTTP status and machine-readable code; no raw internals ever leak.
- [ ] **Observability:** structured logging with correlation IDs implemented; the "never logged" list (§22) verified by a log-scrubbing test or manual audit.
- [ ] **Security:** rate limiting, login lockout, secure headers, SSRF-safe media handling, and the full checklist in §23 implemented.
- [ ] **Testing:** the minimum critical test suite in §25 passes in CI; unit/integration/API/E2E tiers all present.
- [ ] **Documentation:** this PRD and the Database PRD are the living contract; any deviation during implementation has been reflected back into both documents before being considered "done."

---

## Cross-PRD Consistency Verification

| Check | Result |
|---|---|
| Entity consistency | Every module in §5 maps to tables owned in Database PRD §6; no orphaned backend concept lacks a table, no table lacks a backend owner. |
| Field consistency | Every DTO field in §9 traces to a column in Database PRD §6 (or is explicitly computed, e.g. `destinationCount`, `isOverBudget`). |
| Relationship consistency | §7/§8 authorization and §11 workflows rely only on relationships enumerated in Database PRD §7 (e.g. trip→stops→items cascade). |
| State consistency | §12 state machines map directly to `trip_status_enum` and the `is_public`/`share_token` pair in Database PRD §6.7 — no backend-only shadow state exists. |
| Authorization consistency | Ownership checks (`user_id = currentUserId`) are enforceable because every owned table (`trips`, `trip_stops` via `trips`, `itinerary_items` via `trip_stops`, `saved_destinations`, `community_posts/comments/likes`) carries or inherits a `user_id`/`trip_id` chain back to the owner. |
| Transaction consistency | §16's atomic-operation list matches exactly the transactional operations enumerated in Database PRD §16. |
| API consistency | Every list/detail endpoint's response shape can be produced from a single query or a small fixed number of joined/batched queries against the indexes in Database PRD §9 — no endpoint requires an unindexed full scan. |
| Performance consistency | §21 pagination choices (offset vs. cursor) match Database PRD §18's stated rationale per table. |
| Lifecycle consistency | §11.6 account deletion and Database PRD §14 lifecycle table agree: soft delete + bounded retention + scheduled hard purge (ARCH-018, job in §18). |
| External integration consistency | No external service response is persisted as trusted state without validation (§13); the only "external" writes (email, storage) do not touch core domain tables. |

No contradictions were found between the two documents at the time of writing; both share the identical ID scheme (`REQ-*`, `UI-*`, `BR-*`, `ASSUMP-*`, `ARCH-*`, `OPEN-*`) so future edits can be cross-referenced unambiguously.

---

*End of Document 2.*
