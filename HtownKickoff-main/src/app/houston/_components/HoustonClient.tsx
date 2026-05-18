"use client";

import React from "react";
import Link from "next/link";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap');

:root{
  --bg:#0a0b0d;--bg-1:#101217;--bg-2:#14171d;--bg-3:#1b1f26;
  --line:#23272f;--line-2:#2f3540;
  --fg:#f1ece4;--fg-dim:#a8a59d;--fg-mute:#6c6a64;
  --accent:oklch(0.72 0.19 28);
  --accent-ink:#0a0b0d;
  --gold:oklch(0.72 0.19 28);
  --gold-bright:oklch(0.78 0.18 32);
  --cyan:oklch(0.78 0.14 200);
  --red:oklch(0.65 0.2 20);
}
.hou-page{background:var(--bg);color:var(--fg);font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh;}
.hou-page *{box-sizing:border-box;}
.hou-page a{color:inherit;text-decoration:none;}
.hou-page button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;}

/* CRUMB */
.hou-crumb{padding:14px 32px;font-family:'JetBrains Mono';font-size:11px;letter-spacing:.08em;color:var(--fg-mute);text-transform:uppercase;border-bottom:1px solid var(--line);}
.hou-crumb .sep{margin:0 8px;color:var(--line-2);}
.hou-crumb b{color:var(--fg-dim);font-weight:500;}

/* BTN */
.hou-btn{display:inline-flex;align-items:center;gap:10px;padding:14px 22px;font-family:'JetBrains Mono';font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;border:1px solid var(--line-2);color:var(--fg);background:transparent;transition:all .14s;cursor:pointer;}
.hou-btn:hover{border-color:var(--fg);background:rgba(255,255,255,0.04);}
.hou-btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:700;}
.hou-btn.primary:hover{filter:brightness(1.05);box-shadow:4px 4px 0 var(--fg);transform:translate(-1px,-1px);}
.hou-btn.cyan{color:var(--cyan);border-color:var(--cyan);}
.hou-btn.cyan:hover{background:rgba(34,225,255,0.08);}
.hou-cta-row{display:flex;gap:10px;flex-wrap:wrap;}

/* HERO */
.hou-hero{position:relative;padding:80px;overflow:hidden;border-bottom:1px solid var(--line);background:radial-gradient(1200px 600px at 20% -10%,rgba(255,120,60,0.10),transparent 60%),radial-gradient(900px 500px at 100% 10%,rgba(80,180,255,0.05),transparent 60%),var(--bg);}
.hou-hero::before{content:"";position:absolute;inset:0;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");mix-blend-mode:overlay;opacity:.5;pointer-events:none;}
.hou-hero-skyline{position:absolute;left:0;right:0;bottom:0;height:48%;opacity:.4;pointer-events:none;}
.hou-hero-skyline svg{width:100%;height:100%;display:block;}
.hou-hero-inner{position:relative;z-index:2;display:grid;grid-template-columns:1.1fr 1fr;gap:60px;align-items:center;}
.hou-kicker{display:inline-flex;align-items:center;gap:10px;padding:7px 12px 7px 7px;border:1px solid rgba(212,168,73,0.35);background:rgba(212,168,73,0.06);font-family:'JetBrains Mono';font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:24px;}
.hou-kicker .bd{width:18px;height:18px;background:var(--gold);color:var(--bg);display:grid;place-items:center;font-weight:700;font-family:'Space Grotesk';font-size:10px;}
.hou-kicker em{font-style:normal;color:var(--fg);}
.hou-h1{font-family:'Space Grotesk';font-weight:700;font-size:clamp(48px,5.5vw,72px);line-height:.96;letter-spacing:-0.03em;margin:0 0 18px;}
.hou-h1 em{font-style:normal;background:linear-gradient(110deg,#fff 0%,var(--gold-bright) 50%,var(--gold) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.hou-lede{font-size:16.5px;line-height:1.6;color:var(--fg-dim);max-width:600px;margin:0 0 30px;}
.hou-lede b{color:var(--fg);font-weight:500;}

.hou-hero-card-stack{display:flex;flex-direction:column;gap:14px;}
.hou-hero-card{background:var(--bg-1);border:1px solid var(--line);padding:22px;position:relative;overflow:hidden;}
.hou-hero-card .top{display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono';font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-mute);margin-bottom:14px;}
.hou-hero-card .top b{color:var(--gold);font-weight:600;}
.hou-hero-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:0;}
.hou-hero-stats .cell{padding:18px;border-right:1px solid var(--line);}
.hou-hero-stats .cell:last-child{border-right:0;}
.hou-stat-big{font-family:'Space Grotesk';font-weight:700;font-size:48px;letter-spacing:-0.03em;line-height:1;color:var(--fg);}
.hou-stat-big em{font-style:normal;color:var(--gold);}
.hou-stat-label{font-family:'JetBrains Mono';font-size:11px;letter-spacing:.1em;color:var(--fg-dim);text-transform:uppercase;margin-top:6px;}

/* SECTION */
.hou-section{padding:64px 80px;border-bottom:1px solid var(--line);}
.hou-sec-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px;flex-wrap:wrap;gap:20px;}
.hou-sec-head h2{font-family:'Space Grotesk';font-weight:700;font-size:38px;letter-spacing:-0.025em;margin:0;line-height:1.05;}
.hou-sec-head h2 em{font-style:normal;color:var(--gold);}
.hou-sec-head .sub{color:var(--fg-dim);font-size:14px;margin-top:8px;max-width:520px;line-height:1.55;}
.hou-sec-right a{font-family:'JetBrains Mono';font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--cyan);}

/* VENUE GRID */
.hou-venues{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.hou-venue{border:1px solid var(--line);background:var(--bg-1);overflow:hidden;cursor:pointer;transition:all .14s;display:flex;flex-direction:column;}
.hou-venue:hover{border-color:var(--gold);transform:translateY(-2px);}
.hou-venue .img{aspect-ratio:16/9;background:linear-gradient(135deg,#1a2438,#06101a);position:relative;overflow:hidden;}
.hou-venue .img .stripes{position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent 0 18px,rgba(255,255,255,.025) 18px 19px);}
.hou-venue .img .area{position:absolute;top:10px;left:10px;font-family:'JetBrains Mono';font-size:9px;letter-spacing:.12em;background:rgba(0,0,0,.5);padding:4px 7px;color:var(--gold);text-transform:uppercase;font-weight:600;}
.hou-venue .img .wpbadge{position:absolute;top:10px;right:10px;display:flex;align-items:center;gap:5px;font-family:'JetBrains Mono';font-size:9px;letter-spacing:.1em;background:var(--gold);color:#0a0d18;padding:4px 7px;text-transform:uppercase;font-weight:700;}
.hou-venue .img .glyph{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-family:'Space Grotesk';font-weight:800;font-size:54px;color:rgba(255,255,255,.12);letter-spacing:-0.03em;}
.hou-venue .body{padding:16px 18px;display:flex;flex-direction:column;gap:8px;flex:1;}
.hou-venue .nm{font-family:'Space Grotesk';font-weight:700;font-size:18px;letter-spacing:-0.015em;line-height:1.15;}
.hou-venue .type{font-family:'JetBrains Mono';font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--cyan);}
.hou-venue .addr{font-size:12.5px;color:var(--fg-dim);line-height:1.45;}
.hou-venue .tags{display:flex;flex-wrap:wrap;gap:5px;}
.hou-venue .tag{font-family:'JetBrains Mono';font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:3px 7px;border:1px solid var(--line);color:var(--fg-dim);}
.hou-venue .tag.hot{color:var(--gold);border-color:rgba(212,168,73,0.4);}
.hou-venue .foot{margin-top:auto;padding:12px 18px;border-top:1px dashed var(--line);display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono';font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-mute);}
.hou-venue .foot .go{color:var(--gold);font-weight:600;}

/* MATCHES */
.hou-matches{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
.hou-match{border:1px solid var(--line);background:var(--bg-1);padding:18px 20px;display:grid;grid-template-columns:84px 1fr auto;gap:18px;align-items:center;cursor:pointer;transition:border-color .14s;}
.hou-match:hover{border-color:var(--cyan);}
.hou-match.full{grid-column:1 / -1;}
.hou-match .mdate{font-family:'JetBrains Mono';font-size:10px;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;}
.hou-match .mdate b{display:block;font-family:'Space Grotesk';font-weight:700;font-size:24px;color:var(--fg);letter-spacing:-0.02em;margin-top:2px;}
.hou-match .mbody .stage{font-family:'JetBrains Mono';font-size:9px;letter-spacing:.14em;color:var(--fg-mute);text-transform:uppercase;}
.hou-match .mbody .pair{font-family:'Space Grotesk';font-weight:600;font-size:18px;margin:4px 0;}
.hou-match .mbody .meta{font-family:'JetBrains Mono';font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--cyan);}
.hou-match .mbody .meta b{color:var(--fg);font-weight:500;}
.hou-match .mfind{font-family:'JetBrains Mono';font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);font-weight:600;text-align:right;line-height:1.4;flex-shrink:0;}

/* FAN FESTIVAL */
.hou-festival{padding:64px 80px;background:linear-gradient(135deg,rgba(255,120,60,0.10) 0%,transparent 50%,rgba(80,180,255,0.04) 100%);border-bottom:1px solid var(--line);position:relative;overflow:hidden;}
.hou-festival::before{content:"";position:absolute;right:-100px;top:-100px;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(255,120,60,0.14),transparent 60%);pointer-events:none;}
.hou-festival-inner{display:grid;grid-template-columns:1.1fr 1fr;gap:60px;align-items:center;position:relative;z-index:1;}
.hou-festival h2{font-family:'Space Grotesk';font-weight:700;font-size:46px;letter-spacing:-0.03em;line-height:1;margin:0 0 16px;}
.hou-festival h2 em{font-style:normal;color:var(--gold-bright);}
.hou-festival p{font-size:15.5px;line-height:1.6;color:var(--fg-dim);max-width:520px;margin:0 0 26px;}
.hou-fest-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:24px;}
.hou-fest-stats .c{padding:14px 0;border-right:1px solid var(--line);}
.hou-fest-stats .c:last-child{border-right:0;}
.hou-fest-stats .c:not(:first-child){padding-left:18px;}
.hou-fest-stats .v{font-family:'Space Grotesk';font-weight:700;font-size:24px;letter-spacing:-0.02em;color:var(--gold-bright);line-height:1;}
.hou-fest-stats .l{font-family:'JetBrains Mono';font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-mute);margin-top:6px;}
.hou-festival-visual{border:1px solid var(--line-2);aspect-ratio:4/3;background:linear-gradient(180deg,rgba(8,13,24,0.4),rgba(3,7,15,0.7));position:relative;overflow:hidden;display:grid;place-items:center;}
.hou-festival-visual svg{width:90%;height:90%;}

/* PACKAGE */
.hou-package{padding:80px;border-bottom:1px solid var(--line);background:var(--bg-1);}
.hou-pkg-inner{display:grid;grid-template-columns:1.1fr .9fr;gap:60px;align-items:center;border:1px solid var(--line-2);padding:48px;background:rgba(13,19,32,0.5);backdrop-filter:blur(8px);}
.hou-pkg-label{font-family:'JetBrains Mono';font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--cyan);margin-bottom:14px;}
.hou-pkg-h2{font-family:'Space Grotesk';font-weight:700;font-size:38px;letter-spacing:-0.025em;margin:0 0 14px;line-height:1.05;}
.hou-pkg-h2 em{font-style:normal;color:var(--gold);}
.hou-pkg-p{font-size:14.5px;line-height:1.6;color:var(--fg-dim);margin:0 0 24px;max-width:520px;}
.hou-pkg-p b{color:var(--fg);}
.hou-pkg-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0;border:1px solid var(--line);}
.hou-pkg-item{padding:14px 16px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);}
.hou-pkg-item:nth-child(even){border-right:0;}
.hou-pkg-item:nth-last-child(-n+2){border-bottom:0;}
.hou-pkg-item-label{font-family:'JetBrains Mono';font-size:9px;letter-spacing:.12em;color:var(--fg-mute);text-transform:uppercase;}
.hou-pkg-item-val{font-family:'Space Grotesk';font-weight:600;font-size:13.5px;margin-top:4px;}

/* MAP */
.hou-map-section{padding:64px 80px;border-bottom:1px solid var(--line);}
.hou-map{aspect-ratio:21/9;border:1px solid var(--line);background:radial-gradient(circle at 35% 50%,rgba(80,180,255,0.06),transparent 30%),radial-gradient(circle at 65% 45%,rgba(255,120,60,0.07),transparent 35%),var(--bg-1);position:relative;overflow:hidden;}
.hou-map::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:48px 48px;}
.hou-road{position:absolute;background:rgba(245,198,110,0.18);}
.hou-road.h{height:1px;left:0;right:0;}
.hou-road.v{width:1px;top:0;bottom:0;}
.hou-area-label{position:absolute;font-family:'JetBrains Mono';font-size:9px;letter-spacing:.12em;color:var(--fg-mute);text-transform:uppercase;}
.hou-pin{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;}
.hou-pin .dot{width:14px;height:14px;background:var(--accent);border-radius:50%;border:2px solid var(--bg);box-shadow:0 0 0 4px rgba(255,120,60,0.2);}
.hou-pin.cyan .dot{background:var(--cyan);box-shadow:0 0 0 4px rgba(80,180,255,0.2);}
.hou-pin.red .dot{background:var(--red);box-shadow:0 0 0 4px rgba(230,57,70,0.2);}
.hou-pin .lbl{font-family:'JetBrains Mono';font-size:9px;letter-spacing:.08em;background:rgba(10,11,13,0.85);padding:3px 6px;color:var(--fg);text-transform:uppercase;white-space:nowrap;}
.hou-map-legend{position:absolute;bottom:14px;left:14px;display:flex;gap:14px;background:rgba(10,11,13,0.7);backdrop-filter:blur(8px);padding:10px 14px;border:1px solid var(--line);font-family:'JetBrains Mono';font-size:10px;letter-spacing:.08em;color:var(--fg-dim);text-transform:uppercase;}
.hou-map-legend .sw{display:inline-flex;align-items:center;gap:8px;}
.hou-map-legend .sw i{width:8px;height:8px;border-radius:50%;}

/* FINAL CTA */
.hou-final{padding:80px;background:linear-gradient(135deg,rgba(255,120,60,0.06),transparent 50%,rgba(80,180,255,0.04));display:grid;grid-template-columns:1fr 1fr;gap:24px;}
.hou-final-card{border:1px solid var(--line-2);padding:48px;background:var(--bg-1);}
.hou-final-card .tag{font-family:'JetBrains Mono';font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:14px;}
.hou-final-card.cyan .tag{color:var(--cyan);}
.hou-final-card h3{font-family:'Space Grotesk';font-weight:700;font-size:36px;letter-spacing:-0.025em;line-height:1.05;margin:0 0 14px;}
.hou-final-card h3 em{font-style:normal;color:var(--gold);}
.hou-final-card.cyan h3 em{color:var(--cyan);}
.hou-final-card p{color:var(--fg-dim);font-size:14.5px;line-height:1.55;margin:0 0 24px;}

/* RESPONSIVE */
@media(max-width:1100px){
  .hou-hero{padding:60px 40px;}
  .hou-section,.hou-package,.hou-map-section{padding:52px 40px;}
  .hou-festival{padding:52px 40px;}
  .hou-final{padding:52px 40px;}
  .hou-venues{grid-template-columns:repeat(2,1fr);}
}
@media(max-width:860px){
  .hou-hero-inner{grid-template-columns:1fr;}
  .hou-hero-card-stack{display:none;}
  .hou-festival-inner{grid-template-columns:1fr;}
  .hou-festival-visual{display:none;}
  .hou-pkg-inner{grid-template-columns:1fr;}
  .hou-matches{grid-template-columns:1fr;}
  .hou-match.full{grid-column:auto;}
}
@media(max-width:640px){
  .hou-hero{padding:40px 20px;}
  .hou-section,.hou-package,.hou-map-section,.hou-festival,.hou-final{padding:40px 20px;}
  .hou-venues{grid-template-columns:1fr;}
  .hou-final{grid-template-columns:1fr;}
  .hou-crumb{padding:12px 20px;}
  .hou-fest-stats{grid-template-columns:1fr;}
  .hou-fest-stats .c{border-right:0;border-bottom:1px solid var(--line);padding-left:0 !important;}
  .hou-fest-stats .c:last-child{border-bottom:0;}
}
`;

const VENUES = [
  {
    glyph: "PH",  area: "MIDTOWN",      nm: "Pitch Houston",
    type: "Houston's #1 soccer bar · 6 screens + projector",
    addr: "2020 Bagby St · Midtown",
    tags: ["◆ WATCH PARTY READY", "6 SCREENS + PROJECTOR", "DJ", "OUTDOOR PATIO"],
    slug: "pitch-houston",
  },
  {
    glyph: "AX",  area: "MIDTOWN",      nm: "Axelrad Beer Garden",
    type: "Outdoor beer garden · 2 projectors · match day DJ",
    addr: "1517 Alabama St · Midtown",
    tags: ["◆ WATCH PARTY READY", "OUTDOOR PROJECTORS", "DJ", "BEER GARDEN"],
    slug: "axelrad-beer-garden",
  },
  {
    glyph: "TR",  area: "UPPER KIRBY",  nm: "The Rustic Houston",
    type: "Restaurant & bar · large outdoor area · 3 screens",
    addr: "1836 Westheimer Rd · Upper Kirby",
    tags: ["◆ WATCH PARTY READY", "3 LARGE SCREENS", "500+ CAPACITY", "OUTDOOR"],
    slug: "rustic-houston",
  },
  {
    glyph: "MN",  area: "NRG DISTRICT", nm: "Marriott NRG Sports Bar",
    type: "Hotel bar · 5 screens · steps from NRG Stadium",
    addr: "2100 S Braeswood Blvd · NRG District",
    tags: ["◆ NRG STADIUM ADJACENT", "5 SCREENS", "HOTEL", "PRIVATE EVENTS"],
    slug: "marriott-nrg",
  },
  {
    glyph: "SA",  area: "NEAR NORTHSIDE", nm: "Saint Arnold Brewing Co.",
    type: "Craft brewery · 800-capacity beer hall · 4 screens",
    addr: "2000 Lyons Ave · Near Northside",
    tags: ["◆ WATCH PARTY", "4 SCREENS", "800 CAPACITY", "BREWERY"],
    slug: "saint-arnold-brewing",
  },
  {
    glyph: "PX",  area: "DOWNTOWN",     nm: "Post HTX",
    type: "Massive event space · custom LED setup · 1,000+ capacity",
    addr: "401 Franklin St · Downtown",
    tags: ["◆ WATCH PARTY", "CUSTOM LED", "1,000+ CAPACITY", "DJ"],
    slug: "post-htx",
  },
];

const MATCHES = [
  { month: "JUN", day: "12", stage: "MATCH 1 · GROUP B · 4:00 PM CT",    pair: "USA  ·  vs  ·  Bolivia",      meta: "108", knockout: false },
  { month: "JUN", day: "17", stage: "MATCH 2 · GROUP E · 7:00 PM CT",    pair: "Mexico  ·  vs  ·  Ecuador",   meta: "134", knockout: false },
  { month: "JUN", day: "20", stage: "MATCH 3 · GROUP C · 4:00 PM CT",    pair: "England  ·  vs  ·  Senegal",  meta: "96",  knockout: false },
  { month: "JUN", day: "25", stage: "MATCH 4 · GROUP A · 1:00 PM CT",    pair: "Argentina  ·  vs  ·  Chile",  meta: "84",  knockout: false },
  { month: "JUN", day: "29", stage: "MATCH 5 · GROUP D · 4:00 PM CT",    pair: "Brazil  ·  vs  ·  Japan",     meta: "68",  knockout: false },
  { month: "JUL", day: "04", stage: "MATCH 6 · ROUND OF 32 · 5:00 PM CT", pair: "Group F Winner  ·  vs  ·  Group E Runner-up", meta: "112", knockout: true },
  { month: "JUL", day: "08", stage: "MATCH 7 · ROUND OF 16 · 5:00 PM CT · HEADLINE NIGHT", pair: "Group H Winner  ·  vs  ·  Group G Runner-up", meta: "128", knockout: true, headline: true },
];

export function HoustonClient() {
  return (
    <>
      <style>{CSS}</style>
      <div className="hou-page">

        {/* BREADCRUMB */}
        <div className="hou-crumb">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <Link href="/world-cup">World Cup 2026</Link>
          <span className="sep">/</span>
          <Link href="/world-cup">Host Cities</Link>
          <span className="sep">/</span>
          <b>Houston</b>
        </div>

        {/* HERO */}
        <section className="hou-hero">
          {/* Houston skyline SVG */}
          <div className="hou-hero-skyline">
            <svg viewBox="0 0 1440 280" preserveAspectRatio="xMidYMax slice">
              <g fill="rgba(34,225,255,0.18)">
                <rect x="60" y="180" width="40" height="100"/>
                <rect x="100" y="150" width="50" height="130"/>
                <rect x="150" y="100" width="40" height="180"/>
                <polygon points="190,60 230,60 240,280 180,280 180,60"/>
                <rect x="240" y="120" width="40" height="160"/>
                <polygon points="280,40 330,40 340,280 270,280"/>
                <rect x="340" y="140" width="60" height="140"/>
                <rect x="400" y="100" width="40" height="180"/>
                <polygon points="440,80 480,80 488,280 432,280"/>
                <rect x="488" y="140" width="50" height="140"/>
                <rect x="540" y="170" width="40" height="110"/>
                <rect x="600" y="120" width="50" height="160"/>
                <polygon points="650,60 700,60 706,280 644,280"/>
                <rect x="706" y="100" width="40" height="180"/>
                <rect x="750" y="140" width="50" height="140"/>
                <polygon points="800,80 840,80 848,280 792,280"/>
                <rect x="848" y="130" width="40" height="150"/>
                <rect x="890" y="160" width="50" height="120"/>
                <polygon points="940,90 990,90 996,280 934,280"/>
                <rect x="996" y="150" width="40" height="130"/>
                <rect x="1040" y="120" width="50" height="160"/>
                <polygon points="1090,70 1130,70 1136,280 1084,280"/>
                <rect x="1136" y="140" width="40" height="140"/>
                <rect x="1180" y="170" width="60" height="110"/>
                <rect x="1240" y="150" width="40" height="130"/>
                <rect x="1280" y="180" width="60" height="100"/>
                <rect x="1340" y="160" width="50" height="120"/>
              </g>
              <g stroke="rgba(245,198,110,0.25)" strokeWidth="1" fill="none">
                <path d="M0,240 Q720,225 1440,240"/>
                <path d="M0,260 Q720,250 1440,260"/>
              </g>
            </svg>
          </div>

          <div className="hou-hero-inner">
            <div>
              <span className="hou-kicker">
                <span className="bd">H</span>
                <em>Houston · NRG Stadium · 7 matches · Jun 12 – Jul 8</em>
              </span>
              <h1 className="hou-h1">
                Houston <em>World Cup 2026</em><br/>Watch Parties &amp; Venues.
              </h1>
              <p className="hou-lede">
                <b>7 matches at NRG Stadium</b> — find Houston bars, restaurants, and event spaces
                hosting watch parties, explore the official <b>FIFA Fan Festival</b> at Discovery Green,
                and register your venue before spots fill up.
              </p>
              <div className="hou-cta-row">
                <a href="#venues" className="hou-btn primary">Find Houston Venues →</a>
                <a href="#fan-festival" className="hou-btn cyan">Explore Fan Festival</a>
                <Link href="/world-cup/houston#packages" className="hou-btn">Get Watch Party Package</Link>
              </div>
            </div>

            <div className="hou-hero-card-stack">
              <div className="hou-hero-card">
                <div className="top">
                  <b>◆ HOUSTON · WC 2026</b>
                  <span>UPDATED TODAY</span>
                </div>
                <div className="hou-hero-stats">
                  <div className="cell">
                    <div className="hou-stat-big"><em>134</em></div>
                    <div className="hou-stat-label">Watch party venues</div>
                  </div>
                  <div className="cell">
                    <div className="hou-stat-big">7</div>
                    <div className="hou-stat-label">WC matches in Houston</div>
                  </div>
                  <div className="cell" style={{ borderTop: "1px solid var(--line)" }}>
                    <div className="hou-stat-big">20<em>k</em></div>
                    <div className="hou-stat-label">Fan Festival capacity</div>
                  </div>
                  <div className="cell" style={{ borderTop: "1px solid var(--line)" }}>
                    <div className="hou-stat-big">100<em>+</em></div>
                    <div className="hou-stat-label">Activation opportunities</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURED VENUES */}
        <section className="hou-section" id="venues">
          <div className="hou-sec-head">
            <div>
              <h2>Featured World Cup watch party <em>venues in Houston.</em></h2>
              <p className="sub">
                Hand-picked sports bars, lounges, hotels and restaurants ready to host fans on every match day.
                Sorted by neighborhood proximity to NRG Stadium and the Fan Festival.
              </p>
            </div>
            <div className="hou-sec-right">
              <Link href="/venues?city=Houston">All Houston venues →</Link>
            </div>
          </div>

          <div className="hou-venues">
            {VENUES.map((v) => (
              <article key={v.slug} className="hou-venue">
                <div className="img">
                  <div className="stripes" />
                  <span className="area">{v.area}</span>
                  <span className="wpbadge">◆ WATCH PARTY</span>
                  <span className="glyph">{v.glyph}</span>
                </div>
                <div className="body">
                  <div className="type">{v.type}</div>
                  <div className="nm">{v.nm}</div>
                  <div className="addr">{v.addr}</div>
                  <div className="tags">
                    {v.tags.map((t) => (
                      <span key={t} className={`tag${t.startsWith("◆") ? " hot" : ""}`}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className="foot">
                  <span>HOUSTON · VERIFIED</span>
                  <Link href={`/venues/${v.slug}`} className="go">VIEW · BOOK →</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* MATCHES */}
        <section className="hou-section" id="matches">
          <div className="hou-sec-head">
            <div>
              <h2>World Cup matches <em>in Houston.</em></h2>
              <p className="sub">
                7 official matches at NRG Stadium across the group stage and round of 16.
                Tap any match to see the Houston venues hosting watch parties for it.
              </p>
            </div>
            <div className="hou-sec-right">
              <Link href="/world-cup/houston#matches">Full Houston schedule →</Link>
            </div>
          </div>

          <div className="hou-matches">
            {MATCHES.map((m, i) => (
              <div
                key={i}
                className={`hou-match${m.headline ? " full" : ""}`}
                style={m.headline ? { borderColor: "rgba(212,168,73,0.4)" } : undefined}
              >
                <div className="mdate" style={m.headline ? { color: "var(--gold)" } : undefined}>
                  {m.month}<b>{m.day}</b>
                </div>
                <div className="mbody">
                  <div className="stage" style={m.headline ? { color: "var(--gold)" } : undefined}>
                    {m.stage}
                  </div>
                  <div className="pair">{m.pair}</div>
                  <div className="meta">
                    <b>{m.meta}</b> venues hosting parties
                    {m.knockout ? " · knockout" : ""}
                    {m.headline ? " · sold-out projected" : ""}
                  </div>
                </div>
                <div className="mfind">Find watch<br/>parties →</div>
              </div>
            ))}
          </div>
        </section>

        {/* FAN FESTIVAL */}
        <section className="hou-festival" id="fan-festival">
          <div className="hou-festival-inner">
            <div>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: "11px", letterSpacing: ".16em", color: "var(--gold)", textTransform: "uppercase", marginBottom: "14px" }}>
                ◆ Official Houston Fan Festival
              </div>
              <h2>Houston <em>FIFA Fan Festival.</em></h2>
              <p>
                The official Houston fan zone: giant screens, food trucks, live music between matches,
                supporter sections from every nation. Free entry, downtown, walkable to watch-party row.
              </p>

              <div className="hou-fest-stats">
                <div className="c"><div className="v">20,000</div><div className="l">Capacity</div></div>
                <div className="c"><div className="v">JUN 12 – JUL 8</div><div className="l">Open every match day</div></div>
                <div className="c"><div className="v">Discovery Green</div><div className="l">George R. Brown</div></div>
              </div>

              <div className="hou-cta-row">
                <a href="https://www.fwc26houston.com/fifafanfestivalhou" target="_blank" rel="noopener noreferrer" className="hou-btn primary">
                  Explore Houston Fan Festival →
                </a>
                <a href="#venues" className="hou-btn cyan">
                  Find watch parties near Fan Festival
                </a>
              </div>
            </div>

            {/* Fan Festival SVG illustration */}
            <div className="hou-festival-visual">
              <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                <rect x="100" y="40" width="200" height="110" fill="#0a0d18" stroke="rgba(212,168,73,0.6)" strokeWidth="2"/>
                <rect x="105" y="45" width="190" height="100" fill="rgba(34,225,255,0.08)"/>
                <text x="200" y="100" textAnchor="middle" fontFamily="Space Grotesk" fontWeight="800" fontSize="34" fill="rgba(245,198,110,0.9)">2 – 1</text>
                <text x="200" y="125" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="rgba(255,255,255,0.5)" letterSpacing="2">JUNE 20 · GROUP D</text>
                <rect x="116" y="150" width="6" height="60" fill="#0a0d18"/>
                <rect x="278" y="150" width="6" height="60" fill="#0a0d18"/>
                <rect x="0" y="210" width="400" height="90" fill="rgba(212,168,73,0.06)"/>
                <g fill="rgba(34,225,255,0.15)">
                  <rect x="0" y="170" width="20" height="40"/>
                  <rect x="20" y="150" width="30" height="60"/>
                  <polygon points="50,120 70,120 72,210 48,210"/>
                  <rect x="72" y="140" width="20" height="70"/>
                  <rect x="310" y="135" width="22" height="75"/>
                  <polygon points="332,100 350,100 352,210 330,210"/>
                  <rect x="352" y="155" width="48" height="55"/>
                </g>
                <g fill="rgba(0,0,0,0.6)">
                  {[40,70,98,128,158,188,218,248,278,308,338,368].map((cx, i) => (
                    <g key={i}>
                      <circle cx={cx} cy={235 + (i % 3)} r="8"/>
                      <rect x={cx - 8} y={239 + (i % 3)} width="16" height="42"/>
                    </g>
                  ))}
                </g>
                <g stroke="rgba(212,168,73,0.7)" strokeWidth="1.5" fill="none">
                  <line x1="70" y1="230" x2="68" y2="210"/>
                  <line x1="158" y1="232" x2="155" y2="208"/>
                  <line x1="248" y1="230" x2="252" y2="208"/>
                  <line x1="338" y1="232" x2="335" y2="210"/>
                </g>
                <g fill="rgba(212,168,73,0.5)">
                  <rect x="68" y="200" width="12" height="8"/>
                  <rect x="155" y="198" width="12" height="8"/>
                  <rect x="252" y="198" width="12" height="8"/>
                  <rect x="335" y="200" width="12" height="8"/>
                </g>
              </svg>
            </div>
          </div>
        </section>

        {/* WATCH PARTY ACTIVATION PACKAGE */}
        <section className="hou-package" id="packages">
          <div className="hou-pkg-inner">
            <div>
              <div className="hou-pkg-label">◆ For venues · sponsors · organizers</div>
              <h2 className="hou-pkg-h2">World Cup <em>Watch Party Activation Package.</em></h2>
              <p className="hou-pkg-p">
                Turn your venue into a World Cup destination. matchwatch handles DJ entertainment, video recap,
                fan interviews, digital marketing, social promotion, venue exposure, and lead capture across{" "}
                <b>100+ match-day opportunities</b>.
              </p>
              <div className="hou-cta-row">
                <Link href="/world-cup/houston#packages" className="hou-btn primary">See full package details →</Link>
                <Link href="/for-venues/register?city=houston" className="hou-btn cyan">Promote my venue</Link>
                <Link href="/for-venues" className="hou-btn">Become a partner</Link>
              </div>
            </div>
            <div className="hou-pkg-grid">
              {[
                "DJ + entertainment", "Video recap", "Fan interviews", "Digital marketing",
                "Social promotion", "Short-form videos", "matchwatch exposure", "Lead capture"
              ].map((item) => (
                <div key={item} className="hou-pkg-item">
                  <div className="hou-pkg-item-label">Included</div>
                  <div className="hou-pkg-item-val">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DECORATIVE MAP */}
        <section className="hou-map-section" id="map">
          <div className="hou-sec-head">
            <div>
              <h2>Houston <em>watch party map.</em></h2>
              <p className="sub">
                Venues plotted near NRG Stadium, Downtown, the Fan Festival, and Houston&apos;s most popular bar &amp; restaurant strips.
              </p>
            </div>
            <div className="hou-sec-right">
              <Link href="/world-cup/houston#map">Open full map →</Link>
            </div>
          </div>

          <div className="hou-map">
            <div className="hou-road h" style={{ top: "24%" }} />
            <div className="hou-road h" style={{ top: "50%" }} />
            <div className="hou-road h" style={{ top: "76%" }} />
            <div className="hou-road v" style={{ left: "24%" }} />
            <div className="hou-road v" style={{ left: "54%" }} />
            <div className="hou-road v" style={{ left: "78%" }} />

            <div className="hou-area-label" style={{ left: "14%", top: "14%" }}>DOWNTOWN</div>
            <div className="hou-area-label" style={{ left: "42%", top: "14%" }}>HEIGHTS</div>
            <div className="hou-area-label" style={{ left: "70%", top: "14%" }}>MIDTOWN</div>
            <div className="hou-area-label" style={{ left: "30%", top: "60%" }}>EADO</div>
            <div className="hou-area-label" style={{ left: "58%", top: "62%" }}>RICE VILLAGE</div>
            <div className="hou-area-label" style={{ left: "80%", top: "62%" }}>GALLERIA</div>

            <div className="hou-pin red" style={{ left: "46%", top: "80%" }}>
              <div className="dot" /><div className="lbl">🏟 NRG STADIUM</div>
            </div>
            <div className="hou-pin cyan" style={{ left: "30%", top: "32%" }}>
              <div className="dot" /><div className="lbl">🎉 FAN FESTIVAL · DISCOVERY GREEN</div>
            </div>
            <div className="hou-pin" style={{ left: "62%", top: "36%" }}><div className="dot" /><div className="lbl">PITCH HOUSTON · 6 SCREENS</div></div>
            <div className="hou-pin" style={{ left: "60%", top: "52%" }}><div className="dot" /><div className="lbl">AXELRAD BEER GARDEN</div></div>
            <div className="hou-pin" style={{ left: "42%", top: "58%" }}><div className="dot" /><div className="lbl">THE RUSTIC · UPPER KIRBY</div></div>
            <div className="hou-pin" style={{ left: "48%", top: "74%" }}><div className="dot" /><div className="lbl">MARRIOTT NRG · STEPS FROM STADIUM</div></div>
            <div className="hou-pin" style={{ left: "26%", top: "30%" }}><div className="dot" /><div className="lbl">SAINT ARNOLD BREWING</div></div>
            <div className="hou-pin" style={{ left: "32%", top: "44%" }}><div className="dot" /><div className="lbl">POST HTX · 1,000+ CAP</div></div>
            <div className="hou-pin" style={{ left: "74%", top: "46%" }}><div className="dot" /><div className="lbl">+ 128 MORE VENUES</div></div>

            <div className="hou-map-legend">
              <span className="sw"><i style={{ background: "var(--red)" }} />NRG Stadium</span>
              <span className="sw"><i style={{ background: "var(--cyan)" }} />Fan Festival</span>
              <span className="sw"><i style={{ background: "var(--gold)" }} />Watch party venues</span>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="hou-final">
          <div className="hou-final-card">
            <div className="tag">◆ For fans</div>
            <h3>Find your <em>Houston</em><br/>watch party.</h3>
            <p>
              134 venues across Downtown, Midtown, EaDo, Heights and the Galleria. Reserve a table,
              find supporters from your country, never miss a match.
            </p>
            <a href="#venues" className="hou-btn primary">Find Houston watch parties →</a>
          </div>
          <div className="hou-final-card cyan">
            <div className="tag">◆ For venues &amp; sponsors</div>
            <h3>Activate your <em>venue</em><br/>for World Cup 2026.</h3>
            <p>
              DJ, video, social, lead capture and matchwatch exposure across 100+ match-day opportunities.
              One package, zero hassle.
            </p>
            <Link href="/for-venues/register?city=houston" className="hou-btn cyan">Get the Watch Party Package →</Link>
          </div>
        </section>

      </div>
    </>
  );
}
