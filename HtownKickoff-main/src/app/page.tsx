"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useData } from "../lib/data-provider";
import { useAuth } from "../lib/auth-context";
import { getMatchDisplay } from "../lib/match-display";
import { isNationalTeamCompetition } from "../lib/league-utils";
import { FloatingNav } from "../components/AppShell";

/* ── CSS-in-JS style block injected once ── */
const CSS = `
  .mw-page{display:grid;grid-template-columns:220px minmax(0,1fr) 320px;gap:0;min-height:calc(100dvh - 96px);max-width:1440px;margin-inline:auto;}
  .mw-side{border-right:1px solid var(--mw-line);padding:24px 20px;background:linear-gradient(180deg,color-mix(in oklch,var(--mw-fg) 2%,transparent),transparent 200px);position:sticky;top:96px;height:calc(100dvh - 96px);overflow-y:auto;}
  .mw-side h4{font-family:'Space Grotesk',var(--font-space),sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mw-fg-mute);margin:18px 0 10px;font-weight:500;}
  .mw-side h4:first-child{margin-top:0;}
  .mw-side-list{display:flex;flex-direction:column;}
  .mw-side-item{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:8px;margin-left:-8px;font-size:13px;color:var(--mw-fg-dim);border-left:2px solid transparent;transition:all .12s;cursor:pointer;text-decoration:none;}
  .mw-side-item:hover{color:var(--mw-fg);background:rgba(255,255,255,0.02);}
  .mw-side-item.active{color:var(--mw-fg);border-left-color:var(--mw-accent);}
  .mw-side-item .ico{width:18px;height:18px;display:grid;place-items:center;color:var(--mw-fg-mute);}
  .mw-side-item.active .ico{color:var(--mw-accent);}
  .mw-side-item .badge{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--mw-fg-mute);}
  .mw-follow-team{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed var(--mw-line);font-size:12px;color:var(--mw-fg-dim);}
  .mw-follow-team:last-child{border-bottom:0;}
  .mw-team-crest{width:22px;height:22px;display:grid;place-items:center;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:10px;color:var(--mw-fg);border-radius:2px;flex-shrink:0;}
  .mw-form{margin-left:auto;display:flex;gap:2px;}
  .mw-dot{width:6px;height:6px;}
  .mw-main{padding:28px 32px 60px;min-width:0;}
  .mw-hero{position:relative;overflow:hidden;border:1px solid var(--mw-line);border-radius:12px;background:linear-gradient(120deg,rgba(255,95,45,0.10),transparent 60%),linear-gradient(0deg,var(--mw-bg-1),var(--mw-bg-2));margin-bottom:32px;}
  .mw-hero-inner{display:grid;grid-template-columns:1.3fr 1fr;min-height:340px;}
  .mw-hero-left{padding:28px 32px;display:flex;flex-direction:column;gap:22px;}
  .mw-hero-right{border-left:1px solid var(--mw-line);padding:20px;background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent);display:flex;flex-direction:column;gap:12px;}
  .mw-live-chip{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;padding:5px 8px;background:var(--mw-accent);color:#0a0b0d;font-weight:600;}
  .mw-live-chip .bd{width:6px;height:6px;background:#0a0b0d;border-radius:50%;animation:mwPulse 1s infinite;}
  @keyframes mwPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
  .mw-btn{border-radius:12px;display:inline-flex;align-items:center;gap:10px;padding:12px 18px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;border:1px solid var(--mw-line-2);color:var(--mw-fg);transition:all .14s;cursor:pointer;background:none;text-decoration:none;}
  .mw-btn:hover{border-color:var(--mw-fg-dim);}
  .mw-btn.primary{background:var(--mw-accent);color:#0a0b0d;border-color:var(--mw-accent);font-weight:600;}
  .mw-btn.primary:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--mw-fg);}
  .mw-btn.ghost{background:rgba(255,255,255,0.02);}
  .mw-section{border:1px solid var(--mw-line);border-radius:12px;overflow:hidden;background:radial-gradient(600px 200px at 10% 0%,rgba(255,95,45,0.08),transparent 70%),linear-gradient(180deg,var(--mw-bg-1),var(--mw-bg));margin-bottom:36px;}
  .mw-sec-head{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--mw-line);}
  .mw-sec-mark{display:flex;align-items:center;gap:14px;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:20px;letter-spacing:-0.01em;}
  .mw-sec-mark .trophy{width:28px;height:28px;display:grid;place-items:center;background:var(--mw-accent);color:#0a0b0d;flex-shrink:0;}
  .mw-sec-mark em{font-style:normal;color:var(--mw-fg-mute);font-weight:400;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;font-family:'JetBrains Mono',var(--font-mono),monospace;}
  .mw-tabs{display:flex;gap:4px;}
  .mw-tab{border-radius:12px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;padding:7px 12px;border:1px solid var(--mw-line);color:var(--mw-fg-dim);cursor:pointer;background:none;transition:all .12s;}
  .mw-tab.on{background:var(--mw-accent);color:#0a0b0d;border-color:var(--mw-accent);font-weight:600;}
  .mw-tab:hover:not(.on){color:var(--mw-fg);border-color:var(--mw-line-2);}
  .mw-fixtures{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
  .mw-fix{border-radius:12px;border:1px solid var(--mw-line);background:var(--mw-bg-1);padding:10px 12px;cursor:pointer;transition:all .14s;}
  .mw-fix:hover{border-color:var(--mw-line-2);background:var(--mw-bg-2);}
  .mw-fix.live{border-color:var(--mw-accent);}
  .mw-fix-top{display:flex;justify-content:space-between;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:0.1em;color:var(--mw-fg-mute);text-transform:uppercase;margin-bottom:8px;}
  .mw-fix-top .live-txt{color:var(--mw-accent);font-weight:600;display:flex;align-items:center;gap:4px;}
  .mw-fix-top .live-txt::before{content:"";width:5px;height:5px;background:var(--mw-accent);border-radius:50%;box-shadow:0 0 6px var(--mw-accent);animation:mwPulse 1.4s infinite;}
  .mw-fix-title{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:16px;margin:4px 0 6px;}
  .mw-fix-desc{font-size:12px;color:var(--mw-fg-dim);line-height:1.4;}
  .mw-fix-foot{display:flex;justify-content:space-between;padding-top:8px;margin-top:6px;border-top:1px dashed var(--mw-line);font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;color:var(--mw-fg-mute);letter-spacing:0.08em;}
  .mw-fix-foot .watch{color:var(--mw-accent);}
  .mw-match-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-bottom:40px;}
  .mw-match-card{border-radius:12px;position:relative;padding:16px 18px;border:1px solid var(--mw-line);background:var(--mw-bg-1);display:grid;gap:14px;transition:all .14s;cursor:pointer;}
  .mw-match-card:hover{border-color:var(--mw-line-2);background:var(--mw-bg-2);}
  .mw-match-card.live::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--mw-accent);}
  .mw-mc-top{display:flex;align-items:center;justify-content:space-between;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.08em;color:var(--mw-fg-mute);text-transform:uppercase;}
  .mw-mc-league{display:flex;align-items:center;gap:8px;}
  .mw-mc-swatch{width:8px;height:8px;background:var(--mw-accent);}
  .mw-mc-status{display:flex;align-items:center;gap:8px;}
  .mw-mc-status.live{color:var(--mw-accent);}
  .mw-mc-status.live .dot{width:6px;height:6px;border-radius:50%;background:var(--mw-accent);box-shadow:0 0 8px var(--mw-accent);animation:mwPulse 1.4s infinite;}
  .mw-mc-status.upcoming{color:var(--mw-fg-dim);}
  .mw-mc-teams{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;}
  .mw-mc-team{display:flex;align-items:center;gap:12px;padding:4px 0;}
  .mw-crest{width:28px;height:28px;display:grid;place-items:center;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:11px;flex-shrink:0;}
  .mw-crest img{width:28px;height:28px;object-fit:contain;}
  .mw-mc-team img{width:28px;height:28px;object-fit:contain;flex-shrink:0;}
  /* partners section */
  .mw-partners{border:1px solid var(--mw-line);margin-top:48px;background:linear-gradient(180deg,rgba(255,255,255,0.015),transparent);}
  .mw-partners-head{padding:28px 28px 0;display:flex;align-items:center;gap:16px;}
  .mw-partners-kicker{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:var(--mw-fg-mute);}
  .mw-partners-title-txt{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:22px;color:var(--mw-fg);margin:6px 0 0;}
  .mw-partners-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0;border-top:1px solid var(--mw-line);margin-top:20px;}
  .mw-partner-card{padding:28px;border-right:1px solid var(--mw-line);display:flex;flex-direction:column;gap:14px;transition:background .14s;}
  .mw-partner-card:last-child{border-right:0;}
  .mw-partner-card:hover{background:rgba(255,255,255,0.02);}
  .mw-partner-logo-box{height:52px;display:flex;align-items:center;}
  .mw-partner-wordmark{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:900;font-size:24px;letter-spacing:-0.03em;color:var(--mw-fg);line-height:1;}
  .mw-partner-wordmark em{font-style:normal;color:var(--mw-accent);}
  .mw-partner-name{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:14px;color:var(--mw-fg);}
  .mw-partner-desc{font-size:13px;color:var(--mw-fg-dim);line-height:1.55;flex:1;}
  .mw-partner-link{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--mw-accent);text-decoration:none;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid var(--mw-accent);transition:all .14s;align-self:flex-start;}
  .mw-partner-link:hover{background:var(--mw-accent);color:#0a0b0d;}
  .mw-partners-cta{padding:20px 28px;border-top:1px solid var(--mw-line);display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.01);}
  .mw-partners-cta p{font-size:13px;color:var(--mw-fg-dim);margin:0;}
  .mw-mc-name{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:500;font-size:16px;}
  .mw-mc-score{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:24px;min-width:28px;text-align:right;}
  .mw-mc-foot{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px dashed var(--mw-line);font-size:11px;color:var(--mw-fg-mute);}
  .mw-join{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--mw-accent);text-decoration:none;}
  .mw-join:hover{color:var(--mw-fg);}
  .mw-sec-filter-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px;}
  .mw-sec-title{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:22px;letter-spacing:-0.01em;display:flex;align-items:center;gap:12px;}
  .mw-sec-title .tag{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--mw-fg-mute);letter-spacing:0.1em;border:1px solid var(--mw-line);padding:3px 6px;}
  .mw-filters{display:flex;gap:6px;}
  .mw-filter{border-radius:999px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--mw-fg-dim);padding:6px 10px;border:1px solid var(--mw-line);letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;background:none;transition:all .12s;}
  .mw-filter.on{color:#0a0b0d;background:var(--mw-accent);border-color:var(--mw-accent);}
  .mw-filter:hover:not(.on){color:var(--mw-fg);border-color:var(--mw-line-2);}
  .mw-rail{border-left:1px solid var(--mw-line);padding:24px 22px;background:linear-gradient(180deg,color-mix(in oklch,var(--mw-fg) 2%,transparent),transparent 200px);position:sticky;top:96px;height:calc(100dvh - 96px);overflow-y:auto;}
  .mw-rail h3{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:15px;margin:0 0 14px;display:flex;align-items:center;gap:8px;}
  .mw-rail h3 .n{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--mw-fg-mute);font-weight:400;}
  .mw-rail h4{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--mw-fg-mute);margin:22px 0 10px;font-weight:500;}
  .mw-party{border-radius:12px;border:1px solid var(--mw-line);padding:12px;display:grid;gap:10px;margin-bottom:12px;background:var(--mw-bg-1);transition:all .14s;}
  .mw-party:hover{border-color:var(--mw-accent);}
  .mw-party-head{display:flex;align-items:center;justify-content:space-between;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--mw-fg-mute);letter-spacing:0.08em;text-transform:uppercase;}
  .mw-party-title{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:14px;line-height:1.3;color:var(--mw-fg);}
  .mw-party-host{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--mw-fg-dim);}
  .mw-party-host .hc{width:20px;height:20px;background:linear-gradient(135deg,#6a5340,#b4876a);display:grid;place-items:center;font-size:9px;font-weight:600;color:#1b0f08;}
  .mw-party-meta{display:flex;gap:10px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--mw-fg-mute);padding-top:8px;border-top:1px dashed var(--mw-line);}
  .mw-party-join{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;padding:6px 8px;background:var(--mw-accent);color:#0a0b0d;font-weight:600;display:inline-flex;align-items:center;gap:6px;border:none;cursor:pointer;}
  .mw-create-party{border-radius:12px;border:1px dashed var(--mw-line-2);padding:14px;display:flex;flex-direction:column;gap:10px;align-items:flex-start;font-size:12px;color:var(--mw-fg-dim);}
  .mw-ticker-pill{border-radius:999px;display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--mw-line);font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--mw-fg-dim);letter-spacing:0.05em;}
  .mw-ticker-pill .dot{width:6px;height:6px;background:oklch(0.78 0.14 200);border-radius:50%;box-shadow:0 0 10px oklch(0.78 0.14 200);animation:mwPulse 1.6s ease-in-out infinite;}
  .mw-iconbtn{border-radius:12px;width:36px;height:36px;border:1px solid var(--mw-line);display:grid;place-items:center;color:var(--mw-fg-dim);background:none;cursor:pointer;flex-shrink:0;}
  .mw-iconbtn:hover{color:var(--mw-fg);border-color:var(--mw-line-2);}
  .mw-avatar{width:32px;height:32px;background:linear-gradient(135deg,#5a4a3a,#a07a52);display:grid;place-items:center;font-weight:600;font-size:12px;color:#1a1108;border:1px solid var(--mw-line-2);flex-shrink:0;}
  .mw-btn-pill{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 18px;border-radius:999px;font-size:13px;font-weight:800;text-decoration:none;white-space:nowrap;background:var(--mw-accent);color:#0a0b0d;transition:all .18s;}
  .mw-btn-pill:hover{opacity:0.88;transform:translateY(-1px);}
  .mw-btn-pill.ghost{background:rgba(255,255,255,0.07);color:var(--mw-fg);}
  @media (max-width:1200px){.mw-page{grid-template-columns:1fr;}.mw-side,.mw-rail{display:none;}.mw-fixtures{grid-template-columns:repeat(2,1fr);}}
  @media (max-width:768px){.mw-main{padding:16px 16px 60px;}.mw-fixtures{grid-template-columns:1fr;}.mw-match-grid{grid-template-columns:1fr;}.mw-hero-inner{grid-template-columns:1fr;}.mw-hero-right{display:none;}.mw-hero-left{padding:20px 16px;}.mw-sec-head{padding:14px 16px;}.mw-section{margin-bottom:24px;}}
`;

const MW_VARS = `
  :root {
    --mw-bg: var(--background);
    --mw-bg-1: var(--card);
    --mw-bg-2: var(--card);
    --mw-bg-3: var(--secondary);
    --mw-line: var(--border);
    --mw-line-2: var(--border);
    --mw-fg: var(--foreground);
    --mw-fg-dim: var(--muted-foreground);
    --mw-fg-mute: var(--muted-foreground);
    --mw-accent: oklch(0.72 0.19 28);
  }
`;

function CrestBox({ label, color }: { label: string; color: string }) {
  return (
    <div className="mw-crest" style={{ background: color, color: "#fff" }}>
      {label.substring(0, 2).toUpperCase()}
    </div>
  );
}

export default function HomePage() {
  const { matches, venues, leagues, teams, isLoading } = useData();
  const { user } = useAuth();
  const [renderNow] = useState(() => Date.now());
  const nonWorldCupMatches = React.useMemo(
    () => matches.filter((match) => !isNationalTeamCompetition(leagues.find((league) => league.id === match.leagueId))),
    [matches, leagues]
  );

  /* Today / coming soon — live now or starting within 72h */
  const in72h = renderNow + 72 * 60 * 60 * 1000;
  const todayMatches = nonWorldCupMatches
    .filter((m) => {
      const ts = new Date(m.matchDateUTC).getTime();
      const live = m.status === "IN_PLAY" || m.status === "PAUSED";
      const soonScheduled = (m.status === "SCHEDULED" || m.status === "TIMED") && ts >= renderNow && ts <= in72h;
      return live || soonScheduled;
    })
    .sort((a, b) => new Date(a.matchDateUTC).getTime() - new Date(b.matchDateUTC).getTime())
    .slice(0, 8);

  /* Upcoming — if no today matches, fall back to next scheduled */
  const upcomingMatches = nonWorldCupMatches
    .filter((m) => m.status === "SCHEDULED" || m.status === "TIMED")
    .sort((a, b) => new Date(a.matchDateUTC).getTime() - new Date(b.matchDateUTC).getTime())
    .slice(0, 4);

  /* Helpers */
  const getLeagueName = (leagueId: string) => leagues.find((l) => l.id === leagueId)?.name || leagueId.toUpperCase();
  const getTeam = (teamId?: string) => teams.find((t) => t.id === teamId);

  /* Venue cards for "Find a bar" — use real venues */
  const featuredVenues = venues.slice(0, 6);

  /* Top leagues for the sidebar, ordered by how many real matches we have */
  const sidebarLeagues = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of nonWorldCupMatches) {
      counts.set(m.leagueId, (counts.get(m.leagueId) || 0) + 1);
    }
    return leagues
      .map((l) => ({ league: l, count: counts.get(l.id) || 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [leagues, nonWorldCupMatches]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
      <FloatingNav />

      {/* 3-column layout */}
      <div className="mw-page">

        {/* Left sidebar */}
        <aside className="mw-side">
          <h4>Matchwatch</h4>
          <div className="mw-side-list">
            <Link href="/" className="mw-side-item active">
              <span className="ico" style={{ color: "var(--mw-accent)" }}>◆</span>
              <span>Home</span>
              <span className="badge">{upcomingMatches.length}</span>
            </Link>
            <Link href="/venues" className="mw-side-item">
              <span className="ico">🍺</span>
              <span>Venues</span>
              <span className="badge">{venues.length || ""}</span>
            </Link>
            <Link href="/matches" className="mw-side-item">
              <span className="ico">📅</span>
              <span>Matches</span>
              <span className="badge">{matches.length || ""}</span>
            </Link>
            {user ? (
              <Link href="/dashboard" className="mw-side-item">
                <span className="ico">🎫</span>
                <span>My bookings</span>
              </Link>
            ) : (
              <Link href="/for-venues/register" className="mw-side-item">
                <span className="ico">🏟️</span>
                <span>List your venue</span>
              </Link>
            )}
          </div>

          {sidebarLeagues.length > 0 && (
            <>
              <h4>Leagues</h4>
              <div className="mw-side-list">
                {sidebarLeagues.map(({ league, count }) => (
                  <Link key={league.id} href={`/matches?league=${league.id}`} className="mw-side-item">
                    <span className="ico">
                      {league.image
                        ? <img src={league.image} alt="" style={{ width: 18, height: 18, objectFit: "contain" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        : "⚽"}
                    </span>
                    <span>{league.name}</span>
                    <span className="badge">{count}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* Main content */}
        <main className="mw-main">

          {/* Hero */}
          <section className="mw-hero">
            <div className="mw-hero-inner">
              <div className="mw-hero-left">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span className="mw-live-chip"><span className="bd" />MATCHDAY</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", color: "var(--mw-fg-dim)", textTransform: "uppercase" }}>
                    Matchwatch · Fan-first match experience
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 4 }}>
                  <h1 style={{ fontFamily: "'Space Grotesk', var(--font-space), sans-serif", fontWeight: 700, fontSize: "clamp(36px,5vw,64px)", lineHeight: 0.95, letterSpacing: "-0.025em", margin: 0, color: "var(--mw-fg)", textWrap: "balance" } as React.CSSProperties}>
                    Watch every match <em style={{ fontStyle: "normal", color: "var(--mw-accent)" }}>with your people.</em>
                  </h1>
                  <p style={{ maxWidth: 520, fontSize: 16, lineHeight: 1.5, color: "var(--mw-fg-dim)", margin: 0 }}>
                    Find a bar showing your match, reserve a table, and watch with fans near you. One place to plan every match night with your people.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, borderTop: "1px solid var(--mw-line)", paddingTop: 18, marginTop: 4 }}>
                  {[
                    { label: "VENUES & BARS", val: String(venues.length || "—"), suffix: "", accent: false },
                    { label: "UPCOMING MATCHES", val: String(nonWorldCupMatches.length || "—"), suffix: "", accent: false },
                    { label: "WORLD CUP CITIES", val: "11", suffix: "/2026", accent: true },
                  ].map(({ label, val, suffix, accent }) => (
                    <div key={label}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mw-fg-mute)", marginBottom: 6 }}>{label}</div>
                      <div style={{ fontFamily: "'Space Grotesk', var(--font-space), sans-serif", fontWeight: 600, fontSize: 32, color: accent ? "var(--mw-accent)" : "var(--mw-fg)", lineHeight: 1 }}>
                        {val}{suffix && <em style={{ fontStyle: "normal", color: "var(--mw-fg-mute)", fontSize: 14, marginLeft: 4 }}>{suffix}</em>}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
                  <Link href="/venues" className="mw-btn primary">Find a bar near me</Link>
                  <Link href="/matches" className="mw-btn ghost">View fixtures</Link>
                  {!user && <Link href="/login?view=signup" className="mw-btn ghost">Join free</Link>}
                </div>
              </div>

              <aside className="mw-hero-right">
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mw-fg-mute)", marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
                  <span>Tonight · Near you</span>
                  <span>HOUSTON</span>
                </div>

                {featuredVenues.length > 0
                  ? featuredVenues.slice(0, 3).map((v) => (
                    <Link key={v.id} href={`/venues/${v.slug || v.id}`} style={{ display: "block", border: "1px solid var(--mw-line)", padding: 12, background: "var(--mw-bg-1)", textDecoration: "none", transition: "border-color .14s" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--mw-accent)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--mw-line)")}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "var(--mw-fg-mute)", textTransform: "uppercase", marginBottom: 8 }}>
                        <span>{v.city}{v.state ? `, ${v.state}` : ""}</span>
                        <span style={{ color: "var(--mw-accent)", fontWeight: 600 }}>OPEN</span>
                      </div>
                      <div style={{ fontFamily: "'Space Grotesk', var(--font-space), sans-serif", fontWeight: 600, fontSize: 15, marginBottom: 4, color: "var(--mw-fg)" }}>{v.name}</div>
                      <div style={{ fontSize: 11, color: "var(--mw-fg-dim)" }}>{v.shortDescription || v.description?.substring(0, 80) || "Sports bar · Watch parties welcome"}</div>
                    </Link>
                  ))
                  : (
                    <div style={{ border: "1px dashed var(--mw-line)", borderRadius: 12, padding: 16, background: "var(--mw-bg-1)", fontSize: 12, color: "var(--mw-fg-dim)", lineHeight: 1.5 }}>
                      Venues near you will show up here.{" "}
                      <Link href="/venues" style={{ color: "var(--mw-accent)" }}>Browse all venues →</Link>
                    </div>
                  )}
              </aside>
            </div>
          </section>

          {/* Find a bar */}
          <section id="bars" className="mw-section">
            <div className="mw-sec-head">
              <div className="mw-sec-mark">
                <span className="trophy">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v3a3 3 0 0 1-3 3h-1v4a3 3 0 0 1-3 3h0a3 3 0 0 1-3-3V9H8a3 3 0 0 1-3-3V3zm2 2v1a1 1 0 0 0 1 1h1V5H7zm8 0v2h1a1 1 0 0 0 1-1V5h-2zM9 18h6v3H9v-3z" /></svg>
                </span>
                Venues <em>· Watch with fans near you</em>
              </div>
              <div className="mw-tabs">
                <Link href="/venues" className="mw-tab on">Browse all</Link>
                <Link href="/venues?filter=sport" className="mw-tab">By sport</Link>
                <Link href="/venues?filter=vibe" className="mw-tab">By vibe</Link>
              </div>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {isLoading ? (
                <div className="mw-fixtures">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="mw-fix" style={{ opacity: 0.4, minHeight: 100, animation: "mwPulse 1.5s ease-in-out infinite" }} />
                  ))}
                </div>
              ) : featuredVenues.length > 0 ? (
                <div className="mw-fixtures">
                  {featuredVenues.map((v) => (
                    <Link key={v.id} href={`/venues/${v.slug || v.id}`} className="mw-fix" style={{ textDecoration: "none" }}>
                      <div className="mw-fix-top">
                        <span>{v.city}{v.state ? `, ${v.state}` : ""}</span>
                        <span className="live-txt" style={{ color: "var(--mw-accent)", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 9, letterSpacing: "0.1em" }}>OPEN</span>
                      </div>
                      <div className="mw-fix-title">{v.name}</div>
                      <div className="mw-fix-desc">{v.shortDescription || v.description?.substring(0, 90) || "Sports bar · Watch parties welcome · Multiple screens"}</div>
                      <div className="mw-fix-foot">
                        <span>
                          {v.amenities?.slice(0, 2).join(" · ") || "TV · SPORTS BAR"}
                        </span>
                        <span className="watch">RESERVE →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mw-fixtures">
                  {[
                    { loc: "UNION ST", fill: "87% FULL", live: true, name: "The Long Bar", desc: "Showing Arsenal · Liverpool · NYCFC. $5 pints during kickoffs.", tags: "⭐ 4.8 · 312 match nights" },
                    { loc: "HOBOKEN", fill: "54% FULL", live: false, name: "The Pitch", desc: "Official Arsenal supporters club. 6 screens, sound on for Premier League.", tags: "⭐ 4.7 · ARSENAL SC" },
                    { loc: "WILLIAMSBURG", fill: "TABLES OPEN", live: false, name: "Offside", desc: "Neutral ground. Multi-sport, food until late. Quiet corners if you want to talk.", tags: "⭐ 4.6 · FOOD · QUIET" },
                    { loc: "LES", fill: "92% FULL", live: true, name: "Stoppage Time", desc: "NBA + NFL headline bar. Projector + 12 screens. Buckets of wings on match nights.", tags: "⭐ 4.9 · NBA · NFL" },
                    { loc: "ASTORIA", fill: "31% FULL", live: false, name: "The Corner Flag", desc: "La Liga + Serie A. Real Madrid and Inter supporter sections on separate floors.", tags: "⭐ 4.5 · LA LIGA" },
                    { loc: "MIDTOWN", fill: "TABLES OPEN", live: false, name: "Extra Time Sports Hall", desc: "Big hall, 20+ screens, trivia between matches. Group deals for 10+ friends.", tags: "⭐ 4.4 · GROUPS · DEALS" },
                  ].map(({ loc, fill, live, name, desc, tags }) => (
                    <Link key={name} href="/venues" className={`mw-fix${live ? " live" : ""}`} style={{ textDecoration: "none" }}>
                      <div className="mw-fix-top">
                        <span>{loc}</span>
                        {live ? <span className="live-txt">{fill}</span> : <span style={{ color: fill.includes("OPEN") ? "var(--mw-accent)" : "var(--mw-fg-dim)" }}>{fill}</span>}
                      </div>
                      <div className="mw-fix-title">{name}</div>
                      <div className="mw-fix-desc">{desc}</div>
                      <div className="mw-fix-foot"><span>{tags}</span><span className="watch">RESERVE →</span></div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Today / Coming soon */}
          <div className="mw-sec-filter-head">
            <div className="mw-sec-title">
              Today / Coming soon <span className="tag">{todayMatches.length} MATCHES</span>
            </div>
            <div className="mw-filters">
              <button className="mw-filter on">Live &amp; upcoming</button>
              <Link href="/matches" className="mw-filter" style={{ textDecoration: "none" }}>All fixtures</Link>
            </div>
          </div>

          <div className="mw-match-grid">
            {todayMatches.length > 0
              ? todayMatches.map((m) => {
                const disp = getMatchDisplay(m);
                const homeTeam = getTeam(m.homeTeamId);
                const awayTeam = getTeam(m.awayTeamId);
                const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
                const kickoff = new Date(m.matchDateUTC);
                const diffMs = kickoff.getTime() - renderNow;
                const diffH = Math.floor(diffMs / 3600000);
                const diffM = Math.floor((diffMs % 3600000) / 60000);
                const kickStr = diffMs <= 0 ? "STARTING" : diffH > 0 ? `IN ${diffH}H ${diffM}M` : `IN ${diffM}M`;
                return (
                  <Link key={m.id} href={`/matches/${m.id}`} className={`mw-match-card${isLive ? " live" : ""}`} style={{ textDecoration: "none" }}>
                    <div className="mw-mc-top">
                      <div className="mw-mc-league">
                        <div className="mw-mc-swatch" />
                        {getLeagueName(m.leagueId)}
                      </div>
                      {isLive
                        ? <div className="mw-mc-status live"><span className="dot" />LIVE</div>
                        : <div className="mw-mc-status upcoming">{kickStr}</div>
                      }
                    </div>
                    <div className="mw-mc-teams">
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div className="mw-mc-team">
                          {homeTeam?.image
                            ? <img src={homeTeam.image} alt={disp.homeName} style={{ width: 28, height: 28, objectFit: "contain" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                            : <CrestBox label={disp.homeName.substring(0, 2)} color={homeTeam?.color || "var(--mw-accent)"} />
                          }
                          <span className="mw-mc-name">{disp.homeName}</span>
                        </div>
                        <div className="mw-mc-team">
                          {awayTeam?.image
                            ? <img src={awayTeam.image} alt={disp.awayName} style={{ width: 28, height: 28, objectFit: "contain" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                            : <CrestBox label={disp.awayName.substring(0, 2)} color={awayTeam?.color || "#374151"} />
                          }
                          <span className="mw-mc-name">{disp.awayName}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                        {isLive
                          ? <>
                            <div className="mw-mc-score" style={{ color: "var(--mw-accent)" }}>{m.homeScore ?? 0}</div>
                            <div className="mw-mc-score" style={{ color: "var(--mw-fg-dim)" }}>{m.awayScore ?? 0}</div>
                          </>
                          : <>
                            <div className="mw-mc-score" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "var(--mw-fg-dim)", fontWeight: 500 }}>—</div>
                            <div className="mw-mc-score" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "var(--mw-fg-dim)", fontWeight: 500 }}>—</div>
                          </>
                        }
                      </div>
                    </div>
                    <div className="mw-mc-foot">
                      <span>{isLive ? "Watching live" : "Find where to watch"}</span>
                      <Link href={`/matches/${m.id}`} className="mw-join">View venues →</Link>
                    </div>
                  </Link>
                );
              })
              : (
                <div style={{ gridColumn: "1/-1", padding: "40px 0", textAlign: "center", color: "var(--mw-fg-mute)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.1em" }}>
                  NO MATCHES TODAY · CHECK BACK SOON
                </div>
              )
            }
          </div>

          {/* Upcoming */}
          <div className="mw-sec-filter-head">
            <div className="mw-sec-title">
              Starting soon <span className="tag">NEXT 6H</span>
            </div>
            <div className="mw-filters">
              {["Today", "Next 6h", "This week"].map((f) => (
                <button key={f} className={`mw-filter${f === "Next 6h" ? " on" : ""}`}>{f}</button>
              ))}
            </div>
          </div>

          <div className="mw-match-grid">
            {upcomingMatches.length > 0
              ? upcomingMatches.map((m) => {
                const disp = getMatchDisplay(m);
                const homeTeam = getTeam(m.homeTeamId);
                const awayTeam = getTeam(m.awayTeamId);
                const kickoff = new Date(m.matchDateUTC);
                const diffMs = kickoff.getTime() - renderNow;
                const diffH = Math.floor(diffMs / 3600000);
                const diffM = Math.floor((diffMs % 3600000) / 60000);
                const kickStr = diffH > 0 ? `IN ${diffH}H ${diffM}M` : `IN ${diffM}M`;
                return (
                  <div key={m.id} className="mw-match-card upcoming">
                    <div className="mw-mc-top">
                      <div className="mw-mc-league">
                        <div className="mw-mc-swatch" />
                        {getLeagueName(m.leagueId)}
                      </div>
                      <div className="mw-mc-status upcoming">{kickStr}</div>
                    </div>
                    <div className="mw-mc-teams">
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div className="mw-mc-team">
                          {homeTeam?.image
                            ? <img src={homeTeam.image} alt={disp.homeName} style={{ width: 28, height: 28, objectFit: "contain" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                            : <CrestBox label={disp.homeName.substring(0, 2)} color={homeTeam?.color || "var(--mw-accent)"} />
                          }
                          <span className="mw-mc-name">{disp.homeName}</span>
                        </div>
                        <div className="mw-mc-team">
                          {awayTeam?.image
                            ? <img src={awayTeam.image} alt={disp.awayName} style={{ width: 28, height: 28, objectFit: "contain" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                            : <CrestBox label={disp.awayName.substring(0, 2)} color={awayTeam?.color || "#374151"} />
                          }
                          <span className="mw-mc-name">{disp.awayName}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                        <div className="mw-mc-score" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "var(--mw-fg-dim)", fontWeight: 500 }}>—</div>
                        <div className="mw-mc-score" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "var(--mw-fg-dim)", fontWeight: 500 }}>—</div>
                      </div>
                    </div>
                    <div className="mw-mc-foot">
                      <span>Find where to watch</span>
                      <Link href={`/matches/${m.id}`} className="mw-join">View venues →</Link>
                    </div>
                  </div>
                );
              })
              : (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: "36px 20px",
                    textAlign: "center",
                    border: "1px dashed var(--mw-line)",
                    borderRadius: 12,
                    color: "var(--mw-fg-mute)",
                    fontSize: 14,
                  }}
                >
                  No upcoming matches scheduled right now — check back soon.
                </div>
              )
            }
          </div>

          {/* Strategic Partners */}
          <section className="mw-partners">
            <div className="mw-partners-head">
              <div>
                <div className="mw-partners-kicker">Strategic Partners</div>
                <div className="mw-partners-title-txt">Powering the Houston football community</div>
              </div>
            </div>
            <div className="mw-partners-grid">
              {/* Team Houston */}
              <div className="mw-partner-card">
                <div className="mw-partner-logo-box">
                  <div className="mw-partner-wordmark">Team<em>Houston</em></div>
                </div>
                <div className="mw-partner-desc">
                  The premier platform for Houston&apos;s amateur and semi-pro football scene. Leagues, tournaments, and community events — all in one place.
                </div>
                <a href="https://www.team-houston.com/" target="_blank" rel="noopener noreferrer" className="mw-partner-link">
                  Visit Team Houston →
                </a>
              </div>
              {/* Activent */}
              <div className="mw-partner-card">
                <div className="mw-partner-logo-box">
                  <div className="mw-partner-wordmark"><em>Activent</em></div>
                </div>
                <div className="mw-partner-desc">
                  Discover local sports events and activities near you. From pickup games to watch parties, Activent connects Houston&apos;s active community.
                </div>
                <a href="https://www.getactivent.com/" target="_blank" rel="noopener noreferrer" className="mw-partner-link">
                  Visit Activent →
                </a>
              </div>
            </div>
            <div className="mw-partners-cta">
              <p>Interested in partnering with MatchWatch?</p>
              <Link href="/partners" className="mw-btn-pill ghost" style={{ fontSize: 12 }}>Become a partner →</Link>
            </div>
          </section>
        </main>

        {/* Right rail */}
        <aside className="mw-rail">
          <h3>Watch parties</h3>

          <div className="mw-party" style={{ gap: 10 }}>
            <div className="mw-party-title">Live watch-party rooms are coming soon</div>
            <div style={{ fontSize: 12, color: "var(--mw-fg-dim)", lineHeight: 1.5 }}>
              For now, find a venue hosting your match and reserve a spot.
            </div>
            <Link href="/venues" className="mw-party-join">Browse venues →</Link>
          </div>

          <h4>World Cup 2026</h4>
          <div className="mw-party" style={{ gap: 10 }}>
            <div className="mw-party-title">The tournament hits 11 US host cities</div>
            <div style={{ fontSize: 12, color: "var(--mw-fg-dim)", lineHeight: 1.5 }}>
              Browse fixtures and find watch parties near each host city.
            </div>
            <Link href="/world-cup" className="mw-party-join">Explore host cities →</Link>
          </div>

          <h4>List your venue</h4>
          <div className="mw-create-party">
            Show your upcoming matches to fans nearby and grow your crowd on match nights.
            <Link href="/for-venues/register" className="mw-btn" style={{ padding: "8px 12px", fontSize: 11 }}>+ Add your bar</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
