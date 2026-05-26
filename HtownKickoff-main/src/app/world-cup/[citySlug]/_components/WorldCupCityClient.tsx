"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ExternalLink, Shield } from "lucide-react";
import type { WorldCupCity, CityMatch, CityVenue, VenueSolutionPackage, VendorSolution } from "../types";
import { CityHero } from "./CityHero";
import { CityMatchSchedule } from "./CityMatchSchedule";
import { CityVenueGrid } from "./CityVenueGrid";
import { CityVenueMap } from "./CityVenueMap";
import { CityActionCTAs } from "./CityActionCTAs";
import { FloatingNav } from "@/components/AppShell";
import { useData, type Venue } from "@/lib/data-provider";

const FAN_FEST_CITIES: Record<string, { name: string; venue: string; addr: string; dates: string; officialSite: string }> = {
  seattle: {
    name: "Seattle",
    venue: "Seattle Center — The Armory & Mural Amphitheatre",
    addr: "305 Harrison St, Seattle, WA 98109",
    dates: "Jun–Jul 2026 · All Match Days · Free Admission",
    officialSite: "https://www.seattlecenter.com/events/lets-play-sea-26",
  },
  houston: {
    name: "Houston",
    venue: "FIFA Fan Festival™ Houston — EaDo",
    addr: "East Downtown (EaDo), near Shell Energy Stadium, Houston, TX",
    dates: "Jun 11 – Jul 19, 2026 · All 34 Match Days · Free Admission",
    officialSite: "https://www.fwc26houston.com/fifafanfestivalhou",
  },
  dallas: {
    name: "Dallas",
    venue: "FIFA Fan Festival™ Dallas — Fair Park",
    addr: "Fair Park, Lots 9 & 10, The Pavilion, Dallas, TX 75210",
    dates: "Jun 11 – Jul 19, 2026 · Free Admission · 35,000 Capacity",
    officialSite: "https://www.dallasfwc26.com/our-venues/fan-festival/",
  },
  miami: {
    name: "Miami",
    venue: "FIFA Fan Festival™ Miami — Bayfront Park",
    addr: "301 N Biscayne Blvd, Miami, FL 33132",
    dates: "Jun 13 – Jul 5, 2026 · Free Admission · 30,000 Daily Capacity",
    officialSite: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/fifa-fan-festival/miami",
  },
  atlanta: {
    name: "Atlanta",
    venue: "FIFA Fan Festival™ Atlanta — Centennial Olympic Park",
    addr: "265 Park Ave SW, Atlanta, GA 30313",
    dates: "Jun 11 – Jul 15, 2026 · Free Entry · Registration Required",
    officialSite: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/fifa-fan-festival/atlanta",
  },
  "new-york": {
    name: "New York / New Jersey",
    venue: "NYNJ World Cup 26 & Telemundo Fan Village — Rockefeller Center",
    addr: "30 Rockefeller Plaza, New York, NY 10112",
    dates: "Jul 6 – Jul 19, 2026 · Open to the Public",
    officialSite: "https://www.rockefellercenter.com/events/world-cup-2026",
  },
};

function toStaticVenue(v: Venue, citySlug: string): CityVenue {
  const ams = v.amenities.map((a) => a.toLowerCase());
  const hasDj = ams.some((a) => a.includes("dj") || a.includes("entertain") || a.includes("music") || a.includes("live"));
  const hasFood = ams.some((a) => a.includes("food") || a.includes("bar") || a.includes("drink") || a.includes("restaurant") || a.includes("kitchen") || a.includes("pub"));
  const hasOutdoor = ams.some((a) => a.includes("outdoor") || a.includes("patio") || a.includes("roof") || a.includes("garden") || a.includes("terrace"));
  const hasIndoor = ams.some((a) => a.includes("indoor") || a.includes("inside"));
  const indoorOutdoor = hasOutdoor && hasIndoor ? "Both" : hasOutdoor ? "Outdoor" : "Indoor";
  return {
    id: v.id,
    citySlug,
    name: v.name,
    slug: v.slug,
    type: v.cuisineTags?.[0] || "Venue",
    address: v.addressLine1 || v.city,
    lat: v.lat,
    lng: v.lng,
    capacity: v.capacity || undefined,
    foodAndDrink: hasFood,
    djAvailable: hasDj,
    indoorOutdoor,
    watchPartyReady: v.isVerified || v.isFeatured,
  };
}

interface Props {
  city: WorldCupCity;
  matches: CityMatch[];
  packages: VenueSolutionPackage[];
  vendors: VendorSolution[];
}

const CSS = `
  /* Dark-by-default theme vars — scoped to .cc-page so they don't leak */
  .cc-page {
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
    color-scheme: dark;
  }
  /* Light mode overrides — applied when ThemeProvider adds .light to <html> */
  .light .cc-page {
    --mw-bg: #f4f5f7;
    --mw-bg-1: #ffffff;
    --mw-bg-2: #eef0f3;
    --mw-bg-3: #e4e7ec;
    --mw-line: #d0d5dd;
    --mw-line-2: #b8bec9;
    --mw-fg: #111317;
    --mw-fg-dim: #3d4350;
    --mw-fg-mute: #717788;
    color-scheme: light;
  }

  /* ── Page ── */
  .cc-page { background: var(--mw-bg); min-height: 100vh; color: var(--mw-fg); }
  .cc-wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; width: 100%; }

  /* ── Sections ── */
  .cc-section { padding: 72px 0; border-bottom: 1px solid var(--mw-line); }
  .cc-section:last-child { border-bottom: none; }
  .cc-sh { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 36px; flex-wrap: wrap; }
  .cc-st { font-family: "Space Grotesk", sans-serif; font-weight: 900; font-size: clamp(1.4rem, 2.8vw, 2rem); color: var(--mw-fg); margin: 0 0 6px; letter-spacing: -0.01em; }
  .cc-ss { font-size: 0.95rem; color: var(--mw-fg-dim); line-height: 1.55; margin: 0; max-width: 600px; }
  .cc-link-sm { font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mw-fg-mute); text-decoration: none; white-space: nowrap; transition: color 0.15s; }
  .cc-link-sm:hover { color: var(--mw-accent); }

  /* ── Buttons ── */
  .cc-btn-p { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 22px; border-radius: 999px; font-size: 13px; font-weight: 800; text-decoration: none; background: var(--mw-accent); color: #0a0b0d; transition: all 0.2s; border: none; cursor: pointer; }
  .cc-btn-p:hover { transform: translateY(-1px); box-shadow: 0 10px 28px color-mix(in srgb, var(--mw-accent) 32%, transparent); }
  .cc-btn-g { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 22px; border-radius: 999px; font-size: 13px; font-weight: 700; text-decoration: none; border: 1px solid var(--mw-line-2); color: var(--mw-fg-dim); transition: all 0.2s; background: transparent; cursor: pointer; }
  .cc-btn-g:hover { border-color: var(--mw-fg-dim); color: var(--mw-fg); }
  .cc-btn-sm { padding: 7px 14px; font-size: 12px; }
  .cc-btn-full { width: 100%; }

  /* ── Hero — always dark regardless of theme ── */
  .cc-hero { position: relative; overflow: hidden; min-height: 520px; display: flex; align-items: center; background: linear-gradient(160deg, #0a0b0d 0%, #0d1520 40%, #1a0a05 100%); border-bottom: 1px solid #23272f; padding-top: var(--site-nav-height, 64px); }
  .cc-hero .cc-h1 { color: #f1ece4; }
  .cc-hero .cc-sub { color: #a8a59d; }
  .cc-hero .cc-kicker { color: oklch(0.72 0.19 28); border-color: color-mix(in srgb, oklch(0.72 0.19 28) 30%, transparent); }
  .cc-hero .cc-stats { border-color: #23272f; }
  .cc-hero .cc-sv { color: #f1ece4; }
  .cc-hero .cc-sl { color: #6c6a64; }
  .cc-hero::before { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse 80% 60% at 70% 50%, color-mix(in srgb, var(--mw-accent) 10%, transparent), transparent 70%), radial-gradient(ellipse 60% 80% at 20% 30%, rgba(0, 80, 160, 0.12), transparent 70%); pointer-events: none; }
  .cc-hero-inner { position: relative; z-index: 2; max-width: 1080px; margin: 0 auto; padding: 80px 24px 56px; width: 100%; display: grid; grid-template-columns: 1fr 260px; gap: 48px; align-items: center; }
  .cc-hero-text { display: flex; flex-direction: column; }
  .cc-kicker { display: inline-flex; align-items: center; gap: 8px; font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--mw-accent); font-weight: 700; margin-bottom: 18px; border: 1px solid color-mix(in srgb, var(--mw-accent) 30%, transparent); padding: 5px 12px; border-radius: 999px; width: fit-content; }
  .cc-kicker .bd { width: 6px; height: 6px; background: var(--mw-accent); border-radius: 50%; animation: ccbd 1.4s ease-in-out infinite; }
  @keyframes ccbd { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
  .cc-h1 { font-size: clamp(1.9rem, 4.5vw, 3.4rem); font-weight: 900; line-height: 1.05; color: var(--mw-fg); margin: 0 0 14px; letter-spacing: -0.02em; font-family: "Space Grotesk", sans-serif; }
  .cc-h1 b { color: var(--mw-accent); }
  .cc-sub { font-size: 1rem; color: var(--mw-fg-dim); line-height: 1.6; max-width: 520px; margin-bottom: 28px; }
  .cc-btns { display: flex; flex-wrap: wrap; gap: 10px; }
  .cc-hero-biz-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 16px; font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.08em; color: #6c6a64; text-decoration: none; transition: color .15s; width: fit-content; }
  .cc-hero-biz-link:hover { color: oklch(0.72 0.19 28); }
  .cc-stats { display: flex; gap: 28px; flex-wrap: wrap; margin-top: 44px; padding-top: 32px; border-top: 1px solid var(--mw-line); }
  .cc-sv { font-size: 1.7rem; font-weight: 900; color: var(--mw-fg); line-height: 1; font-family: "Space Grotesk", sans-serif; }
  .cc-sv span { color: var(--mw-accent); }
  .cc-sl { font-size: 0.75rem; color: var(--mw-fg-mute); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
  .cc-hero-emblem { display: flex; align-items: center; justify-content: center; height: 280px; }
  .cc-hero-emblem img { width: min(220px, 100%); height: auto; display: block; filter: drop-shadow(0 0 24px rgba(212, 160, 20, 0.35)) drop-shadow(0 0 56px rgba(212, 140, 10, 0.18)); }

  /* ── Match Cards ── */
  .cc-match-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .cc-match-card { background: color-mix(in srgb, var(--mw-accent) 7%, var(--mw-bg-1)); border: 1px solid color-mix(in srgb, var(--mw-accent) 22%, var(--mw-line)); border-left: 3px solid var(--mw-accent); padding: 18px; display: flex; flex-direction: column; gap: 14px; transition: border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s; }
  .cc-match-card:hover { border-color: color-mix(in srgb, var(--mw-accent) 55%, var(--mw-line)); background: color-mix(in srgb, var(--mw-accent) 11%, var(--mw-bg-1)); transform: translateY(-2px); box-shadow: 0 8px 28px color-mix(in srgb, var(--mw-accent) 15%, transparent); }
  .cc-match-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .cc-stage { font-family: "JetBrains Mono", monospace; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mw-accent); background: color-mix(in srgb, var(--mw-accent) 15%, transparent); border: 1px solid color-mix(in srgb, var(--mw-accent) 28%, transparent); padding: 3px 8px; white-space: nowrap; }
  .cc-match-dt { font-size: 10px; color: var(--mw-fg-dim); font-family: "JetBrains Mono", monospace; text-align: right; line-height: 1.5; font-weight: 700; }
  .cc-match-body { display: flex; flex-direction: column; gap: 10px; }
  .cc-match-team { display: flex; align-items: center; gap: 8px; }
  .cc-match-tname { font-size: 15px; font-weight: 800; color: var(--mw-fg); font-family: "Space Grotesk", sans-serif; }
  .cc-match-tbd { font-size: 13px; font-weight: 600; color: var(--mw-fg-mute); font-style: italic; }
  .cc-match-vs { font-size: 9px; font-weight: 700; color: var(--mw-fg-mute); text-transform: uppercase; letter-spacing: 0.1em; font-family: "JetBrains Mono", monospace; padding-left: 32px; }
  .cc-match-stadium { font-size: 10px; color: var(--mw-fg-dim); font-weight: 600; }

  /* ── Venue Grid ── */
  .cc-vg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .cc-vc { background: var(--mw-bg-1); border: 1px solid var(--mw-line); padding: 20px; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.15s, background 0.15s; }
  .cc-vc:hover { border-color: color-mix(in srgb, var(--mw-accent) 30%, transparent); background: var(--mw-bg-2); }
  .cc-vc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .cc-vc-name { font-size: 15px; font-weight: 800; color: var(--mw-fg); font-family: "Space Grotesk", sans-serif; line-height: 1.2; }
  .cc-vc-type { display: inline-flex; align-items: center; padding: 3px 8px; font-size: 10px; font-weight: 600; background: var(--mw-bg-3); color: var(--mw-fg-mute); border: 1px solid var(--mw-line); white-space: nowrap; }
  .cc-vc-addr { font-size: 11px; color: var(--mw-fg-mute); line-height: 1.4; }
  .cc-vc-feats { display: flex; flex-wrap: wrap; gap: 5px; }
  .cc-chip { display: inline-flex; align-items: center; gap: 3px; padding: 3px 7px; font-size: 10px; font-weight: 600; background: var(--mw-bg-3); color: var(--mw-fg-dim); border: 1px solid var(--mw-line); }
  .cc-wp-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; background: rgba(34, 197, 94, 0.12); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.25); white-space: nowrap; }
  .cc-vc-btns { display: flex; gap: 7px; margin-top: auto; }

  /* ── Empty state ── */
  .cc-empty { text-align: center; padding: 64px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; border: 1px dashed var(--mw-line); }
  .cc-empty-icon { font-size: 3rem; }
  .cc-empty-title { font-size: 1.1rem; font-weight: 800; color: var(--mw-fg); font-family: "Space Grotesk", sans-serif; }
  .cc-empty-body { font-size: 0.9rem; color: var(--mw-fg-dim); max-width: 360px; line-height: 1.5; }

  /* ── Map — isolation contains Leaflet's high z-indexes (200–600) ── */
  .cc-map-outer { border: 1px solid var(--mw-line); overflow: hidden; position: relative; isolation: isolate; z-index: 0; }

  /* ── Packages ── */
  .cc-pkg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .cc-pkg { background: var(--mw-bg-1); border: 1px solid var(--mw-line); padding: 24px; display: flex; flex-direction: column; gap: 18px; transition: border-color 0.15s; }
  .cc-pkg.featured { border-color: color-mix(in srgb, var(--mw-accent) 45%, transparent); background: color-mix(in srgb, var(--mw-accent) 5%, var(--mw-bg-1)); }
  .cc-pkg-badge { display: inline-flex; align-items: center; gap: 5px; font-family: "JetBrains Mono", monospace; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mw-accent); border: 1px solid color-mix(in srgb, var(--mw-accent) 30%, transparent); padding: 3px 8px; width: fit-content; }
  .cc-pkg-head { display: flex; flex-direction: column; gap: 8px; }
  .cc-pkg-name { font-size: 16px; font-weight: 800; color: var(--mw-fg); font-family: "Space Grotesk", sans-serif; }
  .cc-pkg-desc { font-size: 13px; color: var(--mw-fg-dim); line-height: 1.5; }
  .cc-pkg-inc { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 7px; flex: 1; }
  .cc-pkg-inc li { font-size: 12px; color: var(--mw-fg-dim); display: flex; align-items: flex-start; gap: 7px; }
  .cc-pkg-inc li::before { content: "✓"; color: #22c55e; font-weight: 800; font-size: 12px; flex-shrink: 0; margin-top: 1px; }
  .cc-pkg-cta { margin-top: auto; }

  /* ── Vendor Grid ── */
  .cc-vs-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
  .cc-vs { background: var(--mw-bg-1); border: 1px solid var(--mw-line); padding: 18px; display: flex; flex-direction: column; gap: 10px; transition: border-color 0.15s; }
  .cc-vs:hover { border-color: var(--mw-line-2); }
  .cc-vs-icon { width: 40px; height: 40px; background: color-mix(in srgb, var(--mw-accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--mw-accent) 20%, transparent); display: flex; align-items: center; justify-content: center; color: var(--mw-accent); }
  .cc-vs-name { font-size: 13px; font-weight: 700; color: var(--mw-fg); font-family: "Space Grotesk", sans-serif; }
  .cc-vs-desc { font-size: 11px; color: var(--mw-fg-mute); line-height: 1.4; flex: 1; }

  /* ── CTA Sections ── */
  .cc-fcta { background: var(--mw-bg-1); border-top: 1px solid var(--mw-line); border-bottom: 1px solid var(--mw-line); }
  .cc-fcta-inner { max-width: 680px; text-align: center; margin: 0 auto; padding: 72px 24px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .cc-fcta-title { font-size: clamp(1.4rem, 2.8vw, 2.1rem); font-weight: 900; color: var(--mw-fg); font-family: "Space Grotesk", sans-serif; letter-spacing: -0.02em; margin: 0; line-height: 1.15; }
  .cc-fcta-body { font-size: 0.95rem; color: var(--mw-fg-dim); max-width: 500px; line-height: 1.6; margin: 0; }
  .cc-fcta-btns { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 6px; }
  .cc-scta { background: linear-gradient(135deg, #0d1520 0%, #1a0a05 100%); border-top: 1px solid var(--mw-line); }
  .cc-scta-inner { max-width: 680px; text-align: center; margin: 0 auto; padding: 72px 24px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .cc-scta-badge { display: inline-flex; align-items: center; gap: 5px; font-family: "JetBrains Mono", monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--mw-accent); border: 1px solid color-mix(in srgb, var(--mw-accent) 30%, transparent); padding: 5px 12px; }
  .cc-scta-title { font-size: clamp(1.4rem, 2.8vw, 2.1rem); font-weight: 900; color: var(--mw-fg); font-family: "Space Grotesk", sans-serif; letter-spacing: -0.02em; margin: 0; line-height: 1.15; }
  .cc-scta-body { font-size: 0.95rem; color: var(--mw-fg-dim); max-width: 500px; line-height: 1.6; margin: 0; }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .cc-pkg-grid { grid-template-columns: repeat(2, 1fr); }
    .cc-vs-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 900px) {
    .cc-hero-inner { grid-template-columns: 1fr; }
    .cc-hero-emblem { display: none; }
    .cc-match-grid { grid-template-columns: repeat(2, 1fr); }
    .cc-vg { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 640px) {
    .cc-section { padding: 52px 0; }
    .cc-match-grid { grid-template-columns: 1fr; }
    .cc-vg { grid-template-columns: 1fr; }
    .cc-pkg-grid { grid-template-columns: 1fr; }
    .cc-vs-grid { grid-template-columns: repeat(2, 1fr); }
    .cc-sh { flex-direction: column; align-items: flex-start; gap: 12px; }
    .cc-vc-btns { flex-direction: column; }
    .cc-btn-full { width: 100%; }
  }
`;

const FAN_FEST_CSS = `
  .cc-fanfest-banner{border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 30%,transparent);background:linear-gradient(120deg,color-mix(in srgb,oklch(0.72 0.19 28) 6%,transparent),transparent),var(--mw-bg-1);padding:22px 28px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:28px;}
  .cc-fanfest-left{display:flex;align-items:center;gap:16px;}
  .cc-fanfest-icon{width:44px;height:44px;background:oklch(0.72 0.19 28);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0a0b0d;flex-shrink:0;}
  .cc-fanfest-label{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.72 0.19 28);font-weight:700;margin-bottom:3px;}
  .cc-fanfest-name{font-family:"Space Grotesk",sans-serif;font-size:16px;font-weight:800;color:var(--mw-fg);}
  .cc-fanfest-meta{font-size:12px;color:var(--mw-fg-mute);}
  .cc-fanfest-btns{display:flex;gap:10px;flex-wrap:wrap;}
`;

function FanFestBanner({ citySlug }: { citySlug: string }) {
  const ff = FAN_FEST_CITIES[citySlug];
  if (!ff) return null;
  return (
    <div className="cc-fanfest-banner">
      <div className="cc-fanfest-left">
        <div className="cc-fanfest-icon"><Shield size={20} /></div>
        <div>
          <div className="cc-fanfest-label">Official FIFA Fan Festival™ · {ff.name}</div>
          <div className="cc-fanfest-name">{ff.venue}</div>
          <div className="cc-fanfest-meta">{ff.addr} · {ff.dates}</div>
        </div>
      </div>
      <div className="cc-fanfest-btns">
        <Link href={`/world-cup/${citySlug}/fan-festival`} className="cc-btn-p" style={{ textDecoration: "none" }}>
          <Shield size={13} /> View Fan Festival
        </Link>
        <a href={ff.officialSite} target="_blank" rel="noopener noreferrer" className="cc-btn-g" style={{ textDecoration: "none" }}>
          <ExternalLink size={13} /> Official Site
        </a>
      </div>
    </div>
  );
}

export function WorldCupCityClient({ city, matches, packages, vendors }: Props) {
  const { venues: allVenues } = useData();

  const allCityVenues = useMemo(
    () => allVenues.filter((v) => v.city?.toLowerCase().includes(city.name.toLowerCase())),
    [allVenues, city.name],
  );

  const cityVenues = useMemo(
    () => allCityVenues
      .filter((v) => !v.amenities?.includes("OFFICIAL_FAN_FEST"))
      .map((v) => toStaticVenue(v, city.slug)),
    [allCityVenues, city.slug],
  );

  return (
    <>
      <style>{CSS + FAN_FEST_CSS}</style>
      <FloatingNav />
      <main className="cc-page">
        <CityHero city={city} matches={matches} />

        <CityMatchSchedule
          matches={matches}
          citySlug={city.slug}
          stadiumName={city.stadiumName}
          matchCount={city.matchCount}
          cityName={city.name}
        />

        <CityVenueGrid
          venues={cityVenues}
          citySlug={city.slug}
          cityName={city.name}
          topSlot={<FanFestBanner citySlug={city.slug} />}
        />

        <CityVenueMap
          venues={cityVenues}
          citySlug={city.slug}
          cityName={city.name}
          centerLat={city.lat}
          centerLng={city.lng}
          zoom={city.zoom}
        />

        <CityActionCTAs citySlug={city.slug} cityName={city.name} />
      </main>
    </>
  );
}
