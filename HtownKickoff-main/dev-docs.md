# Dev Docs — Matchwatch Frontend Rebuild

## 2026-03-16: CSS & Theme System Fix
- **Root cause**: `globals.css` had two conflicting `.dark` blocks and two conflicting `@theme` blocks from Shadcn auto-generation overlapping with the custom Matchwatch theme
- **Fix**: Rewrote `globals.css` from scratch — single `:root`, single `.dark`, single `@theme` block
- **Added missing vars**: `--border`, `--destructive-foreground`, `--chart-*`, `--sidebar-*`
- **Font fix**: Removed Geist font import from `layout.tsx` that was overriding Inter as sans-serif
- **Legacy CSS**: Fixed broken variable references (`--bg-card` → `var(--card)`, `--text-muted` → `var(--muted-foreground)`, etc.)

## 2026-03-16: Login Page Redesign
- Replaced card-based login with split-screen layout (form left, image right)
- Uses provided AI-generated pictures from `/pics` folder, copied to `/public/assets/`
- Full viewport height, frosted glass overlay on image pane

## 2026-03-16: Home Page Image Fix
- Replaced broken `/pics/stadium*.jpg` references with `/assets/img-*.png`
- Added empty state for bento grid when no matches available
- Reduced hero text from `text-[10rem]` to `text-[7rem]` to prevent overflow

## 2026-03-16: Global CSS Variable Cleanup & Feature Additions
- Ran global sed replacement to fix ALL broken CSS variable references across 24 files (`--bg-elevated` → `--secondary`, `--text-primary` → `--foreground`, `--text-secondary` → `--muted-foreground`, `--accent-primary` → `--primary`, etc.)
- Added missing CSS utility classes to `globals.css`: `btn-primary`, `btn-ghost`, `section-label`, `text-h1`, `text-h2`, `text-display`, `text-body`, `pill`, `carousel-track`, `no-scrollbar`, `scrollbar-hide`, `custom-scrollbar`
- Rewrote `/venues` page with correct CSS vars and replaced `$` price filter labels with Lucide icons (`Coins`, `CircleDollarSign`, `Gem`, `Crown`)
- Fixed `/matches` page: converted all section wrappers to inline styles for layout (max-width, padding), fixed filter modal with correct CSS vars and inline-styled buttons
- Added password strength progress bar (5 checks: length, uppercase, lowercase, number, symbol) to both fan sign-up (`/login`) and venue registration (`/for-venues/register`)
- Changed login page right-pane image to `img-5.png`

## 2026-03-16: Venue Detail Page Fixes
- Rewrote `page.module.css` — fixed all broken CSS variable references to theme-compatible values
- Added gallery lightbox overlay with prev/next navigation and close button
- Replaced `btn-primary` / `btn-ghost` class usage with inline-styled buttons

## 2026-03-16: Account Page Inline Styling
- Converted entire rendering section (~270 lines) from Tailwind to inline styles
- All states: loading, auth gate, header, tab nav, bookings, following, interests, profile settings
- Added reusable style helpers: `tabButtonStyle()`, `cardBoxStyle`, `primaryBtnStyle()`, `inputStyle`

## 2026-03-16: Match Detail Page Inline Styling
- Rewrote `MatchVenueCard` component with hover elevation, gradient cover, capacity bar, amenity badges
- Hero section (league badge, teams face-off, score/VS, stadium badges) — all inline
- Tab navigation & content (venues grid, lineups placeholder, stats cards) — all inline
- Related matches section and loading/error states — all inline
- Build verified: exit 0, 25 routes compiled

## 2026-03-16: Admin Dashboard Inline Styling
- Complete rewrite of `/admin` page rendering (~1000 lines) from shadcn components to inline styles
- Replaced all Card, Button, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Input, Textarea, Checkbox, Label components
- All 5 tabs (Overview, Events, Reservations, Menu, Settings) now use inline styles exclusively
- Event creation modal and match picker modal — fully inline-styled
- Removed unused shadcn imports (only imported types remain)

## 2026-03-16: Navbar Venue Name
- Navbar now shows venue name (`user.name`) for VENUE_OWNER users in top-right instead of generic "Venue"

## 2026-03-16: User Profile Updates
- Removed Avatar URL text field from profile settings (upload via file picker remains)
- Added cancel/remove reservation button on each non-cancelled booking card in account bookings tab
- Uses `api.delete(\"/bookings/:id\")` with loading state and error handling

