"use client";

import React, { useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { FloatingNav } from "../../../../components/AppShell";
import { MapPin, Globe, ChevronRight, ExternalLink, Calendar, Users, Star, Building2, ChevronDown } from "lucide-react";

/* ─── Only show this page for Seattle ─────────────────────────────────────── */
const SUPPORTED_CITIES = ["seattle"];

/* ─── 9 Official Washington State Fan Zones ───────────────────────────────── */
interface FanZone {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  fullAddress: string;
  lat: number;
  lng: number;
  description: string;
  dates: string;
  website: string;
  coverImage: string;
  capacity: number | null;
  features: string[];
  tag: string;
  comingSoon?: boolean;
}

const FAN_ZONES: FanZone[] = [
  {
    id: "bellingham",
    name: "FIFA Fan Zone™ Bellingham",
    city: "Bellingham",
    state: "WA",
    address: "904 Potter St — Waterfront District",
    fullAddress: "904 Potter St, Bellingham, WA 98225",
    lat: 48.7342,
    lng: -122.4971,
    description:
      "Free-admission outdoor fan zone in Bellingham's waterfront district featuring giant match-viewing screens, local food vendors, interactive soccer activities, youth programming, and community celebrations.",
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
    name: "FIFA Fan Zone™ Bremerton",
    city: "Bremerton",
    state: "WA",
    address: "Harborside Fountain Park, 100 Washington Ave",
    fullAddress: "100 Washington Ave, Bremerton, WA 98337",
    lat: 47.5649,
    lng: -122.6271,
    description:
      "Official fan zone at Downtown Bremerton's scenic waterfront. Enjoy match-viewing on giant screens, live entertainment, local vendors, and community atmosphere with stunning harbor views on select World Cup match days.",
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
    name: "FIFA Fan Zone™ Everett",
    city: "Everett",
    state: "WA",
    address: "Downtown Everett Waterfront",
    fullAddress: "Everett, WA",
    lat: 47.9790,
    lng: -122.2021,
    description:
      "Official fan zone in Everett celebrating Seattle's FIFA World Cup 2026 matches. Features live match broadcasts, local food, entertainment, and community gatherings in the heart of downtown.",
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
    name: "Olympia-Lacey Official FIFA Fan Zone™",
    city: "Olympia",
    state: "WA",
    address: "Port of Olympia — Port Plaza, 701 Columbia Street NW",
    fullAddress: "701 Columbia Street NW, Olympia, WA 98501",
    lat: 47.0459,
    lng: -122.9025,
    description:
      "High-energy waterfront festival at Port Plaza with live match screenings, local food vendors, interactive activities, live music, and VIP packages ($75). General admission $10 — youth 12 & under free.",
    dates: "June 19, 24, 25 & 26, 2026",
    website: "https://thurstonchamber.com/fanzone/",
    coverImage:
      "https://thurstonchamber.com/wp-content/uploads/2026/03/Olympia_Lacey-Official-Logo.png",
    capacity: 10000,
    features: ["Giant Screens", "VIP Packages", "Live Music", "Waterfront Festival", "$10 GA"],
    tag: "OLYMPIA–LACEY",
  },
  {
    id: "tacoma",
    name: "Puyallup Tribe Official FIFA Fan Zone™",
    city: "Tacoma",
    state: "WA",
    address: "3001 Puyalupabsh St",
    fullAddress: "3001 Puyalupabsh St, Tacoma, WA 98404",
    lat: 47.2276,
    lng: -122.4131,
    description:
      "Historic fan zone hosted by the Puyallup Tribe — the first Indigenous nation formally represented at the FIFA World Cup™. Features official viewing parties, cultural programming, live entertainment, and community celebrations.",
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
    name: "FIFA Fan Zone™ Spokane",
    city: "Spokane",
    state: "WA",
    address: "Riverfront Park",
    fullAddress: "Spokane, WA",
    lat: 47.6587,
    lng: -117.4260,
    description:
      "Official fan zone in Spokane, Eastern Washington, celebrating Seattle's World Cup 2026 matches. Community gathering at Riverfront Park with match broadcasts, entertainment, food, and fan activities.",
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
    name: "FIFA Fan Zone™ Pasco / Tri-Cities",
    city: "Pasco",
    state: "WA",
    address: "Gesa Stadium & Pasco Sports Complex, 6200 Burden Blvd",
    fullAddress: "6200 Burden Blvd, Pasco, WA 99301",
    lat: 46.2418,
    lng: -119.1028,
    description:
      "Official fan zone at Gesa Stadium & Pasco Sports Complex in the Tri-Cities (Pasco, Richland, Kennewick). Large-screen outdoor viewing with festival atmosphere, live music, family activities, and local vendors.",
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
    name: "FIFA Fan Zone™ Vancouver, WA",
    city: "Vancouver",
    state: "WA",
    address: "Downtown Waterfront",
    fullAddress: "Vancouver, WA",
    lat: 45.6387,
    lng: -122.6615,
    description:
      "Official fan zone in Vancouver, Washington — just across the Columbia River from Portland. Community celebrations with live match broadcasts, local food, entertainment, and interactive soccer activities.",
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
    name: "FIFA Fan Zone™ Yakima — SunDome",
    city: "Yakima",
    state: "WA",
    address: "Yakima Valley SunDome at State Fair Park, 1301 S Fair Ave",
    fullAddress: "1301 S Fair Ave, Yakima, WA 98901",
    lat: 46.5840,
    lng: -120.5050,
    description:
      "Official fan zone at the Yakima Valley SunDome and State Fair Park. Community celebration in Washington wine country featuring live match broadcasts, local entertainment, food vendors, and family-friendly fan activities.",
    dates: "Select match days, June–July 2026",
    website: "https://www.statefairpark.org/",
    coverImage:
      "https://images.unsplash.com/photo-1570498839593-e565b39455fc?w=800&q=80",
    capacity: 12000,
    features: ["Indoor + Outdoor", "Giant Screens", "Food & Drinks", "Family Friendly"],
    tag: "YAKIMA",
  },
];

/* ─── FAQ data ─────────────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: "Are the fan zones free to attend?",
    a: "Most fan zones are free admission. Olympia-Lacey charges $10 general admission (youth 12 & under free) with a $75 VIP upgrade. Some zones may have nominal entry fees — check each zone's website for details.",
  },
  {
    q: "Do I need a ticket to the actual World Cup matches?",
    a: "No — fan zones are completely separate from the matches at Lumen Field. You watch live broadcasts on giant screens at the fan zone venues, free from a FIFA match ticket.",
  },
  {
    q: "Are fan zones open for every World Cup match?",
    a: "Not all fan zones are open every match day. Each zone has its own schedule based on selected match days. Check each zone's website for their specific calendar.",
  },
  {
    q: "Can I find a watch party at a bar or restaurant nearby?",
    a: "Yes — MatchWatch lists hundreds of bars, restaurants, and venues hosting watch parties across Washington State. Browse venues on this page or search by city.",
  },
  {
    q: "When do Seattle's matches take place?",
    a: "Seattle (Lumen Field) hosts 5 group-stage matches from mid-June through early July 2026. Fan zones are open on match days and some additional dates. Check the schedule above.",
  },
  {
    q: "Is parking available at the fan zones?",
    a: "Parking availability varies by location. Most fan zones recommend public transit. The Pasco/Tri-Cities zone at Gesa Stadium offers easy parking access. Check individual zone websites for details.",
  },
];

/* ─── Design tokens (matches existing world-cup pages exactly) ─────────────── */
const MW_VARS = `
  :root{
    --mw-bg:var(--background);
    --mw-bg-1:var(--card);
    --mw-bg-2:var(--card);
    --mw-line:var(--border);
    --mw-line-2:var(--border);
    --mw-fg:var(--foreground);
    --mw-fg-dim:var(--muted-foreground);
    --mw-fg-mute:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);
    --mw-sea:#0a6e4e;
  }
`;

const CSS = `
  .fz-page{background:var(--mw-bg);min-height:100vh;color:var(--mw-fg);}

  /* ── Hero ── */
  .fz-hero{position:relative;overflow:hidden;min-height:480px;display:flex;align-items:center;background:linear-gradient(160deg,var(--mw-bg) 0%,#091520 50%,#0a1a12 100%);border-bottom:1px solid var(--mw-line);}
  .fz-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 70% 80% at 80% 50%,rgba(0,180,100,.08),transparent 70%),radial-gradient(ellipse 50% 60% at 10% 30%,rgba(0,60,120,.12),transparent 70%);pointer-events:none;}
  .fz-hero-bg{position:absolute;inset:0;background:url(https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Mount_Rainier_from_above_Myrtle_Falls_in_August.jpg/1200px-Mount_Rainier_from_above_Myrtle_Falls_in_August.jpg) center/cover no-repeat;opacity:.10;pointer-events:none;}
  .fz-hero-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 0%,var(--mw-bg) 100%);}
  .fz-hero-inner{position:relative;z-index:2;max-width:1200px;margin:0 auto;padding:148px 24px 72px;width:100%;}
  .fz-kicker{display:inline-flex;align-items:center;gap:8px;font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;margin-bottom:20px;border:1px solid color-mix(in srgb,var(--mw-accent) 30%,transparent);padding:5px 12px;border-radius:999px;}
  .fz-kicker .bd{width:6px;height:6px;background:var(--mw-accent);border-radius:50%;animation:bd 1.4s ease-in-out infinite;}
  @keyframes bd{0%,100%{opacity:.4;}50%{opacity:1;}}
  .fz-h1{font-size:clamp(2.2rem,5vw,3.8rem);font-weight:900;line-height:1.05;color:var(--mw-fg);margin:0 0 18px;letter-spacing:-.02em;font-family:"Space Grotesk",sans-serif;}
  .fz-h1 b{color:var(--mw-accent);}
  .fz-sub{font-size:1.05rem;color:var(--mw-fg-dim);line-height:1.65;max-width:600px;margin-bottom:36px;}
  .fz-btns{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:52px;}
  .fz-btn-p{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;background:var(--mw-accent);color:#0a0b0d;transition:all .2s;}
  .fz-btn-p:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}
  .fz-btn-g{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none;border:1px solid var(--mw-line-2);color:var(--mw-fg-dim);transition:all .2s;}
  .fz-btn-g:hover{border-color:var(--mw-fg-dim);color:var(--mw-fg);}
  .fz-stats{display:flex;gap:40px;padding-top:40px;border-top:1px solid var(--mw-line);}
  .fz-sv{font-size:2rem;font-weight:900;color:var(--mw-fg);line-height:1;font-family:"Space Grotesk",sans-serif;}
  .fz-sv span{color:var(--mw-accent);}
  .fz-sl{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mw-fg-mute);margin-top:4px;}

  /* ── Breadcrumb ── */
  .fz-bc{max-width:1200px;margin:0 auto;padding:20px 24px 0;display:flex;align-items:center;gap:6px;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--mw-fg-mute);letter-spacing:.05em;}
  .fz-bc a{color:var(--mw-fg-mute);text-decoration:none;}
  .fz-bc a:hover{color:var(--mw-accent);}
  .fz-bc .sep{opacity:.4;}

  /* ── Wrap ── */
  .fz-wrap{max-width:1200px;margin:0 auto;padding:0 24px;}
  .fz-sh{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:32px;}
  .fz-st{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:1.55rem;color:var(--mw-fg);letter-spacing:-.01em;display:flex;align-items:center;gap:12px;}
  .fz-sb{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--mw-accent);letter-spacing:.1em;border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:4px;font-weight:700;}
  .fz-sl2{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mw-fg-mute);text-decoration:none;display:inline-flex;align-items:center;gap:4px;}
  .fz-sl2:hover{color:var(--mw-accent);}

  /* ── Zone cards section ── */
  .fz-gw{padding:72px 0 80px;}
  .fz-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}

  /* ── Individual zone card ── */
  .fz-card{border:1px solid var(--mw-line);background:var(--mw-bg-1);display:flex;flex-direction:column;transition:all .2s;overflow:hidden;}
  .fz-card:hover{border-color:color-mix(in srgb,var(--mw-accent) 40%,transparent);box-shadow:0 12px 40px rgba(0,0,0,.4);transform:translateY(-3px);}
  .fz-img{position:relative;height:200px;overflow:hidden;background:#111;}
  .fz-img img{width:100%;height:100%;object-fit:cover;transition:transform .4s;}
  .fz-card:hover .fz-img img{transform:scale(1.04);}
  .fz-img-ov{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.65) 0%,transparent 55%);}
  .fz-city-badge{position:absolute;top:12px;left:12px;font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.16em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.15);color:var(--mw-accent);backdrop-filter:blur(6px);font-weight:700;}
  .fz-body{padding:20px;flex:1;display:flex;flex-direction:column;}
  .fz-name{font-family:"Space Grotesk",sans-serif;font-size:16px;font-weight:800;color:var(--mw-fg);margin-bottom:6px;line-height:1.2;}
  .fz-addr{display:flex;align-items:flex-start;gap:6px;font-size:12px;color:var(--mw-fg-mute);margin-bottom:10px;line-height:1.4;}
  .fz-addr svg{flex-shrink:0;margin-top:1px;}
  .fz-dates{display:flex;align-items:center;gap:6px;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--mw-accent);margin-bottom:12px;font-weight:600;}
  .fz-desc{font-size:13px;color:var(--mw-fg-dim);line-height:1.6;flex:1;margin-bottom:16px;}
  .fz-features{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px;}
  .fz-feat{font-family:"JetBrains Mono",monospace;font-size:9.5px;letter-spacing:.06em;padding:3px 8px;border:1px solid var(--mw-line);color:var(--mw-fg-mute);border-radius:4px;}
  .fz-cap{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--mw-fg-mute);display:flex;align-items:center;gap:4px;margin-bottom:18px;}
  .fz-foot{display:flex;flex-direction:column;gap:8px;border-top:1px dashed var(--mw-line);padding-top:16px;margin-top:auto;}
  .fz-website{display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 16px;font-size:13px;font-weight:700;text-decoration:none;background:var(--mw-accent);color:#0a0b0d;border-radius:6px;transition:all .18s;}
  .fz-website:hover{opacity:.88;transform:translateY(-1px);}
  .fz-watchparty{display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 16px;font-size:12px;font-weight:600;text-decoration:none;border:1px solid var(--mw-line-2);color:var(--mw-fg-dim);border-radius:6px;transition:all .18s;}
  .fz-watchparty:hover{border-color:var(--mw-fg-dim);color:var(--mw-fg);}

  /* ── Map hint strip ── */
  .fz-mapstrip{background:linear-gradient(90deg,color-mix(in srgb,var(--mw-accent) 8%,transparent),transparent);border:1px solid color-mix(in srgb,var(--mw-accent) 20%,transparent);padding:16px 24px;display:flex;align-items:center;gap:14px;margin:0 0 72px;}
  .fz-mapstrip p{font-size:13px;color:var(--mw-fg-dim);}
  .fz-mapstrip p b{color:var(--mw-fg);}
  .fz-mapdot{width:8px;height:8px;background:var(--mw-accent);border-radius:50%;flex-shrink:0;animation:bd 1.4s ease-in-out infinite;}

  /* ── CTA banner ── */
  .fz-cta{padding:0 0 80px;}
  .fz-ctabox{border:1px solid var(--mw-line);background:linear-gradient(130deg,color-mix(in srgb,var(--mw-accent) 8%,transparent),transparent 60%),var(--mw-bg-1);padding:52px 48px;display:grid;grid-template-columns:1fr auto;gap:40px;align-items:center;}
  .fz-ctak{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mw-accent);margin-bottom:12px;font-weight:700;}
  .fz-ctah2{font-family:"Space Grotesk",sans-serif;font-size:1.9rem;font-weight:900;color:var(--mw-fg);margin-bottom:12px;line-height:1.1;}
  .fz-ctap{font-size:14px;color:var(--mw-fg-dim);line-height:1.65;max-width:540px;}
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

  /* ── Responsive ── */
  @media(max-width:1024px){
    .fz-grid{grid-template-columns:repeat(2,1fr);}
    .fz-ctabox{grid-template-columns:1fr;gap:24px;}
  }
  @media(max-width:640px){
    .fz-grid{grid-template-columns:1fr;}
    .fz-h1{font-size:2rem;}
    .fz-stats{gap:24px;flex-wrap:wrap;}
    .fz-ctabox{padding:28px 20px;}
    .fz-hero-inner{padding:120px 20px 52px;}
  }
`;

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fz-faq-item">
      <button
        className={`fz-faq-q${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {q}
        <ChevronDown size={16} />
      </button>
      {open && <div className="fz-faq-a">{a}</div>}
    </div>
  );
}

export default function SeattleFanZonesPage() {
  /* Validate city slug on client */
  const params = useParams<{ citySlug: string }>();
  if (!SUPPORTED_CITIES.includes(params.citySlug)) {
    notFound();
  }

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
        <span>Fan Zones</span>
      </div>

      {/* ── Hero ── */}
      <section className="fz-hero">
        <div className="fz-hero-bg" />
        <div className="fz-hero-inner">
          <div className="fz-kicker">
            <span className="bd" />Seattle FWC26 · 9 Official Fan Zones
          </div>
          <h1 className="fz-h1">
            Washington State<br />
            <b>Official Fan Zones</b><br />
            FIFA World Cup 2026
          </h1>
          <p className="fz-sub">
            Seattle is hosting 6 World Cup matches at Lumen Field — and to celebrate,
            9 communities across Washington State are hosting official FIFA Fan Zones
            with giant screens, live entertainment, food, and free community events.
          </p>
          <div className="fz-btns">
            <a href="#zones" className="fz-btn-p">
              <MapPin size={16} /> Explore All 9 Fan Zones
            </a>
            <Link href="/world-cup/seattle" className="fz-btn-g">
              <ChevronRight size={16} /> Seattle Watch Parties
            </Link>
            <a
              href="https://www.seattlefwc26.org/events/fan-zones"
              target="_blank"
              rel="noopener noreferrer"
              className="fz-btn-g"
            >
              <Globe size={15} /> Official FWC26 Site
            </a>
          </div>
          <div className="fz-stats">
            <div>
              <div className="fz-sv"><span>9</span></div>
              <div className="fz-sl">Official Fan Zones</div>
            </div>
            <div>
              <div className="fz-sv"><span>6</span></div>
              <div className="fz-sl">Seattle Matches</div>
            </div>
            <div>
              <div className="fz-sv"><span>Free</span></div>
              <div className="fz-sl">Most Fan Zones</div>
            </div>
            <div>
              <div className="fz-sv">Jun <span>15</span></div>
              <div className="fz-sl">First Seattle Match</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Map awareness strip ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 0" }}>
        <div className="fz-mapstrip">
          <div className="fz-mapdot" />
          <p>
            <b>9 communities across Washington State</b> — from Bellingham in the north
            to Vancouver in the south, and Spokane in the east — are hosting official
            FIFA Fan Zones during Seattle&apos;s World Cup 2026 matches.{" "}
            <a
              href="https://www.seattlefwc26.org/events/fan-zones"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--mw-accent)", textDecoration: "none" }}
            >
              See official map →
            </a>
          </p>
        </div>
      </div>

      {/* ── 9 Fan Zone Cards ── */}
      <section className="fz-gw" id="zones">
        <div className="fz-wrap">
          <div className="fz-sh">
            <div className="fz-st">
              Official Fan Zones <span className="fz-sb">9 ZONES · WA STATE</span>
            </div>
            <a
              href="https://www.seattlefwc26.org/events/fan-zones"
              target="_blank"
              rel="noopener noreferrer"
              className="fz-sl2"
            >
              Official site <ExternalLink size={12} />
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
                  <div className="fz-addr">
                    <MapPin size={12} />
                    {zone.address}, {zone.city}, {zone.state}
                  </div>
                  <div className="fz-dates">
                    <Calendar size={12} />
                    {zone.dates}
                  </div>
                  <p className="fz-desc">{zone.description}</p>
                  <div className="fz-features">
                    {zone.features.map((f) => (
                      <span key={f} className="fz-feat">{f}</span>
                    ))}
                  </div>
                  {zone.capacity && (
                    <div className="fz-cap">
                      <Users size={11} />
                      Up to {zone.capacity.toLocaleString()} fans
                    </div>
                  )}
                  <div className="fz-foot">
                    <a
                      href={zone.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="fz-website"
                    >
                      <ExternalLink size={14} /> Visit Fan Zone Website
                    </a>
                    <Link
                      href={`/world-cup/seattle?city=${zone.city}`}
                      className="fz-watchparty"
                    >
                      <Building2 size={13} /> Find Watch Parties in {zone.city}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Register your venue CTA ── */}
      <section className="fz-cta">
        <div className="fz-wrap">
          <div className="fz-ctabox">
            <div>
              <div className="fz-ctak">For Bars, Restaurants &amp; Event Spaces in Washington</div>
              <div className="fz-ctah2">Host a World Cup Watch Party</div>
              <p className="fz-ctap">
                Are you a bar, restaurant, brewery, or event space near one of the 9 fan zones?
                Register on MatchWatch to get discovered by thousands of soccer fans looking for
                watch party venues across Washington State this summer. List your events,
                manage reservations, and fill every seat.
              </p>
            </div>
            <div className="fz-ctabtns">
              <Link href="/for-venues/register" className="fz-ctabtn primary">
                <Building2 size={15} /> Register Your Venue — Free
              </Link>
              <Link href="/world-cup/seattle" className="fz-ctabtn ghost">
                <Star size={14} /> Browse Seattle Venues
              </Link>
              <Link href="/venues" className="fz-ctabtn ghost">
                All Washington Venues
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="fz-faqw">
        <div className="fz-wrap">
          <div className="fz-sh">
            <div className="fz-st">
              Frequently Asked Questions <span className="fz-sb">FAN ZONES</span>
            </div>
          </div>
          <div className="fz-faq">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>

          {/* Bottom nav */}
          <div style={{ marginTop: 48, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/world-cup/seattle" className="fz-btn-p" style={{ textDecoration: "none" }}>
              <ChevronRight size={16} /> All Seattle Watch Parties
            </Link>
            <Link href="/world-cup" className="fz-btn-g" style={{ textDecoration: "none" }}>
              All 11 Host Cities
            </Link>
            <a
              href="https://www.seattlefwc26.org/events/fan-zones"
              target="_blank"
              rel="noopener noreferrer"
              className="fz-btn-g"
              style={{ textDecoration: "none" }}
            >
              <Globe size={14} /> Official FWC26 Seattle
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
