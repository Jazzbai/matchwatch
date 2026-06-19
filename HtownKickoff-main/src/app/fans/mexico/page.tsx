"use client";

import React from "react";
import Link from "next/link";
import { FloatingNav } from "../../../components/AppShell";

/* ═══════════════════════════════════════════════════
   MEXICO FAN PAGE — /fans/mexico
   "The Green Wave" — El Tri / La Afición Mexicana
   Part of the MatchWatch Fan Culture Series.
   Self-contained, theme-aware (maps the shadcn tokens
   into local --mx-* vars, same pattern as /world-cup).
   ═══════════════════════════════════════════════════ */

const profile = {
  flag: "🇲🇽",
  seriesOrder: 2,
  title: "Mexico — The Green Wave",
  tagline:
    "When El Tri plays, the stadium becomes a fiesta. A sea of green, endless chants, and the wave that conquered the world.",
  nicknames: [
    { name: "El Tri", meaning: "The Tricolor — official team nickname" },
    { name: "La Afición Mexicana", meaning: "The Mexican Supporters" },
    { name: "The Green Wave", meaning: "For the sea of green jerseys" },
    { name: "La Ola Verde", meaning: "Green Wave" },
  ],
  colors: [
    { name: "Green", hex: "#006847" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Red", hex: "#CE1126" },
  ],
  symbols: [
    "Green jerseys", "La Ola (Mexican Wave)", "Mariachi music",
    "Giant flags", "Drums & chants", "Estadio Azteca", "El Tri",
  ],
  ritual: {
    name: "La Ola — The Mexican Wave",
    story:
      "Popularized worldwide at the 1986 World Cup in Mexico. On June 6, 2026, thousands gathered along Paseo de la Reforma in Mexico City to set the record for the largest Mexican wave outside a stadium — with Guinness judges present — marking the wave's 40th anniversary, days before the 2026 World Cup.",
    records: [
      "Largest wave by participants — 157,574 (USA, 2008)",
      "Longest wave line — 8,453 people (Portugal, 2007)",
      "Longest timed wave — 17 min 14 sec (Japan, 2015)",
    ],
  },
  trends: [
    { title: "The Green Wave Movement", summary: "A revival of La Ola — record-breaking crowds in Mexico City turned the wave into a fan-identity campaign for the World Cup countdown.", angle: "Mexico didn't just create a fan tradition. They exported it to the world." },
    { title: "El Tri Is the Hottest Ticket", summary: "Mexico matches are among the highest-demand tickets of WC 2026, especially in Mexico City and Guadalajara.", angle: "No team travels like El Tri." },
    { title: "National Pride + Home Soil", summary: "Mexico's third time hosting (1970, 1986, 2026). Fans see 2026 as a once-in-a-generation shot at a deep run on home soil.", angle: "Three World Cups. One Dream." },
    { title: "Giant Traveling Fan Army", summary: "The Mexican National Team U.S. Tour has played 85+ matches across America since 2002, building one of North America's largest soccer communities.", angle: "Wherever El Tri plays, Mexico follows." },
    { title: "Younger Generation Surge", summary: "Nielsen's 2025 report found Mexico is North America's most engaged soccer market — 63% name soccer their favorite sport (vs. 31% US, 37% Canada).", angle: "A new generation of El Tri supporters is arriving." },
  ],
  funFacts: [
    "Earthquake celebration: fans jumping after Mexico beat Germany 1-0 at the 2018 World Cup created seismic activity detected by instruments in Mexico City.",
    "One of the largest soccer fan bases in the world — football is woven into national identity.",
    "Supporters sing nonstop, win or lose, behind mariachi and stadium drums.",
  ],
  sources: [
    { label: "CNN — Mexico's World Cup traditions", url: "https://www.cnn.com/2026/06/07/americas/world-cup-mexican-wave-soccer-traditions-latam-intl" },
    { label: "Christian Science Monitor — the wave", url: "https://www.csmonitor.com/World/Americas/2026/0611/world-cup-mexico-city-the-wave" },
    { label: "MexTour — official U.S. tour", url: "https://www.mextour.org/" },
    { label: "Nielsen — The Future of Sport 2025", url: "https://www.nielsen.com/news-center/2025/the-future-of-sport-nielsens-2025-report-reveals-growth-drivers/" },
  ],
};

/* ── design tokens (maps theme → local vars, same as /world-cup) ── */
const MX_VARS = `
  :root{
    --mx-bg:var(--background);
    --mx-card:var(--card);
    --mx-line:var(--border);
    --mx-fg:var(--foreground);
    --mx-fg-dim:var(--muted-foreground);
    --mx-green:#0c7a4d;
    --mx-green-deep:#024d36;
    --mx-red:#CE1126;
  }
`;

const CSS = `
  .mx-page{background:var(--mx-bg);min-height:100vh;color:var(--mx-fg);}
  .mx-wrap{max-width:880px;margin:0 auto;padding:28px 20px 72px;display:grid;gap:34px;}

  /* hero */
  .mx-hero{position:relative;overflow:hidden;text-align:center;padding:72px 20px 52px;color:#fff;
    background:linear-gradient(135deg,var(--mx-green) 0%,var(--mx-green-deep) 55%,#7a0a16 165%);}
  .mx-hero::before{content:"";position:absolute;inset:0;
    background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(255,255,255,.16),transparent 70%);pointer-events:none;}
  .mx-flag{font-size:4.6rem;line-height:1;margin-bottom:14px;}
  .mx-kicker{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.16em;
    text-transform:uppercase;font-weight:700;background:rgba(255,255,255,.18);color:#fff;
    padding:6px 14px;border-radius:999px;margin-bottom:18px;}
  .mx-h1{font-size:clamp(2.1rem,5.5vw,3.4rem);font-weight:900;letter-spacing:-.02em;margin:0 0 14px;
    font-family:"Space Grotesk",sans-serif;}
  .mx-tag{max-width:620px;margin:0 auto;font-size:1.05rem;line-height:1.55;color:rgba(255,255,255,.92);font-style:italic;}

  /* sections */
  .mx-h2{font-size:1.5rem;font-weight:800;margin:0 0 16px;letter-spacing:-.01em;font-family:"Space Grotesk",sans-serif;}
  .mx-card{background:var(--mx-card);border:1px solid var(--mx-line);border-radius:16px;padding:20px;}
  .mx-grid{display:grid;gap:12px;}

  /* nicknames */
  .mx-nick{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;padding:13px 16px;}
  .mx-nick b{color:var(--mx-green);font-size:1.1rem;font-weight:800;min-width:160px;font-family:"Space Grotesk",sans-serif;}
  .mx-nick span{color:var(--mx-fg-dim);font-size:.92rem;}

  /* colors */
  .mx-swatches{display:flex;gap:12px;}
  .mx-swatch{flex:1;text-align:center;}
  .mx-chip{height:58px;border-radius:12px;border:1px solid var(--mx-line);}
  .mx-swatch small{display:block;margin-top:7px;color:var(--mx-fg-dim);font-size:11px;letter-spacing:.04em;}

  /* symbols */
  .mx-pills{display:flex;flex-wrap:wrap;gap:9px;}
  .mx-pill{border:1px solid var(--mx-green);color:var(--mx-fg);border-radius:999px;padding:7px 14px;font-size:13px;font-weight:600;}

  /* ritual */
  .mx-ritual{border:1px solid var(--mx-green);border-radius:16px;padding:24px;
    background:linear-gradient(160deg,color-mix(in srgb,var(--mx-green) 12%,var(--mx-card)) 0%,var(--mx-card) 70%);}
  .mx-badge{display:inline-block;background:var(--mx-green);color:#fff;font-size:11px;font-weight:800;
    letter-spacing:.08em;text-transform:uppercase;padding:5px 12px;border-radius:999px;margin-bottom:14px;}
  .mx-rec{font-family:"JetBrains Mono",monospace;font-size:13px;color:var(--mx-fg-dim);
    padding:7px 0 7px 14px;border-left:3px solid var(--mx-red);}

  /* trends */
  .mx-trend{padding:18px 20px;}
  .mx-trend-h{display:flex;align-items:baseline;gap:12px;margin-bottom:9px;}
  .mx-trend-n{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:1.35rem;color:var(--mx-red);}
  .mx-trend-h h3{margin:0;font-size:1.15rem;font-weight:800;font-family:"Space Grotesk",sans-serif;}
  .mx-trend p{margin:0 0 10px;color:var(--mx-fg-dim);line-height:1.55;}
  .mx-angle{margin:0;color:var(--mx-green);font-style:italic;font-weight:600;}

  /* facts */
  .mx-fact{display:flex;gap:13px;padding:14px 16px;align-items:flex-start;}
  .mx-fact span{color:var(--mx-fg-dim);line-height:1.55;}

  /* cta */
  .mx-cta{text-align:center;padding:32px 24px;border:1px solid var(--mx-line);border-radius:16px;
    background:linear-gradient(160deg,color-mix(in srgb,var(--mx-green) 10%,var(--mx-card)) 0%,var(--mx-card) 80%);}
  .mx-btn{display:inline-flex;align-items:center;gap:8px;background:var(--mx-green);color:#fff;
    padding:14px 28px;border-radius:999px;font-weight:800;font-size:14px;text-decoration:none;transition:transform .18s;}
  .mx-btn:hover{transform:translateY(-2px);}

  /* sources */
  .mx-sources{border-top:1px solid var(--mx-line);padding-top:18px;}
  .mx-sources h4{margin:0 0 10px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mx-fg-dim);}
  .mx-sources a{color:var(--mx-green);font-size:12px;margin-right:16px;text-decoration:none;}
  .mx-sources a:hover{text-decoration:underline;}
`;

export default function MexicoFanPage() {
  return (
    <div className="mx-page">
      <style dangerouslySetInnerHTML={{ __html: MX_VARS + CSS }} />
      <FloatingNav />

      {/* hero */}
      <section className="mx-hero">
        <div className="mx-flag">{profile.flag}</div>
        <div className="mx-kicker">Fan Culture Series · #{profile.seriesOrder}</div>
        <h1 className="mx-h1">{profile.title.toUpperCase()}</h1>
        <p className="mx-tag">{profile.tagline}</p>
      </section>

      <div className="mx-wrap">
        {/* nicknames */}
        <section>
          <h2 className="mx-h2">What fans are called</h2>
          <div className="mx-grid">
            {profile.nicknames.map((n) => (
              <div key={n.name} className="mx-card mx-nick">
                <b>{n.name}</b>
                <span>{n.meaning}</span>
              </div>
            ))}
          </div>
        </section>

        {/* colors */}
        <section>
          <h2 className="mx-h2">Colors</h2>
          <div className="mx-swatches">
            {profile.colors.map((c) => (
              <div key={c.name} className="mx-swatch">
                <div className="mx-chip" style={{ background: c.hex }} />
                <small>{c.name}</small>
              </div>
            ))}
          </div>
        </section>

        {/* symbols */}
        <section>
          <h2 className="mx-h2">Signature symbols</h2>
          <div className="mx-pills">
            {profile.symbols.map((s) => (
              <span key={s} className="mx-pill">{s}</span>
            ))}
          </div>
        </section>

        {/* ritual */}
        <section className="mx-ritual">
          <span className="mx-badge">🌊 Signature ritual</span>
          <h2 className="mx-h2">{profile.ritual.name}</h2>
          <p style={{ color: "var(--mx-fg-dim)", lineHeight: 1.6, margin: "0 0 16px" }}>{profile.ritual.story}</p>
          <div className="mx-grid">
            {profile.ritual.records.map((r) => (
              <div key={r} className="mx-rec">{r}</div>
            ))}
          </div>
        </section>

        {/* trends */}
        <section>
          <h2 className="mx-h2">Fan-culture trends to watch</h2>
          <div className="mx-grid">
            {profile.trends.map((t, i) => (
              <div key={t.title} className="mx-card mx-trend">
                <div className="mx-trend-h">
                  <span className="mx-trend-n">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{t.title}</h3>
                </div>
                <p>{t.summary}</p>
                <p className="mx-angle">“{t.angle}”</p>
              </div>
            ))}
          </div>
        </section>

        {/* facts */}
        <section>
          <h2 className="mx-h2">Did you know?</h2>
          <div className="mx-grid">
            {profile.funFacts.map((f) => (
              <div key={f} className="mx-card mx-fact">
                <span style={{ fontSize: "1.2rem" }}>⚡</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </section>

        {/* cta */}
        <section className="mx-cta">
          <h2 className="mx-h2">Watch El Tri in Houston</h2>
          <p style={{ color: "var(--mx-fg-dim)", margin: "0 0 20px" }}>
            Find the bars and lounges throwing Green Wave watch parties on match day.
          </p>
          <Link href="/venues" className="mx-btn">Find watch-party venues →</Link>
        </section>

        {/* sources */}
        <section className="mx-sources">
          <h4>Sources</h4>
          <div>
            {profile.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
