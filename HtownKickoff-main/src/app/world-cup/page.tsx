"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { Menu, X, Building2, Star, Trophy, ChevronRight, Globe } from "lucide-react";

const NAV_LINKS = [
  { label: "Home",       href: "/" },
  { label: "Matches",    href: "/matches" },
  { label: "World Cup",  href: "/world-cup" },
  { label: "Venues",     href: "/venues" },
  { label: "For venues", href: "/for-venues" },
];

const CITIES = [
  { name: "New York / New Jersey", short: "NY/NJ", stadium: "MetLife Stadium",         cap: "82,500", matches: 9, badge: "THE FINAL",       g: "linear-gradient(145deg,#001840 0%,#8b0000 100%)" },
  { name: "Los Angeles",           short: "LA",    stadium: "SoFi Stadium",             cap: "70,240", matches: 9, badge: "SEMIFINAL",       g: "linear-gradient(145deg,#2d0a6e 0%,#c8a200 100%)" },
  { name: "Dallas",                short: "DAL",   stadium: "AT&T Stadium",             cap: "80,000", matches: 8, badge: "TOP HOST",        g: "linear-gradient(145deg,#001a40 0%,#7a5500 100%)" },
  { name: "Houston",               short: "HOU",   stadium: "NRG Stadium",              cap: "72,220", matches: 7, badge: "OPENING",         g: "linear-gradient(145deg,#001840 0%,#b84a00 100%)" },
  { name: "Miami",                 short: "MIA",   stadium: "Hard Rock Stadium",         cap: "65,326", matches: 7, badge: "BEACH CITY",     g: "linear-gradient(145deg,#003060 0%,#a83200 100%)" },
  { name: "Atlanta",               short: "ATL",   stadium: "Mercedes-Benz Stadium",    cap: "71,000", matches: 7, badge: "SOCCER CITY",    g: "linear-gradient(145deg,#0a0000 0%,#7a0020 100%)" },
  { name: "San Francisco Bay Area",short: "SF",    stadium: "Levi's Stadium",           cap: "68,500", matches: 7, badge: "TECH CITY",      g: "linear-gradient(145deg,#5a0000 0%,#6a5000 100%)" },
  { name: "Philadelphia",          short: "PHI",   stadium: "Lincoln Financial Field",  cap: "69,800", matches: 7, badge: "LIBERTY CITY",   g: "linear-gradient(145deg,#002030 0%,#3a4a50 100%)" },
  { name: "Seattle",               short: "SEA",   stadium: "Lumen Field",              cap: "68,740", matches: 6, badge: "SOCCER CAPITAL", g: "linear-gradient(145deg,#001030 0%,#1a4a00 100%)" },
  { name: "Boston",                short: "BOS",   stadium: "Gillette Stadium",         cap: "65,000", matches: 6, badge: "HISTORIC CITY",  g: "linear-gradient(145deg,#6a0010 0%,#001030 100%)" },
  { name: "Kansas City",           short: "KC",    stadium: "Arrowhead Stadium",        cap: "76,416", matches: 6, badge: "HEART OF USA",   g: "linear-gradient(145deg,#6a0010 0%,#7a5000 100%)" },
];

const VENUES = [
  { city: "Houston",     name: "Midtown Soccer Hub",  type: "Sports Bar · Watch Party Venue" },
  { city: "Dallas",      name: "Deep Ellum Sports",   type: "Premium Sports Pub · Big Screen" },
  { city: "Miami",       name: "Wynwood Soccer Bar",  type: "Craft Sports Bar · DJ Nights" },
  { city: "Los Angeles", name: "The Rooftop LA",      type: "Rooftop Bar · Live Match Screens" },
  { city: "NY / NJ",     name: "Hoboken Sports Bar",  type: "Classic Sports Pub · Big Screen" },
  { city: "Atlanta",     name: "Midtown Sports Pub",  type: "Sports Bar · Watch Party Host" },
];

const CSS = `
  .wc-page{background:#0a0b0d;min-height:100vh;color:#f1ece4;}

  /* ── Nav ── */
  .wc-topbar{position:sticky;top:0;z-index:20;display:flex;justify-content:center;padding:10px 16px;}
  .wc-topbar-inner{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:1080px;padding:10px 20px;border-radius:999px;background:color-mix(in srgb,#0a0b0d 75%,transparent);backdrop-filter:blur(16px);border:1px solid rgba(35,39,47,.8);box-shadow:0 2px 20px rgba(0,0,0,.25);}
  .wc-logo{display:block;width:156px;height:auto;max-height:44px;object-fit:contain;}
  .wc-nav{display:flex;align-items:center;gap:2px;}
  .wc-nav a{padding:7px 14px;border-radius:999px;font-size:13px;font-weight:600;color:rgba(241,236,228,.55);transition:all .18s;text-decoration:none;}
  .wc-nav a:hover{background:rgba(255,255,255,.07);color:#f1ece4;}
  .wc-nav a.on{background:color-mix(in srgb,#F97316 18%,transparent);color:#f1ece4;}
  .wc-tr{display:flex;gap:8px;align-items:center;}
  .wc-ghost{padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;color:rgba(241,236,228,.7);text-decoration:none;}
  .wc-ghost:hover{background:rgba(255,255,255,.07);color:#f1ece4;}
  .wc-orange{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;background:#F97316;color:#fff;transition:all .18s;}
  .wc-orange:hover{opacity:.88;transform:translateY(-1px);}
  .wc-hmbg{display:none;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid rgba(35,39,47,.8);border-radius:999px;background:rgba(255,255,255,.04);color:#f1ece4;cursor:pointer;}

  /* ── Hero ── */
  .wc-hero{position:relative;overflow:hidden;min-height:580px;display:flex;align-items:center;background:linear-gradient(160deg,#0a0b0d 0%,#0d1520 40%,#1a0a05 100%);border-bottom:1px solid #23272f;}
  .wc-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 70% 50%,rgba(249,115,22,.12),transparent 70%),radial-gradient(ellipse 60% 80% at 20% 30%,rgba(0,80,160,.15),transparent 70%);pointer-events:none;}
  .wc-hero-orb{position:absolute;right:-80px;top:50%;transform:translateY(-50%);width:520px;height:520px;border-radius:50%;border:1px solid rgba(249,115,22,.07);}
  .wc-hero-inner{position:relative;z-index:2;max-width:1080px;margin:0 auto;padding:80px 24px 60px;width:100%;}
  .wc-kicker{display:inline-flex;align-items:center;gap:8px;font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#F97316;font-weight:700;margin-bottom:20px;border:1px solid rgba(249,115,22,.3);padding:5px 12px;border-radius:999px;}
  .wc-kicker .bd{width:6px;height:6px;background:#F97316;border-radius:50%;animation:bd 1.4s ease-in-out infinite;}
  @keyframes bd{0%,100%{opacity:.4;}50%{opacity:1;}}
  .wc-h1{font-size:clamp(2.4rem,6vw,4.4rem);font-weight:900;line-height:1.0;color:#f1ece4;margin:0 0 16px;letter-spacing:-.02em;max-width:660px;}
  .wc-h1 b{color:#F97316;font-weight:900;}
  .wc-sub{font-size:1.05rem;color:rgba(241,236,228,.65);line-height:1.6;max-width:540px;margin-bottom:36px;}
  .wc-btns{display:flex;flex-wrap:wrap;gap:12px;}
  .wc-btn-p{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;background:#F97316;color:#fff;transition:all .2s;}
  .wc-btn-p:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(249,115,22,.35);}
  .wc-btn-g{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none;border:1px solid rgba(241,236,228,.22);color:rgba(241,236,228,.8);transition:all .2s;}
  .wc-btn-g:hover{border-color:rgba(241,236,228,.45);color:#f1ece4;}
  .wc-stats{display:flex;gap:40px;margin-top:52px;padding-top:40px;border-top:1px solid #23272f;}
  .wc-sv{font-size:2rem;font-weight:900;color:#f1ece4;line-height:1;}
  .wc-sv span{color:#F97316;}
  .wc-sl{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(241,236,228,.45);}

  /* ── Shared layout ── */
  .wc-wrap{max-width:1080px;margin:0 auto;padding:0 24px;}
  .wc-sh{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:28px;}
  .wc-st{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:1.6rem;color:#f1ece4;letter-spacing:-.01em;display:flex;align-items:center;gap:12px;}
  .wc-sb{font-family:"JetBrains Mono",monospace;font-size:10px;color:#F97316;letter-spacing:.1em;border:1px solid rgba(249,115,22,.35);padding:3px 8px;border-radius:4px;font-weight:700;}
  .wc-sl2{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(241,236,228,.5);text-decoration:none;display:inline-flex;align-items:center;gap:4px;}
  .wc-sl2:hover{color:#F97316;}

  /* ── City cards ── */
  .wc-cw{padding:64px 0 80px;}
  .wc-cg{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
  .wc-cc{position:relative;overflow:hidden;border:1px solid rgba(35,39,47,.7);cursor:pointer;transition:all .2s;text-decoration:none;display:block;min-height:196px;}
  .wc-cc:hover{transform:translateY(-3px);box-shadow:0 20px 48px rgba(0,0,0,.55);border-color:rgba(249,115,22,.35);}
  .wc-cbg{position:absolute;inset:0;opacity:.9;transition:opacity .2s;}
  .wc-cc:hover .wc-cbg{opacity:1;}
  .wc-cov{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,.1) 55%,transparent 100%);}
  .wc-ci{position:relative;z-index:2;padding:18px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;min-height:196px;}
  .wc-cbadge{display:inline-flex;font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.9);background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.15);padding:3px 7px;margin-bottom:8px;align-self:flex-start;backdrop-filter:blur(4px);}
  .wc-cn{font-family:"Space Grotesk",sans-serif;font-size:1.35rem;font-weight:900;color:#fff;line-height:1.1;margin-bottom:4px;}
  .wc-cs{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.07em;color:rgba(255,255,255,.6);text-transform:uppercase;margin-bottom:10px;}
  .wc-cm{display:flex;gap:12px;align-items:center;}
  .wc-cmn{font-family:"JetBrains Mono",monospace;font-size:11px;color:rgba(255,255,255,.8);}
  .wc-cmn .n{font-weight:700;color:#F97316;font-size:14px;}
  .wc-cex{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:3px;margin-left:auto;transition:color .16s;}
  .wc-cc:hover .wc-cex{color:#F97316;}

  /* ── Venue cards ── */
  .wc-vw{padding:0 0 80px;}
  .wc-vg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
  .wc-vc{border:1px solid #23272f;background:#101217;padding:20px;transition:all .16s;}
  .wc-vc:hover{border-color:rgba(249,115,22,.3);background:#14171d;}
  .wc-vcity{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#F97316;margin-bottom:8px;}
  .wc-vname{font-family:"Space Grotesk",sans-serif;font-size:16px;font-weight:700;color:#f1ece4;margin-bottom:4px;}
  .wc-vtype{font-size:12px;color:rgba(241,236,228,.5);margin-bottom:14px;}
  .wc-vf{display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px dashed #23272f;}
  .wc-vs{color:#F97316;font-size:12px;letter-spacing:2px;}
  .wc-vl{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(241,236,228,.5);text-decoration:none;}
  .wc-vl:hover{color:#F97316;}

  /* ── Sponsor CTA ── */
  .wc-spw{padding:0 0 80px;}
  .wc-sp{border:1px solid #23272f;background:linear-gradient(130deg,rgba(249,115,22,.08),transparent 60%),#0d1016;padding:52px 48px;display:grid;grid-template-columns:1fr auto;gap:40px;align-items:center;}
  .wc-spk{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#F97316;margin-bottom:12px;font-weight:700;}
  .wc-sph2{font-family:"Space Grotesk",sans-serif;font-size:1.9rem;font-weight:900;color:#f1ece4;margin-bottom:12px;line-height:1.1;}
  .wc-spp{font-size:14px;color:rgba(241,236,228,.6);line-height:1.65;max-width:540px;}
  .wc-spb{display:flex;flex-direction:column;gap:10px;min-width:196px;}
  .wc-spbtn{display:flex;justify-content:center;align-items:center;gap:6px;padding:12px 20px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;border:1px solid rgba(241,236,228,.2);color:rgba(241,236,228,.7);transition:all .18s;}
  .wc-spbtn:hover{border-color:rgba(241,236,228,.4);color:#f1ece4;}

  /* ── Fan Festival ── */
  .wc-fw{padding:0 0 80px;}
  .wc-fb{border:1px solid #23272f;background:linear-gradient(160deg,rgba(0,60,120,.1),transparent 60%),#0d1016;padding:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;}
  .wc-fh2{font-family:"Space Grotesk",sans-serif;font-size:1.5rem;font-weight:900;color:#f1ece4;margin-bottom:14px;}
  .wc-fp{font-size:13px;color:rgba(241,236,228,.62);line-height:1.7;margin-bottom:20px;}
  .wc-fcg{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .wc-fci{border:1px solid #23272f;padding:9px 12px;font-size:12px;color:rgba(241,236,228,.7);display:flex;align-items:center;gap:8px;}
  .wc-fci .d{width:6px;height:6px;background:#F97316;border-radius:50%;flex-shrink:0;}

  /* ── Responsive ── */
  @media(max-width:1024px){
    .wc-cg,.wc-vg{grid-template-columns:repeat(2,1fr);}
    .wc-sp{grid-template-columns:1fr;gap:24px;}
    .wc-fb{grid-template-columns:1fr;}
  }
  @media(max-width:900px){
    .wc-nav,.wc-ghost{display:none !important;}
    .wc-hmbg{display:inline-flex;}
    .wc-logo{width:120px;}
    .wc-stats{gap:24px;}
  }
  @media(max-width:640px){
    .wc-cg,.wc-vg,.wc-fcg{grid-template-columns:1fr;}
    .wc-h1{font-size:2rem;}
    .wc-sp{padding:28px 20px;}
  }
`;

export default function WorldCupPage() {
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);

  const dash =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? "/admin"
    : user?.role === "BUSINESS" || user?.role === "VENUE_OWNER" ? "/admin"
    : "/account";

  return (
    <div className="wc-page">
      <style>{CSS}</style>

      {/* ── Sticky Nav ── */}
      <header className="wc-topbar">
        <div className="wc-topbar-inner">
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
            <img src="/logo.svg" alt="MatchWatch" className="wc-logo" />
          </Link>

          <nav className="wc-nav">
            {NAV_LINKS.map(l => {
              const on = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} className={on ? "on" : ""}>
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="wc-tr">
            {isAuthenticated
              ? <Link href={dash} className="wc-ghost">Dashboard</Link>
              : <Link href="/login" className="wc-ghost">Log in</Link>
            }
            <Link href="/for-venues/register" className="wc-orange">
              <Building2 size={14} /> List your venue
            </Link>
            <button className="wc-hmbg" onClick={() => setOpen(!open)} style={{ border: "none" }}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 16, right: 16, zIndex: 50,
            background: "color-mix(in srgb,#0a0b0d 97%,transparent)",
            backdropFilter: "blur(24px)", border: "1px solid rgba(35,39,47,.8)", borderRadius: 16,
            padding: 16, display: "flex", flexDirection: "column", gap: 8,
            boxShadow: "0 16px 48px rgba(0,0,0,.4)",
          }}>
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{
                padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,.04)",
                color: "#f1ece4", fontWeight: 600, fontSize: 14, textDecoration: "none",
              }}>
                {l.label}
              </Link>
            ))}
            {isAuthenticated
              ? <Link href={dash} onClick={() => setOpen(false)} style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,.04)", color: "#f1ece4", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Dashboard</Link>
              : <Link href="/login" onClick={() => setOpen(false)} style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,.04)", color: "#f1ece4", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Log in</Link>
            }
            <Link href="/for-venues/register" onClick={() => setOpen(false)} style={{
              padding: "12px 16px", borderRadius: 12, background: "#F97316", color: "#fff",
              fontWeight: 700, fontSize: 14, textDecoration: "none", display: "flex", alignItems: "center", gap: 8,
            }}>
              <Building2 size={16} /> List your venue
            </Link>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="wc-hero">
        <div className="wc-hero-orb" />
        <div className="wc-hero-inner">
          <div className="wc-kicker">
            <span className="bd" />FIFA World Cup 2026 · Official Fan Hub
          </div>
          <h1 className="wc-h1">
            World Cup 2026<br />
            <b>Watch Parties</b> &amp;<br />
            Fan Festivals
          </h1>
          <p className="wc-sub">
            Discover the best soccer venues, fan festivals, and match-day experiences across all 11 U.S. host cities.
            From Houston to New York — find your perfect watch party.
          </p>
          <div className="wc-btns">
            <a href="#cities" className="wc-btn-p">
              <Trophy size={18} /> Explore Host Cities
            </a>
            <Link href="/venues" className="wc-btn-g">Find Watch Parties</Link>
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
              <div className="wc-sv">Jun <span>11</span></div>
              <div className="wc-sl">Opening Match</div>
            </div>
            <div>
              <div className="wc-sv">Jul <span>19</span></div>
              <div className="wc-sl">The Final · NYC</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 11 Host Cities ── */}
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
            {CITIES.map(c => (
              <Link
                key={c.short}
                href={"/venues?city=" + encodeURIComponent(c.name)}
                className="wc-cc"
              >
                <div className="wc-cbg" style={{ background: c.g }} />
                <div className="wc-cov" />
                <div className="wc-ci">
                  <span className="wc-cbadge">{c.badge}</span>
                  <div className="wc-cn">{c.name}</div>
                  <div className="wc-cs">{c.stadium} · {c.cap}</div>
                  <div className="wc-cm">
                    <div className="wc-cmn">
                      <span className="n">{c.matches}</span> matches
                    </div>
                    <div className="wc-cex">
                      Explore <ChevronRight size={12} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Watch Party Venues ── */}
      <section className="wc-vw">
        <div className="wc-wrap">
          <div className="wc-sh">
            <div className="wc-st">
              Featured Watch Party Venues <span className="wc-sb">SPONSOR SPOTS</span>
            </div>
            <Link href="/venues" className="wc-sl2">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="wc-vg">
            {VENUES.map((v, i) => (
              <div key={i} className="wc-vc">
                <div className="wc-vcity">{v.city}</div>
                <div className="wc-vname">{v.name}</div>
                <div className="wc-vtype">{v.type}</div>
                <div className="wc-vf">
                  <div className="wc-vs">★★★★★</div>
                  <Link href="/venues" className="wc-vl">View venue →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sponsor CTA ── */}
      <section className="wc-spw">
        <div className="wc-wrap">
          <div className="wc-sp">
            <div>
              <div className="wc-spk">Limited Sponsor Spots Available</div>
              <div className="wc-sph2">Own Your City&apos;s World Cup Page</div>
              <p className="wc-spp">
                Get your venue or brand featured as the exclusive sponsor for one of the 11 U.S. host city pages.
                Reach thousands of soccer fans searching for match-day experiences in your city.
              </p>
            </div>
            <div className="wc-spb">
              <Link href="/for-venues/register" className="wc-orange" style={{ justifyContent: "center" }}>
                <Star size={15} /> Become a Featured Venue
              </Link>
              <Link href="/contact" className="wc-spbtn">Sponsor This City Page</Link>
              <Link href="/for-venues" className="wc-spbtn">List Your Venue</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FIFA Fan Festival ── */}
      <section className="wc-fw">
        <div className="wc-wrap">
          <div className="wc-fb">
            <div>
              <div className="wc-spk">Official Events</div>
              <div className="wc-fh2">FIFA Fan Festivals™</div>
              <p className="wc-fp">
                FIFA Fan Festivals are free, official events held in host cities throughout the tournament —
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
                textTransform: "uppercase", color: "#F97316", marginBottom: 14, fontWeight: 700,
              }}>
                Fan Festival Host Cities
              </div>
              <div className="wc-fcg">
                {CITIES.map(c => (
                  <div key={c.short} className="wc-fci">
                    <div className="d" />
                    {c.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
