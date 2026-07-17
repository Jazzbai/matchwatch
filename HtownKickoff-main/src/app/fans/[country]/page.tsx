import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FloatingNav } from "../../../components/AppShell";
import { fanProfiles, getFanProfile } from "../fanProfiles";

type PageProps = {
  params: Promise<{ country: string }>;
};

export function generateStaticParams() {
  return fanProfiles.map((profile) => ({ country: profile.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { country } = await params;
  const profile = getFanProfile(country);
  if (!profile) return {};

  return {
    title: `${profile.country} fans - ${profile.nickname} | MatchWatch`,
    description: profile.blurb,
  };
}

const CSS = `
  .fan-page{--fan-bg:var(--background);--fan-card:var(--card);--fan-line:var(--border);--fan-fg:var(--foreground);--fan-dim:var(--muted-foreground);background:var(--fan-bg);min-height:100vh;color:var(--fan-fg);}
  .fan-wrap{max-width:920px;margin:0 auto;padding:30px 20px 76px;display:grid;gap:34px;}
  .fan-hero{position:relative;overflow:hidden;text-align:center;padding:78px 20px 58px;color:#fff;background:linear-gradient(135deg,var(--fan-accent) 0%,var(--fan-deep) 62%,var(--fan-alt) 170%);}
  .fan-hero:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(255,255,255,.18),transparent 70%);pointer-events:none;}
  .fan-hero > *{position:relative;z-index:1;}
  .fan-flag{display:inline-grid;place-items:center;width:76px;height:76px;border-radius:18px;border:1px solid rgba(255,255,255,.28);background:rgba(0,0,0,.18);font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:1.25rem;letter-spacing:.08em;margin-bottom:16px;}
  .fan-kicker{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;background:rgba(255,255,255,.18);color:#fff;padding:6px 14px;border-radius:999px;margin-bottom:18px;}
  .fan-h1{font-size:clamp(2.1rem,5.5vw,3.55rem);font-weight:900;letter-spacing:0;margin:0 0 14px;font-family:"Space Grotesk",sans-serif;}
  .fan-tag{max-width:690px;margin:0 auto;font-size:1.05rem;line-height:1.58;color:rgba(255,255,255,.92);font-style:italic;}
  .fan-section h2,.fan-ritual h2,.fan-cta h2{font-size:1.5rem;font-weight:800;margin:0 0 16px;letter-spacing:0;font-family:"Space Grotesk",sans-serif;}
  .fan-card{background:var(--fan-card);border:1px solid var(--fan-line);border-radius:14px;padding:20px;}
  .fan-grid{display:grid;gap:12px;}
  .fan-nick{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;padding:13px 16px;}
  .fan-nick b{color:var(--fan-accent);font-size:1.1rem;font-weight:800;min-width:180px;font-family:"Space Grotesk",sans-serif;}
  .fan-nick span{color:var(--fan-dim);font-size:.92rem;}
  .fan-swatches{display:flex;gap:12px;}
  .fan-swatch{flex:1;text-align:center;min-width:0;}
  .fan-chip{height:58px;border-radius:12px;border:1px solid var(--fan-line);}
  .fan-swatch small{display:block;margin-top:7px;color:var(--fan-dim);font-size:11px;letter-spacing:.04em;}
  .fan-pills{display:flex;flex-wrap:wrap;gap:9px;}
  .fan-pill{border:1px solid color-mix(in srgb,var(--fan-accent) 80%,var(--fan-line));color:var(--fan-fg);border-radius:999px;padding:7px 14px;font-size:13px;font-weight:600;}
  .fan-ritual{border:1px solid color-mix(in srgb,var(--fan-accent) 75%,var(--fan-line));border-radius:16px;padding:24px;background:linear-gradient(160deg,color-mix(in srgb,var(--fan-accent) 12%,var(--fan-card)) 0%,var(--fan-card) 70%);}
  .fan-badge{display:inline-block;background:var(--fan-accent);color:#071016;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;padding:5px 12px;border-radius:999px;margin-bottom:14px;}
  .fan-rec{font-family:"JetBrains Mono",monospace;font-size:13px;color:var(--fan-dim);padding:8px 0 8px 14px;border-left:3px solid var(--fan-alt);}
  .fan-moment{padding:18px 20px;}
  .fan-moment-head{display:flex;align-items:baseline;gap:12px;margin-bottom:9px;}
  .fan-moment-no{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:1.35rem;color:var(--fan-accent);}
  .fan-moment h3{margin:0;font-size:1.15rem;font-weight:800;font-family:"Space Grotesk",sans-serif;}
  .fan-moment p{margin:0 0 10px;color:var(--fan-dim);line-height:1.55;}
  .fan-angle{margin:0;color:var(--fan-accent);font-style:italic;font-weight:650;}
  .fan-fact{display:flex;gap:13px;padding:14px 16px;align-items:flex-start;}
  .fan-fact i{width:8px;height:8px;margin-top:8px;border-radius:50%;background:var(--fan-accent);flex:0 0 auto;}
  .fan-fact span{color:var(--fan-dim);line-height:1.55;}
  .fan-cta{text-align:center;padding:32px 24px;border:1px solid var(--fan-line);border-radius:16px;background:linear-gradient(160deg,color-mix(in srgb,var(--fan-accent) 10%,var(--fan-card)) 0%,var(--fan-card) 80%);}
  .fan-btn{display:inline-flex;align-items:center;gap:8px;background:var(--fan-accent);color:#071016;padding:14px 28px;border-radius:999px;font-weight:900;font-size:14px;text-decoration:none;transition:transform .18s;}
  .fan-btn:hover{transform:translateY(-2px);}
  .fan-sources{border-top:1px solid var(--fan-line);padding-top:18px;}
  .fan-sources h4{margin:0 0 10px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fan-dim);}
  .fan-sources a{color:var(--fan-accent);font-size:12px;margin-right:16px;text-decoration:none;line-height:2;}
  .fan-sources a:hover{text-decoration:underline;}
  @media(max-width:640px){.fan-swatches{display:grid;grid-template-columns:1fr;}.fan-nick b{min-width:0;width:100%;}.fan-hero{padding-top:70px;}}
`;

export default async function FanCountryPage({ params }: PageProps) {
  const { country } = await params;
  const profile = getFanProfile(country);
  if (!profile) notFound();

  return (
    <div
      className="fan-page"
      style={{
        "--fan-accent": profile.accent,
        "--fan-deep": profile.accentDeep,
        "--fan-alt": profile.accentAlt,
      } as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <FloatingNav />

      <section className="fan-hero">
        <div className="fan-flag">{profile.flagLabel}</div>
        <div className="fan-kicker">Fan Culture Series - #{profile.order}</div>
        <h1 className="fan-h1">{profile.country.toUpperCase()} - {profile.nickname.toUpperCase()}</h1>
        <p className="fan-tag">{profile.tagline}</p>
      </section>

      <div className="fan-wrap">
        <section className="fan-section">
          <h2>What fans are called</h2>
          <div className="fan-grid">
            {profile.names.map((name) => (
              <div key={name.name} className="fan-card fan-nick">
                <b>{name.name}</b>
                <span>{name.meaning}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="fan-section">
          <h2>Colors</h2>
          <div className="fan-swatches">
            {profile.colors.map((color) => (
              <div key={color.name} className="fan-swatch">
                <div className="fan-chip" style={{ background: color.hex }} />
                <small>{color.name}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="fan-section">
          <h2>Signature symbols</h2>
          <div className="fan-pills">
            {profile.symbols.map((symbol) => (
              <span key={symbol} className="fan-pill">{symbol}</span>
            ))}
          </div>
        </section>

        <section className="fan-ritual">
          <span className="fan-badge">{profile.ritual.badge}</span>
          <h2>{profile.ritual.name}</h2>
          <p style={{ color: "var(--fan-dim)", lineHeight: 1.6, margin: "0 0 16px" }}>
            {profile.ritual.story}
          </p>
          <div className="fan-grid">
            {profile.ritual.records.map((record) => (
              <div key={record} className="fan-rec">{record}</div>
            ))}
          </div>
        </section>

        <section className="fan-section">
          <h2>Fan-culture moments to watch</h2>
          <div className="fan-grid">
            {profile.moments.map((moment, index) => (
              <div key={moment.title} className="fan-card fan-moment">
                <div className="fan-moment-head">
                  <span className="fan-moment-no">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{moment.title}</h3>
                </div>
                <p>{moment.summary}</p>
                <p className="fan-angle">&quot;{moment.angle}&quot;</p>
              </div>
            ))}
          </div>
        </section>

        <section className="fan-section">
          <h2>Did you know?</h2>
          <div className="fan-grid">
            {profile.funFacts.map((fact) => (
              <div key={fact} className="fan-card fan-fact">
                <i />
                <span>{fact}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="fan-cta">
          <h2>{profile.cta.title}</h2>
          <p style={{ color: "var(--fan-dim)", margin: "0 0 20px" }}>{profile.cta.text}</p>
          <Link href="/venues" className="fan-btn">Find watch-party venues</Link>
        </section>

        <section className="fan-sources">
          <h4>Sources</h4>
          <div>
            {profile.sources.map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
