"use client";

import React from "react";
import Link from "next/link";
import { FloatingNav } from "../components/AppShell";
import SportsCarousel from "../components/SportsCarousel";
import { useAuth } from "../lib/auth-context";
import { type League, type Match, type Sport, type Team, type Venue, type VenueEvent } from "../lib/data";
import { useData } from "../lib/data-provider";

const MW_VARS = `
  :root{
    --mw-bg:var(--background);--mw-card:var(--card);--mw-line:var(--border);
    --mw-fg:var(--foreground);--mw-dim:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);--mw-ink:#0a0b0d;
  }
`;

const CSS = `
  .hp{background:#07090d;color:var(--mw-fg);min-height:100vh;}
  .hp a{color:inherit;text-decoration:none;}
  .hp-wrap{max-width:1200px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}
  .hp-grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px);background-size:64px 64px;mask-image:linear-gradient(180deg,transparent,#000 28%,#000 72%,transparent);}

  .hp-hero{position:relative;overflow:hidden;border-bottom:1px solid rgba(255,255,255,0.07);}
  .hp-hero-bg{position:absolute;inset:0;background:radial-gradient(120% 90% at 12% 0%,color-mix(in srgb,var(--mw-accent) 22%,transparent),transparent 55%),radial-gradient(90% 80% at 92% 20%,rgba(30,70,160,0.28),transparent 60%),#06070a;}
  .hp-hero-inner{position:relative;z-index:2;max-width:1200px;margin-inline:auto;width:100%;padding:118px clamp(16px,4vw,28px) 88px;}
  .hp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mw-accent) 32%,transparent);padding:6px 13px;border-radius:999px;margin-bottom:22px;}
  .hp-kicker .dot{width:6px;height:6px;border-radius:50%;background:var(--mw-accent);animation:hpPulse 1.4s ease-in-out infinite;}
  @keyframes hpPulse{0%,100%{opacity:.35;}50%{opacity:1;}}
  .hp-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:clamp(2.6rem,6.4vw,4.6rem);line-height:.98;letter-spacing:-.03em;margin:0 0 20px;max-width:820px;color:#fff;text-wrap:balance;}
  .hp-h1 em{font-style:normal;color:var(--mw-accent);}
  .hp-sub{max-width:600px;font-size:1.08rem;line-height:1.6;color:rgba(255,255,255,.76);margin:0 0 32px;}
  .hp-cta-row{display:flex;flex-wrap:wrap;gap:12px;}
  .hp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;color:#fff;font-weight:700;font-size:14px;padding:14px 26px;border-radius:999px;border:1px solid rgba(255,255,255,.22);transition:all .18s;}
  .hp-btn:hover{border-color:rgba(255,255,255,.5);transform:translateY(-1px);}
  .hp-btn.primary{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);font-weight:800;}
  .hp-btn.primary:hover{box-shadow:0 14px 34px color-mix(in srgb,var(--mw-accent) 32%,transparent);}
  .hp-stats{display:flex;flex-wrap:wrap;gap:26px;margin-top:44px;}
  .hp-stat-n{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:24px;color:#fff;}
  .hp-stat-l{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8b93a1;margin-top:2px;}

  .hp-sec{padding:52px 0;border-top:1px solid rgba(255,255,255,.07);}
  .hp-sec:first-of-type{border-top:0;}
  .hp-sh{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:22px;}
  .hp-st{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.5rem;letter-spacing:-.01em;display:flex;align-items:center;gap:12px;min-width:0;}
  .hp-tag{font-family:var(--font-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--mw-accent);border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:6px;white-space:nowrap;}
  .hp-see{font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8b93a1;white-space:nowrap;}
  .hp-see:hover{color:var(--mw-accent);}

  .hp-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:16px;}
  .hp-tab{cursor:pointer;font-family:var(--font-mono),monospace;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:8px 14px;border-radius:999px;transition:all .15s;background:transparent;color:#8b93a1;border:1px solid rgba(255,255,255,.14);}
  .hp-tab:hover{color:#fff;border-color:rgba(255,255,255,.35);}
  .hp-tab.on{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}

  .hp-leagues{display:grid;grid-template-columns:repeat(auto-fill,minmax(184px,1fr));gap:14px;}
  .hp-league{display:flex;align-items:center;gap:14px;background:#12161d;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;transition:all .16s;}
  .hp-league:hover{border-color:color-mix(in srgb,var(--mw-accent) 40%,transparent);transform:translateY(-3px);}
  .hp-league-mark{width:48px;height:48px;border-radius:10px;flex-shrink:0;display:grid;place-items:center;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:14px;letter-spacing:-.02em;color:#fff;border:1px solid rgba(255,255,255,.1);overflow:hidden;}
  .hp-league-mark img{width:36px;height:36px;object-fit:contain;}
  .hp-league-name{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:13px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .hp-league-count{font-family:var(--font-mono),monospace;font-size:11px;color:var(--mw-accent);font-weight:600;margin-top:3px;}

  .hp-games{display:grid;grid-template-columns:repeat(auto-fill,minmax(288px,1fr));gap:14px;}
  .hp-match{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#12161d;padding:16px;display:flex;flex-direction:column;gap:12px;transition:all .16s;}
  .hp-match:hover{border-color:color-mix(in srgb,var(--mw-accent) 32%,transparent);transform:translateY(-2px);}
  .hp-match-top{display:flex;align-items:center;justify-content:space-between;font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8b93a1;}
  .hp-match-tag{color:var(--mw-accent);font-weight:800;}
  .hp-team{display:flex;align-items:center;gap:10px;min-width:0;}
  .hp-team-name{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .hp-crest{width:30px;height:30px;border-radius:7px;display:grid;place-items:center;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:11px;color:#fff;flex-shrink:0;overflow:hidden;}
  .hp-crest img{width:28px;height:28px;object-fit:contain;}
  .hp-vs{font-family:var(--font-mono),monospace;font-size:11px;color:#8b93a1;font-weight:800;text-align:center;}
  .hp-match-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,.1);font-family:var(--font-mono),monospace;font-size:11px;color:#8b93a1;}
  .hp-match-foot strong{color:var(--mw-accent);font-weight:700;white-space:nowrap;}

  .hp-venue-layout{display:grid;grid-template-columns:1.35fr 1fr;gap:18px;}
  .hp-spotlight{position:relative;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.08);min-height:384px;display:flex;flex-direction:column;justify-content:flex-end;transition:border-color .16s;}
  .hp-spotlight:hover{border-color:color-mix(in srgb,var(--mw-accent) 45%,transparent);}
  .hp-spot-bg{position:absolute;inset:0;background:linear-gradient(145deg,#12224a,#0d0f14);}
  .hp-spot-bg img{width:100%;height:100%;object-fit:cover;}
  .hp-spot-mono{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:120px;color:rgba(255,255,255,.07);}
  .hp-spot-scrim{position:absolute;inset:0;background:linear-gradient(0deg,rgba(4,5,8,.95) 8%,rgba(4,5,8,.35) 55%,transparent 100%);}
  .hp-spot-body{position:relative;z-index:2;padding:24px;}
  .hp-pill-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}
  .hp-pill{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--mw-accent);background:rgba(0,0,0,.5);border:1px solid color-mix(in srgb,var(--mw-accent) 40%,transparent);padding:5px 10px;border-radius:999px;}
  .hp-pill.muted{color:#c8cfda;border-color:rgba(255,255,255,.14);}
  .hp-spot-name{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:30px;line-height:1.05;margin-bottom:10px;color:#fff;}
  .hp-spot-meta{font-family:var(--font-mono),monospace;font-size:12px;color:#c8cfda;margin-bottom:16px;}
  .hp-spot-actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px;font-family:var(--font-mono),monospace;font-size:12px;}
  .hp-spot-actions strong{color:#fff;}
  .hp-spot-actions em{font-style:normal;color:var(--mw-accent);font-weight:700;}
  .hp-reserve{margin-left:auto;display:inline-flex;align-items:center;gap:8px;background:var(--mw-accent);color:var(--mw-ink);font-weight:800;font-size:13px;padding:11px 20px;border-radius:999px;}
  .hp-rail{display:flex;flex-direction:column;gap:12px;}
  .hp-rail-card{display:flex;align-items:center;gap:14px;background:#12161d;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;transition:all .16s;}
  .hp-rail-card:hover{border-color:rgba(255,255,255,.22);transform:translateY(-2px);}
  .hp-rail-img{width:56px;height:56px;border-radius:10px;flex-shrink:0;display:grid;place-items:center;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:18px;color:rgba(255,255,255,.85);overflow:hidden;}
  .hp-rail-img img{width:100%;height:100%;object-fit:cover;}
  .hp-rail-city{font-family:var(--font-mono),monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#8b93a1;}
  .hp-rail-name{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:15px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .hp-rail-meta{font-family:var(--font-mono),monospace;font-size:11px;color:#c8cfda;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .hp-rail-score{text-align:right;flex-shrink:0;font-family:var(--font-mono),monospace;}
  .hp-rail-score strong{font-size:12px;color:#fff;}
  .hp-rail-score span{display:block;font-size:11px;color:var(--mw-accent);font-weight:700;margin-top:3px;}

  .hp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
  .hp-step{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#12161d;padding:24px;}
  .hp-step .n{font-family:var(--font-mono),monospace;font-size:12px;font-weight:700;color:var(--mw-ink);background:var(--mw-accent);width:28px;height:28px;border-radius:8px;display:grid;place-items:center;margin-bottom:14px;}
  .hp-step h3{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:16px;margin:0 0 6px;}
  .hp-step p{font-size:13px;color:#8b93a1;line-height:1.55;margin:0;}
  .hp-band{border:1px solid rgba(255,255,255,.08);border-radius:16px;background:linear-gradient(120deg,color-mix(in srgb,var(--mw-accent) 12%,transparent),transparent 60%),#12161d;padding:38px;display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;}
  .hp-band h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.7rem;margin:0 0 6px;}
  .hp-band p{font-size:14px;color:#8b93a1;max-width:520px;margin:0;}
  .hp-empty{padding:36px 20px;text-align:center;border:1px dashed rgba(255,255,255,.12);border-radius:12px;color:#8b93a1;font-size:14px;}
  .hp-footer{border-top:1px solid rgba(255,255,255,.07);}
  .hp-footer-inner{max-width:1200px;margin:0 auto;padding:28px clamp(16px,4vw,28px);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;}

  @media(max-width:900px){.hp-venue-layout{grid-template-columns:1fr;}.hp-spotlight{min-height:320px;}.hp-steps{grid-template-columns:1fr;}.hp-sh{align-items:flex-start;flex-direction:column;}.hp-reserve{margin-left:0;}}
  @media(max-width:640px){.hp-hero-inner{padding:112px 16px 62px;}.hp-st{flex-wrap:wrap;}.hp-games,.hp-leagues{grid-template-columns:1fr;}.hp-spot-name{font-size:24px;}.hp-band{padding:24px;}}
`;

const SPORT_ORDER = ["soccer", "baseball", "basketball", "hockey", "american-football", "motorsport"];

function isPublicVenue(venue: Venue) {
  const name = venue.name.toLowerCase();
  return !venue.amenities?.includes("OFFICIAL_FAN_FEST")
    && !name.includes("fifa fan festival")
    && !name.includes("fifa fan zone")
    && !name.includes("official fifa fan zone");
}

function isUpcomingMatch(match: Match, now: number) {
  const ts = new Date(match.matchDateUTC).getTime();
  if (!Number.isFinite(ts)) return false;
  const active = match.status === "SCHEDULED" || match.status === "TIMED" || match.status === "IN_PLAY" || match.status === "PAUSED";
  return active && ts >= now - 4 * 60 * 60 * 1000;
}

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "MW";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function colorFor(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ["#12224a", "#41111c", "#4a2109", "#1c2430", "#0a2e1a", "#2a0a3e", "#3a1400", "#0a3a2e"];
  return colors[Math.abs(hash) % colors.length];
}

function gradientFor(value: string) {
  return `linear-gradient(145deg,${colorFor(value)},#0a0c11)`;
}

function leagueCode(league?: League) {
  return (league?.shortName || league?.logo || league?.name || "MW").slice(0, 4).toUpperCase();
}

function sportRank(sport?: Sport) {
  const key = (sport?.slug || sport?.id || "").toLowerCase();
  const rank = SPORT_ORDER.findIndex((item) => key === item || key.includes(item));
  return rank === -1 ? SPORT_ORDER.length : rank;
}

function formatMatchWhen(match: Match) {
  const date = new Date(match.matchDateUTC);
  if (!Number.isFinite(date.getTime())) return "Time TBD";
  const day = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} / ${time}`;
}

function TeamMark({ team, label }: { team?: Team; label: string }) {
  const [failed, setFailed] = React.useState(false);
  if (team?.image && !failed) {
    return (
      <span className="hp-crest" style={{ background: "transparent" }}>
        <img src={team.image} alt="" onError={() => setFailed(true)} />
      </span>
    );
  }
  return <span className="hp-crest" style={{ background: team?.color || gradientFor(label) }}>{team?.shortName?.slice(0, 3).toUpperCase() || initials(label)}</span>;
}

function VenueImage({ venue, className }: { venue: Venue; className: string }) {
  const [failed, setFailed] = React.useState(false);
  if (venue.coverImageUrl && !failed) {
    return <img src={venue.coverImageUrl} alt="" onError={() => setFailed(true)} />;
  }
  return <span className={className}>{initials(venue.name)}</span>;
}

export default function HomePage() {
  const { venues, matches, leagues, sports, venueEvents, isLoading, getTeam, getLeague } = useData();
  const { user } = useAuth();
  const [selectedSportId, setSelectedSportId] = React.useState<string | null>(null);
  const [spotlightIndex, setSpotlightIndex] = React.useState(0);
  const now = Date.now();
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;

  const upcomingMatches = React.useMemo(() => matches
    .filter((match) => isUpcomingMatch(match, now))
    .sort((a, b) => new Date(a.matchDateUTC).getTime() - new Date(b.matchDateUTC).getTime()), [matches, now]);

  const leagueWeekCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const match of upcomingMatches) {
      const ts = new Date(match.matchDateUTC).getTime();
      if (ts <= weekEnd) counts.set(match.leagueId, (counts.get(match.leagueId) || 0) + 1);
    }
    return counts;
  }, [upcomingMatches, weekEnd]);

  const sportCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const match of upcomingMatches) {
      const league = getLeague(match.leagueId);
      const sportId = league?.sportId || "soccer";
      counts.set(sportId, (counts.get(sportId) || 0) + 1);
    }
    return counts;
  }, [getLeague, upcomingMatches]);

  const availableSports = React.useMemo(() => sports
    .filter((sport) => sportCounts.has(sport.id))
    .sort((a, b) => sportRank(a) - sportRank(b) || a.name.localeCompare(b.name)), [sportCounts, sports]);

  const visibleLeagues = React.useMemo(() => leagues
    .filter((league) => leagueWeekCounts.has(league.id))
    .filter((league) => !selectedSportId || (league.sportId || "soccer") === selectedSportId)
    .sort((a, b) => (leagueWeekCounts.get(b.id) || 0) - (leagueWeekCounts.get(a.id) || 0) || a.name.localeCompare(b.name))
    .slice(0, 12), [leagueWeekCounts, leagues, selectedSportId]);

  const visibleMatches = React.useMemo(() => upcomingMatches
    .filter((match) => {
      const league = getLeague(match.leagueId);
      return !selectedSportId || (league?.sportId || "soccer") === selectedSportId;
    })
    .slice(0, 8), [getLeague, selectedSportId, upcomingMatches]);

  const publicVenues = React.useMemo(() => venues
    .filter(isPublicVenue)
    .sort((a, b) => {
      if ((b.upcomingEventsCount || 0) !== (a.upcomingEventsCount || 0)) return (b.upcomingEventsCount || 0) - (a.upcomingEventsCount || 0);
      if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
      return a.name.localeCompare(b.name);
    }), [venues]);

  const venueEventsByVenue = React.useMemo(() => {
    const map = new Map<string, VenueEvent[]>();
    for (const event of venueEvents) {
      const rows = map.get(event.venueId) || [];
      rows.push(event);
      map.set(event.venueId, rows);
    }
    return map;
  }, [venueEvents]);

  const spotlightVenue = publicVenues[spotlightIndex % Math.max(publicVenues.length, 1)];
  const railVenues = publicVenues.filter((venue) => venue.id !== spotlightVenue?.id).slice(0, 4);
  const dynamicLeagueCount = new Set(upcomingMatches.map((match) => match.leagueId)).size;
  const dynamicSportLabel = availableSports.length > 0 ? `${availableSports.length} sports live` : "Live sports schedule";

  return (
    <div className="hp">
      <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + "body{background:#07090d!important;color:var(--mw-fg)!important;}" }} />
      <FloatingNav />

      <section id="top" className="hp-hero">
        <div className="hp-hero-bg" />
        <div className="hp-grid-bg" />
        <div className="hp-hero-inner">
          <span className="hp-kicker"><span className="dot" />Watch parties for every sport &middot; World Cup 2026</span>
          <h1 className="hp-h1">Find your crowd for every <em>match.</em></h1>
          <p className="hp-sub">
            From global tournaments to MLS, MLB, NBA, NFL, and more, find the bar showing your game,
            reserve a table, and watch with real fans near you.
          </p>
          <div className="hp-cta-row">
            <Link href="/venues" className="hp-btn primary">Find a bar near me</Link>
            <Link href="/matches" className="hp-btn">Browse matches</Link>
            {!user && <Link href="/login?view=signup" className="hp-btn">Join free</Link>}
          </div>
          <div className="hp-stats">
            <div><div className="hp-stat-n">{formatCount(upcomingMatches.length)}</div><div className="hp-stat-l">upcoming games</div></div>
            <div><div className="hp-stat-n">{formatCount(publicVenues.length)}</div><div className="hp-stat-l">watch-party venues</div></div>
            <div><div className="hp-stat-n">{formatCount(dynamicLeagueCount)}</div><div className="hp-stat-l">leagues live</div></div>
          </div>
        </div>
      </section>

      <div className="hp-wrap">
        <SportsCarousel />
        <section id="leagues" className="hp-sec">
          <div className="hp-sh">
            <div className="hp-st">Follow every league <span className="hp-tag">Live counts</span></div>
            <Link href="/matches" className="hp-see">All matches &rarr;</Link>
          </div>
          <div className="hp-tabs">
            <button className={`hp-tab${selectedSportId === null ? " on" : ""}`} onClick={() => setSelectedSportId(null)}>
              All {upcomingMatches.length}
            </button>
            {availableSports.map((sport) => (
              <button key={sport.id} className={`hp-tab${selectedSportId === sport.id ? " on" : ""}`} onClick={() => setSelectedSportId(sport.id)}>
                {sport.shortName || sport.name} {sportCounts.get(sport.id) || 0}
              </button>
            ))}
          </div>
          {visibleLeagues.length > 0 ? (
            <div className="hp-leagues">
              {visibleLeagues.map((league) => (
                <Link key={league.id} href={`/matches?league=${league.id}`} className="hp-league">
                  <div className="hp-league-mark" style={{ background: league.image ? "rgba(255,255,255,.92)" : gradientFor(league.id) }}>
                    {league.image ? <img src={league.image} alt="" /> : leagueCode(league)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="hp-league-name">{league.name}</div>
                    <div className="hp-league-count">{leagueWeekCounts.get(league.id) || 0} this week</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="hp-empty">{isLoading ? "Loading league schedule..." : "No active league schedule found."}</div>
          )}
        </section>

        <section id="games" className="hp-sec">
          <div className="hp-sh">
            <div className="hp-st">Upcoming games <span className="hp-tag">{dynamicSportLabel}</span></div>
            <Link href="/matches" className="hp-see">All matches &rarr;</Link>
          </div>
          {visibleMatches.length > 0 ? (
            <div className="hp-games">
              {visibleMatches.map((match) => {
                const league = getLeague(match.leagueId);
                const home = match.homeTeamId ? getTeam(match.homeTeamId) : undefined;
                const away = match.awayTeamId ? getTeam(match.awayTeamId) : undefined;
                const homeName = match.homeTeamName || home?.name || match.eventTitle || "TBD";
                const awayName = match.awayTeamName || away?.name || "";
                return (
                  <Link key={match.id} href={`/matches/${match.id}`} className="hp-match">
                    <div className="hp-match-top">
                      <span className="hp-match-tag">{league?.shortName || league?.name || "Match"}</span>
                      <span>{match.status === "IN_PLAY" ? "Live" : new Date(match.matchDateUTC).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </div>
                    <div className="hp-team">
                      <TeamMark team={home} label={homeName} />
                      <span className="hp-team-name">{homeName}</span>
                    </div>
                    {awayName ? <div className="hp-vs">VS</div> : null}
                    {awayName ? (
                      <div className="hp-team">
                        <TeamMark team={away} label={awayName} />
                        <span className="hp-team-name">{awayName}</span>
                      </div>
                    ) : null}
                    <div className="hp-match-foot">
                      <span>{formatMatchWhen(match)}</span>
                      <strong>{match.venueCount || 0} venues</strong>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="hp-empty">{isLoading ? "Loading upcoming games..." : "No upcoming games scheduled right now."}</div>
          )}
        </section>

        <section id="venues" className="hp-sec">
          <div className="hp-sh">
            <div className="hp-st">Where fans are watching <span className="hp-tag">{publicVenues[0]?.city || "Local venues"}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              {publicVenues.length > 1 ? (
                <button className="hp-tab" type="button" onClick={() => setSpotlightIndex((value) => value + 1)}>Shuffle</button>
              ) : null}
              <Link href="/venues" className="hp-see">Browse all venues &rarr;</Link>
            </div>
          </div>
          {spotlightVenue ? (
            <div className="hp-venue-layout">
              <Link href={`/venues/${spotlightVenue.slug || spotlightVenue.id}`} className="hp-spotlight">
                <div className="hp-spot-bg" style={{ background: gradientFor(spotlightVenue.id) }}>
                  <VenueImage venue={spotlightVenue} className="hp-spot-mono" />
                </div>
                <div className="hp-spot-scrim" />
                <div className="hp-spot-body">
                  <div className="hp-pill-row">
                    <span className="hp-pill"><span className="dot" />Featured venue</span>
                    <span className="hp-pill muted">{spotlightVenue.city}{spotlightVenue.state ? `, ${spotlightVenue.state}` : ""}</span>
                  </div>
                  <div className="hp-spot-name">{spotlightVenue.name}</div>
                  <div className="hp-spot-meta">
                    {(venueEventsByVenue.get(spotlightVenue.id)?.[0]?.specialNotes || spotlightVenue.fanTeams?.[0]?.teamName || spotlightVenue.shortDescription || "Live sports watch parties")}
                  </div>
                  <div className="hp-spot-actions">
                    <strong>{spotlightVenue.rating ? `Star ${spotlightVenue.rating.toFixed(1)}` : "Rated venue"}</strong>
                    <em>{spotlightVenue.upcomingEventsCount || venueEventsByVenue.get(spotlightVenue.id)?.length || 0} upcoming events</em>
                    <span className="hp-reserve">Reserve &rarr;</span>
                  </div>
                </div>
              </Link>
              <div className="hp-rail">
                {railVenues.map((venue) => (
                  <Link key={venue.id} href={`/venues/${venue.slug || venue.id}`} className="hp-rail-card">
                    <div className="hp-rail-img" style={{ background: gradientFor(venue.id) }}>
                      <VenueImage venue={venue} className="" />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="hp-rail-city">{venue.city}{venue.state ? `, ${venue.state}` : ""}</div>
                      <div className="hp-rail-name">{venue.name}</div>
                      <div className="hp-rail-meta">{venue.fanTeams?.[0]?.teamName || venue.shortDescription || "Sports watch parties"}</div>
                    </div>
                    <div className="hp-rail-score">
                      <strong>{venue.rating ? venue.rating.toFixed(1) : "New"}</strong>
                      <span>{venue.upcomingEventsCount || venueEventsByVenue.get(venue.id)?.length || 0} events</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="hp-empty">{isLoading ? "Loading venues..." : "No venues are available right now."}</div>
          )}
        </section>

        <section className="hp-sec">
          <div className="hp-st" style={{ marginBottom: 22 }}>How it works</div>
          <div className="hp-steps">
            <div className="hp-step">
              <div className="n">1</div>
              <h3>Find your match</h3>
              <p>Browse live schedule data across {formatCount(dynamicLeagueCount)} active leagues and kickoff times in your timezone.</p>
            </div>
            <div className="hp-step">
              <div className="n">2</div>
              <h3>Pick a venue</h3>
              <p>Compare {formatCount(publicVenues.length)} current venues by city, ratings, amenities, and hosted events.</p>
            </div>
            <div className="hp-step">
              <div className="n">3</div>
              <h3>Reserve your spot</h3>
              <p>Open a match or venue, see who is showing the game, and reserve before the room fills.</p>
            </div>
          </div>
        </section>

        <section className="hp-sec">
          <div className="hp-band">
            <div>
              <h2>Run a bar or restaurant?</h2>
              <p>List your venue, publish the matches you are showing, and connect with fans looking for a place to watch.</p>
            </div>
            <Link href="/for-venues/register" className="hp-btn primary">List your venue &mdash; free</Link>
          </div>
        </section>
      </div>

      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div style={{ fontFamily: "var(--font-space),'Space Grotesk',sans-serif", fontWeight: 800 }}>MatchWatch</div>
          <div style={{ fontFamily: "var(--font-mono),monospace", fontSize: 11, color: "#6b7280" }}>
            {formatCount(upcomingMatches.length)} upcoming games &middot; {formatCount(publicVenues.length)} venues
          </div>
        </div>
      </footer>
    </div>
  );
}
