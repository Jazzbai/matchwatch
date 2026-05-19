"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useData, type Venue } from "../../lib/data-provider";
import { useAuth } from "../../lib/auth-context";
import { AMENITY_LABELS } from "../../lib/data";
import { paginateItems, parsePageParam } from "../../lib/pagination";
import { MatchVenueMap } from "../../components/MatchVenueMap";
import { FloatingNav } from "../../components/AppShell";

/* ── CSS ── */
const VN_VARS = `
:root{
  --vn-bg:var(--background);--vn-bg-1:var(--card);--vn-bg-2:var(--card);--vn-bg-3:var(--secondary);
  --vn-line:var(--border);--vn-line-2:var(--border);
  --vn-fg:var(--foreground);--vn-fg-dim:var(--muted-foreground);--vn-fg-mute:var(--muted-foreground);
  --vn-accent:oklch(0.72 0.19 28);--vn-accent-ink:#0a0b0d;
  --vn-live:oklch(0.78 0.14 200);
}
`;

const VN_CSS = `
body{background:var(--vn-bg)!important;color:var(--vn-fg)!important;}
.vn-wrap{min-height:100vh;background:radial-gradient(1200px 600px at 20% -10%,rgba(255,120,60,0.08),transparent 60%),radial-gradient(900px 500px at 100% 10%,rgba(80,180,255,0.05),transparent 60%),var(--vn-bg);}
/* topbar */
.vn-topbar{display:none!important;}
.vn-topbar-inner{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:920px;padding:10px 20px;border-radius:999px;background:color-mix(in srgb,#0a0b0d 75%,transparent);backdrop-filter:blur(16px);border:1px solid rgba(35,39,47,0.8);box-shadow:0 2px 20px rgba(0,0,0,0.25);}
.vn-brand{display:flex;flex-direction:column;align-items:flex-start;text-decoration:none;color:var(--vn-fg);}
.vn-brand-name{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:900;font-size:18px;letter-spacing:-0.02em;line-height:1.1;}
.vn-brand-name em{font-style:normal;color:var(--vn-accent);}
.vn-brand-tag{font-family:monospace;font-size:9px;letter-spacing:0.22em;color:var(--vn-accent);font-weight:700;text-transform:uppercase;margin-top:1px;opacity:0.8;}
.vn-nav{display:flex;align-items:center;gap:2px;}
.vn-nav a{padding:7px 14px;border-radius:999px;font-size:13px;font-weight:600;color:var(--vn-fg-dim);transition:all .18s;text-decoration:none;}
.vn-nav a.active,.vn-nav a:hover{background:rgba(255,255,255,0.07);color:var(--vn-fg);}
.vn-top-right{display:flex;gap:8px;align-items:center;}
.vn-btn-pill{display:inline-flex;align-items:center;padding:8px 18px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;background:var(--vn-accent);color:var(--vn-accent-ink);transition:all .18s;}
.vn-btn-pill:hover{opacity:0.88;transform:translateY(-1px);}
.vn-btn-pill.ghost{background:rgba(255,255,255,0.07);color:var(--vn-fg);}
.vn-menu-toggle{display:none;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid var(--vn-line);border-radius:999px;background:rgba(255,255,255,0.04);color:var(--vn-fg);cursor:pointer;}
.vn-mobile-nav{display:none;}
/* crumb */
.vn-crumb{max-width:1440px;margin-inline:auto;padding:14px clamp(16px,4vw,32px);font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:.08em;color:var(--vn-fg-mute);text-transform:uppercase;border-bottom:1px solid var(--vn-line);}
.vn-crumb a:hover{color:var(--vn-fg);}.vn-crumb .sep{margin:0 8px;color:var(--vn-line-2);}.vn-crumb b{color:var(--vn-fg-dim);font-weight:500;}
/* band */
.vn-band{max-width:1440px;margin-inline:auto;padding:36px clamp(16px,4vw,32px) 48px;border-bottom:1px solid var(--vn-line);position:relative;overflow:hidden;}
.vn-band::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);background-size:48px 48px;pointer-events:none;}
.vn-band-grid{display:grid;grid-template-columns:1.3fr .9fr;gap:48px;align-items:end;position:relative;z-index:1;}
.vn-kicker{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:.16em;color:var(--vn-fg-mute);text-transform:uppercase;margin-bottom:14px;}
.vn-h1{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:54px;line-height:.95;letter-spacing:-0.025em;margin:0;}
.vn-h1 em{font-style:normal;color:var(--vn-accent);}
.vn-sub{max-width:520px;margin-top:18px;font-size:15px;color:var(--vn-fg-dim);line-height:1.5;}
.vn-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:1px solid var(--vn-line);padding-top:18px;}
.vn-metric .lbl{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.14em;color:var(--vn-fg-mute);text-transform:uppercase;margin-bottom:6px;}
.vn-metric .v{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:30px;color:var(--vn-fg);line-height:1;}
.vn-metric .v em{font-style:normal;color:var(--vn-accent);}
/* search bar */
.vn-search-wrap{max-width:1440px;margin-inline:auto;padding:0 clamp(16px,4vw,32px);margin-top:-28px;position:relative;z-index:2;}
.vn-search{background:var(--vn-bg-2);border:1px solid var(--vn-line-2);border-radius:14px;padding:8px;display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:8px;align-items:center;box-shadow:0 12px 40px rgba(0,0,0,.18);}
.vn-search .ic{padding:0 12px;color:var(--vn-fg-mute);}
.vn-search input{background:transparent;border:0;color:var(--vn-fg);font-family:'Space Grotesk',var(--font-space),sans-serif;font-size:16px;padding:12px 4px;outline:0;width:100%;}
.vn-search input::placeholder{color:var(--vn-fg-mute);}
.vn-search-sep{width:1px;background:var(--vn-line);align-self:stretch;}
.vn-search-go{padding:12px 18px;background:var(--vn-accent);color:var(--vn-accent-ink);font-family:'JetBrains Mono',var(--font-mono),monospace;font-weight:600;letter-spacing:.1em;text-transform:uppercase;font-size:12px;display:inline-flex;gap:8px;align-items:center;border:none;cursor:pointer;}
/* chips */
.vn-chips{max-width:1440px;margin-inline:auto;padding:20px clamp(16px,4vw,32px) 0;display:flex;gap:8px;flex-wrap:wrap;}
.vn-chip{border-radius:999px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:8px 12px;border:1px solid var(--vn-line);color:var(--vn-fg-dim);cursor:pointer;background:none;}
.vn-chip:hover{color:var(--vn-fg);border-color:var(--vn-line-2);}
.vn-chip.on{background:var(--vn-fg);color:var(--vn-bg);border-color:var(--vn-fg);}
.vn-chip .n{color:var(--vn-fg-mute);margin-left:6px;}
.vn-chip.on .n{color:rgba(10,11,13,.55);}
/* layout */
.vn-page{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:0;margin:20px auto 0;max-width:1440px;}
.vn-list{padding:20px clamp(16px,4vw,32px) 60px;min-width:0;}
.vn-map-wrap{position:sticky;top:96px;height:calc(100dvh - 116px);padding:20px clamp(16px,4vw,32px) 20px 0;display:flex;flex-direction:column;min-width:0;}
.vn-map-wrap > div{flex:1;border-radius:0!important;}
/* list head */
.vn-list-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;}
.vn-list-head .count{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:20px;}
.vn-list-head .count em{color:var(--vn-fg-mute);font-weight:400;font-style:normal;}
.vn-sort{display:flex;gap:6px;}
.vn-sort button{border-radius:10px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--vn-fg-dim);padding:6px 10px;border:1px solid var(--vn-line);background:none;cursor:pointer;}
.vn-sort button.on{color:var(--vn-accent-ink);background:var(--vn-accent);border-color:var(--vn-accent);}
/* venue card */
.vn-card{border-radius:14px;border:1px solid var(--vn-line);background:var(--vn-bg-1);display:grid;grid-template-columns:150px 1fr;gap:16px;padding:14px;margin-bottom:12px;position:relative;cursor:pointer;transition:border-color .14s;text-decoration:none;color:inherit;}
.vn-card:hover{border-color:var(--vn-line-2);}
.vn-card.sel{border-color:var(--vn-accent);box-shadow:0 0 0 1px var(--vn-accent);}
.vn-img{border-radius:10px;aspect-ratio:4/3;background:linear-gradient(135deg,#2a1d14,#0d0f14);position:relative;overflow:hidden;}
.vn-img .tag{position:absolute;top:8px;left:8px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);padding:3px 6px;color:#fff;}
.vn-img .glyph{position:absolute;inset:0;display:grid;place-items:center;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:36px;color:rgba(255,255,255,.15);letter-spacing:-0.03em;}
.vn-img img{width:100%;height:100%;object-fit:cover;}
.vn-body{display:flex;flex-direction:column;gap:6px;min-width:0;}
.vn-top{display:flex;justify-content:space-between;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--vn-fg-mute);}
.vn-top .occ{color:var(--vn-accent);font-weight:600;}
.vn-top .open{color:var(--vn-live);}
.vn-name{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:20px;line-height:1.1;letter-spacing:-0.01em;}
.vn-desc{font-size:12.5px;color:var(--vn-fg-dim);line-height:1.45;}
.vn-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px;}
.vn-tagmini{border-radius:999px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;border:1px solid var(--vn-line);color:var(--vn-fg-dim);}
.vn-tagmini.hot{color:var(--vn-accent);border-color:var(--vn-accent);}
.vn-foot{margin-top:auto;padding-top:8px;border-top:1px dashed var(--vn-line);display:flex;justify-content:space-between;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--vn-fg-mute);}
.vn-foot .res{color:var(--vn-accent);font-weight:600;}
/* map */
.vn-map-panel{height:100%;border:1px solid var(--vn-line);position:relative;overflow:hidden;background:radial-gradient(circle at 32% 48%,rgba(255,120,60,0.1),transparent 24%),radial-gradient(circle at 62% 38%,rgba(80,180,255,0.07),transparent 30%),linear-gradient(180deg,#0e1116,#0a0b0d);}
.vn-map-panel::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px);background-size:48px 48px;}
.vn-road{position:absolute;background:rgba(255,255,255,0.06);}
.vn-road.h{height:2px;left:0;right:0;}
.vn-road.v{width:2px;top:0;bottom:0;}
.vn-blob{position:absolute;border-radius:50%;filter:blur(24px);pointer-events:none;}
.vn-pin{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;}
.vn-pin .marker{width:32px;height:32px;background:var(--vn-bg-2);border:1.5px solid var(--vn-line-2);color:var(--vn-fg);display:grid;place-items:center;font-family:'JetBrains Mono',var(--font-mono),monospace;font-weight:700;font-size:12px;border-radius:50%;position:relative;}
.vn-pin .marker::after{content:"";position:absolute;bottom:-7px;left:50%;transform:translateX(-50%) rotate(45deg);width:8px;height:8px;background:var(--vn-bg-2);border-right:1.5px solid var(--vn-line-2);border-bottom:1.5px solid var(--vn-line-2);}
.vn-pin.hot .marker{background:var(--vn-accent);color:var(--vn-accent-ink);border-color:var(--vn-accent);}
.vn-pin.hot .marker::after{background:var(--vn-accent);border-color:var(--vn-accent);}
.vn-pin.active .marker{transform:scale(1.25);box-shadow:0 0 0 4px rgba(255,95,45,0.18);}
.vn-pin.me .marker{background:var(--vn-live);border-color:var(--vn-live);color:var(--vn-bg);}
.vn-pin.me .marker::after{background:var(--vn-live);border-color:var(--vn-live);}
.vn-maplabel{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:.08em;text-transform:uppercase;background:rgba(10,11,13,.85);padding:2px 5px;color:var(--vn-fg);white-space:nowrap;}
.vn-map-ctrl{position:absolute;display:flex;flex-direction:column;gap:4px;}
.vn-map-ctrl.tl{top:12px;left:12px;right:12px;flex-direction:row;justify-content:space-between;align-items:center;}
.vn-legend{display:flex;gap:10px;background:rgba(10,11,13,.7);backdrop-filter:blur(8px);padding:8px 10px;border:1px solid var(--vn-line);font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;}
.vn-legend .dot{width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle;display:inline-block;}
.vn-legend .hot{background:var(--vn-accent);}.vn-legend .nrm{background:var(--vn-fg-mute);}.vn-legend .you{background:var(--vn-live);}
.vn-map-ctrl.br{top:auto;bottom:12px;right:12px;}
.vn-mapbtn{border-radius:10px;width:32px;height:32px;background:var(--vn-bg-2);border:1px solid var(--vn-line-2);display:grid;place-items:center;color:var(--vn-fg-dim);font-family:'JetBrains Mono',var(--font-mono),monospace;font-weight:600;cursor:pointer;}
/* drawer */
.vn-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:30;opacity:0;pointer-events:none;transition:opacity .18s;}
.vn-backdrop.open{opacity:1;pointer-events:auto;}
.vn-drawer{position:fixed;top:0;right:0;bottom:0;width:480px;background:var(--vn-bg-1);border-left:1px solid var(--vn-line);z-index:40;transform:translateX(100%);transition:transform .28s cubic-bezier(.2,.8,.2,1);box-shadow:-20px 0 60px rgba(0,0,0,.5);overflow-y:auto;}
.vn-drawer.open{transform:translateX(0);}
.vn-drawer-img{aspect-ratio:21/10;background:linear-gradient(135deg,#2a1d14,#0d0f14);position:relative;overflow:hidden;}
.vn-drawer-img .stripes{position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent 0 18px,rgba(255,255,255,.02) 18px 19px);}
.vn-drawer-img .glyph{position:absolute;left:24px;bottom:14px;font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:84px;line-height:.8;letter-spacing:-0.03em;color:rgba(255,255,255,.85);}
.vn-drawer-img .dtag{position:absolute;top:14px;left:14px;background:var(--vn-accent);color:var(--vn-accent-ink);font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;font-weight:600;padding:4px 8px;letter-spacing:.1em;text-transform:uppercase;}
.vn-drawer-close{position:absolute;top:12px;right:12px;width:32px;height:32px;background:rgba(10,11,13,.6);backdrop-filter:blur(6px);border:1px solid var(--vn-line-2);color:var(--vn-fg);display:grid;place-items:center;cursor:pointer;font-size:18px;}
.vn-drawer-body{padding:22px 24px 40px;}
.vn-dh-row{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;}
.vn-d-title{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:28px;line-height:1;letter-spacing:-0.02em;}
.vn-d-addr{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;color:var(--vn-fg-mute);letter-spacing:.08em;text-transform:uppercase;margin-top:6px;}
.vn-d-rating{text-align:right;flex-shrink:0;}
.vn-d-rating .v{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:26px;}
.vn-d-rating .v small{color:var(--vn-fg-mute);font-weight:400;font-size:13px;}
.vn-d-rating .r{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.08em;color:var(--vn-fg-mute);text-transform:uppercase;}
.vn-d-ctas{display:flex;gap:8px;margin:20px 0 24px;}
.vn-btn{border-radius:10px;display:inline-flex;align-items:center;gap:10px;padding:12px 18px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--vn-line-2);color:var(--vn-fg);text-decoration:none;cursor:pointer;background:none;}
.vn-btn.primary{background:var(--vn-accent);color:var(--vn-accent-ink);border-color:var(--vn-accent);font-weight:600;flex:1;justify-content:center;}
.vn-btn.ghost{flex:1;justify-content:center;}
.vn-d-facts{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid var(--vn-line);border-bottom:1px solid var(--vn-line);}
.vn-fact{padding:12px 14px;border-right:1px solid var(--vn-line);}
.vn-fact:nth-child(2n){border-right:0;}
.vn-fact:nth-child(n+3){border-top:1px solid var(--vn-line);}
.vn-fact .k{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:.12em;color:var(--vn-fg-mute);text-transform:uppercase;margin-bottom:4px;}
.vn-fact .vv{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:14px;}
.vn-d-sub{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.14em;color:var(--vn-fg-mute);text-transform:uppercase;margin:22px 0 10px;}
.vn-tags-wrap{display:flex;flex-wrap:wrap;gap:6px;}
.vn-tags-wrap .t{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:4px 8px;border:1px solid var(--vn-line);color:var(--vn-fg-dim);}
.vn-load-more{border-radius:12px;padding:18px;border:1px dashed var(--vn-line);text-align:center;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:12px;letter-spacing:.08em;color:var(--vn-fg-dim);text-transform:uppercase;margin-top:12px;cursor:pointer;background:none;width:100%;}
.vn-load-more:hover{color:var(--vn-fg);border-color:var(--vn-line-2);}
@media(max-width:1100px){.vn-page{grid-template-columns:1fr;}.vn-map-wrap{display:none;}.vn-band-grid{grid-template-columns:1fr;}}
@media(max-width:900px){.vn-topbar{padding:8px 10px;}.vn-topbar-inner{max-width:none;border-radius:18px;padding:9px 10px;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px 8px;align-items:center;}.vn-brand{min-width:0;}.vn-brand-tag{display:none;}.vn-nav{display:none;}.vn-top-right{grid-column:2;grid-row:1;display:flex;gap:6px;}.vn-menu-toggle{display:inline-flex;grid-column:3;grid-row:1;justify-self:end;}.vn-mobile-nav{grid-column:1/-1;grid-row:2;display:none;flex-direction:column;gap:8px;padding-top:8px;}.vn-mobile-nav.open{display:flex;}.vn-mobile-nav a{padding:12px 14px;border-radius:12px;font-size:14px;font-weight:700;color:var(--vn-fg);background:rgba(255,255,255,0.04);text-decoration:none;transition:all .18s;white-space:nowrap;}.vn-mobile-nav a:hover,.vn-mobile-nav a.active{background:rgba(255,255,255,0.08);color:var(--vn-fg);}.vn-mobile-nav .primary{background:var(--vn-accent);color:var(--vn-accent-ink);}.vn-btn-pill{padding:8px 12px;font-size:12px;white-space:nowrap;}.vn-list-venue-btn{display:none;}}
@media(max-width:768px){.vn-h1{font-size:32px;}.vn-band{padding:24px 16px 36px;}.vn-search-wrap{padding:0 16px;}.vn-chips{padding:16px 16px 0;}.vn-list{padding:16px 16px 60px;}.vn-search{grid-template-columns:auto 1fr auto;}.vn-crumb{padding:10px 16px;}}
`;

const STATE_ABBREV: Record<string, string> = {
    "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA",
    "Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA",
    "Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA",
    "Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD",
    "Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS",
    "Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV",
    "New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY",
    "North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK",
    "Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC",
    "South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT",
    "Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV",
    "Wisconsin":"WI","Wyoming":"WY","District of Columbia":"DC",
};

function normalizeState(s: string): string {
    const t = s.trim();
    if (/^[A-Z]{2}$/.test(t)) return t;
    return STATE_ABBREV[t] ?? t.toUpperCase().slice(0, 2);
}

type SortOption = "rating" | "reviews" | "name";

function VenueListImage({ src, alt }: { src?: string; alt: string }) {
    const [failed, setFailed] = useState(false);
    const imageSrc = !failed && src ? src : "/venue-hero.webp";

    return (
        <img
            src={imageSrc}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
        />
    );
}


function VenuesPageContent() {
    const { venues: VENUES, isLoading } = useData();
    const { user } = useAuth();
    const searchParams = useSearchParams();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<SortOption>("rating");
    const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(12);

    const requestedPage = parsePageParam(searchParams.get("page"));

    const activeVenues = useMemo(() => VENUES.filter(v => v.isActive), [VENUES]);

    const amenityOptions = useMemo(() =>
        Object.entries(AMENITY_LABELS)
            .filter(([key]) => activeVenues.some(v => v.amenities.includes(key)))
            .sort((a, b) => a[1].label.localeCompare(b[1].label))
            .slice(0, 8),
        [activeVenues]
    );

    const filtered = useMemo(() =>
        activeVenues
            .filter(v => {
                const sq = searchQuery.trim().toLowerCase();
                const sOK = !sq || v.name.toLowerCase().includes(sq) || v.city.toLowerCase().includes(sq) || v.addressLine1.toLowerCase().includes(sq);
                const aOK = selectedAmenities.length === 0 || selectedAmenities.some(a => v.amenities.includes(a));
                return sOK && aOK;
            })
            .sort((a, b) => {
                if (sortBy === "rating") return b.rating - a.rating;
                if (sortBy === "reviews") return b.reviewCount - a.reviewCount;
                return a.name.localeCompare(b.name);
            }),
        [activeVenues, searchQuery, selectedAmenities, sortBy]
    );

    const displayedVenues = filtered.slice(0, visibleCount);
    const hasMore = filtered.length > visibleCount;

    const openDrawer = (v: Venue) => { setSelectedVenue(v); setDrawerOpen(true); };
    const closeDrawer = () => setDrawerOpen(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    const toggleAmenity = (key: string) =>
        setSelectedAmenities(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

    const initials = user?.name
        ? user.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()
        : "MW";

    const d = selectedVenue;
    const dGlyph = d ? d.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : "";
    const dTag = d ? (d.fanTeams?.[0]?.teamName || d.cuisineTags?.[0] || "WATCH PARTY VENUE") : "";

    return (
        <div className="vn-wrap">
            <style dangerouslySetInnerHTML={{ __html: VN_VARS + VN_CSS }} />
            <FloatingNav />

            {/* Topbar */}
            <header className="vn-topbar">
                <div className="vn-topbar-inner">
                    <Link href="/" className="vn-brand">
                        <img className="vn-brand-logo" src="/logo.svg" alt="MatchWatch" />
                    </Link>
                    <nav className="vn-nav">
                        <Link href="/">Home</Link>
                        <Link href="/matches">Matches</Link>
                        <Link href="/world-cup">World Cup</Link>
                        <Link href="/venues" className="active">Venues</Link>
                        {user && <Link href="/dashboard">My bookings</Link>}
                    </nav>
                    <button
                        type="button"
                        className="vn-menu-toggle"
                        aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                        aria-expanded={mobileMenuOpen}
                        onClick={() => setMobileMenuOpen((open) => !open)}
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                    <nav className={`vn-mobile-nav${mobileMenuOpen ? " open" : ""}`}>
                        <Link href="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
                        <Link href="/matches" onClick={() => setMobileMenuOpen(false)}>Matches</Link>
                        <Link href="/world-cup" onClick={() => setMobileMenuOpen(false)}>World Cup</Link>
                        <Link href="/venues" className="active" onClick={() => setMobileMenuOpen(false)}>Venues</Link>
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
                    <div className="vn-top-right">
                        {user
                            ? <Link href="/dashboard" className="vn-btn-pill ghost">{initials}</Link>
                            : <>
                                <Link href="/for-venues/register" className="vn-btn-pill ghost vn-list-venue-btn">List venue</Link>
                                <Link href="/login" className="vn-btn-pill">Log in</Link>
                              </>
                        }
                    </div>
                </div>
            </header>

            {/* Breadcrumb */}
            <div className="vn-crumb">
                <Link href="/">Home</Link>
                <span className="sep">/</span>
                <b>Venues</b>
            </div>

            {/* Band */}
            <section className="vn-band">
                <div className="vn-band-grid">
                    <div>
                        <div className="vn-kicker">
                            {activeVenues.length} Bars · Houston &amp; surrounding areas · Updated live
                        </div>
                        <h1 className="vn-h1">Where to watch. <em>Tonight.</em></h1>
                        <p className="vn-sub">Every bar showing a live match, ranked by vibe and distance. Reserve tables, see how full it is right now, and join the supporter section that fits you.</p>
                    </div>
                    <div className="vn-metrics">
                        <div className="vn-metric">
                            <div className="lbl">Bars showing matches</div>
                            <div className="v">{activeVenues.length || 312}</div>
                        </div>
                        <div className="vn-metric">
                            <div className="lbl">Watch parties live</div>
                            <div className="v"><em>{activeVenues.filter(v => (v.upcomingEventsCount || 0) > 0).length || 42}</em></div>
                        </div>
                        <div className="vn-metric">
                            <div className="lbl">Tables open</div>
                            <div className="v">84</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Search bar */}
            <div className="vn-search-wrap">
                <div className="vn-search">
                    <span className="ic">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                    </span>
                    <input
                        placeholder="Search bars, neighborhoods, city…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    <span className="vn-search-sep" />
                    <button className="vn-search-go">Find bars →</button>
                </div>
            </div>

            {/* Filter chips */}
            <div className="vn-chips">
                <button
                    className={`vn-chip${selectedAmenities.length === 0 ? " on" : ""}`}
                    onClick={() => setSelectedAmenities([])}
                >
                    All venues <span className="n">{activeVenues.length}</span>
                </button>
                {amenityOptions.map(([key, val]) => (
                    <button
                        key={key}
                        className={`vn-chip${selectedAmenities.includes(key) ? " on" : ""}`}
                        onClick={() => toggleAmenity(key)}
                    >
                        {val.label}
                        <span className="n">{activeVenues.filter(v => v.amenities.includes(key)).length}</span>
                    </button>
                ))}
            </div>

            {/* Main 2-col layout */}
            <main className="vn-page">
                {/* Venue list */}
                <section className="vn-list">
                    <div className="vn-list-head">
                        <div className="count">
                            Showing <em>· {displayedVenues.length} of {filtered.length}</em>
                        </div>
                        <div className="vn-sort">
                            {(["rating", "reviews", "name"] as SortOption[]).map(s => (
                                <button key={s} className={sortBy === s ? "on" : ""} onClick={() => setSortBy(s)}>
                                    {s === "rating" ? "Nearest" : s === "reviews" ? "Vibe" : "Name"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {isLoading && activeVenues.length === 0 ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="vn-card" style={{ opacity: 0.4, pointerEvents: "none" }}>
                                <div className="vn-img" />
                                <div className="vn-body">
                                    <div style={{ height: 10, width: "60%", background: "var(--vn-line-2)", marginBottom: 8 }} />
                                    <div style={{ height: 20, width: "80%", background: "var(--vn-line-2)" }} />
                                </div>
                            </div>
                        ))
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: "40px 0", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--vn-fg-mute)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                            No venues match your filters
                        </div>
                    ) : (
                        displayedVenues.map((v, i) => {
                            const pct = v.upcomingEventsCount ? Math.min(87, 30 + i * 13) : 0;
                            const isHot = pct >= 80;
                            const isOpen = !v.upcomingEventsCount || pct < 40;
                            return (
                                <div
                                    key={v.id}
                                    className={`vn-card${selectedVenue?.id === v.id ? " sel" : ""}`}
                                    onClick={() => openDrawer(v)}
                                >
                                    <div className="vn-img">
                                        <VenueListImage src={v.coverImageUrl} alt={v.name} />
                                        {v.fanTeams?.[0] && (
                                            <span className="tag">{v.fanTeams[0].teamName.toUpperCase().substring(0, 16)}</span>
                                        )}
                                    </div>
                                    <div className="vn-body">
                                        <div className="vn-top">
                                            <span>{v.city}{v.state ? `, ${normalizeState(v.state)}` : ""}</span>
                                            {isOpen
                                                ? <span className="open">TABLES OPEN</span>
                                                : <span className={isHot ? "occ" : ""}>{pct}% FULL</span>
                                            }
                                        </div>
                                        <div className="vn-name">{v.name}</div>
                                        <div className="vn-desc">
                                            {v.shortDescription || v.amenities.slice(0, 4).map(a => AMENITY_LABELS[a]?.label || a).join(" · ") || "Sports bar · Watch parties welcome"}
                                        </div>
                                        <div className="vn-tags">
                                            {(v.upcomingEventsCount || 0) > 0 && (
                                                <span className="vn-tagmini hot">LIVE · {v.upcomingEventsCount} EVENTS</span>
                                            )}
                                            {v.amenities.slice(0, 3).map(a => (
                                                <span key={a} className="vn-tagmini">{AMENITY_LABELS[a]?.label || a}</span>
                                            ))}
                                        </div>
                                        <div className="vn-foot">
                                            <span>⭐ {v.rating?.toFixed(1) || "4.5"} · {v.reviewCount || 0} reviews</span>
                                            <span className="res">RESERVE →</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {hasMore && (
                        <button className="vn-load-more" onClick={() => setVisibleCount(c => c + 12)}>
                            Load {Math.min(12, filtered.length - visibleCount)} more bars →
                        </button>
                    )}
                </section>

                {/* Map panel */}
                <aside className="vn-map-wrap">
                    <MatchVenueMap
                        venues={filtered
                            .filter(v => v.lat && v.lng)
                            .map(v => ({
                                id: v.id,
                                name: v.name,
                                slug: v.slug,
                                addressLine1: v.addressLine1,
                                city: v.city,
                                lat: v.lat,
                                lng: v.lng,
                                confirmedBookings: 0,
                                bookingLimit: null,
                            }))}
                        onSelectVenue={(id) => {
                            const v = filtered.find(x => x.id === id);
                            if (v) openDrawer(v);
                        }}
                        height={Math.max(500, typeof window !== "undefined" ? window.innerHeight - 80 : 600)}
                    />
                </aside>
            </main>

            {/* Backdrop */}
            <div className={`vn-backdrop${drawerOpen ? " open" : ""}`} onClick={closeDrawer} />

            {/* Drawer */}
            <aside className={`vn-drawer${drawerOpen ? " open" : ""}`}>
                {d && (
                    <>
                        <div style={{ position: "relative" }}>
                            <div className="vn-drawer-img">
                                <div className="stripes" />
                                <div className="dtag">{dTag.toUpperCase()}</div>
                                <div className="glyph">{dGlyph}</div>
                            </div>
                            <button className="vn-drawer-close" onClick={closeDrawer}>✕</button>
                        </div>
                        <div className="vn-drawer-body">
                            <div className="vn-dh-row">
                                <div>
                                    <div className="vn-d-title">{d.name}</div>
                                    <div className="vn-d-addr">{d.addressLine1}{d.city ? ` · ${d.city}` : ""}{d.state ? `, ${normalizeState(d.state)}` : ""}</div>
                                </div>
                                <div className="vn-d-rating">
                                    <div className="v">{d.rating?.toFixed(1) || "4.5"}<small>/5</small></div>
                                    <div className="r">{d.reviewCount || 0} reviews</div>
                                </div>
                            </div>

                            <div className="vn-d-ctas">
                                <Link href={`/venues/${d.slug || d.id}`} className="vn-btn primary">View venue →</Link>
                                <a href={`https://maps.google.com/?q=${encodeURIComponent(d.addressLine1 + " " + d.city)}`} target="_blank" rel="noreferrer" className="vn-btn ghost">Directions</a>
                            </div>

                            <div className="vn-d-facts">
                                <div className="vn-fact">
                                    <div className="k">Upcoming events</div>
                                    <div className="vv" style={{ color: "var(--vn-accent)" }}>{d.upcomingEventsCount || 0} events</div>
                                </div>
                                <div className="vn-fact">
                                    <div className="k">Capacity</div>
                                    <div className="vv">{d.capacity || "—"}</div>
                                </div>
                                <div className="vn-fact">
                                    <div className="k">Price range</div>
                                    <div className="vv">{d.priceRange || "MID"}</div>
                                </div>
                                <div className="vn-fact">
                                    <div className="k">Verified</div>
                                    <div className="vv">{d.isVerified ? "✓ Verified" : "Pending"}</div>
                                </div>
                            </div>

                            {d.amenities.length > 0 && (
                                <>
                                    <div className="vn-d-sub">Vibe &amp; amenities</div>
                                    <div className="vn-tags-wrap">
                                        {d.amenities.map(a => (
                                            <span key={a} className="t">{AMENITY_LABELS[a]?.label || a}</span>
                                        ))}
                                        {d.cuisineTags.map(c => (
                                            <span key={c} className="t">{c}</span>
                                        ))}
                                    </div>
                                </>
                            )}

                            {d.fanTeams && d.fanTeams.length > 0 && (
                                <>
                                    <div className="vn-d-sub">Supporter clubs</div>
                                    <div className="vn-tags-wrap">
                                        {d.fanTeams.map(t => (
                                            <span key={t.teamId} className="t">{t.teamName}</span>
                                        ))}
                                    </div>
                                </>
                            )}

                            {d.shortDescription && (
                                <>
                                    <div className="vn-d-sub">About</div>
                                    <p style={{ fontSize: 13, color: "var(--vn-fg-dim)", lineHeight: 1.6, margin: 0 }}>{d.shortDescription}</p>
                                </>
                            )}
                        </div>
                    </>
                )}
            </aside>
        </div>
    );
}

export default function VenuesPage() {
    return (
        <React.Suspense fallback={
            <div style={{ background: "#0a0b0d", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6c6a64", fontFamily: "monospace", fontSize: 13 }}>
                Loading venues…
            </div>
        }>
            <VenuesPageContent />
        </React.Suspense>
    );
}
