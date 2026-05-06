"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import { type League, type Match, type Team } from "../../lib/data";
import { useAuth } from "../../lib/auth-context";
import { useData } from "../../lib/data-provider";
import { isNationalTeamCompetition } from "../../lib/league-utils";
import { getMatchDisplay } from "../../lib/match-display";
import { paginateItems, parsePageParam } from "../../lib/pagination";

/* ── CSS ── */
const MT_VARS = `
:root{
  --mt-bg:#0a0b0d;--mt-bg-1:#101217;--mt-bg-2:#14171d;
  --mt-line:#23272f;--mt-line-2:#2f3540;
  --mt-fg:#f1ece4;--mt-fg-dim:#a8a59d;--mt-fg-mute:#6c6a64;
  --mt-accent:oklch(0.72 0.19 28);--mt-accent-ink:#0a0b0d;
  --mt-win:oklch(0.78 0.16 145);--mt-loss:oklch(0.65 0.2 20);
}
`;

const MT_CSS = `
body{background:var(--mt-bg)!important;color:var(--mt-fg)!important;}
.mt-wrap{min-height:100vh;background:radial-gradient(1200px 600px at 20% -10%,rgba(255,120,60,0.08),transparent 60%),radial-gradient(900px 500px at 100% 10%,rgba(80,180,255,0.05),transparent 60%),var(--mt-bg);}
/* topbar */
.mt-topbar{position:sticky;top:0;z-index:20;display:flex;justify-content:center;padding:10px 16px;}
.mt-topbar-inner{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:1080px;padding:10px 20px;border-radius:999px;background:color-mix(in srgb,#0a0b0d 75%,transparent);backdrop-filter:blur(16px);border:1px solid rgba(35,39,47,0.8);box-shadow:0 2px 20px rgba(0,0,0,0.25);}
.mt-brand{display:flex;flex-direction:column;align-items:flex-start;text-decoration:none;color:var(--mt-fg);}
.mt-brand-name{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:900;font-size:18px;letter-spacing:-0.02em;line-height:1.1;}
.mt-brand-name em{font-style:normal;color:var(--mt-accent);}
.mt-brand-tag{font-family:monospace;font-size:9px;letter-spacing:0.22em;color:var(--mt-accent);font-weight:700;text-transform:uppercase;margin-top:1px;opacity:0.8;}
.mt-nav{display:flex;align-items:center;gap:2px;}
.mt-nav a{padding:7px 14px;border-radius:999px;font-size:13px;font-weight:600;color:var(--mt-fg-dim);transition:all .18s;text-decoration:none;}
.mt-nav a.active,.mt-nav a:hover{background:rgba(255,255,255,0.07);color:var(--mt-fg);}
.mt-top-right{display:flex;gap:8px;align-items:center;}
.mt-btn-pill{display:inline-flex;align-items:center;padding:8px 18px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;background:var(--mt-accent);color:var(--mt-accent-ink);transition:all .18s;}
.mt-btn-pill:hover{opacity:0.88;transform:translateY(-1px);}
.mt-btn-pill.ghost{background:rgba(255,255,255,0.07);color:var(--mt-fg);}
.mt-menu-toggle{display:none;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid var(--mt-line);border-radius:999px;background:rgba(255,255,255,0.04);color:var(--mt-fg);cursor:pointer;}
.mt-mobile-nav{display:none;}
/* crumb */
.mt-crumb{padding:14px 32px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:.08em;color:var(--mt-fg-mute);text-transform:uppercase;border-bottom:1px solid var(--mt-line);}
.mt-crumb a:hover{color:var(--mt-fg);}.mt-crumb .sep{margin:0 8px;color:var(--mt-line-2);}.mt-crumb b{color:var(--mt-fg-dim);font-weight:500;}
/* band */
.mt-band{padding:32px 32px 20px;border-bottom:1px solid var(--mt-line);position:relative;overflow:hidden;}
.mt-band::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);background-size:48px 48px;pointer-events:none;}
.mt-band-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:end;position:relative;z-index:1;}
.mt-kicker{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:.16em;color:var(--mt-fg-mute);text-transform:uppercase;margin-bottom:12px;}
.mt-h1{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:54px;line-height:.95;letter-spacing:-0.025em;margin:0;}
.mt-h1 em{font-style:normal;color:var(--mt-accent);}
.mt-sub{max-width:520px;margin-top:14px;font-size:14px;color:var(--mt-fg-dim);line-height:1.5;}
.mt-band-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:1px solid var(--mt-line);padding-top:16px;}
.mt-bs .lbl{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.14em;color:var(--mt-fg-mute);text-transform:uppercase;margin-bottom:6px;}
.mt-bs .v{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:32px;letter-spacing:-0.02em;line-height:1;}
.mt-bs .v em{font-style:normal;color:var(--mt-accent);}
/* date strip */
.mt-dates{display:flex;gap:0;padding:0 32px;margin-top:16px;border-bottom:1px solid var(--mt-line);overflow-x:auto;}
.mt-dt{flex-shrink:0;padding:14px 20px;border-right:1px solid var(--mt-line);display:flex;flex-direction:column;gap:2px;min-width:92px;cursor:pointer;position:relative;}
.mt-dt:first-child{border-left:1px solid var(--mt-line);}
.mt-dt .d{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mt-fg-mute);}
.mt-dt .n{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:22px;color:var(--mt-fg-dim);letter-spacing:-0.02em;}
.mt-dt .c{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--mt-fg-mute);letter-spacing:.08em;}
.mt-dt.on{background:var(--mt-bg-2);}
.mt-dt.on .d,.mt-dt.on .n{color:var(--mt-fg);}.mt-dt.on .c{color:var(--mt-accent);}
.mt-dt.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--mt-accent);}
.mt-dt.past .n,.mt-dt.past .c{color:var(--mt-fg-mute);}
/* toolbar */
.mt-toolbar{display:flex;justify-content:space-between;align-items:center;padding:16px 32px;gap:16px;flex-wrap:wrap;}
.mt-sports{display:flex;gap:6px;flex-wrap:wrap;}
.mt-sport{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:8px 12px;border:1px solid var(--mt-line);color:var(--mt-fg-dim);cursor:pointer;display:inline-flex;align-items:center;gap:6px;background:none;}
.mt-sport:hover{color:var(--mt-fg);border-color:var(--mt-line-2);}
.mt-sport.on{background:var(--mt-fg);color:var(--mt-bg);border-color:var(--mt-fg);}
.mt-sport .n{color:var(--mt-fg-mute);}.mt-sport.on .n{color:rgba(10,11,13,.55);}
.mt-view-tools{display:flex;gap:12px;align-items:center;}
.mt-search-mini{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--mt-line);min-width:240px;}
.mt-search-mini input{background:transparent;border:0;color:var(--mt-fg);font-family:inherit;font-size:13px;outline:0;flex:1;}
.mt-search-mini input::placeholder{color:var(--mt-fg-mute);}
/* page grid */
.mt-page{display:grid;grid-template-columns:1fr 300px;gap:0;}
.mt-main{padding:8px 32px 60px;min-width:0;}
.mt-rail{border-left:1px solid var(--mt-line);padding:24px;position:sticky;top:61px;height:calc(100vh - 61px);overflow-y:auto;background:linear-gradient(180deg,rgba(255,255,255,.015),transparent 200px);}
/* league section */
.mt-league{margin-bottom:32px;}
.mt-league-hd{display:flex;align-items:center;justify-content:space-between;padding:16px 0 12px;border-bottom:1px solid var(--mt-line);position:sticky;top:61px;background:var(--mt-bg);z-index:5;}
.mt-league-hd .title{display:flex;align-items:center;gap:12px;}
.mt-league-hd .crest{width:28px;height:28px;display:grid;place-items:center;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:12px;border:1px solid var(--mt-line-2);color:#fff;}
.mt-league-hd h2{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:18px;margin:0;letter-spacing:-0.01em;}
.mt-league-hd .region{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.1em;color:var(--mt-fg-mute);text-transform:uppercase;margin-left:4px;}
.mt-league-hd .acts{display:flex;gap:10px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mt-fg-dim);}
.mt-league-hd .acts a:hover{color:var(--mt-fg);}
/* match row */
.mt-match{display:grid;grid-template-columns:96px 1fr 120px 1fr 130px 150px;gap:14px;padding:14px 10px;align-items:center;border-bottom:1px dashed var(--mt-line);cursor:pointer;transition:background .14s;text-decoration:none;color:inherit;}
.mt-match:hover{background:var(--mt-bg-1);}
.mt-match:last-child{border-bottom:0;}
.mt-match.featured{background:linear-gradient(90deg,rgba(255,120,60,0.06),transparent 40%);border-left:2px solid var(--mt-accent);padding-left:14px;}
.mt-match.ft .mt-tm .big,.mt-match.ft .mt-tm .s{color:var(--mt-fg-mute);}
.mt-match.ft .mt-score{color:var(--mt-fg-mute);}
.mt-tm{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:12px;color:var(--mt-fg);display:flex;flex-direction:column;gap:2px;}
.mt-tm .big{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:16px;letter-spacing:-0.01em;}
.mt-tm .s{font-size:9px;letter-spacing:.1em;color:var(--mt-fg-mute);text-transform:uppercase;}
.mt-home{display:flex;align-items:center;justify-content:flex-end;gap:12px;min-width:0;}
.mt-away{display:flex;align-items:center;justify-content:flex-start;gap:12px;min-width:0;}
.mt-team-name{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:500;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mt-team-name.bold{font-weight:700;}
.mt-form{display:flex;gap:3px;}
.mt-form i{width:6px;height:6px;border-radius:50%;display:inline-block;}
.mt-form i.w{background:var(--mt-win);}.mt-form i.d{background:var(--mt-line-2);}.mt-form i.l{background:var(--mt-loss);}
.mt-tc{width:32px;height:32px;display:grid;place-items:center;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:11px;color:#fff;flex-shrink:0;overflow:hidden;}
.mt-tc img{width:28px;height:28px;object-fit:contain;}
.mt-league-hd .crest img{width:24px;height:24px;object-fit:contain;}
/* league filter bar */
.mt-league-bar{display:flex;gap:6px;padding:10px 32px 12px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--mt-line);flex-wrap:nowrap;}
.mt-league-bar::-webkit-scrollbar{display:none;}
.mt-league-pill{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border:1px solid var(--mt-line);color:var(--mt-fg-dim);font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;background:none;transition:all .14s;white-space:nowrap;flex-shrink:0;}
.mt-league-pill:hover{color:var(--mt-fg);border-color:var(--mt-line-2);}
.mt-league-pill.on{border-color:var(--mt-accent);color:var(--mt-accent);background:rgba(255,95,45,0.07);}
.mt-league-pill img{width:18px;height:18px;object-fit:contain;}
.mt-league-pill .pill-n{color:var(--mt-fg-mute);font-size:10px;margin-left:2px;}
.mt-league-pill.on .pill-n{color:var(--mt-accent);opacity:0.7;}
.mt-score{text-align:center;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:22px;letter-spacing:-0.02em;}
.mt-score .sep{color:var(--mt-fg-mute);margin:0 6px;font-weight:400;}
.mt-vs{text-align:center;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--mt-fg-mute);letter-spacing:.1em;}
.mt-venue{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--mt-fg-mute);letter-spacing:.06em;text-transform:uppercase;line-height:1.5;}
.mt-act{display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap;}
.mt-act button,.mt-act a{padding:7px 9px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--mt-line);color:var(--mt-fg-dim);background:none;cursor:pointer;text-decoration:none;}
.mt-act button:hover,.mt-act a:hover{border-color:var(--mt-fg-dim);color:var(--mt-fg);}
.mt-act .join{background:var(--mt-accent);color:var(--mt-accent-ink);border-color:var(--mt-accent);font-weight:600;}
/* right rail */
.mt-rail h3{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:15px;margin:0 0 12px;display:flex;align-items:center;gap:8px;}
.mt-rail h3 .n{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--mt-fg-mute);font-weight:400;}
.mt-rail h4{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mt-fg-mute);margin:24px 0 10px;font-weight:500;}
.mt-mini{border:1px solid var(--mt-line);background:var(--mt-bg-1);padding:12px;margin-bottom:8px;cursor:pointer;text-decoration:none;display:block;color:inherit;}
.mt-mini:hover{border-color:var(--mt-line-2);}
.mt-mini.big{border-color:var(--mt-accent);}
.mt-mini .mh{display:flex;justify-content:space-between;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:.1em;color:var(--mt-fg-mute);text-transform:uppercase;margin-bottom:8px;}
.mt-mini .mh .m{color:var(--mt-accent);font-weight:600;}
.mt-mini .row{display:grid;grid-template-columns:20px 1fr auto;gap:10px;align-items:center;padding:2px 0;font-size:13px;}
.mt-mini .tc2{width:20px;height:20px;display:grid;place-items:center;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:9px;color:#fff;}
.mt-mini .nm{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:500;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mt-mini .sc{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:16px;font-size:11px;color:var(--mt-fg-mute);}
.mt-mini .foot{display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px dashed var(--mt-line);font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;color:var(--mt-fg-mute);letter-spacing:.08em;text-transform:uppercase;}
.mt-mini .foot .bars{color:var(--mt-accent);}
.mt-follow{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--mt-line);margin-bottom:6px;font-size:13px;cursor:pointer;text-decoration:none;color:inherit;}
.mt-follow:hover{border-color:var(--mt-line-2);}
.mt-follow .tc3{width:26px;height:26px;display:grid;place-items:center;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:10px;color:#fff;flex-shrink:0;}
.mt-follow .nm{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:500;font-size:13px;}
.mt-follow .nx{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--mt-fg-mute);letter-spacing:.06em;margin-left:auto;text-transform:uppercase;white-space:nowrap;}
.mt-load-more{padding:18px;border:1px dashed var(--mt-line);text-align:center;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:12px;letter-spacing:.08em;color:var(--mt-fg-dim);text-transform:uppercase;margin-top:20px;display:block;cursor:pointer;}
.mt-empty{text-align:center;padding:60px 20px;border:1px dashed var(--mt-line);font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:12px;color:var(--mt-fg-mute);letter-spacing:.08em;text-transform:uppercase;}
@media(max-width:1100px){.mt-page{grid-template-columns:1fr;}.mt-rail{display:none;}.mt-band-grid{grid-template-columns:1fr;}}
@media(max-width:900px){.mt-topbar{padding:8px 10px;}.mt-topbar-inner{max-width:none;border-radius:18px;padding:9px 10px;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px 8px;align-items:center;}.mt-brand{min-width:0;}.mt-brand-tag{display:none;}.mt-nav{display:none;}.mt-top-right{grid-column:2;grid-row:1;display:flex;gap:6px;}.mt-menu-toggle{display:inline-flex;grid-column:3;grid-row:1;justify-self:end;}.mt-mobile-nav{grid-column:1/-1;grid-row:2;display:none;flex-direction:column;gap:8px;padding-top:8px;}.mt-mobile-nav.open{display:flex;}.mt-mobile-nav a{padding:12px 14px;border-radius:12px;font-size:14px;font-weight:700;color:var(--mt-fg);background:rgba(255,255,255,0.04);text-decoration:none;transition:all .18s;white-space:nowrap;}.mt-mobile-nav a.active,.mt-mobile-nav a:hover{background:rgba(255,255,255,0.08);color:var(--mt-fg);}.mt-mobile-nav .primary{background:var(--mt-accent);color:var(--mt-accent-ink);}.mt-btn-pill{padding:8px 12px;font-size:12px;white-space:nowrap;}.mt-list-venue-btn{display:none;}.mt-match{grid-template-columns:80px 1fr 80px 1fr;}.mt-venue,.mt-act{display:none;}.mt-league-hd{top:64px;}.mt-search-mini{min-width:120px;}}
@media(max-width:640px){.mt-match{grid-template-columns:64px 1fr 64px 1fr;}.mt-h1{font-size:32px;}.mt-band{padding:20px 16px;}.mt-dates{padding:0 12px;}.mt-toolbar{padding:12px 16px;flex-direction:column;align-items:flex-start;}.mt-view-tools{width:100%;}.mt-search-mini{min-width:0;width:100%;}.mt-list{padding:16px 16px 60px;}.mt-crumb{padding:10px 16px;}}
`;

/* ── Helpers ── */
function asTimestamp(value: string) {
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
}
function toUtcDateKey(value: string) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "";
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function isLive(s: Match["status"]) { return s === "IN_PLAY" || s === "PAUSED"; }
function isUpcoming(s: Match["status"]) { return s === "SCHEDULED" || s === "TIMED"; }
function isFinished(s: Match["status"]) { return s === "FINISHED"; }

function formatRelDay(key: string, today: string) {
    const diff = Math.round((new Date(`${key}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short" });
}

function formatBoardTime(value: string, todayKey: string) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "--:--";
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const matchKey = toUtcDateKey(value);
    if (matchKey === todayKey) return time;
    return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
}

function getToken(team?: Team, fallback?: string) {
    const s = team?.shortName?.trim();
    if (s) return s.slice(0, 3).toUpperCase();
    const src = (fallback || "").trim();
    if (!src) return "MW";
    const words = src.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

function compareMatches(a: Match, b: Match) {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    const al = isLive(a.status), bl = isLive(b.status);
    if (al && !bl) return -1; if (!al && bl) return 1;
    const af = isFinished(a.status), bf = isFinished(b.status);
    const ta = asTimestamp(a.matchDateUTC), tb = asTimestamp(b.matchDateUTC);
    if (af && bf) return tb - ta;
    return ta - tb;
}

function MatchRow({ match, league, home, away, todayKey }: { match: Match; league?: League; home?: Team; away?: Team; todayKey: string }) {
    const router = useRouter();
    const d = getMatchDisplay(match, { homeTeam: home, awayTeam: away, league });
    const live = isLive(match.status), fin = isFinished(match.status);
    const isSingle = d.isSingleEvent;
    const timePrimary = fin ? "FT" : live ? "LIVE" : formatBoardTime(match.matchDateUTC, todayKey);
    const timeSub = live ? "IN PLAY" : fin ? "RESULT" : "UPCOMING";
    const homeColor = home?.color || "#555";
    const awayColor = away?.color || "#334";
    const matchHref = `/matches/${match.id}`;

    return (
        <article
            className={`mt-match${match.isFeatured ? " featured" : ""}${fin ? " ft" : ""}`}
            role="link"
            tabIndex={0}
            onClick={() => router.push(matchHref)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(matchHref);
                }
            }}
        >
            <div className="mt-tm">
                <span className="big">{timePrimary}</span>
                <span className="s">{timeSub}</span>
            </div>

            <div className="mt-home">
                <span className={`mt-team-name${match.isFeatured ? " bold" : ""}`}>
                    {isSingle ? d.title : d.homeName}
                </span>
                <div className="mt-tc" style={{ background: home?.image ? "transparent" : homeColor }}>
                    {home?.image
                        ? <img src={home.image} alt={d.homeName} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        : getToken(home, d.homeName)
                    }
                </div>
            </div>

            <div>
                {fin || live
                    ? <div className="mt-score"><span>{match.homeScore ?? "-"}</span><span className="sep">:</span><span>{match.awayScore ?? "-"}</span></div>
                    : <div className="mt-vs">{isSingle ? "EVENT" : "VS"}</div>
                }
            </div>

            <div className="mt-away">
                {!isSingle && (
                    <>
                        <div className="mt-tc" style={{ background: away?.image ? "transparent" : awayColor }}>
                            {away?.image
                                ? <img src={away.image} alt={d.awayName} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                : getToken(away, d.awayName)
                            }
                        </div>
                        <span className={`mt-team-name${match.isFeatured ? " bold" : ""}`}>{d.awayName}</span>
                    </>
                )}
                {isSingle && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--mt-fg-dim)", letterSpacing: ".06em" }}>
                        {league?.name || "Event"}
                    </span>
                )}
            </div>

            <div className="mt-venue">
                {match.stadiumName || league?.country || "—"}<br />
                {match.matchDay ? `MD ${match.matchDay}` : (match.stage || league?.shortName || "")}
            </div>

            <div className="mt-act">
                {!fin && <button type="button" onClick={e => e.stopPropagation()}>REMIND</button>}
                {fin && <button type="button" onClick={e => e.stopPropagation()}>HIGHLIGHTS</button>}
                <Link
                    href={matchHref}
                    className={`join${(match.venueCount ?? 0) > 0 ? "" : ""}`}
                    onClick={e => e.stopPropagation()}
                >
                    BARS · {match.venueCount ?? 0}
                </Link>
            </div>
        </article>
    );
}

function MiniCard({ match, league, home, away, todayKey, hot }: { match: Match; league?: League; home?: Team; away?: Team; todayKey: string; hot?: boolean }) {
    const d = getMatchDisplay(match, { homeTeam: home, awayTeam: away, league });
    const homeColor = home?.color || "#555";
    const awayColor = away?.color || "#334";
    const time = formatBoardTime(match.matchDateUTC, todayKey);
    return (
        <Link href={`/matches/${match.id}`} className={`mt-mini${hot ? " big" : ""}`}>
            <div className="mh">
                <span className={hot ? "m" : ""}>{time}</span>
                <span>{league?.shortName || "MATCH"}</span>
            </div>
            <div className="row">
                <div className="tc2" style={{ background: homeColor }}>{getToken(home, d.homeName)}</div>
                <div className="nm">{d.isSingleEvent ? d.title : d.homeName}</div>
                <div className="sc">vs</div>
            </div>
            {!d.isSingleEvent && (
                <div className="row">
                    <div className="tc2" style={{ background: awayColor }}>{getToken(away, d.awayName)}</div>
                    <div className="nm">{d.awayName}</div>
                    <div className="sc">{formatBoardTime(match.matchDateUTC, todayKey)}</div>
                </div>
            )}
            <div className="foot">
                <span>{match.stadiumName || league?.country || "Venue"}</span>
                <span className="bars">{(match.venueCount ?? 0)} BARS</span>
            </div>
        </Link>
    );
}

function MatchesPageContent() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { matches: MATCHES, leagues, sports, teams, venueEvents, getTeam, getLeague } = useData();
    const { user } = useAuth();

    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const [selectedSportId, setSelectedSportId] = React.useState<string | null>(null);
    const [selectedLeagueId, setSelectedLeagueId] = React.useState<string | null>(() => searchParams.get("league"));
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedDateKey, setSelectedDateKey] = React.useState<string | null>(null);
    const [includePast, setIncludePast] = React.useState(false);

    const requestedPage = parsePageParam(searchParams.get("page"));
    const hasInitReset = React.useRef(false);
    const hasSportInitReset = React.useRef(false);
    const [renderNow] = React.useState(() => Date.now());
    const nowKey = React.useMemo(() => toUtcDateKey(new Date(renderNow).toISOString()), [renderNow]);

    const syncPage = React.useCallback((n: number) => {
        const p = new URLSearchParams(searchParams.toString());
        if (n <= 1) p.delete("page"); else p.set("page", String(n));
        const q = p.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }, [pathname, router, searchParams]);

    const baseMatches = React.useMemo(() => {
        const threshold = renderNow - 2 * 60 * 60 * 1000;
        return MATCHES.filter(m => {
            if (isNationalTeamCompetition(getLeague(m.leagueId))) return false;
            if (includePast) return true;
            const ts = asTimestamp(m.matchDateUTC);
            return isLive(m.status) || (isUpcoming(m.status) && ts >= threshold) || isFinished(m.status);
        });
    }, [MATCHES, includePast, renderNow, getLeague]);

    const availableSports = React.useMemo(() => {
        const leagueIds = new Set(baseMatches.map(m => m.leagueId));
        const sportIds = new Set(leagues.filter(l => leagueIds.has(l.id)).map(l => l.sportId || "soccer"));
        return sports.filter(s => sportIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
    }, [baseMatches, leagues, sports]);

    const sportCounts = React.useMemo(() => {
        const c = new Map<string, number>();
        for (const m of baseMatches) {
            const l = getLeague(m.leagueId);
            const sid = l?.sportId || "soccer";
            c.set(sid, (c.get(sid) || 0) + 1);
        }
        return c;
    }, [baseMatches, getLeague]);

    const availableLeagues = React.useMemo(() => {
        const leagueIds = new Set(
            baseMatches
                .filter(m => !selectedSportId || (getLeague(m.leagueId)?.sportId || "soccer") === selectedSportId)
                .map(m => m.leagueId)
        );
        return leagues.filter(l => leagueIds.has(l.id)).sort((a, b) => a.name.localeCompare(b.name));
    }, [baseMatches, selectedSportId, leagues, getLeague]);

    const leagueCounts = React.useMemo(() => {
        const c = new Map<string, number>();
        for (const m of baseMatches) {
            const l = getLeague(m.leagueId);
            if (!selectedSportId || (l?.sportId || "soccer") === selectedSportId)
                c.set(m.leagueId, (c.get(m.leagueId) || 0) + 1);
        }
        return c;
    }, [baseMatches, selectedSportId, getLeague]);

    // Reset league when sport changes
    React.useEffect(() => {
        if (!hasSportInitReset.current) {
            hasSportInitReset.current = true;
            return;
        }
        setSelectedLeagueId(null);
    }, [selectedSportId]);

    const filtered = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return baseMatches.filter(m => {
            const l = getLeague(m.leagueId);
            const h = m.homeTeamId ? getTeam(m.homeTeamId) : undefined;
            const a = m.awayTeamId ? getTeam(m.awayTeamId) : undefined;
            const d = getMatchDisplay(m, { homeTeam: h, awayTeam: a, league: l });
            const sportOK = !selectedSportId || (l?.sportId || "soccer") === selectedSportId;
            const leagueOK = !selectedLeagueId || m.leagueId === selectedLeagueId;
            const dateOK = !selectedDateKey || toUtcDateKey(m.matchDateUTC) === selectedDateKey;
            const queryOK = !q || [l?.name, d.homeName, d.awayName, d.title, m.stadiumName, m.stage].filter(Boolean).join(" ").toLowerCase().includes(q);
            return sportOK && leagueOK && dateOK && queryOK;
        }).sort(compareMatches);
    }, [baseMatches, selectedSportId, selectedLeagueId, selectedDateKey, searchQuery, getLeague, getTeam]);

    const { currentPage, totalPages, pageItems: paginatedMatches } = React.useMemo(
        () => paginateItems(filtered, requestedPage, 40),
        [filtered, requestedPage]
    );

    React.useEffect(() => {
        if (requestedPage !== currentPage) syncPage(currentPage);
    }, [requestedPage, currentPage, syncPage]);

    React.useEffect(() => {
        if (!hasInitReset.current) { hasInitReset.current = true; return; }
        syncPage(1);
    }, [selectedSportId, selectedLeagueId, selectedDateKey, searchQuery, syncPage]);

    const dateChips = React.useMemo(() => {
        const counts = new Map<string, { key: string; upcoming: number; finished: number }>();
        for (const m of baseMatches) {
            const key = toUtcDateKey(m.matchDateUTC);
            if (!key) continue;
            const e = counts.get(key) || { key, upcoming: 0, finished: 0 };
            if (isLive(m.status) || isUpcoming(m.status)) e.upcoming++;
            if (isFinished(m.status)) e.finished++;
            counts.set(key, e);
        }
        return Array.from(counts.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(0, 10);
    }, [baseMatches]);

    const groupedMatches = React.useMemo(() => {
        const groups = new Map<string, { league: League | undefined; matches: Match[] }>();
        for (const m of paginatedMatches) {
            const l = getLeague(m.leagueId);
            const ex = groups.get(m.leagueId);
            if (ex) ex.matches.push(m);
            else groups.set(m.leagueId, { league: l, matches: [m] });
        }
        return Array.from(groups.values());
    }, [paginatedMatches, getLeague]);

    const upcomingRail = React.useMemo(() =>
        filtered.filter(m => isLive(m.status) || isUpcoming(m.status)).slice(0, 3),
        [filtered]
    );
    const featuredRail = React.useMemo(() =>
        filtered.filter(m => m.isFeatured || m.isHot || (m.venueCount ?? 0) > 0).slice(0, 3),
        [filtered]
    );

    const heroUpcoming = filtered.filter(m => isLive(m.status) || isUpcoming(m.status)).length;
    const heroPlayed = filtered.filter(m => isFinished(m.status)).length;
    const heroWeek = filtered.length;

    const todayDateObj = new Date(`${nowKey}T00:00:00Z`);
    const todayLabel = todayDateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    return (
        <div className="mt-wrap">
            <style dangerouslySetInnerHTML={{ __html: MT_VARS + MT_CSS }} />

            {/* Topbar */}
            <header className="mt-topbar">
                <div className="mt-topbar-inner">
                    <Link href="/" className="mt-brand">
                        <div className="mt-brand-name">match<em>watch</em></div>
                        <div className="mt-brand-tag">Watchparty Hub</div>
                    </Link>
                    <nav className="mt-nav">
                        <Link href="/">Home</Link>
                        <Link href="/matches" className="active">Matches</Link>
                        <Link href="/world-cup">World Cup</Link>
                        <Link href="/venues">Venues</Link>
                        <Link href="/for-venues">For venues</Link>
                    </nav>
                    <button
                        type="button"
                        className="mt-menu-toggle"
                        aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                        aria-expanded={mobileMenuOpen}
                        onClick={() => setMobileMenuOpen((open) => !open)}
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                    <nav className={`mt-mobile-nav${mobileMenuOpen ? " open" : ""}`}>
                        <Link href="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
                        <Link href="/matches" className="active" onClick={() => setMobileMenuOpen(false)}>Matches</Link>
                        <Link href="/world-cup" onClick={() => setMobileMenuOpen(false)}>World Cup</Link>
                        <Link href="/venues" onClick={() => setMobileMenuOpen(false)}>Venues</Link>
                        <Link href="/for-venues" onClick={() => setMobileMenuOpen(false)}>For venues</Link>
                        {user ? (
                            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>My bookings</Link>
                        ) : (
                            <>
                                <Link href="/for-venues/register" onClick={() => setMobileMenuOpen(false)}>List venue</Link>
                                <Link href="/login" className="primary" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
                            </>
                        )}
                    </nav>
                    <div className="mt-top-right">
                        {user
                            ? <Link href="/dashboard" className="mt-btn-pill ghost">{user.name?.split(" ")[0]}</Link>
                            : <>
                                <Link href="/for-venues/register" className="mt-btn-pill ghost mt-list-venue-btn">List venue</Link>
                                <Link href="/login" className="mt-btn-pill">Log in</Link>
                              </>
                        }
                    </div>
                </div>
            </header>

            {/* Crumb */}
            <div className="mt-crumb">
                <Link href="/">Home</Link><span className="sep">/</span><b>Matches</b>
            </div>

            {/* Band */}
            <section className="mt-band">
                <div className="mt-band-grid">
                    <div>
                        <div className="mt-kicker">{todayLabel} · {filtered.length} matches · {availableSports.length} sports</div>
                        <h1 className="mt-h1">Every match. <em>Every bar.</em><br />Plan your week.</h1>
                        <p className="mt-sub">Browse every upcoming fixture and recent result, find the best bar to watch it at, and lock in your table before the rush.</p>
                    </div>
                    <div className="mt-band-stats">
                        <div className="mt-bs"><div className="lbl">Upcoming today</div><div className="v">{heroUpcoming}</div></div>
                        <div className="mt-bs"><div className="lbl">Played</div><div className="v">{heroPlayed}</div></div>
                        <div className="mt-bs"><div className="lbl">This week</div><div className="v"><em>{heroWeek}</em></div></div>
                    </div>
                </div>
            </section>

            {/* Date strip */}
            <div className="mt-dates">
                {dateChips.map(chip => {
                    const active = selectedDateKey === chip.key;
                    const past = chip.key < nowKey;
                    const isToday = chip.key === nowKey;
                    return (
                        <div
                            key={chip.key}
                            className={`mt-dt${active ? " on" : ""}${past ? " past" : ""}`}
                            onClick={() => setSelectedDateKey(active ? null : chip.key)}
                        >
                            <div className="d">{isToday ? "Today · " : ""}{formatRelDay(chip.key, nowKey)}</div>
                            <div className="n">{new Date(`${chip.key}T00:00:00Z`).getUTCDate()}</div>
                            <div className="c">
                                {chip.upcoming > 0 ? `${chip.upcoming} UPCOMING` : `${chip.finished} PLAYED`}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* League filter bar */}
            {availableLeagues.length > 1 && (
                <div className="mt-league-bar">
                    {availableLeagues.map(l => (
                        <button
                            key={l.id}
                            className={`mt-league-pill${selectedLeagueId === l.id ? " on" : ""}`}
                            onClick={() => setSelectedLeagueId(prev => prev === l.id ? null : l.id)}
                        >
                            {l.image && <img src={l.image} alt={l.name} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                            {l.shortName || l.name}
                            <span className="pill-n">{leagueCounts.get(l.id) || 0}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Toolbar */}
            <div className="mt-toolbar">
                <div className="mt-sports">
                    <button
                        className={`mt-sport${selectedSportId === null ? " on" : ""}`}
                        onClick={() => setSelectedSportId(null)}
                    >
                        All <span className="n">{baseMatches.length}</span>
                    </button>
                    {availableSports.map(s => (
                        <button
                            key={s.id}
                            className={`mt-sport${selectedSportId === s.id ? " on" : ""}`}
                            onClick={() => setSelectedSportId(prev => prev === s.id ? null : s.id)}
                        >
                            {s.shortName || s.name} <span className="n">{sportCounts.get(s.id) || 0}</span>
                        </button>
                    ))}
                </div>
                <div className="mt-view-tools">
                    <div className="mt-search-mini">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ color: "var(--mt-fg-mute)" }}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                        <input
                            placeholder="Team, league, venue…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Page grid */}
            <main className="mt-page">
                <section className="mt-main">
                    {filtered.length === 0 ? (
                        <div className="mt-empty">No matches found — try clearing filters</div>
                    ) : (
                        <>
                            {groupedMatches.map(({ league, matches }) => (
                                <div key={league?.id || matches[0]?.leagueId} className="mt-league">
                                    <div className="mt-league-hd">
                                        <div className="title">
                                            <div className="crest" style={{ background: league?.image ? "transparent" : "#23272f" }}>
                                                {league?.image
                                                    ? <img src={league.image} alt={league.name} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                                    : (league?.logo || league?.shortName || "MW").substring(0, 2).toUpperCase()
                                                }
                                            </div>
                                            <h2>{league?.name || "League"}</h2>
                                            <span className="region">{league?.country || "Global"}</span>
                                        </div>
                                        <div className="acts">
                                            <Link href={`/matches?league=${league?.id}`}>All fixtures →</Link>
                                        </div>
                                    </div>
                                    {matches.map(m => (
                                        <MatchRow
                                            key={m.id}
                                            match={m}
                                            league={league}
                                            home={m.homeTeamId ? getTeam(m.homeTeamId) : undefined}
                                            away={m.awayTeamId ? getTeam(m.awayTeamId) : undefined}
                                            todayKey={nowKey}
                                        />
                                    ))}
                                </div>
                            ))}
                            {totalPages > 1 && (
                                <div style={{ display: "flex", gap: 6, padding: "20px 0", justifyContent: "center" }}>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => syncPage(p)}
                                            style={{
                                                padding: "7px 12px",
                                                fontFamily: "'JetBrains Mono', monospace",
                                                fontSize: 11,
                                                letterSpacing: ".06em",
                                                border: "1px solid var(--mt-line)",
                                                background: p === currentPage ? "var(--mt-accent)" : "none",
                                                color: p === currentPage ? "var(--mt-accent-ink)" : "var(--mt-fg-dim)",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </section>

                {/* Rail */}
                <aside className="mt-rail">
                    <h3>Coming up next <span className="n">· {upcomingRail.length} soon</span></h3>
                    {upcomingRail.map(m => (
                        <MiniCard
                            key={m.id} match={m}
                            league={getLeague(m.leagueId)}
                            home={m.homeTeamId ? getTeam(m.homeTeamId) : undefined}
                            away={m.awayTeamId ? getTeam(m.awayTeamId) : undefined}
                            todayKey={nowKey}
                        />
                    ))}

                    {featuredRail.length > 0 && (
                        <>
                            <h4>Big matches this week</h4>
                            {featuredRail.map(m => (
                                <MiniCard
                                    key={m.id} match={m}
                                    league={getLeague(m.leagueId)}
                                    home={m.homeTeamId ? getTeam(m.homeTeamId) : undefined}
                                    away={m.awayTeamId ? getTeam(m.awayTeamId) : undefined}
                                    todayKey={nowKey}
                                    hot
                                />
                            ))}
                        </>
                    )}

                    {upcomingRail.length > 0 && (
                        <>
                            <h4>Following · matches today</h4>
                            {upcomingRail.map(m => {
                                const h = m.homeTeamId ? getTeam(m.homeTeamId) : undefined;
                                const l = getLeague(m.leagueId);
                                const d = getMatchDisplay(m, { homeTeam: h, awayTeam: m.awayTeamId ? getTeam(m.awayTeamId) : undefined, league: l });
                                return (
                                    <Link key={m.id} href={`/matches/${m.id}`} className="mt-follow">
                                        <div className="tc3" style={{ background: h?.color || "#555" }}>{getToken(h, d.homeName)}</div>
                                        <span className="nm">{d.isSingleEvent ? d.title : d.homeName}</span>
                                        <span className="nx">{formatBoardTime(m.matchDateUTC, nowKey)}</span>
                                    </Link>
                                );
                            })}
                        </>
                    )}
                </aside>
            </main>
        </div>
    );
}

export default function MatchesPage() {
    return (
        <React.Suspense fallback={
            <div style={{ background: "#0a0b0d", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6c6a64", fontFamily: "monospace", fontSize: 13 }}>
                Loading matches…
            </div>
        }>
            <MatchesPageContent />
        </React.Suspense>
    );
}
