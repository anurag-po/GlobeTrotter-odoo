# GlobeTrotter

GlobeTrotter is a full-stack, enterprise-grade travel planning, dynamic multi-city itinerary generation, and community discovery platform. Built with Node.js, TypeScript, PostgreSQL, and a modular frontend architecture, it unifies fragmented trip planning workflows into an integrated, real-time ecosystem.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Key Capabilities & Modules](#key-capabilities--modules)
3. [System Architecture & Technology Stack](#system-architecture--technology-stack)
4. [Project Directory Structure](#project-directory-structure)
5. [Database Architecture & Schema](#database-architecture--schema)
6. [Installation & Local Setup](#installation--local-setup)
7. [Default Demonstration Credentials](#default-demonstration-credentials)
8. [API Reference](#api-reference)
9. [Testing & Quality Assurance](#testing--quality-assurance)
10. [Authors & Project Contributors](#authors--project-contributors)

---

## Executive Summary

Modern leisure and business travelers face fragmented tooling when organizing multi-city journeys:
- Spreadsheets are typically required for budget tracking and day-wise stop sequencing.
- Social messaging channels isolate travel recommendations and photo sharing.
- Traditional booking websites lack the flexibility to construct custom day-by-day itineraries with granular expense forecasting.

GlobeTrotter resolves these problems by providing:
- A reactive multi-city route builder with live per-activity cost calculation.
- An isolated, persistent itinerary engine where every journey maintains its own independent data model.
- A social travel feed supporting direct photo uploads, community ratings, and threaded discussions.
- An interactive visual calendar for scheduling travel occupancy and blockouts.
- Full GDPR compliance through self-service account data deletion requests and administrative purge controls.
- Direct synchronization with a production-grade PostgreSQL 16 relational database.

---

## Key Capabilities & Modules

### 1. Zero-Trust Authentication Gateway & Security
- Client-Side Navigation Guards: Enforces route protection on `/trips.html`, `/itinerary.html`, `/calendar.html`, `/profile.html`, and `/admin.html`. Unauthenticated sessions are intercepted and routed to `/login.html`.
- Strict Email Validation: Enforces RFC-compliant email regular expression validation on both sign-in and registration forms, preventing malformed submissions and presenting real-time feedback.
- Role-Based Access Control (RBAC): Differentiates between standard `user` and `admin` accounts, dynamically toggling navigation tabs and administrative endpoints based on JWT claims.
- Cryptographic Password Hashing: Uses Argon2id password hashing with memory and parallelism cost parameters for secure credential storage.

### 2. Multi-City Itinerary Engine & Dynamic Viewer
- Isolated Itinerary Models: Every trip in the system contains its own distinct stops, dates, durations, and activity collections.
- Dynamic Query Parameter Routing: The viewer (`/itinerary.html?tripId=[id]`) reads the trip identifier and dynamically constructs the stop sequence, categorized activity lists, and budget breakdown.
- Real-Time Budget Recalculator: Modifying or adding custom activities with individual price points dynamically recalculates stop budgets, total itinerary expenses, and per-person estimates.
- Categorized Activity Taxonomy: Activities are organized across standardized categories (Sightseeing, Adventure, Food & Culture, Relaxation, Heritage) with custom time slots.
- Export & Sharing: Built-in shareable clipboard link generator and formatted print view for travelers on the go.

### 3. Explore & Destination Discovery Catalog
- Live Search & Filtering: Real-time search by place name, country, or keyword without full page reloads.
- Category Filter Chips: Instant client-side categorization by activity type (Sightseeing, Adventure, Heritage, Food & Culture, Relaxation).
- Direct Action Handlers: Allows travelers to add curated attractions directly into their active itinerary builder with one click.

### 4. Community Hub & Content Sharing
- Social Story Feed: A shared community feed displaying verified travel experiences, destinations, notes, and visual highlights.
- Direct Device Image Uploads: Supports selecting image files directly from local storage via FileReader, with instant client thumbnail previews.
- Engagement Engine: Live like counter increments and interactive discussion modals with persistent comment threads.

### 5. Interactive Calendar & Occupancy Scheduler
- Visual Month View: Complete calendar interface displaying days of the month with quick-navigation controls.
- Date Occupancy Editor: Clicking any date cell opens a scheduling modal to define trip titles, color tags (Blue, Red, Green, Orange), and duration spans.
- Visual Span Blocks: Renders multi-day journey spans across the calendar grid with persistent storage.
- Clear Date Action: Allows users to release scheduled blocks and mark dates as free.

### 6. User Profile & GDPR Data Privacy
- Dynamic Initial Avatars: Automatically computes circular letter avatars from user initials by default.
- Custom Profile Photo Management: Supports file-based photo uploads from local devices with instant profile updates and a reset option.
- GDPR Data Deletion Pipeline: Users can request complete profile and itinerary data deletion, transitioning their account status to `deletion_requested` with alert notifications.

### 7. Web Administration & Governance
- Live PostgreSQL User Directory: Queries backend endpoints (`GET /api/v1/admin/users`) directly without placeholder or mock accounts.
- Administrative Privilege Management: Enables promoting standard users to administrators (`PATCH /api/v1/admin/users/:id/role`) or revoking elevated rights.
- Account Moderation: Inline account suspension and reactivation controls.
- GDPR Data Purge Execution: Administrators can approve deletion requests to permanently erase user records from PostgreSQL (`DELETE /api/v1/admin/users/:id`).
- Catalog Management: Administrative CRUD interfaces for global destinations, average regional costs, and curated activities.

---

## System Architecture & Technology Stack

```
+-----------------------------------------------------------------------+
|                           CLIENT LAYER                                |
|   Vanilla ES6+ JavaScript | Semantic HTML5 | CSS3 Design Tokens       |
|   AuthService | UIService | AdminModule | CalendarModule              |
+-----------------------------------------------------------------------+
                                   |
                             HTTP / JSON
                                   |
+-----------------------------------------------------------------------+
|                          BACKEND API LAYER                            |
|   Node.js 20+ | Express 4 | TypeScript 5 (Strict ESM)                 |
|   Rate Limiting | Request Logging | Correlation IDs | Error Handler   |
+-----------------------------------------------------------------------+
                                   |
+-----------------------------------------------------------------------+
|                        APPLICATION LOGIC LAYER                        |
|   Use Cases: User Auth | Itinerary Builder | Admin Governance         |
|   Ports & Repositories | State Machines | Domain Entities             |
+-----------------------------------------------------------------------+
                                   |
+-----------------------------------------------------------------------+
|                         PERSISTENCE LAYER                             |
|   PostgreSQL 16 Relational Database | 16 Normalized Schemas           |
|   Argon2id Password Security | Foreign Key Constraints | pgAdmin 4    |
+-----------------------------------------------------------------------+
```

### Technology Stack Summary

- **Backend Runtime:** Node.js 20+
- **Language:** TypeScript 5 (Strict ESM configuration)
- **Web Framework:** Express 4
- **Database:** PostgreSQL 16
- **Database Management Tool:** pgAdmin 4
- **Authentication:** JWT (JSON Web Tokens) with Argon2id hashing
- **Testing Framework:** Vitest
- **Frontend:** Semantic HTML5, CSS3 Custom Properties (Design Tokens), Vanilla Modular JavaScript

---

## Project Directory Structure

```
GlobeTrotter/
├── frontend/                     # Client application files
│   ├── css/
│   │   └── style.css             # Unified design system & responsive layout styles
│   ├── js/
│   │   └── main.js               # Core frontend orchestrator (Auth, UI, Admin, Calendar)
│   ├── index.html                # Home landing page with hero CTA
│   ├── login.html                # Dual sign-in and registration authentication hub
│   ├── search.html               # Destination and activity search catalog
│   ├── trips.html                # My Trips dashboard (Ongoing, Upcoming, Completed)
│   ├── itinerary.html            # Dynamic day-wise itinerary viewer
│   ├── build-itinerary.html      # Interactive multi-city itinerary builder
│   ├── create-trip.html          # New journey setup and curated suggestions
│   ├── community.html            # Social travel story feed with photo uploads
│   ├── calendar.html             # Month-view availability and trip occupancy scheduler
│   ├── profile.html              # Profile editing, photo picker, and GDPR deletion
│   └── admin.html                # Web administrative governance and user management
├── src/                          # Backend TypeScript source code
│   ├── api/                      # Express route definitions, middlewares, and schemas
│   │   ├── admin/                # Admin user management and analytics endpoints
│   │   ├── auth/                 # Sign-in, registration, and token validation routes
│   │   ├── catalog/              # Cities and activities catalog endpoints
│   │   ├── community/            # Social posts, likes, and comment routes
│   │   ├── itinerary/            # Itinerary item creation and management routes
│   │   ├── middleware/           # Auth guard, rate limiter, error handling
│   │   └── trips/                # Trip and stop management endpoints
│   ├── application/              # Use cases, application ports, and business logic
│   ├── domain/                   # Domain entities, value objects, state machines
│   ├── infrastructure/           # Database adapters, repositories, security services
│   └── app.ts                    # Express server initialization and entry point
├── tests/                        # Vitest integration and unit test suite
├── package.json                  # Dependencies and execution scripts
├── tsconfig.json                 # TypeScript compiler configuration
└── README.md                     # Project documentation
```

---

## Database Architecture & Schema

GlobeTrotter uses a normalized PostgreSQL 16 relational database structure comprising 16 tables:

### Core Tables

1. **`users`**: Master user identity table storing unique identifier, email, username, argon2id password hash, full name, role (`user` or `admin`), account status (`active`, `suspended`, `deletion_requested`), and verification flags.
2. **`auth_tokens`**: Refresh token hashes, device identifiers, and expiration timestamps.
3. **`trips`**: Primary journey records including trip title, destination, status (`ongoing`, `upcoming`, `completed`), start date, end date, and total budget.
4. **`trip_stops`**: Sequential intermediate destinations linked to a trip record via foreign key, with stop order index and duration.
5. **`itinerary_items`**: Granular time-slotted physical activities, locations, category tags, and estimated expenses in INR.
6. **`cities`**: Reference destination catalog containing city name, country, region, average travel cost, and descriptions.
7. **`activities`**: Curated excursion catalog containing activity name, associated place, category, cost, duration, and details.
8. **`community_posts`**: Social feed records containing author identifier, title, destination, story content, photo URL, and like count.
9. **`community_comments`**: Threaded discussion messages linked to community post records.
10. **`post_likes`**: Unique user-to-post like associations preventing duplicate likes.
11. **`saved_destinations`**: User wishlist records linking accounts to saved destinations.
12. **`audit_logs`**: System event log recording administrative privilege changes, status modifications, and security events.
13. **`user_privacy_requests`**: GDPR deletion tracking log recording request timestamps, reasons, and purge status.
14. **`idempotency_keys`**: API idempotency control records preventing duplicate transactions.
15. **`email_verification_tokens`**: One-time tokens for email address verification.
16. **`password_reset_tokens`**: Secure tokens for password reset workflows.

---

## Installation & Local Setup

### Prerequisites

Ensure the following tools are installed on your host system:
- **Node.js** (v20.0.0 or higher)
- **npm** (v10.0.0 or higher)
- **PostgreSQL** (v16.0 or higher) running on `localhost:5432`

### 1. Clone the Repository

```bash
git clone https://github.com/anurag-po/GlobeTrotter-odoo.git
cd GlobeTrotter-odoo
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory (or use default values):

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/globetrotter
JWT_SECRET=super-secret-production-jwt-key-2026
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
```

### 4. Database Setup

Ensure the PostgreSQL database exists:

```sql
CREATE DATABASE globetrotter;
```

### 5. Build and Start the Application

To run the TypeScript compilation and start the static file and API server:

```bash
npm run dev
```

The application will be accessible at:
```
http://localhost:3000
```

---

## Default Demonstration Credentials

For testing and demonstration, use the following pre-configured credentials:

### Administrator Account
- **Email:** `admin1234@temporaryaccount.none`
- **Password:** `AdminPassword123!`
- **Role:** Administrator (Access to all user management, RBAC, and catalog controls)

### Standard User Account
- **Email:** Create any account via `/login.html` (Registration Tab)
- **Role:** Standard Explorer

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register a new user account | No |
| `POST` | `/api/v1/auth/login` | Authenticate credentials and receive JWT | No |
| `POST` | `/api/v1/auth/refresh` | Refresh an expired access token | No |
| `POST` | `/api/v1/auth/logout` | Revoke active session tokens | Yes |

### Trip & Itinerary Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/trips` | List all journeys for the authenticated user | Yes |
| `POST` | `/api/v1/trips` | Create a new multi-city journey record | Yes |
| `GET` | `/api/v1/trips/:id` | Fetch complete trip details with stops and items | Yes |
| `POST` | `/api/v1/trips/:id/stops` | Append a city stop to an existing trip | Yes |
| `POST` | `/api/v1/trips/:id/items` | Add a scheduled activity item to a trip stop | Yes |

### Administration Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/users` | List paginated user accounts from PostgreSQL | Admin |
| `PATCH` | `/api/v1/admin/users/:id/role` | Promote or demote user account role | Admin |
| `PATCH` | `/api/v1/admin/users/:id/status` | Modify account status (active / suspended) | Admin |
| `DELETE` | `/api/v1/admin/users/:id` | Permanently purge account (GDPR approval) | Admin |
| `POST` | `/api/v1/admin/users` | Create a new administrator account directly | Admin |
| `GET` | `/api/v1/admin/analytics/trends` | Retrieve platform growth and metric trends | Admin |

### Community Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/community/posts` | Fetch paginated community story feed | No |
| `POST` | `/api/v1/community/posts` | Publish a new travel story with photo | Yes |
| `POST` | `/api/v1/community/posts/:id/like` | Toggle like status on a community post | Yes |
| `POST` | `/api/v1/community/posts/:id/comments` | Post a comment on a discussion thread | Yes |

---

## Testing & Quality Assurance

GlobeTrotter includes an automated test suite executed with Vitest, validating API route responses, authentication boundaries, rate limiting, and business use cases.

Run the test suite with:

```bash
npm test
```

To run tests in watch mode:

```bash
npx vitest
```

---

## Authors & Project Contributors

GlobeTrotter was designed and developed by:

- **Anurag** — System Architecture, Security Gateway & Backend Infrastructure
- **Deep** — Core Itinerary Engine, Multi-City Builder & Discovery Catalog
- **Soham** — Social Community Hub, Calendar Scheduler & Privacy Systems
- **Nihal** — Database Architecture, PostgreSQL Administration & Governance Controls
