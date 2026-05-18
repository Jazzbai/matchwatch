"use client";

import React from "react";
import Link from "next/link";
import {
  MapPin,
  Calendar,
  Tv2,
  Building2,
  ExternalLink,
  ChevronRight,
  Ticket,
  Music,
  Utensils,
  Users,
  Star,
  Zap,
} from "lucide-react";

const CSS = `
/* ── Houston City Page ── */
*,*::before,*::after{box-sizing:border-box}

.hou-page{background:#080b10;color:#e8e2d8;font-family:system-ui,-apple-system,sans-serif;min-height:100vh}
.hou-wrap{max-width:1160px;margin:0 auto;padding:0 24px}

/* ── HERO ── */
.hou-hero{
  position:relative;
  min-height:620px;
  display:flex;
  align-items:center;
  overflow:hidden;
  padding:80px 0 60px;
}
.hou-hero-bg{
  position:absolute;inset:0;
  background:linear-gradient(135deg,#030612 0%,#0a1628 35%,#1a0c00 70%,#0d0a02 100%);
  z-index:0;
}
.hou-hero-glow{
  position:absolute;
  width:600px;height:600px;
  top:-100px;right:-80px;
  background:radial-gradient(circle,rgba(214,95,20,0.18) 0%,transparent 70%);
  z-index:0;
}
.hou-hero-glow2{
  position:absolute;
  width:400px;height:400px;
  bottom:-100px;left:10%;
  background:radial-gradient(circle,rgba(5,120,220,0.12) 0%,transparent 70%);
  z-index:0;
}
.hou-hero-inner{position:relative;z-index:1;width:100%}
.hou-hero-wrap{display:grid;grid-template-columns:1fr 420px;gap:40px;align-items:center;max-width:1160px;margin:0 auto;padding:0 24px}

.hou-kicker{
  display:inline-flex;align-items:center;gap:8px;
  font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:#d65f14;margin-bottom:18px;
}
.hou-kicker-dot{width:6px;height:6px;border-radius:50%;background:#d65f14;display:inline-block}

.hou-h1{
  font-size:clamp(3.2rem,8vw,6rem);
  font-weight:900;
  letter-spacing:-.03em;
  line-height:.95;
  color:#f0eae0;
  margin:0 0 12px;
}
.hou-h1 span{color:#d65f14}

.hou-subtitle{font-size:1.1rem;color:#9a9080;line-height:1.5;margin:0 0 32px;max-width:480px}

.hou-stats-row{display:flex;flex-wrap:wrap;gap:24px;margin-bottom:36px}
.hou-stat{display:flex;flex-direction:column;gap:2px}
.hou-stat-n{font-size:1.8rem;font-weight:800;color:#f0eae0;line-height:1}
.hou-stat-l{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#6a6058}

.hou-ctarow{display:flex;flex-wrap:wrap;gap:12px}
.hou-cta-p{
  display:inline-flex;align-items:center;gap:8px;
  padding:12px 24px;background:#d65f14;color:#fff;
  font-size:14px;font-weight:700;border-radius:8px;text-decoration:none;
  transition:background .15s;
}
.hou-cta-p:hover{background:#c0540f}
.hou-cta-s{
  display:inline-flex;align-items:center;gap:8px;
  padding:12px 24px;background:transparent;color:#e8e2d8;
  border:1px solid rgba(232,226,216,0.2);
  font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;
  transition:border-color .15s,color .15s;
}
.hou-cta-s:hover{border-color:rgba(232,226,216,0.5);color:#fff}

.hou-hero-emblem{
  display:flex;flex-direction:column;align-items:center;gap:16px;
}
.hou-hero-emblem img{width:260px;height:auto;opacity:.92;filter:drop-shadow(0 0 40px rgba(214,95,20,.3))}
.hou-hero-emblem-label{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#5a5248;text-align:center}

/* ── SECTION COMMON ── */
.hou-section{padding:80px 0}
.hou-section-alt{padding:80px 0;background:#0c1018}
.hou-section-accent{padding:80px 0;background:linear-gradient(135deg,#0f1a0a 0%,#0a1020 100%)}

.hou-sh{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:40px;flex-wrap:wrap}
.hou-sh-left{}
.hou-eyebrow{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#d65f14;margin-bottom:8px}
.hou-st{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800;letter-spacing:-.02em;color:#f0eae0;line-height:1.15;margin:0}
.hou-ss{font-size:.95rem;color:#7a7068;margin:8px 0 0;max-width:560px}
.hou-see-all{
  display:inline-flex;align-items:center;gap:5px;white-space:nowrap;
  font-size:13px;font-weight:600;color:#d65f14;text-decoration:none;
}
.hou-see-all:hover{color:#f07a30}

/* ── MATCHES ── */
.hou-matches-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}

.hou-match-card{
  background:#111620;border:1px solid #1e2430;border-radius:12px;
  padding:20px;transition:border-color .15s,transform .15s;
  position:relative;overflow:hidden;
}
.hou-match-card:hover{border-color:#2e3848;transform:translateY(-2px)}

.hou-match-stage-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.hou-match-stage{
  font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  padding:4px 10px;border-radius:999px;
  background:rgba(214,95,20,.12);color:#d65f14;border:1px solid rgba(214,95,20,.25);
}
.hou-match-date{font-size:12px;color:#6a6058;font-weight:600}

.hou-match-teams{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.hou-match-team{display:flex;align-items:center;gap:10px;flex:1}
.hou-match-team.right{flex-direction:row-reverse;text-align:right}
.hou-flag{width:32px;height:24px;border-radius:3px;object-fit:cover;flex-shrink:0}
.hou-flag-placeholder{
  width:32px;height:24px;border-radius:3px;
  background:#1e2430;display:flex;align-items:center;justify-content:center;
  font-size:14px;flex-shrink:0;
}
.hou-team-name{font-size:15px;font-weight:700;color:#e8e2d8}
.hou-match-vs{
  font-size:11px;font-weight:800;color:#3a4050;letter-spacing:.05em;
  padding:0 4px;flex-shrink:0;
}

.hou-match-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #1a2030;padding-top:12px}
.hou-match-time{font-size:13px;color:#7a7068;display:flex;align-items:center;gap:5px}
.hou-match-venue-label{font-size:11px;color:#4a5060;display:flex;align-items:center;gap:4px}

.hou-tbd-card{
  background:#0e1318;border:1px dashed #1e2430;border-radius:12px;
  padding:20px;display:flex;align-items:center;gap:16px;
}
.hou-tbd-icon{
  width:48px;height:48px;border-radius:50%;background:#151c25;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  font-size:22px;
}
.hou-tbd-stage{font-size:13px;font-weight:700;color:#e8e2d8;margin-bottom:4px}
.hou-tbd-date{font-size:12px;color:#6a6058}
.hou-tbd-badge{
  margin-left:auto;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  padding:4px 10px;border-radius:999px;
  background:rgba(255,255,255,.04);color:#4a5060;border:1px solid #1e2430;
}

/* ── FAN FESTIVAL ── */
.hou-ff{padding:80px 0;background:#060d06}
.hou-ff-inner{display:grid;grid-template-columns:1fr 400px;gap:60px;align-items:start}

.hou-ff-official-badge{
  display:inline-flex;align-items:center;gap:6px;margin-bottom:14px;
  font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:#22c55e;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);
  padding:4px 10px;border-radius:999px;
}

.hou-ff-title{font-size:clamp(1.6rem,4vw,2.6rem);font-weight:800;letter-spacing:-.025em;color:#f0eae0;line-height:1.1;margin:0 0 16px}
.hou-ff-body{font-size:.975rem;color:#7a7068;line-height:1.7;margin:0 0 28px}

.hou-ff-features{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:32px}
.hou-ff-feature{
  display:inline-flex;align-items:center;gap:6px;
  font-size:13px;font-weight:600;color:#c0bab0;
  background:#0f1a0f;border:1px solid #1e2e1e;
  padding:6px 12px;border-radius:8px;
}
.hou-ff-feature svg{color:#22c55e;flex-shrink:0}

.hou-ff-cta{
  display:inline-flex;align-items:center;gap:8px;
  padding:12px 22px;background:#22c55e;color:#040a04;
  font-size:14px;font-weight:700;border-radius:8px;text-decoration:none;
  transition:background .15s;
}
.hou-ff-cta:hover{background:#1db852}

.hou-ff-card{
  background:#0d160d;border:1px solid #1a2a1a;border-radius:14px;
  padding:28px;
}
.hou-ff-card-header{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.hou-ff-card-icon{
  width:48px;height:48px;border-radius:10px;
  background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
}
.hou-ff-card-title{font-size:15px;font-weight:700;color:#e8e2d8;margin:0 0 2px}
.hou-ff-card-sub{font-size:12px;color:#4a5a4a}

.hou-ff-details{display:flex;flex-direction:column;gap:14px}
.hou-ff-detail{display:flex;align-items:flex-start;gap:12px}
.hou-ff-detail-icon{color:#22c55e;margin-top:2px;flex-shrink:0}
.hou-ff-detail-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4a5a4a;margin-bottom:2px}
.hou-ff-detail-val{font-size:14px;color:#c0bab0;font-weight:600}

/* ── VENUES ── */
.hou-venues-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}

.hou-venue-card{
  background:#111620;border:1px solid #1e2430;border-radius:14px;
  overflow:hidden;transition:border-color .15s,transform .15s;
  display:flex;flex-direction:column;
}
.hou-venue-card:hover{border-color:#2e3848;transform:translateY(-3px)}

.hou-vc-top{
  height:120px;position:relative;overflow:hidden;
  background:linear-gradient(135deg,#1a2030 0%,#0e1520 100%);
  display:flex;align-items:center;justify-content:center;
}
.hou-vc-top-icon{font-size:36px;opacity:.35}
.hou-vc-nbadge{
  position:absolute;top:12px;left:12px;
  font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  padding:3px 8px;border-radius:999px;
  background:rgba(0,0,0,.6);color:#c0bab0;border:1px solid #2a3040;
}
.hou-vc-wpbadge{
  position:absolute;top:12px;right:12px;
  font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;
  background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3);
}

.hou-vc-body{padding:18px;flex:1;display:flex;flex-direction:column;gap:6px}
.hou-vc-type{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#4a5060}
.hou-vc-name{font-size:16px;font-weight:700;color:#f0eae0;line-height:1.2}
.hou-vc-addr{font-size:12px;color:#6a6058;display:flex;align-items:center;gap:4px;margin-top:2px}

.hou-vc-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.hou-vc-tag{
  font-size:11px;font-weight:600;color:#9a9080;
  background:#181e28;border:1px solid #232b38;
  padding:3px 8px;border-radius:6px;
  display:flex;align-items:center;gap:4px;
}

.hou-vc-footer{
  padding:14px 18px;border-top:1px solid #1a2030;
  display:flex;align-items:center;justify-content:space-between;
}
.hou-vc-cap{font-size:12px;color:#5a6070;display:flex;align-items:center;gap:4px}
.hou-vc-btn{
  font-size:12px;font-weight:700;color:#d65f14;
  text-decoration:none;display:flex;align-items:center;gap:3px;
}
.hou-vc-btn:hover{color:#f07a30}

.hou-venue-cta-card{
  background:linear-gradient(135deg,#150a02 0%,#0a1018 100%);
  border:1px dashed rgba(214,95,20,.3);border-radius:14px;
  padding:28px;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center;gap:12px;min-height:220px;
}
.hou-venue-cta-title{font-size:15px;font-weight:700;color:#f0eae0}
.hou-venue-cta-sub{font-size:13px;color:#6a6058;line-height:1.5}
.hou-venue-cta-btn{
  display:inline-flex;align-items:center;gap:7px;
  padding:10px 20px;background:#d65f14;color:#fff;
  font-size:13px;font-weight:700;border-radius:8px;text-decoration:none;margin-top:4px;
  transition:background .15s;
}
.hou-venue-cta-btn:hover{background:#c0540f}

/* ── REGISTER CTA BAND ── */
.hou-band{
  padding:60px 0;
  background:linear-gradient(135deg,#0e0802 0%,#080e1a 100%);
  border-top:1px solid #1a2030;border-bottom:1px solid #1a2030;
}
.hou-band-inner{display:flex;align-items:center;justify-content:space-between;gap:32px;flex-wrap:wrap}
.hou-band-text{}
.hou-band-kicker{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#d65f14;margin-bottom:8px}
.hou-band-title{font-size:clamp(1.2rem,3vw,1.8rem);font-weight:800;color:#f0eae0;letter-spacing:-.02em;margin:0 0 6px}
.hou-band-sub{font-size:.9rem;color:#6a6058;margin:0}
.hou-band-btns{display:flex;gap:10px;flex-wrap:wrap;flex-shrink:0}

/* ── RESPONSIVE ── */
@media(max-width:1024px){
  .hou-hero-wrap{grid-template-columns:1fr}
  .hou-hero-emblem{display:none}
  .hou-ff-inner{grid-template-columns:1fr}
}
@media(max-width:640px){
  .hou-section,.hou-section-alt,.hou-section-accent,.hou-ff{padding:52px 0}
  .hou-matches-grid{grid-template-columns:1fr}
  .hou-venues-grid{grid-template-columns:1fr}
  .hou-stats-row{gap:16px}
  .hou-ctarow{flex-direction:column}
  .hou-band-inner{flex-direction:column;align-items:flex-start}
}
`;

const MATCHES = [
  { id: "hou-1", stage: "Group B",       teamA: "Mexico",   teamB: "Ecuador",  date: "Jun 12", time: "4:00 PM CT", flagA: "mx", flagB: "ec", tbd: false },
  { id: "hou-2", stage: "Group E",       teamA: "USA",      teamB: "Bolivia",  date: "Jun 17", time: "7:00 PM CT", flagA: "us", flagB: "bo", tbd: false },
  { id: "hou-3", stage: "Group C",       teamA: "England",  teamB: "Senegal",  date: "Jun 20", time: "4:00 PM CT", flagA: "gb-eng", flagB: "sn", tbd: false },
  { id: "hou-4", stage: "Group A",       teamA: "Argentina",teamB: "Chile",    date: "Jun 25", time: "1:00 PM CT", flagA: "ar", flagB: "cl", tbd: false },
  { id: "hou-5", stage: "Group D",       teamA: "Brazil",   teamB: "Japan",    date: "Jun 29", time: "4:00 PM CT", flagA: "br", flagB: "jp", tbd: false },
  { id: "hou-6", stage: "Round of 32",   teamA: "TBD",      teamB: "TBD",      date: "Jul 4",  time: "5:00 PM CT", flagA: "", flagB: "", tbd: true },
  { id: "hou-7", stage: "Round of 16",   teamA: "TBD",      teamB: "TBD",      date: "Jul 8",  time: "5:00 PM CT", flagA: "", flagB: "", tbd: true },
];

const VENUES = [
  {
    id: "v1", name: "Pitch Houston",       type: "Sports Bar",       neighborhood: "Midtown",     address: "2020 Bagby St",
    capacity: 250, screens: "6 screens + projector", indoor: "Both",  dj: true,  wpReady: true,  slug: "pitch-houston",
  },
  {
    id: "v2", name: "The Rustic Houston",  type: "Restaurant & Bar", neighborhood: "Upper Kirby", address: "1836 Westheimer Rd",
    capacity: 500, screens: "3 large screens",        indoor: "Both",  dj: true,  wpReady: true,  slug: "rustic-houston",
  },
  {
    id: "v3", name: "Axelrad Beer Garden", type: "Beer Garden",      neighborhood: "Midtown",     address: "1517 Alabama St",
    capacity: 300, screens: "2 outdoor projectors",   indoor: "Outdoor", dj: true, wpReady: true, slug: "axelrad-beer-garden",
  },
  {
    id: "v4", name: "Marriott NRG Sports Bar", type: "Hotel Bar",    neighborhood: "NRG District",address: "2100 S Braeswood Blvd",
    capacity: 150, screens: "5 screens",               indoor: "Indoor", dj: false, wpReady: true, slug: "marriott-nrg",
  },
  {
    id: "v5", name: "Saint Arnold Brewing", type: "Brewery",         neighborhood: "Near Northside", address: "2000 Lyons Ave",
    capacity: 800, screens: "4 screens",               indoor: "Both",  dj: false, wpReady: false, slug: "saint-arnold-brewing",
  },
  {
    id: "v6", name: "Post HTX",           type: "Event Space",       neighborhood: "Downtown",    address: "401 Franklin St",
    capacity: 1000, screens: "Custom setup",           indoor: "Both",  dj: true,  wpReady: false, slug: "post-htx",
  },
  {
    id: "v7", name: "Concrete Cowboys",   type: "Restaurant & Bar",  neighborhood: "EaDo",        address: "3403 Harrisburg Blvd",
    capacity: 200, screens: "3 screens",               indoor: "Both",  dj: true,  wpReady: false, slug: "concrete-cowboys",
  },
  {
    id: "v8", name: "Clementine",         type: "Cocktail Bar",      neighborhood: "Heights",     address: "2214 Shepherd Dr",
    capacity: 180, screens: "2 screens",               indoor: "Indoor", dj: false, wpReady: false, slug: "clementine",
  },
];

const TYPE_ICON: Record<string, string> = {
  "Sports Bar": "🏟️",
  "Restaurant & Bar": "🍽️",
  "Beer Garden": "🍺",
  "Hotel Bar": "🏨",
  "Brewery": "🍻",
  "Event Space": "🎪",
  "Cocktail Bar": "🍸",
};

function FlagImg({ code, team }: { code: string; team: string }) {
  if (!code) return <div className="hou-flag-placeholder">⚽</div>;
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={`${team} flag`}
      className="hou-flag"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

export function HoustonClient() {
  return (
    <>
      <style>{CSS}</style>
      <div className="hou-page">

        {/* ── HERO ── */}
        <section className="hou-hero">
          <div className="hou-hero-bg" />
          <div className="hou-hero-glow" />
          <div className="hou-hero-glow2" />
          <div className="hou-hero-inner">
            <div className="hou-hero-wrap">
              <div>
                <div className="hou-kicker">
                  <span className="hou-kicker-dot" />
                  FIFA World Cup 2026 · U.S. Host City
                </div>
                <h1 className="hou-h1">
                  Houston<span>,</span><br />Texas
                </h1>
                <p className="hou-subtitle">
                  One of 11 U.S. host cities for FIFA World Cup 2026 — 7 matches at NRG Stadium,
                  an official FIFA Fan Festival, and the best watch party venues in the city.
                </p>

                <div className="hou-stats-row">
                  <div className="hou-stat">
                    <span className="hou-stat-n">7</span>
                    <span className="hou-stat-l">Matches</span>
                  </div>
                  <div className="hou-stat">
                    <span className="hou-stat-n">NRG</span>
                    <span className="hou-stat-l">Stadium</span>
                  </div>
                  <div className="hou-stat">
                    <span className="hou-stat-n">72,220</span>
                    <span className="hou-stat-l">Capacity</span>
                  </div>
                  <div className="hou-stat">
                    <span className="hou-stat-n">Jun 12</span>
                    <span className="hou-stat-l">First Kickoff</span>
                  </div>
                  <div className="hou-stat">
                    <span className="hou-stat-n">Jul 8</span>
                    <span className="hou-stat-l">Last Match</span>
                  </div>
                </div>

                <div className="hou-ctarow">
                  <a href="#venues" className="hou-cta-p">
                    <MapPin size={15} />
                    Find Watch Party Venues
                  </a>
                  <a href="#matches" className="hou-cta-s">
                    <Calendar size={15} />
                    View Match Schedule
                  </a>
                </div>
              </div>

              <div className="hou-hero-emblem">
                <img
                  src="/world-cup-emblem.png"
                  alt="FIFA World Cup 2026 Official Emblem"
                />
                <span className="hou-hero-emblem-label">FIFA World Cup 2026™</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── MATCHES AT NRG STADIUM ── */}
        <section className="hou-section-alt" id="matches">
          <div className="hou-wrap">
            <div className="hou-sh">
              <div className="hou-sh-left">
                <div className="hou-eyebrow">NRG Stadium · Houston, TX</div>
                <h2 className="hou-st">FIFA World Cup Matches in Houston</h2>
                <p className="hou-ss">
                  7 official FIFA World Cup 2026 matches — 5 confirmed group stage fixtures and 2 knockout rounds.
                </p>
              </div>
              <a href="#venues" className="hou-see-all">
                Find Watch Party Venues <ChevronRight size={14} />
              </a>
            </div>

            <div className="hou-matches-grid">
              {MATCHES.filter((m) => !m.tbd).map((m) => (
                <div key={m.id} className="hou-match-card">
                  <div className="hou-match-stage-row">
                    <span className="hou-match-stage">{m.stage}</span>
                    <span className="hou-match-date">{m.date} · {m.time}</span>
                  </div>
                  <div className="hou-match-teams">
                    <div className="hou-match-team">
                      <FlagImg code={m.flagA} team={m.teamA} />
                      <span className="hou-team-name">{m.teamA}</span>
                    </div>
                    <span className="hou-match-vs">VS</span>
                    <div className="hou-match-team right">
                      <FlagImg code={m.flagB} team={m.teamB} />
                      <span className="hou-team-name">{m.teamB}</span>
                    </div>
                  </div>
                  <div className="hou-match-footer">
                    <span className="hou-match-time">
                      <Calendar size={12} />
                      {m.time}
                    </span>
                    <span className="hou-match-venue-label">
                      <MapPin size={11} />
                      NRG Stadium
                    </span>
                  </div>
                </div>
              ))}

              {MATCHES.filter((m) => m.tbd).map((m) => (
                <div key={m.id} className="hou-tbd-card">
                  <div className="hou-tbd-icon">⚽</div>
                  <div>
                    <div className="hou-tbd-stage">{m.stage}</div>
                    <div className="hou-tbd-date">{m.date} · {m.time} · NRG Stadium</div>
                  </div>
                  <span className="hou-tbd-badge">TBD</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FIFA FAN FESTIVAL ── */}
        <section className="hou-ff" id="fan-festival">
          <div className="hou-wrap">
            <div className="hou-ff-inner">
              <div>
                <div className="hou-ff-official-badge">
                  ✦ Official FIFA Event
                </div>
                <h2 className="hou-ff-title">
                  FIFA Fan Festival<br />Houston™
                </h2>
                <p className="hou-ff-body">
                  The official FIFA Fan Festival is a free public event running throughout the tournament —
                  bringing the World Cup experience to all fans with live match screenings on giant outdoor
                  screens, entertainment, cultural programming, food & drinks, and interactive activities.
                  No ticket required.
                </p>

                <div className="hou-ff-features">
                  <span className="hou-ff-feature"><Tv2 size={14} />Live Match Screenings</span>
                  <span className="hou-ff-feature"><Music size={14} />Live Entertainment</span>
                  <span className="hou-ff-feature"><Utensils size={14} />Food & Drinks</span>
                  <span className="hou-ff-feature"><Users size={14} />Fan Activities</span>
                  <span className="hou-ff-feature"><Ticket size={14} />Free Entry</span>
                  <span className="hou-ff-feature"><Star size={14} />Cultural Programming</span>
                </div>

                <a
                  href="https://www.fwc26houston.com/fifafanfestivalhou"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hou-ff-cta"
                >
                  <ExternalLink size={15} />
                  Official Fan Festival Info
                </a>
              </div>

              <div className="hou-ff-card">
                <div className="hou-ff-card-header">
                  <div className="hou-ff-card-icon">
                    <Star size={22} color="#22c55e" />
                  </div>
                  <div>
                    <div className="hou-ff-card-title">Fan Festival Details</div>
                    <div className="hou-ff-card-sub">FWC26 Houston</div>
                  </div>
                </div>
                <div className="hou-ff-details">
                  <div className="hou-ff-detail">
                    <MapPin size={16} className="hou-ff-detail-icon" />
                    <div>
                      <div className="hou-ff-detail-label">Location</div>
                      <div className="hou-ff-detail-val">Discovery Green, Downtown Houston</div>
                    </div>
                  </div>
                  <div className="hou-ff-detail">
                    <Calendar size={16} className="hou-ff-detail-icon" />
                    <div>
                      <div className="hou-ff-detail-label">Dates</div>
                      <div className="hou-ff-detail-val">June 12 – July 8, 2026</div>
                    </div>
                  </div>
                  <div className="hou-ff-detail">
                    <Ticket size={16} className="hou-ff-detail-icon" />
                    <div>
                      <div className="hou-ff-detail-label">Admission</div>
                      <div className="hou-ff-detail-val">Free — Open to all fans</div>
                    </div>
                  </div>
                  <div className="hou-ff-detail">
                    <Tv2 size={16} className="hou-ff-detail-icon" />
                    <div>
                      <div className="hou-ff-detail-label">Screens</div>
                      <div className="hou-ff-detail-val">Giant outdoor LED screens — all matches live</div>
                    </div>
                  </div>
                  <div className="hou-ff-detail">
                    <ExternalLink size={16} className="hou-ff-detail-icon" />
                    <div>
                      <div className="hou-ff-detail-label">Official Site</div>
                      <a
                        href="https://www.fwc26houston.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#22c55e", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}
                      >
                        fwc26houston.com ↗
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── WATCH PARTY VENUES ── */}
        <section className="hou-section" id="venues">
          <div className="hou-wrap">
            <div className="hou-sh">
              <div className="hou-sh-left">
                <div className="hou-eyebrow">Houston, TX</div>
                <h2 className="hou-st">Watch Party Venues</h2>
                <p className="hou-ss">
                  Bars, restaurants, breweries, and event spaces in Houston hosting World Cup watch parties.
                  Register your venue to get listed.
                </p>
              </div>
              <Link href="/venues?city=Houston" className="hou-see-all">
                All Venues <ChevronRight size={14} />
              </Link>
            </div>

            <div className="hou-venues-grid">
              {VENUES.map((v) => (
                <div key={v.id} className="hou-venue-card">
                  <div className="hou-vc-top">
                    <span className="hou-vc-top-icon">{TYPE_ICON[v.type] ?? "🏟️"}</span>
                    <span className="hou-vc-nbadge">{v.neighborhood}</span>
                    {v.wpReady && <span className="hou-vc-wpbadge">✓ Watch Party Ready</span>}
                  </div>
                  <div className="hou-vc-body">
                    <span className="hou-vc-type">{v.type}</span>
                    <span className="hou-vc-name">{v.name}</span>
                    <span className="hou-vc-addr">
                      <MapPin size={11} />
                      {v.address}, Houston TX
                    </span>
                    <div className="hou-vc-tags">
                      <span className="hou-vc-tag"><Tv2 size={11} />{v.screens}</span>
                      <span className="hou-vc-tag"><Users size={11} />Up to {v.capacity}</span>
                      <span className="hou-vc-tag">{v.indoor}</span>
                      {v.dj && <span className="hou-vc-tag"><Music size={11} />DJ</span>}
                    </div>
                  </div>
                  <div className="hou-vc-footer">
                    <span className="hou-vc-cap">
                      <Users size={12} />
                      {v.capacity.toLocaleString()} capacity
                    </span>
                    <Link href={`/venues/${v.slug}`} className="hou-vc-btn">
                      View Venue <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>
              ))}

              <div className="hou-venue-cta-card">
                <Building2 size={28} color="#d65f14" />
                <div className="hou-venue-cta-title">Is your venue on the list?</div>
                <div className="hou-venue-cta-sub">
                  Register your bar, restaurant, or event space to get discovered by World Cup fans in Houston.
                </div>
                <Link
                  href="/for-venues/register?city=houston&source=hou-city-page"
                  className="hou-venue-cta-btn"
                >
                  <Zap size={13} />
                  Register Your Venue — Free
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── BOTTOM CTA BAND ── */}
        <section className="hou-band">
          <div className="hou-wrap">
            <div className="hou-band-inner">
              <div className="hou-band-text">
                <div className="hou-band-kicker">For Venue Owners</div>
                <h2 className="hou-band-title">Own a venue in Houston? Make it World Cup–ready.</h2>
                <p className="hou-band-sub">
                  List your events, manage bookings, and get in front of thousands of fans searching for watch parties.
                </p>
              </div>
              <div className="hou-band-btns">
                <Link href="/for-venues/register?city=houston" className="hou-cta-p">
                  <Building2 size={15} />
                  Register Free
                </Link>
                <Link href="/for-venues" className="hou-cta-s">
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
