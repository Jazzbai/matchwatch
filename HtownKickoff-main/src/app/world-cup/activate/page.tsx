"use client";

import React from "react";
import Link from "next/link";
import { FloatingNav } from "../../../components/AppShell";
import { Check, Star, Trophy } from "lucide-react";

/* ───────────────────────────────────────────────────────────────
   /world-cup/activate
   "Activate Your Venue for World Cup 2026" — three MatchPoint
   Creator Packages a restaurant/bar/venue can purchase to be
   set up as a featured MatchWatch destination.
   ─────────────────────────────────────────────────────────────── */

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
  .av-page{background:var(--mw-bg);min-height:100vh;color:var(--mw-fg);}

  /* hero */
  .av-hero{position:relative;overflow:hidden;padding:140px 24px 72px;text-align:center;background:linear-gradient(160deg,var(--mw-bg) 0%,#0d1520 40%,#1a0a05 100%);border-bottom:1px solid var(--mw-line);}
  .av-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 40%,color-mix(in srgb,var(--mw-accent) 14%,transparent),transparent 70%);pointer-events:none;}
  .av-hero-inner{position:relative;z-index:2;max-width:880px;margin:0 auto;}
  .av-kicker{display:inline-flex;align-items:center;gap:8px;font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;margin-bottom:18px;border:1px solid color-mix(in srgb,var(--mw-accent) 30%,transparent);padding:5px 12px;border-radius:999px;}
  .av-h1{font-size:clamp(2.2rem,5.5vw,3.8rem);font-weight:900;line-height:1.05;color:var(--mw-fg);margin:0 0 18px;letter-spacing:-.02em;font-family:"Space Grotesk",sans-serif;}
  .av-h1 b{color:var(--mw-accent);font-weight:900;}
  .av-sub{font-size:1.05rem;color:var(--mw-fg-dim);line-height:1.6;max-width:640px;margin:0 auto 28px;}

  /* cities strip — visual reminder of WC host cities */
  .av-strip{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:8px;}
  .av-chip{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--mw-fg-mute);padding:4px 10px;border:1px solid var(--mw-line);border-radius:999px;background:rgba(255,255,255,.03);}

  /* packages */
  .av-pw{padding:72px 24px 32px;}
  .av-pwrap{max-width:1280px;margin:0 auto;}
  .av-sh{text-align:center;margin-bottom:44px;}
  .av-sl{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mw-accent);margin-bottom:8px;font-weight:700;}
  .av-h2{font-size:clamp(1.6rem,3.2vw,2.4rem);font-weight:900;color:var(--mw-fg);margin:0;letter-spacing:-.01em;font-family:"Space Grotesk",sans-serif;}

  .av-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;}
  @media(max-width:1024px){.av-grid{grid-template-columns:1fr;max-width:520px;margin:0 auto;}}

  .av-card{position:relative;border:1px solid var(--mw-line);background:var(--mw-bg-1);border-radius:18px;padding:28px 26px 32px;display:flex;flex-direction:column;gap:18px;transition:transform .18s,border-color .18s,box-shadow .18s;}
  .av-card:hover{transform:translateY(-4px);border-color:color-mix(in srgb,var(--mw-accent) 35%,var(--mw-line));box-shadow:0 16px 38px rgba(0,0,0,.35);}
  .av-card.feat{border-color:color-mix(in srgb,var(--mw-accent) 50%,var(--mw-line));background:linear-gradient(160deg,color-mix(in srgb,var(--mw-accent) 6%,transparent) 0%,var(--mw-bg-1) 60%);box-shadow:0 12px 38px color-mix(in srgb,var(--mw-accent) 16%,transparent);}
  .av-tag{position:absolute;top:-12px;left:24px;font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#0a0b0d;background:var(--mw-accent);padding:5px 11px;border-radius:999px;}

  .av-cname{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:1.35rem;color:var(--mw-fg);letter-spacing:-.01em;margin:0;}
  .av-cpkg{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mw-fg-mute);margin-bottom:4px;}
  .av-price{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:2.6rem;line-height:1;color:var(--mw-accent);letter-spacing:-.02em;}
  .av-price small{font-size:.85rem;font-weight:600;color:var(--mw-fg-mute);margin-left:6px;letter-spacing:0;}
  .av-best{font-size:.95rem;color:var(--mw-fg-dim);line-height:1.5;font-style:italic;border-left:2px solid color-mix(in srgb,var(--mw-accent) 50%,transparent);padding-left:10px;}

  .av-incl-label{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mw-fg-mute);margin-top:4px;}
  .av-feats{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px;}
  .av-feat{display:flex;gap:10px;font-size:.92rem;color:var(--mw-fg);line-height:1.45;}
  .av-feat svg{flex-shrink:0;color:var(--mw-accent);margin-top:2px;}

  .av-bfoot{margin-top:auto;padding-top:14px;border-top:1px dashed var(--mw-line);font-size:.85rem;color:var(--mw-fg-mute);line-height:1.5;}
  .av-bfoot b{color:var(--mw-fg);font-weight:700;}

  .av-cta-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 22px;border-radius:999px;font-size:13.5px;font-weight:800;text-decoration:none;background:var(--mw-accent);color:#0a0b0d;transition:all .2s;}
  .av-cta-btn:hover{transform:translateY(-2px);box-shadow:0 12px 28px color-mix(in srgb,var(--mw-accent) 35%,transparent);}
  .av-cta-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 22px;border-radius:999px;font-size:13.5px;font-weight:700;text-decoration:none;border:1px solid var(--mw-line-2);color:var(--mw-fg-dim);transition:all .2s;}
  .av-cta-ghost:hover{border-color:var(--mw-fg-dim);color:var(--mw-fg);}

  /* bottom CTA */
  .av-final{padding:64px 24px 96px;}
  .av-final-card{max-width:980px;margin:0 auto;border:1px solid var(--mw-line);border-radius:24px;padding:48px 40px;text-align:center;background:linear-gradient(135deg,color-mix(in srgb,var(--mw-accent) 10%,transparent) 0%,var(--mw-bg-1) 60%);}
  .av-final-h{font-family:"Space Grotesk",sans-serif;font-weight:900;font-size:clamp(1.5rem,3vw,2.1rem);color:var(--mw-fg);margin:0 0 10px;letter-spacing:-.01em;}
  .av-final-sub{font-size:1rem;color:var(--mw-fg-dim);max-width:560px;margin:0 auto 22px;line-height:1.55;}
  .av-final-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
`;

type Pkg = {
  num: string;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  bestFor: string;
  feat?: boolean;
  tag?: string;
};

const PACKAGES: Pkg[] = [
  {
    num: "01",
    name: "MatchPoint Starter Booth",
    price: 150,
    tagline: "Best for restaurants that want a simple promotional setup.",
    features: [
      "Standard photo-shoot booth setup",
      "MatchWatch banner / signage",
      "Schedule sign for restaurant display",
      "Website theme alignment for MatchPoint listing",
      "Basic venue / event visibility on MatchWatch",
    ],
    bestFor: "restaurants starting watch-party promotion",
  },
  {
    num: "02",
    name: "MatchPoint Reservation + Social Boost",
    price: 2000,
    tagline: "Best for venues that want bookings and social media promotion.",
    features: [
      "Everything in Starter Booth",
      "Reservation plugin setup",
      "Watch-party booking section",
      "6 promotional reels",
      "16 story posts",
      "MatchPoint landing page connection",
      "Event schedule promotion on MatchWatch",
    ],
    bestFor: "restaurants that want reservations and social traffic",
    feat: true,
    tag: "Most popular",
  },
  {
    num: "03",
    name: "MatchPoint Premium Venue Story",
    price: 3000,
    tagline: "Best for venues that want professional video and stronger branding.",
    features: [
      "Everything in Reservation + Social Boost",
      "On-site venue video recording",
      "Interview with venue owner / manager",
      "Stadium-style watch-party video concept",
      "Venue atmosphere shots",
      "Premium promotional content for MatchWatch, Instagram, and website",
    ],
    bestFor: "restaurants that want to become a featured watch-party destination",
  },
];

const HOST_CITIES = [
  "New York","Los Angeles","Dallas","Houston","Miami","Atlanta",
  "San Francisco","Philadelphia","Seattle","Boston","Kansas City",
];

export default function ActivateWorldCupPage() {
  return (
    <div className="av-page">
      <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
      <FloatingNav />

      {/* ─── Hero ─────────────────────────────────────── */}
      <section className="av-hero">
        <div className="av-hero-inner">
          <span className="av-kicker">
            <Trophy size={12} />
            <span>World Cup 2026 · Venue Activation</span>
          </span>
          <h1 className="av-h1">
            Activate Your Venue for the <b>World Cup</b>
          </h1>
          <p className="av-sub">
            Turn your restaurant, bar, or venue into a professional MatchWatch destination —
            with content, reservation tools, and World Cup watch-party promotion across all
            11 U.S. host cities.
          </p>
          <div className="av-strip">
            {HOST_CITIES.map((c) => (
              <span key={c} className="av-chip">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Packages ─────────────────────────────────── */}
      <section className="av-pw">
        <div className="av-pwrap">
          <div className="av-sh">
            <div className="av-sl">MatchPoint Creator Packages</div>
            <h2 className="av-h2">Choose how you want to show up</h2>
          </div>

          <div className="av-grid">
            {PACKAGES.map((p) => (
              <article key={p.num} className={`av-card ${p.feat ? "feat" : ""}`}>
                {p.tag && <span className="av-tag"><Star size={10} style={{ display: "inline", marginRight: 4 }} />{p.tag}</span>}
                <div>
                  <div className="av-cpkg">Package {p.num}</div>
                  <h3 className="av-cname">{p.name}</h3>
                </div>
                <div className="av-price">
                  ${p.price.toLocaleString()}
                  <small>one-time</small>
                </div>
                <p className="av-best">{p.tagline}</p>

                <div>
                  <div className="av-incl-label">Includes</div>
                </div>
                <ul className="av-feats">
                  {p.features.map((f) => (
                    <li key={f} className="av-feat">
                      <Check size={16} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="av-bfoot">
                  <b>Best for:</b> {p.bestFor}.
                </div>

                <Link
                  href="/for-venues/register"
                  className={p.feat ? "av-cta-btn" : "av-cta-ghost"}
                >
                  Choose {p.name.split("—").pop()?.trim() || p.name} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────── */}
      <section className="av-final">
        <div className="av-final-card">
          <h2 className="av-final-h">Become a MatchPoint Venue</h2>
          <p className="av-final-sub">
            Get ready for the 2026 soccer season. Create your MatchPoint page today and start
            receiving World Cup booking requests from fans across your city.
          </p>
          <div className="av-final-btns">
            <Link href="/for-venues/register" className="av-cta-btn">
              Create My MatchPoint Page →
            </Link>
            <Link href="/world-cup" className="av-cta-ghost">
              Back to World Cup Hub
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
