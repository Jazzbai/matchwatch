"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";

// ─── Static WC2026 Data ─────────────────────────

const GROUPS: { name: string; teams: { iso2: string; name: string; fifa: string }[] }[] = [
    { name: "A", teams: [{ iso2: "US", name: "United States", fifa: "USA" }, { iso2: "GB", name: "England", fifa: "ENG" }, { iso2: "DZ", name: "Algeria", fifa: "ALG" }, { iso2: "JO", name: "Jordan", fifa: "JOR" }] },
    { name: "B", teams: [{ iso2: "MX", name: "Mexico", fifa: "MEX" }, { iso2: "AR", name: "Argentina", fifa: "ARG" }, { iso2: "MA", name: "Morocco", fifa: "MAR" }, { iso2: "NZ", name: "New Zealand", fifa: "NZL" }] },
    { name: "C", teams: [{ iso2: "CA", name: "Canada", fifa: "CAN" }, { iso2: "BR", name: "Brazil", fifa: "BRA" }, { iso2: "BE", name: "Belgium", fifa: "BEL" }, { iso2: "PA", name: "Panama", fifa: "PAN" }] },
    { name: "D", teams: [{ iso2: "FR", name: "France", fifa: "FRA" }, { iso2: "KR", name: "South Korea", fifa: "KOR" }, { iso2: "UY", name: "Uruguay", fifa: "URU" }, { iso2: "HN", name: "Honduras", fifa: "HON" }] },
    { name: "E", teams: [{ iso2: "DE", name: "Germany", fifa: "GER" }, { iso2: "JP", name: "Japan", fifa: "JPN" }, { iso2: "ZA", name: "South Africa", fifa: "RSA" }, { iso2: "CR", name: "Costa Rica", fifa: "CRC" }] },
    { name: "F", teams: [{ iso2: "ES", name: "Spain", fifa: "ESP" }, { iso2: "AU", name: "Australia", fifa: "AUS" }, { iso2: "CO", name: "Colombia", fifa: "COL" }, { iso2: "TN", name: "Tunisia", fifa: "TUN" }] },
    { name: "G", teams: [{ iso2: "PT", name: "Portugal", fifa: "POR" }, { iso2: "NL", name: "Netherlands", fifa: "NED" }, { iso2: "SN", name: "Senegal", fifa: "SEN" }, { iso2: "GH", name: "Ghana", fifa: "GHA" }] },
    { name: "H", teams: [{ iso2: "IT", name: "Italy", fifa: "ITA" }, { iso2: "EG", name: "Egypt", fifa: "EGY" }, { iso2: "EC", name: "Ecuador", fifa: "ECU" }, { iso2: "RS", name: "Serbia", fifa: "SRB" }] },
    { name: "I", teams: [{ iso2: "HR", name: "Croatia", fifa: "CRO" }, { iso2: "IR", name: "Iran", fifa: "IRN" }, { iso2: "VE", name: "Venezuela", fifa: "VEN" }, { iso2: "SK", name: "Slovakia", fifa: "SVK" }] },
    { name: "J", teams: [{ iso2: "CH", name: "Switzerland", fifa: "SUI" }, { iso2: "NG", name: "Nigeria", fifa: "NGA" }, { iso2: "CL", name: "Chile", fifa: "CHI" }, { iso2: "ML", name: "Mali", fifa: "MLI" }] },
    { name: "K", teams: [{ iso2: "HU", name: "Hungary", fifa: "HUN" }, { iso2: "CM", name: "Cameroon", fifa: "CMR" }, { iso2: "SA", name: "Saudi Arabia", fifa: "KSA" }, { iso2: "UZ", name: "Uzbekistan", fifa: "UZB" }] },
    { name: "L", teams: [{ iso2: "SC", name: "Scotland", fifa: "SCO" }, { iso2: "QA", name: "Qatar", fifa: "QAT" }, { iso2: "DK", name: "Denmark", fifa: "DEN" }, { iso2: "AT", name: "Austria", fifa: "AUT" }] },
];

const STADIUMS = [
    { name: "MetLife Stadium",              city: "East Rutherford",  country: "USA",    capacity: 82_500, flag: "us" },
    { name: "AT&T Stadium",                 city: "Arlington, TX",    country: "USA",    capacity: 80_000, flag: "us" },
    { name: "SoFi Stadium",                 city: "Inglewood, CA",    country: "USA",    capacity: 70_240, flag: "us" },
    { name: "Levi's Stadium",               city: "Santa Clara, CA",  country: "USA",    capacity: 68_500, flag: "us" },
    { name: "Lincoln Financial Field",      city: "Philadelphia, PA", country: "USA",    capacity: 69_800, flag: "us" },
    { name: "Arrowhead Stadium",            city: "Kansas City, MO",  country: "USA",    capacity: 76_416, flag: "us" },
    { name: "Empower Field at Mile High",   city: "Denver, CO",       country: "USA",    capacity: 76_125, flag: "us" },
    { name: "Hard Rock Stadium",            city: "Miami Gardens, FL",country: "USA",    capacity: 65_326, flag: "us" },
    { name: "Allegiant Stadium",            city: "Las Vegas, NV",    country: "USA",    capacity: 65_000, flag: "us" },
    { name: "NRG Stadium",                  city: "Houston, TX",      country: "USA",    capacity: 72_220, flag: "us" },
    { name: "Lumen Field",                  city: "Seattle, WA",      country: "USA",    capacity: 68_740, flag: "us" },
    { name: "Estadio Azteca",               city: "Mexico City",      country: "Mexico", capacity: 87_523, flag: "mx" },
    { name: "Estadio BBVA",                 city: "Monterrey",        country: "Mexico", capacity: 53_500, flag: "mx" },
    { name: "Estadio Akron",                city: "Guadalajara",      country: "Mexico", capacity: 49_850, flag: "mx" },
    { name: "BMO Field",                    city: "Toronto",          country: "Canada", capacity: 45_736, flag: "ca" },
    { name: "BC Place",                     city: "Vancouver",        country: "Canada", capacity: 54_500, flag: "ca" },
];

// Hard-coded WC2026 group stage schedule
const WC_FIXTURES = [
    // ── Matchday 1 ──
    { date: "2026-06-11", time: "18:00", home: "US", away: "JO", homeN: "United States", awayN: "Jordan",       group: "A", stadium: "MetLife Stadium",            city: "East Rutherford" },
    { date: "2026-06-12", time: "15:00", home: "GB", away: "DZ", homeN: "England",       awayN: "Algeria",      group: "A", stadium: "AT&T Stadium",                city: "Arlington, TX" },
    { date: "2026-06-13", time: "18:00", home: "MX", away: "NZ", homeN: "Mexico",        awayN: "New Zealand",  group: "B", stadium: "Estadio Azteca",              city: "Mexico City" },
    { date: "2026-06-13", time: "21:00", home: "AR", away: "MA", homeN: "Argentina",     awayN: "Morocco",      group: "B", stadium: "SoFi Stadium",                city: "Inglewood, CA" },
    { date: "2026-06-14", time: "15:00", home: "CA", away: "BE", homeN: "Canada",        awayN: "Belgium",      group: "C", stadium: "BMO Field",                   city: "Toronto" },
    { date: "2026-06-14", time: "18:00", home: "BR", away: "PA", homeN: "Brazil",        awayN: "Panama",       group: "C", stadium: "Hard Rock Stadium",           city: "Miami Gardens, FL" },
    { date: "2026-06-15", time: "15:00", home: "FR", away: "HN", homeN: "France",        awayN: "Honduras",     group: "D", stadium: "MetLife Stadium",            city: "East Rutherford" },
    { date: "2026-06-15", time: "18:00", home: "KR", away: "UY", homeN: "South Korea",   awayN: "Uruguay",      group: "D", stadium: "Lincoln Financial Field",     city: "Philadelphia, PA" },
    { date: "2026-06-16", time: "18:00", home: "DE", away: "CR", homeN: "Germany",       awayN: "Costa Rica",   group: "E", stadium: "Levi's Stadium",              city: "Santa Clara, CA" },
    { date: "2026-06-16", time: "21:00", home: "JP", away: "ZA", homeN: "Japan",         awayN: "South Africa", group: "E", stadium: "Lumen Field",                 city: "Seattle, WA" },
    { date: "2026-06-17", time: "15:00", home: "ES", away: "TN", homeN: "Spain",         awayN: "Tunisia",      group: "F", stadium: "AT&T Stadium",                city: "Arlington, TX" },
    { date: "2026-06-17", time: "18:00", home: "CO", away: "AU", homeN: "Colombia",      awayN: "Australia",    group: "F", stadium: "NRG Stadium",                 city: "Houston, TX" },
    { date: "2026-06-18", time: "18:00", home: "PT", away: "GH", homeN: "Portugal",      awayN: "Ghana",        group: "G", stadium: "Allegiant Stadium",           city: "Las Vegas, NV" },
    { date: "2026-06-18", time: "21:00", home: "NL", away: "SN", homeN: "Netherlands",   awayN: "Senegal",      group: "G", stadium: "Empower Field at Mile High",  city: "Denver, CO" },
    { date: "2026-06-19", time: "15:00", home: "IT", away: "EC", homeN: "Italy",         awayN: "Ecuador",      group: "H", stadium: "BC Place",                    city: "Vancouver" },
    { date: "2026-06-19", time: "18:00", home: "EG", away: "RS", homeN: "Egypt",         awayN: "Serbia",       group: "H", stadium: "Estadio BBVA",                city: "Monterrey" },
    { date: "2026-06-20", time: "18:00", home: "HR", away: "SK", homeN: "Croatia",       awayN: "Slovakia",     group: "I", stadium: "Empower Field at Mile High",  city: "Denver, CO" },
    { date: "2026-06-20", time: "21:00", home: "IR", away: "VE", homeN: "Iran",          awayN: "Venezuela",    group: "I", stadium: "Estadio Akron",               city: "Guadalajara" },
    { date: "2026-06-21", time: "15:00", home: "CH", away: "CL", homeN: "Switzerland",   awayN: "Chile",        group: "J", stadium: "Lincoln Financial Field",     city: "Philadelphia, PA" },
    { date: "2026-06-21", time: "18:00", home: "NG", away: "ML", homeN: "Nigeria",       awayN: "Mali",         group: "J", stadium: "NRG Stadium",                 city: "Houston, TX" },
    { date: "2026-06-22", time: "18:00", home: "HU", away: "UZ", homeN: "Hungary",       awayN: "Uzbekistan",   group: "K", stadium: "Levi's Stadium",              city: "Santa Clara, CA" },
    { date: "2026-06-22", time: "21:00", home: "CM", away: "SA", homeN: "Cameroon",      awayN: "Saudi Arabia", group: "K", stadium: "Arrowhead Stadium",           city: "Kansas City, MO" },
    { date: "2026-06-23", time: "18:00", home: "SC", away: "AT", homeN: "Scotland",      awayN: "Austria",      group: "L", stadium: "Arrowhead Stadium",           city: "Kansas City, MO" },
    { date: "2026-06-23", time: "21:00", home: "QA", away: "DK", homeN: "Qatar",         awayN: "Denmark",      group: "L", stadium: "MetLife Stadium",            city: "East Rutherford" },
    // ── Matchday 2 ──
    { date: "2026-06-25", time: "15:00", home: "US", away: "DZ", homeN: "United States", awayN: "Algeria",      group: "A", stadium: "NRG Stadium",                city: "Houston, TX" },
    { date: "2026-06-25", time: "18:00", home: "GB", away: "JO", homeN: "England",       awayN: "Jordan",       group: "A", stadium: "Hard Rock Stadium",           city: "Miami Gardens, FL" },
    { date: "2026-06-26", time: "15:00", home: "MX", away: "MA", homeN: "Mexico",        awayN: "Morocco",      group: "B", stadium: "Estadio BBVA",                city: "Monterrey" },
    { date: "2026-06-26", time: "18:00", home: "AR", away: "NZ", homeN: "Argentina",     awayN: "New Zealand",  group: "B", stadium: "AT&T Stadium",                city: "Arlington, TX" },
    { date: "2026-06-27", time: "15:00", home: "BR", away: "BE", homeN: "Brazil",        awayN: "Belgium",      group: "C", stadium: "SoFi Stadium",                city: "Inglewood, CA" },
    { date: "2026-06-27", time: "18:00", home: "CA", away: "PA", homeN: "Canada",        awayN: "Panama",       group: "C", stadium: "BC Place",                    city: "Vancouver" },
    { date: "2026-06-28", time: "15:00", home: "FR", away: "KR", homeN: "France",        awayN: "South Korea",  group: "D", stadium: "Allegiant Stadium",           city: "Las Vegas, NV" },
    { date: "2026-06-28", time: "18:00", home: "UY", away: "HN", homeN: "Uruguay",       awayN: "Honduras",     group: "D", stadium: "Estadio Azteca",              city: "Mexico City" },
    { date: "2026-06-29", time: "15:00", home: "DE", away: "JP", homeN: "Germany",       awayN: "Japan",        group: "E", stadium: "MetLife Stadium",            city: "East Rutherford" },
    { date: "2026-06-29", time: "18:00", home: "ZA", away: "CR", homeN: "South Africa",  awayN: "Costa Rica",   group: "E", stadium: "Arrowhead Stadium",           city: "Kansas City, MO" },
    { date: "2026-06-30", time: "15:00", home: "ES", away: "CO", homeN: "Spain",         awayN: "Colombia",     group: "F", stadium: "Lincoln Financial Field",     city: "Philadelphia, PA" },
    { date: "2026-06-30", time: "18:00", home: "AU", away: "TN", homeN: "Australia",     awayN: "Tunisia",      group: "F", stadium: "Lumen Field",                 city: "Seattle, WA" },
    { date: "2026-07-01", time: "15:00", home: "PT", away: "SN", homeN: "Portugal",      awayN: "Senegal",      group: "G", stadium: "Empower Field at Mile High",  city: "Denver, CO" },
    { date: "2026-07-01", time: "18:00", home: "NL", away: "GH", homeN: "Netherlands",   awayN: "Ghana",        group: "G", stadium: "AT&T Stadium",                city: "Arlington, TX" },
];

const WC_VARS = `
:root {
  --wc-bg: #060709;
  --wc-bg-1: #0d0f13;
  --wc-bg-2: #121519;
  --wc-line: #1e2229;
  --wc-line-2: #2a3040;
  --wc-fg: #f2ede5;
  --wc-fg-dim: #a8a59d;
  --wc-fg-mute: #5c5a55;
  --wc-accent: oklch(0.72 0.19 28);
  --wc-gold: #d4a843;
}
`;

const WC_CSS = `
body { background: var(--wc-bg) !important; color: var(--wc-fg) !important; }

/* ── Topbar ── */
.wc-topbar { position: sticky; top: 0; z-index: 20; display: flex; justify-content: center; padding: 10px 16px; }
.wc-topbar-inner { display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 960px; padding: 10px 20px; border-radius: 999px; background: color-mix(in srgb, #060709 80%, transparent); backdrop-filter: blur(16px); border: 1px solid rgba(30,34,41,0.9); box-shadow: 0 2px 20px rgba(0,0,0,0.4); }
.wc-brand { display: flex; flex-direction: column; align-items: flex-start; text-decoration: none; color: var(--wc-fg); }
.wc-brand-name { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 18px; letter-spacing: -0.02em; line-height: 1.1; }
.wc-brand-name em { font-style: normal; color: var(--wc-accent); }
.wc-brand-tag { font-family: monospace; font-size: 9px; letter-spacing: 0.22em; color: var(--wc-accent); font-weight: 700; text-transform: uppercase; margin-top: 1px; opacity: 0.8; }
.wc-nav { display: flex; align-items: center; gap: 2px; }
.wc-nav a { padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--wc-fg-dim); transition: all .18s; text-decoration: none; }
.wc-nav a:hover { background: rgba(255,255,255,0.06); color: var(--wc-fg); }
.wc-nav a.active { background: rgba(255,255,255,0.1); color: var(--wc-fg); }
.wc-top-right { display: flex; gap: 10px; align-items: center; }
.wc-btn-pill { display: inline-flex; align-items: center; padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 700; text-decoration: none; background: var(--wc-accent); color: #060709; transition: all .18s; }
.wc-btn-pill:hover { opacity: 0.88; transform: translateY(-1px); }
.wc-btn-pill.ghost { background: rgba(255,255,255,0.07); color: var(--wc-fg); }
.wc-mobile-nav { display: none; }
.wc-mobile-nav a { padding: 7px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--wc-fg-dim); text-decoration: none; transition: all .18s; white-space: nowrap; }
.wc-mobile-nav a:hover { background: rgba(255,255,255,0.07); color: var(--wc-fg); }

/* ── Hero ── */
.wc-hero { position: relative; overflow: hidden; border-bottom: 1px solid var(--wc-line); background: linear-gradient(160deg, rgba(212,168,67,0.12) 0%, transparent 50%), radial-gradient(ellipse 120% 80% at 70% 0%, rgba(255,95,45,0.08), transparent 60%), #07090c; padding: 60px 40px 48px; }
.wc-hero::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px); background-size: 40px 40px; pointer-events: none; }
.wc-hero-inner { position: relative; z-index: 1; max-width: 960px; margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: 40px; align-items: center; }
.wc-hero-kicker { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--wc-gold); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
.wc-hero-kicker::before { content: ""; display: inline-block; width: 20px; height: 1px; background: var(--wc-gold); }
.wc-h1 { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: clamp(36px, 5vw, 60px); line-height: 0.95; letter-spacing: -0.03em; margin: 0 0 16px; }
.wc-h1 em { font-style: normal; color: var(--wc-gold); }
.wc-hero-meta { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 20px; }
.wc-hero-stat { display: flex; flex-direction: column; gap: 2px; }
.wc-hero-stat .v { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 28px; letter-spacing: -0.02em; color: var(--wc-fg); }
.wc-hero-stat .l { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--wc-fg-mute); }
.wc-hosts { display: flex; gap: 8px; flex-direction: column; }
.wc-host-flag { display: flex; align-items: center; gap: 10px; font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.06em; color: var(--wc-fg-dim); }
.wc-host-flag img { width: 28px; height: 18px; object-fit: cover; border-radius: 2px; }
.wc-countdown { border: 1px solid var(--wc-line-2); background: var(--wc-bg-1); padding: 20px 24px; min-width: 180px; }
.wc-countdown .label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--wc-fg-mute); margin-bottom: 10px; }
.wc-countdown .days { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 52px; letter-spacing: -0.04em; color: var(--wc-gold); line-height: 1; }
.wc-countdown .days-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--wc-fg-mute); letter-spacing: 0.1em; margin-top: 4px; }
.wc-countdown .opening { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--wc-fg-dim); margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--wc-line-2); letter-spacing: 0.04em; }

/* ── Tabs ── */
.wc-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--wc-line); background: var(--wc-bg-1); max-width: 960px; margin: 0 auto; }
.wc-tab { padding: 14px 24px; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--wc-fg-dim); cursor: pointer; border: none; background: none; border-bottom: 2px solid transparent; transition: all .14s; display: flex; align-items: center; gap: 7px; }
.wc-tab:hover { color: var(--wc-fg); }
.wc-tab.on { color: var(--wc-fg); border-bottom-color: var(--wc-gold); }

/* ── Content ── */
.wc-body { max-width: 960px; margin: 0 auto; padding: 32px 0 80px; }

/* ── Groups ── */
.wc-groups-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.wc-group { border: 1px solid var(--wc-line); background: var(--wc-bg-1); }
.wc-group-hd { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--wc-line); }
.wc-group-letter { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 22px; letter-spacing: -0.02em; color: var(--wc-gold); }
.wc-group-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--wc-fg-mute); }
.wc-group-teams { display: flex; flex-direction: column; }
.wc-group-team { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-bottom: 1px solid var(--wc-line); font-size: 13px; color: var(--wc-fg); }
.wc-group-team:last-child { border-bottom: 0; }
.wc-group-team img { width: 22px; height: 14px; object-fit: cover; border-radius: 2px; flex-shrink: 0; }
.wc-group-team .team-name { font-family: 'Space Grotesk', sans-serif; font-weight: 500; font-size: 13px; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wc-group-team .fifa-code { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--wc-fg-mute); letter-spacing: 0.06em; flex-shrink: 0; }

/* ── Schedule ── */
.wc-schedule { display: flex; flex-direction: column; gap: 0; }
.wc-date-block { margin-bottom: 24px; }
.wc-date-hd { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--wc-fg-mute); padding: 12px 0 10px; border-bottom: 1px solid var(--wc-line); margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }
.wc-date-hd .dot { width: 6px; height: 6px; background: var(--wc-gold); border-radius: 50%; }
.wc-fixture { display: grid; grid-template-columns: 80px 1fr 100px 1fr 140px 48px; gap: 14px; padding: 14px 12px; align-items: center; border-bottom: 1px dashed var(--wc-line); cursor: pointer; transition: background .12s; text-decoration: none; color: inherit; }
.wc-fixture:hover { background: var(--wc-bg-1); }
.wc-fixture:last-child { border-bottom: 0; }
.wc-fix-time { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--wc-fg-dim); letter-spacing: 0.06em; }
.wc-fix-time .group-badge { display: block; font-size: 9px; letter-spacing: 0.1em; color: var(--wc-fg-mute); text-transform: uppercase; margin-top: 2px; }
.wc-fix-team { display: flex; align-items: center; gap: 10px; }
.wc-fix-team.right { justify-content: flex-end; flex-direction: row-reverse; }
.wc-fix-team img { width: 26px; height: 17px; object-fit: cover; border-radius: 2px; flex-shrink: 0; }
.wc-fix-team .nm { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wc-fix-vs { text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--wc-fg-mute); }
.wc-fix-venue { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--wc-fg-mute); letter-spacing: 0.04em; line-height: 1.5; }
.wc-fix-venue .stadium-name { display: block; color: var(--wc-fg-dim); font-size: 11px; }
.wc-watch-btn { display: flex; align-items: center; justify-content: center; padding: 8px; border: 1px solid var(--wc-line); color: var(--wc-fg-mute); font-size: 14px; transition: all .12s; }
.wc-watch-btn:hover { border-color: var(--wc-accent); color: var(--wc-accent); background: rgba(255,95,45,0.05); }

/* ── Stadiums ── */
.wc-stadiums-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.wc-stadium { border: 1px solid var(--wc-line); background: var(--wc-bg-1); padding: 20px; transition: border-color .14s; }
.wc-stadium:hover { border-color: var(--wc-line-2); }
.wc-stadium .s-country { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--wc-fg-mute); margin-bottom: 10px; }
.wc-stadium .s-country img { width: 20px; height: 13px; object-fit: cover; border-radius: 2px; }
.wc-stadium .s-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 16px; color: var(--wc-fg); margin-bottom: 4px; line-height: 1.2; }
.wc-stadium .s-city { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--wc-fg-mute); letter-spacing: 0.06em; margin-bottom: 12px; }
.wc-stadium .s-cap { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 20px; color: var(--wc-gold); letter-spacing: -0.01em; }
.wc-stadium .s-cap-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--wc-fg-mute); }

/* ── Responsive ── */
@media (max-width: 900px) {
  .wc-nav { display: none; }
  .wc-mobile-nav { display: flex; align-items: center; gap: 4px; }
  .wc-groups-grid { grid-template-columns: repeat(2, 1fr); }
  .wc-stadiums-grid { grid-template-columns: repeat(2, 1fr); }
  .wc-hero-inner { grid-template-columns: 1fr; }
  .wc-fixture { grid-template-columns: 64px 1fr 60px 1fr 100px; }
  .wc-watch-btn { display: none; }
}
@media (max-width: 600px) {
  .wc-hero { padding: 36px 20px 32px; }
  .wc-groups-grid { grid-template-columns: 1fr 1fr; }
  .wc-stadiums-grid { grid-template-columns: 1fr; }
  .wc-body { padding: 20px 16px 60px; }
  .wc-fixture { grid-template-columns: 52px 1fr 40px 1fr; gap: 8px; }
  .wc-fix-venue { display: none; }
}
`;

function flagUrl(iso2: string) {
    return `https://flagcdn.com/${iso2.toLowerCase()}.svg`;
}

function daysUntil(dateStr: string) {
    const target = new Date(dateStr + "T00:00:00");
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
}

function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

type Tab = "groups" | "schedule" | "stadiums";

export default function WorldCupPage() {
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>("groups");
    const [groupFilter, setGroupFilter] = useState<string>("all");

    const daysToOpen = daysUntil("2026-06-11");

    const fixturesByDate = useMemo(() => {
        const filtered = groupFilter === "all"
            ? WC_FIXTURES
            : WC_FIXTURES.filter(f => f.group === groupFilter);
        const map = new Map<string, typeof WC_FIXTURES>();
        for (const f of filtered) {
            if (!map.has(f.date)) map.set(f.date, []);
            map.get(f.date)!.push(f);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [groupFilter]);

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: WC_VARS + WC_CSS }} />

            {/* Topbar */}
            <header className="wc-topbar">
                <div className="wc-topbar-inner">
                    <Link href="/" className="wc-brand">
                        <div className="wc-brand-name">match<em>watch</em></div>
                        <div className="wc-brand-tag">Watchparty Hub</div>
                    </Link>
                    <nav className="wc-nav">
                        <Link href="/">Home</Link>
                        <Link href="/matches">Matches</Link>
                        <Link href="/world-cup" className="active">World Cup</Link>
                        <Link href="/venues">Venues</Link>
                        <Link href="/blog">Blog</Link>
                        {user && <Link href="/dashboard">My bookings</Link>}
                    </nav>
                    <nav className="wc-mobile-nav">
                        <Link href="/">Home</Link>
                        <Link href="/matches">Matches</Link>
                        <Link href="/venues">Venues</Link>
                        <Link href="/blog">Blog</Link>
                    </nav>
                    <div className="wc-top-right">
                        {user ? (
                            <Link href="/dashboard" className="wc-btn-pill ghost">{user.name?.split(" ")[0]}</Link>
                        ) : (
                            <>
                                <Link href="/register-venue" className="wc-btn-pill ghost">List venue</Link>
                                <Link href="/login" className="wc-btn-pill">Log in</Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero */}
            <div className="wc-hero">
                <div className="wc-hero-inner">
                    <div>
                        <div className="wc-hero-kicker">Official tournament · June 11 – July 19, 2026</div>
                        <h1 className="wc-h1">FIFA World Cup<br /><em>2026</em></h1>
                        <div style={{ fontSize: 15, color: "var(--wc-fg-dim)", lineHeight: 1.6, maxWidth: 480, marginBottom: 24 }}>
                            48 teams. 12 groups. 3 nations. 16 stadiums across the United States, Mexico, and Canada.
                            Find where to watch every match.
                        </div>
                        <div className="wc-hero-meta">
                            <div className="wc-hero-stat"><span className="v">48</span><span className="l">Teams</span></div>
                            <div className="wc-hero-stat"><span className="v">12</span><span className="l">Groups</span></div>
                            <div className="wc-hero-stat"><span className="v">104</span><span className="l">Matches</span></div>
                            <div className="wc-hero-stat"><span className="v">16</span><span className="l">Stadiums</span></div>
                        </div>
                        <div className="wc-hosts" style={{ marginTop: 28 }}>
                            {[
                                { iso2: "us", name: "United States · 11 venues" },
                                { iso2: "mx", name: "Mexico · 3 venues" },
                                { iso2: "ca", name: "Canada · 2 venues" },
                            ].map(h => (
                                <div key={h.iso2} className="wc-host-flag">
                                    <img src={`https://flagcdn.com/${h.iso2}.svg`} alt={h.iso2} />
                                    {h.name}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div className="wc-countdown">
                            <div className="label">Kickoff countdown</div>
                            <div className="days">{daysToOpen}</div>
                            <div className="days-label">days to go</div>
                            <div className="opening">🏟 Opening · Jun 11, 2026<br />MetLife Stadium, New Jersey</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab bar */}
            <div style={{ borderBottom: "1px solid var(--wc-line)" }}>
                <div style={{ maxWidth: 960, margin: "0 auto", display: "flex" }}>
                    {([
                        { id: "groups" as Tab, label: "Groups", icon: "🏆" },
                        { id: "schedule" as Tab, label: "Schedule", icon: "📅" },
                        { id: "stadiums" as Tab, label: "Stadiums", icon: "🏟" },
                    ] as { id: Tab; label: string; icon: string }[]).map(t => (
                        <button
                            key={t.id}
                            className={`wc-tab${tab === t.id ? " on" : ""}`}
                            onClick={() => setTab(t.id)}
                        >
                            <span>{t.icon}</span> {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Body */}
            <div style={{ padding: "0 24px" }}>
                <div className="wc-body">

                    {/* ── Groups tab ── */}
                    {tab === "groups" && (
                        <div>
                            <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--wc-fg-mute)", marginBottom: 20 }}>
                                Group Stage — 12 groups of 4 teams
                            </div>
                            <div className="wc-groups-grid">
                                {GROUPS.map(g => (
                                    <div key={g.name} className="wc-group">
                                        <div className="wc-group-hd">
                                            <span className="wc-group-letter">Group {g.name}</span>
                                            <span className="wc-group-label">4 teams</span>
                                        </div>
                                        <div className="wc-group-teams">
                                            {g.teams.map(t => (
                                                <div key={t.iso2} className="wc-group-team">
                                                    <img
                                                        src={flagUrl(t.iso2 === "SC" ? "gb-sct" : t.iso2)}
                                                        alt={t.name}
                                                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                    />
                                                    <span className="team-name">{t.name}</span>
                                                    <span className="fifa-code">{t.fifa}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Schedule tab ── */}
                    {tab === "schedule" && (
                        <div>
                            {/* Group filter */}
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
                                <button
                                    onClick={() => setGroupFilter("all")}
                                    style={{
                                        fontFamily: "var(--font-mono, monospace)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
                                        padding: "6px 14px", border: "1px solid", cursor: "pointer", background: "none", transition: "all .12s",
                                        borderColor: groupFilter === "all" ? "var(--wc-gold)" : "var(--wc-line)",
                                        color: groupFilter === "all" ? "var(--wc-gold)" : "var(--wc-fg-dim)",
                                    }}
                                >All</button>
                                {"ABCDEFGHIJKL".split("").map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setGroupFilter(g)}
                                        style={{
                                            fontFamily: "var(--font-mono, monospace)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
                                            padding: "6px 12px", border: "1px solid", cursor: "pointer", background: "none", transition: "all .12s",
                                            borderColor: groupFilter === g ? "var(--wc-gold)" : "var(--wc-line)",
                                            color: groupFilter === g ? "var(--wc-gold)" : "var(--wc-fg-dim)",
                                        }}
                                    >Group {g}</button>
                                ))}
                            </div>

                            <div className="wc-schedule">
                                {fixturesByDate.map(([date, fixtures]) => (
                                    <div key={date} className="wc-date-block">
                                        <div className="wc-date-hd">
                                            <span className="dot" />
                                            {formatDate(date)}
                                        </div>
                                        {fixtures.map((f, i) => (
                                            <Link
                                                key={i}
                                                href={`/matches?league=WC`}
                                                className="wc-fixture"
                                            >
                                                <div className="wc-fix-time">
                                                    {f.time} CT
                                                    <span className="group-badge">Grp {f.group} · MD{date <= "2026-06-24" ? "1" : "2"}</span>
                                                </div>
                                                <div className="wc-fix-team" style={{ justifyContent: "flex-end", flexDirection: "row-reverse" }}>
                                                    <img
                                                        src={flagUrl(f.home === "SC" ? "gb-sct" : f.home)}
                                                        alt={f.homeN}
                                                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                    />
                                                    <span className="nm" style={{ textAlign: "right" }}>{f.homeN}</span>
                                                </div>
                                                <div className="wc-fix-vs">vs</div>
                                                <div className="wc-fix-team">
                                                    <img
                                                        src={flagUrl(f.away === "SC" ? "gb-sct" : f.away)}
                                                        alt={f.awayN}
                                                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                    />
                                                    <span className="nm">{f.awayN}</span>
                                                </div>
                                                <div className="wc-fix-venue">
                                                    <span className="stadium-name">{f.stadium}</span>
                                                    {f.city}
                                                </div>
                                                <div className="wc-watch-btn" title="Find watch party">🍺</div>
                                            </Link>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Stadiums tab ── */}
                    {tab === "stadiums" && (
                        <div>
                            {["USA", "Mexico", "Canada"].map(country => {
                                const stadiums = STADIUMS.filter(s => s.country === country);
                                return (
                                    <div key={country} style={{ marginBottom: 36 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                            <img
                                                src={flagUrl(country === "USA" ? "us" : country === "Mexico" ? "mx" : "ca")}
                                                alt={country}
                                                style={{ width: 28, height: 18, objectFit: "cover", borderRadius: 3 }}
                                            />
                                            <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 18 }}>{country}</span>
                                            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--wc-fg-mute)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                                                {stadiums.length} venue{stadiums.length > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="wc-stadiums-grid">
                                            {stadiums.map(s => (
                                                <div key={s.name} className="wc-stadium">
                                                    <div className="s-country">
                                                        <img src={flagUrl(s.flag)} alt={s.country} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                        {s.country}
                                                    </div>
                                                    <div className="s-name">{s.name}</div>
                                                    <div className="s-city">{s.city}</div>
                                                    <div className="s-cap">{s.capacity.toLocaleString()}</div>
                                                    <div className="s-cap-label">capacity</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
