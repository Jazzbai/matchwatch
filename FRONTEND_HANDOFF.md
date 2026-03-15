# MatchWatch Frontend Handoff (Current State)

Last updated: 2026-03-15
Scope: current production behavior in this repository, for UI/UX redesign and frontend optimization without breaking existing flows.

## 1) Stack and Runtime Model

- Frontend app path: `HtownKickoff-main`
- Framework: Next.js App Router (`src/app`)
- UI approach: custom CSS variables + shadcn/ui primitives + Lucide icons
- Global shell: top bar + bottom mobile tab bar (`src/components/AppShell.tsx`)
- Global providers:
  - `AuthProvider` for auth/session state
  - `DataProvider` for matches/venues/events/bookings aggregation
- Maps:
  - Real Leaflet map for location picking and match venue map
  - Mock map in `MapListToggle` (home list/map section)

## 2) Global Navigation and Layout

- Header brand links home and displays `matchwatch.us`.
- Header links: `Matches`, `Venues`, `Reserve`, `For Venues`.
- Auth area:
  - Logged out: `Log In`, `Sign Up`
  - Logged in: role-aware dashboard link + `Log Out`
- Mobile bottom tabs:
  - `Home`, `Matches`, `Venues`
  - Logged out: `Login`
  - Logged in: `Account` or `Venue` (role-based)
  - Admin/Super Admin gets extra `Admin` tab

## 3) Route Inventory and Behavior

### Core pages

- `/`
  - Hero, search input UI, league pills, upcoming matches, featured venues, map/list hosting section, owner CTA, footer.
  - Booking drawer opens from venue cards and map/list section.
  - Upcoming matches sorted by nearest kickoff first.
  - Home league pill filter is single select.

- `/login`
  - Single auth surface for Fan and Venue flows.
  - Tabs: `Sign In` / `Sign Up`.
  - `?view=signup` preselects sign-up tab.
  - `?next=/some/path` redirects after successful login.
  - Venue sign-up path sends user to `/for-venues/register`.
  - Role routing:
    - venue/admin/super admin -> `/admin`
    - normal user -> `/dashboard` (redirects to `/account`)

- `/matches`
  - Default view is upcoming.
  - Status tabs: All, Live, Upcoming, and Results (only when history mode is on).
  - Filters:
    - quick pills: league (single select), country (single select), date (single select, available dates only)
    - modal: team multi-select + same league/country/date controls
    - `Show History` toggle (include past)
    - `Only with hosting venues` checkbox (uses active venue events)
  - Match cards route to `/matches/[matchId]`.

- `/matches/[matchId]`
  - Hero with teams, score/status, league badge.
  - Tabs:
    - `Venues`: hosting venue cards + reserve CTA
    - `Lineups`: fallback informational text
    - `Stats`: match + hosting stats summary
  - `Hosting Venues Map` section (Leaflet) with clickable markers.
  - Related matches section: `MORE IN <LEAGUE>`.
  - Booking drawer integrated.

- `/venues`
  - Search by name/cuisine/address.
  - Filters:
    - price pills
    - amenity pills
    - sort by rating/reviews/name
  - Grid of venue cards (cover/rating/amenities/etc.).
  - CTA to `/for-venues`.

- `/venues/[slug]`
  - Hero with follow button and venue stats.
  - Optional match preselection via `?matchId=...`.
  - Banner logic:
    - promoted event if set by owner
    - otherwise nearest upcoming event
  - Tabs:
    - `Overview`
    - `Events`
    - `Menu`
    - `Reviews`
    - `Posts`
  - Events tab:
    - match events list with team crests, capacity progress, View Match, Book Spot
    - custom events list (if present)
  - Right rail:
    - Reserve card
    - upcoming events list (each match is clickable to `/matches/[id]`)
  - Booking drawer integrated.

- `/reserve`
  - Auth-gated reserve flow.
  - Steps:
    - select upcoming match (card list with logos)
    - select venue event
    - party size + requests
  - Creates booking with `/bookings`.
  - Confirmation card shown on success.

- `/account`
  - Auth-gated user dashboard.
  - Tabs:
    - `My Bookings`
    - `Following`
    - `My Interests`
    - `Profile`
  - Profile tab:
    - avatar upload to S3 via presigned URL
    - max 4MB and image type checks
    - name/avatar save

- `/admin` (venue owner dashboard)
  - Auth + role-gated.
  - Tabs:
    - `Overview`
    - `Events`
    - `Reservations`
    - `Menu`
    - `Venue Settings`
  - Events tab:
    - Create Event modal:
      - Match Event wizard with upcoming match picker (league + search)
      - Custom Event wizard with tags and optional image upload
    - Promote button per match event to pin banner on public venue page.
  - Reservations tab:
    - grouped event-by-event bookings
    - expandable booking list per event
    - contact email shown
    - capacity progress bar shown
    - confirm/cancel controls are status-aware and guarded
  - Menu tab:
    - create categories
    - create menu items
    - list current categories/items
  - Venue Settings tab:
    - update profile fields
    - cover image upload
    - gallery uploads (max 5 images)
    - image file size/type validation via presigned S3 flow

- `/feed`
  - Auth-gated following feed.
  - Shows followed-venue upcoming events + venue posts stream.

- `/for-venues`
  - marketing/feature page for venue owners.

- `/for-venues/register`
  - venue owner onboarding.
  - requires map selection before submit.
  - map click sets lat/lng and reverse-geocodes address.
  - tag chips from `src/lib/tags.ts` for amenities/cuisine.
  - submits owner + venue payload, auto-logins, redirects to `/admin`.

- `/teams/[teamId]`
  - team overview, fixtures/results, related teams in same league.

### Utility/redirect routes

- `/dashboard` -> redirects to `/account`
- `/venue-dashboard` -> redirects to `/admin`
- `/register` -> redirects to `/signup`
- `/signup` -> redirects to `/login?view=signup`
- `/register-venue` -> redirects to `/for-venues/register`
- `/matches/[matchId]/venue/[venueSlug]` -> redirects to `/venues/[venueSlug]?matchId=[matchId]`

### Static pages

- `/about`, `/contact`, `/privacy`, `/terms`, and custom `not-found`.

## 4) Data and API Flow (Frontend)

- API base: `NEXT_PUBLIC_API_URL` (default `/api/v1`).
- Auth token:
  - access token in localStorage
  - refresh flow via `/auth/refresh`
  - all API wrappers in `src/lib/api.ts`
- DataProvider behavior:
  - bootstraps matches + venues (+ bookings if authenticated)
  - enriches venues with detail/events/posts/reviews
  - polls every 30s
  - retries every 5s when API disconnected
  - refetch on window focus and visibility change
  - skips bootstrap fetch on login/register onboarding routes

## 5) Upload and Media Rules

- Upload route: `POST /api/v1/uploads/presigned-url`
- Supported purposes currently used:
  - `avatar`
  - `venue_cover`
  - `venue_gallery`
  - `post` (custom event image uses this flow)
- Allowed mime types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/gif`
- Max file size enforced: 4MB (frontend + backend)
- Venue gallery max: 5 images

## 6) Match and Hosting UX Rules

- Main page and matches page prefer upcoming/live and hide stale past data unless history enabled.
- Match page hosting count and map derive from active venue events linked by `matchId`.
- Venue page event cards link back to match page.
- Match page can filter to only matches with hosting venues.

## 7) Current Contract-Sensitive Behaviors (Do Not Break)

- Login must support `next` query redirect.
- `/login?view=signup` must keep sign-up tab default.
- Venue onboarding route is `/for-venues/register`.
- Venue banner priority:
  - promoted event first
  - else nearest upcoming event
- Booking creation must continue to work from:
  - reserve page
  - match page drawer
  - venue page drawer
- Reservation status actions in admin must remain idempotent-safe in UI (no repeated confirm/cancel confusion).
- Coordinates (`lat/lng`) must be preserved from venue list even if venue detail request fails.

## 8) Known UX/Feature Gaps (Current State)

- Home search input is visual-only (not wired to route/filter behavior).
- `MapListToggle` map mode is a mock map, not geospatial data.
- Contact page form is UI-only (no backend submission).
- Match lineups/stats tabs are currently placeholders for richer feed data.

## 9) Backend Endpoints Used by Frontend

Core:
- `/auth/*`
- `/user/me`, `/user/profile`, `/user/avatar`, `/user/interests`, `/user/feed`
- `/matches`, `/matches/facets`, `/matches/:id`, `/matches/:id/venues`
- `/venues`, `/venues/:slug`, `/venues/:slug/events`, `/venues/:slug/custom-events`, `/venues/:slug/menu`, `/venues/:slug/reviews`, `/venues/:slug/posts`, `/venues/:slug/follow`, `/venues/following`
- `/bookings`
- `/dashboard/*` for venue owner management
- `/uploads/presigned-url`

## 10) Design Direction Notes for Gemini

- Keep all route contracts and role redirects intact while redesigning.
- Keep no-emoji policy in UI copy/components (use icon pack).
- Preserve upload limits and accepted file types.
- Preserve event-centric reservations management in admin.
- Preserve match filter semantics (single league/country/date, optional team multi-select modal).
- Preserve map-based venue registration requirement.

