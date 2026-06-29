"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useData } from "../../lib/data-provider";
import { Building2, Star, Trophy, ChevronRight, Globe, Calendar } from "lucide-react";
import { FloatingNav } from "../../components/AppShell";
import { Countdown } from "../../components/Countdown";
import { WORLD_CUP_FLAGS, WORLD_CUP_SCHEDULE } from "./schedule";

/* Opening match Ã¢â‚¬â€ Jun 11 2026, 5:00 PM ET (used for the hero countdown). */
const WC_OPENING = "2026-06-11T17:00:00-04:00";

/* Match a host city to real venues in the live dataset (alias-aware). */
function cityVenueCount(venues: Array<{ city?: string | null }>, aliases: string[]) {
  const keys = aliases.map((a) => a.toLowerCase());
  return venues.filter((v) => {
    const c = (v.city || "").toLowerCase();
    return keys.some((k) => c.includes(k));
  }).length;
}

/* Derive venue-match aliases from a host-city display name, e.g.
   "New York / New Jersey" -> ["New York","New Jersey"]; "San Francisco Bay Area" -> ["San Francisco"]. */
function cityAliases(name: string): string[] {
  return name.split("/").map((p) => p.trim().replace(/ Bay Area$/i, "").trim()).filter(Boolean);
}

// `image` points at an optional city photo in /public/cities/. When the file
// is absent the gradient `g` shows through as a designed fallback (no broken
// image), so the cards look intentional either way.
const CITIES = [
  { name: "New York / New Jersey", slug: "new-york",       short: "NY/NJ", stadium: "MetLife Stadium",        cap: "82,500", matches: 8, badge: "THE FINAL",       g: "linear-gradient(145deg,#001840 0%,#8b0000 100%)", image: "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=800&h=500&q=80" },
  { name: "Los Angeles",           slug: "los-angeles",    short: "LA",    stadium: "SoFi Stadium",            cap: "70,240", matches: 8, badge: "SEMIFINAL",       g: "linear-gradient(145deg,#2d0a6e 0%,#c8a200 100%)", image: "https://images.unsplash.com/photo-1580655653885-65763b2597d0?auto=format&fit=crop&w=800&h=500&q=80" },
  { name: "Dallas",                slug: "dallas",         short: "DAL",   stadium: "AT&T Stadium",            cap: "80,000", matches: 9, badge: "TOP HOST",        g: "linear-gradient(145deg,#001a40 0%,#7a5500 100%)", image: "https://images.unsplash.com/photo-1593810450967-f9c42742e326?auto=format&fit=crop&w=800&h=500&q=80" },
  { name: "Houston",               slug: "houston",        short: "HOU",   stadium: "NRG Stadium",             cap: "72,220", matches: 7, badge: "OPENING",         g: "linear-gradient(145deg,#001840 0%,#b84a00 100%)", image: "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=800&h=500&q=80" },
  { name: "Miami",                 slug: "miami",          short: "MIA",   stadium: "Hard Rock Stadium",        cap: "65,326", matches: 7, badge: "BEACH CITY",     g: "linear-gradient(145deg,#003060 0%,#a83200 100%)", image: "https://images.unsplash.com/photo-1533106497176-fe5a5955f5b2?auto=format&fit=crop&w=800&h=500&q=80" },
  { name: "Atlanta",               slug: "atlanta",        short: "ATL",   stadium: "Mercedes-Benz Stadium",   cap: "71,000", matches: 8, badge: "SOCCER CITY",    g: "linear-gradient(145deg,#0a0000 0%,#7a0020 100%)", image: "https://images.unsplash.com/photo-1575517111839-3a3843ee7f5d?auto=format&fit=crop&w=800&h=500&q=80" },
  { name: "San Francisco Bay Area",slug: "san-francisco",  short: "SF",    stadium: "Levi's Stadium",          cap: "68,500", matches: 6, badge: "TECH CITY",      g: "linear-gradient(145deg,#5a0000 0%,#6a5000 100%)", image: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=800&h=500&q=80" },
  { name: "Philadelphia",          slug: "philadelphia",   short: "PHI",   stadium: "Lincoln Financial Field", cap: "69,800", matches: 6, badge: "LIBERTY CITY",   g: "linear-gradient(145deg,#002030 0%,#3a4a50 100%)", image: "https://images.unsplash.com/photo-1568402102990-bc814441b8bc?auto=format&fit=crop&w=800&h=500&q=80" },
  { name: "Seattle",               slug: "seattle",        short: "SEA",   stadium: "Lumen Field",             cap: "68,740", matches: 5, badge: "SOCCER CAPITAL", g: "linear-gradient(145deg,#001030 0%,#1a4a00 100%)", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&h=500&q=80" },
  { name: "Boston",                slug: "boston",         short: "BOS",   stadium: "Gillette Stadium",        cap: "65,000", matches: 7, badge: "HISTORIC CITY",  g: "linear-gradient(145deg,#6a0010 0%,#001030 100%)", image: "https://images.unsplash.com/photo-1569601158879-37e0c4b8f34b?auto=format&fit=crop&w=800&h=500&q=80" },
  { name: "Kansas City",           slug: "kansas-city",    short: "KC",    stadium: "Arrowhead Stadium",       cap: "76,416", matches: 6, badge: "HEART OF USA",   g: "linear-gradient(145deg,#6a0010 0%,#7a5000 100%)", image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&h=500&q=80" },
];

const FAN_FESTIVALS = [
  { city: "Houston", slug: "houston", venue: "EaDo District", dates: "Jun 11 - Jul 19", detail: "All 34 match days" },
  { city: "Dallas", slug: "dallas", venue: "Fair Park", dates: "Jun 11 - Jul 19", detail: "1M sq ft fan celebration" },
  { city: "Seattle", slug: "seattle", venue: "Seattle Center", dates: "Jun - Jul 2026", detail: "The Armory + Mural Amphitheatre" },
  { city: "Kansas City", slug: "kansas-city", venue: "National WWI Museum and Memorial", dates: "Jun 11 - Jul 11", detail: "18 festival days" },
  { city: "Boston", slug: "boston", venue: "City Hall Plaza", dates: "Jun 12 - Jun 27", detail: "16 group-stage days" },
  { city: "Philadelphia", slug: "philadelphia", venue: "Lemon Hill, Fairmount Park", dates: "Jun 11 - Jul 19", detail: "All 39 tournament days" },
  { city: "Miami", slug: "miami", venue: "Bayfront Park", dates: "Jun 13 - Jul 5", detail: "Downtown waterfront festival" },
  { city: "Atlanta", slug: "atlanta", venue: "Centennial Olympic Park", dates: "Jun 11 - Jul 15", detail: "Select tournament days" },
  { city: "New York / New Jersey", slug: "new-york", venue: "Rockefeller Center", dates: "Jul 6 - Jul 19", detail: "NYNJ Fan Village" },
];


const Flag = ({ code }: { code: string }) => (
  <img
    src={`https://flagcdn.com/24x18/${code}.png`}
    width={24}
    height={18}
    alt={code}
    style={{ objectFit: "cover", borderRadius: 2, flexShrink: 0 }}
  />
);

/* Ã¢â€â‚¬Ã¢â€â‚¬ shared design tokens (matches home page exactly) Ã¢â€â‚¬Ã¢â€â‚¬ */
const MW_VARS = `
  :root{
    --mw-bg:var(--background);
    --mw-bg-1:var(--card);
    --mw-bg-2:var(--card);
    --mw-bg-3:var(--secondary);
    --mw-line:var(--border);
    --mw-line-2:var(--border);
    --mw-fg:var(--foreground);
    --mw-fg-dim:var(--muted-foreground);
    --mw-fg-mute:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);
  }
`;

const CSS = `
  .wc-page{background:var(--mw-bg);min-height:100vh;color:var(--mw-fg);}

  /* Ã¢â€â‚¬Ã¢â€â‚¬ Nav Ã¢â€â‚¬Ã¢â€â‚¬ */
  .wc-topbar{position:sticky;top:0;z-index:20;display:flex;justify-content:center;padding:10px 16px;}
  .wc-topbar-inner{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:1440px;padding:10px 20px;border-radius:999px;background:color-mix(in srgb,var(--mw-bg) 75%,transparent);backdrop-filter:blur(16px);border:1px solid rgba(35,39,47,.8);box-shadow:0 2px 20px rgba(0,0,0,.25);}
  .wc-logo{display:block;width:156px;height:auto;max-height:44px;object-fit:contain;}
  .wc-nav{display:flex;align-items:center;gap:2px;}
  .wc-nav a{padding:7px 14px;border-radius:999px;font-size:13px;font-weight:600;color:var(--mw-fg-dim);transition:all .18s;text-decoration:none;}
  .wc-nav a:hover{background:rgba(255,255,255,.07);color:var(--mw-fg);}
  .wc-nav a.on{background:color-mix(in srgb,var(--mw-accent) 18%,transparent);color:var(--mw-fg);}
  .wc-tr{display:flex;gap:8px;align-items:center;}
  .wc-ghost{padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;color:var(--mw-fg-dim);text-decoration:none;}
  .wc-ghost:hover{background:rgba(255,255,255,.07);color:var(--mw-fg);}
  .wc-orange{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;background:var(--mw-accent);color:#0a0b0d;transition:all .18s;}
  .wc-orange:hover{opacity:.88;transform:translateY(-1px);}
  .wc-hmbg{display:none;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid var(--mw-line);border-radius:999px;background:rgba(255,255,255,.04);color:var(--mw-fg);cursor:pointer;}

  /* Ã¢â€â‚¬Ã¢â€â‚¬ Hero Ã¢â€â‚¬Ã¢â€â‚¬ */
  .wc-hero{position:relative;overflow:hidden;min-height:560px;display:flex;align-items:center;background:linear-gradient(160deg,var(--mw-bg) 0%,#0d1520 40%,#1a0a05 100%);border-bottom:1px solid var(--mw-line);}
  .wc-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 70% 50%,color-mix(in srgb,var(--mw-accent) 12%,transparent),transparent 70%),radial-gradient(ellipse 60% 80% at 20% 30%,rgba(0,80,160,.15),transparent 70%);pointer-events:none;}
  .wc-hero-orb{position:absolute;right:-80px;top:50%;transform:translateY(-50%);width:520px;height:520px;border-radius:50%;border:1px solid color-mix(in srgb,var(--mw-accent) 7%,transparent);}
  .wc-hero-bg{position:absolute;inset:0;background:url(/home-hero.webp) center/cover no-repeat;opacity:.16;pointer-events:none;}
  .wc-hero-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 0%,var(--mw-bg) 100%);}
  .wc-hero-inner{position:relative;z-index:2;max-width:1440px;margin:0 auto;padding:148px 24px 64px;width:100%;display:grid;grid-template-columns:1fr 300px;gap:48px;align-items:center;}
  .wc-hero-text{display:flex;flex-direction:column;}
  .wc-hero-trophy{display:flex;flex-direction:column;align-items:center;justify-content:center;height:320px;margin:0;}
  .wc-hero-trophy img{width:min(220px,100%);height:auto;display:block;filter:drop-shadow(0 0 28px rgba(212,160,20,0.55)) drop-shadow(0 0 70px rgba(212,140,10,0.26));}
  .wc-hero-trophy figcaption{margin-top:8px;font-size:10px;color:var(--mw-fg-mute);text-align:center;}
  .wc-hero-trophy figcaption a{color:inherit;text-decoration:underline;text-underline-offset:2px;}
  .wc-kicker{display:inline-flex;align-items:center;gap:8px;font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;margin-bottom:20px;border:1px solid color-mix(in srgb,var(--mw-accent) 30%,transparent);padding:5px 12px;border-radius:999px;}
  .wc-kicker .bd{width:6px;height:6px;background:var(--mw-accent);border-radius:50%;animation:bd 1.4s ease-in-out infinite;}
  @keyframes bd{0%,100%{opacity:.4;}50%{opacity:1;}}
  .wc-h1{font-size:clamp(2.4rem,6vw,4.4rem);font-weight:900;line-height:1.0;color:var(--mw-fg);margin:0 0 16px;letter-spacing:-.02em;max-width:660px;font-family:"Space Grotesk",sans-serif;}
  .wc-h1 b{color:var(--mw-accent);font-weight:900;}
  .wc-sub{font-size:1.05rem;color:var(--mw-fg-dim);line-height:1.6;max-width:540px;margin-bottom:36px;}
  .wc-btns{display:flex;flex-wrap:wrap;gap:12px;}
  .wc-btn-p{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;background:var(--mw-accent);color:#0a0b0d;transition:all .2s;}
  .wc-btn-p:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}
  .wc-btn-g{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none;border:1px solid var(--mw-line-2);color:var(--mw-fg-dim);transition:all .2s;}
  .wc-btn-g:hover{border-color:var(--mw-fg-dim);color:var(--mw-fg);}
  .wc-stats{display:flex;gap:40px;margin-top:52px;padding-top:40px;border-top:1px solid var(--mw-line);}
  .wc-sv{font-size:2rem;font-weight:900;color:var(--mw-fg);line-height:1;font-family:"Space Grotesk",sans-serif;}
  .wc-sv span{color:var(--mw-accent);}
  .wc-sl{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mw-fg-mute);}

  /* Ã¢â€â‚¬Ã¢â€â‚¬ Shared layout Ã¢â€â‚¬Ã¢â€â‚¬ */
  .wc-wrap{max-width:1440px;margin:0 auto;padding:0 24px;}
  .wc-sh{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:28px;}
  .wc-st{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:1.6rem;color:var(--mw-fg);letter-spacing:-.01em;display:flex;align-items:center;gap:12px;}
  .wc-sb{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--mw-accent);letter-spacing:.1em;border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:4px;font-weight:700;}
  .wc-sl2{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mw-fg-mute);text-decoration:none;display:inline-flex;align-items:center;gap:4px;}
  .wc-sl2:hover{color:var(--mw-accent);}

  /* Ã¢â€â‚¬Ã¢â€â‚¬ Schedule Ã¢â€â‚¬Ã¢â€â‚¬ */
  .wc-scw{padding:64px 0 80px;border-top:1px solid var(--mw-line);}
  .wc-tabs{display:flex;gap:4px;margin-bottom:28px;}
  .wc-tab{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:8px 14px;border:1px solid var(--mw-line);color:var(--mw-fg-dim);cursor:pointer;background:none;transition:all .12s;}
  .wc-tab.on{background:var(--mw-accent);color:#0a0b0d;border-color:var(--mw-accent);font-weight:700;}
  .wc-tab:hover:not(.on){color:var(--mw-fg);border-color:var(--mw-line-2);}
  .wc-mg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
  .wc-mc{border:1px solid var(--mw-line);background:var(--mw-bg-1);padding:14px 16px;transition:all .14s;cursor:pointer;text-decoration:none;display:block;}
  .wc-mc:hover{border-color:var(--mw-line-2);background:var(--mw-bg-2);}
  .wc-mc-top{display:flex;justify-content:space-between;font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.1em;color:var(--mw-fg-mute);text-transform:uppercase;margin-bottom:10px;}
  .wc-mc-tag{color:var(--mw-accent);font-weight:700;}
  .wc-mc-teams{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-bottom:10px;}
  .wc-mc-team{display:flex;align-items:center;gap:6px;font-family:"Space Grotesk",sans-serif;font-weight:600;font-size:14px;color:var(--mw-fg);}
  .wc-mc-team.away{flex-direction:row-reverse;justify-content:flex-start;}
  .wc-mc-flag{font-size:18px;line-height:1;flex-shrink:0;}
  .wc-mc-vs{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--mw-fg-mute);text-align:center;font-weight:700;}
  .wc-mc-foot{display:flex;justify-content:space-between;padding-top:10px;border-top:1px dashed var(--mw-line);font-family:"JetBrains Mono",monospace;font-size:9px;color:var(--mw-fg-mute);letter-spacing:.06em;}
  .wc-mc-foot .city{color:var(--mw-accent);}
  .wc-final-card{border:1px solid var(--mw-line);background:linear-gradient(120deg,color-mix(in srgb,var(--mw-accent) 8%,transparent),transparent 60%),var(--mw-bg-1);padding:28px 32px;}
  .wc-final-top{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mw-accent);margin-bottom:16px;font-weight:700;}
  .wc-final-teams{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:20px;}
  .wc-final-team{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:2rem;color:var(--mw-fg);}
  .wc-final-vs{font-family:"JetBrains Mono",monospace;font-size:14px;color:var(--mw-fg-mute);font-weight:700;}
  .wc-final-meta{display:flex;gap:28px;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--mw-fg-dim);letter-spacing:.06em;}
  .wc-final-meta span{color:var(--mw-accent);font-weight:700;}

  /* Ã¢â€â‚¬Ã¢â€â‚¬ City cards Ã¢â€â‚¬Ã¢â€â‚¬ */
  .wc-cw{padding:64px 0 80px;}
  .wc-cg{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
  .wc-cc{border-radius:12px;position:relative;overflow:hidden;border:1px solid var(--mw-line);cursor:pointer;transition:all .2s;text-decoration:none;display:block;min-height:196px;}
  .wc-cc:hover{transform:translateY(-3px);box-shadow:0 20px 48px rgba(0,0,0,.55);border-color:color-mix(in srgb,var(--mw-accent) 35%,transparent);}
  .wc-cbg{position:absolute;inset:0;opacity:.9;transition:opacity .2s;}
  .wc-cc:hover .wc-cbg{opacity:1;}
  .wc-cov{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,.1) 55%,transparent 100%);}
  .wc-ci{position:relative;z-index:2;padding:18px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;min-height:196px;}
  .wc-cbadge{border-radius:999px;display:inline-flex;font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.9);background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.15);padding:3px 7px;margin-bottom:8px;align-self:flex-start;backdrop-filter:blur(4px);}
  .wc-cn{font-family:"Space Grotesk",sans-serif;font-size:1.35rem;font-weight:900;color:#fff;line-height:1.1;margin-bottom:4px;}
  .wc-cs{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.07em;color:rgba(255,255,255,.6);text-transform:uppercase;margin-bottom:10px;}
  .wc-cm{display:flex;gap:12px;align-items:center;}
  .wc-cmn{font-family:"JetBrains Mono",monospace;font-size:11px;color:rgba(255,255,255,.8);}
  .wc-cmn .n{font-weight:700;color:var(--mw-accent);font-size:14px;}
  .wc-cex{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:3px;margin-left:auto;transition:color .16s;}
  .wc-cc:hover .wc-cex{color:var(--mw-accent);}

  /* Ã¢â€â‚¬Ã¢â€â‚¬ Venue cards Ã¢â€â‚¬Ã¢â€â‚¬ */
  .wc-vw{padding:0 0 80px;}
  .wc-vg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
  .wc-vc{border:1px solid var(--mw-line);background:var(--mw-bg-1);padding:20px;transition:all .16s;}
  .wc-vc:hover{border-color:color-mix(in srgb,var(--mw-accent) 30%,transparent);background:var(--mw-bg-2);}
  .wc-vcity{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mw-accent);margin-bottom:8px;}
  .wc-vname{font-family:"Space Grotesk",sans-serif;font-size:16px;font-weight:700;color:var(--mw-fg);margin-bottom:4px;}
  .wc-vtype{font-size:12px;color:var(--mw-fg-mute);margin-bottom:14px;}
  .wc-vf{display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px dashed var(--mw-line);}
  .wc-vs{color:var(--mw-accent);font-size:12px;letter-spacing:2px;}
  .wc-vl{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mw-fg-mute);text-decoration:none;}
  .wc-vl:hover{color:var(--mw-accent);}

  /* Ã¢â€â‚¬Ã¢â€â‚¬ Sponsor CTA Ã¢â€â‚¬Ã¢â€â‚¬ */
  .wc-spw{padding:0 0 80px;}
  .wc-sp{border:1px solid var(--mw-line);background:linear-gradient(130deg,color-mix(in srgb,var(--mw-accent) 8%,transparent),transparent 60%),var(--mw-bg-1);padding:52px 48px;display:grid;grid-template-columns:1fr auto;gap:40px;align-items:center;}
  .wc-spk{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mw-accent);margin-bottom:12px;font-weight:700;}
  .wc-sph2{font-family:"Space Grotesk",sans-serif;font-size:1.9rem;font-weight:900;color:var(--mw-fg);margin-bottom:12px;line-height:1.1;}
  .wc-spp{font-size:14px;color:var(--mw-fg-dim);line-height:1.65;max-width:540px;}
  .wc-spb{display:flex;flex-direction:column;gap:10px;min-width:196px;}
  .wc-spbtn{display:flex;justify-content:center;align-items:center;gap:6px;padding:12px 20px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;border:1px solid var(--mw-line-2);color:var(--mw-fg-dim);transition:all .18s;}
  .wc-spbtn:hover{border-color:var(--mw-fg-dim);color:var(--mw-fg);}

  /* Ã¢â€â‚¬Ã¢â€â‚¬ Fan Festival Ã¢â€â‚¬Ã¢â€â‚¬ */
  .wc-fw{padding:0 0 80px;}
  .wc-fb{border:1px solid var(--mw-line);background:linear-gradient(160deg,rgba(0,60,120,.1),transparent 60%),var(--mw-bg-1);padding:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;}
  .wc-fh2{font-family:"Space Grotesk",sans-serif;font-size:1.5rem;font-weight:900;color:var(--mw-fg);margin-bottom:14px;}
  .wc-fp{font-size:13px;color:var(--mw-fg-dim);line-height:1.7;margin-bottom:20px;}
  .wc-fcg{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .wc-fci{border:1px solid var(--mw-line);padding:12px 14px;font-size:12px;color:var(--mw-fg-dim);display:grid;grid-template-columns:6px 1fr;align-items:start;gap:10px;text-decoration:none;transition:border-color .15s,background .15s;}
  .wc-fci:hover{border-color:color-mix(in srgb,var(--mw-accent) 45%,var(--mw-line));background:color-mix(in srgb,var(--mw-accent) 7%,transparent);}
  .wc-fci .d{width:6px;height:6px;background:var(--mw-accent);border-radius:50%;flex-shrink:0;}
  .wc-fn{font-family:"Space Grotesk",sans-serif;font-size:13px;font-weight:800;color:var(--mw-fg);line-height:1.15;margin-bottom:2px;}
  .wc-fm{font-size:11px;color:var(--mw-fg-mute);line-height:1.35;}
  .wc-fm b{color:var(--mw-fg-dim);font-weight:700;}

  /* Ã¢â€â‚¬Ã¢â€â‚¬ Responsive Ã¢â€â‚¬Ã¢â€â‚¬ */
  @media(max-width:1024px){
    .wc-cg,.wc-vg,.wc-mg{grid-template-columns:repeat(2,1fr);}
    .wc-sp{grid-template-columns:1fr;gap:24px;}
    .wc-fb{grid-template-columns:1fr;}
  }
  @media(max-width:900px){
    .wc-nav,.wc-ghost{display:none !important;}
    .wc-hmbg{display:inline-flex;}
    .wc-logo{width:120px;}
    .wc-stats{gap:24px;}
    .wc-hero-inner{grid-template-columns:1fr;gap:0;}
    .wc-hero-trophy{height:220px;}
  }
  @media(max-width:640px){
    .wc-cg,.wc-vg,.wc-mg,.wc-fcg{grid-template-columns:1fr;}
    .wc-h1{font-size:2rem;}
    .wc-sp{padding:28px 20px;}
    .wc-final-team{font-size:1.4rem;}
    .wc-hero-trophy{display:none;}
    .wc-hero-inner{padding:120px 20px 48px;}
  }
`;

type ScheduleTab = "group" | "knockout" | "final";

export default function WorldCupPage() {
  const { venues } = useData();
  const [tab, setTab] = useState<ScheduleTab>("group");

  const matches = WORLD_CUP_SCHEDULE[tab];

  return (
    <div className="wc-page">
      <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />

      <FloatingNav />

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Hero Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <section className="wc-hero">
        <div className="wc-hero-bg" />
        <div className="wc-hero-orb" />
        <div className="wc-hero-inner">
          <div className="wc-hero-text">
            <div className="wc-kicker">
              <span className="bd" />World Cup 2026 Ã‚Â· Watch-Party Hub
            </div>
            <h1 className="wc-h1">
              World Cup 2026<br />
              <b>Watch Parties</b> &amp;<br />
              Fan Festivals
            </h1>
            <p className="wc-sub">
              Discover the best soccer venues, fan festivals, and match-day experiences across all 11 U.S. host cities.
              From Houston to New York Ã¢â‚¬â€ find your perfect watch party.
            </p>
            <div style={{ margin: "4px 0 28px" }}>
              <Countdown target={WC_OPENING} label="Kickoff Ã‚Â· Jun 11, 2026" />
            </div>
            <div className="wc-btns">
              <a href="#cities" className="wc-btn-p">
                <Trophy size={18} /> Explore Host Cities
              </a>
              <a href="#schedule" className="wc-btn-g">
                <Calendar size={16} /> Match Schedule
              </a>
              <Link href="/for-venues/register" className="wc-btn-g">
                <Building2 size={16} /> Become a Featured Venue
              </Link>
            </div>
            <div className="wc-stats">
              <div>
                <div className="wc-sv"><span>11</span></div>
                <div className="wc-sl">U.S. Host Cities</div>
              </div>
              <div>
                <div className="wc-sv"><span>104</span></div>
                <div className="wc-sl">Total Matches</div>
              </div>
              <div>
                <div className="wc-sv"><span>48</span></div>
                <div className="wc-sl">Nations</div>
              </div>
              <div>
                <div className="wc-sv">Jul <span>19</span></div>
                <div className="wc-sl">The Final Ã‚Â· NYC</div>
              </div>
            </div>
          </div>
          <figure className="wc-hero-trophy">
            <img src="/world-cup-emblem.png" alt="World Cup 2026" />
          </figure>
        </div>
      </section>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Match Schedule Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <section className="wc-scw" id="schedule">
        <div className="wc-wrap">
          <div className="wc-sh">
            <div className="wc-st">
              Match Schedule <span className="wc-sb">WC 2026</span>
            </div>
            <Link href="/matches" className="wc-sl2">
              All Matches <ChevronRight size={14} />
            </Link>
          </div>

          <div className="wc-tabs">
            {(["group", "knockout", "final"] as ScheduleTab[]).map(t => (
              <button key={t} className={`wc-tab${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>
                {t === "group" ? "This Week" : t === "knockout" ? "Knockouts" : "Final"}
              </button>
            ))}
          </div>

          {tab === "final" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {WORLD_CUP_SCHEDULE.final.map((m, i) => (
                <div key={i} className="wc-final-card">
                  <div className="wc-final-top">{m.group} Ã‚Â· {m.date} Ã‚Â· {m.time}</div>
                  <div className="wc-final-teams">
                    <div className="wc-final-team" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {WORLD_CUP_FLAGS[m.home] && <Flag code={WORLD_CUP_FLAGS[m.home]} />}
                      {m.home}
                    </div>
                    <div className="wc-final-vs">VS</div>
                    <div className="wc-final-team" style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
                      {m.away}
                      {WORLD_CUP_FLAGS[m.away] && <Flag code={WORLD_CUP_FLAGS[m.away]} />}
                    </div>
                  </div>
                  <div className="wc-final-meta">
                    <div>{m.venue}</div>
                    <div><span>{m.city}</span></div>
                    {m.tag && <div style={{ marginLeft: "auto" }}><span>{m.tag}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="wc-mg">
              {matches.map((m, i) => (
                <Link key={i} href="/matches" className="wc-mc">
                  <div className="wc-mc-top">
                    <span>{m.group}</span>
                    {m.tag ? <span className="wc-mc-tag">{m.tag}</span> : <span>{m.date}</span>}
                  </div>
                  <div className="wc-mc-teams">
                    <div className="wc-mc-team">
                      {WORLD_CUP_FLAGS[m.home] && <Flag code={WORLD_CUP_FLAGS[m.home]} />}
                      {m.home}
                    </div>
                    <div className="wc-mc-vs">VS</div>
                    <div className="wc-mc-team away">
                      {WORLD_CUP_FLAGS[m.away] && <Flag code={WORLD_CUP_FLAGS[m.away]} />}
                      {m.away}
                    </div>
                  </div>
                  <div className="wc-mc-foot">
                    <span>{m.date} Ã‚Â· {m.time}</span>
                    <span className="city">{m.city}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ 11 Host Cities Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <section className="wc-cw" id="cities">
        <div className="wc-wrap">
          <div className="wc-sh">
            <div className="wc-st">
              11 Host Cities <span className="wc-sb">WC 2026</span>
            </div>
            <Link href="/venues" className="wc-sl2">
              All Venues <ChevronRight size={14} />
            </Link>
          </div>
          <div className="wc-cg">
            {CITIES.map(c => {
              const watchParties = cityVenueCount(venues, cityAliases(c.name));
              return (
              <Link
                key={c.short}
                href={`/world-cup/${c.slug}`}
                className="wc-cc"
              >
                <div
                  className="wc-cbg"
                  style={{ background: `url(${c.image}) center / cover no-repeat, ${c.g}` }}
                />
                <div className="wc-cov" />
                <div className="wc-ci">
                  <span className="wc-cbadge">{c.badge}</span>
                  <div className="wc-cn">{c.name}</div>
                  <div className="wc-cs">{c.stadium} Ã‚Â· {c.cap}</div>
                  <div className="wc-cm">
                    <div className="wc-cmn">
                      <span className="n">{c.matches}</span> matches
                      {watchParties > 0 && <> Ã‚Â· <span className="n">{watchParties}</span> venues</>}
                    </div>
                    <div className="wc-cex">
                      Explore <ChevronRight size={12} />
                    </div>
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Venue Registration CTA Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <section className="wc-spw">
        <div className="wc-wrap">
          <div className="wc-sp">
            <div>
              <div className="wc-spk">For Bars, Restaurants &amp; Event Spaces</div>
              <div className="wc-sph2">Host a World Cup Watch Party</div>
              <p className="wc-spp">
                Register your venue on MatchWatch to get discovered by thousands of soccer fans searching for
                World Cup watch parties across all 11 U.S. host cities. List your events, manage bookings,
                and fill every seat this summer.
              </p>
            </div>
            <div className="wc-spb">
              <Link href="/for-venues/register" className="wc-orange" style={{ justifyContent: "center" }}>
                <Building2 size={15} /> Register Your Venue Ã¢â‚¬â€ Free
              </Link>
              <Link href="/for-venues" className="wc-spbtn">
                <Star size={15} /> Become a Featured Venue
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ FIFA Fan Festival Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <section className="wc-fw">
        <div className="wc-wrap">
          <div className="wc-fb">
            <div>
              <div className="wc-spk">Official Events</div>
              <div className="wc-fh2">FIFA Fan FestivalsÃ¢â€žÂ¢</div>
              <p className="wc-fp">
                FIFA Fan Festivals are free, official events held in host cities throughout the tournament Ã¢â‚¬â€
                live match screenings, entertainment, food, and activities for all fans.
              </p>
              <a
                href="https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026"
                target="_blank"
                rel="noopener noreferrer"
                className="wc-orange"
                style={{ textDecoration: "none" }}
              >
                <Globe size={14} /> Official FIFA Site
              </a>
            </div>
            <div>
              <div style={{
                fontFamily: '"JetBrains Mono",monospace', fontSize: 10, letterSpacing: ".14em",
                textTransform: "uppercase", color: "var(--mw-accent)", marginBottom: 14, fontWeight: 700,
              }}>
                Official Fan Festival Pages
              </div>
              <div className="wc-fcg">
                {FAN_FESTIVALS.map(festival => (
                  <Link key={festival.slug} href={`/world-cup/${festival.slug}/fan-festival`} className="wc-fci">
                    <div className="d" />
                    <div>
                      <div className="wc-fn">{festival.city}</div>
                      <div className="wc-fm">
                        <b>{festival.venue}</b><br />
                        {festival.dates} Ã‚Â· {festival.detail}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
