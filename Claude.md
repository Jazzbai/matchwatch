Here's your comprehensive, prompt-engineered brief for Claude Opus 4.6:

---

#  FootWatch — Full-Stack Watch Party Platform

## PROMPT FOR CLAUDE OPUS 4.6

---

You are an expert full-stack software architect and senior developer. I want you to build **FootWatch** — a complete, production-ready web platform that connects football fans with cafés and restaurants hosting watch parties for upcoming matches. Below is the full specification. Work through it systematically, making all architectural decisions, scaffolding all code, and producing a complete, deployable project.

---

##  TECH STACK DECISIONS (locked in)

**Frontend:** React 18 + TypeScript + Vite, shadcn/ui component library, Tailwind CSS, React Query (TanStack), Zustand for state, React Router v6, Mapbox GL JS (map views), React Hook Form + Zod (forms/validation)

**Backend:** Node.js + TypeScript with **Hono** framework (fast, modern, edge-compatible), Drizzle ORM, JWT auth (access + refresh tokens), BullMQ + Redis for job queues, Zod for API validation, Resend for email notifications, Firebase Cloud Messaging for push notifications

**Database:** PostgreSQL (hosted on AWS RDS), Redis (ElastiCache) for queuing/caching

**File Storage:** AWS S3 + CloudFront CDN for all images/media

**Hosting:** AWS (ECS Fargate for backend, S3+CloudFront for frontend, RDS, ElastiCache)

**Match Data API:** Football-Data.org API (free tier covers all listed leagues) — fetched nightly via BullMQ cron job

**Monorepo structure:** Turborepo with `apps/web`, `apps/api`, `packages/shared` (shared Zod schemas, types)

---

##  DATABASE SCHEMA

Design and implement the full PostgreSQL schema using Drizzle ORM with migrations. Include these entities and relationships:

**Users** — id, email, password_hash, name, avatar_url, role (USER | VENUE_OWNER | ADMIN), created_at, updated_at

**VenueProfiles** — id, user_id (FK), name, description, address, city, lat, lng, cover_image_url, gallery_urls (array), phone, website, amenities (array: enum of TV, PROJECTOR, HOOKAH, VIP, SMOKE_FREE, ALCOHOLIC, OUTDOOR, WIFI, PARKING, etc.), cuisine_tags (array: ITALIAN, MEXICAN, CHINESE, JAPANESE, TURKISH, etc.), capacity, is_verified, is_active

**FootballTeams** — id, name, logo_url, league_id (for user interest selection)

**Leagues** — id, name, external_id (Football-Data.org), logo_url — seed with: MLS, NWSL, Liga MX, UEFA Champions League, English Premier League, Spanish La Liga, German Bundesliga, Italian Serie A, French Ligue 1

**Matches** — id, league_id (FK), external_match_id, home_team, away_team, home_team_logo, away_team_logo, match_date_utc, status (SCHEDULED|LIVE|FINISHED), venue_name (stadium), fetched_at

**VenueEvents** — id, venue_id (FK), match_id (FK), is_active, booking_limit (nullable), special_notes, created_at — represents a venue choosing to host a match

**Bookings** — id, user_id (FK), venue_event_id (FK), party_size, special_requests, status (PENDING|CONFIRMED|CANCELLED), created_at

**MenuCategories** — id, venue_id (FK), name, sort_order

**MenuItems** — id, category_id (FK), venue_id (FK), name, description, price, image_url, is_available, currency

**Posts** — id, venue_id (FK), content (text), image_urls (array), created_at, updated_at

**Follows** — id, user_id (FK), venue_id (FK), created_at

**Notifications** — id, user_id (FK), type, title, body, data (jsonb), is_read, created_at

**UserTeamInterests** — user_id (FK), team_id (FK)

---

##  API ENDPOINTS

Build a complete REST API with the following route groups. All protected routes require Bearer JWT. Venue-owner routes require role check.

### Auth `/api/auth`
- `POST /register` — name, email, password → creates USER
- `POST /register-venue` — same + venue info → creates VENUE_OWNER + VenueProfile
- `POST /login` → returns access_token (15min) + refresh_token (7d, httpOnly cookie)
- `POST /refresh` → new access token
- `POST /logout`

### Matches `/api/matches`
- `GET /` — query params: `league_id`, `date_from`, `date_to`, `team`, `has_venues` (boolean filter to only matches with at least one venue hosting), `page`, `limit`
- `GET /:matchId` — single match + venue count hosting it
- `GET /upcoming` — next 7 days, grouped by date

### Venues `/api/venues`
- `GET /` — query params: `match_id`, `city`, `amenities[]`, `cuisine[]`, `lat`, `lng`, `radius_km`, `page`, `limit` — returns venues with distance if lat/lng provided
- `GET /:venueId` — full venue profile
- `GET /:venueId/events` — upcoming events (matches being hosted)
- `GET /:venueId/posts` — paginated posts
- `GET /:venueId/menu` — menu with categories
- `POST /:venueId/follow` — (auth required) toggle follow
- `GET /following` — (auth required) venues the user follows

### Venue Dashboard `/api/dashboard` (VENUE_OWNER only)
- `GET /` — venue stats: total bookings, upcoming events count, follower count
- `GET /bookings` — all bookings for their venue, filterable by event
- `PUT /bookings/:bookingId` — update booking status
- `GET /events` — their hosted events
- `POST /events` — { match_id, booking_limit, special_notes }
- `DELETE /events/:eventId`
- `PUT /events/:eventId/booking-limit`
- `GET /menu` — full menu
- `POST /menu/categories`
- `PUT /menu/categories/:id`
- `DELETE /menu/categories/:id`
- `POST /menu/items`
- `PUT /menu/items/:id`
- `DELETE /menu/items/:id`
- `GET /posts`
- `POST /posts` — with image upload (multipart → S3)
- `DELETE /posts/:id`
- `POST /notify-followers` — { title, body, post_id? } — sends notification to all followers
- `PUT /venue` — edit venue profile, amenities, cuisine tags, images

### Bookings `/api/bookings` (auth required)
- `POST /` — { venue_event_id, party_size, special_requests }
- `GET /` — user's own bookings (with match + venue info)
- `DELETE /:bookingId` — cancel

### User `/api/user` (auth required)
- `GET /profile`
- `PUT /profile` — name, avatar_url
- `GET /interests` — followed teams
- `POST /interests` — { team_ids[] }
- `GET /notifications`
- `PUT /notifications/read-all`

### Admin `/api/admin`
- `GET /venues` — list all, verify/unverify
- `PUT /venues/:id/verify`
- `POST /seed-leagues` — seeds league + team data

### Cron Job (internal, not public)
- Nightly job at 02:00 UTC: fetch next 14 days of matches from Football-Data.org for all configured leagues, upsert into matches table, purge matches older than 60 days

---

##  FRONTEND PAGES & COMPONENTS

Build all pages with shadcn/ui components, full responsive design, mobile-first. Use React Query for all data fetching with proper loading skeletons and error states.

### Public Pages (no auth required to view)

**`/` — Home Page**
- Hero section with a search bar (city or venue name)
- "Upcoming Matches" horizontal scroll carousel — next 5 days, showing match cards (team logos, time, league badge, venue count badge)
- "Popular Venues Near You" section (if geolocation granted)
- League filter pills row (MLS, EPL, La Liga, etc.)
- Clean, modern dark-themed sports aesthetic

**`/matches` — All Matches Page**
- Full-width layout with left sidebar filters
- Filters: League (multi-select with league logos), Date range picker, "Only show matches with venues", Team search
- Match cards in a grid: home vs away teams with logos, match time in user's local timezone, league, number of venues hosting
- Click → `/matches/:matchId`

**`/matches/:matchId` — Match Detail Page**
- Match header (teams, score if live, date/time, league, stadium)
- Toggle between **List View** and **Map View** of hosting venues
- Map View: Mapbox GL JS map with venue pins, click pin → venue card popover
- List View: venue cards with name, address, distance, amenity badges (TV , Projector, VIP, Hookah icons), cuisine tags, available spots indicator, "Book Now" CTA
- Filter panel: amenities (checkboxes), cuisine type (checkboxes), distance radius slider, sort by (distance, rating, spots available)

**`/venues/:venueId` — Venue Profile Page**
- Cover photo + gallery carousel
- Venue name, address (with map pin link), phone, website, hours
- Amenities icons row
- **Tab navigation:**
  - **Events** tab: upcoming matches being hosted as cards — if user came from a match page (`/matches/:matchId/venue/:venueId`), that match is pre-selected and booking panel is open
  - **Posts** tab: social-media-style post feed with images
  - **Menu** tab: categorized menu with item cards, prices, images
- Booking Panel (slides in or is a sticky sidebar on desktop): shows when an event is selected — party size selector (1-20), special requests textarea, "Reserve Spot" button (auth-gated), shows remaining spots if limit set
- Follow button (auth-gated) in venue header

**`/venues` — Browse All Venues**
- Search + filters (city, amenities, cuisine)
- Grid of venue cards

### Auth Pages
- `/login`, `/register`, `/register-venue` — clean modal-able pages with React Hook Form + Zod validation

### Authenticated User Pages

**`/dashboard` — User Dashboard**
- "My Bookings" — upcoming and past bookings, cancel upcoming ones, with match + venue info
- "Following" tab — venues the user follows with latest post preview
- "My Interests" — team selection interface (searchable grid of team logos with toggle)
- Profile edit (name, avatar upload)

**`/feed` — Following Feed**
- Posts from followed venues in chronological order
- Match reminders for events at followed venues happening soon
- "Upcoming at your venues" section

### Venue Owner Dashboard `/venue-dashboard`
- Protected route (VENUE_OWNER role only)
- **Overview** — stats cards: upcoming events, total bookings this week, followers, recent activity feed
- **Events** — search upcoming matches → select to host → set booking limit → publish; list of hosted events with booking counts
- **Bookings Manager** — table with booking details, filter by event, confirm/cancel actions, export CSV
- **Menu Editor** — drag-to-reorder categories, add/edit/delete items with image upload, toggle availability
- **Posts** — create post with text + image upload (multi-image), post feed management, delete posts
- **Notify Followers** — compose notification title + body, preview, send (triggers push + in-app notifications)
- **Venue Settings** — edit all venue info, amenities checkboxes, cuisine tags, gallery images

---

##  KEY UX FLOWS

Describe and implement these as smooth, complete flows:

1. **Guest visits home → sees match → finds venue → creates account → books spot** — the booking intent should be preserved through auth redirect
2. **Venue owner registers → sets up profile → selects a match to host → sets limit → receives booking notification**
3. **User follows venue → venue posts → user gets notification → opens app to see post**
4. **User arrives at `/matches/123` from a share link → sees venues on map → clicks venue → lands on venue page with that match pre-loaded in booking panel**

---

##  NOTIFICATION SYSTEM

Implement a layered notification system:
- **In-app** — notifications table, bell icon in nav with unread count badge, dropdown list
- **Email** — Resend integration: booking confirmation to user, new booking alert to venue, booking cancellation
- **Push** (structure FCM integration, implement registration token storage, send on venue "notify followers" action)

---

##  MATCH DATA FETCHING SERVICE

Implement a BullMQ worker (`apps/api/src/workers/matchSync.ts`) that:
- Runs nightly at 02:00 UTC
- Iterates over all leagues in DB (with their Football-Data.org competition codes)
- Fetches matches for next 14 days from `https://api.football-data.org/v4/competitions/{code}/matches`
- Upserts into matches table (never duplicates on external_match_id)
- Logs sync results
- Has a manual trigger endpoint `POST /api/admin/sync-matches` for testing
- Handles API rate limiting gracefully (429 backoff)

League codes to seed: PL (Premier League), PD (La Liga), BL1 (Bundesliga), SA (Serie A), FL1 (Ligue 1), CL (Champions League), MLS (MLS)

---

##  DEPLOYMENT & INFRASTRUCTURE

Provide:
- `Dockerfile` for the API (multi-stage, Node 20 Alpine)
- `docker-compose.yml` for local dev (api, postgres, redis)
- AWS architecture notes: ECS Fargate task definition structure, RDS PostgreSQL, ElastiCache Redis, S3 bucket + CloudFront for frontend + media
- `.env.example` with all required environment variables
- GitHub Actions CI/CD workflow: lint → test → build → push to ECR → deploy to ECS

---

##  PROJECT STRUCTURE

Scaffold the complete monorepo:

```
footwatch/
├── apps/
│   ├── api/                    # Hono backend
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── workers/        # BullMQ
│   │   │   ├── services/
│   │   │   ├── db/             # Drizzle schema + migrations
│   │   │   └── lib/            # S3, email, FCM, etc.
│   │   └── Dockerfile
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   │   ├── ui/         # shadcn
│       │   │   ├── venue/
│       │   │   ├── match/
│       │   │   ├── booking/
│       │   │   └── dashboard/
│       │   ├── hooks/
│       │   ├── stores/         # Zustand
│       │   ├── lib/            # API client, utils
│       │   └── types/
├── packages/
│   └── shared/                 # Zod schemas, TS types
├── turbo.json
├── docker-compose.yml
└── package.json
```

---

##  EXECUTION INSTRUCTIONS FOR CLAUDE

Work through this project in the following order. After each phase, confirm completion before moving to the next:

1. **Phase 1 — Monorepo scaffold + shared types** — Set up Turborepo, shared Zod schemas for all entities, TypeScript configs
2. **Phase 2 — Database** — Full Drizzle schema, all migrations, seed script (leagues, teams, sample venues + matches)
3. **Phase 3 — API core** — Hono app setup, all middleware (auth JWT, CORS, error handler, logger), all route files with full implementation
4. **Phase 4 — Match sync worker** — BullMQ cron + Football-Data.org integration
5. **Phase 5 — S3 + file upload** — Presigned URL generation, multipart form handling
6. **Phase 6 — Notification system** — In-app, email (Resend), push (FCM) 
7. **Phase 7 — Frontend routing + layout** — React app, shadcn setup, layout (nav, footer, auth modals), routing
8. **Phase 8 — All public pages** — Home, Matches list, Match detail with map, Venue profile with tabs + booking panel
9. **Phase 9 — User dashboard** — Bookings, feed, interests, profile
10. **Phase 10 — Venue owner dashboard** — Full dashboard with all management features
11. **Phase 11 — Docker + CI/CD** — Dockerfiles, docker-compose, GitHub Actions
12. **Phase 12 — Polish** — Loading states, error boundaries, mobile responsiveness audit, accessibility pass

For every file you create, write the **complete, working code** — no placeholders, no `// TODO`, no truncation. If a file is long, write it fully. Ask for confirmation only if a genuine architectural ambiguity exists that would require backtracking if assumed wrong. Otherwise, make the best decision and proceed.

Begin with Phase 1.

---

**End of prompt.** Copy everything between the `---` lines and paste directly to Claude Opus 4.6 in a new conversation. It has all context needed to build the full system end-to-end.


Here's your full, production-grade, startup-ready prompt:

---

#  FootWatch Platform — Complete Engineering Specification for Claude Opus 4.6

---

## SYSTEM ROLE

You are a principal full-stack engineer and solutions architect with 15+ years of experience building consumer-scale startups. You write clean, typed, testable, secure, production-ready code. You make opinionated decisions and justify them. You never truncate code, never use placeholders, never write `// TODO`. Every file you produce is complete and immediately runnable. You follow OWASP security guidelines, 12-factor app methodology, and modern TypeScript best practices throughout.

Build **FootWatch** — a startup-grade platform connecting football fans with cafés and restaurants hosting match watch parties. Think of it as the intersection of OpenTable, Eventbrite, and a sports social network.

---

##  ARCHITECTURE OVERVIEW

### Monorepo — Turborepo
```
footwatch/
├── apps/
│   ├── api/          # Node.js + Hono backend (TypeScript)
│   ├── web/          # React 18 frontend (TypeScript + Vite)
│   └── admin/        # Internal admin panel (React, separate deploy)
├── packages/
│   ├── shared/       # Zod schemas, TypeScript types, constants
│   ├── ui/           # Shared shadcn/ui component library
│   ├── email/        # React Email templates
│   └── config/       # Shared ESLint, TypeScript, Tailwind configs
├── infra/            # Pulumi IaC for AWS
├── .github/
│   └── workflows/    # CI/CD pipelines
├── docker-compose.yml
├── turbo.json
└── package.json
```

### Design Principles
- **Security first** — OWASP Top 10 mitigated by default
- **Zero trust** — every request authenticated and authorized independently
- **Event-driven** — side effects (notifications, emails) handled asynchronously via queues
- **Observability** — structured logging, distributed tracing, metrics from day one
- **Horizontal scalability** — stateless API, external session/cache layer
- **Type safety end-to-end** — shared Zod schemas generate TypeScript types used by both API and frontend

---

##  SECURITY SPECIFICATION (Non-Negotiable)

Implement every single one of these. They are not optional.

### Authentication & Session Security
- JWT access tokens — 15 minute expiry, RS256 signed (asymmetric, not HS256) — private key stored in AWS Secrets Manager
- Refresh tokens — 30 day expiry, stored as `httpOnly`, `Secure`, `SameSite=Strict` cookie, stored hashed (bcrypt) in DB
- Refresh token rotation — every use issues a new refresh token and invalidates the old one
- Refresh token family tracking — if a stolen/reused old token is detected, invalidate entire family (detect token theft)
- Device fingerprinting on login — store user agent + IP hash per refresh token session
- Concurrent session limit — max 5 active sessions per user, oldest invalidated on exceed
- Account lockout — 5 failed login attempts → 15 minute lockout with exponential backoff, stored in Redis
- Password policy — min 10 chars, require upper + lower + number + special, check against HaveIBeenPwned API on registration
- Email verification required before first login
- Password reset via time-limited (1 hour) signed token sent to email — token single-use, invalidated after use

### API Security
- Helmet.js equivalent headers via Hono middleware — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Rate limiting — tiered:
  - Auth endpoints: 10 requests/15min per IP
  - Public endpoints: 100 requests/min per IP
  - Authenticated endpoints: 300 requests/min per user
  - Admin endpoints: 50 requests/min per user
  - Stored in Redis with sliding window algorithm
- CORS — explicit allowlist of origins, no wildcard in production
- Request ID — every request gets `X-Request-ID` header (UUID v4), logged throughout
- Input validation — all inputs validated via Zod before hitting any business logic; never trust client data
- SQL injection — impossible by design (Drizzle ORM parameterized queries only; raw SQL banned)
- XSS prevention — all user content sanitized with `DOMPurify` server-side before storage
- File upload security:
  - MIME type validation (magic bytes, not just extension)
  - File size limits (images: 10MB, max 10 per post)
  - Virus scanning via ClamAV Lambda trigger on S3 upload
  - Randomized S3 key names (UUID), never expose original filename
  - Only allow: JPEG, PNG, WebP, GIF
  - Strip EXIF data server-side before serving
- Sensitive data — PII encrypted at rest using AES-256 for email + phone fields
- Secrets — zero hardcoded secrets; all from environment variables sourced from AWS Secrets Manager
- HTTPS only — HSTS preload, redirect all HTTP → HTTPS at load balancer level
- Audit log — immutable append-only log table for: login, logout, booking create/cancel, venue settings change, admin actions

### Authorization Model
- Role-Based Access Control (RBAC): `GUEST | USER | VENUE_OWNER | ADMIN | SUPER_ADMIN`
- Resource-level ownership checks — venue owners can only modify their own venue's data (checked in service layer, not just middleware)
- Admin impersonation — admins can view-as user for support purposes (logged in audit trail)

---

##  DATABASE SPECIFICATION

### Technology
- PostgreSQL 16 on AWS RDS (Multi-AZ for production)
- Drizzle ORM with full migrations
- `pgcrypto` extension for UUID generation
- `pg_trgm` extension for fuzzy text search on venue names
- Read replica for analytics/reporting queries
- Connection pooling via PgBouncer (or RDS Proxy)

### Complete Schema

**`users`**
```
id (uuid, pk, default gen_random_uuid())
email (varchar 255, unique, not null) -- encrypted at rest
email_verified (boolean, default false)
email_verification_token (varchar, nullable)
email_verification_expires_at (timestamp, nullable)
password_hash (varchar, not null)
name (varchar 100, not null)
avatar_url (varchar, nullable)
avatar_s3_key (varchar, nullable)
role (enum: USER|VENUE_OWNER|ADMIN|SUPER_ADMIN, default USER)
is_active (boolean, default true)
is_suspended (boolean, default false)
suspension_reason (text, nullable)
failed_login_attempts (int, default 0)
locked_until (timestamp, nullable)
last_login_at (timestamp, nullable)
last_login_ip (varchar, nullable)
timezone (varchar, default 'UTC')
locale (varchar, default 'en')
push_token (varchar, nullable)
created_at (timestamp, default now())
updated_at (timestamp, default now())
deleted_at (timestamp, nullable) -- soft delete
```

**`refresh_token_sessions`**
```
id (uuid, pk)
user_id (uuid, FK → users, cascade delete)
token_hash (varchar, not null) -- bcrypt hash of token
family_id (uuid, not null) -- for theft detection
device_info (jsonb) -- {userAgent, ip_hash, device_name}
expires_at (timestamp, not null)
last_used_at (timestamp)
is_revoked (boolean, default false)
created_at (timestamp)
```

**`audit_logs`**
```
id (uuid, pk)
user_id (uuid, nullable, FK → users)
action (varchar, not null) -- e.g. 'USER_LOGIN', 'BOOKING_CREATED'
entity_type (varchar, nullable) -- 'Booking', 'Venue', etc.
entity_id (uuid, nullable)
metadata (jsonb) -- before/after state, IP, device
ip_address (inet)
user_agent (text)
created_at (timestamp, default now())
-- no updates, no deletes, append-only enforced via Postgres trigger
```

**`leagues`**
```
id (uuid, pk)
name (varchar, not null)
short_name (varchar)
logo_url (varchar)
external_id (varchar, unique) -- Football-Data.org code
country (varchar)
is_active (boolean, default true)
sort_order (int)
created_at (timestamp)
```

**`teams`**
```
id (uuid, pk)
name (varchar, not null)
short_name (varchar)
crest_url (varchar)
league_id (uuid, FK → leagues)
external_id (varchar, unique)
is_active (boolean, default true)
created_at (timestamp)
```

**`matches`**
```
id (uuid, pk)
external_match_id (varchar, unique, not null)
league_id (uuid, FK → leagues)
home_team_id (uuid, FK → teams, nullable)
away_team_id (uuid, FK → teams, nullable)
home_team_name (varchar) -- denormalized for resilience
away_team_name (varchar)
home_team_crest_url (varchar)
away_team_crest_url (varchar)
home_score (int, nullable)
away_score (int, nullable)
match_date_utc (timestamp, not null)
status (enum: SCHEDULED|TIMED|IN_PLAY|PAUSED|FINISHED|POSTPONED|CANCELLED|SUSPENDED)
match_day (int, nullable)
stage (varchar, nullable) -- 'GROUP_STAGE', 'FINAL', etc.
venue_name (varchar, nullable) -- stadium name
last_synced_at (timestamp)
created_at (timestamp)
updated_at (timestamp)
```

**`venues`**
```
id (uuid, pk)
owner_id (uuid, FK → users, not null)
name (varchar 150, not null)
slug (varchar, unique, not null) -- URL-friendly, auto-generated
description (text)
short_description (varchar 280)
address_line1 (varchar, not null)
address_line2 (varchar, nullable)
city (varchar, not null)
state_province (varchar)
country (varchar, not null)
postal_code (varchar)
lat (decimal 10,8, not null)
lng (decimal 11,8, not null)
timezone (varchar, not null) -- IANA timezone string
cover_image_url (varchar)
cover_image_s3_key (varchar)
gallery_s3_keys (text[], default '{}')
phone (varchar) -- encrypted
website (varchar)
instagram_handle (varchar)
google_maps_url (varchar)
capacity (int)
average_rating (decimal 3,2, default 0) -- denormalized, updated via trigger
total_reviews (int, default 0)
amenities (text[], not null, default '{}')
cuisine_tags (text[], not null, default '{}')
price_range (enum: BUDGET|MID|UPSCALE|LUXURY)
is_verified (boolean, default false)
is_active (boolean, default true)
is_featured (boolean, default false)
stripe_account_id (varchar, nullable) -- for future payment integration
metadata (jsonb, default '{}') -- extensible
created_at (timestamp)
updated_at (timestamp)
deleted_at (timestamp, nullable)
-- GiST index on (lat, lng) for geo queries
-- GIN index on amenities for array containment
-- GIN index on cuisine_tags for array containment
-- pg_trgm index on name for fuzzy search
```

**`venue_events`** (a venue hosting a match)
```
id (uuid, pk)
venue_id (uuid, FK → venues, not null)
match_id (uuid, FK → matches, not null)
is_active (boolean, default true)
booking_limit (int, nullable) -- null = unlimited
confirmed_bookings_count (int, default 0) -- denormalized, updated via trigger
special_notes (text)
custom_price (decimal, nullable) -- cover charge / entry fee
currency (varchar 3, default 'USD')
doors_open_at (timestamp, nullable)
requires_approval (boolean, default false) -- manual booking confirmation
created_at (timestamp)
updated_at (timestamp)
unique constraint on (venue_id, match_id)
```

**`bookings`**
```
id (uuid, pk)
booking_reference (varchar 12, unique, not null) -- human-readable e.g. "FW-A3K9PX"
user_id (uuid, FK → users)
venue_event_id (uuid, FK → venue_events)
party_size (int, not null, check > 0 and <= 20)
special_requests (text, nullable)
status (enum: PENDING|CONFIRMED|CANCELLED_BY_USER|CANCELLED_BY_VENUE|NO_SHOW)
cancellation_reason (text, nullable)
cancelled_at (timestamp, nullable)
cancelled_by (uuid, nullable, FK → users)
reminder_sent_at (timestamp, nullable)
check_in_at (timestamp, nullable)
metadata (jsonb, default '{}')
created_at (timestamp)
updated_at (timestamp)
```

**`menu_categories`**
```
id (uuid, pk)
venue_id (uuid, FK → venues)
name (varchar 100, not null)
description (varchar 500)
sort_order (int, default 0)
is_active (boolean, default true)
created_at (timestamp)
```

**`menu_items`**
```
id (uuid, pk)
category_id (uuid, FK → menu_categories)
venue_id (uuid, FK → venues)
name (varchar 150, not null)
description (text)
price (decimal 10,2, not null)
currency (varchar 3, default 'USD')
image_url (varchar)
image_s3_key (varchar)
is_available (boolean, default true)
is_featured (boolean, default false)
dietary_tags (text[]) -- VEGAN, VEGETARIAN, GLUTEN_FREE, HALAL, KOSHER
allergens (text[]) -- NUTS, DAIRY, GLUTEN, etc.
sort_order (int, default 0)
created_at (timestamp)
updated_at (timestamp)
```

**`posts`**
```
id (uuid, pk)
venue_id (uuid, FK → venues)
author_id (uuid, FK → users)
content (text, not null)
image_s3_keys (text[], default '{}')
image_urls (text[], default '{}')
match_id (uuid, nullable, FK → matches) -- optional match tag
is_published (boolean, default true)
scheduled_publish_at (timestamp, nullable)
views_count (int, default 0)
created_at (timestamp)
updated_at (timestamp)
deleted_at (timestamp, nullable)
```

**`follows`**
```
id (uuid, pk)
user_id (uuid, FK → users)
venue_id (uuid, FK → venues)
created_at (timestamp)
unique constraint on (user_id, venue_id)
```

**`reviews`**
```
id (uuid, pk)
user_id (uuid, FK → users)
venue_id (uuid, FK → venues)
venue_event_id (uuid, nullable, FK → venue_events)
booking_id (uuid, nullable, FK → bookings) -- only verified attendees
rating (int, check 1-5, not null)
title (varchar 200)
content (text)
owner_reply (text, nullable)
owner_replied_at (timestamp, nullable)
is_verified_visit (boolean, default false) -- had confirmed booking
is_flagged (boolean, default false)
created_at (timestamp)
updated_at (timestamp)
```

**`notifications`**
```
id (uuid, pk)
user_id (uuid, FK → users)
type (enum: BOOKING_CONFIRMED|BOOKING_CANCELLED|VENUE_POST|MATCH_REMINDER|VENUE_NOTIFICATION|SYSTEM)
title (varchar 200, not null)
body (text, not null)
action_url (varchar)
image_url (varchar)
data (jsonb, default '{}')
is_read (boolean, default false)
read_at (timestamp, nullable)
expires_at (timestamp, nullable)
created_at (timestamp)
```

**`user_team_interests`**
```
user_id (uuid, FK → users)
team_id (uuid, FK → teams)
created_at (timestamp)
primary key (user_id, team_id)
```

**`venue_claims`** (for claiming unclaimed venue listings)
```
id (uuid, pk)
venue_id (uuid, FK → venues)
claimant_user_id (uuid, FK → users)
status (enum: PENDING|APPROVED|REJECTED)
verification_documents (text[]) -- S3 keys
notes (text)
reviewed_by (uuid, nullable, FK → users)
reviewed_at (timestamp, nullable)
created_at (timestamp)
```

**`waitlist`** (when booking limit is full)
```
id (uuid, pk)
user_id (uuid, FK → users)
venue_event_id (uuid, FK → venue_events)
party_size (int)
position (int) -- ordered position in queue
notified_at (timestamp, nullable)
expires_at (timestamp)
created_at (timestamp)
unique on (user_id, venue_event_id)
```

**`promotions`** (future — venue can create deals for events)
```
id (uuid, pk)
venue_id (uuid, FK → venues)
venue_event_id (uuid, nullable, FK → venue_events)
title (varchar 200)
description (text)
discount_type (enum: PERCENTAGE|FIXED|FREE_ITEM)
discount_value (decimal)
code (varchar 50, nullable, unique) -- promo code
max_uses (int, nullable)
used_count (int, default 0)
valid_from (timestamp)
valid_until (timestamp)
is_active (boolean)
created_at (timestamp)
```

---

##  COMPLETE API SPECIFICATION

### Base URL: `/api/v1`

All responses follow this envelope:
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 },
  "requestId": "uuid"
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": [ { "field": "email", "message": "Invalid email" } ]
  },
  "requestId": "uuid"
}
```

Error codes to implement: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, `ACCOUNT_LOCKED`, `EMAIL_NOT_VERIFIED`, `INSUFFICIENT_SPOTS`, `BOOKING_LIMIT_REACHED`

---

### `POST /api/v1/auth/register`
Body: `{ email, password, name, timezone, locale? }`
- Validate password strength + HaveIBeenPwned check
- Hash password with bcrypt (cost factor 12)
- Send verification email with signed token
- Return: `{ message: "Verification email sent" }` — do NOT auto-login before verification
- Honeypot field: include `website` field in schema — if filled, silently fail (bot trap)

### `POST /api/v1/auth/register-venue`
Body: `{ email, password, name, venue: { name, address, city, country, lat, lng, timezone, phone, description, amenities[], cuisine_tags[], price_range, capacity } }`
- Same security as register
- Creates USER + VENUE_OWNER role + VenueProfile in transaction
- Queues welcome email with venue setup checklist

### `POST /api/v1/auth/verify-email`
Body: `{ token }` — verifies email, marks account active

### `POST /api/v1/auth/login`
Body: `{ email, password, device_name? }`
- Check lockout, increment failures on wrong password
- On success: generate RS256 JWT (access token) + refresh token
- Set refresh token as httpOnly cookie
- Return access token in body + user profile
- Log login event in audit_logs

### `POST /api/v1/auth/refresh`
- Read refresh token from cookie
- Validate, check family not revoked
- Rotate: issue new refresh token, revoke old
- Return new access token

### `POST /api/v1/auth/logout`
- Revoke current refresh token session
- Clear cookie

### `POST /api/v1/auth/logout-all`
- Revoke entire token family (all sessions)

### `GET /api/v1/auth/sessions`
- List all active sessions (device info, last used)

### `DELETE /api/v1/auth/sessions/:sessionId`
- Revoke specific session

### `POST /api/v1/auth/forgot-password`
Body: `{ email }` — always returns same response regardless of email existence (prevent user enumeration)

### `POST /api/v1/auth/reset-password`
Body: `{ token, password }`

### `POST /api/v1/auth/change-password`
Body: `{ currentPassword, newPassword }` — auth required, invalidates all other sessions

---

### Matches

### `GET /api/v1/matches`
Query: `league_id`, `team_id`, `date_from` (ISO), `date_to`, `status`, `has_venues` (bool), `city`, `page`, `limit` (max 50), `sort` (date_asc|date_desc)
- Returns matches with: league info, team info, venue_count hosting it, your_team flag if user authed + has interests

### `GET /api/v1/matches/upcoming`
- Next 14 days, grouped by date: `{ "2025-03-15": [ ...matches ] }`

### `GET /api/v1/matches/:matchId`
- Full match detail + venue count + if user is following any hosting venues

### `GET /api/v1/matches/:matchId/venues`
Query: `lat`, `lng`, `radius_km` (default 50), `amenities[]`, `cuisine[]`, `price_range[]`, `page`, `limit`, `sort` (distance|rating|spots)
- Returns venues hosting this match with: distance (if lat/lng), spots remaining, amenity badges, rating, cover image

---

### Venues

### `GET /api/v1/venues`
Query: `q` (fuzzy name search), `city`, `country`, `lat`, `lng`, `radius_km`, `amenities[]`, `cuisine[]`, `price_range[]`, `is_verified`, `page`, `limit`, `sort`

### `GET /api/v1/venues/:slugOrId`
- Full venue profile: info, gallery, amenities, upcoming events (next 5), recent posts (3), rating summary

### `GET /api/v1/venues/:slugOrId/events`
Query: `from`, `to`, `page`, `limit`
- Upcoming matches venue is hosting + booking availability

### `GET /api/v1/venues/:slugOrId/posts`
Query: `page`, `limit`

### `GET /api/v1/venues/:slugOrId/menu`
- Full menu organized by category

### `GET /api/v1/venues/:slugOrId/reviews`
Query: `page`, `limit`, `rating` (filter by star)
- Reviews with reviewer name/avatar, verified badge, owner reply

### `POST /api/v1/venues/:slugOrId/reviews`
Auth required + must have confirmed booking at this venue
Body: `{ rating, title, content, venue_event_id? }`

### `POST /api/v1/venues/:slugOrId/follow`
Auth required — toggle follow, returns `{ following: boolean }`

### `GET /api/v1/venues/following`
Auth required — paginated list of followed venues

---

### Bookings

### `POST /api/v1/bookings`
Auth required
Body: `{ venue_event_id, party_size, special_requests? }`
- Check spots available (atomic with row-level lock)
- Generate booking reference (FW-XXXXXX format, collision-free)
- If venue requires_approval → PENDING, else → CONFIRMED
- Increment venue_event confirmed_bookings_count
- Queue: confirmation email, venue notification
- If event full → add to waitlist instead (with response indicating waitlist position)

### `GET /api/v1/bookings`
Auth required — user's own bookings
Query: `status`, `from`, `to`, `page`, `limit`

### `GET /api/v1/bookings/:bookingId`
Auth required — must own booking

### `DELETE /api/v1/bookings/:bookingId`
Auth required — cancels booking
- Can only cancel if match hasn't started
- Decrements confirmed_bookings_count
- Notifies next person on waitlist if exists

---

### User

### `GET /api/v1/user/profile`
### `PATCH /api/v1/user/profile`
Body: `{ name?, timezone?, locale?, push_token? }`

### `POST /api/v1/user/avatar`
Multipart — upload avatar image → S3

### `GET /api/v1/user/interests`
### `PUT /api/v1/user/interests`
Body: `{ team_ids[] }`

### `GET /api/v1/user/feed`
Auth required — posts from followed venues, sorted by recency, paginated

### `GET /api/v1/user/notifications`
Query: `is_read`, `page`, `limit`

### `POST /api/v1/user/notifications/read`
Body: `{ ids[]? }` — marks specific or all as read

---

### Venue Dashboard (VENUE_OWNER, own venue only)

### `GET /api/v1/dashboard/overview`
Returns: `{ upcoming_events_count, this_week_bookings, total_followers, pending_bookings, total_revenue_potential, recent_bookings[5] }`

### `GET /api/v1/dashboard/bookings`
Query: `venue_event_id`, `status`, `date_from`, `date_to`, `page`, `limit`, `sort`
Full booking list with user info, party size, special requests

### `PATCH /api/v1/dashboard/bookings/:bookingId`
Body: `{ status, cancellation_reason? }`

### `POST /api/v1/dashboard/bookings/:bookingId/check-in`
Mark booking as checked-in (day of event only)

### `GET /api/v1/dashboard/bookings/export`
Returns CSV of bookings for a given event

### `GET /api/v1/dashboard/events`
Query: `from`, `to`, `is_active`

### `POST /api/v1/dashboard/events`
Body: `{ match_id, booking_limit?, special_notes?, custom_price?, currency?, doors_open_at?, requires_approval? }`

### `PATCH /api/v1/dashboard/events/:eventId`
### `DELETE /api/v1/dashboard/events/:eventId`

### `GET /api/v1/dashboard/menu`
### `POST /api/v1/dashboard/menu/categories`
### `PATCH /api/v1/dashboard/menu/categories/:id`
### `DELETE /api/v1/dashboard/menu/categories/:id`
### `PUT /api/v1/dashboard/menu/categories/reorder`
Body: `{ ordered_ids[] }`

### `POST /api/v1/dashboard/menu/items`
### `PATCH /api/v1/dashboard/menu/items/:id`
### `DELETE /api/v1/dashboard/menu/items/:id`

### `GET /api/v1/dashboard/posts`
### `POST /api/v1/dashboard/posts`
Multipart: `{ content, images[], match_id?, scheduled_publish_at? }`

### `PATCH /api/v1/dashboard/posts/:id`
### `DELETE /api/v1/dashboard/posts/:id`

### `POST /api/v1/dashboard/notify-followers`
Body: `{ title, body, action_url?, post_id? }`
- Rate limited: max 3 notifications per venue per day
- Queues FCM push + in-app notifications for all followers

### `GET /api/v1/dashboard/venue`
### `PATCH /api/v1/dashboard/venue`
Multipart or JSON: all venue editable fields

### `POST /api/v1/dashboard/venue/gallery`
Multipart: add images to gallery

### `DELETE /api/v1/dashboard/venue/gallery/:s3Key`

### `GET /api/v1/dashboard/analytics`
Query: `from`, `to`
Returns: `{ bookings_over_time[], top_events[], peak_days[], cancellation_rate, avg_party_size }`

---

### Admin (`/api/v1/admin` — ADMIN role required)

### `GET /api/v1/admin/users` — search, filter by role, suspend/unsuspend
### `PATCH /api/v1/admin/users/:id` — update role, suspend, force-reset password
### `GET /api/v1/admin/venues` — all venues, verify, feature, deactivate
### `PATCH /api/v1/admin/venues/:id`
### `GET /api/v1/admin/audit-logs` — filterable audit log viewer
### `POST /api/v1/admin/sync-matches` — trigger manual match sync
### `GET /api/v1/admin/sync-history` — match sync job history
### `POST /api/v1/admin/seed` — seed leagues + teams from Football-Data.org
### `GET /api/v1/admin/stats` — platform-wide stats (users, bookings, venues, matches)

---

### Upload Endpoints

### `POST /api/v1/upload/presigned`
Auth required
Body: `{ filename, contentType, purpose: 'avatar'|'venue_cover'|'venue_gallery'|'menu_item'|'post' }`
Returns: `{ uploadUrl (presigned S3 PUT URL, 10min expiry), s3Key, publicUrl }`
Frontend uploads directly to S3, then passes s3Key back to API

---

##  BACKEND SERVICES & WORKERS

### Match Sync Service (`workers/matchSync.worker.ts`)
- BullMQ repeatable job: every night 02:00 UTC
- For each active league with external_id:
  - Fetch from `https://api.football-data.org/v4/competitions/{code}/matches?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`
  - Parse + validate response with Zod
  - Upsert matches (insert or update on external_match_id conflict)
  - Upsert teams encountered (create if new)
  - Update match status for ongoing/finished matches
  - Sync match scores for in-progress/finished matches
  - Record sync result in sync_history table
  - Handle 429 with exponential backoff + jitter
  - Alert via email if sync fails 3 consecutive times

### Notification Worker (`workers/notification.worker.ts`)
- Processes `notification` queue
- Job types: `SEND_PUSH`, `SEND_EMAIL`, `SEND_IN_APP`
- FCM batch send (up to 500 tokens per request)
- Email via Resend with React Email templates
- Dead letter queue for failed jobs with retry policy (3 attempts, exponential backoff)

### Match Reminder Worker (`workers/reminder.worker.ts`)
- Runs every hour
- Finds bookings for matches starting in 24 hours + 2 hours
- Sends reminder notification (in-app + push) if not already sent
- Updates reminder_sent_at

### Waitlist Worker (`workers/waitlist.worker.ts`)
- Triggered when booking is cancelled
- Finds next person on waitlist for that venue event
- Notifies them that a spot is available (24 hour window to confirm)
- If they don't confirm within 24h, moves to next person

### Analytics Aggregation Worker
- Nightly job: precompute venue analytics (bookings_by_day, popular_events, etc.) into materialized views or separate analytics tables for fast dashboard loading

---

##  EMAIL TEMPLATES (React Email)

Build all templates in `packages/email/` with proper HTML email compatibility:

1. **Welcome Email** — for new users
2. **Venue Welcome Email** — for venue owners (with setup checklist)
3. **Email Verification** — with CTA button
4. **Password Reset** — with secure link + expiry notice
5. **Booking Confirmation** — to user (booking ref, match details, venue address, map link, QR code of booking ref)
6. **Booking Received** — to venue owner (new booking notification)
7. **Booking Confirmed by Venue** — to user (when venue manually confirms)
8. **Booking Cancelled** — to user
9. **Booking Cancelled by Venue** — to user with apology
10. **Match Reminder** — 24hr and 2hr before (with venue address)
11. **Waitlist Spot Available** — urgent CTA, 24hr to claim
12. **Venue New Follower Digest** — weekly digest to venue owner
13. **New Review** — notify venue of new review
14. **Account Suspended** — with appeal instructions
15. **Sync Failure Alert** — to admin team

---

##  FRONTEND SPECIFICATION

### Setup
- React 18 + TypeScript + Vite
- shadcn/ui (fully configured, all required components installed)
- Tailwind CSS with custom design tokens
- React Router v6 with lazy loading on all routes
- TanStack Query v5 for server state
- Zustand for client state (auth, UI state)
- React Hook Form + Zod for all forms
- Mapbox GL JS for maps
- `date-fns` + `date-fns-tz` for timezone-aware date handling
- `axios` with interceptors for token refresh
- `react-hot-toast` for toasts
- Framer Motion for animations
- `react-dropzone` for file uploads
- `react-virtuoso` for virtualized lists

### Design System
- Dark sports aesthetic: near-black background (#0A0A0B), electric green accent (#22C55E — green-500), card backgrounds (#111113), borders (#1E1E22)
- Typography: Inter for body, Geist Mono for match scores/references
- Responsive: mobile-first, breakpoints: sm(640) md(768) lg(1024) xl(1280) 2xl(1536)
- Motion: subtle entrance animations (fade-up), hover micro-interactions, skeleton loaders matching exact card layouts
- Accessibility: WCAG 2.1 AA — proper ARIA labels, keyboard navigation, focus rings, color contrast ratios

### Routing Structure
```
/ → Home
/matches → All Matches
/matches/:matchId → Match Detail
/matches/:matchId/venues → Venue List for Match (also accessible via match detail tabs)
/venues → Browse Venues
/venues/:slug → Venue Profile
/venues/:slug/events → Venue Events tab
/venues/:slug/menu → Menu tab
/login → Login
/register → Register
/register-venue → Venue Registration
/verify-email → Email Verification
/forgot-password → Forgot Password
/reset-password → Reset Password

/dashboard → User Dashboard (auth required)
/dashboard/bookings → My Bookings
/dashboard/following → Following
/dashboard/interests → My Teams
/dashboard/profile → Edit Profile
/dashboard/feed → My Feed
/dashboard/notifications → All Notifications

/venue-dashboard → Venue Owner Dashboard (VENUE_OWNER required)
/venue-dashboard/overview → Overview & Stats
/venue-dashboard/events → Manage Events
/venue-dashboard/bookings → Manage Bookings
/venue-dashboard/menu → Menu Editor
/venue-dashboard/posts → Posts Manager
/venue-dashboard/notify → Notify Followers
/venue-dashboard/analytics → Analytics
/venue-dashboard/settings → Venue Settings

/admin → Admin Panel (ADMIN required)
/admin/users
/admin/venues
/admin/matches
/admin/sync
/admin/audit-logs
/admin/stats
```

---

### Page Specifications

**Home Page (`/`)**
- Full-width hero with animated football field background (CSS/SVG), headline, and dual CTA (Find a Watch Party / List Your Venue)
- Geolocation prompt card: "Share location to see nearby venues"
- Live matches ticker (auto-refreshing, polling every 60s)
- "Today's Matches" horizontal scroll — match cards showing: team crests, kickoff time in user timezone, league logo, "X venues hosting" badge, hot badge if > 5 venues
- League quick-filter pills row with logos
- "Featured Venues Near You" grid (if location shared) or "Popular Venues" citywide
- "Upcoming Big Matches" — next high-profile fixtures (Champions League final, derbies etc.) with large hero cards
- How It Works section (3-step: Find Match → Pick Venue → Reserve Spot)
- Download app CTA section (placeholder for future mobile app)
- Footer with links, social, newsletter signup

**Matches Page (`/matches`)**
- Sticky filter sidebar (left on desktop, bottom sheet on mobile):
  - League multi-select with league crests
  - Date range picker
  - Team search with autocomplete
  - "Only matches with venues" toggle
  - City/location filter
  - Sort: by date, by venue count
- Main area: infinite scroll list of match cards
- Each match card: home vs away (crests, names, scores if live), date/time, league, match day/stage, venue count badge, "LIVE" animated pulse badge if in play
- Calendar view toggle (optional stretch goal)
- Keyboard shortcut: `F` to focus filter search

**Match Detail Page (`/matches/:matchId`)**
- Sticky match header: teams, score (live polling), league, date/time (with countdown if < 24h), status badge
- Tab bar: "Venues" (default) | "About Match"
- Venues tab:
  - Filter bar: amenities chips, cuisine chips, distance slider, price range, sort (distance/rating/spots)
  - View toggle: List | Map
  - List: venue cards with: cover image, name, address, distance, rating stars, amenity icon row, available spots pill, "Book Now" button
  - Map: Mapbox GL with clustered venue pins, click → popover card with mini venue info + "View Venue" link. User location dot. Fit bounds to all venues on load
  - Empty state if no venues hosting: "Be the first venue to host this match" CTA if user is venue owner

**Venue Profile Page (`/venues/:slug`)**
- Cover image with parallax scroll effect
- Header: venue name, city, verified badge, follow button (heart icon with count), rating stars
- Gallery strip: horizontal scroll of gallery images → click → lightbox modal
- Amenity icons row with labels (TV, Projector, VIP section, Hookah, Smoke Free, etc.)
- Cuisine tags + price range indicator ($/$$/$$$)
- Action bar: Get Directions | Call | Visit Website | Share
- Tab navigation (sticky on scroll):
  - **Events** — upcoming matches being hosted, each as a card with: teams, date/time, spots remaining, book button
  - **Posts** — social feed, image support, match tags
  - **Menu** — categorized, searchable menu with images, dietary badges, prices
  - **Reviews** — star breakdown chart, review cards with verified badge, owner replies
  - **Info** — full address, map embed, hours, contact info, about text
- **Booking Drawer/Panel**: slides up from bottom (mobile) or appears as sticky right sidebar (desktop) when user clicks "Book Now" on an event. Contains:
  - Selected event info (match, date, venue)
  - Party size stepper (1-20)
  - Special requests textarea
  - Spots remaining indicator + warning if < 5
  - Entry fee if applicable
  - Estimated group total
  - "Reserve Spot" button (opens auth modal if not logged in, preserves intent)
  - Cancellation policy note

**Browse Venues (`/venues`)**
- Search bar with instant results (debounced 300ms)
- Filter sidebar: city, country, amenities, cuisine, price range, verified only
- Map/list toggle
- Venue cards grid (3 col desktop, 2 col tablet, 1 col mobile)
- Infinite scroll

**User Dashboard (`/dashboard`)**

*Overview sidebar navigation with user avatar, name, following count*

- **My Bookings**: Timeline view of upcoming and past bookings. Each booking card: venue name + cover, match info, date, party size, booking ref, status badge, QR code button, cancel button (if upcoming and >2hr before match), "Leave Review" (if past + no review yet)
- **Feed**: Posts from followed venues in reverse-chron order. Post cards with venue avatar, post content, images (gallery if multiple), match tag chip, timestamp. Infinite scroll
- **Following**: Grid of followed venue cards with unfollow button. Shows venue's next event
- **My Teams**: Searchable grid of all teams grouped by league. Toggle teams on/off as interests. Visual football team crest display
- **Notifications**: Grouped by date. Each with icon (type-based), title, body, venue/match context, relative timestamp, unread indicator. Mark all read button
- **Profile Settings**: Avatar upload with crop modal, name edit, timezone select, locale/language select, password change (requires current password), delete account (confirmation + reason)

**Venue Owner Dashboard (`/venue-dashboard`)**

*Pro-grade dashboard aesthetic: dark sidebar with venue logo, nav items with icons*

- **Overview**: KPI cards (upcoming events, this week's bookings, total followers, pending approvals, projected attendees), Recent Bookings table (last 10, with status badges + quick actions), Quick Actions panel (Add Event, New Post, Notify Followers)
- **Events Manager**:
  - Search upcoming matches to add (league filter + team search + date picker)
  - Match results show as cards with "Host This Match" button → opens config modal (booking limit, notes, entry fee, approval required toggle)
  - Active events list with: match info, bookings count / limit progress bar, edit/delete actions, toggle active/inactive
- **Bookings Manager**:
  - Event filter dropdown + status filter tabs (All / Pending / Confirmed / Cancelled)
  - Bookings table: booking ref, user name + avatar, party size, special requests, status badge, check-in toggle, actions (confirm, cancel, check-in)
  - Bulk actions: confirm all pending, export CSV
  - Real-time updates via WebSocket or polling (new bookings appear without refresh)
- **Menu Editor**:
  - Drag-and-drop category reordering (react-dnd or dnd-kit)
  - Expandable categories with item lists
  - Add/edit item modal: name, description, price, image upload, dietary tags (multi-select chips), allergens, availability toggle
  - Preview mode: see menu as customers see it
- **Posts Manager**:
  - Create post: rich text (markdown supported), multi-image upload with preview + reorder, match tag selector, schedule toggle with datetime picker
  - Posts list with engagement stats (views), edit/delete
- **Notify Followers**:
  - Compose card: title (max 65 chars), body (max 200 chars), optional link (to post or external URL), character counters
  - Preview: shows how push notification will look on phone
  - Recipient count shown
  - Daily limit indicator (3/day)
  - Send confirmation modal
- **Analytics**:
  - Date range picker
  - Charts (recharts): Bookings Over Time (line), Bookings by Event (bar), Party Size Distribution (histogram), Followers Growth (line), Cancellation Rate (gauge)
  - Table: Top Performing Events sorted by bookings
- **Settings**:
  - All venue info editable in sections (General, Location, Contact, Media, Amenities, Cuisine)
  - Cover image upload with crop
  - Gallery management: upload multiple, reorder via drag, delete individual
  - Amenities: visual checkbox grid with icons
  - Cuisine: multi-select tag input
  - Danger zone: deactivate venue (soft delete)

**Admin Panel (`/admin`)**
- Clean table-heavy interface
- Users: searchable table, filter by role/status, quick actions (suspend, change role, force reset)
- Venues: table with verified badge, feature toggle, deactivate
- Match Sync: last sync time per league, success/fail badges, manual trigger button with progress indicator
- Audit Logs: filterable table (by user, action type, date range) with metadata expanded on row click
- Platform Stats: big number KPI cards (total users, venues, bookings today/week/month, matches tracked)

---

##  REAL-TIME FEATURES

- **Booking counter on match detail page** — remaining spots update in real-time using Server-Sent Events (SSE) endpoint: `GET /api/v1/events/venue-event/:id/spots`
- **New booking alert in venue dashboard** — SSE or WebSocket for live booking notifications
- **Live match scores** — polling every 60 seconds on match detail pages while match status is IN_PLAY

---

##  GEO FEATURES

- PostGIS extension on RDS — add `geography` column to venues for accurate distance calculation
- Haversine fallback if PostGIS unavailable
- Reverse geocoding: when user shares location, show city name in UI header ("Watching in Istanbul")
- Distance always displayed in user's preferred units (km/miles, detect from locale)
- Mapbox GL JS with custom dark map style matching app aesthetic
- Cluster markers at low zoom levels, expand on zoom
- Custom SVG pin markers with venue cover image thumbnails on hover

---

##  INFRA & DEVOPS

### AWS Architecture
```
Route 53 (DNS)
  └─ CloudFront (CDN)
       ├─ S3 (frontend static files)
       ├─ S3 (media bucket, private + CloudFront OAI)
       └─ ALB (Application Load Balancer)
            └─ ECS Fargate (API containers, auto-scaling 1-10 tasks)
                 ├─ RDS PostgreSQL (Multi-AZ, encrypted at rest)
                 ├─ ElastiCache Redis (cluster mode)
                 └─ Secrets Manager (all secrets)
```

### Pulumi IaC (`/infra`)
- Full Pulumi TypeScript code for all resources above
- Separate stacks: `dev`, `staging`, `production`
- Resource tagging strategy (app, environment, owner, cost-center)
- VPC with public/private subnets, NAT gateway for ECS egress
- Security groups: principle of least privilege (ECS can only reach RDS on 5432, Redis on 6379)
- RDS automated backups (7 day retention), point-in-time recovery enabled
- CloudWatch alarms: CPU > 80%, error rate > 5%, RDS storage > 80%
- SNS → email on alarm

### Dockerfiles
- Multi-stage build, node:20-alpine base, non-root user, no dev dependencies in final image
- `.dockerignore` excluding node_modules, .env, .git
- Health check endpoint: `GET /health` returning `{ status: "ok", version, uptime }`

### docker-compose.yml (local dev)
- Services: `api`, `web`, `postgres`, `redis`, `mailhog` (email capture), `minio` (S3-compatible local)
- Named volumes, restart policies, env file references
- Hot reload for api (tsx watch) and web (Vite HMR)

### GitHub Actions CI/CD

**`ci.yml`** — on every PR:
- Lint (ESLint, Prettier check)
- Type check (tsc --noEmit)
- Unit tests (Vitest)
- Integration tests against test database
- Security audit (npm audit --audit-level=high)
- Snyk vulnerability scan
- Bundle size check (fail if > threshold)

**`deploy-staging.yml`** — on merge to `main`:
- Run CI
- Build Docker image, push to ECR
- Run DB migrations on staging
- Deploy to ECS staging (blue/green)
- Run smoke tests against staging URL
- Notify Slack on success/failure

**`deploy-production.yml`** — on tag `v*.*.*`:
- All of staging steps
- Manual approval gate required
- Blue/green deployment to production ECS
- CloudFront cache invalidation
- Create GitHub Release with changelog

---

##  TESTING STRATEGY

Implement tests alongside code:

**Unit Tests (Vitest)**
- All service functions (booking creation, token generation, match sync parsing)
- All Zod schemas (valid + invalid inputs)
- Utility functions (booking reference generation, distance calculation)

**Integration Tests (Vitest + test DB)**
- All API routes: happy path + error cases
- Auth flows end-to-end (register → verify → login → refresh → logout)
- Booking flow with spot limit enforcement
- Role-based access control enforcement

**E2E Tests (Playwright)**
- Critical user paths:
  - Guest → view match → view venue → register → book
  - Venue owner → login → add event → manage bookings
  - User → follow venue → receive notification

---

##  COMPLETE PACKAGE.JSON DEPENDENCIES

List and install every required package. Key ones:

**API:** `hono`, `@hono/node-server`, `drizzle-orm`, `drizzle-kit`, `pg`, `ioredis`, `bullmq`, `jose` (JWT RS256), `bcryptjs`, `zod`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `resend`, `firebase-admin`, `isomorphic-dompurify`, `jsdom`, `sharp` (image processing/EXIF strip), `csv-stringify`, `date-fns`, `date-fns-tz`, `pino` (structured logging), `@opentelemetry/sdk-node` (tracing)

**Web:** `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`, `mapbox-gl`, `react-map-gl`, `framer-motion`, `react-hook-form`, `@hookform/resolvers`, `zod`, `date-fns`, `date-fns-tz`, `recharts`, `@dnd-kit/core`, `@dnd-kit/sortable`, `react-dropzone`, `react-hot-toast`, `react-virtuoso`, `@radix-ui/*` (all shadcn primitives)

---

##  EXECUTION ORDER

Work through the project in this exact sequence. Complete each phase fully before moving to the next. Write every file completely — no truncation, no `// implement later`, no stubs:

**Phase 1 — Foundation**
Turborepo setup, all `package.json` files, TypeScript configs, ESLint + Prettier, shared package with all Zod schemas and TypeScript types

**Phase 2 — Database**
Complete Drizzle schema file, all migrations, seed script (leagues, teams from Football-Data.org, 3 sample venues with full data, 10 sample matches)

**Phase 3 — API Core**
Hono app entry point, all middleware (auth, rate limit, cors, error handler, request ID, logger), Drizzle DB client, Redis client setup

**Phase 4 — Auth Routes**
Complete auth implementation: register, verify email, login (with lockout, audit log), refresh (with rotation + theft detection), logout, forgot/reset password, session management

**Phase 5 — All API Routes**
Every route file, every handler, complete business logic with proper transactions, ownership checks, input validation

**Phase 6 — Workers**
Match sync worker (full Football-Data.org integration), notification worker, reminder worker, waitlist worker

**Phase 7 — Email Templates**
All 15 React Email templates, Resend integration

**Phase 8 — File Upload**
S3 presigned URL flow, multipart handling, Sharp image processing

**Phase 9 — React Frontend Setup**
Vite config, React Router setup, Axios client with interceptors, TanStack Query config, Zustand stores (auth, UI), shadcn/ui full setup, design tokens, global styles

**Phase 10 — Public Pages**
Home, Matches, Match Detail with map, Venue Profile with all tabs + booking drawer, Browse Venues

**Phase 11 — Auth UI**
Login, Register, Register Venue, Verify Email, Forgot/Reset Password — all forms with full validation

**Phase 12 — User Dashboard**
Bookings timeline, feed, following, team interests, notifications, profile settings

**Phase 13 — Venue Dashboard**
Full dashboard: overview, events manager with match search, bookings manager with real-time updates, menu editor with drag-drop, posts manager, notify followers, analytics with charts, settings

**Phase 14 — Admin Panel**
Users, venues, match sync, audit logs, platform stats

**Phase 15 — Infrastructure**
Dockerfiles, docker-compose, Pulumi IaC, GitHub Actions workflows, `.env.example`

**Phase 16 — Tests**
Unit tests for all services, integration tests for all routes, E2E tests for critical paths

**Phase 17 — Polish**
Loading skeletons for every data-fetching component, error boundaries, empty states, 404/500 pages, mobile responsiveness audit, accessibility audit, performance audit (code splitting, lazy loading, image optimization)

---

Begin immediately with Phase 1. Do not ask clarifying questions — make the best architectural decision and proceed. Every file must be production-ready, fully typed, and complete.

---

**End of specification.** Paste this entire prompt into a new Claude Opus 4.6 conversation to begin building.

