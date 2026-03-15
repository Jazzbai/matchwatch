"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  CalendarDays,
  MapPin,
  Megaphone,
  Search,
  Ticket,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ThemeProvider } from "../components/AppShell";
import { AppShell } from "../components/AppShell";
import { MatchCard } from "../components/MatchCard";
import { VenueCard } from "../components/VenueCard";
import { MapListToggle } from "../components/MapListToggle";
import { BookingDrawer } from "../components/BookingDrawer";
import { useData } from "../lib/data-provider";

/* ═══════════════════════════════════════════════════
   AD PLACEMENT — Non-intrusive monetization slot
   ═══════════════════════════════════════════════════ */
function AdPlacement({
  variant = "banner",
  label = "Sponsored",
}: {
  variant?: "banner" | "sidebar" | "inline";
  label?: string;
}) {
  return (
    <div
      style={{
        padding: variant === "sidebar" ? "16px" : "12px 20px",
        background: "var(--bg-card)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        textAlign: "center",
        opacity: 0.6,
        fontSize: "0.75rem",
        color: "var(--text-muted)",
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
      }}
    >
      {label}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LEAGUE FILTER PILLS — Horizontal scroll row
   ═══════════════════════════════════════════════════ */
function LeagueFilterPills({
  leagues,
  activeLeagueId,
  onSelectLeague,
}: {
  leagues: Array<{ id: string; shortName: string; logo: string; image?: string }>;
  activeLeagueId: string;
  onSelectLeague: (leagueId: string) => void;
}) {
  return (
    <div style={{
      display: "flex", gap: "8px", overflowX: "auto",
      padding: "0 20px", scrollbarWidth: "none",
    }}>
      <button className="btn-ghost text-xs" style={{
        whiteSpace: "nowrap", padding: "8px 14px", borderRadius: "999px",
        background: activeLeagueId === "all" ? "var(--accent-primary)" : "transparent",
        color: activeLeagueId === "all" ? "#fff" : "var(--text-secondary)", fontWeight: 700,
      }} onClick={() => onSelectLeague("all")}>
        All Matches
      </button>
      {leagues.slice(0, 6).map((lg) => (
        <button key={lg.id} className="btn-ghost text-xs" style={{
          whiteSpace: "nowrap", padding: "8px 14px", borderRadius: "999px",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          borderColor: activeLeagueId === lg.id ? "var(--accent-primary)" : "var(--border)",
          color: activeLeagueId === lg.id ? "var(--accent-primary)" : "var(--text-secondary)",
        }} onClick={() => onSelectLeague(lg.id)}>
          {lg.image ? <img src={lg.image} alt={lg.shortName} style={{ width: "16px", height: "16px", objectFit: "contain" }} /> : lg.logo} {lg.shortName}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   HOME PAGE — Assembles all critical components
   Fully linked: every match, venue, team → single page
   ═══════════════════════════════════════════════════ */
export default function HomePage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedVenueIdx, setSelectedVenueIdx] = useState(0);
  const [homeLeagueFilter, setHomeLeagueFilter] = useState("all");
  const { matches: MATCHES, venues: VENUES, leagues, venueEvents, bookings, posts, getTeam, getLeague, getVenueEvents, isApiConnected } = useData();

  // Prepare venue data for VenueCard display
  const venueCards = VENUES.filter((v) => v.isActive).slice(0, 6);
  const liveMatches = MATCHES.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
  const upcomingMatches = useMemo(
    () => MATCHES
      .filter((m) => {
        const isUpcomingStatus = m.status === "SCHEDULED" || m.status === "TIMED";
        if (!isUpcomingStatus) return false;
        return new Date(m.matchDateUTC).getTime() >= Date.now();
      })
      .sort((a, b) => new Date(a.matchDateUTC).getTime() - new Date(b.matchDateUTC).getTime()),
    [MATCHES],
  );
  const filteredUpcomingMatches = useMemo(
    () =>
      upcomingMatches.filter((match) =>
        homeLeagueFilter === "all" ? true : match.leagueId === homeLeagueFilter,
      ),
    [upcomingMatches, homeLeagueFilter],
  );
  const featuredMatch = filteredUpcomingMatches[0] || upcomingMatches[0] || MATCHES[0];
  const selectedVenue = venueCards[selectedVenueIdx];
  const selectedVenueEvent = featuredMatch && selectedVenue
    ? getVenueEvents(featuredMatch.id).find((event) => event.venueId === selectedVenue.id)
    : undefined;
  const selectedHome = featuredMatch ? getTeam(featuredMatch.homeTeamId) : undefined;
  const selectedAway = featuredMatch ? getTeam(featuredMatch.awayTeamId) : undefined;
  const selectedLeague = featuredMatch ? getLeague(featuredMatch.leagueId) : undefined;
  const featuredVenueEvents = featuredMatch ? getVenueEvents(featuredMatch.id) : [];
  const mapVenueCards = featuredVenueEvents.length > 0
    ? featuredVenueEvents.map((event) => event.venue).slice(0, 6)
    : venueCards;

  return (
    <ThemeProvider>
      <AppShell>
        {/* ─── Hero Section ──────────────────────── */}
        <section
          className="hero-field"
          style={{
            background: "var(--gradient-hero)",
            padding: "48px 20px 36px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative orbs */}
          <div style={{ position: "absolute", top: "-60px", right: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "var(--accent-primary)", opacity: 0.04, filter: "blur(60px)" }} />
          <div style={{ position: "absolute", bottom: "-40px", left: "-30px", width: "160px", height: "160px", borderRadius: "50%", background: "var(--accent-secondary)", opacity: 0.04, filter: "blur(50px)" }} />

          {/* Hero Image Background */}
          <img
            src="/home-hero.webp"
            alt=""
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              opacity: 0.18,
              pointerEvents: "none",
            }}
          />

          <div className="animate-fade-up" style={{ position: "relative", zIndex: 2 }}>
            <div className="section-label" style={{ marginBottom: "12px", fontSize: "0.7rem" }}>
              GLOBAL FOOTBALL NIGHTS · HOUSTON, TX
            </div>
            <h1 className="font-display text-hero" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>
              MATCHWATCH
              <br />
              <span style={{ color: "var(--accent-primary)" }}>WATCHPARTY</span>
            </h1>
            {!isApiConnected && (
              <p className="text-xs" style={{ color: "var(--accent-hot)", marginBottom: "12px" }}>
                API not reachable yet. Start backend services to load live matches and venues.
              </p>
            )}
            <p className="text-body" style={{ color: "var(--text-secondary)", maxWidth: "380px", margin: "0 auto 24px" }}>
              Find the best bars, lounges, and restaurants hosting match-night watch parties. Book your spot and join the action.
            </p>

            {/* Search Bar */}
            <div style={{ position: "relative", maxWidth: "420px", margin: "0 auto" }}>
              <input
                type="text"
                placeholder="Search venues, matches, or neighborhoods..."
                style={{
                  width: "100%", padding: "14px 18px 14px 44px", borderRadius: "14px",
                  border: "1px solid var(--border)", background: "var(--bg-card)",
                  color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.9rem", outline: "none", transition: "all 0.2s ease",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--accent-primary)"; e.target.style.boxShadow = "0 0 0 3px var(--accent-primary-dim)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
              <Search size={18} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", opacity: 0.5 }} />
            </div>

            {/* Dual CTA — linked */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "20px", flexWrap: "wrap" }}>
              <Link href="/matches" className="btn-primary" style={{ padding: "12px 24px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <CalendarDays size={16} />
                Find a Watch Party
              </Link>
              <Link href="/venues" className="btn-ghost" style={{ padding: "12px 24px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <Building2 size={16} />
                List Your Venue
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Live Match Ticker ──────────────────── */}
        <div
          style={{
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border)",
            padding: "8px 0",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "24px", whiteSpace: "nowrap", animation: "marquee 30s linear infinite", width: "max-content" }}>
            {[...liveMatches, ...liveMatches].map(
              (m, i) => {
                const home = getTeam(m.homeTeamId);
                const away = getTeam(m.awayTeamId);
                if (!home || !away) return null;
                return (
                  <Link
                    key={i}
                    href={`/matches/${m.id}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}
                  >
                    <span className="live-dot" style={{ width: "6px", height: "6px" }} />
                    <span className="text-xs font-body" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {home.crest} {home.shortName}
                    </span>
                    <span className="font-mono text-xs" style={{ color: "var(--live-pulse)", fontWeight: 700 }}>
                      {m.homeScore}-{m.awayScore}
                    </span>
                    <span className="text-xs font-body" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {away.shortName} {away.crest}
                    </span>
                    <span style={{ color: "var(--border)", margin: "0 8px" }}>│</span>
                  </Link>
                );
              }
            )}
          </div>
        </div>

        {/* ─── League Filter Pills ───────────────── */}
        <section style={{ paddingTop: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 12px" }}>
            <div className="section-label">BROWSE BY LEAGUE</div>
          </div>
          <LeagueFilterPills
            leagues={leagues}
            activeLeagueId={homeLeagueFilter}
            onSelectLeague={setHomeLeagueFilter}
          />
        </section>

        {/* ─── Today's Matches Carousel ──────────── */}
        <section style={{ padding: "20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 14px" }}>
            <div>
              <div className="section-label" style={{ marginBottom: "4px" }}>UPCOMING MATCHES</div>
              <h2 className="font-display text-h2" style={{ color: "var(--text-primary)" }}>THIS WEEK</h2>
            </div>
            <Link href="/matches" className="btn-ghost" style={{ padding: "8px 14px", textDecoration: "none" }}>
              See All →
            </Link>
          </div>
          <div className="carousel-track no-scrollbar">
            {filteredUpcomingMatches.slice(0, 8).map((m, i) => {
              const home = getTeam(m.homeTeamId);
              const away = getTeam(m.awayTeamId);
              const league = getLeague(m.leagueId);
              if (!home || !away || !league) return null;
              const d = new Date(m.matchDateUTC);
              const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
              const isFinished = m.status === "FINISHED";
              const kickoffLabel = isLive ? "LIVE" : isFinished ? "FT" :
                d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " +
                d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              return (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <MatchCard
                    homeTeam={home.shortName}
                    awayTeam={away.shortName}
                    homeCrest={home.crest}
                    awayCrest={away.crest}
                    homeImage={home.image}
                    awayImage={away.image}
                    kickoff={kickoffLabel}
                    league={league.name}
                    leagueLogo={league.logo}
                    leagueImage={league.image}
                    venueCount={m.venueCount}
                    status={isLive ? "LIVE" : isFinished ? "FINISHED" : "SCHEDULED"}
                    homeScore={m.homeScore ?? undefined}
                    awayScore={m.awayScore ?? undefined}
                    matchDay={m.matchDay}
                    isHot={m.isHot}
                    className={`animate-fade-up stagger-${i + 1}`}
                  />
                </Link>
              );
            })}
          </div>
        </section>

        {/* ─── Ad Placement: Banner ──────────────── */}
        <AdPlacement variant="banner" />

        {/* ─── Featured Venues ───────────────────── */}
        <section style={{ padding: "24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 14px" }}>
            <div>
              <div className="section-label" style={{ marginBottom: "4px" }}>POPULAR NEAR YOU</div>
              <h2 className="font-display text-h2" style={{ color: "var(--text-primary)" }}>FEATURED VENUES</h2>
            </div>
            <Link href="/venues" className="btn-ghost" style={{ padding: "8px 14px", textDecoration: "none" }}>
              View All →
            </Link>
          </div>
          <div className="carousel-track no-scrollbar">
            {venueCards.map((v, i) => (
              <div key={v.id} className={`animate-fade-up stagger-${i + 1}`} style={{ width: "340px", flexShrink: 0 }}>
                <VenueCard
                  name={v.name}
                  coverImage="/venue-hero.webp"
                  city={v.city}
                  address={v.addressLine1}
                  rating={v.rating}
                  reviewCount={v.reviewCount}
                  amenities={v.amenities}
                  cuisineTags={v.cuisineTags}
                  priceRange={v.priceRange}
                  isVerified={v.isVerified}
                  isFeatured={v.isFeatured}
                  spotsRemaining={null}
                  nextEvent={`${v.upcomingEventsCount} upcoming events`}
                  onClick={() => window.location.href = `/venues/${v.slug}`}
                  onBookNow={() => {
                    setSelectedVenueIdx(i);
                    setBookingOpen(true);
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ─── How It Works Section ──────────────── */}
        <section style={{ padding: "36px 20px", background: "var(--bg-surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div className="section-label" style={{ textAlign: "center", marginBottom: "8px" }}>HOW IT WORKS</div>
          <h2 className="font-display text-h1" style={{ textAlign: "center", color: "var(--text-primary)", marginBottom: "28px" }}>
            THREE EASY STEPS
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", maxWidth: "800px", margin: "0 auto" }}>
            {[
              { step: "01", icon: Trophy, title: "FIND A MATCH", desc: "Browse upcoming matches and find the one you want to watch", link: "/matches" },
              { step: "02", icon: MapPin, title: "PICK A VENUE", desc: "Explore nearby bars, lounges, and restaurants hosting watch parties", link: "/venues" },
              { step: "03", icon: Ticket, title: "RESERVE A SPOT", desc: "Book your spot with your group and show up ready to cheer", link: "/matches" },
            ].map((s: { step: string; icon: LucideIcon; title: string; desc: string; link: string }, i) => (
              <Link
                key={i}
                href={s.link}
                className={`card-flat animate-fade-up stagger-${i + 1}`}
                style={{ padding: "24px 20px", textAlign: "center", textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div className="font-mono text-xs" style={{ color: "var(--accent-primary)", fontWeight: 600, marginBottom: "8px" }}>
                  STEP {s.step}
                </div>
                <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center", color: "var(--accent-primary)" }}><s.icon size={30} /></div>
                <h3 className="font-display text-h3" style={{ color: "var(--text-primary)", marginBottom: "6px", letterSpacing: "0.06em" }}>
                  {s.title}
                </h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{s.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── Map / List Toggle View ────────────── */}
        <section style={{ padding: "24px 0 0" }}>
          <div style={{ padding: "0 20px 14px" }}>
            <div className="section-label" style={{ marginBottom: "4px" }}>
              {featuredMatch
                ? `${selectedHome?.shortName || "HOME"} VS ${selectedAway?.shortName || "AWAY"} · ${new Date(featuredMatch.matchDateUTC).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : "UPCOMING MATCH"}
            </div>
            <h2 className="font-display text-h2" style={{ color: "var(--text-primary)" }}>
              VENUES HOSTING THIS MATCH
            </h2>
          </div>
          <MapListToggle
            venues={mapVenueCards.map((v) => ({
              name: v.name,
              coverImage: "/venue-hero.webp",
              city: v.city,
              address: v.addressLine1,
              rating: v.rating,
              reviewCount: v.reviewCount,
              amenities: v.amenities,
              cuisineTags: v.cuisineTags,
              priceRange: v.priceRange,
              isVerified: v.isVerified,
              isFeatured: v.isFeatured,
              spotsRemaining: null,
              nextEvent: `${v.upcomingEventsCount} upcoming events`,
            }))}
            onVenueClick={(i) => {
              window.location.href = `/venues/${mapVenueCards[i]?.slug || ""}`;
            }}
            onBookNow={(i) => {
              const venue = mapVenueCards[i];
              const venueIdx = venueCards.findIndex((v) => v.id === venue?.id);
              if (venueIdx !== -1) {
                setSelectedVenueIdx(venueIdx);
                setBookingOpen(true);
              } else if (venue?.slug) {
                window.location.href = `/venues/${venue.slug}`;
              }
            }}
          />
        </section>

        {/* ─── Ad Placement: Inline ──────────────── */}
        <div style={{ padding: "16px 20px" }}>
          <AdPlacement variant="inline" label="Promote Your Service" />
        </div>

        {/* ─── Venue Dashboard Preview ───────────── */}
        <section style={{ padding: "36px 20px", background: "var(--bg-surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div className="section-label" style={{ marginBottom: "8px" }}>FOR VENUE OWNERS</div>
            <h2 className="font-display text-h1" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>MANAGE YOUR VENUE</h2>
            <p className="text-body" style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>
              List your establishment, host high-demand match nights, manage bookings, and grow your audience from one dashboard.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
              {[
                { icon: CalendarDays, label: "Host Matches", value: venueEvents.length.toString(), desc: "published events" },
                { icon: BarChart3, label: "Track Bookings", value: bookings.length.toString(), desc: "reservations" },
                {
                  icon: Users,
                  label: "Grow Followers",
                  value: VENUES.reduce((sum, venue) => sum + (venue.followerCount || 0), 0).toLocaleString(),
                  desc: "total followers",
                },
                { icon: Megaphone, label: "Venue Updates", value: posts.length.toString(), desc: "posts published" },
              ].map((stat: { icon: LucideIcon; label: string; value: string; desc: string }, i) => (
                <div key={i} className={`card-flat animate-fade-up stagger-${i + 1}`} style={{ padding: "16px", textAlign: "center" }}>
                  <span style={{ color: "var(--accent-primary)" }}><stat.icon size={20} /></span>
                  <div className="font-mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-primary)", margin: "6px 0 2px" }}>{stat.value}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)", fontWeight: 500 }}>{stat.desc}</div>
                </div>
              ))}
            </div>

            <Link href="/for-venues/register" className="btn-primary" style={{ padding: "14px 28px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <Building2 size={16} />
              Register Your Venue, Free
            </Link>
          </div>
        </section>

        {/* ─── Footer with Real Links ────────────── */}
        <footer style={{ padding: "36px 20px 28px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", maxWidth: "800px", margin: "0 auto" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <div className="font-display" style={{ fontSize: "1.8rem", letterSpacing: "0.08em", color: "var(--accent-primary)" }}>
                MATCHWATCH
              </div>
            </Link>
            <p className="text-sm" style={{ color: "var(--text-muted)", textAlign: "center" }}>
              The ultimate live-match watch-party directory for Houston, TX. Find venues, book spots, and never miss kickoff.
            </p>

            {/* Primary nav links */}
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "center" }}>
              {[
                { label: "Home", href: "/" },
                { label: "Matches", href: "/matches" },
                { label: "Venues", href: "/venues" },
                { label: "Admin Dashboard", href: "/admin" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm"
                  style={{ color: "var(--text-secondary)", textDecoration: "none", fontWeight: 600 }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--accent-primary)")}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-secondary)")}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Secondary links */}
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
              {[
                { label: "About", href: "/about" },
                { label: "Contact", href: "/contact" },
                { label: "For Venues", href: "/for-venues" },
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-xs"
                  style={{ color: "var(--text-muted)", textDecoration: "none" }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--accent-primary)")}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-muted)")}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              © 2026 MatchWatch. Houston, TX.
            </div>
          </div>
        </footer>

        {/* ─── Booking Drawer ────────────────────── */}
        <BookingDrawer
          isOpen={bookingOpen}
          onClose={() => setBookingOpen(false)}
          venueEventId={selectedVenueEvent?.id}
          venue={{
            name: venueCards[selectedVenueIdx]?.name || "",
            address: `${venueCards[selectedVenueIdx]?.addressLine1 || ""}, ${venueCards[selectedVenueIdx]?.city || ""}`,
          }}
          match={{
            homeTeam: selectedHome?.shortName || "HOME",
            awayTeam: selectedAway?.shortName || "AWAY",
            homeCrest: selectedHome?.image || selectedHome?.crest || "HOME",
            awayCrest: selectedAway?.image || selectedAway?.crest || "AWAY",
            kickoff: featuredMatch
              ? `${new Date(featuredMatch.matchDateUTC).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${new Date(featuredMatch.matchDateUTC).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
              : "TBD",
            league: selectedLeague?.name || "Match",
          }}
          spotsRemaining={selectedVenueEvent?.bookingLimit != null
            ? Math.max(0, selectedVenueEvent.bookingLimit - selectedVenueEvent.confirmedBookings)
            : 50}
          entryFee={selectedVenueEvent?.entryFee || undefined}
        />
      </AppShell>
    </ThemeProvider>
  );
}
