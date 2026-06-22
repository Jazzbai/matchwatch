"use client";

import React from "react";
import Link from "next/link";
import { useData } from "../lib/data-provider";
import { useAuth } from "../lib/auth-context";
import { FloatingNav } from "../components/AppShell";
import { WORLD_CUP_FLAGS, WORLD_CUP_SCHEDULE } from "./world-cup/schedule";

/* 11 US host cities. `image` is an optional photo in /public/cities/; when the
   file is absent the gradient shows through as a designed fallback. */
const HOST_CITIES = [
  { name: "New York / New Jersey", slug: "new-york", badge: "THE FINAL", g: "linear-gradient(145deg,#001840,#8b0000)", image: "/cities/new-york.webp" },
  { name: "Los Angeles", slug: "los-angeles", badge: "SEMIFINAL", g: "linear-gradient(145deg,#2d0a6e,#c8a200)", image: "/cities/los-angeles.webp" },
  { name: "Dallas", slug: "dallas", badge: "TOP HOST", g: "linear-gradient(145deg,#001a40,#7a5500)", image: "/cities/dallas.webp" },
  { name: "Houston", slug: "houston", badge: "OPENING", g: "linear-gradient(145deg,#001840,#b84a00)", image: "/cities/houston.webp" },
  { name: "Miami", slug: "miami", badge: "BEACH CITY", g: "linear-gradient(145deg,#003060,#a83200)", image: "/cities/miami.webp" },
  { name: "Atlanta", slug: "atlanta", badge: "SOCCER CITY", g: "linear-gradient(145deg,#0a0000,#7a0020)", image: "/cities/atlanta.webp" },
  { name: "San Francisco Bay Area", slug: "san-francisco", badge: "TECH CITY", g: "linear-gradient(145deg,#5a0000,#6a5000)", image: "/cities/san-francisco.webp" },
  { name: "Philadelphia", slug: "philadelphia", badge: "LIBERTY CITY", g: "linear-gradient(145deg,#002030,#3a4a50)", image: "/cities/philadelphia.webp" },
  { name: "Seattle", slug: "seattle", badge: "SOCCER CAPITAL", g: "linear-gradient(145deg,#001030,#1a4a00)", image: "/cities/seattle.webp" },
  { name: "Boston", slug: "boston", badge: "HISTORIC CITY", g: "linear-gradient(145deg,#6a0010,#001030)", image: "/cities/boston.webp" },
  { name: "Kansas City", slug: "kansas-city", badge: "HEART OF USA", g: "linear-gradient(145deg,#6a0010,#7a5000)", image: "/cities/kansas-city.webp" },
];

const MW_VARS = `
  :root{
    --mw-bg:var(--background);--mw-card:var(--card);--mw-line:var(--border);
    --mw-fg:var(--foreground);--mw-dim:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);--mw-ink:#0a0b0d;
  }
`;

const CSS = `
  .hp{background:var(--mw-bg);color:var(--mw-fg);}
  .hp-wrap{max-width:1200px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  /* Hero */
  .hp-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mw-line);min-height:560px;display:flex;align-items:center;}
  .hp-hero-bg{position:absolute;inset:0;background:#06070a url(/home-hero.webp) center/cover no-repeat;}
  .hp-hero-scrim{position:absolute;inset:0;background:linear-gradient(110deg,rgba(6,7,10,0.94) 0%,rgba(6,7,10,0.78) 40%,rgba(6,7,10,0.45) 100%),linear-gradient(0deg,var(--mw-bg) 2%,transparent 40%);}
  .hp-hero-inner{position:relative;z-index:2;max-width:1200px;margin-inline:auto;width:100%;padding:150px clamp(16px,4vw,28px) 64px;}
  .hp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mw-accent) 32%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:20px;}
  .hp-kicker .bd{width:6px;height:6px;border-radius:50%;background:var(--mw-accent);animation:hpPulse 1.4s ease-in-out infinite;}
  @keyframes hpPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
  .hp-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2.4rem,6vw,4.2rem);line-height:0.98;letter-spacing:-0.025em;margin:0 0 16px;color:#fff;max-width:720px;text-wrap:balance;}
  .hp-h1 em{font-style:normal;color:var(--mw-accent);}
  .hp-sub{max-width:560px;font-size:1.05rem;line-height:1.55;color:rgba(255,255,255,0.78);margin:0 0 28px;}
  .hp-cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;}
  .hp-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;border:1px solid rgba(255,255,255,0.22);color:#fff;transition:all .18s;cursor:pointer;}
  .hp-btn:hover{border-color:rgba(255,255,255,0.5);}
  .hp-btn.primary{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}
  .hp-btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}

  /* Section scaffolding */
  .hp-sec{padding:48px 0;border-top:1px solid var(--mw-line);}
  .hp-sec:first-of-type{border-top:0;}
  .hp-sh{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:22px;}
  .hp-st{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.5rem;letter-spacing:-0.01em;display:flex;align-items:center;gap:12px;}
  .hp-st .tag{font-family:var(--font-mono),monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;color:var(--mw-accent);border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:6px;}
  .hp-see{font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--mw-dim);text-decoration:none;white-space:nowrap;}
  .hp-see:hover{color:var(--mw-accent);}

  /* City strip */
  .hp-strip{display:flex;gap:14px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;}
  .hp-strip::-webkit-scrollbar{display:none;}
  .hp-city{position:relative;flex:0 0 248px;height:200px;border-radius:12px;overflow:hidden;border:1px solid var(--mw-line);text-decoration:none;transition:transform .18s,box-shadow .18s,border-color .18s;}
  .hp-city:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(0,0,0,0.45);border-color:color-mix(in srgb,var(--mw-accent) 35%,transparent);}
  .hp-city-bg{position:absolute;inset:0;}
  .hp-city-scrim{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0.1) 55%,transparent 100%);}
  .hp-city-in{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;justify-content:flex-end;padding:14px;}
  .hp-city-badge{align-self:flex-start;font-family:var(--font-mono),monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.9);background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.18);padding:3px 7px;border-radius:999px;margin-bottom:8px;backdrop-filter:blur(4px);}
  .hp-city-name{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.15rem;color:#fff;line-height:1.1;}
  .hp-city-meta{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.06em;color:rgba(255,255,255,0.7);margin-top:4px;text-transform:uppercase;}

  /* Match cards */
  .hp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;}
  .hp-match{border:1px solid var(--mw-line);border-radius:12px;background:var(--mw-card);padding:16px;display:flex;flex-direction:column;gap:12px;text-decoration:none;color:inherit;transition:border-color .14s,transform .14s;}
  .hp-match:hover{border-color:color-mix(in srgb,var(--mw-accent) 32%,transparent);transform:translateY(-2px);}
  .hp-match-top{display:flex;align-items:center;justify-content:space-between;font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--mw-dim);}
  .hp-match-tag{color:var(--mw-accent);font-weight:800;}
  .hp-match-city{color:var(--mw-accent);font-weight:700;}
  .hp-live{display:inline-flex;align-items:center;gap:5px;color:var(--mw-accent);font-weight:700;}
  .hp-live .dot{width:6px;height:6px;border-radius:50%;background:var(--mw-accent);box-shadow:0 0 8px var(--mw-accent);animation:hpPulse 1.3s infinite;}
  .hp-team{display:flex;align-items:center;gap:10px;}
  .hp-team.away{justify-content:flex-end;text-align:right;}
  .hp-team img{width:30px;height:30px;object-fit:contain;flex-shrink:0;}
  .hp-crest{width:30px;height:30px;border-radius:6px;display:grid;place-items:center;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:11px;color:#fff;flex-shrink:0;}
  .hp-team-name{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:600;font-size:15px;}
  .hp-score{margin-left:auto;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:18px;}
  .hp-vs{font-family:var(--font-mono),monospace;font-size:11px;color:var(--mw-dim);font-weight:800;text-align:center;}
  .hp-match-foot{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px dashed var(--mw-line);font-family:var(--font-mono),monospace;font-size:11px;color:var(--mw-dim);}
  .hp-match-foot .go{color:var(--mw-accent);font-weight:700;}

  /* Venue cards */
  .hp-venue{border:1px solid var(--mw-line);border-radius:12px;overflow:hidden;background:var(--mw-card);text-decoration:none;color:inherit;display:flex;flex-direction:column;transition:border-color .14s,transform .14s;}
  .hp-venue:hover{border-color:color-mix(in srgb,var(--mw-accent) 32%,transparent);transform:translateY(-2px);}
  .hp-venue-img{position:relative;aspect-ratio:16/10;background:linear-gradient(135deg,#2a1d14,#0d0f14);overflow:hidden;}
  .hp-venue-img img{width:100%;height:100%;object-fit:cover;}
  .hp-venue-glyph{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:40px;color:rgba(255,255,255,0.16);}
  .hp-venue-pill{position:absolute;top:8px;left:8px;font-family:var(--font-mono),monospace;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:#fff;background:rgba(0,0,0,0.55);padding:3px 7px;border-radius:999px;backdrop-filter:blur(4px);}
  .hp-venue-body{padding:14px;display:flex;flex-direction:column;gap:6px;}
  .hp-venue-city{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--mw-dim);}
  .hp-venue-name{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:17px;line-height:1.15;}
  .hp-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;}
  .hp-chip{font-family:var(--font-mono),monospace;font-size:9px;letter-spacing:0.06em;text-transform:uppercase;color:var(--mw-dim);border:1px solid var(--mw-line);padding:3px 7px;border-radius:999px;}
  .hp-venue-foot{margin-top:auto;padding-top:10px;display:flex;align-items:center;justify-content:space-between;font-family:var(--font-mono),monospace;font-size:11px;color:var(--mw-dim);}
  .hp-venue-foot .go{color:var(--mw-accent);font-weight:700;}

  /* How it works */
  .hp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
  .hp-step{border:1px solid var(--mw-line);border-radius:12px;background:var(--mw-card);padding:22px;}
  .hp-step .n{font-family:var(--font-mono),monospace;font-size:12px;font-weight:700;color:var(--mw-ink);background:var(--mw-accent);width:28px;height:28px;border-radius:8px;display:grid;place-items:center;margin-bottom:12px;}
  .hp-step h3{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:16px;margin:0 0 6px;}
  .hp-step p{font-size:13px;color:var(--mw-dim);line-height:1.5;margin:0;}

  /* Partners */
  .hp-partners{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--mw-line);border-radius:12px;overflow:hidden;}
  .hp-partner{padding:24px;border-right:1px solid var(--mw-line);display:flex;flex-direction:column;gap:12px;}
  .hp-partner:last-child{border-right:0;}
  .hp-partner .wm{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:22px;letter-spacing:-0.03em;}
  .hp-partner .wm em{font-style:normal;color:var(--mw-accent);}
  .hp-partner p{font-size:13px;color:var(--mw-dim);line-height:1.55;flex:1;margin:0;}
  .hp-partner a{align-self:flex-start;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:var(--mw-accent);text-decoration:none;border:1px solid var(--mw-accent);padding:8px 14px;border-radius:999px;}
  .hp-partner a:hover{background:var(--mw-accent);color:var(--mw-ink);}

  /* Bottom CTA band */
  .hp-band{border:1px solid var(--mw-line);border-radius:12px;background:linear-gradient(120deg,color-mix(in srgb,var(--mw-accent) 10%,transparent),transparent 60%),var(--mw-card);padding:36px;display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;}
  .hp-band h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.6rem;margin:0 0 6px;}
  .hp-band p{font-size:14px;color:var(--mw-dim);margin:0;max-width:520px;}

  .hp-empty{padding:36px 20px;text-align:center;border:1px dashed var(--mw-line);border-radius:12px;color:var(--mw-dim);font-size:14px;}

  @media(max-width:760px){
    .hp-hero-inner{padding:128px 16px 48px;}
    .hp-steps,.hp-partners{grid-template-columns:1fr;}
    .hp-partner{border-right:0;border-bottom:1px solid var(--mw-line);}
    .hp-partner:last-child{border-bottom:0;}
  }
`;

function Crest({ src, label, color }: { src?: string; label: string; color?: string }) {
  const [failed, setFailed] = React.useState(false);
  if (src && !failed) {
    return <img src={src} alt="" onError={() => setFailed(true)} />;
  }
  return (
    <span className="hp-crest" style={{ background: color || "var(--mw-accent)" }}>
      {label.substring(0, 2).toUpperCase()}
    </span>
  );
}

export default function HomePage() {
  const { venues, isLoading } = useData();
  const { user } = useAuth();
  const railMatches = WORLD_CUP_SCHEDULE.group.slice(0, 8);

  const featuredVenues = venues
    .filter((venue) => {
      const name = venue.name.toLowerCase();
      return !venue.amenities?.includes("OFFICIAL_FAN_FEST") &&
        !name.includes("fifa fan festival") &&
        !name.includes("fifa fan zone") &&
        !name.includes("official fifa fan zone");
    })
    .slice(0, 8);

  return (
    <div className="hp">
      <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
      <FloatingNav />

      {/* â”€â”€ Hero â”€â”€ */}
      <section className="hp-hero">
        <div className="hp-hero-bg" />
        <div className="hp-hero-scrim" />
        <div className="hp-hero-inner">
          <span className="hp-kicker"><span className="bd" />World Cup 2026 Â· 11 US host cities</span>
          <h1 className="hp-h1">Find your <em>World Cup</em> watch party.</h1>
          <p className="hp-sub">
            The 2026 World Cup comes to North America. Find the bar showing your match, reserve a
            table, and watch every game with fans near you â€” all summer long.
          </p>
          <div className="hp-cta-row">
            <Link href="/venues" className="hp-btn primary">Find a bar near me</Link>
            <Link href="/world-cup" className="hp-btn">Explore host cities</Link>
            {!user && <Link href="/login?view=signup" className="hp-btn">Join free</Link>}
          </div>
        </div>
      </section>

      <div className="hp-wrap">
        {/* â”€â”€ Host cities â”€â”€ */}
        <section className="hp-sec">
          <div className="hp-sh">
            <div className="hp-st">Host cities <span className="tag">WC 2026</span></div>
            <Link href="/world-cup" className="hp-see">All host cities â†’</Link>
          </div>
          <div className="hp-strip">
            {HOST_CITIES.map((c) => (
              <Link key={c.slug} href={`/world-cup/${c.slug}`} className="hp-city">
                <div className="hp-city-bg" style={{ background: `url(${c.image}) center/cover no-repeat, ${c.g}` }} />
                <div className="hp-city-scrim" />
                <div className="hp-city-in">
                  <span className="hp-city-badge">{c.badge}</span>
                  <div className="hp-city-name">{c.name}</div>
                  <div className="hp-city-meta">Find watch parties â†’</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* â”€â”€ Tonight / this week â”€â”€ */}
        <section className="hp-sec">
          <div className="hp-sh">
            <div className="hp-st">
              World Cup matches
              <span className="tag">{railMatches.length} games</span>
            </div>
            <Link href="/world-cup#schedule" className="hp-see">Full WC schedule</Link>
          </div>

          {isLoading && railMatches.length === 0 ? (
            <div className="hp-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="hp-match" style={{ opacity: 0.4, minHeight: 150 }} />
              ))}
            </div>
          ) : railMatches.length > 0 ? (
            <div className="hp-grid">
              {railMatches.map((m) => {
                const homeFlag = WORLD_CUP_FLAGS[m.home];
                const awayFlag = WORLD_CUP_FLAGS[m.away];
                return (
                  <Link key={`${m.group}-${m.home}-${m.away}`} href="/world-cup#schedule" className="hp-match">
                    <div className="hp-match-top">
                      <span>{m.group}</span>
                      {m.tag ? <span className="hp-match-tag">{m.tag}</span> : <span>{m.date}</span>}
                    </div>
                    <div className="hp-team">
                      {homeFlag && <img src={`https://flagcdn.com/24x18/${homeFlag}.png`} width={24} height={18} alt="" />}
                      <span className="hp-team-name">{m.home}</span>
                    </div>
                    <div className="hp-vs">VS</div>
                    <div className="hp-team away">
                      <span className="hp-team-name">{m.away}</span>
                      {awayFlag && <img src={`https://flagcdn.com/24x18/${awayFlag}.png`} width={24} height={18} alt="" />}
                    </div>
                    <div className="hp-match-foot">
                      <span>{m.date} · {m.time}</span>
                      <span className="hp-match-city">{m.city}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="hp-empty">No matches scheduled right now â€” check back soon.</div>
          )}
        </section>

        {/* â”€â”€ Featured venues â”€â”€ */}
        <section className="hp-sec">
          <div className="hp-sh">
            <div className="hp-st">Watch-party venues</div>
            <Link href="/venues" className="hp-see">Browse all venues â†’</Link>
          </div>

          {isLoading && featuredVenues.length === 0 ? (
            <div className="hp-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="hp-venue" style={{ opacity: 0.4, minHeight: 240 }} />
              ))}
            </div>
          ) : featuredVenues.length > 0 ? (
            <div className="hp-grid">
              {featuredVenues.map((v) => (
                <Link key={v.id} href={`/venues/${v.slug || v.id}`} className="hp-venue">
                  <div className="hp-venue-img">
                    {v.coverImageUrl
                      ? <img src={v.coverImageUrl} alt={v.name} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      : <span className="hp-venue-glyph">{v.name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase()}</span>}
                    {(v.upcomingEventsCount || 0) > 0 && <span className="hp-venue-pill">{v.upcomingEventsCount} events</span>}
                  </div>
                  <div className="hp-venue-body">
                    <div className="hp-venue-city">{v.city}{v.state ? `, ${v.state}` : ""}</div>
                    <div className="hp-venue-name">{v.name}</div>
                    <div className="hp-chips">
                      {(v.amenities || []).slice(0, 3).map((a) => <span key={a} className="hp-chip">{a}</span>)}
                    </div>
                    <div className="hp-venue-foot">
                      <span>{v.rating ? `â­ ${v.rating.toFixed(1)}${v.reviewCount ? ` Â· ${v.reviewCount}` : ""}` : "Sports bar"}</span>
                      <span className="go">Reserve â†’</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="hp-empty">Venues are loading â€” check back in a moment.</div>
          )}
        </section>

        {/* â”€â”€ How it works â”€â”€ */}
        <section className="hp-sec">
          <div className="hp-sh"><div className="hp-st">How it works</div></div>
          <div className="hp-steps">
            {[
              { n: "1", h: "Find your match", p: "Browse World Cup fixtures and every league, with team crests and kickoff times in your timezone." },
              { n: "2", h: "Pick a venue", p: "See bars hosting your match near you â€” photos, amenities, ratings, and how to get there." },
              { n: "3", h: "Reserve your spot", p: "Book a table in seconds and watch with fans. Venues confirm and you're set." },
            ].map((s) => (
              <div key={s.n} className="hp-step">
                <div className="n">{s.n}</div>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* â”€â”€ Partners â”€â”€ */}
        <section className="hp-sec">
          <div className="hp-sh"><div className="hp-st">Strategic partners</div></div>
          <div className="hp-partners">
            <div className="hp-partner">
              <div className="wm">Team<em>Houston</em></div>
              <p>The premier platform for Houston&apos;s amateur and semi-pro football scene. Leagues, tournaments, and community events â€” all in one place.</p>
              <a href="https://www.team-houston.com/" target="_blank" rel="noopener noreferrer">Visit Team Houston â†’</a>
            </div>
            <div className="hp-partner">
              <div className="wm"><em>Activent</em></div>
              <p>Discover local sports events and activities near you. From pickup games to watch parties, Activent connects Houston&apos;s active community.</p>
              <a href="https://www.getactivent.com/" target="_blank" rel="noopener noreferrer">Visit Activent â†’</a>
            </div>
          </div>
        </section>

        {/* â”€â”€ List your venue â”€â”€ */}
        <section className="hp-sec">
          <div className="hp-band">
            <div>
              <h2>Run a bar or restaurant?</h2>
              <p>List your venue free, publish the matches you&apos;re showing, and fill every seat on match nights this summer.</p>
            </div>
            <Link href="/for-venues/register" className="hp-btn primary">List your venue â€” free</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
