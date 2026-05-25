"use client";

import React, { useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { FloatingNav } from "../../../../components/AppShell";
import {
  MapPin, Globe, ChevronRight, ExternalLink, Calendar,
  Users, Building2, ChevronDown, Star, Shield,
} from "lucide-react";

const SUPPORTED_CITIES = ["seattle"];

interface FanZone {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  description: string;
  dates: string;
  website: string;
  coverImage: string;
  capacity: number | null;
  features: string[];
  tag: string;
}

const FAN_ZONES: FanZone[] = [
  {
    id: "bellingham",
    name: "Fan Zone — Bellingham",
    city: "Bellingham",
    state: "WA",
    address: "904 Potter St, Waterfront District",
    description:
      "Free outdoor fan zone in Bellingham's waterfront district with giant screens, local food vendors, interactive soccer activities, and community celebrations on select World Cup match days.",
    dates: "Select match days, June–July 2026",
    website: "https://www.bellingham.org/fan-zone",
    coverImage:
      "https://bellingham.objects.liquidweb.services/photos/6925-fifa_webheader_final-2800x900.jpg",
    capacity: 5000,
    features: ["Giant Screens", "Free Entry", "Food & Drinks", "Youth Activities"],
    tag: "BELLINGHAM",
  },
  {
    id: "bremerton",
    name: "Fan Zone — Bremerton",
    city: "Bremerton",
    state: "WA",
    address: "Harborside Fountain Park, 100 Washington Ave",
    description:
      "Downtown Bremerton's waterfront fan zone with match-viewing on giant screens, live entertainment, and local vendors with stunning harbor views.",
    dates: "Select match days, June–July 2026",
    website: "https://www.downtownbremerton.org/events/bremerton-fan-zones",
    coverImage:
      "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80",
    capacity: 3000,
    features: ["Giant Screens", "Waterfront Views", "Live Music", "Local Vendors"],
    tag: "BREMERTON",
  },
  {
    id: "everett",
    name: "Fan Zone — Everett",
    city: "Everett",
    state: "WA",
    address: "Downtown Everett",
    description:
      "Community fan zone in Everett with live match broadcasts on giant screens, local food, entertainment, and community gatherings during Seattle's World Cup matches.",
    dates: "Select match days, June–July 2026",
    website: "https://www.seattlefwc26.org/events/fan-zones",
    coverImage:
      "https://images.unsplash.com/photo-1431440869543-efaf3388c585?w=800&q=80",
    capacity: null,
    features: ["Giant Screens", "Live Entertainment", "Food & Drinks", "Community Events"],
    tag: "EVERETT",
  },
  {
    id: "olympia",
    name: "Fan Zone — Olympia-Lacey",
    city: "Olympia",
    state: "WA",
    address: "Port of Olympia — Port Plaza, 701 Columbia Street NW",
    description:
      "Waterfront festival at Port Plaza with live match screenings, live music, and VIP packages ($75). General admission $10 — youth 12 & under free. Open June 19, 24, 25 & 26.",
    dates: "June 19, 24, 25 & 26, 2026",
    website: "https://thurstonchamber.com/fanzone/",
    coverImage:
      "https://thurstonchamber.com/wp-content/uploads/2026/03/Olympia_Lacey-Official-Logo.png",
    capacity: 10000,
    features: ["Giant Screens", "VIP Packages", "Live Music", "$10 GA", "Free Under 12"],
    tag: "OLYMPIA–LACEY",
  },
  {
    id: "tacoma",
    name: "Fan Zone — Puyallup Tribe (Tacoma)",
    city: "Tacoma",
    state: "WA",
    address: "3001 Puyalupabsh St",
    description:
      "Historic fan zone hosted by the Puyallup Tribe — the first Indigenous nation formally represented at the FIFA World Cup™. Official viewing parties, cultural programming, and live entertainment.",
    dates: "June 15 – July 6, 2026",
    website: "https://puyallupalltogether.org",
    coverImage:
      "https://puyallupalltogether.org/wp-content/uploads/2026/02/AdobeStock_924205395-scaled.jpeg",
    capacity: 8000,
    features: ["Giant Screens", "Cultural Programming", "Live Entertainment", "Historic Event"],
    tag: "PUYALLUP TRIBE",
  },
  {
    id: "spokane",
    name: "Fan Zone — Spokane",
    city: "Spokane",
    state: "WA",
    address: "Riverfront Park, Spokane",
    description:
      "Community fan zone in Spokane at Riverfront Park representing Eastern Washington — match broadcasts, entertainment, food, and fan activities during the World Cup.",
    dates: "Select match days, June–July 2026",
    website: "https://www.seattlefwc26.org/events/fan-zones",
    coverImage:
      "https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?w=800&q=80",
    capacity: null,
    features: ["Giant Screens", "Riverfront Park", "Food & Drinks", "Community Events"],
    tag: "SPOKANE",
  },
  {
    id: "pasco",
    name: "Fan Zone — Pasco / Tri-Cities",
    city: "Pasco",
    state: "WA",
    address: "Gesa Stadium & Pasco Sports Complex, 6200 Burden Blvd",
    description:
      "Fan zone at Gesa Stadium in the Tri-Cities — outdoor stadium venue with live music, family activities, local vendors, and large-screen match viewing. June 15, 19, July 1 & 6.",
    dates: "June 15, 19, July 1 & 6, 2026",
    website: "https://www.pasco-wa.gov/1715/Official-Seattle-FWC26-Fan-Zone",
    coverImage:
      "https://www.pasco-wa.gov/ImageRepository/Document?documentId=69217",
    capacity: 15000,
    features: ["Giant Screens", "Stadium Venue", "Live Music", "Family Activities", "Free Entry"],
    tag: "TRI-CITIES",
  },
  {
    id: "vancouver",
    name: "Fan Zone — Vancouver, WA",
    city: "Vancouver",
    state: "WA",
    address: "Downtown Vancouver, WA",
    description:
      "Community fan zone in Vancouver, WA — just across the Columbia River from Portland — with live match broadcasts, local food, entertainment, and community gatherings.",
    dates: "Select match days, June–July 2026",
    website: "https://www.seattlefwc26.org/events/fan-zones",
    coverImage:
      "https://images.unsplash.com/photo-1525498128493-380d1990a112?w=800&q=80",
    capacity: null,
    features: ["Giant Screens", "Waterfront Views", "Local Food", "Community Events"],
    tag: "VANCOUVER WA",
  },
  {
    id: "yakima",
    name: "Fan Zone — Yakima (SunDome)",
    city: "Yakima",
    state: "WA",
    address: "Yakima Valley SunDome, 1301 S Fair Ave",
    description:
      "Community fan zone at the Yakima Valley SunDome and State Fair Park — indoor and outdoor viewing with local entertainment, food vendors, and family programming in Washington wine country.",
    dates: "Select match days, June–July 2026",
    website: "https://www.statefairpark.org/",
    coverImage:
      "https://images.unsplash.com/photo-1570498839593-e565b39455fc?w=800&q=80",
    capacity: 12000,
    features: ["Indoor + Outdoor", "Giant Screens", "Food & Drinks", "Family Friendly"],
    tag: "YAKIMA",
  },
];

const FAQS = [
  {
    q: "What is a community fan zone vs the official FIFA Fan Festival™?",
    a: "The official FIFA Fan Festival™ is at Seattle Center (305 Harrison St) — the single FIFA-sanctioned central hub with the largest production, directly beneath the Space Needle. The 9 community fan zones on this page are city-hosted watch party events spread across Washington State, organized in partnership with Seattle FWC26.",
  },
  {
    q: "Are the fan zones free to attend?",
    a: "Most are free. Olympia-Lacey charges $10 GA (youth 12 & under free) with a $75 VIP upgrade. The Pasco/Tri-Cities zone is free. Others may have small fees — check each zone's website.",
  },
  {
    q: "Do I need a FIFA match ticket to attend a fan zone?",
    a: "No — fan zones are completely separate from Lumen Field. You watch live match broadcasts on giant screens. No World Cup match ticket is needed.",
  },
  {
    q: "Are the fan zones open for every match?",
    a: "No — each zone has its own schedule based on selected match days. Olympia-Lacey has 4 specific dates; others vary. Check each zone's website for their calendar.",
  },
  {
    q: "Can I find a bar or restaurant watch party near a fan zone?",
    a: "Yes — MatchWatch lists hundreds of bars, restaurants, and venues hosting watch parties across Washington State. Use the 'Find Watch Parties' button on any zone card.",
  },
];

const MW_VARS = `
  :root{
    --mw-bg:var(--background);
    --mw-bg-1:var(--card);
    --mw-line:var(--border);
    --mw-line-2:var(--border);
    --mw-fg:var(--foreground);
    --mw-fg-dim:var(--muted-foreground);
    --mw-fg-mute:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);
  }
`;

const CSS = `
  .fz-page{background:var(--mw-bg);min-height:100vh;color:var(--mw-fg);}

  /* ── Breadcrumb ── */
  .fz-bc{max-width:1200px;margin:0 auto;padding:20px 24px 0;display:flex;align-items:center;gap:6px;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--mw-fg-mute);letter-spacing:.05em;}
  .fz-bc a{color:var(--mw-fg-mute);text-decoration:none;}
  .fz-bc a:hover{color:var(--mw-accent);}
  .fz-bc .sep{opacity:.4;}

  /* ── Hero ── */
  .fz-hero{position:relative;overflow:hidden;min-height:440px;display:flex;align-items:center;background:linear-gradient(160deg,var(--mw-bg) 0%,#091520 50%,#0a1a12 100%);border-bottom:1px solid var(--mw-line);}
  .fz-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 70% 80% at 80% 50%,rgba(0,180,100,.08),transparent 70%),radial-gradient(ellipse 50% 60% at 10% 30%,rgba(0,60,120,.12),transparent 70%);pointer-events:none;}
  .fz-hero-inner{position:relative;z-index:2;max-width:1200px;margin:0 auto;padding:148px 24px 64px;width:100%;}
  .fz-kicker{display:inline-flex;align-items:center;gap:8px;font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;margin-bottom:20px;border:1px solid color-mix(in srgb,var(--mw-accent) 30%,transparent);padding:5px 12px;border-radius:999px;}
  .fz-kicker .bd{width:6px;height:6px;background:var(--mw-accent);border-radius:50%;animation:bd 1.4s ease-in-out infinite;}
  @keyframes bd{0%,100%{opacity:.4;}50%{opacity:1;}}
  .fz-h1{font-size:clamp(2.2rem,5vw,3.6rem);font-weight:900;line-height:1.05;color:var(--mw-fg);margin:0 0 16px;letter-spacing:-.02em;font-family:"Space Grotesk",sans-serif;}
  .fz-h1 b{color:var(--mw-accent);}
  .fz-sub{font-size:1rem;color:var(--mw-fg-dim);line-height:1.65;max-width:580px;margin-bottom:32px;}
  .fz-btns{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:48px;}
  .fz-btn-p{display:inline-flex;align-items:center;gap:8px;padding:13px 26px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;background:var(--mw-accent);color:#0a0b0d;transition:all .2s;}
  .fz-btn-p:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}
  .fz-btn-g{display:inline-flex;align-items:center;gap:8px;padding:13px 26px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none;border:1px solid var(--mw-line-2);color:var(--mw-fg-dim);transition:all .2s;}
  .fz-btn-g:hover{border-color:var(--mw-fg-dim);color:var(--mw-fg);}
  .fz-stats{display:flex;gap:40px;padding-top:36px;border-top:1px solid var(--mw-line);}
  .fz-sv{font-size:1.9rem;font-weight:900;color:var(--mw-fg);line-height:1;font-family:"Space Grotesk",sans-serif;}
  .fz-sv span{color:var(--mw-accent);}
  .fz-sl{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mw-fg-mute);margin-top:4px;}

  /* ── Fan Festival callout ── */
  .fz-ff-callout{max-width:1200px;margin:0 auto;padding:32px 24px 0;}
  .fz-ff-box{border:1px solid color-mix(in srgb,var(--mw-accent) 30%,transparent);background:linear-gradient(120deg,color-mix(in srgb,var(--mw-accent) 6%,transparent),transparent),var(--mw-bg-1);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;}
  .fz-ff-left{display:flex;align-items:center;gap:14px;}
  .fz-ff-icon{width:40px;height:40px;background:var(--mw-accent);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0a0b0d;flex-shrink:0;}
  .fz-ff-label{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;margin-bottom:2px;}
  .fz-ff-name{font-family:"Space Grotesk",sans-serif;font-size:15px;font-weight:800;color:var(--mw-fg);}
  .fz-ff-meta{font-size:12px;color:var(--mw-fg-mute);}

  /* ── Wrap ── */
  .fz-wrap{max-width:1200px;margin:0 auto;padding:0 24px;}
  .fz-sh{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:28px;}
  .fz-st{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:1.5rem;color:var(--mw-fg);letter-spacing:-.01em;display:flex;align-items:center;gap:12px;}
  .fz-sb{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--mw-accent);letter-spacing:.1em;border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:4px;font-weight:700;}
  .fz-sl2{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mw-fg-mute);text-decoration:none;display:inline-flex;align-items:center;gap:4px;}
  .fz-sl2:hover{color:var(--mw-accent);}

  /* ── Zone grid ── */
  .fz-gw{padding:64px 0 80px;}
  .fz-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
  .fz-card{border:1px solid var(--mw-line);background:var(--mw-bg-1);display:flex;flex-direction:column;transition:all .2s;overflow:hidden;}
  .fz-card:hover{border-color:color-mix(in srgb,var(--mw-accent) 40%,transparent);box-shadow:0 12px 40px rgba(0,0,0,.4);transform:translateY(-3px);}
  .fz-img{position:relative;height:190px;overflow:hidden;background:#111;}
  .fz-img img{width:100%;height:100%;object-fit:cover;transition:transform .4s;}
  .fz-card:hover .fz-img img{transform:scale(1.04);}
  .fz-img-ov{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.6) 0%,transparent 55%);}
  .fz-city-badge{position:absolute;top:10px;left:10px;font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.16em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.15);color:var(--mw-accent);backdrop-filter:blur(6px);font-weight:700;}
  .fz-body{padding:18px;flex:1;display:flex;flex-direction:column;}
  .fz-name{font-family:"Space Grotesk",sans-serif;font-size:15px;font-weight:800;color:var(--mw-fg);margin-bottom:5px;line-height:1.2;}
  .fz-addr{display:flex;align-items:flex-start;gap:5px;font-size:12px;color:var(--mw-fg-mute);margin-bottom:8px;line-height:1.4;}
  .fz-addr svg{flex-shrink:0;margin-top:1px;}
  .fz-dates{display:flex;align-items:center;gap:5px;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--mw-accent);margin-bottom:10px;font-weight:600;}
  .fz-desc{font-size:12.5px;color:var(--mw-fg-dim);line-height:1.6;flex:1;margin-bottom:14px;}
  .fz-features{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px;}
  .fz-feat{font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.05em;padding:2px 7px;border:1px solid var(--mw-line);color:var(--mw-fg-mute);border-radius:3px;}
  .fz-cap{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--mw-fg-mute);display:flex;align-items:center;gap:4px;margin-bottom:14px;}
  .fz-foot{display:flex;flex-direction:column;gap:7px;border-top:1px dashed var(--mw-line);padding-top:14px;margin-top:auto;}
  .fz-website{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 14px;font-size:13px;font-weight:700;text-decoration:none;background:var(--mw-accent);color:#0a0b0d;border-radius:5px;transition:opacity .15s;}
  .fz-website:hover{opacity:.88;}
  .fz-watchparty{display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 14px;font-size:12px;font-weight:600;text-decoration:none;border:1px solid var(--mw-line-2);color:var(--mw-fg-dim);border-radius:5px;transition:all .15s;}
  .fz-watchparty:hover{border-color:var(--mw-fg-dim);color:var(--mw-fg);}

  /* ── Register CTA ── */
  .fz-cta{padding:0 0 80px;}
  .fz-ctabox{border:1px solid var(--mw-line);background:linear-gradient(130deg,color-mix(in srgb,var(--mw-accent) 8%,transparent),transparent 60%),var(--mw-bg-1);padding:52px 48px;display:grid;grid-template-columns:1fr auto;gap:40px;align-items:center;}
  .fz-ctak{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mw-accent);margin-bottom:12px;font-weight:700;}
  .fz-ctah2{font-family:"Space Grotesk",sans-serif;font-size:1.7rem;font-weight:900;color:var(--mw-fg);margin-bottom:10px;line-height:1.1;}
  .fz-ctap{font-size:14px;color:var(--mw-fg-dim);line-height:1.65;max-width:500px;}
  .fz-ctabtns{display:flex;flex-direction:column;gap:10px;min-width:200px;}
  .fz-ctabtn{display:flex;justify-content:center;align-items:center;gap:6px;padding:13px 22px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;transition:all .18s;}
  .fz-ctabtn.primary{background:var(--mw-accent);color:#0a0b0d;}
  .fz-ctabtn.primary:hover{opacity:.88;}
  .fz-ctabtn.ghost{border:1px solid var(--mw-line-2);color:var(--mw-fg-dim);}
  .fz-ctabtn.ghost:hover{border-color:var(--mw-fg-dim);color:var(--mw-fg);}

  /* ── FAQ ── */
  .fz-faqw{padding:0 0 96px;}
  .fz-faq{border:1px solid var(--mw-line);overflow:hidden;}
  .fz-faq-item{border-bottom:1px solid var(--mw-line);}
  .fz-faq-item:last-child{border-bottom:none;}
  .fz-faq-q{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;cursor:pointer;font-family:"Space Grotesk",sans-serif;font-size:15px;font-weight:700;color:var(--mw-fg);background:none;border:none;width:100%;text-align:left;transition:background .12s;}
  .fz-faq-q:hover{background:rgba(255,255,255,.03);}
  .fz-faq-q svg{flex-shrink:0;color:var(--mw-fg-mute);transition:transform .2s;}
  .fz-faq-q.open svg{transform:rotate(180deg);}
  .fz-faq-a{padding:0 24px 20px;font-size:14px;color:var(--mw-fg-dim);line-height:1.7;}

  @media(max-width:1024px){
    .fz-grid{grid-template-columns:repeat(2,1fr);}
    .fz-ctabox{grid-template-columns:1fr;gap:24px;}
  }
  @media(max-width:640px){
    .fz-grid{grid-template-columns:1fr;}
    .fz-h1{font-size:2rem;}
    .fz-stats{gap:24px;flex-wrap:wrap;}
    .fz-ctabox{padding:28px 20px;}
    .fz-hero-inner{padding:120px 20px 48px;}
  }
`;

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fz-faq-item">
      <button className={`fz-faq-q${open ? " open" : ""}`} onClick={() => setOpen(v => !v)}>
        {q}
        <ChevronDown size={16} />
      </button>
      {open && <div className="fz-faq-a">{a}</div>}
    </div>
  );
}

export default function SeattleFanZonesPage() {
  const params = useParams<{ citySlug: string }>();
  if (!SUPPORTED_CITIES.includes(params.citySlug)) notFound();

  return (
    <div className="fz-page">
      <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
      <FloatingNav />

      {/* ── Breadcrumb ── */}
      <div className="fz-bc">
        <Link href="/world-cup">World Cup 2026</Link>
        <span className="sep">/</span>
        <Link href="/world-cup/seattle">Seattle</Link>
        <span className="sep">/</span>
        <span>Community Fan Zones</span>
      </div>

      {/* ── Hero ── */}
      <section className="fz-hero">
        <div className="fz-hero-inner">
          <div className="fz-kicker">
            <span className="bd" />Seattle FWC26 · Washington State
          </div>
          <h1 className="fz-h1">
            9 Official<br />
            <b>Community Fan Zones</b>
          </h1>
          <p className="fz-sub">
            In addition to the official FIFA Fan Festival™ at Seattle Center, 9 communities
            across Washington State are hosting official fan zones — free community watch party
            spaces from Bellingham to Vancouver and Spokane to Yakima.
          </p>
          <div className="fz-btns">
            <a href="#zones" className="fz-btn-p">
              <MapPin size={15} /> Explore All 9 Fan Zones
            </a>
            <Link href="/world-cup/seattle/fan-festival" className="fz-btn-g">
              <Shield size={14} /> Official FIFA Fan Festival™
            </Link>
            <a href="https://www.seattlefwc26.org/events/fan-zones" target="_blank" rel="noopener noreferrer" className="fz-btn-g">
              <Globe size={14} /> Official FWC26 Site
            </a>
          </div>
          <div className="fz-stats">
            <div><div className="fz-sv"><span>9</span></div><div className="fz-sl">Community Zones</div></div>
            <div><div className="fz-sv"><span>Free</span></div><div className="fz-sl">Most Zones</div></div>
            <div><div className="fz-sv"><span>6</span></div><div className="fz-sl">Seattle Matches</div></div>
            <div><div className="fz-sv">Jun <span>15</span></div><div className="fz-sl">First Kickoff</div></div>
          </div>
        </div>
      </section>

      {/* ── Official Fan Festival callout banner ── */}
      <div className="fz-ff-callout">
        <div className="fz-ff-box">
          <div className="fz-ff-left">
            <div className="fz-ff-icon">
              <Shield size={18} />
            </div>
            <div>
              <div className="fz-ff-label">Official FIFA Fan Festival™ · Seattle</div>
              <div className="fz-ff-name">Let&apos;s Play SEA &apos;26 — Seattle Center</div>
              <div className="fz-ff-meta">305 Harrison St · The Armory &amp; Mural Amphitheatre · Beneath the Space Needle · All match days</div>
            </div>
          </div>
          <Link href="/world-cup/seattle/fan-festival" className="fz-btn-p" style={{ whiteSpace: "nowrap" }}>
            <ExternalLink size={14} /> View Fan Festival
          </Link>
        </div>
      </div>

      {/* ── 9 Community Fan Zones ── */}
      <section className="fz-gw" id="zones">
        <div className="fz-wrap">
          <div className="fz-sh">
            <div className="fz-st">
              Community Fan Zones <span className="fz-sb">9 CITIES · WA STATE</span>
            </div>
            <a href="https://www.seattlefwc26.org/events/fan-zones" target="_blank" rel="noopener noreferrer" className="fz-sl2">
              seattlefwc26.org <ExternalLink size={12} />
            </a>
          </div>

          <div className="fz-grid">
            {FAN_ZONES.map((zone) => (
              <div key={zone.id} className="fz-card">
                <div className="fz-img">
                  <img
                    src={zone.coverImage}
                    alt={zone.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1431440869543-efaf3388c585?w=800&q=80";
                    }}
                  />
                  <div className="fz-img-ov" />
                  <div className="fz-city-badge">{zone.tag}</div>
                </div>
                <div className="fz-body">
                  <div className="fz-name">{zone.name}</div>
                  <div className="fz-addr"><MapPin size={11} />{zone.address}, {zone.city}, {zone.state}</div>
                  <div className="fz-dates"><Calendar size={11} />{zone.dates}</div>
                  <p className="fz-desc">{zone.description}</p>
                  <div className="fz-features">
                    {zone.features.map(f => <span key={f} className="fz-feat">{f}</span>)}
                  </div>
                  {zone.capacity && (
                    <div className="fz-cap"><Users size={10} />Up to {zone.capacity.toLocaleString()} fans</div>
                  )}
                  <div className="fz-foot">
                    <a href={zone.website} target="_blank" rel="noopener noreferrer" className="fz-website">
                      <ExternalLink size={13} /> Visit Fan Zone Website
                    </a>
                    <Link href="/world-cup/seattle" className="fz-watchparty">
                      <Building2 size={12} /> Find Watch Parties Near {zone.city}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Register CTA ── */}
      <section className="fz-cta">
        <div className="fz-wrap">
          <div className="fz-ctabox">
            <div>
              <div className="fz-ctak">For Bars &amp; Restaurants in Washington State</div>
              <div className="fz-ctah2">Host a World Cup Watch Party</div>
              <p className="fz-ctap">
                Register on MatchWatch to get discovered by thousands of fans looking for
                watch parties near the fan zones this summer. List your events, manage
                reservations, and fill every seat.
              </p>
            </div>
            <div className="fz-ctabtns">
              <Link href="/for-venues/register" className="fz-ctabtn primary">
                <Building2 size={14} /> Register Your Venue — Free
              </Link>
              <Link href="/world-cup/seattle" className="fz-ctabtn ghost">
                <Star size={13} /> Browse Seattle Venues
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="fz-faqw">
        <div className="fz-wrap">
          <div className="fz-sh">
            <div className="fz-st">FAQ <span className="fz-sb">COMMUNITY FAN ZONES</span></div>
          </div>
          <div className="fz-faq">
            {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
          <div style={{ marginTop: 48, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/world-cup/seattle/fan-festival" className="fz-btn-p" style={{ textDecoration: "none" }}>
              <Shield size={14} /> Official FIFA Fan Festival™
            </Link>
            <Link href="/world-cup/seattle" className="fz-btn-g" style={{ textDecoration: "none" }}>
              <ChevronRight size={14} /> All Seattle Watch Parties
            </Link>
            <Link href="/world-cup" className="fz-btn-g" style={{ textDecoration: "none" }}>
              All 11 Host Cities
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
