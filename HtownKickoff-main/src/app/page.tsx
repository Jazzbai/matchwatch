"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  Building2,
  CalendarDays,
  MapPin,
  Megaphone,
  Ticket,
  Trophy,
  Users,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { MatchCard } from "../components/MatchCard";
import { MapListToggle } from "../components/MapListToggle";
import { BookingDrawer } from "../components/BookingDrawer";
import { PaginationControls } from "../components/PaginationControls";
import { useData } from "../lib/data-provider";
import { getLeagueVisual, getMatchDisplay } from "../lib/match-display";
import { paginateItems } from "../lib/pagination";

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
        background: "var(--card)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        textAlign: "center",
        opacity: 0.6,
        fontSize: "0.75rem",
        color: "var(--muted-foreground)",
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
        background: activeLeagueId === "all" ? "var(--primary)" : "transparent",
        color: activeLeagueId === "all" ? "#fff" : "var(--muted-foreground)", fontWeight: 700,
      }} onClick={() => onSelectLeague("all")}>
        All Matches
      </button>
      {leagues.slice(0, 6).map((lg) => (
        <button key={lg.id} className="btn-ghost text-xs" style={{
          whiteSpace: "nowrap", padding: "8px 14px", borderRadius: "999px",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          borderColor: activeLeagueId === lg.id ? "var(--primary)" : "var(--border)",
          color: activeLeagueId === lg.id ? "var(--primary)" : "var(--muted-foreground)",
        }} onClick={() => onSelectLeague(lg.id)}>
          {lg.image ? <img src={lg.image} alt={lg.shortName} style={{ width: "16px", height: "16px", objectFit: "contain" }} /> : lg.logo} {lg.shortName}
        </button>
      ))}
    </div>
  );
}

function compareHomeMatches(a: { isFeatured: boolean; matchDateUTC: string }, b: { isFeatured: boolean; matchDateUTC: string }) {
  if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
  return new Date(a.matchDateUTC).getTime() - new Date(b.matchDateUTC).getTime();
}

function compareHomeVenues(a: { isFeatured: boolean; rating: number; name: string }, b: { isFeatured: boolean; rating: number; name: string }) {
  if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
  if (b.rating !== a.rating) return b.rating - a.rating;
  return a.name.localeCompare(b.name);
}

const PRIORITY_SOCCER_LEAGUES = [
  { key: "mls", label: "MLS", match: (name: string) => name === "mls" || name.includes("major league soccer") },
  { key: "premier-league", label: "Premier League", match: (name: string) => name.includes("premier league") },
  { key: "la-liga", label: "La Liga", match: (name: string) => name.includes("la liga") },
  { key: "bundesliga", label: "Bundesliga", match: (name: string) => name.includes("bundesliga") },
  { key: "serie-a", label: "Serie A", match: (name: string) => name.includes("serie a") },
  { key: "ligue-1", label: "Ligue 1", match: (name: string) => name.includes("ligue 1") },
] as const;

function normalizeLeagueName(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function getPrioritySoccerLeagueKey(league?: { name?: string; shortName?: string } | null) {
  const candidates = [normalizeLeagueName(league?.name), normalizeLeagueName(league?.shortName)].filter(Boolean);
  const match = PRIORITY_SOCCER_LEAGUES.find((entry) => candidates.some((candidate) => entry.match(candidate)));
  return match?.key ?? null;
}

function isSoccerLeague(league?: { sportId?: string; name?: string; shortName?: string } | null) {
  if (!league) return false;
  if (league.sportId === "soccer") return true;
  return getPrioritySoccerLeagueKey(league) !== null;
}

/* ═══════════════════════════════════════════════════
   HOME PAGE — Assembles all critical components
   Fully linked: every match, venue, team → single page
   ═══════════════════════════════════════════════════ */
export default function HomePage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [soccerLeagueFilter, setSoccerLeagueFilter] = useState("all");
  const [soccerMatchesPage, setSoccerMatchesPage] = useState(1);
  const [otherSportsFilter, setOtherSportsFilter] = useState("all");
  const [otherSportsPage, setOtherSportsPage] = useState(1);
  const [featuredVenuesPage, setFeaturedVenuesPage] = useState(1);
  const [hostingVenuesPage, setHostingVenuesPage] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [nowTs, setNowTs] = useState<number | null>(null);
  const { matches: MATCHES, venues: VENUES, leagues, sports, venueEvents, bookings, posts, getTeam, getLeague, getVenueEvents, isApiConnected } = useData();

  useEffect(() => {
    setHydrated(true);
    setNowTs(Date.now());
  }, []);

  const formatDateLabel = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(hydrated ? {} : { timeZone: "UTC" }),
    });
  };

  const formatKickoffLabel = (isoDate: string) => {
    const date = new Date(isoDate);
    return `${date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(hydrated ? {} : { timeZone: "UTC" }),
    })} · ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      ...(hydrated ? {} : { timeZone: "UTC" }),
    })}`;
  };

  const allActiveVenues = useMemo(
    () => [...VENUES.filter((v) => v.isActive)].sort(compareHomeVenues),
    [VENUES],
  );
  const liveMatches = MATCHES.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
  const upcomingMatches = useMemo(
    () => MATCHES
      .filter((m) => {
        const isUpcomingStatus = m.status === "SCHEDULED" || m.status === "TIMED";
        if (!isUpcomingStatus) return false;
        if (!hydrated || nowTs === null) return true;
        return new Date(m.matchDateUTC).getTime() >= nowTs;
      })
      .sort((a, b) => new Date(a.matchDateUTC).getTime() - new Date(b.matchDateUTC).getTime()),
    [MATCHES, hydrated, nowTs],
  );
  const thisWeekMatches = useMemo(() => {
    if (!hydrated || nowTs === null) {
      return upcomingMatches;
    }

    const weekAheadTs = nowTs + 7 * 24 * 60 * 60 * 1000;
    return upcomingMatches.filter((match) => {
      const kickoffTs = new Date(match.matchDateUTC).getTime();
      return kickoffTs >= nowTs && kickoffTs < weekAheadTs;
    });
  }, [hydrated, nowTs, upcomingMatches]);
  const prioritySoccerMatches = useMemo(
    () =>
      thisWeekMatches.filter((match) => {
        const league = getLeague(match.leagueId);
        return Boolean(getPrioritySoccerLeagueKey(league));
      }),
    [thisWeekMatches, getLeague],
  );
  const soccerLeagueOptions = useMemo(
    () =>
      PRIORITY_SOCCER_LEAGUES
        .map((entry) => {
          const league = leagues.find((candidate) => getPrioritySoccerLeagueKey(candidate) === entry.key);
          const hasMatches = prioritySoccerMatches.some((match) => getPrioritySoccerLeagueKey(getLeague(match.leagueId)) === entry.key);
          if (!league || !hasMatches) return null;
          return {
            id: entry.key,
            shortName: league.shortName || entry.label,
            logo: league.logo,
            image: league.image,
            label: entry.label,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [leagues, prioritySoccerMatches, getLeague],
  );
  const filteredSoccerMatches = useMemo(
    () =>
      prioritySoccerMatches.filter((match) => {
        if (soccerLeagueFilter === "all") return true;
        const league = getLeague(match.leagueId);
        return getPrioritySoccerLeagueKey(league) === soccerLeagueFilter;
      }),
    [prioritySoccerMatches, soccerLeagueFilter, getLeague],
  );
  const orderedSoccerMatches = useMemo(
    () => [...filteredSoccerMatches].sort(compareHomeMatches),
    [filteredSoccerMatches],
  );
  const orderedPrioritySoccerMatches = useMemo(
    () => [...prioritySoccerMatches].sort(compareHomeMatches),
    [prioritySoccerMatches],
  );
  const otherSportsMatches = useMemo(
    () =>
      thisWeekMatches.filter((match) => {
        const league = getLeague(match.leagueId);
        return !isSoccerLeague(league);
      }),
    [thisWeekMatches, getLeague],
  );
  const otherSportsOptions = useMemo(
    () => {
      const sportMap = new Map<string, { id: string; label: string }>();
      for (const match of otherSportsMatches) {
        const league = getLeague(match.leagueId);
        const sportId = league?.sportId;
        if (!sportId || sportMap.has(sportId)) continue;
        const sport = sports.find((candidate) => candidate.id === sportId);
        if (!sport) continue;
        sportMap.set(sportId, { id: sport.id, label: sport.name });
      }
      return Array.from(sportMap.values());
    },
    [otherSportsMatches, getLeague, sports],
  );
  const orderedThisWeekMatches = useMemo(
    () => [...thisWeekMatches].sort(compareHomeMatches),
    [thisWeekMatches],
  );
  const orderedUpcomingMatches = useMemo(
    () => [...upcomingMatches].sort(compareHomeMatches),
    [upcomingMatches],
  );
  const filteredOtherSportsMatches = useMemo(
    () =>
      otherSportsMatches.filter((match) => {
        if (otherSportsFilter === "all") return true;
        const league = getLeague(match.leagueId);
        return league?.sportId === otherSportsFilter;
      }),
    [otherSportsMatches, otherSportsFilter, getLeague],
  );
  const orderedOtherSportsMatches = useMemo(
    () => [...filteredOtherSportsMatches].sort(compareHomeMatches),
    [filteredOtherSportsMatches],
  );
  const featuredMatch = orderedSoccerMatches[0] || orderedPrioritySoccerMatches[0] || orderedThisWeekMatches[0] || orderedUpcomingMatches[0] || MATCHES[0];
  const { currentPage: currentSoccerMatchesPage, totalPages: soccerMatchesTotalPages, pageItems: paginatedSoccerMatches } = useMemo(
    () => paginateItems(orderedSoccerMatches, soccerMatchesPage),
    [orderedSoccerMatches, soccerMatchesPage],
  );
  const { currentPage: currentOtherSportsPage, totalPages: otherSportsTotalPages, pageItems: paginatedOtherSportsMatches } = useMemo(
    () => paginateItems(orderedOtherSportsMatches, otherSportsPage),
    [orderedOtherSportsMatches, otherSportsPage],
  );
  const { currentPage: currentFeaturedVenuesPage, totalPages: featuredVenuesTotalPages, pageItems: paginatedFeaturedVenues } = useMemo(
    () => paginateItems(allActiveVenues, featuredVenuesPage),
    [allActiveVenues, featuredVenuesPage],
  );
  const selectedVenue = useMemo(
    () => {
      if (!selectedVenueId) return allActiveVenues[0];
      return allActiveVenues.find((venue) => venue.id === selectedVenueId) || allActiveVenues[0];
    },
    [allActiveVenues, selectedVenueId],
  );
  const selectedVenueEvent = featuredMatch && selectedVenue
    ? getVenueEvents(featuredMatch.id).find((event) => event.venueId === selectedVenue.id)
    : undefined;
  const selectedHome = featuredMatch ? getTeam(featuredMatch.homeTeamId) : undefined;
  const selectedAway = featuredMatch ? getTeam(featuredMatch.awayTeamId) : undefined;
  const selectedLeague = featuredMatch ? getLeague(featuredMatch.leagueId) : undefined;
  const featuredMatchDisplay = featuredMatch
    ? getMatchDisplay(featuredMatch, {
        homeTeam: selectedHome,
        awayTeam: selectedAway,
        league: selectedLeague,
      })
    : null;
  const featuredVenueEvents = featuredMatch ? getVenueEvents(featuredMatch.id) : [];
  const mapVenueCards = useMemo(() => {
    if (featuredVenueEvents.length === 0) return allActiveVenues;

    const seen = new Set<string>();
    return featuredVenueEvents
      .map((event) => event.venue)
      .filter((venue) => {
        if (seen.has(venue.id)) return false;
        seen.add(venue.id);
        return true;
      })
      .sort(compareHomeVenues);
  }, [allActiveVenues, featuredVenueEvents]);
  const { currentPage: currentHostingVenuesPage, totalPages: hostingVenuesTotalPages, pageItems: paginatedHostingVenues } = useMemo(
    () => paginateItems(mapVenueCards, hostingVenuesPage),
    [mapVenueCards, hostingVenuesPage],
  );
  const getVenueCardImage = (venue: (typeof VENUES)[number]) =>
    venue.coverImageUrl || venue.galleryImageUrls?.[0] || "/assets/img-3.png";
  const featuredMatchHeading = featuredMatch
    ? `${featuredMatchDisplay?.label || "Match"} · ${formatDateLabel(featuredMatch.matchDateUTC)}`
    : "UPCOMING MATCH";

  const renderHomeMatchCard = (m: (typeof MATCHES)[number]) => {
    const league = getLeague(m.leagueId);
    if (!league) return null;

    const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
    const isFinished = m.status === "FINISHED";
    const cardStatus: "SCHEDULED" | "LIVE" | "FINISHED" = isLive
      ? "LIVE"
      : isFinished
        ? "FINISHED"
        : "SCHEDULED";

    if (m.eventFormat === "SINGLE_EVENT") {
      return (
        <MatchCard
          key={m.id}
          eventFormat="SINGLE_EVENT"
          eventTitle={m.eventTitle || league.name}
          eventSubtitle={m.eventSubtitle || undefined}
          homeTeam=""
          awayTeam=""
          homeCrest=""
          awayCrest=""
          kickoff={formatKickoffLabel(m.matchDateUTC)}
          league={league.shortName || league.name}
          leagueLogo={league.logo}
          leagueImage={league.image}
          venueCount={m.venueCount}
          status={cardStatus}
          matchDay={m.stage || m.matchDay}
          isHot={m.isHot}
          onClick={() => { window.location.href = `/matches/${m.id}`; }}
          style={{ minWidth: "unset", height: "100%" }}
        />
      );
    }

    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);
    const display = getMatchDisplay(m, { homeTeam: home, awayTeam: away, league });

    return (
      <MatchCard
        key={m.id}
        homeTeam={display.homeName}
        awayTeam={display.awayName}
        homeCrest={home?.crest || ""}
        awayCrest={away?.crest || ""}
        homeImage={home?.image}
        awayImage={away?.image}
        kickoff={formatKickoffLabel(m.matchDateUTC)}
        league={league.shortName || league.name}
        leagueLogo={league.logo}
        leagueImage={league.image}
        venueCount={m.venueCount}
        status={cardStatus}
        homeScore={m.homeScore ?? undefined}
        awayScore={m.awayScore ?? undefined}
        matchDay={m.stage || m.matchDay}
        isHot={m.isHot}
        onClick={() => { window.location.href = `/matches/${m.id}`; }}
        style={{ minWidth: "unset", height: "100%" }}
      />
    );
  };

  useEffect(() => {
    setSoccerMatchesPage(1);
  }, [soccerLeagueFilter, orderedSoccerMatches.length]);

  useEffect(() => {
    setOtherSportsPage(1);
  }, [otherSportsFilter, orderedOtherSportsMatches.length]);

  useEffect(() => {
    setFeaturedVenuesPage(1);
  }, [allActiveVenues.length]);

  useEffect(() => {
    setHostingVenuesPage(1);
  }, [featuredMatch?.id, mapVenueCards.length]);

  useEffect(() => {
    if (!selectedVenueId && allActiveVenues[0]?.id) {
      setSelectedVenueId(allActiveVenues[0].id);
      return;
    }

    if (selectedVenueId && !allActiveVenues.some((venue) => venue.id === selectedVenueId) && allActiveVenues[0]?.id) {
      setSelectedVenueId(allActiveVenues[0].id);
    }
  }, [allActiveVenues, selectedVenueId]);

  return (
      <AppShell>
        {/* ─── Immersive Floating Hero ──────────────────────── */}
        <section style={{ position: "relative", width: "100%", minHeight: "85vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "var(--background)" }}>
          {/* 3D Globs & Gradients */}
          <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-primary/20 blur-[120px] mix-blend-screen animate-pulse-slow pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-500/10 dark:bg-blue-600/20 blur-[100px] mix-blend-screen animate-float pointer-events-none" />

          {/* Background Image */}
          <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.25, pointerEvents: "none" }}>
            <Image
              src="/assets/main-hero.png"
              alt="Stadium Background"
              fill
              className="object-cover"
              priority
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--background), transparent 50%)" }} />
          </div>

          <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 1024, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/80 backdrop-blur-md text-secondary-foreground text-xs font-bold tracking-widest mb-8 border border-border/50 shadow-sm animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              GLOBAL FOOTBALL NIGHTS · HOUSTON, TX
            </div>
            
            <h1 className="font-display text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] tracking-tighter leading-[0.9] text-foreground mb-6 font-black drop-shadow-lg animate-slide-up w-full overflow-hidden text-clip whitespace-nowrap">
              MATCHWATCH
            </h1>
            
            <p className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 font-medium animate-fade-up stagger-1">
              Find the best bars, lounges, and restaurants hosting match-night watch parties. Book your spot and join the action.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
              <Link href="/matches" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 32px", borderRadius: 99, backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, fontSize: 16, textDecoration: "none", transition: "all 0.2s" }}>
                <Trophy size={20} /> Browse Matches
              </Link>
              <Link href="/venues" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 32px", borderRadius: 99, border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--foreground)", fontWeight: 700, fontSize: 16, textDecoration: "none", transition: "all 0.2s" }}>
                <MapPin size={20} /> Explore Venues
              </Link>
            </div>
            
            {!isApiConnected && (
              <p style={{ fontSize: 13, color: "var(--destructive)", backgroundColor: "color-mix(in oklch, var(--destructive) 10%, transparent)", padding: "8px 16px", borderRadius: 8, fontWeight: 500, marginTop: 16 }}>
                API not reachable yet. Start backend services to load live matches and venues.
              </p>
            )}
          </div>
        </section>

        {/* ─── Live Match Ticker ──────────────────── */}
        <div className="w-full bg-surface border-y border-border py-3 overflow-hidden relative z-20 shadow-sm bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-8 whitespace-nowrap animate-[marquee_30s_linear_infinite] w-max">
            {[...liveMatches, ...liveMatches].map(
              (m, i) => {
                const home = getTeam(m.homeTeamId);
                const away = getTeam(m.awayTeamId);
                const league = getLeague(m.leagueId);
                const display = getMatchDisplay(m, { homeTeam: home, awayTeam: away, league });
                return (
                  <Link
                    key={i}
                    href={`/matches/${m.id}`}
                    className="inline-flex items-center gap-3 text-foreground hover:text-primary transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {display.isSingleEvent ? (
                      <>
                        <span className="font-body font-bold text-sm">{display.title}</span>
                        {display.subtitle ? (
                          <span className="font-body text-sm text-muted-foreground">{display.subtitle}</span>
                        ) : null}
                        <span className="font-mono text-sm font-black text-red-500">
                          {league?.shortName || league?.name || "LIVE"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-body font-bold text-sm">
                          {home?.crest ? `${home.crest} ` : ""}{display.homeName}
                        </span>
                        <span className="font-mono text-sm font-black text-red-500">
                          {m.homeScore}-{m.awayScore}
                        </span>
                        <span className="font-body font-bold text-sm">
                          {display.awayName}{away?.crest ? ` ${away.crest}` : ""}
                        </span>
                      </>
                    )}
                    <span className="text-border mx-2">│</span>
                  </Link>
                );
              }
            )}
          </div>
        </div>

        {/* Soccer-first upcoming feed */}
        <section style={{ width: "100%", maxWidth: 1400, margin: "0 auto", padding: "96px 24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48, gap: 16 }}>
            <div>
              <div style={{ color: "var(--primary)", fontWeight: 700, letterSpacing: "0.16em", fontSize: 12, marginBottom: 8, textTransform: "uppercase" }}>SOCCER ONLY</div>
              <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 900, color: "var(--foreground)", margin: 0 }}>TOP LEAGUES THIS WEEK</h2>
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              <button style={{
                padding: "8px 20px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                backgroundColor: soccerLeagueFilter === "all" ? "var(--foreground)" : "var(--secondary)",
                color: soccerLeagueFilter === "all" ? "var(--background)" : "var(--secondary-foreground)",
              }} onClick={() => setSoccerLeagueFilter("all")}>
                All Soccer
              </button>
              {soccerLeagueOptions.map((lg) => (
                <button key={lg.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 20px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                  border: soccerLeagueFilter === lg.id ? "1px solid var(--primary)" : "1px solid var(--border)",
                  color: soccerLeagueFilter === lg.id ? "var(--primary)" : "var(--muted-foreground)",
                  backgroundColor: soccerLeagueFilter === lg.id ? "color-mix(in oklch, var(--primary) 10%, transparent)" : "var(--secondary)",
                }} onClick={() => setSoccerLeagueFilter(lg.id)}>
                  {lg.image ? <img src={lg.image} alt={lg.shortName} style={{ width: 16, height: 16, objectFit: "contain" }} /> : lg.logo} {lg.shortName}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {orderedSoccerMatches.length === 0 && (
              <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "color-mix(in oklch, var(--secondary) 20%, transparent)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", gridColumn: "1 / -1", minHeight: 300 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)", marginBottom: 16 }}>
                  <Trophy style={{ width: 32, height: 32, opacity: 0.5 }} />
                </div>
                <h3 style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 700, fontSize: 24, color: "var(--foreground)", marginBottom: 8 }}>No Soccer Matches Scheduled</h3>
                <p style={{ fontSize: 14, color: "var(--muted-foreground)", maxWidth: 440 }}>
                  No MLS, Premier League, La Liga, Bundesliga, Serie A, or Ligue 1 matches are currently scheduled in the next seven days for this filter.
                </p>
              </div>
            )}
            {paginatedSoccerMatches.map((m) => renderHomeMatchCard(m))}
          </div>
          <PaginationControls currentPage={currentSoccerMatchesPage} totalPages={soccerMatchesTotalPages} onPageChange={setSoccerMatchesPage} />
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
            <Link href="/matches" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", borderRadius: 999, border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)", textDecoration: "none", fontWeight: 700 }}>
              <CalendarDays style={{ width: 18, height: 18 }} />
              View All Matches
            </Link>
          </div>
        </section>

        {/* ─── Immersive Featured Venues Carousel ───────────────────── */}
        <section style={{ position: "relative", width: "100%", padding: "96px 0 72px", backgroundColor: "var(--background)", overflow: "hidden", zIndex: 20 }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px", marginBottom: 28, display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, position: "relative", zIndex: 10 }}>
            <div>
              <div className="text-primary font-bold tracking-widest text-xs mb-2">POPULAR NEAR YOU</div>
              <h2 className="font-display text-4xl md:text-5xl font-black text-foreground">FEATURED VENUES</h2>
            </div>
            <Link href="/venues" className="mt-2 md:mt-0 text-sm font-bold text-foreground bg-secondary hover:bg-secondary/80 px-6 py-3 rounded-full transition-colors border border-border">
              Explore Map →
            </Link>
          </div>
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, position: "relative", zIndex: 10 }}>
            {paginatedFeaturedVenues.map((v) => {
              const venueImage = getVenueCardImage(v);
              return (
                <div key={v.id} style={{ borderRadius: 28, overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "var(--card)", boxShadow: "0 12px 32px rgba(0,0,0,0.12)" }}>
                  <Link href={`/venues/${v.slug}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                    <div style={{ position: "relative", width: "100%", height: 220, overflow: "hidden" }}>
                      <img
                        src={venueImage}
                        alt={v.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = "/assets/img-3.png";
                        }}
                      />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(6, 10, 20, 0.88) 0%, rgba(6, 10, 20, 0.3) 60%, rgba(6, 10, 20, 0.1) 100%)" }} />
                      <div style={{ position: "absolute", inset: 0, padding: 18, display: "flex", flexDirection: "column", justifyContent: "flex-end", color: "#fff" }}>
                        {v.isFeatured && (
                          <span style={{ alignSelf: "flex-start", marginBottom: 8, padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", backgroundColor: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.35)" }}>
                            Featured
                          </span>
                        )}
                        <h3 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 26, lineHeight: 1.1, fontWeight: 800, margin: 0 }}>{v.name}</h3>
                        <p style={{ fontSize: 12, marginTop: 6, color: "rgba(255,255,255,0.88)", display: "flex", alignItems: "center", gap: 6 }}>
                          <MapPin size={12} />
                          {v.addressLine1}
                        </p>
                      </div>
                    </div>
                  </Link>

                  <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)" }}>{v.upcomingEventsCount} Events</span>
                    <button
                      onClick={() => {
                        setSelectedVenueId(v.id);
                        setBookingOpen(true);
                      }}
                      className="btn-primary"
                      style={{ padding: "8px 14px", fontSize: 12, borderRadius: 999 }}
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px" }}>
            <PaginationControls currentPage={currentFeaturedVenuesPage} totalPages={featuredVenuesTotalPages} onPageChange={setFeaturedVenuesPage} />
          </div>
        </section>
        {/* Other sports section */}
        <section style={{ width: "100%", maxWidth: 1400, margin: "0 auto", padding: "64px 24px 24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 40, gap: 16 }}>
            <div>
              <div style={{ color: "var(--primary)", fontWeight: 700, letterSpacing: "0.16em", fontSize: 12, marginBottom: 8, textTransform: "uppercase" }}>OTHER SPORTS</div>
              <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900, color: "var(--foreground)", margin: 0 }}>THIS WEEK BEYOND SOCCER</h2>
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              <button style={{
                padding: "8px 20px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                backgroundColor: otherSportsFilter === "all" ? "var(--foreground)" : "var(--secondary)",
                color: otherSportsFilter === "all" ? "var(--background)" : "var(--secondary-foreground)",
              }} onClick={() => setOtherSportsFilter("all")}>
                All Sports
              </button>
              {otherSportsOptions.map((sport) => (
                <button key={sport.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 20px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                  border: otherSportsFilter === sport.id ? "1px solid var(--primary)" : "1px solid var(--border)",
                  color: otherSportsFilter === sport.id ? "var(--primary)" : "var(--muted-foreground)",
                  backgroundColor: otherSportsFilter === sport.id ? "color-mix(in oklch, var(--primary) 10%, transparent)" : "var(--secondary)",
                }} onClick={() => setOtherSportsFilter(sport.id)}>
                  {sport.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {orderedOtherSportsMatches.length === 0 && (
              <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", border: "1px solid var(--border)", backgroundColor: "color-mix(in oklch, var(--secondary) 20%, transparent)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", gridColumn: "1 / -1", minHeight: 260 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)", marginBottom: 16 }}>
                  <Trophy style={{ width: 32, height: 32, opacity: 0.5 }} />
                </div>
                <h3 style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 700, fontSize: 24, color: "var(--foreground)", marginBottom: 8 }}>No Other Sports Scheduled</h3>
                <p style={{ fontSize: 14, color: "var(--muted-foreground)", maxWidth: 420 }}>
                  There are no upcoming non-soccer matches scheduled in the next seven days for this filter.
                </p>
              </div>
            )}
            {paginatedOtherSportsMatches.map((m) => renderHomeMatchCard(m))}
          </div>
          <PaginationControls currentPage={currentOtherSportsPage} totalPages={otherSportsTotalPages} onPageChange={setOtherSportsPage} />
        </section>


        {/* ─── Map / List Toggle View ────────────── */}
        <section style={{ width: "100%", maxWidth: 1400, margin: "0 auto", padding: "192px 24px 96px", position: "relative", zIndex: 10, backgroundColor: "var(--background)" }}>
          <div className="mb-12">
            <div className="text-primary font-bold tracking-widest text-xs mb-2">
              {featuredMatchHeading}
            </div>
            <h2 className="font-display text-4xl font-black text-foreground">
              FIND HOSTING VENUES
            </h2>
          </div>
          
            <div className="bg-card rounded-3xl border border-border shadow-xl p-2 relative z-20">
              <MapListToggle
                venues={paginatedHostingVenues.map((v) => ({
                  id: v.id,
                  slug: v.slug,
                  lat: v.lat,
                  lng: v.lng,
                  name: v.name,
                  coverImage: getVenueCardImage(v),
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
                  window.location.href = `/venues/${paginatedHostingVenues[i]?.slug || ""}`;
                }}
                onBookNow={(i) => {
                  const venue = paginatedHostingVenues[i];
                  if (venue?.id) {
                    setSelectedVenueId(venue.id);
                    setBookingOpen(true);
                  } else if (venue?.slug) {
                    window.location.href = `/venues/${venue.slug}`;
                  }
                }}
              />
          </div>
          <PaginationControls currentPage={currentHostingVenuesPage} totalPages={hostingVenuesTotalPages} onPageChange={setHostingVenuesPage} />
        </section>

        {/* ─── How It Works Section ──────────────── */}
        <section style={{ width: "100%", backgroundColor: "var(--secondary)", padding: "96px 0", marginTop: 48 }}>
            <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px" }}>
                <div className="text-center mb-16">
                    <div className="text-primary font-bold tracking-widest text-xs mb-2">HOW IT WORKS</div>
                    <h2 className="font-display text-4xl md:text-5xl font-black text-foreground">THREE EASY STEPS</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                    <div className="hidden md:block absolute top-[40px] left-[15%] right-[15%] h-px bg-border z-0" />
                    {[
                    { step: "01", icon: Trophy, title: "FIND A MATCH", desc: "Browse upcoming matches and find the one you want to watch", link: "/matches" },
                    { step: "02", icon: MapPin, title: "PICK A VENUE", desc: "Explore nearby bars, lounges, and restaurants hosting watch parties", link: "/venues" },
                    { step: "03", icon: Ticket, title: "RESERVE A SPOT", desc: "Book your spot with your group and show up ready to cheer", link: "/matches" },
                    ].map((s: { step: string; icon: LucideIcon; title: string; desc: string; link: string }, i) => (
                    <Link
                        key={i}
                        href={s.link}
                        className="relative z-10 flex flex-col items-center text-center group"
                    >
                        <div className="w-20 h-20 rounded-2xl bg-background border border-border shadow-md flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-background transition-colors duration-300 mb-6 group-hover:-translate-y-2 group-hover:shadow-xl">
                            <s.icon size={32} />
                        </div>
                        <div className="font-mono text-xs text-primary font-bold mb-2 tracking-widest">STEP {s.step}</div>
                        <h3 className="font-display font-bold text-xl text-foreground mb-3">{s.title}</h3>
                        <p className="text-muted-foreground text-sm font-medium">{s.desc}</p>
                    </Link>
                    ))}
                </div>
            </div>
        </section>

        {/* ─── Venue Dashboard Preview ───────────── */}
        <section style={{ width: "100%", maxWidth: 1400, margin: "0 auto", padding: "96px 24px", position: "relative" }}>
             <div style={{ position: "absolute", inset: 0, borderRadius: 48, background: "linear-gradient(to right, var(--background), color-mix(in oklch, var(--secondary) 30%, transparent))", zIndex: -1 }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 48, padding: "32px 0" }} className="lg:flex-row lg:items-center lg:gap-24">
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 8 }}>FOR VENUE OWNERS</div>
                        <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 40, fontWeight: 900, color: "var(--foreground)", lineHeight: 1.1 }}>HOST THE GAME.<br/>PACK THE BAR.</h2>
                    </div>
                    <p style={{ fontSize: 17, color: "var(--muted-foreground)", fontWeight: 500, maxWidth: 480, lineHeight: 1.6 }}>
                        List your establishment, host high-demand match nights, manage bookings, and grow your audience from one unified dashboard.
                    </p>
                    <ul style={{ display: "flex", flexDirection: "column", gap: 16, fontWeight: 700, color: "var(--foreground)" }}>
                        <li style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "color-mix(in oklch, var(--primary) 15%, transparent)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><ShieldCheck size={16}/></span>
                            Verified Venue Status
                        </li>
                        <li style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "color-mix(in oklch, var(--primary) 15%, transparent)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ticket size={16}/></span>
                            Direct Booking Engine
                        </li>
                        <li style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "color-mix(in oklch, var(--primary) 15%, transparent)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Megaphone size={16}/></span>
                            Push Notifications to Fans
                        </li>
                    </ul>
                    <Link href="/for-venues/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 32px", borderRadius: 99, backgroundColor: "var(--foreground)", color: "var(--background)", fontWeight: 700, fontSize: 15, textDecoration: "none", transition: "all 0.2s", width: "fit-content" }}>
                        <Building2 size={18} />
                        Register Your Venue
                    </Link>
                </div>

                <div style={{ flex: 1, width: "100%", position: "relative" }}>
                    <div style={{ width: "100%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top right, color-mix(in oklch, var(--primary) 25%, transparent), color-mix(in oklch, oklch(0.6 0.15 250) 25%, transparent))", borderRadius: 48, filter: "blur(48px)", opacity: 0.5 }} />
                        <div style={{ backgroundColor: "var(--card)", width: "100%", maxWidth: 420, padding: 24, borderRadius: 32, border: "1px solid color-mix(in oklch, var(--border) 60%, transparent)", boxShadow: "0 16px 48px rgba(0,0,0,0.15)", position: "relative", zIndex: 10 }}>
                             <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                                <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>DASHBOARD</span>
                                <div style={{ display: "flex", gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#f87171" }}/><div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#fbbf24" }}/><div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#4ade80" }}/></div>
                             </div>
                             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                {[
                                    { icon: CalendarDays, label: "Matches Hosted", value: venueEvents.length.toString() },
                                    { icon: BarChart3, label: "Total Bookings", value: bookings.length.toString() },
                                    { icon: Users, label: "Followers", value: "1,204" },
                                    { icon: Trophy, label: "Revenue", value: "$4.2k" },
                                ].map((stat, i) => (
                                    <div key={i} style={{ backgroundColor: "var(--secondary)", padding: 16, borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                                       <stat.icon size={24} style={{ color: "var(--primary)", marginBottom: 8 }} />
                                       <span style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 24, fontWeight: 900, color: "var(--foreground)" }}>{stat.value}</span>
                                       <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.1em" }}>{stat.label}</span>
                                    </div>
                                ))}
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* ─── Footer with Real Links ──────────── */}
        <footer style={{ width: "100%", borderTop: "1px solid var(--border)", backgroundColor: "var(--background)", padding: "80px 0 96px", marginTop: "auto" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <Link href="/" style={{ marginBottom: 24, textDecoration: "none" }}>
              <div className="font-display font-black text-3xl tracking-tighter hover:scale-105 transition-transform">
                MATCHWATCH<span className="text-primary">.</span>
              </div>
            </Link>
            <p className="text-base font-medium text-muted-foreground max-w-md mx-auto mb-10">
              The ultimate live-match watch-party directory. Find venues, book spots, and never miss kickoff.
            </p>

            {/* Primary nav links */}
            <div className="flex flex-wrap gap-6 justify-center mb-8">
              {[
                { label: "Home", href: "/" },
                { label: "Matches", href: "/matches" },
                { label: "Venues", href: "/venues" },
                { label: "Admin Dashboard", href: "/admin" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="font-bold text-foreground hover:text-primary transition-colors text-sm"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Secondary links */}
            <div className="flex flex-wrap gap-4 justify-center mb-12">
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
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="text-xs font-mono font-bold text-muted-foreground opacity-50">
              © 2026 MatchWatch. Houston, TX. All rights reserved.
            </div>
          </div>
        </footer>

        {/* ─── Booking Drawer ────────────────────── */}
        <BookingDrawer
          isOpen={bookingOpen}
          onClose={() => setBookingOpen(false)}
          venueEventId={selectedVenueEvent?.id}
          venue={{
            name: selectedVenue?.name || "",
            address: `${selectedVenue?.addressLine1 || ""}, ${selectedVenue?.city || ""}`,
          }}
          match={{
            eventFormat: featuredMatch?.eventFormat,
            title: featuredMatchDisplay?.title || "Match",
            subtitle: featuredMatchDisplay?.subtitle,
            homeTeam: featuredMatchDisplay?.homeName,
            awayTeam: featuredMatchDisplay?.awayName,
            homeCrest: selectedHome?.image || selectedHome?.crest || "",
            awayCrest: selectedAway?.image || selectedAway?.crest || "",
            eventBadge: (() => {
              const visual = getLeagueVisual(selectedLeague);
              return visual.image || visual.logo;
            })(),
            kickoff: featuredMatch
              ? formatKickoffLabel(featuredMatch.matchDateUTC)
              : "TBD",
            league: selectedLeague?.name || "Match",
          }}
          spotsRemaining={selectedVenueEvent?.bookingLimit != null
            ? Math.max(0, selectedVenueEvent.bookingLimit - selectedVenueEvent.confirmedBookings)
            : 50}
          entryFee={selectedVenueEvent?.entryFee || undefined}
        />
      </AppShell>
  );
}
