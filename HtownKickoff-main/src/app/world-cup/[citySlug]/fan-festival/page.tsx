"use client";

import React, { useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { FloatingNav } from "../../../../components/AppShell";
import {
  MapPin, Globe, ChevronRight, ExternalLink, Calendar,
  Users, Building2, ChevronDown, Shield, Music, Utensils,
  Tv, Sparkles, Dumbbell, Ticket,
} from "lucide-react";

const SUPPORTED_CITIES = ["seattle"];

/* ─── Feature list with icons ──────────────────────────────────────────────── */
const FEATURES = [
  { icon: <Tv size={15} />,        label: "Indoor Giant Screen — The Armory (all-weather)" },
  { icon: <Tv size={15} />,        label: "Outdoor Big Screen — Mural Amphitheatre" },
  { icon: <Music size={15} />,     label: "International DJs & Live Performances" },
  { icon: <Utensils size={15} />,  label: "Food Vendors & Beverages" },
  { icon: <Sparkles size={15} />,  label: "Public Art & Cultural Activations" },
  { icon: <Dumbbell size={15} />,  label: "Fitness & Interactive Fan Activities" },
  { icon: <Ticket size={15} />,    label: "Free to Attend (Most Programming)" },
  { icon: <Globe size={15} />,     label: "Beneath the Space Needle — Seattle Center" },
];

const FAQS = [
  {
    q: "Where exactly is the official FIFA Fan Festival™ in Seattle?",
    a: "Seattle Center, at 305 Harrison St, Seattle, WA 98109 — right beneath the Space Needle. The main indoor viewing area is The Armory, and outdoor screenings are at the Mural Amphitheatre. The International Fountain plaza also hosts activations.",
  },
  {
    q: "Is the FIFA Fan Festival™ free to attend?",
    a: "Yes — core programming at the Seattle Center FIFA Fan Festival™ is free admission. Some special events, VIP areas, or ticketed performances may apply. Check the Seattle Center website for the full schedule and any ticketed events.",
  },
  {
    q: "Do I need a FIFA match ticket to attend the Fan Festival?",
    a: "No. The Fan Festival is completely separate from Lumen Field. You watch live match broadcasts on giant screens. No World Cup match ticket needed.",
  },
  {
    q: "What is the difference between the Fan Festival and the community fan zones?",
    a: "The FIFA Fan Festival™ at Seattle Center is the single official, FIFA-sanctioned event — the central hub with the largest production. The 9 community fan zones are watch party events spread across Washington State, each hosted by their local city or organization in partnership with Seattle FWC26.",
  },
  {
    q: "How do I get there?",
    a: "Seattle Center is easily accessible by the Seattle Monorail from Downtown's Westlake Center, Metro Bus routes, and multiple paid parking lots nearby. Public transit is strongly recommended on match days as parking is limited.",
  },
  {
    q: "What are the viewing options inside Seattle Center?",
    a: "Two main screens: (1) The Armory — a large indoor covered hall for all-weather match viewing. (2) Mural Amphitheatre — an outdoor stage and screen directly beneath the Space Needle. Additional activations and screens are spread across the Seattle Center campus.",
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
  .ff-page{background:var(--mw-bg);min-height:100vh;color:var(--mw-fg);}

  /* ── Breadcrumb ── */
  .ff-bc{max-width:1200px;margin:0 auto;padding:20px 24px 0;display:flex;align-items:center;gap:6px;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--mw-fg-mute);letter-spacing:.05em;}
  .ff-bc a{color:var(--mw-fg-mute);text-decoration:none;}
  .ff-bc a:hover{color:var(--mw-accent);}
  .ff-bc .sep{opacity:.4;}

  /* ── Hero ── */
  .ff-hero{position:relative;overflow:hidden;min-height:600px;display:flex;align-items:flex-end;}
  .ff-hero-img{position:absolute;inset:0;}
  .ff-hero-img img{width:100%;height:100%;object-fit:cover;}
  .ff-hero-ov{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.92) 0%,rgba(0,0,0,.55) 45%,rgba(0,0,0,.2) 100%);}
  .ff-hero-inner{position:relative;z-index:2;max-width:1200px;margin:0 auto;padding:60px 24px 64px;width:100%;}
  .ff-official-badge{display:inline-flex;align-items:center;gap:8px;font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;padding:6px 14px;border-radius:999px;background:var(--mw-accent);color:#0a0b0d;font-weight:800;margin-bottom:20px;}
  .ff-official-badge .dot{width:6px;height:6px;background:#0a0b0d;border-radius:50%;animation:bd 1.4s ease-in-out infinite;}
  @keyframes bd{0%,100%{opacity:.4;}50%{opacity:1;}}
  .ff-h1{font-size:clamp(2.4rem,5.5vw,4rem);font-weight:900;line-height:1.05;color:#fff;margin:0 0 10px;letter-spacing:-.03em;font-family:"Space Grotesk",sans-serif;}
  .ff-subtitle{font-size:1.1rem;color:rgba(255,255,255,.75);margin-bottom:6px;font-style:italic;}
  .ff-addr-row{display:flex;align-items:center;gap:6px;font-size:13px;color:rgba(255,255,255,.6);margin-bottom:6px;}
  .ff-dates-row{display:flex;align-items:center;gap:6px;font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--mw-accent);font-weight:700;margin-bottom:32px;}
  .ff-btns{display:flex;flex-wrap:wrap;gap:12px;}
  .ff-btn-p{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;background:var(--mw-accent);color:#0a0b0d;transition:all .2s;}
  .ff-btn-p:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 40%,transparent);}
  .ff-btn-g{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none;border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.8);transition:all .2s;}
  .ff-btn-g:hover{border-color:rgba(255,255,255,.6);color:#fff;}

  /* ── Wrap ── */
  .ff-wrap{max-width:1200px;margin:0 auto;padding:0 24px;}
  .ff-sh{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:32px;}
  .ff-st{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:1.55rem;color:var(--mw-fg);letter-spacing:-.01em;display:flex;align-items:center;gap:12px;}
  .ff-sb{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--mw-accent);letter-spacing:.1em;border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:4px;font-weight:700;}
  .ff-sl2{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mw-fg-mute);text-decoration:none;display:inline-flex;align-items:center;gap:4px;}
  .ff-sl2:hover{color:var(--mw-accent);}

  /* ── Details grid ── */
  .ff-details{padding:72px 0 0;}
  .ff-dg{display:grid;grid-template-columns:1fr 360px;gap:48px;align-items:start;}
  .ff-desc{font-size:15px;color:var(--mw-fg-dim);line-height:1.8;margin-bottom:32px;}
  .ff-feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:36px;}
  .ff-feat{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--mw-line);background:var(--mw-bg-1);font-size:13px;color:var(--mw-fg-dim);}
  .ff-feat svg{color:var(--mw-accent);flex-shrink:0;}
  .ff-cap-row{display:flex;align-items:center;gap:6px;font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--mw-fg-mute);padding-top:16px;border-top:1px solid var(--mw-line);}

  /* ── Sidebar card ── */
  .ff-sidebar{border:1px solid color-mix(in srgb,var(--mw-accent) 30%,transparent);background:linear-gradient(145deg,color-mix(in srgb,var(--mw-accent) 6%,transparent),transparent),var(--mw-bg-1);padding:28px;display:flex;flex-direction:column;gap:12px;position:sticky;top:80px;}
  .ff-sidebar-label{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;margin-bottom:4px;}
  .ff-sidebar-name{font-family:"Space Grotesk",sans-serif;font-size:17px;font-weight:900;color:var(--mw-fg);margin-bottom:2px;}
  .ff-sidebar-addr{font-size:12px;color:var(--mw-fg-mute);display:flex;align-items:flex-start;gap:5px;line-height:1.4;margin-bottom:4px;}
  .ff-sidebar-div{height:1px;background:var(--mw-line);margin:4px 0;}
  .ff-sbtn{display:flex;justify-content:center;align-items:center;gap:7px;padding:12px 16px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;transition:all .18s;}
  .ff-sbtn.primary{background:var(--mw-accent);color:#0a0b0d;}
  .ff-sbtn.primary:hover{opacity:.88;}
  .ff-sbtn.ghost{border:1px solid var(--mw-line-2);color:var(--mw-fg-dim);}
  .ff-sbtn.ghost:hover{border-color:var(--mw-fg-dim);color:var(--mw-fg);}

  /* ── Venues strip ── */
  .ff-venues{padding:72px 0 80px;}
  .ff-venues-strip{border:1px solid var(--mw-line);background:var(--mw-bg-1);padding:40px 44px;display:grid;grid-template-columns:1fr auto;gap:40px;align-items:center;}
  .ff-vk{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--mw-accent);margin-bottom:12px;font-weight:700;}
  .ff-vh2{font-family:"Space Grotesk",sans-serif;font-size:1.7rem;font-weight:900;color:var(--mw-fg);margin-bottom:10px;line-height:1.1;}
  .ff-vp{font-size:14px;color:var(--mw-fg-dim);line-height:1.65;max-width:500px;}
  .ff-vbtns{display:flex;flex-direction:column;gap:10px;min-width:200px;}
  .ff-vbtn{display:flex;justify-content:center;align-items:center;gap:7px;padding:13px 20px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;transition:all .18s;}
  .ff-vbtn.primary{background:var(--mw-accent);color:#0a0b0d;}
  .ff-vbtn.primary:hover{opacity:.88;}
  .ff-vbtn.ghost{border:1px solid var(--mw-line-2);color:var(--mw-fg-dim);}
  .ff-vbtn.ghost:hover{border-color:var(--mw-fg-dim);color:var(--mw-fg);}

  /* ── FAQ ── */
  .ff-faqw{padding:0 0 96px;}
  .ff-faq{border:1px solid var(--mw-line);overflow:hidden;}
  .ff-faq-item{border-bottom:1px solid var(--mw-line);}
  .ff-faq-item:last-child{border-bottom:none;}
  .ff-faq-q{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;cursor:pointer;font-family:"Space Grotesk",sans-serif;font-size:15px;font-weight:700;color:var(--mw-fg);background:none;border:none;width:100%;text-align:left;transition:background .12s;}
  .ff-faq-q:hover{background:rgba(255,255,255,.03);}
  .ff-faq-q svg{flex-shrink:0;color:var(--mw-fg-mute);transition:transform .2s;}
  .ff-faq-q.open svg{transform:rotate(180deg);}
  .ff-faq-a{padding:0 24px 20px;font-size:14px;color:var(--mw-fg-dim);line-height:1.7;}

  /* ── Responsive ── */
  @media(max-width:1024px){
    .ff-dg{grid-template-columns:1fr;}
    .ff-venues-strip{grid-template-columns:1fr;gap:24px;}
    .ff-sidebar{position:static;}
  }
  @media(max-width:640px){
    .ff-feat-grid{grid-template-columns:1fr;}
    .ff-h1{font-size:2.2rem;}
    .ff-venues-strip{padding:28px 20px;}
    .ff-hero-inner{padding:40px 20px 48px;}
  }
`;

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ff-faq-item">
      <button className={`ff-faq-q${open ? " open" : ""}`} onClick={() => setOpen(v => !v)}>
        {q}
        <ChevronDown size={16} />
      </button>
      {open && <div className="ff-faq-a">{a}</div>}
    </div>
  );
}

export default function SeattleFanFestivalPage() {
  const params = useParams<{ citySlug: string }>();
  if (!SUPPORTED_CITIES.includes(params.citySlug)) notFound();

  return (
    <div className="ff-page">
      <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
      <FloatingNav />

      {/* ── Breadcrumb ── */}
      <div className="ff-bc">
        <Link href="/world-cup">World Cup 2026</Link>
        <span className="sep">/</span>
        <Link href="/world-cup/seattle">Seattle</Link>
        <span className="sep">/</span>
        <span>Official FIFA Fan Festival™</span>
      </div>

      {/* ── Full-bleed Hero ── */}
      <section className="ff-hero">
        <div className="ff-hero-img">
          <img
            src="https://www.seattlecenter.com/Images/Events/Productions/Lets%20Play%20SEA%2026/LPSea26_1920x1080.jpg"
            alt="FIFA Fan Festival Seattle Center"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1600&q=80";
            }}
          />
        </div>
        <div className="ff-hero-ov" />
        <div className="ff-hero-inner">
          <div className="ff-official-badge">
            <span className="dot" />
            Official FIFA Fan Festival™ · Seattle
          </div>
          <h1 className="ff-h1">FIFA Fan Festival™<br />Seattle</h1>
          <div className="ff-subtitle">Let&apos;s Play SEA &apos;26 — World Soccer Fan Celebration</div>
          <div className="ff-addr-row">
            <MapPin size={13} />
            Seattle Center — The Armory &amp; Mural Amphitheatre, 305 Harrison St, Seattle, WA 98109
          </div>
          <div className="ff-dates-row">
            <Calendar size={13} />
            June–July 2026 · All Match Days
          </div>
          <div className="ff-btns">
            <a
              href="https://www.seattlecenter.com/events/lets-play-sea-26"
              target="_blank"
              rel="noopener noreferrer"
              className="ff-btn-p"
            >
              <ExternalLink size={15} /> Official Seattle Center Site
            </a>
            <Link href="/world-cup/seattle/fan-zones" className="ff-btn-g">
              <MapPin size={14} /> Community Fan Zones
            </Link>
            <Link href="/world-cup/seattle" className="ff-btn-g">
              <ChevronRight size={14} /> Seattle Watch Parties
            </Link>
          </div>
        </div>
      </section>

      {/* ── Details ── */}
      <section className="ff-details">
        <div className="ff-wrap">
          <div className="ff-dg">
            {/* Left — description + features */}
            <div>
              <div className="ff-sh" style={{ marginBottom: 24 }}>
                <div className="ff-st">
                  About the Fan Festival <span className="ff-sb">SEATTLE CENTER</span>
                </div>
              </div>
              <p className="ff-desc">
                The official FIFA Fan Festival™ for Seattle&apos;s World Cup 2026 matches is hosted at
                Seattle Center — the iconic civic campus at the foot of the Space Needle. Under the
                banner <em>Let&apos;s Play SEA &apos;26</em>, Seattle Center transforms into a massive
                World Soccer Fan Celebration open to all: fan experiences, music, movement, art,
                culture, and community in one shared civic experience.
              </p>
              <p className="ff-desc" style={{ marginTop: -16 }}>
                Watch every match on a giant indoor screen inside <strong>The Armory</strong> for
                all-weather covered viewing, or gather outside at the <strong>Mural Amphitheatre</strong>
                {" "}for an outdoor big-screen experience directly beneath the Space Needle. International
                DJs, live performances, immersive activations, public art, food vendors, and
                campus-wide programming make Seattle Center the premier match-day destination in
                Washington State.
              </p>

              <div className="ff-feat-grid">
                {FEATURES.map((f) => (
                  <div key={f.label} className="ff-feat">
                    {f.icon}
                    {f.label}
                  </div>
                ))}
              </div>

              <div className="ff-cap-row">
                <Users size={13} />
                Up to 30,000 fans across Seattle Center campus
              </div>
            </div>

            {/* Right — sticky info card */}
            <div className="ff-sidebar">
              <div>
                <div className="ff-sidebar-label">Official FIFA Fan Festival™</div>
                <div className="ff-sidebar-name">Seattle Center</div>
                <div className="ff-sidebar-addr">
                  <MapPin size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                  305 Harrison St, Seattle, WA 98109
                </div>
              </div>
              <div className="ff-sidebar-div" />
              <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: 'var(--mw-fg-mute)' }}>
                <div style={{ marginBottom: 4 }}>📍 The Armory — indoor screen</div>
                <div style={{ marginBottom: 4 }}>🎬 Mural Amphitheatre — outdoor screen</div>
                <div>🏔 Beneath the Space Needle</div>
              </div>
              <div className="ff-sidebar-div" />
              <a
                href="https://www.seattlecenter.com/events/lets-play-sea-26"
                target="_blank"
                rel="noopener noreferrer"
                className="ff-sbtn primary"
              >
                <Globe size={14} /> Visit Official Website
              </a>
              <a
                href="https://www.google.com/maps/search/?api=1&query=Seattle+Center+305+Harrison+St+Seattle+WA"
                target="_blank"
                rel="noopener noreferrer"
                className="ff-sbtn ghost"
              >
                <MapPin size={13} /> Get Directions
              </a>
              <Link href="/world-cup/seattle" className="ff-sbtn ghost">
                <Building2 size={13} /> Nearby Watch Parties
              </Link>
              <Link href="/world-cup/seattle/fan-zones" className="ff-sbtn ghost">
                <MapPin size={13} /> 9 Community Fan Zones
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Nearby venues CTA ── */}
      <section className="ff-venues">
        <div className="ff-wrap">
          <div className="ff-venues-strip">
            <div>
              <div className="ff-vk">Bars &amp; Restaurants Near Seattle Center</div>
              <div className="ff-vh2">Find a Watch Party Venue Nearby</div>
              <p className="ff-vp">
                Looking for a bar, restaurant, or rooftop near Seattle Center to watch the matches?
                MatchWatch lists hundreds of venues across Seattle hosting World Cup watch parties —
                from Lower Queen Anne and South Lake Union to Capitol Hill and beyond.
              </p>
            </div>
            <div className="ff-vbtns">
              <Link href="/world-cup/seattle" className="ff-vbtn primary">
                <Building2 size={15} /> Seattle Watch Parties
              </Link>
              <Link href="/for-venues/register" className="ff-vbtn ghost">
                Register Your Venue — Free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="ff-faqw">
        <div className="ff-wrap">
          <div className="ff-sh">
            <div className="ff-st">
              FAQ <span className="ff-sb">FIFA FAN FESTIVAL™</span>
            </div>
          </div>
          <div className="ff-faq">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>

          <div style={{ marginTop: 48, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href="https://www.seattlecenter.com/events/lets-play-sea-26"
              target="_blank"
              rel="noopener noreferrer"
              className="ff-btn-p"
              style={{ textDecoration: "none", borderRadius: 999 }}
            >
              <Globe size={14} /> Seattle Center Official Site
            </a>
            <Link href="/world-cup/seattle/fan-zones" className="ff-btn-g" style={{ textDecoration: "none", borderRadius: 999, border: "1px solid var(--mw-line-2)", color: "var(--mw-fg-dim)" }}>
              <MapPin size={14} /> 9 Community Fan Zones
            </Link>
            <Link href="/world-cup/seattle" className="ff-btn-g" style={{ textDecoration: "none", borderRadius: 999, border: "1px solid var(--mw-line-2)", color: "var(--mw-fg-dim)" }}>
              <ChevronRight size={14} /> All Seattle Watch Parties
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
