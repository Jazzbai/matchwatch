# MatchWatch

MatchWatch is a multi-sport watch-party platform for fans, businesses, and super-admins.

The application now supports dynamic sports and leagues, business-owned multi-venue management, searchable team and stadium selection for custom matches, and dynamic venue attribute management.

## Current scope

- Multi-sport catalog with admin-managed `sports` and sport-linked `leagues`
- Public matches experience with `Sport`, `League`, `Region`, and `Date` filters
- Fan accounts for bookings and account management
- `Business` accounts that can own and manage multiple venues
- Super-admin dashboard for users, venues, attributes, teams, sports, leagues, CSV imports, and matches
- Searchable team and stadium pickers for custom match creation
- Venue attributes managed dynamically through `amenities`, `vibes`, and `cuisineTags`

## Repository layout

This README lives in `HtownKickoff-main/`, but the project is a monorepo rooted one level above it.

```text
JazzB-watchparty/
|- HtownKickoff-main/        # Next.js 16 frontend
|- apps/api/                # Hono + Drizzle + Postgres API
|- packages/shared/         # Shared schemas, constants, types
|- docker-compose.yml       # Local Docker stack
|- .env.example             # Root env template for API/runtime
|- LOCAL_DATA_FROM_MAIN_DB.md
```

## Major recent changes

### Multi-sport expansion

- Added first-class `sports`
- Linked `leagues` to `sports`
- Added sport-aware match filtering and match facets
- Added super-admin Sports and Leagues management
- Added CSV-based match import for non-soccer and manually managed schedules

### Business role migration

- Added `BUSINESS` as a first-class role
- Kept compatibility for legacy `VENUE_OWNER`
- Business users can manage multiple venues from `/admin`
- Event, menu, reservations, and venue settings are scoped by venue

### Match creation improvements

- Super-admin custom match forms now use searchable dropdowns for:
  - home team
  - away team
  - stadium
- Added first-class `stadiums`
- Match records can store `stadiumId` while still mirroring `venueName` for backward compatibility
- Missing teams and stadiums can be created inline from the match form

### Venue admin expansion

- Added `venues.vibes`
- Added `venue_attributes` catalog with types:
  - `AMENITY`
  - `VIBE`
  - `CUISINE`
- Super-admin can now manage venue attribute values from a dedicated `Attributes` tab
- Venue editing in super-admin uses dynamic attribute dropdowns instead of hardcoded/free-text values

## Database migrations added recently

- `apps/api/src/db/migrations/0002_multi_sport_business.sql`
  - adds `BUSINESS`
  - creates `sports`
  - links `leagues.sport_id`
- `apps/api/src/db/migrations/0003_match_stadiums.sql`
  - creates `stadiums`
  - adds `matches.stadium_id`
- `apps/api/src/db/migrations/0004_venue_attributes.sql`
  - adds `venues.vibes`
  - creates `venue_attributes`
  - seeds default amenity, vibe, and cuisine values

## Main application surfaces

### Public app

- `/` home page
- `/matches` multi-sport match listing
- `/matches/[matchId]` match detail
- `/venues` venue listing
- `/venues/[slug]` venue detail
- `/teams/[teamId]` team detail

### Business dashboard

- `/admin`
- Venue selector for businesses with multiple venues
- Venue-scoped event, reservation, menu, and settings workflows

### Super-admin dashboard

- `/jazzbai`
- Tabs currently include:
  - `Overview`
  - `Users`
  - `Venues`
  - `Attributes`
  - `Teams`
  - `Match Events`
  - `Custom Events`
  - `Sports`
  - `Leagues`
  - `CSV Import`
  - `Matches`

## Local development

### Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop or local Postgres + Redis

### Install dependencies

Run from the repository root:

```bash
npm install
```

### Environment setup

1. Copy the root template:

```bash
cp .env.example .env
```

2. Adjust values as needed.

Important defaults in `.env.example`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/matchwatch
REDIS_URL=redis://localhost:6379
PORT=4000
NEXT_PUBLIC_API_URL=/api/v1
API_PROXY_TARGET=http://localhost:4000
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
RECAPTCHA_MIN_SCORE=0.5
```

### Google reCAPTCHA for auth

Login, fan signup, and venue signup are wired for Google reCAPTCHA v3.

Required environment variables:

```env
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-google-site-key
RECAPTCHA_SECRET_KEY=your-google-secret-key
RECAPTCHA_MIN_SCORE=0.5
```

Notes:

- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is compiled into the frontend build.
- `RECAPTCHA_SECRET_KEY` is only used by the API.
- In non-production environments, the API bypasses reCAPTCHA if `RECAPTCHA_SECRET_KEY` is not set so local development is not blocked.

### Recommended local run

Start only Postgres and Redis in Docker, then run the app processes locally.

```bash
docker compose up -d postgres redis
npm run dev --workspace=@matchwatch/api
cd HtownKickoff-main
npm run dev -- --port 3100
```

Open:

- Frontend: `http://localhost:3100`
- API health: `http://localhost:4000/health`

### Full Docker stack

```bash
docker compose up --build
```

Default ports:

- frontend: `3100`
- api: `4000`
- postgres: `5432`
- redis: `6379`
- mailhog: `8025` and `1025` when enabled

## Production-data safety switches

When pointing a local API at a production-connected or AWS-hosted database, keep these disabled:

```env
RUN_STARTUP_MIGRATIONS=false
RUN_STARTUP_SEED=false
ENABLE_MATCH_SYNC_WORKER=false
```

Those flags prevent accidental schema writes, demo seeding, and background sync jobs against production data.

For the supported local-data workflows, see:

- `../LOCAL_DATA_FROM_MAIN_DB.md`

That document covers:

- using the production API directly from local frontend
- running local backend code against the main AWS database
- building an anonymized local clone with realistic production-shaped data

## Useful commands

From the repository root:

```bash
npm run dev
npm run build
npm run type-check
npm run db:migrate --workspace=@matchwatch/api
npm run db:seed --workspace=@matchwatch/api
npm run db:seed:anonymized --workspace=@matchwatch/api
```

Frontend only:

```bash
cd HtownKickoff-main
npm run dev -- --port 3100
npx tsc --noEmit
```

API only:

```bash
npm run dev --workspace=@matchwatch/api
npm run type-check --workspace=@matchwatch/api
```

## Notes for admins

- Public route compatibility has been preserved even where internal roles changed from `Venue` to `Business`
- Existing `venueName` fields are still populated for match display compatibility
- Existing soccer sync behavior remains supported, while non-soccer ingestion is currently manual or CSV-driven
- Team management is now available directly in super-admin, not only through sync-created data
- Venue attributes are soft-archived rather than hard-deleted so existing venue records do not break

## Verification status

Recent feature work was verified locally with:

- TypeScript checks for frontend and API
- local API and frontend smoke tests
- Playwright browser testing of public flows, business flows, and super-admin flows

## License

This project is for internal/product development use unless the repository owner states otherwise.
