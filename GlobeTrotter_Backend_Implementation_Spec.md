# GlobeTrotter — TypeScript Backend Implementation Specification

**Target:** AI Coding Agent (Claude Opus 4.6 / Gemini 3.7 Flash)
**Companion docs:** `GlobeTrotter_Database_Design_PRD.md` (Document 1), `GlobeTrotter_Backend_Logic_Design_PRD.md` (Document 2)
**Generated:** 2026-08-22

---

## Table of Contents

1. [PRD Reconciliation](#1-prd-reconciliation)
2. [Backend Architecture](#2-backend-architecture)
3. [Project Structure](#3-project-structure)
4. [Domain Modules](#4-domain-modules)
5. [Domain Entities](#5-domain-entities)
6. [Use Cases](#6-use-cases)
7. [Business Rules](#7-business-rules)
8. [State Machines](#8-state-machines)
9. [API Architecture](#9-api-architecture)
10. [Request & Response Contracts](#10-request--response-contracts)
11. [Validation](#11-validation)
12. [Authentication](#12-authentication)
13. [Authorization](#13-authorization)
14. [Repository / Data Access Layer](#14-repository--data-access-layer)
15. [Database Transactions](#15-database-transactions)
16. [Concurrency](#16-concurrency)
17. [Idempotency](#17-idempotency)
18. [External Services](#18-external-services)
19. [External API Failure Strategy](#19-external-api-failure-strategy)
20. [AI Functionality](#20-ai-functionality)
21. [Asynchronous Processing](#21-asynchronous-processing)
22. [Background Jobs](#22-background-jobs)
23. [Events](#23-events)
24. [Notifications](#24-notifications)
25. [Caching](#25-caching)
26. [Search](#26-search)
27. [Pagination](#27-pagination)
28. [Error Architecture](#28-error-architecture)
29. [Logging](#29-logging)
30. [Observability](#30-observability)
31. [Security](#31-security)
32. [Configuration](#32-configuration)
33. [TypeScript Engineering Standards](#33-typescript-engineering-standards)
34. [Dependency Rules](#34-dependency-rules)
35. [API Versioning](#35-api-versioning)
36. [Testing Strategy](#36-testing-strategy)
37. [Test Case Matrix](#37-test-case-matrix)
38. [API / Database Traceability](#38-api--database-traceability)
39. [Implementation Order](#39-implementation-order)
40. [AI Coding Agent Implementation Rules](#40-ai-coding-agent-implementation-rules)
41. [Final Backend Blueprint](#41-final-backend-blueprint)
42. [Final Quality Gate](#42-final-quality-gate)

---

## 1. PRD Reconciliation

### 1.1 Product Requirement → Backend Mapping

```text
REQ-001 (Login/Signup)       → auth module → RegisterUser, LoginUser, ForgotPassword, ResetPassword
                               → users table, password_reset_tokens, email_verification_tokens, refresh_tokens
                               → POST /auth/register, POST /auth/login, POST /auth/forgot-password, etc.

REQ-002 (Dashboard/Home)     → dashboard module → GetDashboard
                               → reads trips, cities tables
                               → GET /dashboard

REQ-003 (Create Trip)        → trips module → CreateTrip
                               → trips table INSERT
                               → POST /trips

REQ-004 (My Trips list)      → trips module → ListTrips, GetTrip, UpdateTrip, DeleteTrip
                               → trips table CRUD
                               → GET/PATCH/DELETE /trips, /trips/:id

REQ-005 (Itinerary Builder)  → trip-stops module → AddStop, UpdateStop, DeleteStop, ReorderStops
                               → itinerary module → AddItem, UpdateItem, DeleteItem
                               → trip_stops, itinerary_items tables
                               → POST/PATCH/DELETE /trips/:id/stops, /trip-stops/:id/items

REQ-006 (Itinerary View)     → itinerary module → GetItinerary
                               → trip_stops + itinerary_items join query
                               → GET /trips/:id/itinerary

REQ-007 (City Search)        → catalog module → SearchCities, GetCity
                               → cities table with FTS (search_vector + GIN)
                               → GET /cities, GET /cities/:id

REQ-008 (Activity Search)    → catalog module → SearchActivities, GetActivity
                               → activities table with FTS
                               → GET /activities, GET /activities/:id

REQ-009 (Budget/Cost)        → budget module → GetBudgetBreakdown
                               → reads trips, trip_stops, itinerary_items (aggregate query)
                               → GET /trips/:id/budget

REQ-010 (Calendar/Timeline)  → calendar module → GetCalendar
                               → reads trips, trip_stops
                               → GET /trips/calendar

REQ-011 (Public Sharing)     → sharing module → PublishTrip, UnpublishTrip, GetPublicTrip, CopyTrip
                               → trips share fields + full clone for copy
                               → POST/DELETE /trips/:id/share, GET /public/trips/:token, POST /public/trips/:token/copy

REQ-012 (User Profile)       → users module → GetProfile, UpdateProfile, DeleteAccount, SavedDestinations
                               → users, saved_destinations tables
                               → GET/PATCH/DELETE /users/me, /users/me/saved-destinations

REQ-013 (Admin Dashboard)    → admin module → ListUsers, SuspendUser, Analytics
                               → reads all tables; writes users.status
                               → GET /admin/users, PATCH /admin/users/:id/status, GET /admin/analytics/*
```

### 1.2 Table Ownership Verification

| Module | Owned Tables (writes) | Read-Only Tables | External Side Effects |
|---|---|---|---|
| auth | users (INSERT on register), password_reset_tokens, email_verification_tokens, refresh_tokens, audit_log | — | Email sending (async job) |
| users | users (UPDATE profile), saved_destinations | cities (existence check) | Media deletion (async job) |
| catalog | cities, activities (admin writes only) | — | — |
| trips | trips | — | — |
| trip-stops | trip_stops | trips (ownership check), cities (FK) | — |
| itinerary | itinerary_items | trip_stops (parent), activities (FK) | — |
| budget | — (pure reads) | trips, trip_stops, itinerary_items | — |
| calendar | — (pure reads) | trips, trip_stops | — |
| sharing | trips (share fields) | trips, trip_stops, itinerary_items (for copy) | — |
| community | community_posts, community_comments, community_likes | users (author info), trips (optional link) | — |
| admin | users (status/role writes), audit_log | all tables (analytics reads) | — |
| dashboard | — (pure reads) | trips, cities | — |

**DB-trigger-maintained tables (NOT written by application code):**
- `city_popularity_events` — written by trigger on `trip_stops` INSERT and `saved_destinations` INSERT
- `activity_popularity_events` — written by trigger on `itinerary_items` INSERT
- `trips.estimated_budget_total` — maintained by trigger on `itinerary_items` changes
- `community_posts.like_count`, `comment_count` — maintained by triggers on `community_likes`, `community_comments`

### 1.3 Contradictions & Resolutions

1. **Budget and Calendar modules own no tables** but represent distinct business concerns.
   **Resolution:** They act as read-heavy aggregate modules, consuming repositories from trips/itinerary modules for computation. This is acceptable in a modular monolith.

2. **Backend PRD §8 lists `GET /trips/:id/suggestions`** which implies AI/recommendation, but the DB PRD (ASSUMP-005) states recommendations are computed from `cities.popularity_score`.
   **Resolution:** Suggestions endpoint returns popular cities/activities from the catalog, filtered by trip's existing stops' regions. No external AI/ML service required.

3. **Backend PRD mentions `POST /media/upload-url`** but it's not in the formal endpoint table.
   **Resolution:** Include as a utility endpoint under a `media` route. It generates pre-signed S3 upload URLs.

> **[BACKEND DECISION]** No contradictions were found between the two PRDs that cannot be resolved. Both documents share the same ID scheme and were designed together.

---

## 2. Backend Architecture

### 2.1 Layered Modular Monolith

```
┌─────────────────────────────────────────────────────┐
│ HTTP / Transport Layer                               │
│  - Express/Fastify routers                           │
│  - Middleware pipeline (auth, rate-limit, CORS, etc.)│
│  - Request → DTO validation (Zod .strict())          │
│  - Response shaping, HTTP status mapping             │
│  - Correlation ID injection                          │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│ Application / Use Cases Layer                        │
│  - One function per business operation               │
│  - Orchestrates domain + infrastructure              │
│  - Owns transaction boundaries                       │
│  - Receives currentUserId explicitly (ARCH-031)      │
│  - Pure orchestration: no SQL, no HTTP               │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│ Domain Layer                                         │
│  - Entities, value objects, business rules           │
│  - State machines (trip status, sharing, likes)      │
│  - Pure functions, framework-free                    │
│  - Invariant checks independent of storage           │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│ Infrastructure Layer                                 │
│  - PostgreSQL repositories (Kysely/Drizzle)          │
│  - Password hasher (argon2id)                        │
│  - JWT signer/verifier                               │
│  - Email sender adapter                              │
│  - Object storage adapter (S3)                       │
│  - Job queue (pg-boss)                               │
└──────────────────────┬──────────────────────────────┘
                       ▼
                PostgreSQL / External Services
```

### 2.2 Dependency Direction

**Strictly downward.** No upward or lateral imports across layer boundaries:

- Domain → nothing (pure, framework-free)
- Application → Domain, Infrastructure (via injection)
- Transport → Application, shared utilities
- Infrastructure → Domain (entity types), shared utilities

**Controllers NEVER issue SQL. Domain NEVER imports HTTP or database concerns.**

---

## 3. Project Structure

```
src/
  api/                          # HTTP/Transport layer
    auth/
      auth.router.ts            # Route definitions
      auth.schemas.ts           # Zod request/query schemas
    trips/
      trips.router.ts
      trips.schemas.ts
    trip-stops/
      trip-stops.router.ts
      trip-stops.schemas.ts
    itinerary/
      itinerary.router.ts
      itinerary.schemas.ts
    catalog/
      catalog.router.ts
      catalog.schemas.ts
    budget/
      budget.router.ts
    calendar/
      calendar.router.ts
      calendar.schemas.ts
    sharing/
      sharing.router.ts
    users/
      users.router.ts
      users.schemas.ts
    community/
      community.router.ts
      community.schemas.ts
    admin/
      admin.router.ts
      admin.schemas.ts
    dashboard/
      dashboard.router.ts
    media/
      media.router.ts
      media.schemas.ts
    middleware/
      auth-guard.ts             # JWT verification, inject currentUserId
      require-admin.ts          # Role check
      rate-limiter.ts           # Sliding-window rate limiting
      error-handler.ts          # Global error → HTTP response mapping
      correlation-id.ts         # X-Correlation-Id injection
      request-logger.ts         # Structured request logging
    router.ts                   # Root /api/v1 router aggregation

  application/                  # Use case functions
    auth/
      register-user.ts
      login-user.ts
      refresh-token.ts
      logout-user.ts
      forgot-password.ts
      reset-password.ts
      verify-email.ts
    users/
      get-profile.ts
      update-profile.ts
      delete-account.ts
      list-saved-destinations.ts
      save-destination.ts
      unsave-destination.ts
    catalog/
      search-cities.ts
      get-city.ts
      search-activities.ts
      get-activity.ts
    trips/
      create-trip.ts
      get-trip.ts
      list-trips.ts
      update-trip.ts
      delete-trip.ts
      get-trip-suggestions.ts
    trip-stops/
      add-stop.ts
      update-stop.ts
      delete-stop.ts
      reorder-stops.ts
    itinerary/
      add-item.ts
      update-item.ts
      delete-item.ts
      get-itinerary.ts
    budget/
      get-budget-breakdown.ts
    calendar/
      get-calendar.ts
    sharing/
      publish-trip.ts
      unpublish-trip.ts
      get-public-trip.ts
      copy-trip.ts
    community/
      create-post.ts
      list-feed.ts
      delete-post.ts
      add-comment.ts
      like-post.ts
      unlike-post.ts
    admin/
      list-users.ts
      update-user-status.ts
      get-popular-cities.ts
      get-popular-activities.ts
      get-user-trends.ts
    dashboard/
      get-dashboard.ts
    media/
      get-upload-url.ts

  domain/                       # Pure business logic
    entities/
      user.ts
      trip.ts
      trip-stop.ts
      itinerary-item.ts
      city.ts
      activity.ts
      community-post.ts
      community-comment.ts
    value-objects/
      community-like.ts
      saved-destination.ts
      money.ts
      date-range.ts
      share-token.ts
    rules/
      trip-rules.ts             # Date validation, budget calculation
      stop-rules.ts             # Sequence ordering, date-within-trip
      item-rules.ts             # Date-within-stop, XOR validation
      password-rules.ts         # Strength validation
    state-machines/
      trip-status.ts            # Status transitions
      trip-sharing.ts           # Public/private transitions
      user-status.ts            # Active/suspended/deactivated

  infrastructure/
    db/
      connection.ts             # PostgreSQL connection pool
      transaction.ts            # withTransaction helper
      repositories/
        user.repository.ts
        auth-token.repository.ts
        city.repository.ts
        activity.repository.ts
        trip.repository.ts
        trip-stop.repository.ts
        itinerary-item.repository.ts
        saved-destination.repository.ts
        community-post.repository.ts
        community-comment.repository.ts
        community-like.repository.ts
        audit-log.repository.ts
        popularity-event.repository.ts
        idempotency.repository.ts
      mappers/
        user.mapper.ts          # DB row ↔ domain entity
        trip.mapper.ts
        ...
    auth/
      password-hasher.ts        # argon2id wrapper
      jwt-service.ts            # Sign/verify JWT
      token-generator.ts        # crypto.randomBytes utility
    storage/
      storage-adapter.ts        # S3 pre-signed URL generation, delete
    email/
      email-sender.ts           # Provider-agnostic email interface
      templates/                # Email templates
    jobs/
      job-registry.ts           # pg-boss job registration
      handlers/
        send-verification-email.ts
        send-password-reset-email.ts
        refresh-trip-statuses.ts
        recompute-popularity.ts
        cleanup-expired-tokens.ts
        purge-soft-deleted.ts
        increment-view-count.ts
        delete-orphaned-media.ts

  config/
    env.ts                      # Zod-validated environment schema
    index.ts                    # Validated config export

  shared/
    errors/
      app-error.ts              # Base error class
      error-codes.ts            # All error code constants
    types/
      pagination.ts             # Pagination types
      result.ts                 # Result<T, E> type
    utils/
      decimal.ts                # decimal.js wrappers
      date.ts                   # Date utility functions
      uuid.ts                   # UUID validation
    logger.ts                   # Structured JSON logger
    correlation.ts              # AsyncLocalStorage for correlation ID

  app.ts                        # Express app setup
  server.ts                     # Server bootstrap, fail-fast config
```

### 3.1 Directory Import Rules

| Directory | May Import | Must NOT Import |
|---|---|---|
| `src/api/` | `src/application/`, `src/shared/`, `src/config/` | `src/infrastructure/`, `src/domain/` (only types via `import type`) |
| `src/application/` | `src/domain/`, `src/infrastructure/`, `src/shared/`, `src/config/` | `src/api/` |
| `src/domain/` | `src/shared/` (errors, types only) | `src/api/`, `src/application/`, `src/infrastructure/`, any framework |
| `src/infrastructure/` | `src/domain/` (entity types), `src/shared/`, `src/config/` | `src/api/`, `src/application/` |
| `src/config/` | `src/shared/` | Everything else |
| `src/shared/` | External pure utilities only | All `src/` directories |

---

## 4. Domain Modules

### 4.1 Auth Module

| Attribute | Value |
|---|---|
| **Purpose** | Identity verification, session management, credential recovery |
| **Responsibilities** | Registration, login, token issuance/rotation, password reset, email verification, session invalidation |
| **Entities owned** | None directly (creates `User` via users module collaboration) |
| **Use cases** | RegisterUser, LoginUser, RefreshToken, LogoutUser, ForgotPassword, ResetPassword, VerifyEmail |
| **Database tables** | `users` (INSERT on register, UPDATE last_login_at), `password_reset_tokens`, `email_verification_tokens`, `refresh_tokens`, `audit_log` |
| **External services** | Email sender (async, via pg-boss) |
| **Events emitted** | None (jobs enqueued instead) |
| **Events consumed** | None |
| **Background jobs** | `send-verification-email`, `send-password-reset-email` |
| **Authorization** | Mostly public; refresh requires valid token |

### 4.2 Users Module

| Attribute | Value |
|---|---|
| **Purpose** | User profile management, saved destinations |
| **Responsibilities** | View/edit profile, manage saved cities, account deletion |
| **Entities owned** | User (profile aspect), SavedDestination |
| **Use cases** | GetProfile, UpdateProfile, DeleteAccount, ListSavedDestinations, SaveDestination, UnsaveDestination |
| **Database tables** | `users`, `saved_destinations` |
| **External services** | Storage (media deletion on profile photo change) |
| **Background jobs** | `delete-orphaned-media` (when photo replaced) |
| **Authorization** | Self-only (`currentUserId` match) |

### 4.3 Catalog Module

| Attribute | Value |
|---|---|
| **Purpose** | Platform-curated destination and activity catalog |
| **Responsibilities** | Search, filter, retrieve cities and activities |
| **Entities owned** | City, Activity |
| **Use cases** | SearchCities, GetCity, SearchActivities, GetActivity |
| **Database tables** | `cities`, `activities` |
| **External services** | None |
| **Background jobs** | None |
| **Authorization** | Read: public. Write: admin only (via admin module) |

### 4.4 Trips Module

| Attribute | Value |
|---|---|
| **Purpose** | Core trip planning aggregate root |
| **Responsibilities** | Trip CRUD, status management, optimistic concurrency |
| **Entities owned** | Trip |
| **Use cases** | CreateTrip, GetTrip, ListTrips, UpdateTrip, DeleteTrip, GetTripSuggestions |
| **Database tables** | `trips` |
| **External services** | None |
| **Background jobs** | `refresh-trip-statuses` (nightly) |
| **Authorization** | Owner only (`trips.user_id = currentUserId`) |

### 4.5 Trip-Stops Module

| Attribute | Value |
|---|---|
| **Purpose** | Ordered city stops within a trip |
| **Responsibilities** | Add/update/delete/reorder stops, sequence management |
| **Entities owned** | TripStop |
| **Use cases** | AddStop, UpdateStop, DeleteStop, ReorderStops |
| **Database tables** | `trip_stops` |
| **External services** | None |
| **Background jobs** | None |
| **Authorization** | Inherited from parent trip owner |

### 4.6 Itinerary Module

| Attribute | Value |
|---|---|
| **Purpose** | Day-wise activity/transport/stay/meal line items |
| **Responsibilities** | Add/update/delete items, day-wise view |
| **Entities owned** | ItineraryItem |
| **Use cases** | AddItem, UpdateItem, DeleteItem, GetItinerary |
| **Database tables** | `itinerary_items` |
| **External services** | None |
| **Background jobs** | None |
| **Authorization** | Inherited from parent trip owner (through stop → trip chain) |

### 4.7 Budget Module

| Attribute | Value |
|---|---|
| **Purpose** | Cost aggregation and budget alerts |
| **Responsibilities** | Compute cost breakdown by category/stop, detect over-budget |
| **Entities owned** | None (pure computation) |
| **Use cases** | GetBudgetBreakdown |
| **Database tables** | Reads `trips`, `trip_stops`, `itinerary_items` |
| **Authorization** | Owner only |

### 4.8 Calendar Module

| Attribute | Value |
|---|---|
| **Purpose** | Month-grid calendar view of trips |
| **Responsibilities** | Query trips by date range for calendar rendering |
| **Entities owned** | None |
| **Use cases** | GetCalendar |
| **Database tables** | Reads `trips`, `trip_stops` |
| **Authorization** | Authenticated user (own trips only) |

### 4.9 Sharing Module

| Attribute | Value |
|---|---|
| **Purpose** | Public sharing and trip copying |
| **Responsibilities** | Publish/unpublish trips, public read-only view, deep copy |
| **Entities owned** | None (mutates Trip share fields) |
| **Use cases** | PublishTrip, UnpublishTrip, GetPublicTrip, CopyTrip |
| **Database tables** | `trips` (share fields); reads/clones `trips`, `trip_stops`, `itinerary_items` |
| **Background jobs** | `increment-view-count` (fire-and-forget) |
| **Authorization** | Publish/unpublish: owner. Public view: unauthenticated. Copy: authenticated |

### 4.10 Community Module

| Attribute | Value |
|---|---|
| **Purpose** | Social feed — posts, comments, likes |
| **Responsibilities** | CRUD posts/comments, toggle likes, feed listing |
| **Entities owned** | CommunityPost, CommunityComment, CommunityLike |
| **Use cases** | CreatePost, ListFeed, DeletePost, AddComment, LikePost, UnlikePost |
| **Database tables** | `community_posts`, `community_comments`, `community_likes` |
| **Authorization** | Create: any authenticated user. Delete: author or admin |

### 4.11 Admin Module

| Attribute | Value |
|---|---|
| **Purpose** | Platform administration and analytics |
| **Responsibilities** | User management, popularity analytics, user trends |
| **Entities owned** | None |
| **Use cases** | ListUsers, SuspendUser/ActivateUser, GetPopularCities, GetPopularActivities, GetUserTrends |
| **Database tables** | Reads all; writes `users.status`, `audit_log` |
| **Authorization** | Admin role only (ARCH-030: admin cannot suspend another admin) |

### 4.12 Dashboard Module

| Attribute | Value |
|---|---|
| **Purpose** | Personalized home screen aggregation |
| **Responsibilities** | Recent trips, recommended destinations, budget highlights |
| **Entities owned** | None |
| **Use cases** | GetDashboard |
| **Database tables** | Reads `trips`, `cities` |
| **Authorization** | Authenticated user |

---

## 5. Domain Entities

### 5.1 User (Aggregate Root)

- **Identity:** `id` (UUID)
- **Properties:**
  - `username` (string, case-insensitive, unique among non-deleted)
  - `email` (string, case-insensitive, unique among non-deleted)
  - `passwordHash` (string — NEVER exposed outside infrastructure)
  - `firstName`, `lastName` (string, required)
  - `phoneNumber`, `city`, `country`, `additionalInfo`, `photoUrl` (string | null)
  - `languagePreference` (string, default 'en')
  - `role` ('user' | 'admin')
  - `status` ('active' | 'suspended' | 'deactivated')
  - `hasVerifiedEmail` (boolean)
  - `notificationPreferences` (Record<string, unknown>)
  - `lastLoginAt` (Date | null)
  - `createdAt`, `updatedAt` (Date)
  - `deletedAt` (Date | null)
- **Invariants:**
  - Email and username must be globally unique among non-deleted users
  - Role cannot be self-escalated (only admin can change roles)
  - Email/username cannot be changed in v1 (ARCH-032)
  - Suspended/deactivated users cannot authenticate
- **Lifecycle:** Registration → Profile edits → Soft deletion (deactivation)
- **State Machine:** See §8.4 (User Status)
- **Ownership:** Self
- **Relationships:** Has many Trips, SavedDestinations, CommunityPosts, CommunityComments, CommunityLikes

### 5.2 Trip (Aggregate Root)

- **Identity:** `id` (UUID)
- **Properties:**
  - `userId` (UUID, owner — BR-001)
  - `name` (string, 1-200 chars)
  - `description`, `coverPhotoUrl` (string | null)
  - `startDate`, `endDate` (date string, YYYY-MM-DD)
  - `status` (TripStatus enum)
  - `currencyCode` (string, ISO 4217, default 'USD')
  - `estimatedBudgetTotal` (decimal string — trigger-maintained cache)
  - `primaryTimezone` (string | null, IANA)
  - `isPublic` (boolean)
  - `shareToken` (string | null)
  - `sharedAt` (Date | null)
  - `copyCount`, `viewCount` (integer)
  - `sourceTripId` (UUID | null, self-reference for copied trips)
  - `lockVersion` (integer)
  - `createdAt`, `updatedAt` (Date)
  - `deletedAt` (Date | null)
- **Invariants:**
  - Has exactly one owner; ownership cannot be transferred (BR-001)
  - `startDate <= endDate`
  - If `isPublic = true`, `shareToken` must be non-null and cryptographically random (BR-004)
  - If `isPublic = false`, `shareToken` must be null
  - Cannot transition to `planned` without at least one TripStop (BR-023)
  - `estimatedBudgetTotal` is DB-trigger-maintained — application code must NOT write to it directly
- **Lifecycle:** Creation (draft) → Planned (stops added) → Ongoing → Completed
- **State Machine:** See §8.1
- **Ownership:** Owned by User
- **Relationships:** Contains many TripStops (composition). Optional self-reference via `sourceTripId`.
- **Domain Behavior:**
  - `canTransitionTo(newStatus)`: Validates status transition
  - `publish()`: Generates share token, sets isPublic = true
  - `unpublish()`: Clears share token, sets isPublic = false

### 5.3 TripStop (Child Entity of Trip)

- **Identity:** `id` (UUID)
- **Properties:**
  - `tripId` (UUID)
  - `cityId` (UUID | null)
  - `customPlaceName` (string | null)
  - `sequenceOrder` (integer, 1-based)
  - `startDate`, `endDate` (date string)
  - `description` (string | null)
  - `budgetAmount` (decimal string | null)
  - `lockVersion` (integer)
  - `createdAt`, `updatedAt` (Date)
- **Invariants:**
  - Must belong to an existing Trip
  - Exactly one of `cityId` or `customPlaceName` must be set (XOR)
  - Stop dates should fall within trip date range (BR-002, soft-enforced: 400 on violation)
  - `startDate <= endDate`
  - `sequenceOrder` must be unique within a trip (deferrable unique constraint)
- **Lifecycle:** Creation → Updates → Hard deletion (cascades from trip or explicit)
- **Ownership:** Owned by Trip (inherits authorization from trip owner)
- **Relationships:** Contains many ItineraryItems

### 5.4 ItineraryItem (Child Entity of TripStop)

- **Identity:** `id` (UUID)
- **Properties:**
  - `tripStopId` (UUID)
  - `activityId` (UUID | null)
  - `customName` (string | null)
  - `costCategory` ('transport' | 'stay' | 'activity' | 'meal' | 'other')
  - `itemDate` (date string)
  - `startTime`, `endTime` (datetime string | null)
  - `cost` (decimal string, >= 0)
  - `currencyCode` (string)
  - `sequenceOrder` (integer)
  - `notes` (string | null)
  - `createdAt`, `updatedAt` (Date)
- **Invariants:**
  - Must belong to an existing TripStop
  - Exactly one of `activityId` or `customName` must be set (XOR)
  - `itemDate` must fall within parent stop's date range
  - `cost >= 0`
  - `endTime >= startTime` when both are provided
  - `sequenceOrder` unique within (tripStopId, itemDate)
- **Lifecycle:** Creation → Updates → Hard deletion (CASCADE from stop)
- **Ownership:** Owned by TripStop → Trip

### 5.5 City (Catalog Aggregate Root)

- **Identity:** `id` (UUID)
- **Properties:** `name`, `country`, `countryCode`, `region`, `costIndex`, `popularityScore`, `latitude`, `longitude`, `imageUrl`, `description`, `searchVector`
- **Invariants:** Read-only for non-admin users (BR-007). Name+countryCode must be unique.
- **Lifecycle:** Created by admin/seed → Updated by admin/system → Never hard-deleted while referenced (RESTRICT FK)
- **Ownership:** Platform (admin-managed)

### 5.6 Activity (Child Entity of City)

- **Identity:** `id` (UUID)
- **Properties:** `cityId`, `name`, `description`, `category`, `costEstimate`, `currencyCode`, `durationMinutes`, `popularityScore`, `imageUrl`, `searchVector`
- **Invariants:** Read-only for non-admin users. Category must be one of the allowed values. Duration > 0 when present. Cost >= 0 when present.
- **Ownership:** Platform

### 5.7 CommunityPost (Aggregate Root)

- **Identity:** `id` (UUID)
- **Properties:** `userId`, `tripId` (optional), `content` (1-5000 chars), `attachmentUrls` (JSON array), `likeCount`, `commentCount`, `searchVector`, `createdAt`, `updatedAt`, `deletedAt`
- **Invariants:** Content length 1-5000 chars. `likeCount`/`commentCount` maintained by DB triggers — application must NOT write directly.
- **Lifecycle:** Creation → Soft deletion (by author or admin)
- **Ownership:** Owned by User

### 5.8 CommunityComment (Child Entity)

- **Identity:** `id` (UUID)
- **Properties:** `postId`, `userId`, `content`, `createdAt`, `updatedAt`, `deletedAt`
- **Invariants:** Post must exist and not be soft-deleted.

### 5.9 CommunityLike (Value Object)

- **Identity:** Composite (`postId`, `userId`)
- **Invariants:** User-post pair is unique. Existence = liked state.
- **Lifecycle:** Insert (like) → Delete (unlike). Hard deletion only.

### 5.10 SavedDestination (Value Object)

- **Identity:** Composite (`userId`, `cityId`)
- **Invariants:** User-city pair is unique.
- **Lifecycle:** Insert (save) → Delete (unsave). Hard deletion only.

---

## 7. Business Rules

```
BR-001
Rule: A trip has exactly one owner (user_id). Ownership cannot be transferred.
Enforced by: Database FK (trips.user_id), application logic (user_id always from JWT, never request body)
Affected entities: Trip
Affected use cases: CreateTrip, UpdateTrip, DeleteTrip, CopyTrip
Edge cases: Copied trips set the copier as new owner (BR-005)

BR-002
Rule: A trip stop's date range must fall within the parent trip's date range.
Enforced by: Application logic (validation layer). Return 400 STOP_DATES_OUTSIDE_TRIP_RANGE on violation — never silently clamp.
Affected entities: TripStop, Trip
Affected use cases: AddStop, UpdateStop, UpdateTrip (when dates change, existing stops may become invalid)
Edge cases: Timezone boundary effects on date comparison

BR-003
Rule: Trip status is derived from dates but may be explicitly cancelled.
Enforced by: Domain logic (state machine) + scheduled background job (nightly)
Affected entities: Trip
Affected use cases: RefreshTripStatuses (job), UpdateTrip (manual cancel)
Edge cases: Trip dates changed to past while status is still 'planned'

BR-004
Rule: A public trip must have a unique, unguessable share token.
Enforced by: Application logic (crypto.randomBytes(32)), database unique constraint
Affected entities: Trip
Affected use cases: PublishTrip
Edge cases: Token collision (astronomically unlikely with 256-bit random)

BR-005
Rule: "Copy Trip" creates a brand-new trip owned by the copying user; it never mutates the original.
Enforced by: Domain logic (deep copy with new IDs)
Affected entities: Trip, TripStop, ItineraryItem
Affected use cases: CopyTrip
Edge cases: Source trip has many stops/items (performance); costs copied verbatim per OPEN-002

BR-006
Rule: Budget alerts compare summed itinerary-item costs against stop/trip budget.
Enforced by: Application logic (aggregate query in budget use case)
Affected entities: Trip, TripStop, ItineraryItem
Affected use cases: GetBudgetBreakdown
Edge cases: Mixed currencies within a trip (all compared in trip's currency_code)

BR-007
Rule: Only the platform (admin) may create cities and activities. Users can add custom itinerary items.
Enforced by: Authorization layer (requireAdmin for catalog writes), domain XOR rule for custom items
Affected entities: City, Activity, ItineraryItem
Affected use cases: Admin catalog management, AddItem (custom allowed)
Edge cases: N/A

BR-008
Rule: Authenticated detail route (/trips/:id) is owner-only. Public viewing always via /public/trips/:token.
Enforced by: Authorization middleware + separate endpoints
Affected entities: Trip
Affected use cases: GetTrip (owner only), GetPublicTrip (token-based, anyone)
Edge cases: Owner viewing their own trip via public URL (allowed, returns reduced DTO)

BR-009
Rule: Password must be minimum 8 characters with at least one letter and one digit.
Enforced by: Application logic (Zod schema + domain validation)
Affected entities: User
Affected use cases: RegisterUser, ResetPassword
Edge cases: Unicode characters counted correctly

BR-010
Rule: Trip name must be 1-200 characters.
Enforced by: Application logic (Zod schema)
Affected entities: Trip
Affected use cases: CreateTrip, UpdateTrip
Edge cases: Whitespace-only names should be rejected (use .trim().min(1))

BR-011
Rule: Community post content must be 1-5000 characters.
Enforced by: Application logic (Zod) + database CHECK constraint
Affected entities: CommunityPost
Affected use cases: CreatePost
Edge cases: Whitespace-only posts must be rejected

BR-012
Rule: Itinerary item cost must be >= 0.
Enforced by: Database CHECK constraint + application validation
Affected entities: ItineraryItem
Affected use cases: AddItem, UpdateItem
Edge cases: Zero cost for free activities is valid

BR-013
Rule: Exactly one of cityId or customPlaceName required on TripStop.
Enforced by: Database CHECK + application Zod refine
Affected entities: TripStop
Affected use cases: AddStop, UpdateStop
Edge cases: Both null or both provided → 400

BR-014
Rule: Exactly one of activityId or customName required on ItineraryItem.
Enforced by: Database CHECK + application Zod refine
Affected entities: ItineraryItem
Affected use cases: AddItem, UpdateItem
Edge cases: Both null or both provided → 400

BR-015
Rule: Share token must be cryptographically random (256-bit, base62-encoded).
Enforced by: Application logic (crypto.randomBytes(32))
Affected entities: Trip
Affected use cases: PublishTrip
Edge cases: N/A

BR-016
Rule: Admin cannot suspend another admin via the API.
Enforced by: Application logic (check target user's role before status change)
Affected entities: User
Affected use cases: SuspendUser
Edge cases: Superuser operations via direct DB only

BR-017
Rule: Account deletion requires password re-authentication.
Enforced by: Application logic (verify password before soft-delete)
Affected entities: User
Affected use cases: DeleteAccount
Edge cases: N/A

BR-018
Rule: Login lockout after 5 failed attempts in 15 minutes.
Enforced by: Application logic (count audit_log entries)
Affected entities: User, audit_log
Affected use cases: LoginUser
Edge cases: Concurrent login spamming from multiple IPs

BR-019
Rule: Stop sequence_order computed as MAX(existing)+1 with FOR UPDATE lock.
Enforced by: Database (SELECT FOR UPDATE inside transaction)
Affected entities: TripStop
Affected use cases: AddStop
Edge cases: Concurrent adds to same trip

BR-020
Rule: Item sequence_order computed as MAX(existing)+1 with FOR UPDATE lock.
Enforced by: Database (SELECT FOR UPDATE inside transaction)
Affected entities: ItineraryItem
Affected use cases: AddItem
Edge cases: Concurrent adds to same stop/day

BR-021
Rule: Public trip view increments view_count (fire-and-forget).
Enforced by: Application logic (async pg-boss job)
Affected entities: Trip
Affected use cases: GetPublicTrip
Edge cases: Lost increments on crash are acceptable (ARCH-040)

BR-022
Rule: Copy trip increments copy_count on source trip within same transaction.
Enforced by: Application logic (transactional update)
Affected entities: Trip (source)
Affected use cases: CopyTrip
Edge cases: Copying a copy increments the direct source only

BR-023
Rule: Draft → planned transition requires >= 1 trip_stop.
Enforced by: Domain logic (state machine guard)
Affected entities: Trip, TripStop
Affected use cases: RefreshTripStatuses (nightly job)
Edge cases: Last stop deleted right before transition check

BR-024
Rule: Cancelled and completed are terminal states. No transitions out.
Enforced by: Domain logic (state machine)
Affected entities: Trip
Affected use cases: UpdateTrip, RefreshTripStatuses
Edge cases: N/A

BR-025
Rule: All monetary fields transmitted as decimal strings (never JS number).
Enforced by: Application logic (DTO serialization using decimal.js)
Affected entities: Trip, TripStop, ItineraryItem, Activity
Affected use cases: All read/write operations involving money
Edge cases: Scientific notation, precision rounding

BR-026
Rule: PhotoUrl/coverPhotoUrl/attachmentUrls must be from allowed storage domain.
Enforced by: Application logic (URL domain allowlist check)
Affected entities: User, Trip, CommunityPost
Affected use cases: UpdateProfile, UpdateTrip, CreatePost
Edge cases: Subdomain variants of storage domain

BR-027
Rule: Email/username change not supported in v1.
Enforced by: Application logic (PATCH /users/me silently ignores email/username fields — ARCH-032)
Affected entities: User
Affected use cases: UpdateProfile
Edge cases: N/A

BR-028
Rule: Reorder requires complete ordered list of all stop IDs for the trip.
Enforced by: Application logic (validate array length matches DB count, all IDs belong to trip)
Affected entities: TripStop
Affected use cases: ReorderStops
Edge cases: List contains duplicates, missing IDs, or IDs from another trip
```

---

## 8. State Machines

### 8.1 Trip Status (`trips.status`)

```
States: draft, planned, ongoing, completed, cancelled

Initial state: draft

Allowed transitions:
  draft     → planned    (system: nightly job detects >= 1 stop exists)
  draft     → cancelled  (user: explicit action)
  planned   → ongoing    (system: nightly job, start_date <= today <= end_date)
  planned   → cancelled  (user: explicit action)
  ongoing   → completed  (system: nightly job, today > end_date)
  ongoing   → cancelled  (user: explicit action, trip already underway)

Forbidden transitions:
  completed → any        (terminal state — BR-024)
  cancelled → any        (terminal state — BR-024)
  ongoing   → planned    (no going backward)
  completed → ongoing    (no going backward)
  draft     → ongoing    (must plan first)
  draft     → completed  (must plan first)

Transition conditions:
  draft → planned:   COUNT(trip_stops WHERE trip_id = X) >= 1
  any → cancelled:   requester must be trip owner
  planned → ongoing: now() >= start_date AND now() <= end_date
  ongoing → completed: now() > end_date

Authorization: Owner only for manual cancellation. System (nightly job) for automatic transitions.

Side effects:
  → cancelled: status field updated only; itinerary data preserved (not deleted)
  → completed: trip eligible for "previous trips" display

Database changes: UPDATE trips SET status = :newStatus, lock_version = lock_version + 1, updated_at = now()

Failure behavior: If nightly job fails, it reruns next night. Delay is at most 24h, non-critical.
```

### 8.2 Trip Sharing State (`trips.is_public` + `share_token`)

```
States:
  private (is_public = false, share_token = NULL)
  public  (is_public = true, share_token = <value>)

Transitions:
  private → public   (POST /trips/:id/share)
    - Generate cryptographically random token (crypto.randomBytes(32), base62)
    - Set is_public = true, share_token = token, shared_at = now()

  public → private   (DELETE /trips/:id/share)
    - Set is_public = false, share_token = NULL
    - ARCH-036: Token is cleared, NOT preserved for reuse
    - Old shared URL immediately 404s

  public → public    (re-POST /trips/:id/share while already public)
    - No-op: return existing token unchanged

ARCH-036: Re-publishing after unpublishing ALWAYS generates a completely new token.
```

### 8.3 Community Like State

```
States:
  not-liked (no community_likes row for user+post)
  liked     (community_likes row exists)

Transitions:
  not-liked → liked    (POST .../like)
    - INSERT community_likes
    - DB trigger increments community_posts.like_count
    - Idempotent: if already liked, catch unique violation → return success (no error)

  liked → not-liked    (DELETE .../like)
    - DELETE community_likes WHERE post_id = X AND user_id = Y
    - DB trigger decrements community_posts.like_count
    - Idempotent: if not liked, delete affects 0 rows → return success (no error)
```

### 8.4 User Status

```
States: active, suspended, deactivated

Transitions:
  active → suspended     (admin action via PATCH /admin/users/:id/status)
    - ARCH-030: Cannot suspend another admin
    - Side effect: Revoke ALL refresh_tokens for user
    - audit_log: action = 'admin_user_suspended'

  suspended → active     (admin action)
    - Side effect: None (user must log in again to get new tokens)
    - audit_log: action = 'admin_user_activated'

  active → deactivated   (user self-action via DELETE /users/me)
    - Requires password re-authentication (BR-017)
    - Side effect: Set deleted_at, revoke all refresh_tokens, soft-delete all owned trips
    - audit_log: action = 'account_deleted'

Forbidden transitions:
  deactivated → active   (requires support intervention, out of scope)
  admin suspending another admin (BR-016)
```

---

## 6. Use Cases

### 6.1 Auth Module Use Cases

#### UC-001: RegisterUser
```
Use Case: RegisterUser
Purpose: Create a new user account and issue auth tokens

Actor: Unauthenticated user
Preconditions: None
Authentication: None
Authorization: None

Input: { username, email, password, firstName, lastName, phoneNumber?, city?, country?, additionalInfo?, photoUrl? }

Validation:
  - username: string, 3-30 chars, alphanumeric + underscores
  - email: valid email format
  - password: min 8 chars, at least one letter and one digit (BR-009)
  - firstName, lastName: string, 1-50 chars
  - photoUrl: if provided, must be from allowed storage domain (BR-026)

Business rules: BR-001, BR-009, BR-026

Database reads: None (uniqueness enforced by INSERT constraint)
Database writes:
  1. INSERT INTO users (id, username, email, password_hash, first_name, last_name, phone_number, city, country, additional_info, photo_url, role='user', status='active', has_verified_email=false)
  2. INSERT INTO email_verification_tokens (user_id, token_hash, expires_at = now()+1hr)
  3. INSERT INTO refresh_tokens (user_id, token_hash, expires_at = now()+30d)

Transaction: Single transaction wrapping user insert + token inserts + pg-boss job enqueue (ARCH-041)
External calls: None during transaction
Events: None
Notifications: Verification email (async via pg-boss job)
Async work: Enqueue 'send-verification-email' job

Success result: 201 Created → { user: PublicUserDTO, accessToken: JWT, refreshToken: string }

Possible failures:
  - 400 VALIDATION_ERROR (invalid input)
  - 409 USERNAME_TAKEN (unique constraint on username)
  - 409 EMAIL_TAKEN (unique constraint on email)

Retry behavior: Not naturally idempotent (creates duplicate user). Use Idempotency-Key for retry safety.
Idempotency: Optional Idempotency-Key header
Audit requirements: audit_log not written for registration (success is self-evident from user row)
```

#### UC-002: LoginUser
```
Use Case: LoginUser
Purpose: Authenticate user and issue JWT + refresh token

Actor: Unauthenticated user
Preconditions: User account exists
Authentication: None
Authorization: None

Input: { identifier (username or email), password }

Validation:
  - identifier: non-empty string
  - password: non-empty string

Business rules: BR-018 (lockout)

Database reads:
  1. SELECT * FROM users WHERE (username = :identifier OR email = :identifier) AND deleted_at IS NULL
  2. SELECT COUNT(*) FROM audit_log WHERE target_id = :userId AND action = 'login_failed' AND created_at > now() - interval '15 minutes'

Database writes:
  1. UPDATE users SET last_login_at = now() WHERE id = :userId (on success)
  2. INSERT INTO refresh_tokens (user_id, token_hash, device_label, expires_at)
  3. INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)

Transaction: Single transaction for writes
External calls: None
Events: None
Notifications: None
Async work: None

Success result: 200 OK → { user: PublicUserDTO, accessToken: JWT, refreshToken: string }

Possible failures:
  - 400 VALIDATION_ERROR
  - 401 INVALID_CREDENTIALS (user not found OR password mismatch — same error to prevent enumeration)
  - 403 ACCOUNT_SUSPENDED (user.status = 'suspended')
  - 423 ACCOUNT_LOCKED (5+ failed attempts in 15 min)

Retry behavior: Safe to retry
Idempotency: N/A (login is naturally idempotent in effect)
Audit requirements: audit_log: 'login_success' or 'login_failed' with IP and user agent
```

#### UC-003: RefreshToken
```
Use Case: RefreshToken
Purpose: Issue new access token using a valid refresh token (with rotation)

Actor: Client with refresh token
Authentication: Refresh token (not JWT)
Authorization: Valid, non-expired, non-revoked refresh token

Input: { refreshToken }
Database reads: SELECT FROM refresh_tokens WHERE token_hash = SHA256(:token) AND revoked_at IS NULL AND expires_at > now()
Database writes: UPDATE refresh_tokens SET revoked_at = now() (old); INSERT INTO refresh_tokens (new)
Transaction: Single transaction (rotate atomically)

Success result: 200 OK → { accessToken: JWT, refreshToken: string }
Possible failures: 401 INVALID_REFRESH_TOKEN

Retry behavior: NOT safe (token rotation means old token is revoked on first use)
Idempotency: N/A
Audit requirements: None
```

#### UC-004: LogoutUser
```
Use Case: LogoutUser
Purpose: Revoke a specific refresh token

Input: { refreshToken }
Database writes: UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = SHA256(:token)

Success result: 204 No Content
Possible failures: None (silently succeeds even if token not found)
```

#### UC-005: ForgotPassword
```
Use Case: ForgotPassword
Purpose: Generate a password reset token and send email

Input: { email }
Database reads: SELECT id FROM users WHERE email = :email AND deleted_at IS NULL
Database writes: INSERT INTO password_reset_tokens (user_id, token_hash, expires_at = now()+1hr)
Async work: Enqueue 'send-password-reset-email' job

Success result: 200 OK (ALWAYS, regardless of whether email exists — prevent enumeration)
Possible failures: None visible to client
Audit requirements: audit_log: 'password_reset_requested'
```

#### UC-006: ResetPassword
```
Use Case: ResetPassword
Purpose: Set a new password using a valid reset token

Input: { token, newPassword }
Validation: Password meets BR-009 requirements
Database reads: SELECT FROM password_reset_tokens WHERE token_hash = SHA256(:token) AND used_at IS NULL AND expires_at > now()
Database writes:
  1. UPDATE users SET password_hash = hash(:newPassword)
  2. UPDATE password_reset_tokens SET used_at = now()
  3. UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = :userId (revoke ALL sessions)
Transaction: Single transaction

Success result: 200 OK
Possible failures: 400 INVALID_OR_EXPIRED_TOKEN
Audit requirements: audit_log: 'password_reset'
```

#### UC-007: VerifyEmail
```
Use Case: VerifyEmail
Purpose: Mark user's email as verified

Input: { token }
Database reads: SELECT FROM email_verification_tokens WHERE token_hash = SHA256(:token) AND used_at IS NULL AND expires_at > now()
Database writes:
  1. UPDATE users SET has_verified_email = true
  2. UPDATE email_verification_tokens SET used_at = now()

Success result: 200 OK
Possible failures: 400 INVALID_OR_EXPIRED_TOKEN
```

### 6.2 Users Module Use Cases

#### UC-008: GetProfile
```
Use Case: GetProfile
Purpose: Return the authenticated user's full profile
Authentication: Required
Database reads: SELECT * FROM users WHERE id = :currentUserId AND deleted_at IS NULL
Success result: 200 OK → PrivateUserDTO
Possible failures: 404 USER_NOT_FOUND (shouldn't happen for authenticated user, but defensive)
```

#### UC-009: UpdateProfile
```
Use Case: UpdateProfile
Purpose: Update profile fields (silently ignores email/username per ARCH-032)
Authentication: Required
Input: { firstName?, lastName?, phoneNumber?, city?, country?, additionalInfo?, photoUrl?, languagePreference?, notificationPreferences? }
Validation: photoUrl must be from allowed storage domain (BR-026)
Database writes: UPDATE users SET ... WHERE id = :currentUserId AND deleted_at IS NULL
Success result: 200 OK → PrivateUserDTO
Possible failures: 400 VALIDATION_ERROR
Async work: If photoUrl changed and old photo existed, enqueue 'delete-orphaned-media'
```

#### UC-010: DeleteAccount
```
Use Case: DeleteAccount
Purpose: Soft-delete user account
Authentication: Required
Input: { password }
Validation: Password must match current password_hash
Database writes (single transaction):
  1. UPDATE users SET deleted_at = now(), status = 'deactivated' WHERE id = :currentUserId
  2. UPDATE trips SET deleted_at = now() WHERE user_id = :currentUserId AND deleted_at IS NULL
  3. UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = :currentUserId AND revoked_at IS NULL
Success result: 204 No Content
Possible failures: 401 INVALID_PASSWORD
Audit requirements: audit_log: 'account_deleted'
```

#### UC-011: ListSavedDestinations
```
Use Case: ListSavedDestinations
Authentication: Required
Database reads: SELECT sd.*, c.* FROM saved_destinations sd JOIN cities c ON sd.city_id = c.id WHERE sd.user_id = :currentUserId
Success result: 200 OK → { items: CityDTO[] }
```

#### UC-012: SaveDestination
```
Use Case: SaveDestination
Authentication: Required
Input: { cityId }
Database reads: SELECT 1 FROM cities WHERE id = :cityId (existence check)
Database writes: INSERT INTO saved_destinations (user_id, city_id)
Success result: 201 Created
Possible failures: 404 CITY_NOT_FOUND, 409 ALREADY_SAVED (catch unique constraint violation → return success for idempotency)
```

#### UC-013: UnsaveDestination
```
Use Case: UnsaveDestination
Authentication: Required
Path params: cityId
Database writes: DELETE FROM saved_destinations WHERE user_id = :currentUserId AND city_id = :cityId
Success result: 204 No Content
```

### 6.3 Catalog Module Use Cases

#### UC-014: SearchCities
```
Use Case: SearchCities
Authentication: Optional (public)
Input (query): q?, country?, region?, sortBy? (popularity|name|costIndex), page?, pageSize?
Database reads: SELECT FROM cities WHERE (search_vector @@ plainto_tsquery(:q) if q provided) AND (country_code = :country if provided) AND (region = :region if provided) ORDER BY :sortBy, id LIMIT :pageSize OFFSET :offset
Success result: 200 OK → PaginatedResponse<CityDTO>
```

#### UC-015: GetCity
```
Database reads: SELECT FROM cities WHERE id = :id
Success result: 200 OK → CityDTO
Possible failures: 404 CITY_NOT_FOUND
```

#### UC-016: SearchActivities
```
Input (query): cityId?, q?, category?, minCost?, maxCost?, minDuration?, maxDuration?, sortBy? (popularity|cost|duration), page?, pageSize?
Database reads: SELECT FROM activities WHERE ... (filtered by all provided params)
Success result: 200 OK → PaginatedResponse<ActivityDTO>
```

#### UC-017: GetActivity
```
Database reads: SELECT FROM activities WHERE id = :id
Success result: 200 OK → ActivityDTO
Possible failures: 404 ACTIVITY_NOT_FOUND
```

### 6.4 Trips Module Use Cases

#### UC-018: CreateTrip
```
Use Case: CreateTrip
Authentication: Required
Input: { name, description?, startDate, endDate, coverPhotoUrl?, currencyCode? }
Validation: endDate >= startDate; name 1-200 chars; dates valid YYYY-MM-DD
Business rules: status = 'draft', estimated_budget_total = 0, user_id from JWT
Database writes: INSERT INTO trips
Transaction: Single statement
Success result: 201 Created → TripDTO
Possible failures: 400 VALIDATION_ERROR
Idempotency: Optional Idempotency-Key
```

#### UC-019: GetTrip
```
Use Case: GetTrip
Authentication: Required, owner only (BR-008)
Database reads: SELECT t.*, ts.*, c.* FROM trips t LEFT JOIN trip_stops ts ON ts.trip_id = t.id LEFT JOIN cities c ON ts.city_id = c.id WHERE t.id = :id AND t.user_id = :currentUserId AND t.deleted_at IS NULL ORDER BY ts.sequence_order
Success result: 200 OK → TripDetailDTO (includes stops with city data)
Possible failures: 404 TRIP_NOT_FOUND, 403 FORBIDDEN
```

#### UC-020: ListTrips
```
Use Case: ListTrips
Authentication: Required
Query: status?, groupBy? (status), sortBy? (startDate|createdAt), page?, pageSize?
Database reads: SELECT FROM trips WHERE user_id = :currentUserId AND deleted_at IS NULL AND (status = :status if provided) ORDER BY :sortBy, id LIMIT :pageSize OFFSET :offset
Success result: 200 OK → PaginatedResponse<TripSummaryDTO>
```

#### UC-021: UpdateTrip
```
Use Case: UpdateTrip
Authentication: Required, owner only
Headers: If-Match: <lockVersion> (ARCH-033)
Input: { name?, description?, startDate?, endDate?, coverPhotoUrl?, status? (cancel only), currencyCode? }
Database writes: UPDATE trips SET ... WHERE id = :id AND user_id = :currentUserId AND lock_version = :expectedVersion AND deleted_at IS NULL
Validation: If status provided, validate state transition (only 'cancelled' allowed via this endpoint)
Success result: 200 OK → TripDTO
Possible failures: 400 VALIDATION_ERROR, 403 FORBIDDEN, 404 TRIP_NOT_FOUND, 409 LOCK_VERSION_MISMATCH
```

#### UC-022: DeleteTrip
```
Use Case: DeleteTrip
Authentication: Required, owner only
Database writes: UPDATE trips SET deleted_at = now() WHERE id = :id AND user_id = :currentUserId AND deleted_at IS NULL
Success result: 204 No Content
Possible failures: 404 TRIP_NOT_FOUND, 403 FORBIDDEN
```

#### UC-023: GetTripSuggestions
```
Use Case: GetTripSuggestions
Purpose: Return popular cities/activities based on trip's existing stops
Authentication: Required, owner only
Database reads:
  1. Get trip's existing stops' city regions
  2. SELECT FROM cities WHERE region IN (:regions) ORDER BY popularity_score DESC LIMIT 6
  3. SELECT FROM activities WHERE city_id IN (:existingCityIds) ORDER BY popularity_score DESC LIMIT 10
Success result: 200 OK → { cities: CityDTO[], activities: ActivityDTO[] }
```

### 6.5 Trip-Stops Module Use Cases

#### UC-024: AddStop
```
Use Case: AddStop
Authentication: Required, owner of parent trip
Input: { cityId?, customPlaceName?, startDate, endDate, description?, budgetAmount? }
Validation: XOR cityId/customPlaceName (BR-013); dates within trip range (BR-002); endDate >= startDate
Database reads:
  1. SELECT * FROM trips WHERE id = :tripId AND user_id = :currentUserId (ownership check)
  2. SELECT COALESCE(MAX(sequence_order), 0) + 1 FROM trip_stops WHERE trip_id = :tripId FOR UPDATE
Database writes: INSERT INTO trip_stops (id, trip_id, city_id, custom_place_name, sequence_order, start_date, end_date, description, budget_amount)
Transaction: Single transaction wrapping FOR UPDATE + INSERT (ARCH-034)
Success result: 201 Created → TripStopDTO
Possible failures: 400 VALIDATION_ERROR, 400 STOP_DATES_OUTSIDE_TRIP_RANGE, 403 FORBIDDEN, 404 TRIP_NOT_FOUND, 404 CITY_NOT_FOUND
```

#### UC-025: UpdateStop
```
Use Case: UpdateStop
Authentication: Required, owner of parent trip
Headers: If-Match: <lockVersion>
Input: { cityId?, customPlaceName?, startDate?, endDate?, description?, budgetAmount? }
Database writes: UPDATE trip_stops SET ... WHERE id = :stopId AND trip_id = :tripId AND lock_version = :expected
Success result: 200 OK → TripStopDTO
Possible failures: 400, 403, 404, 409 LOCK_VERSION_MISMATCH
```

#### UC-026: DeleteStop
```
Use Case: DeleteStop
Authentication: Required, owner of parent trip
Database writes (single transaction):
  1. SELECT sequence_order FROM trip_stops WHERE id = :stopId AND trip_id = :tripId
  2. DELETE FROM trip_stops WHERE id = :stopId (cascades itinerary_items via DB FK)
  3. UPDATE trip_stops SET sequence_order = sequence_order - 1 WHERE trip_id = :tripId AND sequence_order > :deleted_seq
Success result: 204 No Content
```

#### UC-027: ReorderStops
```
Use Case: ReorderStops
Authentication: Required, owner of parent trip
Input: { orderedStopIds: string[] }
Validation: Array must contain exactly all stop IDs for the trip, no duplicates (BR-028)
Database reads: SELECT id FROM trip_stops WHERE trip_id = :tripId (verify count and membership)
Database writes (single transaction):
  1. SET CONSTRAINTS uq_trip_stops_trip_sequence DEFERRED
  2. For each (stopId, newIndex): UPDATE trip_stops SET sequence_order = :newIndex WHERE id = :stopId AND trip_id = :tripId
Success result: 200 OK → TripStopDTO[]
Possible failures: 400 VALIDATION_ERROR, 403, 404, 409 CONFLICT
Idempotency: Naturally idempotent (same array produces same state)
```

### 6.6 Itinerary Module Use Cases

#### UC-028: AddItem
```
Use Case: AddItem
Authentication: Required, owner of parent trip (via stop → trip chain)
Input: { activityId?, customName?, costCategory, itemDate, startTime?, endTime?, cost, currencyCode?, notes? }
Validation: XOR activityId/customName (BR-014); itemDate within stop's date range; cost >= 0; endTime >= startTime
Database reads:
  1. SELECT ts.*, t.user_id FROM trip_stops ts JOIN trips t ON ts.trip_id = t.id WHERE ts.id = :stopId AND t.user_id = :currentUserId (ownership)
  2. SELECT COALESCE(MAX(sequence_order), 0) + 1 FROM itinerary_items WHERE trip_stop_id = :stopId AND item_date = :itemDate FOR UPDATE
Database writes: INSERT INTO itinerary_items (triggers budget cache refresh via DB trigger)
Transaction: Single transaction
Success result: 201 Created → ItineraryItemDTO
Possible failures: 400, 400 ITEM_DATE_OUTSIDE_STOP_RANGE, 403, 404
```

#### UC-029: UpdateItem
```
Authentication: Required, owner of parent trip
Input: partial fields
Database writes: UPDATE itinerary_items (triggers budget cache refresh)
Success result: 200 OK → ItineraryItemDTO
```

#### UC-030: DeleteItem
```
Authentication: Required, owner of parent trip
Database writes: DELETE FROM itinerary_items WHERE id = :itemId AND trip_stop_id = :stopId (triggers budget cache refresh)
Success result: 204 No Content
```

#### UC-031: GetItinerary
```
Use Case: GetItinerary
Authentication: Required, owner only
Query: view? (list|calendar)
Database reads: SELECT ts.*, ii.*, a.*, c.* FROM trip_stops ts JOIN itinerary_items ii ON ii.trip_stop_id = ts.id LEFT JOIN activities a ON ii.activity_id = a.id LEFT JOIN cities c ON ts.city_id = c.id WHERE ts.trip_id = :tripId ORDER BY ts.sequence_order, ii.item_date, ii.sequence_order
Success result: 200 OK → { stops: [{ stop: TripStopDTO, days: [{ date, items: ItineraryItemDTO[] }] }] }
```

### 6.7 Budget Module

#### UC-032: GetBudgetBreakdown
```
Use Case: GetBudgetBreakdown
Authentication: Required, owner only
Database reads: Single joined query: SELECT ts.id as stop_id, ts.budget_amount, ii.cost_category, SUM(ii.cost) FROM trip_stops ts LEFT JOIN itinerary_items ii ON ii.trip_stop_id = ts.id WHERE ts.trip_id = :tripId GROUP BY GROUPING SETS ((ts.id, ts.budget_amount, ii.cost_category), (ii.cost_category), ())
Success result: 200 OK → BudgetBreakdownDTO
```

### 6.8 Calendar Module

#### UC-033: GetCalendar
```
Use Case: GetCalendar
Authentication: Required
Query: month (YYYY-MM), timezone?
Database reads: SELECT id, name, start_date, end_date, status FROM trips WHERE user_id = :currentUserId AND deleted_at IS NULL AND start_date <= :monthEnd AND end_date >= :monthStart
Success result: 200 OK → { entries: CalendarEntryDTO[] }
```

### 6.9 Sharing Module

#### UC-034: PublishTrip
```
Use Case: PublishTrip
Authentication: Required, owner only
Database writes: UPDATE trips SET is_public = true, share_token = :token, shared_at = now() WHERE id = :id AND user_id = :currentUserId AND deleted_at IS NULL
(If already public, no-op — return existing token)
Success result: 200 OK → { isPublic: true, shareUrl: string, shareToken: string }
```

#### UC-035: UnpublishTrip
```
Use Case: UnpublishTrip
Database writes: UPDATE trips SET is_public = false, share_token = NULL WHERE id = :id AND user_id = :currentUserId
Success result: 200 OK → { isPublic: false }
```

#### UC-036: GetPublicTrip
```
Use Case: GetPublicTrip
Authentication: None (public)
Database reads: SELECT t.*, ts.*, ii.* FROM trips t JOIN trip_stops ts ... JOIN itinerary_items ii ... WHERE t.share_token = :token AND t.is_public = true AND t.deleted_at IS NULL
Side effect: Enqueue 'increment-view-count' job (fire-and-forget, ARCH-040)
Success result: 200 OK → PublicTripDTO (reduced fields, no budget details beyond aggregate, no owner PII beyond firstName)
Possible failures: 404 TRIP_NOT_FOUND_OR_NOT_PUBLIC
```

#### UC-037: CopyTrip
```
Use Case: CopyTrip
Authentication: Required
Database reads: Fetch source trip + all stops + all items (via share token)
Database writes (single transaction):
  1. INSERT INTO trips (new id, user_id = currentUserId, status = 'draft', is_public = false, share_token = NULL, source_trip_id = originalId, dates copied verbatim)
  2. INSERT INTO trip_stops (bulk, new IDs, mapped to new trip_id)
  3. INSERT INTO itinerary_items (bulk, new IDs, mapped to new stop IDs)
  4. UPDATE trips SET copy_count = copy_count + 1 WHERE id = :sourceId
Success result: 201 Created → TripDTO (new trip)
Possible failures: 404 TRIP_NOT_FOUND_OR_NOT_PUBLIC, 401 UNAUTHENTICATED
Idempotency: Optional Idempotency-Key (without it, duplicate copies are legitimate)
```

### 6.10 Community Module

#### UC-038: CreatePost
```
Input: { content, tripId?, attachmentUrls? }
Validation: content 1-5000 chars; max 4 attachment URLs; URLs from allowed domain
Database writes: INSERT INTO community_posts
Success result: 201 Created → CommunityPostDTO
```

#### UC-039: ListFeed
```
Query: q?, tripId?, userId?, cursor?, pageSize?
Database reads: SELECT cp.*, u.id, u.username, u.first_name, u.photo_url, EXISTS(SELECT 1 FROM community_likes cl WHERE cl.post_id = cp.id AND cl.user_id = :currentUserId) as liked_by_current_user FROM community_posts cp JOIN users u ON cp.user_id = u.id WHERE cp.deleted_at IS NULL ORDER BY cp.created_at DESC, cp.id DESC
Pagination: Cursor-based (created_at + id composite)
Success result: 200 OK → CursorPaginatedResponse<CommunityPostDTO>
```

#### UC-040: DeletePost
```
Authorization: Author OR admin
Database writes: UPDATE community_posts SET deleted_at = now() WHERE id = :id
Success result: 204 No Content
```

#### UC-041: AddComment
```
Input: { content }
Database writes: INSERT INTO community_comments (triggers comment_count increment via DB trigger)
Success result: 201 Created → CommunityCommentDTO
```

#### UC-042: LikePost
```
Database writes: INSERT INTO community_likes ON CONFLICT (post_id, user_id) DO NOTHING (triggers like_count increment)
Success result: 200 OK → { liked: true, likeCount: number }
```

#### UC-043: UnlikePost
```
Database writes: DELETE FROM community_likes WHERE post_id = :id AND user_id = :currentUserId (triggers like_count decrement)
Success result: 200 OK → { liked: false, likeCount: number }
```

### 6.11 Admin Module

#### UC-044: ListUsers
```
Authentication: Required, admin only
Query: q?, status?, role?, page?, pageSize?
Database reads: SELECT FROM users WHERE deleted_at IS NULL AND (filters) ORDER BY created_at, id
Success result: 200 OK → PaginatedResponse<AdminUserDTO>
```

#### UC-045: SuspendUser / ActivateUser
```
Authentication: Required, admin only
Input: { status: 'active' | 'suspended' }
Validation: Target user must not be admin (BR-016/ARCH-030)
Database writes:
  1. UPDATE users SET status = :status WHERE id = :targetId
  2. If suspending: UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = :targetId
  3. INSERT INTO audit_log (action: 'admin_user_suspended' or 'admin_user_activated')
Success result: 200 OK → AdminUserDTO
Possible failures: 403 CANNOT_MODIFY_ADMIN, 404 USER_NOT_FOUND
```

#### UC-046: GetPopularCities
```
Query: from?, to?, limit? (default 10)
Database reads: SELECT cpe.city_id, c.name, COUNT(*) as event_count FROM city_popularity_events cpe JOIN cities c ON cpe.city_id = c.id WHERE cpe.occurred_at BETWEEN :from AND :to GROUP BY cpe.city_id, c.name ORDER BY event_count DESC LIMIT :limit
Success result: 200 OK → { items: [{ cityId, name, eventCount }] }
```

#### UC-047: GetPopularActivities
```
Similar to UC-046 but against activity_popularity_events + activities
```

#### UC-048: GetUserTrends
```
Query: from?, to?, granularity? (day|week|month)
Database reads:
  1. Trips created over time: SELECT date_trunc(:granularity, created_at) as bucket, COUNT(*) FROM trips WHERE created_at BETWEEN :from AND :to GROUP BY bucket
  2. Active users: SELECT date_trunc(:granularity, last_login_at) as bucket, COUNT(DISTINCT id) FROM users WHERE last_login_at BETWEEN :from AND :to GROUP BY bucket
  3. Totals: SELECT COUNT(*) FROM trips/users/community_posts
Success result: 200 OK → { tripsCreatedOverTime, activeUsersOverTime, totalTrips, totalUsers, totalCommunityPosts }
```

### 6.12 Dashboard Module

#### UC-049: GetDashboard
```
Authentication: Required
Database reads:
  1. SELECT * FROM trips WHERE user_id = :currentUserId AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 5
  2. SELECT * FROM cities ORDER BY popularity_score DESC LIMIT 6
  3. SELECT SUM(estimated_budget_total) FROM trips WHERE user_id = :currentUserId AND start_date >= :yearStart AND deleted_at IS NULL
  4. SELECT COUNT(*) FROM trips t JOIN trip_stops ts ... WHERE overbudget condition
Success result: 200 OK → DashboardDTO
```

### 6.13 Media

#### UC-050: GetUploadUrl
```
Authentication: Required
Input: { contentType, purpose }
Validation: contentType in ['image/jpeg', 'image/png', 'image/webp']; purpose in ['profile', 'cover', 'attachment']
External calls: StorageAdapter.generatePresignedUploadUrl({ key: '{userId}/{uuid}.{ext}', contentType, maxSize: 5MB or 10MB based on purpose })
Success result: 200 OK → { uploadUrl: string, objectUrl: string, expiresAt: string }
```

---

## 9. API Architecture

> **Base path:** `/api/v1` | **Auth:** `Authorization: Bearer <accessToken>` where required | **All list endpoints:** support pagination per §27

### 9.1 Complete Endpoint Registry

| # | Method | Route | Auth | Module | Use Case | Success |
|---|---|---|---|---|---|---|
| 1 | POST | /api/v1/auth/register | Public | auth | RegisterUser | 201 |
| 2 | POST | /api/v1/auth/login | Public | auth | LoginUser | 200 |
| 3 | POST | /api/v1/auth/refresh | Public | auth | RefreshToken | 200 |
| 4 | POST | /api/v1/auth/logout | Optional | auth | LogoutUser | 204 |
| 5 | POST | /api/v1/auth/forgot-password | Public | auth | ForgotPassword | 200 |
| 6 | POST | /api/v1/auth/reset-password | Public | auth | ResetPassword | 200 |
| 7 | POST | /api/v1/auth/verify-email | Public | auth | VerifyEmail | 200 |
| 8 | GET | /api/v1/users/me | Required | users | GetProfile | 200 |
| 9 | PATCH | /api/v1/users/me | Required | users | UpdateProfile | 200 |
| 10 | DELETE | /api/v1/users/me | Required | users | DeleteAccount | 204 |
| 11 | GET | /api/v1/users/me/saved-destinations | Required | users | ListSavedDestinations | 200 |
| 12 | POST | /api/v1/users/me/saved-destinations | Required | users | SaveDestination | 201 |
| 13 | DELETE | /api/v1/users/me/saved-destinations/:cityId | Required | users | UnsaveDestination | 204 |
| 14 | GET | /api/v1/cities | Optional | catalog | SearchCities | 200 |
| 15 | GET | /api/v1/cities/:id | Optional | catalog | GetCity | 200 |
| 16 | GET | /api/v1/activities | Optional | catalog | SearchActivities | 200 |
| 17 | GET | /api/v1/activities/:id | Optional | catalog | GetActivity | 200 |
| 18 | POST | /api/v1/trips | Required | trips | CreateTrip | 201 |
| 19 | GET | /api/v1/trips | Required | trips | ListTrips | 200 |
| 20 | GET | /api/v1/trips/:id | Required | trips | GetTrip | 200 |
| 21 | PATCH | /api/v1/trips/:id | Required | trips | UpdateTrip | 200 |
| 22 | DELETE | /api/v1/trips/:id | Required | trips | DeleteTrip | 204 |
| 23 | GET | /api/v1/trips/:id/suggestions | Required | trips | GetTripSuggestions | 200 |
| 24 | POST | /api/v1/trips/:tripId/stops | Required | trip-stops | AddStop | 201 |
| 25 | PATCH | /api/v1/trips/:tripId/stops/:stopId | Required | trip-stops | UpdateStop | 200 |
| 26 | DELETE | /api/v1/trips/:tripId/stops/:stopId | Required | trip-stops | DeleteStop | 204 |
| 27 | PATCH | /api/v1/trips/:tripId/stops/reorder | Required | trip-stops | ReorderStops | 200 |
| 28 | POST | /api/v1/trip-stops/:stopId/items | Required | itinerary | AddItem | 201 |
| 29 | PATCH | /api/v1/trip-stops/:stopId/items/:itemId | Required | itinerary | UpdateItem | 200 |
| 30 | DELETE | /api/v1/trip-stops/:stopId/items/:itemId | Required | itinerary | DeleteItem | 204 |
| 31 | GET | /api/v1/trips/:tripId/itinerary | Required | itinerary | GetItinerary | 200 |
| 32 | GET | /api/v1/trips/:id/budget | Required | budget | GetBudgetBreakdown | 200 |
| 33 | GET | /api/v1/trips/calendar | Required | calendar | GetCalendar | 200 |
| 34 | POST | /api/v1/trips/:id/share | Required | sharing | PublishTrip | 200 |
| 35 | DELETE | /api/v1/trips/:id/share | Required | sharing | UnpublishTrip | 200 |
| 36 | GET | /api/v1/public/trips/:token | Public | sharing | GetPublicTrip | 200 |
| 37 | POST | /api/v1/public/trips/:token/copy | Required | sharing | CopyTrip | 201 |
| 38 | GET | /api/v1/community/posts | Optional | community | ListFeed | 200 |
| 39 | POST | /api/v1/community/posts | Required | community | CreatePost | 201 |
| 40 | DELETE | /api/v1/community/posts/:id | Required | community | DeletePost | 204 |
| 41 | POST | /api/v1/community/posts/:id/comments | Required | community | AddComment | 201 |
| 42 | POST | /api/v1/community/posts/:id/like | Required | community | LikePost | 200 |
| 43 | DELETE | /api/v1/community/posts/:id/like | Required | community | UnlikePost | 200 |
| 44 | GET | /api/v1/dashboard | Required | dashboard | GetDashboard | 200 |
| 45 | GET | /api/v1/admin/users | Required+Admin | admin | ListUsers | 200 |
| 46 | PATCH | /api/v1/admin/users/:id/status | Required+Admin | admin | SuspendUser | 200 |
| 47 | GET | /api/v1/admin/analytics/popular-cities | Required+Admin | admin | GetPopularCities | 200 |
| 48 | GET | /api/v1/admin/analytics/popular-activities | Required+Admin | admin | GetPopularActivities | 200 |
| 49 | GET | /api/v1/admin/analytics/trends | Required+Admin | admin | GetUserTrends | 200 |
| 50 | POST | /api/v1/media/upload-url | Required | media | GetUploadUrl | 200 |

### 9.2 Rate Limiting per Endpoint Group

| Group | Limit | Key |
|---|---|---|
| Auth (login, register, forgot-password, reset-password) | 10 req/min | per IP |
| Public endpoints (cities, activities, public trips) | 20 req/min | per IP |
| Authenticated endpoints (all others) | 100 req/min | per user ID |

---

## 10. Request & Response Contracts

### 10.1 Request DTOs (TypeScript interfaces with Zod rules)

```typescript
// ---- Auth ----
interface RegisterRequest {
  username: string;        // 3-30 chars, /^[a-zA-Z0-9_]+$/
  email: string;           // valid email
  password: string;        // min 8 chars, >=1 letter, >=1 digit
  firstName: string;       // 1-50 chars
  lastName: string;        // 1-50 chars
  phoneNumber?: string;    // optional
  city?: string;           // optional
  country?: string;        // optional, ISO-3166 alpha-2 recommended
  additionalInfo?: string; // optional
  photoUrl?: string;       // optional, must match storage domain
}

interface LoginRequest {
  identifier: string;      // username OR email
  password: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

interface LogoutRequest {
  refreshToken: string;
}

interface ForgotPasswordRequest {
  email: string;           // valid email
}

interface ResetPasswordRequest {
  token: string;
  newPassword: string;     // same rules as registration password
}

interface VerifyEmailRequest {
  token: string;
}

// ---- Users ----
interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | null;
  city?: string | null;
  country?: string | null;
  additionalInfo?: string | null;
  photoUrl?: string | null;
  languagePreference?: string;
  notificationPreferences?: Record<string, unknown>;
}

interface DeleteAccountRequest {
  password: string;        // re-authentication
}

interface SaveDestinationRequest {
  cityId: string;          // UUID
}

// ---- Trips ----
interface CreateTripRequest {
  name: string;            // 1-200 chars
  description?: string;
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD, >= startDate
  coverPhotoUrl?: string;
  currencyCode?: string;   // ISO-4217, default 'USD'
}

interface UpdateTripRequest {
  name?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string;
  coverPhotoUrl?: string | null;
  status?: 'cancelled';   // only cancellation allowed via this endpoint
  currencyCode?: string;
}

// ---- Trip Stops ----
interface CreateStopRequest {
  cityId?: string;          // XOR with customPlaceName
  customPlaceName?: string; // XOR with cityId
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  description?: string;
  budgetAmount?: string;    // decimal string
}

interface UpdateStopRequest {
  cityId?: string;
  customPlaceName?: string;
  startDate?: string;
  endDate?: string;
  description?: string | null;
  budgetAmount?: string | null;
}

interface ReorderStopsRequest {
  orderedStopIds: string[];  // complete list of all stop UUIDs in new order
}

// ---- Itinerary Items ----
interface CreateItemRequest {
  activityId?: string;       // XOR with customName
  customName?: string;       // XOR with activityId
  costCategory: 'transport' | 'stay' | 'activity' | 'meal' | 'other';
  itemDate: string;          // YYYY-MM-DD
  startTime?: string;        // ISO 8601 datetime
  endTime?: string;          // ISO 8601 datetime
  cost: string;              // decimal string, >= 0
  currencyCode?: string;     // default 'USD'
  notes?: string;
}

interface UpdateItemRequest {
  activityId?: string;
  customName?: string;
  costCategory?: 'transport' | 'stay' | 'activity' | 'meal' | 'other';
  itemDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  cost?: string;
  currencyCode?: string;
  notes?: string | null;
}

// ---- Community ----
interface CreatePostRequest {
  content: string;           // 1-5000 chars
  tripId?: string;           // optional UUID
  attachmentUrls?: string[]; // max 4, must match storage domain
}

interface CreateCommentRequest {
  content: string;           // 1-5000 chars
}

// ---- Admin ----
interface UpdateUserStatusRequest {
  status: 'active' | 'suspended';
}

// ---- Media ----
interface GetUploadUrlRequest {
  contentType: string;       // image/jpeg, image/png, image/webp
  purpose: 'profile' | 'cover' | 'attachment';
}
```

### 10.2 Response DTOs

```typescript
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
  createdAt: string;       // ISO 8601
}

interface AdminUserDTO extends PrivateUserDTO {
  status: 'active' | 'suspended' | 'deactivated';
  hasVerifiedEmail: boolean;
  lastLoginAt: string | null;
  updatedAt: string;
}

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
  startDate: string;
  endDate: string;
  status: TripStatus;
  destinationCount: number;
  estimatedBudgetTotal: string;  // decimal-as-string
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
  startTime: string | null;
  endTime: string | null;
  cost: string;
  currencyCode: string;
  sequenceOrder: number;
  notes: string | null;
}

interface BudgetBreakdownDTO {
  currencyCode: string;
  totalEstimated: string;
  totalActual: string;
  byCategory: Record<'transport' | 'stay' | 'activity' | 'meal' | 'other', string>;
  byStop: Array<{
    stopId: string;
    budgeted: string | null;
    actual: string;
    isOverBudget: boolean;
  }>;
  averageCostPerDay: string;
  overBudgetAlerts: Array<{
    stopId: string;
    budgeted: string;
    actual: string;
    overageAmount: string;
  }>;
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

interface CommunityCommentDTO {
  id: string;
  postId: string;
  author: PublicUserDTO;
  content: string;
  createdAt: string;
}

// ---- Calendar ----
interface CalendarEntryDTO {
  tripId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
}

// ---- Dashboard ----
interface DashboardDTO {
  welcomeName: string;
  recentTrips: TripSummaryDTO[];
  recommendedDestinations: CityDTO[];
  budgetHighlights: {
    totalPlannedThisYear: string;
    tripsOverBudgetCount: number;
  };
}

// ---- Auth ----
interface AuthResponseDTO {
  user: PublicUserDTO;
  accessToken: string;
  refreshToken: string;
}

// ---- Media ----
interface UploadUrlResponseDTO {
  uploadUrl: string;
  objectUrl: string;
  expiresAt: string;
}

// ---- Generic Wrappers ----
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

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown> | null;
  };
}
```

> **[CRITICAL]** All monetary fields are decimal strings, never JS `number`. Frontend handles display formatting.

---

## 11. Validation

### 11.1 Input Validation (Zod at API Boundary)

All request schemas use `.strict()` to reject unknown fields.

| Field | Rule |
|---|---|
| UUIDs (path/body) | `z.string().uuid()` |
| Passwords | `z.string().min(8).max(128).regex(/(?=.*[a-zA-Z])(?=.*\d)/)` |
| Trip names | `z.string().trim().min(1).max(200)` |
| Post content | `z.string().trim().min(1).max(5000)` |
| Emails | `z.string().trim().email()` |
| Dates | `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` |
| DateTimes | `z.string().datetime()` |
| Decimal amounts | `z.string().regex(/^\d+(\.\d{1,2})?$/)` |
| Enums (status) | `z.enum(['draft', 'planned', ...])` |
| Page | `z.coerce.number().int().min(1).default(1)` |
| PageSize | `z.coerce.number().int().min(1).max(100).default(20)` |
| XOR (cityId/customPlaceName) | `.refine(d => (d.cityId != null) !== (d.customPlaceName != null))` |

### 11.2 Business Validation (Domain/Application Layer)

- `endDate >= startDate` on trips and stops
- Stop dates within parent trip date range (return 400, not clamp)
- Item date within parent stop date range
- `endTime >= startTime` when both provided
- Cost >= 0
- Status transition validity per state machine
- Lock version match for optimistic concurrency
- PhotoUrl domain allowlist check
- Attachment count <= 4 per post

### 11.3 Database Integrity to Error Code Mapping

| Postgres Code | Meaning | Mapped Error | HTTP |
|---|---|---|---|
| 23505 | unique_violation | Context-dependent: USERNAME_TAKEN, EMAIL_TAKEN, ALREADY_SAVED | 409 |
| 23503 | foreign_key_violation | INVALID_REFERENCE | 400 |
| 23514 | check_violation | VALIDATION_ERROR | 400 |

---

## 12. Authentication

### 12.1 Registration Flow

1. Validate input (Zod schema)
2. Hash password with argon2id (cost >= 12, memory >= 65536 KiB, parallelism >= 4)
3. Generate email verification token: `crypto.randomBytes(32).toString('hex')`
4. Generate refresh token: `crypto.randomBytes(32).toString('hex')`
5. In single transaction:
   - INSERT user row
   - INSERT email_verification_tokens (token_hash = SHA256(rawToken), expires_at = now() + 1hr)
   - INSERT refresh_tokens (token_hash = SHA256(rawRefreshToken), expires_at = now() + 30d)
   - Enqueue pg-boss job: `send-verification-email`
6. Sign JWT access token: `{ sub: userId, role: 'user', iat, exp: now() + 15min }`
7. Return { user, accessToken, refreshToken }

### 12.2 Login Flow

1. Lookup user by username OR email (case-insensitive via citext): `WHERE (username = :id OR email = :id) AND deleted_at IS NULL`
2. If not found: 401 INVALID_CREDENTIALS (generic)
3. Check user.status: if 'suspended': 403 ACCOUNT_SUSPENDED
4. Check lockout: `SELECT COUNT(*) FROM audit_log WHERE target_id = :userId AND action = 'login_failed' AND created_at > now() - interval '15 minutes'` — if >= 5: 423 ACCOUNT_LOCKED
5. Verify password with argon2id.verify
6. On failure: INSERT audit_log (action: 'login_failed'), return 401 INVALID_CREDENTIALS
7. On success: UPDATE users SET last_login_at = now(), INSERT audit_log (action: 'login_success'), issue tokens

### 12.3 Token Architecture

- **Access Token:** JWT, HS256, 15-min TTL. Payload: `{ sub: userId, role: userRole, iat, exp }`
- **Refresh Token:** Opaque hex string (`crypto.randomBytes(32)`), stored as SHA-256 hash in `refresh_tokens`, 30-day TTL
- **Token Refresh (ARCH-028):** Validate hash + expiry + `revoked_at IS NULL` then issue new access token then rotate: revoke old refresh token, issue new one
- **Logout:** Set `revoked_at = now()` on the presented refresh token

### 12.4 Password Reset

- **Request:** Always return 200 (prevent enumeration). If email exists: generate token, enqueue email job.
- **Reset:** Validate token hash + expiry + unused. Update password_hash. Mark token used. Revoke ALL refresh tokens. Write audit_log.

### 12.5 Session Invalidation Triggers

| Event | Action |
|---|---|
| Account deletion | Revoke all user's refresh tokens |
| Password reset | Revoke all user's refresh tokens |
| Admin suspend | Revoke all suspended user's refresh tokens |

---

## 13. Authorization

### 13.1 Permissions Matrix

| Endpoint | Auth | Role | Additional Check |
|---|---|---|---|
| POST /auth/register | None | Any | — |
| POST /auth/login | None | Any | Not suspended/locked |
| POST /auth/refresh | None | Any | Valid refresh token |
| POST /auth/logout | None | Any | Valid refresh token |
| POST /auth/forgot-password | None | Any | — |
| POST /auth/reset-password | None | Any | Valid reset token |
| POST /auth/verify-email | None | Any | Valid verification token |
| GET /users/me | Required | user, admin | — |
| PATCH /users/me | Required | user, admin | Ignores email/username |
| DELETE /users/me | Required | user, admin | Password re-auth |
| GET /users/me/saved-destinations | Required | user, admin | — |
| POST /users/me/saved-destinations | Required | user, admin | — |
| DELETE /users/me/saved-destinations/:cityId | Required | user, admin | — |
| GET /cities, /cities/:id | Optional | Any | — |
| GET /activities, /activities/:id | Optional | Any | — |
| POST /trips | Required | user, admin | — |
| GET /trips | Required | user, admin | Returns own trips only |
| GET /trips/:id | Required | user, admin | Owner only (BR-008) |
| PATCH /trips/:id | Required | user, admin | Owner only |
| DELETE /trips/:id | Required | user, admin | Owner only |
| GET /trips/:id/suggestions | Required | user, admin | Owner only |
| POST /trips/:tripId/stops | Required | user, admin | Owner of trip |
| PATCH /trips/:tripId/stops/:stopId | Required | user, admin | Owner of trip |
| DELETE /trips/:tripId/stops/:stopId | Required | user, admin | Owner of trip |
| PATCH /trips/:tripId/stops/reorder | Required | user, admin | Owner of trip |
| POST /trip-stops/:stopId/items | Required | user, admin | Owner of trip (via stop) |
| PATCH /trip-stops/:stopId/items/:itemId | Required | user, admin | Owner of trip (via stop) |
| DELETE /trip-stops/:stopId/items/:itemId | Required | user, admin | Owner of trip (via stop) |
| GET /trips/:tripId/itinerary | Required | user, admin | Owner of trip |
| GET /trips/:id/budget | Required | user, admin | Owner of trip |
| GET /trips/calendar | Required | user, admin | Own trips only |
| POST /trips/:id/share | Required | user, admin | Owner of trip |
| DELETE /trips/:id/share | Required | user, admin | Owner of trip |
| GET /public/trips/:token | None | Any | — |
| POST /public/trips/:token/copy | Required | user, admin | Any authenticated |
| GET /community/posts | Optional | Any | — |
| POST /community/posts | Required | user, admin | — |
| DELETE /community/posts/:id | Required | user, admin | Author OR admin |
| POST /community/posts/:id/comments | Required | user, admin | — |
| POST /community/posts/:id/like | Required | user, admin | — |
| DELETE /community/posts/:id/like | Required | user, admin | Own like only |
| GET /dashboard | Required | user, admin | — |
| GET /admin/users | Required | admin | — |
| PATCH /admin/users/:id/status | Required | admin | Target not admin (ARCH-030) |
| GET /admin/analytics/* | Required | admin | — |
| POST /media/upload-url | Required | user, admin | — |

### 13.2 Enforcement Pattern

1. **Middleware `requireAuth`:** Parse JWT, verify signature + expiry, check user not deleted/suspended, set `req.currentUserId` and `req.userRole`
2. **Middleware `requireAdmin`:** Assert `req.userRole === 'admin'`
3. **Use case level:** `currentUserId` passed explicitly (ARCH-031). Ownership check before any write.
4. **Repository level:** All owned-resource queries include `WHERE user_id = :currentUserId` (ARCH-017)

---

## 14. Repository / Data Access Layer

### 14.1 Repository Interfaces

```typescript
// ---- UserRepository ----
interface UserRepository {
  create(data: CreateUserData, tx?: Tx): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByUsernameOrEmail(identifier: string): Promise<User | null>;
  update(id: string, data: Partial<UserUpdateData>, tx?: Tx): Promise<User>;
  softDelete(id: string, tx?: Tx): Promise<void>;
  softDeleteAllTrips(userId: string, tx?: Tx): Promise<void>;
  findAllPaginated(filters: UserFilters): Promise<Paginated<User>>;
}

// ---- AuthTokenRepository ----
interface AuthTokenRepository {
  createRefreshToken(data: { userId: string; tokenHash: string; deviceLabel?: string; expiresAt: Date }, tx?: Tx): Promise<void>;
  findRefreshTokenByHash(hash: string): Promise<RefreshToken | null>;
  revokeRefreshToken(hash: string, tx?: Tx): Promise<void>;
  revokeAllUserRefreshTokens(userId: string, tx?: Tx): Promise<void>;
  createPasswordResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }, tx?: Tx): Promise<void>;
  findValidPasswordResetToken(hash: string): Promise<PasswordResetToken | null>;
  markPasswordResetTokenUsed(id: string, tx?: Tx): Promise<void>;
  createEmailVerificationToken(data: { userId: string; tokenHash: string; expiresAt: Date }, tx?: Tx): Promise<void>;
  findValidEmailVerificationToken(hash: string): Promise<EmailVerificationToken | null>;
  markEmailVerificationTokenUsed(id: string, tx?: Tx): Promise<void>;
  deleteExpiredTokens(): Promise<number>;
}

// ---- TripRepository ----
interface TripRepository {
  create(data: CreateTripData, tx?: Tx): Promise<Trip>;
  findByIdAndOwner(id: string, userId: string): Promise<Trip | null>;
  findByShareToken(token: string): Promise<Trip | null>;
  findAllByUser(userId: string, filters: TripFilters): Promise<Paginated<Trip>>;
  update(id: string, userId: string, data: Partial<TripUpdateData>, expectedVersion: number, tx?: Tx): Promise<Trip>;
  softDelete(id: string, userId: string, tx?: Tx): Promise<void>;
  incrementCopyCount(id: string, tx?: Tx): Promise<void>;
  incrementViewCount(id: string): Promise<void>;
  findTripsForCalendar(userId: string, monthStart: string, monthEnd: string): Promise<CalendarEntry[]>;
  findRecentByUser(userId: string, limit: number): Promise<Trip[]>;
  bulkUpdateStatuses(updates: Array<{ id: string; status: TripStatus }>): Promise<void>;
}

// ---- TripStopRepository ----
interface TripStopRepository {
  create(data: CreateStopData, tx?: Tx): Promise<TripStop>;
  findByTripId(tripId: string): Promise<TripStop[]>;
  findById(id: string, tripId: string): Promise<TripStop | null>;
  update(id: string, tripId: string, data: Partial<StopUpdateData>, expectedVersion: number, tx?: Tx): Promise<TripStop>;
  delete(id: string, tripId: string, tx?: Tx): Promise<{ deletedSequence: number }>;
  resequenceAfterDelete(tripId: string, deletedSequence: number, tx?: Tx): Promise<void>;
  bulkUpdateSequence(updates: Array<{ id: string; sequenceOrder: number }>, tripId: string, tx?: Tx): Promise<void>;
  getNextSequenceOrder(tripId: string, tx?: Tx): Promise<number>;
  countByTripId(tripId: string): Promise<number>;
  bulkCreate(stops: CreateStopData[], tx?: Tx): Promise<TripStop[]>;
}

// ---- ItineraryItemRepository ----
interface ItineraryItemRepository {
  create(data: CreateItemData, tx?: Tx): Promise<ItineraryItem>;
  findByStopId(stopId: string): Promise<ItineraryItem[]>;
  findByTripId(tripId: string): Promise<ItineraryItem[]>;
  update(id: string, stopId: string, data: Partial<ItemUpdateData>, tx?: Tx): Promise<ItineraryItem>;
  delete(id: string, stopId: string, tx?: Tx): Promise<void>;
  getNextSequenceOrder(stopId: string, itemDate: string, tx?: Tx): Promise<number>;
  getBudgetAggregates(tripId: string): Promise<BudgetAggregates>;
  bulkCreate(items: CreateItemData[], tx?: Tx): Promise<ItineraryItem[]>;
}

// ---- AuditLogRepository ----
interface AuditLogRepository {
  log(entry: { actorUserId: string | null; action: string; targetType?: string; targetId?: string; metadata?: Record<string, unknown> }, tx?: Tx): Promise<void>;
  countRecentFailedLogins(userId: string, withinMinutes: number): Promise<number>;
}
```

### 14.2 Transaction Helper

```typescript
async function withTransaction<T>(
  callback: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction().execute(async (tx) => {
    return callback(tx);
  });
}
```

All repository methods that modify state accept an optional `tx?: Transaction` parameter to participate in composed transactions. pg-boss jobs are enqueued inside the same transaction (ARCH-041) since pg-boss uses the same Postgres database.

### 14.3 Soft-Delete Filtering

All `find*` methods on repositories for users, trips, and community_posts append `WHERE deleted_at IS NULL` by default. No query should return soft-deleted rows unless explicitly requested (e.g., admin audit or purge job).

---

## 15. Database Transactions

| Transaction | Tables | Operations | Isolation | Post-Commit Actions |
|---|---|---|---|---|
| RegisterUser | users, email_verification_tokens, refresh_tokens | INSERT x 3 | READ COMMITTED | Enqueue send-verification-email |
| LoginUser | users, refresh_tokens, audit_log | SELECT + UPDATE + INSERT x 2 | READ COMMITTED | — |
| CreateTrip | trips | INSERT x 1 | READ COMMITTED (implicit) | — |
| AddStop | trip_stops | SELECT FOR UPDATE + INSERT | READ COMMITTED | — |
| UpdateStop | trip_stops | UPDATE WHERE lock_version = :v | READ COMMITTED | — |
| DeleteStop | trip_stops | SELECT + DELETE + UPDATE (resequence) | READ COMMITTED | — |
| ReorderStops | trip_stops | SET CONSTRAINTS DEFERRED + UPDATE x N | READ COMMITTED | — |
| AddItem | itinerary_items | SELECT FOR UPDATE + INSERT (triggers budget) | READ COMMITTED | — |
| UpdateItem | itinerary_items | UPDATE (triggers budget) | READ COMMITTED | — |
| DeleteItem | itinerary_items | DELETE (triggers budget) | READ COMMITTED | — |
| PublishTrip | trips | UPDATE (set is_public, generate token) | READ COMMITTED | — |
| UnpublishTrip | trips | UPDATE (clear token) | READ COMMITTED | — |
| CopyTrip | trips, trip_stops, itinerary_items | INSERT trip + bulk INSERT stops + bulk INSERT items + UPDATE source copy_count | READ COMMITTED | — |
| DeleteAccount | users, trips, refresh_tokens | UPDATE users + UPDATE trips + UPDATE refresh_tokens | READ COMMITTED | Enqueue delete-orphaned-media |
| LikePost | community_likes | INSERT (ON CONFLICT DO NOTHING) then triggers counter | READ COMMITTED | — |
| UnlikePost | community_likes | DELETE then triggers counter | READ COMMITTED | — |
| ForgotPassword | password_reset_tokens | INSERT token | READ COMMITTED | Enqueue send-password-reset-email |
| ResetPassword | users, password_reset_tokens, refresh_tokens | UPDATE + UPDATE + UPDATE | READ COMMITTED | — |
| SuspendUser | users, refresh_tokens, audit_log | UPDATE status + UPDATE revoke tokens + INSERT audit | READ COMMITTED | — |

---

## 16. Concurrency

| Scenario | Risk | Strategy | Mechanism | Failure Response | Client Recovery |
|---|---|---|---|---|---|
| Two tabs reorder same trip's stops | Corrupted ordering | Deferrable unique + full replacement | Deferrable unique constraint on (trip_id, sequence_order) | 409 CONFLICT | Re-fetch current order, retry |
| Two requests add items to same stop/day | Sequence collision | Serialized sequence computation | SELECT MAX(seq) FOR UPDATE | Serialized (second waits) | Automatic |
| Same username/email registration | Duplicate account | DB uniqueness | Partial unique indexes | 409 USERNAME_TAKEN / EMAIL_TAKEN | Choose different identifier |
| Double-click like button | Duplicate like | DB unique + idempotent | uq_community_likes_post_user | 200 OK (idempotent success) | None needed |
| Double-click copy trip | Two copies | Idempotency-Key | Header-based replay | 200 OK (replay) | None needed |
| Two tabs edit trip metadata | Last-write-wins | Optimistic concurrency | lock_version + If-Match/ETag | 409 LOCK_VERSION_MISMATCH | Re-fetch + retry |
| Two tabs edit same stop | Lost update | Optimistic concurrency | lock_version on trip_stops | 409 LOCK_VERSION_MISMATCH | Re-fetch + retry |
| Concurrent item changes budget cache | Stale total | DB trigger atomicity | Trigger runs in-transaction | N/A (always consistent) | None needed |
| View count increment races | Lost counts | Fire-and-forget atomic | UPDATE SET view_count = view_count + 1 | N/A (tolerable loss) | None needed |
| Nightly status job vs manual cancel | Overwrite cancel | State machine guards | Job only transitions non-terminal states | N/A | None needed |

---

## 17. Idempotency

| Operation | Naturally Idempotent? | Strategy | Replay |
|---|---|---|---|
| SaveDestination | Yes | DB unique constraint | Catch 23505 then return success |
| Like/Unlike | Yes | DB unique + toggle | Return current state |
| ReorderStops | Yes | Same input = same output | Natural |
| UpdateTrip/Stop | Yes | If-Match + deterministic | Natural |
| DELETE operations | Yes | Delete already-gone = success | Natural |
| POST /trips | No | Idempotency-Key header (optional) | Replay stored response |
| POST /stops | No | Idempotency-Key header (optional) | Replay stored response |
| POST /items | No | Idempotency-Key header (optional) | Replay stored response |
| POST /copy | No | Idempotency-Key header (optional) | Replay stored response |

**Idempotency-Key Mechanism:**
- Header: `Idempotency-Key`
- Storage: dedicated `idempotency_keys` table: `(user_id, key)` maps to `(status_code, response_payload, created_at)`
- TTL: 24 hours (cleaned by daily job)
- Behavior: If key exists and completed then return stored response. If key exists and processing then 409. If new then execute and store.

---

## 18. External Services

### 18.1 Email Delivery

```
Interface: EmailSender.send({ to: string, template: string, data: Record<string, string> })
Provider: SMTP or transactional API (provider-agnostic, configured at deploy time)
Timeout: 5s per attempt
Retry: 3 attempts with exponential backoff (via pg-boss)
Failure: After 3 retries then dead-letter. User action already succeeded.
Security: API key from env, never logged. Token values never logged.
```

### 18.2 Object Storage

```
Interface: StorageAdapter.generatePresignedUploadUrl({ key, contentType, maxSize }) returns { uploadUrl, objectUrl }
           StorageAdapter.deleteObject(key) returns void
Provider: S3-compatible (AWS S3, MinIO, etc.)
Timeout: 10s for API calls
Retry: 2 attempts for delete (via background job)
Security: Pre-signed URLs expire in 5 minutes. Keys are UUID-based, never user-supplied filenames.
```

---

## 19. External API Failure Strategy

| Integration | Failure | Behavior |
|---|---|---|
| Email: Timeout | pg-boss retry with backoff |
| Email: 4xx | Fatal, mark job failed, log for admin |
| Email: 5xx | Transient, pg-boss retry |
| Email: Rate limit | Backoff retry with jitter |
| Storage: URL gen timeout | Return 503 to client |
| Storage: URL gen 4xx | Return 500 (likely misconfiguration) |
| Storage: Delete failure | Retry via background job |

---

## 20. AI Functionality

**Not applicable.** Per ASSUMP-002, no external AI/ML service is called. The "suggestions" endpoint (UC-023) returns popularity-based recommendations from the catalog database, not AI-generated content.

---

## 21. Asynchronous Processing

| Job | Trigger | Payload | Retries | Dead-Letter | Idempotent? |
|---|---|---|---|---|---|
| send-verification-email | Registration | { userId, tokenId, email } | 3 (exp backoff) | Logged, user re-sends | Yes |
| send-password-reset-email | Forgot password | { userId, tokenId, email } | 3 (exp backoff) | Logged, user re-requests | Yes |
| refresh-trip-statuses | Nightly 00:10 UTC | {} | 1 | Next night | Yes |
| recompute-popularity-scores | Nightly 00:30 UTC | {} | 2 | Next night | Yes |
| cleanup-expired-tokens | Daily 02:00 UTC | {} | 0 | Next day | Yes |
| purge-soft-deleted-records | Daily 02:30 UTC | {} | 0 | Next day | Yes |
| increment-view-count | Public trip view | { tripId } | 1 | Dropped (acceptable) | No |
| delete-orphaned-media | Media replaced/deleted | { objectKey } | 2 | Manual S3 cleanup | Yes |

---

## 22. Background Jobs

All jobs use pg-boss (Postgres-backed, ARCH-024). Cron jobs use pg-boss's cron scheduling API.

| Job | Type | Schedule | Timeout |
|---|---|---|---|
| send-verification-email | Event-triggered | Immediate | 30s |
| send-password-reset-email | Event-triggered | Immediate | 30s |
| refresh-trip-statuses | Cron | `10 0 * * *` | 5m |
| recompute-popularity-scores | Cron | `30 0 * * *` | 15m |
| cleanup-expired-tokens | Cron | `0 2 * * *` | 2m |
| purge-soft-deleted-records | Cron | `30 2 * * *` | 10m |
| increment-view-count | Event-triggered | Immediate | 10s |
| delete-orphaned-media | Event-triggered | Immediate | 60s |

---

## 23. Events

Per ARCH-042, GlobeTrotter does **NOT** use a general-purpose event bus. Rationale:

1. **DB triggers** handle all denormalized counter/cache maintenance (popularity events, budget total, like/comment counts) — fires regardless of code path
2. **pg-boss jobs** handle async work (emails, cleanup) — point-to-point, not broadcast
3. **No EventEmitter** or message bus in the application layer — avoids hidden side effects, keeps the codebase deterministic and traceable

---

## 24. Notifications

| Notification | Trigger | Channel | Template | Delivery | Retry |
|---|---|---|---|---|---|
| Email verification | Registration | Email | `verification_email` with { verificationUrl, username } | pg-boss job | 3x |
| Password reset | Forgot password request | Email | `password_reset` with { resetUrl, username } | pg-boss job | 3x |

No in-app notifications, push notifications, or SMS in v1.

---

## 25. Caching

| Cache | Type | Invalidation | Consistency |
|---|---|---|---|
| `trips.estimated_budget_total` | DB column (trigger-maintained) | Automatic on itinerary_items changes | Strong (transactional) |
| `community_posts.like_count/comment_count` | DB columns (trigger-maintained) | Automatic on likes/comments changes | Strong (transactional) |
| `cities/activities.popularity_score` | DB column (batch-updated) | Nightly job recomputation | Eventual (up to 24h) |

**No Redis or in-memory cache layer** needed at MVP scale. All caches are Postgres-native.

---

## 26. Search

### 26.1 Implementation

- PostgreSQL full-text search using generated `tsvector` columns + GIN indexes
- Query parsing: `plainto_tsquery('english', :query)`
- Ranking: `ts_rank(search_vector, query)` with `popularity_score DESC` tiebreaker
- No external search engine (ARCH-007)
- No fuzzy matching in v1 (pg_trgm documented as future enhancement)

### 26.2 Searchable Resources

| Resource | Fields | Auth Filter | Soft-Delete Filter |
|---|---|---|---|
| Cities | name, country, region | None (public) | N/A |
| Activities | name, description | None (public) | N/A |
| Community Posts | content | None | WHERE deleted_at IS NULL |

---

## 27. Pagination

| Endpoint | Type | Default | Max | Sort | Tiebreaker |
|---|---|---|---|---|---|
| GET /trips | Offset | 20 | 50 | startDate, createdAt | id |
| GET /cities | Offset | 20 | 50 | popularity, name, costIndex | id |
| GET /activities | Offset | 20 | 50 | popularity, cost, duration | id |
| GET /community/posts | **Cursor** | 20 | 50 | createdAt DESC (fixed) | id DESC |
| GET /admin/users | Offset | 25 | 100 | createdAt, username | id |

All sorts include `id` as secondary tiebreaker for deterministic pagination.

---

## 28. Error Architecture

### 28.1 Error Envelope

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description.",
    "details": null
  }
}
```

### 28.2 Complete Error Taxonomy

| Code | HTTP | Message | Retryable? |
|---|---|---|---|
| VALIDATION_ERROR | 400 | Request validation failed | Yes (with fix) |
| STOP_DATES_OUTSIDE_TRIP_RANGE | 400 | Stop dates must be within trip date range | Yes (with fix) |
| ITEM_DATE_OUTSIDE_STOP_RANGE | 400 | Item date must be within stop date range | Yes (with fix) |
| INVALID_REFERENCE | 400 | Referenced resource does not exist | No |
| INVALID_OR_EXPIRED_TOKEN | 400 | Token is invalid or has expired | No |
| UNAUTHENTICATED | 401 | Authentication required | No |
| INVALID_CREDENTIALS | 401 | Invalid username/email or password | Yes |
| INVALID_REFRESH_TOKEN | 401 | Refresh token is invalid or expired | No |
| INVALID_PASSWORD | 401 | Incorrect password | Yes |
| FORBIDDEN | 403 | You do not have permission | No |
| ACCOUNT_SUSPENDED | 403 | Account has been suspended | No |
| CANNOT_MODIFY_ADMIN | 403 | Cannot modify another admin | No |
| TRIP_NOT_FOUND | 404 | Trip not found | No |
| CITY_NOT_FOUND | 404 | City not found | No |
| ACTIVITY_NOT_FOUND | 404 | Activity not found | No |
| USER_NOT_FOUND | 404 | User not found | No |
| TRIP_NOT_FOUND_OR_NOT_PUBLIC | 404 | Trip not found or not public | No |
| USERNAME_TAKEN | 409 | Username is already taken | No |
| EMAIL_TAKEN | 409 | Email is already registered | No |
| LOCK_VERSION_MISMATCH | 409 | Resource was modified by another request | Yes (re-fetch) |
| ALREADY_SAVED | 409 | Destination already saved | No |
| ACCOUNT_LOCKED | 423 | Account temporarily locked | Yes (wait 15min) |
| RATE_LIMITED | 429 | Too many requests | Yes (backoff) |
| INTERNAL_ERROR | 500 | An unexpected error occurred | Yes |

---

## 29. Logging

- **Format:** JSON to stdout
- **Fields:** `timestamp` (ISO 8601), `level`, `correlationId`, `userId`, `route`, `method`, `statusCode`, `durationMs`, `error`
- **Levels:** error (5xx, DB failures), warn (4xx abuse patterns), info (request lifecycle), debug (query details, disabled in prod)
- **Correlation ID:** UUID from `X-Correlation-Id` header or generated. Propagated to all logs and background jobs.

**NEVER logged:** passwords, password_hash, raw tokens (access/refresh/reset/verification), API keys, full auth request bodies, SQL text in error responses, PII beyond userId in metrics.

---

## 30. Observability

### 30.1 Metrics

- Request count/latency per route + status code
- DB query latency histogram
- pg-boss job success/failure counts per type
- Login success/failure rate
- Business: trips created/day, items added/day, shares/day, copies/day, posts/day

### 30.2 Health Checks

- `GET /health/live` returns 200 if process running
- `GET /health/ready` returns 200 if DB pool healthy + pg-boss connected; 503 otherwise
- No sensitive info in health responses

---

## 31. Security

### 31.1 Authentication Security
- argon2id with cost >= 12, memory >= 65536 KiB
- JWT HS256 with 256-bit secret
- Refresh tokens stored as SHA-256 hashes only
- Token rotation on every refresh (ARCH-028)

### 31.2 Input Security
- Zod `.strict()` rejects unknown fields
- Typed query builder prevents SQL injection — raw string interpolation forbidden
- No `dangerouslySetInnerHTML` or HTML rendering of user content

### 31.3 SSRF Prevention
- photoUrl/coverPhotoUrl/attachmentUrls validated against storage domain allowlist
- Backend NEVER fetches arbitrary user-supplied URLs

### 31.4 IDOR Prevention
- Every user-owned resource query includes `user_id = :currentUserId`
- Never trust resource IDs alone — always verify ownership

### 31.5 Rate Limiting
- Auth endpoints: 10 req/min per IP
- Unauthenticated: 20 req/min per IP
- Authenticated: 100 req/min per user
- Implementation: sliding-window, Postgres-backed or in-process

### 31.6 Secure Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Powered-By`: removed
- CORS: configured for frontend origin only (no wildcards in production)

### 31.7 File Upload Security
- MIME allowlist: `image/jpeg`, `image/png`, `image/webp`
- Size: 5MB (profile/cover), 10MB (attachment), max 4 per post
- Object keys: UUID-based, never user-supplied filenames
- Pre-signed URLs: 5-minute expiry, scoped to `{userId}/{uuid}.{ext}`

### 31.8 Sensitive Data
- `password_hash` NEVER in any response or log
- Raw tokens NEVER logged
- Stack traces NEVER in production responses
- SQL text NEVER in responses

---

## 32. Configuration

### 32.1 Environment Variables

| Variable | Required | Default | Secret? | Purpose |
|---|---|---|---|---|
| NODE_ENV | Yes | development | No | Environment mode |
| PORT | No | 3000 | No | API listener port |
| DATABASE_URL | Yes | — | Yes | Postgres connection string |
| JWT_ACCESS_SECRET | Yes | — | Yes | JWT signing key (256-bit) |
| JWT_ACCESS_TTL_MINUTES | No | 15 | No | Access token TTL |
| JWT_REFRESH_TTL_DAYS | No | 30 | No | Refresh token TTL |
| PASSWORD_HASH_COST | No | 12 | No | argon2id cost factor |
| PUBLIC_APP_BASE_URL | Yes | — | No | For share URLs |
| EMAIL_PROVIDER_API_KEY | Yes (prod) | — | Yes | Email provider key |
| EMAIL_FROM_ADDRESS | Yes | — | No | Sender address |
| OBJECT_STORAGE_BUCKET | Yes | — | No | S3 bucket name |
| OBJECT_STORAGE_ACCESS_KEY | Yes | — | Yes | S3 access key |
| OBJECT_STORAGE_SECRET_KEY | Yes | — | Yes | S3 secret key |
| OBJECT_STORAGE_ENDPOINT | No | — | No | Custom S3 endpoint (MinIO) |
| OBJECT_STORAGE_REGION | No | us-east-1 | No | S3 region |
| RATE_LIMIT_ENABLED | No | true | No | Disable in test |
| LOG_LEVEL | No | info | No | Logging verbosity |
| CORS_ORIGIN | Yes (prod) | * | No | Allowed CORS origin |

### 32.2 Configuration Loading

```typescript
// config/env.ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  // ... all other variables
}).strict();

export const config = envSchema.parse(process.env);
// Process exits immediately on validation failure
```

---

## 33. TypeScript Engineering Standards

### 33.1 Compiler Configuration
- `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noImplicitReturns: true`
- Target: ES2022+ (Node 18+)
- Module: ESM (`"type": "module"` in package.json)

### 33.2 Error Handling
- Use a discriminated union **Result type** for expected business errors:
  ```typescript
  type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
  ```
- Throw exceptions only for programmer errors or unrecoverable system faults
- Never use try/catch for control flow of expected business cases

### 33.3 Naming Conventions
- **Files:** `kebab-case.ts` (e.g., `create-trip.ts`, `trip.repository.ts`)
- **Types/Interfaces:** `PascalCase` (e.g., `TripRepository`, `CreateTripRequest`)
- **Functions/Variables:** `camelCase` (e.g., `createTrip`, `userId`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_PAGE_SIZE`)
- **Enums:** `PascalCase` names, `UPPER_SNAKE_CASE` or string literal values

### 33.4 Dependency Injection
- Constructor injection via factory functions (no DI container like Inversify):
  ```typescript
  export function makeCreateTripUseCase(deps: { tripRepo: TripRepository }) {
    return async (input: CreateTripInput, currentUserId: string): Promise<Result<TripDTO, AppError>> => { ... };
  }
  ```

### 33.5 Decimal Handling
- Use `decimal.js` for all monetary arithmetic (ARCH-026)
- Postgres `numeric(12,2)` maps to string in JS maps to `Decimal` for computation maps to string for DTO
- Never use native `number` for money

### 33.6 Date Handling
- Store as `TIMESTAMPTZ` (UTC) in Postgres
- Use `date-fns` or `dayjs` for manipulation
- Never rely on server timezone settings
- Calendar dates are plain strings `YYYY-MM-DD`, not Date objects

### 33.7 Type-Only Imports
- Always use `import type` when only types are needed:
  ```typescript
  import type { Trip } from '../domain/entities/trip';
  ```

### 33.8 null vs undefined
- Use `null` for database values (SQL NULL)
- Use `undefined` for omitted optional properties
- Repositories map DB `null` to domain `null` (keep consistent with DB)

---

## 34. Dependency Rules

### 34.1 Layer Dependencies

```
Domain      -> NOTHING (pure, framework-free, only shared/errors and shared/types)
Application -> Domain, Infrastructure (via injected adapters), shared/
API         -> Application, shared/ (NEVER infrastructure directly)
Infra       -> Domain (entity types), shared/, config/
```

### 34.2 Module Dependencies

```
auth       -> users (profile creation)
users      -> catalog (city existence check for saved destinations)
trips      -> catalog (suggestions)
trip-stops -> trips (ownership), catalog (city FK)
itinerary  -> trip-stops (parent), catalog (activity FK)
budget     -> trips, trip-stops, itinerary (read-only)
calendar   -> trips (read-only)
sharing    -> trips, trip-stops, itinerary (clone)
community  -> users (author), trips (optional link)
admin      -> all modules (read-only aggregation), users (status writes)
dashboard  -> trips, catalog (read-only)
```

### 34.3 Anti-Patterns

- No module accesses another module's owned tables directly via SQL
- Cross-module reads go through the owning module's repository
- The database may join across module boundaries inside a single repository query for performance (e.g., trip-stops joining cities for display)

---

## 35. API Versioning

- **Mechanism:** URL prefix `/api/v1`
- **No header-based versioning** (too complex for this scope)
- **Breaking changes:** require `/api/v2` (not expected in v1)
- **Additive changes** (new optional fields in responses) are backward-compatible
- All JSON response field names are stable and version-pinned

---

## 36. Testing Strategy

### 36.1 Test Layers

| Layer | Target | Tool | Database |
|---|---|---|---|
| Unit | Domain rules, state machines, pure functions | Vitest/Jest | None |
| Integration | Repositories, triggers, constraints | Vitest + real Postgres (container) | Test DB |
| API | Every endpoint (happy + error paths) | Supertest + running app | Test DB |
| E2E | Critical workflows end-to-end | Supertest | Test DB |

### 36.2 Minimum Critical Test Suite

1. **Auth:** register/login/refresh/logout/forgot-reset happy paths + duplicate email, wrong password, expired token, lockout
2. **Trip CRUD:** create, read, update, delete + ownership enforcement (403 for non-owner)
3. **Itinerary builder:** add/edit/delete/reorder stop and item + concurrent-reorder conflict test
4. **Budget:** breakdown correctness against known fixture (exact category sums, over-budget flags)
5. **Sharing:** publish, public view (unauthenticated), copy (independent trip verified)
6. **Community:** post/comment/like idempotency (double-like doesn't duplicate)
7. **Admin:** role enforcement (non-admin gets 403), analytics return correct shape
8. **Account deletion:** cascades correctly, sessions revoked, audit trail persists

---

## 37. Test Case Matrix

| Module | Test | Type | Assertion |
|---|---|---|---|
| auth | Register with valid data | API | 201, user created, tokens returned |
| auth | Register duplicate email | API | 409 EMAIL_TAKEN |
| auth | Login with wrong password | API | 401, audit_log entry created |
| auth | Login lockout after 5 failures | API | 423 ACCOUNT_LOCKED |
| auth | Refresh token rotation | API | Old token revoked, new token works |
| auth | Password reset flow | API | New password works, old sessions revoked |
| trips | Create trip | API | 201, status=draft, budget=0 |
| trips | Get trip as non-owner | API | 403 FORBIDDEN |
| trips | Update trip with wrong lock_version | API | 409 LOCK_VERSION_MISMATCH |
| trips | Delete trip (soft) | API | 204, trip not in listings |
| trip-stops | Add stop with dates outside trip | API | 400 STOP_DATES_OUTSIDE_TRIP_RANGE |
| trip-stops | Reorder with incomplete IDs | API | 400 VALIDATION_ERROR |
| itinerary | Add item triggers budget refresh | Integration | trips.estimated_budget_total updated |
| budget | Breakdown matches fixture | API | Exact category sums |
| sharing | Publish generates token | API | is_public=true, token non-null |
| sharing | Copy creates independent trip | API | Mutations to copy don't affect original |
| community | Double-like idempotent | API | like_count = 1 after two POSTs |
| admin | Non-admin hits /admin/* | API | 403 |
| admin | Suspend another admin | API | 403 CANNOT_MODIFY_ADMIN |
| account | Deletion revokes tokens | Integration | All refresh tokens revoked |

---

## 38. API / Database Traceability

| API Endpoint | Primary Query | Index Used |
|---|---|---|
| GET /trips | `WHERE user_id = ? AND deleted_at IS NULL` | `idx_trips_user_id_status` |
| GET /trips/:id | `WHERE id = ? AND user_id = ?` | PK + `idx_trips_user_id` |
| GET /trips/:id/itinerary | JOIN trip_stops + itinerary_items | `idx_trip_stops_trip_id_sequence`, `idx_itinerary_items_stop_id_date_sequence` |
| GET /cities?q= | `search_vector @@ plainto_tsquery` | `idx_cities_search_vector` (GIN) |
| GET /activities?cityId=&category= | `WHERE city_id = ? AND category = ?` | `idx_activities_city_id_category` |
| GET /public/trips/:token | `WHERE share_token = ?` | `uq_trips_share_token` (O(1)) |
| GET /community/posts | `WHERE deleted_at IS NULL ORDER BY created_at DESC` | `idx_community_posts_created_at` (partial) |
| GET /admin/analytics/popular-cities | `GROUP BY city_id WHERE occurred_at BETWEEN` | `idx_city_popularity_events_occurred_at` |
| GET /trips/calendar | `WHERE user_id = ? AND start_date <= ? AND end_date >= ?` | `idx_trips_user_id`, `idx_trips_start_date` |

---

## 39. Implementation Order

### Phase 1: Foundation
1. Project scaffolding (tsconfig, package.json, ESM setup)
2. Configuration loading (`config/env.ts` with Zod)
3. Database connection pool (`infrastructure/db/connection.ts`)
4. Run all migrations from Database PRD (0001-0015)
5. Shared utilities (error types, logger, correlation ID, decimal helpers)
6. Transaction helper

### Phase 2: Auth & Users
7. Password hasher (argon2id)
8. JWT service
9. Token generator
10. Auth repositories (user, auth tokens, audit log)
11. Auth use cases (register, login, refresh, logout)
12. Auth middleware (requireAuth, requireAdmin)
13. Auth routes + Zod schemas
14. Password reset + email verification flows
15. User profile CRUD
16. Saved destinations

### Phase 3: Core Trip Planning
17. Catalog repositories + routes (cities, activities)
18. Trip repository + CRUD use cases + routes
19. Trip stop repository + CRUD + reorder + routes
20. Itinerary item repository + CRUD + routes
21. Full itinerary view endpoint
22. Budget breakdown endpoint

### Phase 4: Sharing & Social
23. Publish/unpublish trip
24. Public trip view + view count increment
25. Copy trip
26. Community posts + comments + likes
27. Calendar endpoint
28. Dashboard endpoint

### Phase 5: Admin & Infrastructure
29. Admin user management + analytics
30. Background jobs (pg-boss setup, all scheduled jobs)
31. Media upload URL endpoint
32. Rate limiting middleware
33. Secure headers middleware
34. Error handling middleware (global)

### Phase 6: Testing & Polish
35. Unit tests (domain rules, state machines)
36. Integration tests (repositories, triggers, constraints)
37. API tests (all endpoints)
38. E2E tests (critical workflows)
39. Documentation (OpenAPI spec generation)

---

## 40. AI Coding Agent Implementation Rules

### MUST:
- Follow module boundaries (S4), layering (S2), dependency direction (S34) exactly
- Implement every endpoint in S9 with exact contracts from S10
- Enforce authorization per S13 for every resource access
- Use typed query builder (Kysely/Drizzle) for all DB access — never raw string SQL
- Wrap every multi-statement operation in a transaction per S15
- Implement idempotency per S17 using exact mechanisms described
- Validate every input via Zod schemas per S11 before reaching domain layer
- Add tests per S36 for every new business behavior
- Preserve DTO contracts in S10 — no silent field renames
- Keep Database PRD and this spec in sync

### MUST NOT:
- Invent product features not in the PRDs
- Create database tables/columns not in Database PRD
- Create endpoints not listed in S9
- Store relational data as JSON (Database PRD S19)
- Access DB directly from route handlers (always through repository then use case)
- Trust frontend validation as sufficient — re-check server-side
- Persist unvalidated external URLs without domain allowlist check
- Expose internal errors (stack traces, SQL, file paths) in responses
- Hard-code any secret in source code
- Silently weaken authorization checks
- Silently change business rules without documenting

---

## 41. Final Backend Blueprint

```
  GlobeTrotter Backend
  +-------------------------------------------------+
  | Language:       TypeScript (strict mode, ESM)    |
  | Runtime:        Node.js 18+                      |
  | Framework:      Express or Fastify               |
  | Database:       PostgreSQL 16+ (pgcrypto, citext)|
  | Query Builder:  Kysely or Drizzle (NOT full ORM) |
  | Validation:     Zod (.strict())                  |
  | Auth:           JWT HS256 15min + Rotating       |
  |                 Refresh Tokens 30d               |
  | Password Hash:  argon2id (cost >= 12)            |
  | Job Queue:      pg-boss (Postgres-backed)        |
  | Storage:        S3-compatible (pre-signed)       |
  | Email:          Provider-agnostic adapter        |
  | Money:          decimal.js (never native number) |
  | Testing:        Vitest + Supertest + Postgres    |
  +-------------------------------------------------+
  | Modules: 12  | Endpoints: 50 | Use Cases: 50   |
  | Tables: 16   | Background Jobs: 8               |
  | State Machines: 4  | Business Rules: 28         |
  | Error Codes: 22                                  |
  +-------------------------------------------------+
```

---

## 42. Final Quality Gate

- [ ] All 50 endpoints implemented with exact contracts
- [ ] All 12 modules follow boundary rules
- [ ] 4-layer architecture respected (no cross-layer violations)
- [ ] All 4 state machines implemented with forbidden transitions actively rejected
- [ ] All 28 business rules enforced at the correct layer
- [ ] Optimistic concurrency (lock_version) on trips and trip_stops
- [ ] All 8 background jobs implemented and scheduled
- [ ] Rate limiting active on all endpoints
- [ ] Secure headers middleware applied
- [ ] SSRF prevention (URL allowlist) active
- [ ] Correlation ID propagation working
- [ ] Structured JSON logging with sensitive data exclusion
- [ ] Health check endpoints returning correct status
- [ ] All critical test suite items passing
- [ ] No raw SQL string interpolation anywhere in codebase
- [ ] No password_hash in any response or log
- [ ] All monetary values as decimal strings end-to-end
- [ ] Soft-delete filtering on all default queries
- [ ] Database migrations applied cleanly to fresh database
- [ ] Seed data loaded (at least 20 cities, at least 3 activities per city)

---

*End of Backend Implementation Specification. This document, together with the Database Design PRD and Backend Logic Design PRD, constitutes the complete implementation contract for the GlobeTrotter backend.*
