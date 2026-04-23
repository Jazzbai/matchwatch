"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";

const PP_VARS = `
  :root {
    --pp-bg: #0a0b0d;
    --pp-bg-1: #101217;
    --pp-bg-2: #14171d;
    --pp-line: #23272f;
    --pp-line-2: #2f3540;
    --pp-fg: #f1ece4;
    --pp-fg-dim: #a8a59d;
    --pp-fg-mute: #6c6a64;
    --pp-accent: oklch(0.72 0.19 28);
  }
`;

const PP_CSS = `
  body{background:var(--pp-bg)!important;color:var(--pp-fg)!important;}
  .pp-topbar{position:sticky;top:0;z-index:20;display:flex;justify-content:center;padding:10px 16px;}
  .pp-topbar-inner{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:920px;padding:10px 20px;border-radius:999px;background:color-mix(in srgb,#0a0b0d 75%,transparent);backdrop-filter:blur(16px);border:1px solid rgba(35,39,47,0.8);box-shadow:0 2px 20px rgba(0,0,0,0.25);}
  .pp-brand{display:flex;flex-direction:column;align-items:flex-start;text-decoration:none;color:var(--pp-fg);}
  .pp-brand-name{font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:18px;letter-spacing:-0.02em;line-height:1.1;}
  .pp-brand-name em{font-style:normal;color:var(--pp-accent);}
  .pp-brand-tag{font-family:monospace;font-size:9px;letter-spacing:0.22em;color:var(--pp-accent);font-weight:700;text-transform:uppercase;margin-top:1px;opacity:0.8;}
  .pp-nav{display:flex;align-items:center;gap:2px;}
  .pp-nav a{padding:7px 14px;border-radius:999px;font-size:13px;font-weight:600;color:var(--pp-fg-dim);transition:all .18s;text-decoration:none;}
  .pp-nav a:hover,.pp-nav a.active{background:rgba(255,255,255,0.07);color:var(--pp-fg);}
  .pp-top-right{display:flex;gap:10px;align-items:center;}
  .pp-btn-pill{display:inline-flex;align-items:center;padding:8px 18px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;background:var(--pp-accent);color:#0a0b0d;transition:all .18s;}
  .pp-btn-pill:hover{opacity:0.88;transform:translateY(-1px);}
  .pp-btn-pill.ghost{background:rgba(255,255,255,0.07);color:var(--pp-fg);}
  .pp-wrap{max-width:900px;margin:0 auto;padding:48px 24px 80px;}
  .pp-hero{border:1px solid var(--pp-line);background:linear-gradient(120deg,rgba(255,95,45,0.10),transparent 60%),linear-gradient(0deg,#0c0e12,#131720);padding:48px 40px;margin-bottom:40px;}
  .pp-kicker{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--pp-accent);margin-bottom:16px;}
  .pp-hero-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:clamp(32px,5vw,52px);line-height:1;letter-spacing:-0.025em;margin:0 0 18px;color:var(--pp-fg);}
  .pp-hero-title em{font-style:normal;color:var(--pp-accent);}
  .pp-hero-sub{font-size:17px;line-height:1.55;color:var(--pp-fg-dim);max-width:560px;margin:0 0 32px;}
  .pp-hero-actions{display:flex;gap:12px;flex-wrap:wrap;}
  .pp-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;border:1px solid var(--pp-line-2);color:var(--pp-fg);transition:all .14s;cursor:pointer;background:none;text-decoration:none;}
  .pp-btn:hover{border-color:var(--pp-fg-dim);}
  .pp-btn.primary{background:var(--pp-accent);color:#0a0b0d;border-color:var(--pp-accent);font-weight:600;}
  .pp-btn.primary:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--pp-fg);}
  .pp-section-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:var(--pp-fg-mute);margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--pp-line);}
  .pp-partners-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-bottom:48px;}
  .pp-partner{border:1px solid var(--pp-line);background:var(--pp-bg-1);padding:32px;display:flex;flex-direction:column;gap:18px;transition:border-color .14s;}
  .pp-partner:hover{border-color:var(--pp-accent);}
  .pp-partner-mark{font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:28px;letter-spacing:-0.03em;color:var(--pp-fg);line-height:1;}
  .pp-partner-mark em{font-style:normal;color:var(--pp-accent);}
  .pp-partner-type{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--pp-fg-mute);margin-top:4px;}
  .pp-partner-desc{font-size:14px;line-height:1.65;color:var(--pp-fg-dim);flex:1;}
  .pp-partner-tags{display:flex;flex-wrap:wrap;gap:6px;}
  .pp-tag{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;padding:4px 8px;border:1px solid var(--pp-line-2);color:var(--pp-fg-mute);}
  .pp-partner-link{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--pp-accent);text-decoration:none;padding:9px 16px;border:1px solid var(--pp-accent);transition:all .14s;align-self:flex-start;}
  .pp-partner-link:hover{background:var(--pp-accent);color:#0a0b0d;}
  .pp-cta{border:1px solid var(--pp-line);background:linear-gradient(120deg,rgba(255,95,45,0.06),transparent),var(--pp-bg-1);padding:40px;text-align:center;margin-bottom:40px;}
  .pp-cta-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:28px;letter-spacing:-0.02em;margin:0 0 12px;color:var(--pp-fg);}
  .pp-cta-sub{font-size:15px;color:var(--pp-fg-dim);margin:0 0 28px;line-height:1.5;}
  .pp-benefits{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid var(--pp-line);margin-bottom:48px;}
  .pp-benefit{padding:28px 24px;border-right:1px solid var(--pp-line);}
  .pp-benefit:last-child{border-right:0;}
  .pp-benefit-ico{font-size:24px;margin-bottom:12px;}
  .pp-benefit-title{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:15px;color:var(--pp-fg);margin-bottom:8px;}
  .pp-benefit-desc{font-size:13px;color:var(--pp-fg-dim);line-height:1.55;}
  @media(max-width:900px){.pp-nav{display:none;}}
  @media(max-width:768px){.pp-topbar{padding:8px 12px;}.pp-topbar-inner{padding:8px 14px;}.pp-wrap{padding:24px 16px 60px;}.pp-hero{padding:28px 20px;}.pp-partners-grid{grid-template-columns:1fr;}.pp-benefits{grid-template-columns:1fr;}.pp-benefit{border-right:0;border-bottom:1px solid var(--pp-line);}.pp-benefit:last-child{border-bottom:0;}.pp-cta{padding:28px 20px;}}
`;

export default function PartnersPage() {
  const { user } = useAuth();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PP_VARS + PP_CSS }} />

      <header className="pp-topbar">
        <div className="pp-topbar-inner">
          <Link href="/" className="pp-brand">
            <div className="pp-brand-name">match<em>watch</em></div>
            <div className="pp-brand-tag">Watchparty Hub</div>
          </Link>
          <nav className="pp-nav">
            <Link href="/">Home</Link>
            <Link href="/matches">Matches</Link>
            <Link href="/world-cup">World Cup</Link>
            <Link href="/venues">Venues</Link>
            <Link href="/partners" className="active">Partners</Link>
            {user && <Link href="/dashboard">My bookings</Link>}
          </nav>
          <div className="pp-top-right">
            {user ? (
              <Link href="/dashboard" className="pp-btn-pill ghost">Dashboard</Link>
            ) : (
              <>
                <Link href="/register-venue" className="pp-btn-pill ghost">List venue</Link>
                <Link href="/login" className="pp-btn-pill">Log in</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="pp-wrap">

        {/* Hero */}
        <div className="pp-hero">
          <div className="pp-kicker">Strategic partners</div>
          <h1 className="pp-hero-title">
            Building Houston's<br /><em>football community</em> together.
          </h1>
          <p className="pp-hero-sub">
            MatchWatch partners with organizations that share our mission: connecting football fans, growing local sports culture, and making match day an experience worth leaving the couch for.
          </p>
          <div className="pp-hero-actions">
            <a href="mailto:partners@matchwatch.us" className="pp-btn primary">Become a partner</a>
            <Link href="/venues" className="pp-btn">Explore venues</Link>
          </div>
        </div>

        {/* Current Partners */}
        <div className="pp-section-label">Current strategic partners</div>
        <div className="pp-partners-grid">

          {/* Team Houston */}
          <div className="pp-partner">
            <div>
              <div className="pp-partner-mark">Team<em>Houston</em></div>
              <div className="pp-partner-type">Community Football Platform</div>
            </div>
            <p className="pp-partner-desc">
              Team Houston is the go-to platform for Houston's amateur and semi-professional football scene. From weekend leagues to city-wide tournaments, they power the grassroots game that feeds passion into every watch party.
            </p>
            <div className="pp-partner-tags">
              <span className="pp-tag">Amateur leagues</span>
              <span className="pp-tag">Tournaments</span>
              <span className="pp-tag">Houston</span>
              <span className="pp-tag">Community</span>
            </div>
            <a href="https://www.team-houston.com/" target="_blank" rel="noopener noreferrer" className="pp-partner-link">
              Visit team-houston.com →
            </a>
          </div>

          {/* Activent */}
          <div className="pp-partner">
            <div>
              <div className="pp-partner-mark"><em>Activent</em></div>
              <div className="pp-partner-type">Local Events & Activities</div>
            </div>
            <p className="pp-partner-desc">
              Activent helps Houstonians discover local sports events and activities happening right in their neighborhood. From pickup games to organized watch parties, they make it easy to stay active and connected.
            </p>
            <div className="pp-partner-tags">
              <span className="pp-tag">Local events</span>
              <span className="pp-tag">Sports activities</span>
              <span className="pp-tag">Watch parties</span>
              <span className="pp-tag">Community</span>
            </div>
            <a href="https://www.getactivent.com/" target="_blank" rel="noopener noreferrer" className="pp-partner-link">
              Visit getactivent.com →
            </a>
          </div>

        </div>

        {/* Partner benefits */}
        <div className="pp-section-label">Partnership benefits</div>
        <div className="pp-benefits">
          <div className="pp-benefit">
            <div className="pp-benefit-ico">📍</div>
            <div className="pp-benefit-title">Venue network access</div>
            <div className="pp-benefit-desc">Co-promote events across our growing network of Houston bars and sports venues that host watch parties.</div>
          </div>
          <div className="pp-benefit">
            <div className="pp-benefit-ico">📣</div>
            <div className="pp-benefit-title">Fan audience reach</div>
            <div className="pp-benefit-desc">Get your brand in front of engaged football fans who actively seek out watch-party experiences.</div>
          </div>
          <div className="pp-benefit">
            <div className="pp-benefit-ico">🤝</div>
            <div className="pp-benefit-title">Cross-promotion</div>
            <div className="pp-benefit-desc">Featured placement on the MatchWatch platform, social amplification, and co-branded match-day content.</div>
          </div>
        </div>

        {/* CTA */}
        <div className="pp-cta">
          <div className="pp-cta-title">Interested in partnering?</div>
          <p className="pp-cta-sub">
            We work with sports platforms, community organizations, bars, and brands who want to grow with Houston's football fan base.
          </p>
          <a href="mailto:partners@matchwatch.us" className="pp-btn primary">Get in touch →</a>
        </div>

      </div>
    </>
  );
}
