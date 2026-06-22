"use client";

import React from "react";
import Link from "next/link";
import { FloatingNav } from "../../components/AppShell";
import { fanProfiles } from "./fanProfiles";

const MX_VARS = `
  :root{
    --fz-bg:var(--background);
    --fz-card:var(--card);
    --fz-line:var(--border);
    --fz-fg:var(--foreground);
    --fz-fg-dim:var(--muted-foreground);
    --fz-accent:#0c7a4d;
    --fz-accent-deep:#024d36;
  }
`;

const CSS = `
  .fz-page{background:var(--fz-bg);min-height:100vh;color:var(--fz-fg);}
  .fz-wrap{max-width:1080px;margin:0 auto;padding:28px 20px 72px;display:grid;gap:30px;}

  .fz-hero{position:relative;overflow:hidden;text-align:center;padding:72px 20px 52px;color:#fff;
    background:linear-gradient(135deg,var(--fz-accent) 0%,var(--fz-accent-deep) 60%,#1a1140 165%);}
  .fz-hero::before{content:"";position:absolute;inset:0;
    background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(255,255,255,.16),transparent 70%);pointer-events:none;}
  .fz-kicker{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.16em;
    text-transform:uppercase;font-weight:700;background:rgba(255,255,255,.18);color:#fff;
    padding:6px 14px;border-radius:999px;margin-bottom:18px;}
  .fz-h1{font-size:clamp(2.1rem,5.5vw,3.4rem);font-weight:900;letter-spacing:0;margin:0 0 14px;
    font-family:"Space Grotesk",sans-serif;}
  .fz-tag{max-width:620px;margin:0 auto;font-size:1.05rem;line-height:1.55;color:rgba(255,255,255,.92);}

  .fz-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));}
  .fz-card{display:flex;flex-direction:column;gap:10px;background:var(--fz-card);border:1px solid var(--fz-line);
    border-radius:16px;padding:22px;text-decoration:none;color:var(--fz-fg);transition:transform .18s,border-color .18s;}
  a.fz-card:hover{transform:translateY(-3px);border-color:var(--fz-accent);}
  .fz-card-top{display:flex;align-items:center;gap:12px;}
  .fz-card-flag{display:grid;place-items:center;width:52px;height:52px;border-radius:12px;background:var(--card);border:1px solid var(--fz-line);font-family:"Space Grotesk",sans-serif;font-size:.9rem;font-weight:900;letter-spacing:.08em;line-height:1;color:var(--fz-accent);}
  .fz-card-country{font-family:"Space Grotesk",sans-serif;font-weight:800;font-size:1.2rem;margin:0;}
  .fz-card-nick{color:var(--fz-accent);font-weight:700;font-size:.85rem;}
  .fz-card-blurb{color:var(--fz-fg-dim);font-size:.92rem;line-height:1.55;margin:0;}
  .fz-card-go{margin-top:auto;color:var(--fz-accent);font-weight:700;font-size:.85rem;}
  .fz-badge{align-self:flex-start;font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.1em;
    text-transform:uppercase;color:var(--fz-fg-dim);border:1px solid var(--fz-line);border-radius:999px;padding:3px 9px;}
`;

export default function FanZonePage() {
  return (
    <div className="fz-page">
      <style dangerouslySetInnerHTML={{ __html: MX_VARS + CSS }} />
      <FloatingNav />

      <section className="fz-hero">
        <div className="fz-kicker">MatchWatch - Fan Culture Series</div>
        <h1 className="fz-h1">FAN ZONE</h1>
        <p className="fz-tag">
          Every nation brings its own colors, chants, and rituals to the World Cup.
          Explore the cultures behind the crowds.
        </p>
      </section>

      <div className="fz-wrap">
        <section>
          <div className="fz-grid">
            {fanProfiles.map((profile) => (
              <Link
                key={profile.slug}
                href={`/fans/${profile.slug}`}
                className="fz-card"
                style={{ "--fz-accent": profile.accent } as React.CSSProperties}
              >
                <span className="fz-badge">#{String(profile.order).padStart(2, "0")}</span>
                <div className="fz-card-top">
                  <span className="fz-card-flag">{profile.flagLabel}</span>
                  <div>
                    <h2 className="fz-card-country">{profile.country}</h2>
                    <span className="fz-card-nick">{profile.nickname}</span>
                  </div>
                </div>
                <p className="fz-card-blurb">{profile.blurb}</p>
                <span className="fz-card-go">Explore {profile.country}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
