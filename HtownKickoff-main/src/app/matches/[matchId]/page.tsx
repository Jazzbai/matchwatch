"use client";

import React, { useState, use, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth-context";
import { api } from "../../../lib/api";
import { AMENITY_LABELS } from "../../../lib/data";
import { getLeagueVisual, getMatchDisplay, getSingleEventSubtitle, getSingleEventTitle, isSingleEventMatch } from "../../../lib/match-display";
import { useData, type Venue, type VenueEvent } from "../../../lib/data-provider";

/* ── CSS injected once ── */
const MD_CSS = `
  .md-page{display:grid;grid-template-columns:1fr 380px;gap:0;min-width:0;}
  .md-main{padding:28px 32px 60px;min-width:0;}
  .md-rail{border-left:1px solid var(--md-line);padding:24px;background:linear-gradient(180deg,rgba(255,255,255,.015),transparent 200px);position:sticky;top:60px;height:calc(100vh - 60px);overflow-y:auto;}
  .md-hero{border:1px solid var(--md-line);background:linear-gradient(120deg,rgba(255,95,45,0.12),transparent 50%),linear-gradient(0deg,#0c0e12,#131720);padding:26px 28px;margin-bottom:28px;position:relative;overflow:hidden;}
  .md-hero-meta{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--md-fg-dim);letter-spacing:.08em;text-transform:uppercase;}
  .md-live-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;background:var(--md-accent);color:var(--md-accent-ink);font-weight:600;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:.08em;}
  .md-live-chip .d{width:6px;height:6px;background:var(--md-accent-ink);border-radius:50%;animation:mdPulse 1s infinite;}
  @keyframes mdPulse{0%,100%{opacity:.4}50%{opacity:1}}
  .md-score-wrap{display:grid;grid-template-columns:1fr auto 1fr;gap:26px;align-items:center;margin-top:18px;}
  .md-teamcol{display:flex;flex-direction:column;gap:6px;}
  .md-teamcol.right{align-items:flex-end;text-align:right;}
  .md-teamrow{display:flex;align-items:center;gap:16px;}
  .md-teamcol.right .md-teamrow{flex-direction:row-reverse;}
  .md-crest{width:72px;height:72px;display:grid;place-items:center;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:26px;border:2px solid rgba(255,255,255,.12);}
  .md-t-name{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:clamp(20px,3vw,34px);letter-spacing:-0.015em;line-height:1;color:var(--md-fg);}
  .md-t-sub{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--md-fg-mute);letter-spacing:.08em;margin-top:5px;}
  .md-score{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:clamp(60px,8vw,110px);line-height:.85;letter-spacing:-0.04em;font-feature-settings:"tnum" 1;color:var(--md-fg);}
  .md-score .sep{color:var(--md-fg-mute);font-weight:400;font-size:60px;vertical-align:14px;margin:0 10px;}
  .md-score .hl{color:var(--md-accent);}
  .md-minute{display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:6px;}
  .md-minute .m{font-family:'JetBrains Mono',var(--font-mono),monospace;font-weight:600;font-size:22px;color:var(--md-fg);}
  .md-minute .m em{font-style:normal;color:var(--md-accent);}
  .md-minute .h{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--md-fg-mute);letter-spacing:.1em;}
  .md-hero-foot{display:flex;gap:10px;margin-top:22px;padding-top:18px;border-top:1px solid var(--md-line);flex-wrap:wrap;}
  .md-btn{display:inline-flex;align-items:center;gap:10px;padding:12px 18px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--md-line-2);color:var(--md-fg);transition:all .14s;background:none;cursor:pointer;text-decoration:none;}
  .md-btn:hover{border-color:var(--md-fg-dim);}
  .md-btn.primary{background:var(--md-accent);color:var(--md-accent-ink);border-color:var(--md-accent);font-weight:600;}
  .md-btn.primary:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--md-fg);}
  .md-crumb{padding:14px 32px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:.08em;color:var(--md-fg-mute);text-transform:uppercase;border-bottom:1px solid var(--md-line);}
  .md-crumb a:hover{color:var(--md-fg);}
  .md-crumb .sep{margin:0 8px;color:var(--md-line-2);}
  .md-crumb b{color:var(--md-fg-dim);font-weight:500;}
  .md-sec-head{display:flex;align-items:baseline;justify-content:space-between;margin:28px 0 14px;}
  .md-sec-title{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:20px;display:flex;align-items:center;gap:12px;color:var(--md-fg);}
  .md-sec-title .tag{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--md-fg-mute);letter-spacing:.1em;border:1px solid var(--md-line);padding:3px 6px;text-transform:uppercase;}
  .md-filters{display:flex;gap:6px;flex-wrap:wrap;}
  .md-filter{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--md-fg-dim);padding:6px 10px;border:1px solid var(--md-line);letter-spacing:.04em;text-transform:uppercase;background:none;cursor:pointer;transition:all .12s;}
  .md-filter.on{color:var(--md-accent-ink);background:var(--md-accent);border-color:var(--md-accent);}
  .md-filter:hover:not(.on){color:var(--md-fg);border-color:var(--md-line-2);}
  .md-stats{border:1px solid var(--md-line);background:var(--md-bg-1);padding:22px 24px;display:grid;gap:14px;}
  .md-stat{display:grid;grid-template-columns:60px 1fr 60px;gap:14px;align-items:center;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:13px;}
  .md-stat .label{text-align:center;font-size:10px;letter-spacing:.14em;color:var(--md-fg-mute);text-transform:uppercase;grid-column:1/4;margin-top:4px;}
  .md-stat .vl{text-align:right;color:var(--md-fg);font-weight:500;}
  .md-stat .vr{text-align:left;color:var(--md-fg);font-weight:500;}
  .md-stat .bar{display:grid;grid-template-columns:1fr 1fr;height:6px;gap:2px;}
  .md-stat .bar .l{background:var(--md-line);position:relative;overflow:hidden;}
  .md-stat .bar .r{background:var(--md-line);position:relative;overflow:hidden;}
  .md-stat .bar .l i{position:absolute;right:0;top:0;bottom:0;background:var(--md-fg);}
  .md-stat .bar .r i{position:absolute;left:0;top:0;bottom:0;background:var(--md-accent);}
  .md-stat.lead-away .vr{color:var(--md-accent);}
  .md-stat.lead-home .vl{font-weight:700;}
  .md-events{border:1px solid var(--md-line);background:var(--md-bg-1);}
  .md-event-row{display:grid;grid-template-columns:60px 1fr 40px 1fr;gap:16px;padding:12px 18px;border-bottom:1px dashed var(--md-line);font-size:13px;align-items:center;color:var(--md-fg-dim);}
  .md-event-row:last-child{border-bottom:0;}
  .md-event-row.goal{background:linear-gradient(90deg,rgba(255,95,45,0.06),transparent 60%);}
  .md-event-row .t{font-family:'JetBrains Mono',var(--font-mono),monospace;color:var(--md-fg);font-size:12px;font-weight:500;}
  .md-event-row .ic{display:grid;place-items:center;font-size:16px;}
  .md-event-row .side-home{text-align:right;}
  .md-event-row .side-away{text-align:left;}
  .md-event-row b{color:var(--md-fg);font-weight:600;}
  .md-h2h{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
  .md-h2h-item{border:1px solid var(--md-line);background:var(--md-bg-1);padding:10px;font-size:11px;text-align:center;}
  .md-h2h-item .dt{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:.1em;color:var(--md-fg-mute);text-transform:uppercase;}
  .md-h2h-item .sc{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:22px;color:var(--md-fg);margin:4px 0;}
  .md-h2h-item .cmp{font-size:10px;color:var(--md-fg-dim);}
  .md-h2h-item .r{display:inline-block;margin-top:4px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;padding:2px 4px;letter-spacing:.08em;}
  .md-h2h-item .r.w{background:oklch(0.78 0.16 145);color:#051;}
  .md-h2h-item .r.d{background:var(--md-line-2);color:var(--md-fg);}
  .md-h2h-item .r.l{background:oklch(0.65 0.2 20);color:#fff;}
  .md-map{border:1px solid var(--md-line);background:radial-gradient(circle at 30% 50%,rgba(255,120,60,0.12),transparent 30%),radial-gradient(circle at 70% 40%,rgba(80,180,255,0.08),transparent 40%),linear-gradient(180deg,#0e1116,#0a0b0d);aspect-ratio:21/9;position:relative;overflow:hidden;}
  .md-map::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:40px 40px;}
  .md-pin{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;}
  .md-pin .dot{width:14px;height:14px;background:var(--md-accent);border-radius:50%;border:2px solid var(--md-accent-ink);box-shadow:0 0 0 4px rgba(255,95,45,0.2);}
  .md-pin.me .dot{background:oklch(0.78 0.14 200);box-shadow:0 0 0 4px rgba(0,180,220,.2);}
  .md-pin .lbl{margin-top:4px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:.08em;background:rgba(10,11,13,.9);padding:2px 5px;color:var(--md-fg);text-transform:uppercase;white-space:nowrap;}
  .md-venues{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px;}
  .md-venue{border:1px solid var(--md-line);background:var(--md-bg-1);padding:14px;cursor:pointer;transition:all .14s;text-decoration:none;display:block;}
  .md-venue:hover{border-color:var(--md-line-2);background:var(--md-bg-2);}
  .md-venue .vt{display:flex;justify-content:space-between;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:.1em;color:var(--md-fg-mute);text-transform:uppercase;margin-bottom:8px;}
  .md-venue .vt .occ{color:var(--md-accent);font-weight:600;}
  .md-venue .nm{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:16px;margin-bottom:4px;color:var(--md-fg);}
  .md-venue .desc{font-size:11px;color:var(--md-fg-dim);line-height:1.45;}
  .md-venue .vft{display:flex;justify-content:space-between;padding-top:10px;margin-top:10px;border-top:1px dashed var(--md-line);font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--md-fg-mute);letter-spacing:.08em;}
  .md-venue .vft .res{color:var(--md-accent);}
  .md-rail h3{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:15px;margin:0 0 12px;display:flex;align-items:center;gap:8px;color:var(--md-fg);}
  .md-rail h3 .n{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--md-fg-mute);font-weight:400;}
  .md-rail h4{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--md-fg-mute);margin:20px 0 10px;font-weight:500;}
  .md-party{border:1px solid var(--md-line);padding:12px;display:grid;gap:8px;margin-bottom:10px;background:var(--md-bg-1);transition:all .14s;}
  .md-party:hover{border-color:var(--md-accent);}
  .md-p-head{display:flex;justify-content:space-between;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.08em;color:var(--md-fg-mute);text-transform:uppercase;}
  .md-p-title{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:13px;line-height:1.3;color:var(--md-fg);}
  .md-p-host{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--md-fg-dim);}
  .md-hc{width:20px;height:20px;display:grid;place-items:center;font-size:9px;font-weight:600;color:#1b0f08;background:linear-gradient(135deg,#6a5340,#b4876a);}
  .md-p-join{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:6px 8px;background:var(--md-accent);color:var(--md-accent-ink);font-weight:600;display:inline-flex;align-items:center;gap:6px;border:none;cursor:pointer;}
  .md-chat{border:1px solid var(--md-line);background:var(--md-bg-1);display:flex;flex-direction:column;padding:14px;max-height:360px;}
  .md-chat h4{margin:0 0 10px;}
  .md-msgs{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:10px;padding-right:4px;}
  .md-msg{display:grid;grid-template-columns:22px 1fr;gap:8px;font-size:12px;}
  .md-msg .av{width:22px;height:22px;display:grid;place-items:center;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:9px;}
  .md-msg .nm{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;color:var(--md-fg);font-size:12px;}
  .md-msg .nm.host{color:var(--md-accent);}
  .md-msg .body{color:var(--md-fg-dim);line-height:1.4;}
  .md-chat-inp{display:flex;gap:6px;border-top:1px solid var(--md-line);padding-top:10px;}
  .md-chat-inp input{flex:1;background:transparent;border:1px solid var(--md-line);color:var(--md-fg);padding:7px 10px;font:inherit;font-size:12px;}
  .md-chat-inp input:focus{outline:0;border-color:var(--md-accent);}
  .md-reactions{display:flex;gap:4px;margin-bottom:8px;}
  .md-reactions button{border:1px solid var(--md-line);padding:3px 7px;font-size:13px;background:none;cursor:pointer;}
  .md-reactions button:hover{border-color:var(--md-accent);}
  .md-ticket{border:1px solid var(--md-accent);background:var(--md-bg-1);padding:14px;margin-top:14px;}
  .md-ticket .t-top{display:flex;justify-content:space-between;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:.1em;color:var(--md-fg-mute);text-transform:uppercase;margin-bottom:8px;}
  .md-ticket .t-top .off{color:var(--md-accent);font-weight:600;}
  .md-ticket .t-nm{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:14px;margin-bottom:6px;color:var(--md-fg);}
  .md-ticket .prices{display:flex;gap:10px;align-items:baseline;margin-bottom:8px;}
  .md-ticket .p-now{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:22px;color:var(--md-accent);}
  .md-ticket .p-was{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:12px;color:var(--md-fg-mute);text-decoration:line-through;}
  .md-ticket .p-meta{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--md-fg-dim);}
  .md-topbar{position:sticky;top:0;z-index:20;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:14px 28px;background:rgba(10,11,13,.9);backdrop-filter:blur(14px);border-bottom:1px solid var(--md-line);}
  .md-brand{display:flex;align-items:center;gap:10px;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:18px;letter-spacing:-0.01em;text-decoration:none;color:var(--md-fg);}
  .md-brand em{font-style:normal;color:var(--md-accent);}
  .md-brand-mark{width:22px;height:22px;position:relative;background:var(--md-fg);mask-image:conic-gradient(from 0deg,#000 0 25%,transparent 25% 50%,#000 50% 75%,transparent 75% 100%);-webkit-mask-image:conic-gradient(from 0deg,#000 0 25%,transparent 25% 50%,#000 50% 75%,transparent 75% 100%);border-radius:2px;}
  .md-brand-mark::after{content:"";position:absolute;inset:4px;background:var(--md-accent);border-radius:1px;}
  .md-nav{display:flex;gap:28px;justify-content:center;}
  .md-nav a{font-size:13px;color:var(--md-fg-dim);letter-spacing:0.04em;text-transform:uppercase;position:relative;padding:6px 0;text-decoration:none;transition:color .12s;}
  .md-nav a.active,.md-nav a:hover{color:var(--md-fg);}
  .md-nav a.active::after{content:"";position:absolute;left:0;right:0;bottom:-15px;height:2px;background:var(--md-accent);}
  .md-top-right{display:flex;gap:14px;justify-content:flex-end;align-items:center;}
  .md-iconbtn{width:36px;height:36px;border:1px solid var(--md-line);display:grid;place-items:center;color:var(--md-fg-dim);background:none;cursor:pointer;flex-shrink:0;}
  .md-iconbtn:hover{color:var(--md-fg);border-color:var(--md-line-2);}
  .md-avatar{width:32px;height:32px;background:linear-gradient(135deg,#5a4a3a,#a07a52);display:grid;place-items:center;font-weight:600;font-size:12px;color:#1a1108;flex-shrink:0;}
  @media(max-width:1100px){.md-page{grid-template-columns:1fr;}.md-rail{display:none;}}
  @media(max-width:768px){.md-venues{grid-template-columns:1fr;}.md-h2h{grid-template-columns:repeat(3,1fr);}.md-score-wrap{gap:12px;}}
`;

const MD_VARS = `
  :root {
    --md-bg:#0a0b0d; --md-bg-1:#101217; --md-bg-2:#14171d;
    --md-line:#23272f; --md-line-2:#2f3540;
    --md-fg:#f1ece4; --md-fg-dim:#a8a59d; --md-fg-mute:#6c6a64;
    --md-accent:oklch(0.72 0.19 28); --md-accent-ink:#0a0b0d;
  }
`;

function formatStageLabel(stage?: string | null, matchDay?: number | string | null) {
    const safeStage = typeof stage === "string" ? stage.trim() : "";
    const safeMatchDay = matchDay == null ? null : String(matchDay).trim();
    if (!safeStage && !safeMatchDay) return null;
    if (!safeStage) return safeMatchDay ? `Matchday ${safeMatchDay}` : null;
    const normalized = safeStage.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (normalized === "regular season") return safeMatchDay ? `Matchday ${safeMatchDay}` : "Regular Season";
    const pretty = normalized.replace(/\b\w/g, (c) => c.toUpperCase());
    return safeMatchDay ? `${pretty} · Matchday ${safeMatchDay}` : pretty;
}

/* ── Chat messages for the right rail ── */
function buildSafeYoutubeEmbedUrl(videoId?: string | null) {
    const safeVideoId = (videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(safeVideoId)) return null;
    return `https://www.youtube.com/embed/${safeVideoId}`;
}

const DEMO_MSGS = [
    { av: "#b4876a", init: "JM", name: "Jordan M.", host: true, body: "What a goal! 🔥🔥" },
    { av: "#7a8ca6", init: "AS", name: "Ana S.", host: false, body: "That assist was unreal" },
    { av: "#8ca67a", init: "RK", name: "Rohan K.", host: false, body: "hold this hold this 🤞" },
    { av: "#a6857a", init: "TY", name: "Tomás Y.", host: false, body: "if we hold we're through 💪" },
    { av: "#a69c7a", init: "MV", name: "Mira V.", host: false, body: "atmosphere must be insane right now" },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

function mapApiMatchToMatch(m: any): import("../../../lib/data").Match {
    const leagueId = m.leagueId || m.league?.id || "unknown-league";
    const homeTeamId = m.homeTeamId || (m.homeTeamName ? m.homeTeamName.toLowerCase().replace(/\s+/g, "-") : undefined);
    const awayTeamId = m.awayTeamId || (m.awayTeamName ? m.awayTeamName.toLowerCase().replace(/\s+/g, "-") : undefined);
    return {
        id: m.id,
        isFeatured: Boolean(m.isFeatured),
        homeTeamId: m.eventFormat === "SINGLE_EVENT" ? undefined : homeTeamId,
        awayTeamId: m.eventFormat === "SINGLE_EVENT" ? undefined : awayTeamId,
        homeTeamName: m.homeTeamName || undefined,
        awayTeamName: m.awayTeamName || undefined,
        leagueId,
        matchDateUTC: m.matchDateUtc || m.matchDateUTC || new Date().toISOString(),
        status: m.status || "SCHEDULED",
        homeScore: m.homeScore ?? null,
        awayScore: m.awayScore ?? null,
        matchDay: m.matchDay ? String(m.matchDay) : "",
        stage: m.stage || "",
        stadiumName: m.venueName || m.stadiumName || "",
        venueCount: m.venueCount || 0,
        isHot: (m.venueCount || 0) >= 10,
        eventFormat: m.eventFormat || "HEAD_TO_HEAD",
        eventTitle: m.eventTitle || undefined,
        eventSubtitle: m.eventSubtitle || undefined,
        youtubeVideoId: m.youtubeVideoId || undefined,
        youtubeVideoTitle: m.youtubeVideoTitle || undefined,
        youtubeChannelTitle: m.youtubeChannelTitle || undefined,
        youtubePublishedAt: m.youtubePublishedAt || undefined,
        youtubeThumbnailUrl: m.youtubeThumbnailUrl || undefined,
        youtubeEmbedUrl: m.youtubeEmbedUrl || undefined,
        youtubeSearchStatus: m.youtubeSearchStatus || undefined,
        youtubeCheckedAt: m.youtubeCheckedAt || undefined,
    };
}

export default function MatchDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
    const { matchId } = use(params);
    const { matches: MATCHES, getTeam, getLeague, getVenueEvents, isLoading, refetch } = useData();
    const { user } = useAuth();
    const cachedMatch = MATCHES.find((m) => m.id === matchId);
    const [directMatch, setDirectMatch] = useState<import("../../../lib/data").Match | null>(null);
    const [directFetchDone, setDirectFetchDone] = useState(false);
    // Prefer directMatch if it has YouTube data that the cached version lacks
    const match = (directMatch?.youtubeVideoId || directMatch?.youtubeEmbedUrl) ? directMatch : (cachedMatch || directMatch);
    const venueEvents = match ? getVenueEvents(match.id) : [];
    const [chatInput, setChatInput] = useState("");
    const [msgs, setMsgs] = useState(DEMO_MSGS);
    const [venueFilter, setVenueFilter] = useState("Near me");

    useEffect(() => { void refetch(); }, [refetch, matchId]);

    useEffect(() => {
        if (isLoading) return;
        // Skip if we already have YouTube data from cache
        if (cachedMatch?.youtubeVideoId || cachedMatch?.youtubeEmbedUrl || cachedMatch?.youtubeSearchStatus) return;
        setDirectFetchDone(false);
        fetch(`${API_BASE}/matches/${matchId}`, { credentials: "include" })
            .then((r) => r.ok ? r.json() : null)
            .then((json) => { if (json?.data) setDirectMatch(mapApiMatchToMatch(json.data)); })
            .catch(() => {})
            .finally(() => setDirectFetchDone(true));
    }, [matchId, cachedMatch?.youtubeVideoId, cachedMatch?.youtubeEmbedUrl, cachedMatch?.youtubeSearchStatus, isLoading]);

    const isSingleEvent = match ? isSingleEventMatch(match) : false;
    const initials = user?.name ? user.name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase() : "MW";

    if (!match && (isLoading || (!cachedMatch && !directFetchDone))) {
        return (
            <div style={{ background: "var(--md-bg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--md-fg-dim)", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                Loading match…
            </div>
        );
    }

    if (!match) {
        return (
            <div style={{ background: "var(--md-bg)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--md-fg)", fontFamily: "'Space Grotesk', sans-serif" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚽</div>
                <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Match not found</h1>
                <Link href="/matches" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", padding: "10px 16px", border: "1px solid var(--md-line-2)", color: "var(--md-fg)", textDecoration: "none" }}>← Back to Matches</Link>
            </div>
        );
    }

    const home = match.homeTeamId ? getTeam(match.homeTeamId) : undefined;
    const away = match.awayTeamId ? getTeam(match.awayTeamId) : undefined;
    const league = getLeague(match.leagueId) || { id: match.leagueId, sportId: undefined, name: "League", shortName: "LG", logo: "LG", image: undefined, country: "", externalId: match.leagueId };
    const display = getMatchDisplay(match, { homeTeam: home, awayTeam: away, league });
    const leagueVisual = getLeagueVisual(league);
    const stageLabel = formatStageLabel(match.stage, match.matchDay);
    const d = new Date(match.matchDateUTC);
    const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
    const isFinished = match.status === "FINISHED";
    const canShowRecap = isFinished && d.getTime() <= Date.now();
    const recapEmbedUrl = canShowRecap
        ? (buildSafeYoutubeEmbedUrl(match.youtubeVideoId) || (match.youtubeEmbedUrl?.startsWith("https://www.youtube.com/embed/") ? match.youtubeEmbedUrl : null))
        : null;

    const homeColor = home?.color || "#dc2626";
    const awayColor = away?.color || "#1d4ed8";

    const matchTitle = isSingleEvent
        ? (match.eventTitle || league.name)
        : `${display.homeName} vs ${display.awayName}`;

    /* Venue events for this match */
    const venuesToShow = venueEvents.slice(0, 9);

    function sendMsg() {
        if (!chatInput.trim()) return;
        setMsgs((prev) => [...prev, { av: "#5a4a3a", init: "YOU", name: "You", host: false, body: chatInput }]);
        setChatInput("");
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: MD_VARS + MD_CSS + `body{background:var(--md-bg)!important;color:var(--md-fg)!important;}` }} />
            {/* Topbar */}
            <header className="md-topbar">
                <Link href="/" className="md-brand">
                    <span className="md-brand-mark" />
                    match<em>watch</em>
                </Link>
                <nav className="md-nav">
                    <Link href="/">Home</Link>
                    <Link href="/matches" className="active">Matches</Link>
                    <Link href="/venues">Venues</Link>
                    {user ? <Link href="/dashboard">Dashboard</Link> : <Link href="/for-venues/register">List venue</Link>}
                </nav>
                <div className="md-top-right">
                    <button className="md-iconbtn" aria-label="Search">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                    </button>
                    {user
                        ? <Link href="/dashboard"><div className="md-avatar">{initials}</div></Link>
                        : <Link href="/login" className="md-btn" style={{ padding: "8px 14px", fontSize: 11 }}>Sign in</Link>
                    }
                </div>
            </header>

            {/* Breadcrumb */}
            <div className="md-crumb">
                <Link href="/">Home</Link>
                <span className="sep">/</span>
                <Link href="/matches">Matches</Link>
                <span className="sep">/</span>
                <Link href={`/matches?league=${match.leagueId}`}>{league.name}</Link>
                <span className="sep">/</span>
                <b>{matchTitle}</b>
            </div>

            {/* 2-column layout */}
            <div className="md-page">
                <main className="md-main">

                    {/* ── Hero match card ── */}
                    <section className="md-hero">
                        <div className="md-hero-meta">
                            {isLive && <span className="md-live-chip"><span className="d" />LIVE</span>}
                            {isFinished && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "var(--md-line)", color: "var(--md-fg-dim)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: ".08em" }}>FINISHED</span>}
                            {!isLive && !isFinished && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px", border: "1px solid var(--md-line)", color: "var(--md-fg-dim)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: ".08em" }}>UPCOMING</span>}
                            <span>{league.name}{stageLabel ? ` · ${stageLabel}` : ""} · {dateStr}</span>
                            {match.stadiumName && <span>· {match.stadiumName}</span>}
                            <span style={{ marginLeft: "auto", opacity: 0.5 }}>ID {match.id.toUpperCase().substring(0, 12)}</span>
                        </div>

                        {isSingleEvent ? (
                            /* Single event (motorsport, boxing, etc.) */
                            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ fontFamily: "'Space Grotesk', var(--font-space), sans-serif", fontWeight: 700, fontSize: 40, color: "var(--md-fg)", lineHeight: 1 }}>
                                    {match.eventTitle || league.name}
                                </div>
                                {match.eventSubtitle && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--md-fg-dim)", letterSpacing: ".06em" }}>{match.eventSubtitle}</div>}
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--md-fg-mute)", letterSpacing: ".08em", textTransform: "uppercase" }}>{dateStr} · {timeStr}</div>
                            </div>
                        ) : (
                            /* Head-to-head match */
                            <div className="md-score-wrap">
                                <div className="md-teamcol">
                                    <div className="md-teamrow">
                                        {home?.image
                                            ? <img src={home.image} alt={display.homeName} style={{ width: 72, height: 72, objectFit: "contain" }} />
                                            : <div className="md-crest" style={{ background: homeColor, color: "#fff" }}>{display.homeName.substring(0, 2).toUpperCase()}</div>
                                        }
                                        <div>
                                            <div className="md-t-name">{display.homeName}</div>
                                            <div className="md-t-sub">HOME</div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                                    {isLive || isFinished ? (
                                        <>
                                            <div className="md-score">
                                                <span className={(match.homeScore ?? 0) > (match.awayScore ?? 0) ? "hl" : ""}>{match.homeScore ?? 0}</span>
                                                <span className="sep">:</span>
                                                <span className={(match.awayScore ?? 0) > (match.homeScore ?? 0) ? "hl" : ""}>{match.awayScore ?? 0}</span>
                                            </div>
                                            {isLive && (
                                                <div className="md-minute">
                                                    <div className="m">LIVE<em>'</em></div>
                                                    <div className="h">IN PROGRESS</div>
                                                </div>
                                            )}
                                            {isFinished && (
                                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--md-fg-mute)", letterSpacing: ".1em" }}>FULL TIME</div>
                                            )}
                                        </>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                                            <div style={{ fontFamily: "'Space Grotesk', var(--font-space), sans-serif", fontWeight: 700, fontSize: 48, color: "var(--md-fg-mute)" }}>VS</div>
                                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--md-fg-dim)", letterSpacing: ".06em" }}>{timeStr}</div>
                                        </div>
                                    )}
                                </div>

                                <div className="md-teamcol right">
                                    <div className="md-teamrow">
                                        {away?.image
                                            ? <img src={away.image} alt={display.awayName} style={{ width: 72, height: 72, objectFit: "contain" }} />
                                            : <div className="md-crest" style={{ background: awayColor, color: "#fff" }}>{display.awayName.substring(0, 2).toUpperCase()}</div>
                                        }
                                        <div>
                                            <div className="md-t-name">{display.awayName}</div>
                                            <div className="md-t-sub">AWAY</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="md-hero-foot">
                            <button className="md-btn primary">Join watch party</button>
                            <Link href={`/venues?matchId=${matchId}`} className="md-btn">Find a bar near you</Link>
                            <Link href="/" className="md-btn">← Back to home</Link>
                            {!isSingleEvent && (
                                <Link href={`/matches?league=${match.leagueId}`} className="md-btn" style={{ marginLeft: "auto" }}>
                                    More {league.shortName || league.name} →
                                </Link>
                            )}
                        </div>
                    </section>

                    {/* ── Stats (live/finished only) ── */}
                    {(isLive || isFinished) && !isSingleEvent && (
                        <>
                            <div className="md-sec-head">
                                <div className="md-sec-title">Match stats <span className="tag">{isLive ? "LIVE" : "FT"}</span></div>
                                <div className="md-filters">
                                    {["Overview", "xG", "Passing", "Defense"].map((f) => (
                                        <button key={f} className={`md-filter${f === "Overview" ? " on" : ""}`}>{f}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="md-stats">
                                {[
                                    { label: "Possession", vl: "54%", vr: "46%", lPct: 46, rPct: 54, leadAway: true },
                                    { label: "Shots", vl: "12", vr: "14", lPct: 46, rPct: 54, leadAway: true },
                                    { label: "On target", vl: "6", vr: "4", lPct: 60, rPct: 40, leadAway: false },
                                    { label: "Expected goals (xG)", vl: "1.8", vr: "2.3", lPct: 44, rPct: 56, leadAway: true },
                                    { label: "Corners", vl: "4", vr: "4", lPct: 50, rPct: 50, leadAway: false },
                                ].map(({ label, vl, vr, lPct, rPct, leadAway }) => (
                                    <div key={label} className={`md-stat${leadAway ? " lead-away" : " lead-home"}`}>
                                        <div className="vl">{vl}</div>
                                        <div className="bar">
                                            <div className="l"><i style={{ width: `${lPct}%` }} /></div>
                                            <div className="r"><i style={{ width: `${rPct}%` }} /></div>
                                        </div>
                                        <div className="vr">{vr}</div>
                                        <div className="label">{label}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── Key moments ── */}
                    {(isLive || isFinished) && !isSingleEvent && (
                        <>
                            <div className="md-sec-head">
                                <div className="md-sec-title">Key moments <span className="tag">EVENTS</span></div>
                            </div>
                            <div className="md-events">
                                {match.homeScore || match.awayScore ? (
                                    <>
                                        {(match.homeScore || 0) > 0 && (
                                            <div className="md-event-row goal">
                                                <div className="t">—</div>
                                                <div className="side-home"><b>Goal</b> <span style={{ color: "var(--md-fg-dim)" }}>· {display.homeName}</span></div>
                                                <div className="ic">⚽</div>
                                                <div className="side-away"></div>
                                            </div>
                                        )}
                                        {(match.awayScore || 0) > 0 && (
                                            <div className="md-event-row goal">
                                                <div className="t">—</div>
                                                <div className="side-home"></div>
                                                <div className="ic">⚽</div>
                                                <div className="side-away"><b>Goal</b> <span style={{ color: "var(--md-fg-dim)" }}>· {display.awayName}</span></div>
                                            </div>
                                        )}
                                        <div className="md-event-row">
                                            <div className="t">KO</div>
                                            <div style={{ gridColumn: "2/5", textAlign: "center", color: "var(--md-fg-mute)" }}>Kick-off · {match.stadiumName || "Stadium"}</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="md-event-row">
                                        <div style={{ gridColumn: "1/5", textAlign: "center", color: "var(--md-fg-mute)", padding: "8px 0" }}>No events yet — check back during the match</div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── H2H ── */}
                    {canShowRecap && match.youtubeVideoId && (
                        <>
                            <div className="md-sec-head">
                                <div className="md-sec-title">Match recap <span className="tag">HIGHLIGHTS</span></div>
                            </div>
                            <section style={{ border: "1px solid var(--md-line)", background: "var(--md-bg-1)", overflow: "hidden" }}>
                                <a
                                    href={`https://www.youtube.com/watch?v=${match.youtubeVideoId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: "block", textDecoration: "none", position: "relative" }}
                                >
                                    <img
                                        src={match.youtubeThumbnailUrl || `https://img.youtube.com/vi/${match.youtubeVideoId}/maxresdefault.jpg`}
                                        alt={match.youtubeVideoTitle || `${matchTitle} highlights`}
                                        style={{ width: "100%", display: "block", aspectRatio: "16 / 9", objectFit: "cover", background: "#000" }}
                                    />
                                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <div style={{ width: 68, height: 48, background: "#ff0000", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.92 }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                                        </div>
                                    </div>
                                </a>
                                {(match.youtubeVideoTitle || match.youtubeChannelTitle) && (
                                    <div style={{ display: "grid", gap: 6, padding: "16px 18px", borderTop: "1px solid var(--md-line)" }}>
                                        {match.youtubeVideoTitle && (
                                            <div style={{ fontFamily: "'Space Grotesk', var(--font-space), sans-serif", fontWeight: 600, fontSize: 18, color: "var(--md-fg)" }}>
                                                {match.youtubeVideoTitle}
                                            </div>
                                        )}
                                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--md-fg-mute)" }}>
                                            {match.youtubeChannelTitle || "YouTube"}
                                        </div>
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {!isSingleEvent && (
                        <>
                            <div className="md-sec-head">
                                <div className="md-sec-title">Head to head <span className="tag">LAST 5</span></div>
                            </div>
                            <div className="md-h2h">
                                {[
                                    { dt: "Feb · PL", sc: "3 – 1", cmp: "Away", r: "l" },
                                    { dt: "Dec · PL", sc: "2 – 2", cmp: "Home", r: "d" },
                                    { dt: "Apr · PL", sc: "3 – 1", cmp: "Away", r: "w" },
                                    { dt: "Feb · PL", sc: "1 – 1", cmp: "Home", r: "d" },
                                    { dt: "Oct · PL", sc: "2 – 2", cmp: "Away", r: "d" },
                                ].map(({ dt, sc, cmp, r }, i) => (
                                    <div key={i} className="md-h2h-item">
                                        <div className="dt">{dt}</div>
                                        <div className="sc">{sc}</div>
                                        <div className="cmp">{cmp}</div>
                                        <div className={`r ${r}`}>{r === "w" ? "WIN" : r === "d" ? "DRAW" : "LOSS"}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── Venues map + cards ── */}
                    <div className="md-sec-head">
                        <div className="md-sec-title">
                            Bars showing this match
                            <span className="tag">{venuesToShow.length > 0 ? `${venuesToShow.length} VENUES` : "NEAR YOU"}</span>
                        </div>
                        <div className="md-filters">
                            {["Near me", "Sound on", "Tables open", "Supporters"].map((f) => (
                                <button key={f} className={`md-filter${venueFilter === f ? " on" : ""}`} onClick={() => setVenueFilter(f)}>{f}</button>
                            ))}
                        </div>
                    </div>

                    {/* Map placeholder */}
                    <div className="md-map">
                        {venuesToShow.length > 0
                            ? venuesToShow.slice(0, 5).map((ev, i) => {
                                const positions = [
                                    { left: "30%", top: "45%" }, { left: "64%", top: "38%" },
                                    { left: "42%", top: "72%" }, { left: "76%", top: "62%" },
                                    { left: "22%", top: "78%" },
                                ];
                                const pos = positions[i] || { left: `${20 + i * 15}%`, top: `${40 + i * 10}%` };
                                return (
                                    <div key={ev.venue.id} className="md-pin" style={{ left: pos.left, top: pos.top }}>
                                        <div className="dot" />
                                        <div className="lbl">{ev.venue.name.toUpperCase().substring(0, 14)}</div>
                                    </div>
                                );
                            })
                            : <>
                                <div className="md-pin me" style={{ left: "50%", top: "60%" }}><div className="dot" /><div className="lbl">YOU</div></div>
                                <div className="md-pin" style={{ left: "30%", top: "45%" }}><div className="dot" /><div className="lbl">THE LONG BAR · 87%</div></div>
                                <div className="md-pin" style={{ left: "64%", top: "38%" }}><div className="dot" /><div className="lbl">THE PITCH · 54%</div></div>
                                <div className="md-pin" style={{ left: "42%", top: "72%" }}><div className="dot" /><div className="lbl">OFFSIDE · 92%</div></div>
                                <div className="md-pin" style={{ left: "76%", top: "62%" }}><div className="dot" /><div className="lbl">STOPPAGE TIME · 71%</div></div>
                            </>
                        }
                    </div>

                    {/* Venue cards */}
                    {venuesToShow.length > 0 ? (
                        <div className="md-venues">
                            {venuesToShow.map((ev) => {
                                const v = ev.venue;
                                const spotsLeft = ev.bookingLimit ? ev.bookingLimit - ev.confirmedBookings : null;
                                const pct = ev.bookingLimit ? Math.round((ev.confirmedBookings / ev.bookingLimit) * 100) : 0;
                                return (
                                    <Link key={v.id} href={`/venues/${v.slug || v.id}?matchId=${matchId}`} className="md-venue">
                                        <div className="vt">
                                            <span>{v.city}{v.state ? `, ${v.state}` : ""}</span>
                                            {ev.bookingLimit
                                                ? <span className={pct >= 80 ? "occ" : ""}>{pct}% FULL</span>
                                                : <span style={{ color: "var(--md-accent)" }}>TABLES OPEN</span>
                                            }
                                        </div>
                                        <div className="nm">{v.name}</div>
                                        <div className="desc">
                                            {v.shortDescription || v.amenities?.slice(0, 3).map(a => AMENITY_LABELS[a]?.label || a).join(" · ") || "Sports bar · Watch parties welcome"}
                                        </div>
                                        <div className="vft">
                                            <span>⭐ {v.rating?.toFixed(1) || "4.5"} · {v.amenities?.slice(0, 2).join(" · ") || "SPORTS BAR"}</span>
                                            <span className="res">RESERVE →</span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        /* Fallback venue cards */
                        <div className="md-venues">
                            {[
                                { loc: "UNION ST", fill: "87% FULL", live: true, name: "The Long Bar", desc: "Sound on · 8 screens · Official supporters upstairs. Pints during kickoffs.", tags: "⭐ 4.8 · 312 MATCH NIGHTS" },
                                { loc: "HOBOKEN", fill: "54% FULL", live: false, name: "The Pitch", desc: "Reserved tables for this fixture. 6 screens + projector. Good for groups.", tags: "⭐ 4.7 · SUPPORTERS SC" },
                                { loc: "WILLIAMSBURG", fill: "TABLES OPEN", live: false, name: "Offside", desc: "Neutral ground, quiet corners, full food menu until 1am. Sound on one zone.", tags: "⭐ 4.6 · FOOD · QUIET" },
                            ].map(({ loc, fill, live, name, desc, tags }) => (
                                <Link key={name} href="/venues" className="md-venue">
                                    <div className="vt">
                                        <span>{loc}</span>
                                        {live ? <span className="occ">{fill}</span> : <span style={{ color: fill === "TABLES OPEN" ? "var(--md-accent)" : "var(--md-fg-dim)" }}>{fill}</span>}
                                    </div>
                                    <div className="nm">{name}</div>
                                    <div className="desc">{desc}</div>
                                    <div className="vft"><span>{tags}</span><span className="res">RESERVE →</span></div>
                                </Link>
                            ))}
                        </div>
                    )}
                </main>

                {/* ── Right rail ── */}
                <aside className="md-rail">
                    <h3>Watch parties <span className="n">· {venuesToShow.length > 0 ? venuesToShow.length : "1,284"} in room</span></h3>

                    {[
                        { time: "LIVE", count: "1,284 IN ROOM", title: `${matchTitle} · tactics room`, hc: "JM", host: "Jordan M. · hosting" },
                        { time: "LIVE", count: "412 IN ROOM", title: `${display.homeName || ""} supporters NYC`, hc: "PR", host: "Priya R. · hosting 🔴 loud" },
                        { time: "LIVE", count: "302 IN ROOM", title: `${display.awayName || ""} fans`, hc: "MV", host: "Marco V. · hosting" },
                    ].map(({ time, count, title, hc, host }, i) => (
                        <div key={i} className="md-party">
                            <div className="md-p-head"><span>{time} · LIVE</span><span>{count}</span></div>
                            <div className="md-p-title">{title}</div>
                            <div className="md-p-host"><span className="md-hc">{hc}</span>{host}</div>
                            <button className="md-p-join">Join room →</button>
                        </div>
                    ))}

                    <h4>Live chat · supporters room</h4>
                    <div className="md-chat">
                        <div className="md-msgs">
                            {msgs.map((m, i) => (
                                <div key={i} className="md-msg">
                                    <div className="av" style={{ background: m.av }}>{m.init}</div>
                                    <div>
                                        <span className={`nm${m.host ? " host" : ""}`}>{m.name}{m.host ? " · host" : ""}</span>
                                        <div className="body">{m.body}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="md-reactions">
                            {["🔥", "⚽", "😱", "👏", "💪", "😤"].map((emoji) => (
                                <button key={emoji} onClick={() => setMsgs(prev => [...prev, { av: "#5a4a3a", init: "YOU", name: "You", host: false, body: emoji }])}>{emoji}</button>
                            ))}
                        </div>
                        <div className="md-chat-inp">
                            <input
                                placeholder="Say something…"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendMsg()}
                            />
                            <button className="md-btn primary" style={{ padding: "7px 10px" }} onClick={sendMsg}>Send</button>
                        </div>
                    </div>

                    <h4>Ticket drop · Last minute</h4>
                    <div className="md-ticket">
                        <div className="t-top">
                            <span>{dateStr} · {timeStr}{match.stadiumName ? ` · ${match.stadiumName.split(",")[0]}` : ""}</span>
                            <span className="off">−24%</span>
                        </div>
                        <div className="t-nm">{matchTitle} · Section 114</div>
                        <div className="prices">
                            <span className="p-now">$76</span>
                            <span className="p-was">$100</span>
                            <span className="p-meta">ROW M · BLOCK 114</span>
                        </div>
                        <button className="md-p-join">Grab seat →</button>
                    </div>
                </aside>
            </div>
        </>
    );
}
