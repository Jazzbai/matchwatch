#  MatchWatch

**Houston's Premier Live Match Watch Party Hub**

MatchWatch connects football fans with the best bars, lounges, and restaurants hosting live match screenings across Houston. Discover venues, book your spot, and experience every goal like you're in the stadium.

---

##  Features

- **Match Directory** — Browse international tournaments, MLS, EPL, La Liga, Bundesliga, Serie A, Ligue 1, UCL, Liga MX, and NWSL fixtures with live scores, detailed stats, lineups, and venue listings
- **Venue Discovery** — Search, filter (by price, amenities, cuisine), and sort 8+ partner venues with ratings, reviews, menus, and real-time capacity tracking
- **Team Profiles** — View team match records, fixtures, and related teams across all leagues
- **Booking System** — Reserve spots at watch parties with party size, special requests, and entry fee calculation via the slide-up Booking Drawer
- **Admin Dashboard** — Full management panel with 7 tabs: Overview, Users, Venues, Matches, Bookings, Posts, and Analytics
- **Dark / Light Themes** — "Neon Nightlife" dark mode and "Houston Day" light mode, togglable site-wide
- **Mobile-First Design** — PWA-ready responsive layout with bottom tab navigation and desktop top bar

##  Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 + custom CSS design system |
| Fonts | Bebas Neue (headings), DM Sans (body), JetBrains Mono (scores) |
| Routing | File-based App Router with dynamic segments |

##  Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Home — hero, live ticker, carousels, CTAs
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # "Neon Gridiron" design system
│   ├── not-found.tsx             # Custom 404 (VAR offside theme)
│   ├── matches/
│   │   ├── page.tsx              # Matches listing with filters
│   │   └── [matchId]/page.tsx    # Match detail — scores, lineups, stats, venues
│   ├── venues/
│   │   ├── page.tsx              # Venues listing with search/sort
│   │   └── [slug]/page.tsx       # Venue profile — 5 tabs (About, Events, Menu, Reviews, Posts)
│   ├── teams/
│   │   └── [teamId]/page.tsx     # Team profile — record, fixtures, related teams
│   ├── admin/page.tsx            # Admin dashboard — 7 management panels
│   ├── about/page.tsx            # About MatchWatch
│   ├── contact/page.tsx          # Contact form
│   ├── for-venues/page.tsx       # Venue registration info
│   ├── privacy/page.tsx          # Privacy policy
│   └── terms/page.tsx            # Terms of service
├── components/
│   ├── AppShell.tsx              # Theme provider, top bar, bottom tabs, footer
│   ├── MatchCard.tsx             # Match card with live pulse, scores, venue count
│   ├── VenueCard.tsx             # Venue card with ratings, amenities, booking CTA
│   ├── MapListToggle.tsx         # Map/list view toggle with mock Mapbox pins
│   └── BookingDrawer.tsx         # Slide-up booking panel
└── lib/
    └── data.ts                   # Centralized fixture data (teams, matches, venues, etc.)
```

##  Getting Started

### Prerequisites

- **Node.js** 18.18+ (LTS recommended)
- **npm** 9+ (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd <project-directory>

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm run start
```

##  Routes

| Route | Type | Description |
|---|---|---|
| `/` | Static | Home page with hero, live ticker, match/venue carousels |
| `/matches` | Static | All matches with league & status filters |
| `/matches/[matchId]` | Dynamic | Match detail with venues, lineups, stats |
| `/venues` | Static | All venues with search, price/amenity filters, sort |
| `/venues/[slug]` | Dynamic | Venue profile with 5 tabs |
| `/teams/[teamId]` | Dynamic | Team profile with match record and fixtures |
| `/admin` | Static | Admin dashboard with 7 management panels |
| `/about` | Static | About page |
| `/contact` | Static | Contact form |
| `/for-venues` | Static | Venue owner registration info |
| `/privacy` | Static | Privacy policy |
| `/terms` | Static | Terms of service |

##  Design System — "Neon Gridiron"

The design blends Houston's vibrant energy with major tournament excitement:

- **Dark theme** ("Neon Nightlife") — Deep navy backgrounds with cyan/hot-pink accents
- **Light theme** ("Houston Day") — Clean whites with confident blue/orange accent palette
- **Typography** — Display headings (Bebas Neue), readable body text (DM Sans), monospaced scores (JetBrains Mono)
- **Animations** — Fade-in with stagger, live pulse dots, shimmer loading, marquee ticker
- **Components** — Glass-panel headers, gradient cards, pill filters, toggle tracks, booking drawers

##  Data Model

All fixture data lives in `src/lib/data.ts` and includes:

- **25 national teams** + **17 club teams** across 10 leagues
- **15 matches** (international finals group stage, MLS, EPL, La Liga, Liga MX)
- **8 Houston venues** with full profiles, menus, reviews, and posts
- **8 venue events** linking matches to venues with capacity tracking
- **10 users**, **8 bookings**, and admin statistics

##  License

This project is for educational and demonstration purposes.

---

Built in Houston, TX for football fans
