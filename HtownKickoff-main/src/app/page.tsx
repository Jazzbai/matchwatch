"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useData } from "../lib/data-provider";
import { useAuth } from "../lib/auth-context";
import { getMatchDisplay } from "../lib/match-display";

/* ── CSS-in-JS style block injected once ── */
const CSS = `
  .mw-page{display:grid;grid-template-columns:220px 1fr 320px;gap:0;min-height:calc(100vh - 60px);}
  .mw-side{border-right:1px solid var(--mw-line);padding:24px 20px;background:linear-gradient(180deg,rgba(255,255,255,0.015),transparent 200px);position:sticky;top:60px;height:calc(100vh - 60px);overflow-y:auto;}
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
  .mw-hero{position:relative;overflow:hidden;border:1px solid var(--mw-line);background:linear-gradient(120deg,rgba(255,95,45,0.10),transparent 60%),linear-gradient(0deg,#0c0e12,#131720);margin-bottom:32px;}
  .mw-hero-inner{display:grid;grid-template-columns:1.3fr 1fr;min-height:340px;}
  .mw-hero-left{padding:28px 32px;display:flex;flex-direction:column;gap:22px;}
  .mw-hero-right{border-left:1px solid var(--mw-line);padding:20px;background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent);display:flex;flex-direction:column;gap:12px;}
  .mw-live-chip{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;padding:5px 8px;background:var(--mw-accent);color:#0a0b0d;font-weight:600;}
  .mw-live-chip .bd{width:6px;height:6px;background:#0a0b0d;border-radius:50%;animation:mwPulse 1s infinite;}
  @keyframes mwPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
  .mw-btn{display:inline-flex;align-items:center;gap:10px;padding:12px 18px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;border:1px solid var(--mw-line-2);color:var(--mw-fg);transition:all .14s;cursor:pointer;background:none;text-decoration:none;}
  .mw-btn:hover{border-color:var(--mw-fg-dim);}
  .mw-btn.primary{background:var(--mw-accent);color:#0a0b0d;border-color:var(--mw-accent);font-weight:600;}
  .mw-btn.primary:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--mw-fg);}
  .mw-btn.ghost{background:rgba(255,255,255,0.02);}
  .mw-section{border:1px solid var(--mw-line);background:radial-gradient(600px 200px at 10% 0%,rgba(255,95,45,0.08),transparent 70%),linear-gradient(180deg,#0d1016,#0a0b0d);margin-bottom:36px;}
  .mw-sec-head{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--mw-line);}
  .mw-sec-mark{display:flex;align-items:center;gap:14px;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:20px;letter-spacing:-0.01em;}
  .mw-sec-mark .trophy{width:28px;height:28px;display:grid;place-items:center;background:var(--mw-accent);color:#0a0b0d;flex-shrink:0;}
  .mw-sec-mark em{font-style:normal;color:var(--mw-fg-mute);font-weight:400;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;font-family:'JetBrains Mono',var(--font-mono),monospace;}
  .mw-tabs{display:flex;gap:4px;}
  .mw-tab{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;padding:7px 12px;border:1px solid var(--mw-line);color:var(--mw-fg-dim);cursor:pointer;background:none;transition:all .12s;}
  .mw-tab.on{background:var(--mw-accent);color:#0a0b0d;border-color:var(--mw-accent);font-weight:600;}
  .mw-tab:hover:not(.on){color:var(--mw-fg);border-color:var(--mw-line-2);}
  .mw-fixtures{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
  .mw-fix{border:1px solid var(--mw-line);background:var(--mw-bg-1);padding:10px 12px;cursor:pointer;transition:all .14s;}
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
  .mw-match-card{position:relative;padding:16px 18px;border:1px solid var(--mw-line);background:var(--mw-bg-1);display:grid;gap:14px;transition:all .14s;cursor:pointer;}
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
  .mw-crest{width:28px;height:28px;display:grid;place-items:center;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:11px;}
  .mw-mc-name{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:500;font-size:16px;}
  .mw-mc-score{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:24px;min-width:28px;text-align:right;}
  .mw-mc-foot{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px dashed var(--mw-line);font-size:11px;color:var(--mw-fg-mute);}
  .mw-join{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--mw-accent);text-decoration:none;}
  .mw-join:hover{color:var(--mw-fg);}
  .mw-sec-filter-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px;}
  .mw-sec-title{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:22px;letter-spacing:-0.01em;display:flex;align-items:center;gap:12px;}
  .mw-sec-title .tag{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--mw-fg-mute);letter-spacing:0.1em;border:1px solid var(--mw-line);padding:3px 6px;}
  .mw-filters{display:flex;gap:6px;}
  .mw-filter{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--mw-fg-dim);padding:6px 10px;border:1px solid var(--mw-line);letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;background:none;transition:all .12s;}
  .mw-filter.on{color:#0a0b0d;background:var(--mw-accent);border-color:var(--mw-accent);}
  .mw-filter:hover:not(.on){color:var(--mw-fg);border-color:var(--mw-line-2);}
  .mw-rail{border-left:1px solid var(--mw-line);padding:24px 22px;background:linear-gradient(180deg,rgba(255,255,255,0.015),transparent 200px);position:sticky;top:60px;height:calc(100vh - 60px);overflow-y:auto;}
  .mw-rail h3{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:15px;margin:0 0 14px;display:flex;align-items:center;gap:8px;}
  .mw-rail h3 .n{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--mw-fg-mute);font-weight:400;}
  .mw-rail h4{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--mw-fg-mute);margin:22px 0 10px;font-weight:500;}
  .mw-party{border:1px solid var(--mw-line);padding:12px;display:grid;gap:10px;margin-bottom:12px;background:var(--mw-bg-1);transition:all .14s;}
  .mw-party:hover{border-color:var(--mw-accent);}
  .mw-party-head{display:flex;align-items:center;justify-content:space-between;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--mw-fg-mute);letter-spacing:0.08em;text-transform:uppercase;}
  .mw-party-title{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:14px;line-height:1.3;color:var(--mw-fg);}
  .mw-party-host{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--mw-fg-dim);}
  .mw-party-host .hc{width:20px;height:20px;background:linear-gradient(135deg,#6a5340,#b4876a);display:grid;place-items:center;font-size:9px;font-weight:600;color:#1b0f08;}
  .mw-party-meta{display:flex;gap:10px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--mw-fg-mute);padding-top:8px;border-top:1px dashed var(--mw-line);}
  .mw-party-join{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;padding:6px 8px;background:var(--mw-accent);color:#0a0b0d;font-weight:600;display:inline-flex;align-items:center;gap:6px;border:none;cursor:pointer;}
  .mw-create-party{border:1px dashed var(--mw-line-2);padding:14px;display:flex;flex-direction:column;gap:10px;align-items:flex-start;font-size:12px;color:var(--mw-fg-dim);}
  .mw-ticker-pill{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--mw-line);font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--mw-fg-dim);letter-spacing:0.05em;}
  .mw-ticker-pill .dot{width:6px;height:6px;background:oklch(0.78 0.14 200);border-radius:50%;box-shadow:0 0 10px oklch(0.78 0.14 200);animation:mwPulse 1.6s ease-in-out infinite;}
  .mw-iconbtn{width:36px;height:36px;border:1px solid var(--mw-line);display:grid;place-items:center;color:var(--mw-fg-dim);background:none;cursor:pointer;flex-shrink:0;}
  .mw-iconbtn:hover{color:var(--mw-fg);border-color:var(--mw-line-2);}
  .mw-avatar{width:32px;height:32px;background:linear-gradient(135deg,#5a4a3a,#a07a52);display:grid;place-items:center;font-weight:600;font-size:12px;color:#1a1108;border:1px solid var(--mw-line-2);flex-shrink:0;}
  .mw-ribbon{display:flex;align-items:center;justify-content:space-between;padding:10px 28px;background:linear-gradient(90deg,rgba(255,95,45,0.14),transparent 60%);border-bottom:1px solid var(--mw-line);font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--mw-fg-dim);}
  .mw-ribbon .left{display:flex;gap:14px;align-items:center;}
  .mw-ribbon b{color:var(--mw-accent);font-weight:600;}
  .mw-ribbon-ticker{display:flex;gap:18px;color:var(--mw-fg-mute);}
  .mw-topbar{position:sticky;top:0;z-index:20;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:14px 28px;background:rgba(10,11,13,0.9);backdrop-filter:blur(14px);border-bottom:1px solid var(--mw-line);}
  .mw-brand{display:flex;align-items:center;gap:10px;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:18px;letter-spacing:-0.01em;text-decoration:none;color:var(--mw-fg);}
  .mw-brand em{font-style:normal;color:var(--mw-accent);}
  .mw-brand-mark{width:22px;height:22px;position:relative;background:var(--mw-fg);mask-image:conic-gradient(from 0deg,#000 0 25%,transparent 25% 50%,#000 50% 75%,transparent 75% 100%);-webkit-mask-image:conic-gradient(from 0deg,#000 0 25%,transparent 25% 50%,#000 50% 75%,transparent 75% 100%);border-radius:2px;}
  .mw-brand-mark::after{content:"";position:absolute;inset:4px;background:var(--mw-accent);border-radius:1px;}
  .mw-nav{display:flex;gap:28px;justify-content:center;}
  .mw-nav a{font-size:13px;color:var(--mw-fg-dim);letter-spacing:0.04em;text-transform:uppercase;position:relative;padding:6px 0;text-decoration:none;transition:color .12s;}
  .mw-nav a.active,.mw-nav a:hover{color:var(--mw-fg);}
  .mw-nav a.active::after{content:"";position:absolute;left:0;right:0;bottom:-15px;height:2px;background:var(--mw-accent);}
  .mw-top-right{display:flex;gap:14px;justify-content:flex-end;align-items:center;}
  @media (max-width:1200px){.mw-page{grid-template-columns:1fr;}.mw-side,.mw-rail{display:none;}.mw-fixtures{grid-template-columns:repeat(2,1fr);}}
  @media (max-width:768px){.mw-fixtures{grid-template-columns:1fr;}.mw-match-grid{grid-template-columns:1fr;}.mw-hero-inner{grid-template-columns:1fr;}.mw-hero-right{display:none;}}
`;

const MW_VARS = `
  :root {
    --mw-bg: #0a0b0d;
    --mw-bg-1: #101217;
    --mw-bg-2: #14171d;
    --mw-bg-3: #1b1f26;
    --mw-line: #23272f;
    --mw-line-2: #2f3540;
    --mw-fg: #f1ece4;
    --mw-fg-dim: #a8a59d;
    --mw-fg-mute: #6c6a64;
    --mw-accent: oklch(0.72 0.19 28);
  }
`;

/* ── Static watch-party data (no API yet) ── */
const WATCH_PARTIES = [
  { id: 1, match: "Arsenal vs Liverpool", sport: "⚽", host: "Jordan M.", hc: "JM", venue: "The Long Bar", city: "Brooklyn", capacity: "42/50", time: "NOW" },
  { id: 2, match: "Warriors vs Lakers", sport: "🏀", host: "Ana S.", hc: "AS", venue: "Stoppage Time", city: "Williamsburg", capacity: "28/40", time: "NOW" },
  { id: 3, match: "Bayern vs PSG", sport: "⚽", host: "Rohan K.", hc: "RK", venue: "The Pitch", city: "Hoboken", capacity: "12/30", time: "IN 42M" },
];

const LIVE_FALLBACK = [
  { id: 1, sport: "soccer", league: "Premier League", home: "Tottenham", away: "Brighton", hs: "1", as_: "2", time: "78'", watchers: 834 },
  { id: 2, sport: "soccer", league: "La Liga", home: "Real Madrid", away: "Sevilla", hs: "3", as_: "0", time: "63'", watchers: 2104 },
  { id: 3, sport: "basketball", league: "NBA", home: "Warriors", away: "Lakers", hs: "88", as_: "92", time: "Q3 · 4:12", watchers: 5218 },
  { id: 4, sport: "nfl", league: "NFL", home: "49ers", away: "Cowboys", hs: "21", as_: "17", time: "Q3 · 09:22", watchers: 1782 },
];

const UPCOMING_FALLBACK = [
  { sport: "soccer", league: "Champions League", home: "Bayern", away: "PSG", kick: "IN 42 MIN", watchers: 18211 },
  { sport: "basketball", league: "NBA", home: "Nuggets", away: "Heat", kick: "IN 2H 12M", watchers: 2103 },
  { sport: "nfl", league: "NFL", home: "Chiefs", away: "Bills", kick: "IN 4H 08M", watchers: 3210 },
  { sport: "soccer", league: "Serie A", home: "Inter", away: "Milan", kick: "IN 5H 30M", watchers: 6440 },
];

const SPORT_COLORS: Record<string, string> = {
  soccer: "#22c55e", football: "#22c55e", basketball: "#f97316", nfl: "#3b82f6", cricket: "#eab308", tennis: "#a78bfa",
};

function CrestBox({ label, color }: { label: string; color: string }) {
  return (
    <div className="mw-crest" style={{ background: color, color: "#fff" }}>
      {label.substring(0, 2).toUpperCase()}
    </div>
  );
}

function LiveMatchCard({ match }: { match: typeof LIVE_FALLBACK[0] }) {
  const accentColor = SPORT_COLORS[match.sport] || "var(--mw-accent)";
  return (
    <div className="mw-match-card live">
      <div className="mw-mc-top">
        <div className="mw-mc-league">
          <div className="mw-mc-swatch" style={{ background: accentColor }} />
          {match.league}
        </div>
        <div className="mw-mc-status live">
          <span className="dot" />
          {match.time}
        </div>
      </div>
      <div className="mw-mc-teams">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div className="mw-mc-team">
            <CrestBox label={match.home.substring(0, 2)} color={accentColor} />
            <span className="mw-mc-name">{match.home}</span>
          </div>
          <div className="mw-mc-team">
            <CrestBox label={match.away.substring(0, 2)} color="#374151" />
            <span className="mw-mc-name">{match.away}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
          <div className="mw-mc-score">{match.hs}</div>
          <div className="mw-mc-score" style={{ color: "var(--mw-fg-dim)", fontWeight: 400 }}>{match.as_}</div>
        </div>
      </div>
      <div className="mw-mc-foot">
        <span>{match.watchers.toLocaleString()} watching</span>
        <Link href="/venues" className="mw-join">Find a bar →</Link>
      </div>
    </div>
  );
}

function UpcomingMatchCard({ match }: { match: typeof UPCOMING_FALLBACK[0] }) {
  const accentColor = SPORT_COLORS[match.sport] || "var(--mw-accent)";
  return (
    <div className="mw-match-card upcoming">
      <div className="mw-mc-top">
        <div className="mw-mc-league">
          <div className="mw-mc-swatch" style={{ background: accentColor }} />
          {match.league}
        </div>
        <div className="mw-mc-status upcoming">{match.kick}</div>
      </div>
      <div className="mw-mc-teams">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div className="mw-mc-team">
            <CrestBox label={match.home.substring(0, 2)} color={accentColor} />
            <span className="mw-mc-name">{match.home}</span>
          </div>
          <div className="mw-mc-team">
            <CrestBox label={match.away.substring(0, 2)} color="#374151" />
            <span className="mw-mc-name">{match.away}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
          <div className="mw-mc-score" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "var(--mw-fg-dim)", fontWeight: 500 }}>—</div>
          <div className="mw-mc-score" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "var(--mw-fg-dim)", fontWeight: 500 }}>—</div>
        </div>
      </div>
      <div className="mw-mc-foot">
        <span>{match.watchers.toLocaleString()} interested</span>
        <Link href="/matches" className="mw-join">View venues →</Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { matches, venues, leagues, teams, isLoading } = useData();
  const { user } = useAuth();
  const [utcTime, setUtcTime] = useState("");
  const [renderNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().split(" ")[4]);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* Recent scores — finished matches, newest first */
  const recentMatches = matches
    .filter((m) => m.status === "FINISHED")
    .sort((a, b) => new Date(b.matchDateUTC).getTime() - new Date(a.matchDateUTC).getTime())
    .slice(0, 8);

  /* Upcoming — scheduled/timed, soonest first */
  const upcomingMatches = matches
    .filter((m) => m.status === "SCHEDULED" || m.status === "TIMED")
    .sort((a, b) => new Date(a.matchDateUTC).getTime() - new Date(b.matchDateUTC).getTime())
    .slice(0, 4);

  /* Helpers */
  const getLeagueName = (leagueId: string) => leagues.find((l) => l.id === leagueId)?.name || leagueId.toUpperCase();
  const getTeam = (teamId?: string) => teams.find((t) => t.id === teamId);

  /* Venue cards for "Find a bar" — use real venues */
  const featuredVenues = venues.slice(0, 6);

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase()
    : "MW";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
      {/* Ribbon */}
      <div className="mw-ribbon">
        <div className="left">
          <b>◆ MATCHWATCH</b>
          <span>WATCH WITH FANS &amp; FRIENDS · FIND A BAR · PLAN MATCH NIGHT</span>
        </div>
        <div className="mw-ribbon-ticker">
          <span><b>{venues.length || 209}</b> bars &amp; venues</span>
          <span><b>{matches.length || 42}</b> upcoming matches</span>
          <span><b>$48 avg</b> saved on tickets</span>
        </div>
      </div>

      {/* Topbar */}
      <header className="mw-topbar">
        <Link href="/" className="mw-brand">
          <span className="mw-brand-mark" />
          match<em>watch</em>
        </Link>
        <nav className="mw-nav">
          <Link href="/" className="active">Home</Link>
          <Link href="/venues">Venues</Link>
          <Link href="/matches">Matches</Link>
          <Link href="/blog">Blog</Link>
          {user ? <Link href="/dashboard">My bookings</Link> : <Link href="/register-venue">List your venue</Link>}
        </nav>
        <div className="mw-top-right">
          <div className="mw-ticker-pill">
            <span className="dot" />
            <span>{utcTime}</span> UTC
          </div>
          <button className="mw-iconbtn" aria-label="Search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </button>
          {user ? (
            <Link href="/dashboard">
              <div className="mw-avatar">{initials}</div>
            </Link>
          ) : (
            <Link href="/login" className="mw-btn" style={{ padding: "8px 14px", fontSize: 11 }}>Sign in</Link>
          )}
        </div>
      </header>

      {/* 3-column layout */}
      <div className="mw-page">

        {/* Left sidebar */}
        <aside className="mw-side">
          <h4>Matchwatch</h4>
          <div className="mw-side-list">
            <Link href="/" className="mw-side-item active">
              <span className="ico" style={{ color: "var(--mw-accent)" }}>◆</span>
              <span>Home</span>
              <span className="badge">{upcomingMatches.length || 42}</span>
            </Link>
            <Link href="/venues" className="mw-side-item">
              <span className="ico">🍺</span>
              <span>Venues</span>
              <span className="badge">{venues.length || 209}</span>
            </Link>
            <Link href="/matches" className="mw-side-item">
              <span className="ico">📅</span>
              <span>Matches</span>
              <span className="badge">{matches.length || 64}</span>
            </Link>
            <Link href="/blog" className="mw-side-item">
              <span className="ico">📰</span>
              <span>Blog</span>
            </Link>
            {user ? (
              <Link href="/dashboard" className="mw-side-item">
                <span className="ico">🎫</span>
                <span>My bookings</span>
              </Link>
            ) : (
              <Link href="/register-venue" className="mw-side-item">
                <span className="ico">🏟️</span>
                <span>List your venue</span>
              </Link>
            )}
          </div>

          <h4>Sports</h4>
          <div className="mw-side-list">
            <div className="mw-side-item"><span className="ico">⚽</span><span>Football</span><span className="badge">{recentMatches.length || 18}</span></div>
            <div className="mw-side-item"><span className="ico">🏀</span><span>Basketball</span><span className="badge">9</span></div>
            <div className="mw-side-item"><span className="ico">🏈</span><span>American FB</span><span className="badge">4</span></div>
            <div className="mw-side-item"><span className="ico">🏏</span><span>Cricket</span><span className="badge">6</span></div>
            <div className="mw-side-item"><span className="ico">🎾</span><span>Tennis</span><span className="badge">5</span></div>
          </div>

          <h4>Following teams</h4>
          <div className="mw-follow-team">
            <span className="mw-team-crest" style={{ background: "#dc2626" }}>AR</span>
            <span style={{ flex: 1 }}>Arsenal</span>
            <div className="mw-form">
              {["W","W","D","W","L"].map((r, i) => (
                <div key={i} className="mw-dot" style={{ background: r === "W" ? "oklch(0.78 0.16 145)" : r === "D" ? "var(--mw-fg-mute)" : "oklch(0.65 0.2 20)" }} />
              ))}
            </div>
          </div>
          <div className="mw-follow-team">
            <span className="mw-team-crest" style={{ background: "#0b1220" }}>NY</span>
            <span style={{ flex: 1 }}>NYCFC</span>
            <div className="mw-form">
              {["W","W","W","D","W"].map((r, i) => (
                <div key={i} className="mw-dot" style={{ background: r === "W" ? "oklch(0.78 0.16 145)" : r === "D" ? "var(--mw-fg-mute)" : "oklch(0.65 0.2 20)" }} />
              ))}
            </div>
          </div>
          <div className="mw-follow-team">
            <span className="mw-team-crest" style={{ background: "#ff6b00" }}>HT</span>
            <span style={{ flex: 1 }}>Houston Dynamo</span>
            <div className="mw-form">
              {["W","L","W","W","D"].map((r, i) => (
                <div key={i} className="mw-dot" style={{ background: r === "W" ? "oklch(0.78 0.16 145)" : r === "D" ? "var(--mw-fg-mute)" : "oklch(0.65 0.2 20)" }} />
              ))}
            </div>
          </div>
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
                    Find fans near you, join a watch party at a bar, or save on stadium tickets for the real thing. One place for every way to watch the match.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, borderTop: "1px solid var(--mw-line)", paddingTop: 18, marginTop: 4 }}>
                  {[
                    { label: "VENUES &amp; BARS", val: String(venues.length || 209), accent: false },
                    { label: "UPCOMING MATCHES", val: String(matches.length || 42), accent: false },
                    { label: "AVG TICKET SAVINGS", val: "$48", accent: true },
                  ].map(({ label, val, accent }) => (
                    <div key={label}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mw-fg-mute)", marginBottom: 6 }} dangerouslySetInnerHTML={{ __html: label }} />
                      <div style={{ fontFamily: "'Space Grotesk', var(--font-space), sans-serif", fontWeight: 600, fontSize: 32, color: accent ? "var(--mw-accent)" : "var(--mw-fg)", lineHeight: 1 }}>
                        {val}{accent && <em style={{ fontStyle: "normal", color: "var(--mw-fg-mute)", fontSize: 14, marginLeft: 4 }}>/seat</em>}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
                  <Link href="/venues" className="mw-btn primary">Find a bar near me</Link>
                  <Link href="/matches" className="mw-btn ghost">View fixtures</Link>
                  {!user && <Link href="/register" className="mw-btn ghost">Join free</Link>}
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
                    <>
                      {[
                        { label: "TOP BAR · 0.3 MI", badge: "87% FULL", name: "The Long Bar", desc: "Showing 3 matches · $5 pints during kickoffs · Union St" },
                        { label: "WATCH PARTY · 6 FRIENDS", badge: "STARTS 18:30", name: "Arsenal supporters · Hoboken", desc: "14 people going · Reservation held at The Pitch" },
                        { label: "TICKET DROP · TONIGHT", badge: "−38%", name: "NYCFC vs Atlanta · Section 114", desc: "$52 · was $84 · 4 seats left" },
                      ].map(({ label, badge, name, desc }) => (
                        <div key={name} style={{ border: "1px solid var(--mw-line)", padding: 12, background: "var(--mw-bg-1)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "var(--mw-fg-mute)", textTransform: "uppercase", marginBottom: 8 }}>
                            <span>{label}</span><span style={{ color: "var(--mw-accent)", fontWeight: 600 }}>{badge}</span>
                          </div>
                          <div style={{ fontFamily: "'Space Grotesk', var(--font-space), sans-serif", fontWeight: 600, fontSize: 15, marginBottom: 4, color: "var(--mw-fg)" }}>{name}</div>
                          <div style={{ fontSize: 11, color: "var(--mw-fg-dim)" }}>{desc}</div>
                        </div>
                      ))}
                    </>
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
                Find a bar <em>· Watch with fans near you</em>
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

          {/* Recent scores */}
          <div className="mw-sec-filter-head">
            <div className="mw-sec-title">
              Recent scores <span className="tag">{recentMatches.length} RESULTS</span>
            </div>
            <div className="mw-filters">
              <button className="mw-filter on">Latest</button>
              <Link href="/matches" className="mw-filter" style={{ textDecoration: "none" }}>All results</Link>
            </div>
          </div>

          <div className="mw-match-grid">
            {recentMatches.length > 0
              ? recentMatches.map((m) => {
                const disp = getMatchDisplay(m);
                const homeTeam = getTeam(m.homeTeamId);
                const awayTeam = getTeam(m.awayTeamId);
                const matchDate = new Date(m.matchDateUTC);
                const dateStr = matchDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const homeWon = (m.homeScore ?? 0) > (m.awayScore ?? 0);
                const awayWon = (m.awayScore ?? 0) > (m.homeScore ?? 0);
                return (
                  <Link key={m.id} href={`/matches/${m.id}`} className="mw-match-card" style={{ textDecoration: "none" }}>
                    <div className="mw-mc-top">
                      <div className="mw-mc-league">
                        <div className="mw-mc-swatch" />
                        {getLeagueName(m.leagueId)}
                      </div>
                      <div className="mw-mc-status upcoming">
                        FINAL · {dateStr}
                      </div>
                    </div>
                    <div className="mw-mc-teams">
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div className="mw-mc-team">
                          {homeTeam?.image
                            ? <img src={homeTeam.image} alt={disp.homeName} style={{ width: 28, height: 28, objectFit: "contain" }} />
                            : <CrestBox label={disp.homeName.substring(0, 2)} color={homeTeam?.color || "var(--mw-accent)"} />
                          }
                          <span className="mw-mc-name" style={{ opacity: awayWon ? 0.5 : 1, fontWeight: homeWon ? 600 : 400 }}>{disp.homeName}</span>
                        </div>
                        <div className="mw-mc-team">
                          {awayTeam?.image
                            ? <img src={awayTeam.image} alt={disp.awayName} style={{ width: 28, height: 28, objectFit: "contain" }} />
                            : <CrestBox label={disp.awayName.substring(0, 2)} color={awayTeam?.color || "#374151"} />
                          }
                          <span className="mw-mc-name" style={{ opacity: homeWon ? 0.5 : 1, fontWeight: awayWon ? 600 : 400 }}>{disp.awayName}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                        <div className="mw-mc-score" style={{ fontWeight: homeWon ? 700 : 400, color: homeWon ? "var(--mw-fg)" : "var(--mw-fg-dim)" }}>{m.homeScore ?? "—"}</div>
                        <div className="mw-mc-score" style={{ fontWeight: awayWon ? 700 : 400, color: awayWon ? "var(--mw-fg)" : "var(--mw-fg-dim)" }}>{m.awayScore ?? "—"}</div>
                      </div>
                    </div>
                    <div className="mw-mc-foot">
                      <span style={{ color: "var(--mw-fg-mute)" }}>Full-time result</span>
                      <span className="mw-join">Match report →</span>
                    </div>
                  </Link>
                );
              })
              : (
                <div style={{ gridColumn: "1/-1", padding: "40px 0", textAlign: "center", color: "var(--mw-fg-mute)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.1em" }}>
                  NO RECENT RESULTS · CHECK BACK AFTER MATCH DAY
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
                            ? <img src={homeTeam.image} alt={disp.homeName} style={{ width: 28, height: 28, objectFit: "contain" }} />
                            : <CrestBox label={disp.homeName.substring(0, 2)} color={homeTeam?.color || "var(--mw-accent)"} />
                          }
                          <span className="mw-mc-name">{disp.homeName}</span>
                        </div>
                        <div className="mw-mc-team">
                          {awayTeam?.image
                            ? <img src={awayTeam.image} alt={disp.awayName} style={{ width: 28, height: 28, objectFit: "contain" }} />
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
              : UPCOMING_FALLBACK.map((m, i) => <UpcomingMatchCard key={i} match={m} />)
            }
          </div>
        </main>

        {/* Right rail */}
        <aside className="mw-rail">
          <h3>Watch parties <span className="n">· {WATCH_PARTIES.length} near you</span></h3>

          {WATCH_PARTIES.map((p) => (
            <div key={p.id} className="mw-party">
              <div className="mw-party-head">
                <span>{p.sport} {p.match.split(" vs ")[0].substring(0, 12).toUpperCase()}</span>
                <span style={{ color: p.time === "NOW" ? "var(--mw-accent)" : "var(--mw-fg-dim)" }}>{p.time}</span>
              </div>
              <div className="mw-party-title">{p.match}</div>
              <div className="mw-party-host">
                <div className="hc">{p.hc}</div>
                <span>Hosted by {p.host} · {p.venue}</span>
              </div>
              <div className="mw-party-meta">
                <span>📍 {p.city}</span>
                <span>👥 {p.capacity}</span>
              </div>
              <Link href="/venues" className="mw-party-join">Join party →</Link>
            </div>
          ))}

          <h4>Friends are watching</h4>
          <div className="mw-create-party">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex" }}>
                {["#b4876a", "#8ca67a", "#7a8ca6"].map((c, i) => (
                  <div key={i} style={{ width: 18, height: 18, background: c, border: "2px solid var(--mw-bg-1)", marginLeft: i === 0 ? 0 : -6 }} />
                ))}
              </div>
              <div>3 friends · watching now</div>
            </div>
            <Link href="/venues" className="mw-party-join">Find them →</Link>
          </div>

          <h4>List your venue</h4>
          <div className="mw-create-party">
            Show {matches.length || 42} upcoming matches to your customers and grow your crowd on match nights.
            <Link href="/register-venue" className="mw-btn" style={{ padding: "8px 12px", fontSize: 11 }}>+ Add your bar</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
