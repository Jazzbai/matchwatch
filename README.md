# MatchWatch / JazzB Watchparty

MatchWatch is a sports discovery and venue engagement platform. It combines a public web app, a TypeScript API, and a PostgreSQL data model for sports schedules, venues, bookings, reviews, menus, posts, and admin operations.

This repository is a monorepo with:

- `HtownKickoff-main/`: Next.js frontend
- `apps/api/`: Hono API server
- `packages/shared/`: shared Zod schemas and TypeScript contracts
- `docker-compose.yml`: local/full-stack runtime with Postgres, Redis, API, and frontend

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI
- TipTap editor
- Leaflet and `leaflet.markercluster` for maps

### Backend

- Node.js 20+
- Hono
- TypeScript
- Drizzle ORM
- PostgreSQL 16
- Redis 7
- BullMQ for scheduled and background jobs
- Zod for validation
- JOSE + bcrypt for auth and session security
- Pino for structured logging

### Infrastructure and Integrations

- Docker / Docker Compose
- AWS S3 for uploads
- Resend for email delivery
- Google Places API for venue lookup and venue data enrichment
- Google reCAPTCHA for signup/login abuse protection

## Monorepo Layout

```text
.
|-- apps/
|   `-- api/
|-- HtownKickoff-main/
|-- packages/
|   `-- shared/
|-- scripts/
|-- docker-compose.yml
`-- .env.example
```

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop

### Run with Docker

```bash
docker compose up -d --build
```

Services:

- frontend: `http://localhost:3000`
- api: `http://localhost:4000`
- api health: `http://localhost:4000/health`
- postgres: `localhost:5432`
- redis: `localhost:6379`

### Run without Docker

1. Copy `.env.example` to `.env`
2. Start Postgres and Redis
3. Run the API:

```bash
npm run dev --workspace=@matchwatch/api
```

4. Run the frontend:

```bash
cd HtownKickoff-main
npm run dev
```

## Workspace Scripts

From the repo root:

```bash
npm run dev
npm run build
npm run type-check
npm run db:generate
npm run db:migrate
npm run db:seed
```

Useful API scripts:

```bash
npm run matches:sync-upcoming --workspace=@matchwatch/api
npm run venues:sync-google --workspace=@matchwatch/api
npm run teams:backfill-logos --workspace=@matchwatch/api
```

## Environment Overview

Key variables from `.env.example`:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `RUN_STARTUP_MIGRATIONS`
- `RUN_STARTUP_SEED`
- `ENABLE_MATCH_SYNC_WORKER`
- `NEXT_PUBLIC_API_URL`
- `API_PROXY_TARGET`
- `GOOGLE_PLACES_API_KEY`
- `RECAPTCHA_SECRET_KEY`
- `FOOTBALL_DATA_API_KEY`
- `API_FOOTBALL_API_KEY`
- `THE_SPORTS_DB_API_KEY`
- `JOLPICA_BASE_URL`
- `ESPN_SCOREBOARD_BASE_URL`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `CDN_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SUPER_ADMIN_USERNAME`
- `SUPER_ADMIN_PASSWORD`
- `SUPER_ADMIN_PASSWORD_HASH`
- `SUPER_ADMIN_SESSION_SECRET`

## Database Structure

The main schema lives in [apps/api/src/db/schema.ts](apps/api/src/db/schema.ts).

### Identity and Access

- `users`
- `refresh_token_sessions`
- `audit_logs`

Purpose:

- End-user accounts
- venue owners / business accounts
- admins and super admins
- refresh token rotation and session tracking
- audit history for privileged actions

### Sports Catalog

- `sports`
- `leagues`
- `teams`
- `stadiums`
- `matches`

Purpose:

- core sports taxonomy
- league metadata
- team records and logos
- match schedule, status, scores, and venue metadata

### Motorsport Support

- `drivers`
- `entrants`
- `manufacturers`
- `event_entries`

Purpose:

- single-event and motorsport-style events with drivers, teams, and manufacturer entries

### Venues and Venue Operations

- `venues`
- `venue_attributes`
- `venue_events`
- `venue_custom_events`
- `venue_claims`
- `promotions`

Purpose:

- venue listings, Google-linked venue snapshots, amenities, vibes, cuisine tags
- match watch parties and venue-hosted custom events
- venue ownership claims and approval flows
- promotional offers tied to venues or specific events

### Booking and Customer Activity

- `bookings`
- `waitlist`
- `follows`
- `reviews`
- `notifications`
- `user_team_interests`

Purpose:

- event bookings and capacity control
- waitlist escalation when an event is full
- venue follows
- post-visit reviews
- in-app notification feed
- personalization through team interests

### Content and Menus

- `menu_categories`
- `menu_items`
- `posts`
- `blog_categories`
- `blog_posts`
- `blog_post_categories`
- `blog_comments`

Purpose:

- venue menus
- venue social/content posts
- editorial blog CMS with moderation

### Operations

- `sync_history`

Purpose:

- records match sync runs, upsert counts, failures, and duration

## Data Flow

### Match Data

Background sync jobs ingest match and event data, normalize it into `matches`, `teams`, `leagues`, and related records, then expose it to the frontend through `/api/v1/matches/*`.

### Venue Data

Venues can be created manually or enriched from Google Places. Google data is stored in `google_source_snapshot` fields and can also seed menu/category content.

### Business Dashboard

Business users manage:

- venue profile
- events and custom events
- bookings
- menus
- posts
- follower notifications

### Super Admin

A separate super-admin surface handles:

- approval workflows
- system lookups
- CRUD across sports, leagues, teams, venues, matches, blog CMS, and motorsport entries

## LLMs / AI Usage

There is currently no production LLM integration in the application runtime.

Current state:

- No OpenAI, Anthropic, Gemini, or other LLM SDK is wired into the frontend or API.
- No chat, generation, summarization, or embeddings workflow is active in the shipped code.
- The repository does contain AI-oriented planning and handoff documents such as `Claude.md` and `FRONTEND_HANDOFF.md`, but those are development docs, not runtime dependencies.

If LLM functionality is added later, this README should be updated with:

- provider
- model names
- prompts/workflows
- privacy/data handling
- fallback behavior

## External API Calls and Service Integrations

### Sports Data Providers

Used by [apps/api/src/workers/matchSync.ts](apps/api/src/workers/matchSync.ts):

- Football-Data.org
  - base: `https://api.football-data.org/v4`
- API-Football
  - base: `https://v3.football.api-sports.io`
- TheSportsDB
  - base derived from `THE_SPORTS_DB_API_KEY`
- ESPN Scoreboard
  - base: `https://site.api.espn.com/apis/site/v2/sports`
- Jolpica / Ergast-style F1 API
  - base: `https://api.jolpi.ca/ergast`

Usage:

- nightly sync
- live status refresh every 5 minutes
- fallback/provider switching by league and available API keys

### Google Places API

Used by [apps/api/src/lib/googlePlaces.ts](apps/api/src/lib/googlePlaces.ts):

- `POST /places:searchText`
- `GET /places/{placeId}`

Usage:

- venue search during onboarding
- venue metadata enrichment
- ratings, address, phone, website, maps URL
- optional menu snapshot seeding

### Google reCAPTCHA

Used by [apps/api/src/lib/recaptcha.ts](apps/api/src/lib/recaptcha.ts):

- `POST https://www.google.com/recaptcha/api/siteverify`

Usage:

- login
- user registration
- venue/business registration

### AWS S3

Used by [apps/api/src/lib/storage.ts](apps/api/src/lib/storage.ts):

- presigned upload URL generation
- object deletion

Usage:

- avatars
- venue covers
- venue galleries
- menu images
- post media

### Resend

Configured for transactional email through `RESEND_API_KEY`.

Intended usage:

- verification emails
- password reset emails
- booking-related notifications

Note:

- Some auth flows currently log email actions and expect delivery/background handling to be completed around that integration.

## Internal API Surface

Base URL:

- `GET /health`
- `/api/v1/*`

### Public / User-Facing Routes

- `/api/v1/auth`
  - register, venue registration, login, refresh, logout, session management, password reset
- `/api/v1/matches`
  - list, facets, upcoming, match detail, match venues, motorsport entries
- `/api/v1/venues`
  - venue listing, detail, events, custom events, menu, reviews, follow/unfollow
- `/api/v1/blog`
  - categories, posts, post detail, comments
- `/api/v1/places`
  - Google Places search and detail lookup
- `/api/v1/bookings`
  - create, list, detail, cancel
- `/api/v1/user`
  - profile, avatar, interests, feed, notifications

### Business Dashboard Routes

- `/api/v1/dashboard`
  - overview
  - owned venues
  - venue settings
  - Google venue refresh/revert
  - match events and custom events
  - booking management
  - posts
  - menu categories and items
  - follower notifications
  - analytics

### Admin Routes

- `/api/v1/admin`
  - platform stats
  - users
  - venues
  - audit logs
  - sync history
  - manual match sync
  - seed endpoints

### Super Admin Routes

- `/api/v1/super-admin`
  - session and login
  - uploads
  - system stats and lookups
  - CRUD for sports, leagues, teams, stadiums, matches, motorsport entries
  - CRUD for venues, venue events, custom events
  - CRUD for blog categories, posts, comments
  - business approval, venue approval, venue claims
  - Google venue refresh/revert

## Upload Flow

Authenticated upload endpoints:

- `POST /api/v1/uploads/presigned-url`
- `POST /api/v1/uploads/presigned`
- `POST /api/v1/uploads/delete-objects`
- `DELETE /api/v1/uploads/objects`

The frontend uploads directly to S3 using presigned URLs, then stores public URLs and object keys in the application database.

## Deployment Notes

- Local full stack: Docker Compose
- Server deployment guidance: [EC2_DEPLOYMENT_GUIDE.md](EC2_DEPLOYMENT_GUIDE.md)
- Using production-shaped data locally: [LOCAL_DATA_FROM_MAIN_DB.md](LOCAL_DATA_FROM_MAIN_DB.md)

## Notes

- The frontend directory name is currently `HtownKickoff-main`, but it is the active web application for this repository.
- Root API contracts are shared through `@matchwatch/shared`.
- Match sync can auto-select providers depending on available credentials and league type.
