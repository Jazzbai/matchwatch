"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { FloatingNav } from "@/components/AppShell";
import { ArrowRight, MapPin, DollarSign, Clock, Users, Zap, Trophy, Heart } from "lucide-react";

const CSS = `
*{box-sizing:border-box;}
body{background:#0a0b0d!important;color:#f1ece4!important;overflow-x:hidden;}
.cr-page{background:#0a0b0d;min-height:100vh;color:#f1ece4;overflow-x:hidden;}
.cr-wrap{max-width:960px;margin:0 auto;padding:0 24px;width:100%;}

/* hero */
.cr-hero{position:relative;overflow:hidden;padding:calc(var(--site-nav-height,64px) + 72px) 0 72px;border-bottom:1px solid #23272f;}
.cr-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(160deg,#0a0b0d 0%,#0d1520 55%,#1a0a05 100%);pointer-events:none;}
.cr-hero::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 70% 40%,color-mix(in srgb,oklch(0.72 0.19 28) 8%,transparent),transparent 70%);pointer-events:none;}
.cr-hero-inner{position:relative;z-index:2;display:grid;grid-template-columns:1fr 320px;gap:48px;align-items:center;}
.cr-kicker{display:inline-flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:oklch(0.72 0.19 28);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 30%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:20px;}
.cr-kicker .bd{width:6px;height:6px;background:oklch(0.72 0.19 28);border-radius:50%;animation:crbd 1.4s ease-in-out infinite;}
@keyframes crbd{0%,100%{opacity:.4;}50%{opacity:1;}}
.cr-h1{font-family:'Space Grotesk',sans-serif;font-size:clamp(2rem,4.5vw,3.2rem);font-weight:900;line-height:1.04;letter-spacing:-0.025em;margin:0 0 16px;color:#f1ece4;}
.cr-h1 b{color:oklch(0.72 0.19 28);}
.cr-sub{font-size:1rem;color:#a8a59d;line-height:1.65;max-width:520px;margin:0 0 32px;}
.cr-hero-stats{display:flex;gap:28px;flex-wrap:wrap;padding-top:28px;border-top:1px solid #23272f;}
.cr-stat-v{font-family:'Space Grotesk',sans-serif;font-size:1.6rem;font-weight:900;color:oklch(0.72 0.19 28);line-height:1;}
.cr-stat-l{font-size:.72rem;color:#6c6a64;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-top:3px;}
.cr-hero-card{background:color-mix(in srgb,oklch(0.72 0.19 28) 6%,#101217);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 22%,#23272f);border-radius:16px;padding:28px;display:flex;flex-direction:column;gap:14px;}
.cr-hero-card-title{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:.95rem;color:#f1ece4;margin:0;}
.cr-hero-card-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;}
.cr-hero-card-list li{font-size:.85rem;color:#a8a59d;display:flex;align-items:center;gap:8px;}
.cr-hero-card-list li::before{content:"✓";color:#22c55e;font-weight:800;font-size:11px;flex-shrink:0;}

/* section */
.cr-section{padding:64px 0;border-bottom:1px solid #23272f;}
.cr-section:last-child{border-bottom:none;}
.cr-sh{margin-bottom:32px;}
.cr-sh-kicker{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.72 0.19 28);margin-bottom:10px;}
.cr-sh-title{font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(1.3rem,2.6vw,1.8rem);color:#f1ece4;margin:0 0 8px;letter-spacing:-0.01em;}
.cr-sh-sub{font-size:.93rem;color:#a8a59d;line-height:1.6;margin:0;max-width:580px;}

/* job card */
.cr-job-card{background:#101217;border:1px solid #23272f;border-left:3px solid oklch(0.72 0.19 28);border-radius:12px;padding:28px 28px 28px 24px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;text-decoration:none;transition:border-color .15s,background .15s,transform .15s;}
.cr-job-card:hover{border-color:color-mix(in srgb,oklch(0.72 0.19 28) 55%,#23272f);background:color-mix(in srgb,oklch(0.72 0.19 28) 6%,#101217);transform:translateY(-2px);}
.cr-job-badges{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
.cr-badge-hot{display:inline-flex;align-items:center;gap:5px;background:color-mix(in srgb,oklch(0.72 0.19 28) 16%,transparent);color:oklch(0.72 0.19 28);font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:999px;border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 32%,transparent);}
.cr-badge-type{background:#14171d;color:#a8a59d;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;padding:4px 10px;border-radius:999px;border:1px solid #2f3540;}
.cr-job-title{font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:1.1rem;color:#f1ece4;margin:0 0 8px;letter-spacing:-0.01em;}
.cr-job-meta{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
.cr-job-meta-item{display:flex;align-items:center;gap:5px;font-size:.82rem;color:#6c6a64;}
.cr-apply-btn{display:inline-flex;align-items:center;gap:7px;padding:11px 22px;border-radius:999px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:oklch(0.72 0.19 28);color:#0a0b0d;white-space:nowrap;flex-shrink:0;transition:all .15s;}
.cr-job-card:hover .cr-apply-btn{filter:brightness(1.1);box-shadow:0 8px 20px color-mix(in srgb,oklch(0.72 0.19 28) 28%,transparent);}

/* coming soon roles */
.cr-soon-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:32px;}
.cr-soon-card{background:#101217;border:1px solid #23272f;border-radius:10px;padding:20px;opacity:.55;}
.cr-soon-label{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6c6a64;margin-bottom:6px;}
.cr-soon-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:.9rem;color:#f1ece4;}

/* why us */
.cr-why-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.cr-why-card{background:#101217;border:1px solid #23272f;padding:24px;border-radius:12px;}
.cr-why-icon{width:40px;height:40px;background:color-mix(in srgb,oklch(0.72 0.19 28) 12%,transparent);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 20%,transparent);border-radius:10px;display:flex;align-items:center;justify-content:center;color:oklch(0.72 0.19 28);margin-bottom:14px;}
.cr-why-title{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:.95rem;color:#f1ece4;margin:0 0 6px;}
.cr-why-body{font-size:.83rem;color:#a8a59d;line-height:1.55;}

/* responsive */
@media(max-width:860px){.cr-hero-inner{grid-template-columns:1fr;}.cr-hero-card{display:none;}.cr-why-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:640px){.cr-soon-grid{grid-template-columns:1fr 1fr;}.cr-why-grid{grid-template-columns:1fr;}.cr-job-card{flex-direction:column;align-items:flex-start;}}
`;

export default function CareersPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <FloatingNav />
      <Suspense fallback={null}>
        <div className="cr-page">

          {/* ── Hero ── */}
          <section className="cr-hero">
            <div className="cr-wrap">
              <div className="cr-hero-inner">
                <div>
                  <div className="cr-kicker"><span className="bd" /> Join the Team</div>
                  <h1 className="cr-h1">Build the Future of<br /><b>Watch Party Culture</b></h1>
                  <p className="cr-sub">
                    MatchWatch is the platform connecting football fans with the best bars, restaurants,
                    and event spaces for FIFA World Cup 2026 watch parties across 11 US host cities.
                    We&apos;re a small, fast-moving team building something big.
                  </p>
                  <div className="cr-hero-stats">
                    <div><div className="cr-stat-v">11</div><div className="cr-stat-l">Host Cities</div></div>
                    <div><div className="cr-stat-v">48</div><div className="cr-stat-l">Matches</div></div>
                    <div><div className="cr-stat-v">2026</div><div className="cr-stat-l">World Cup</div></div>
                    <div><div className="cr-stat-v">∞</div><div className="cr-stat-l">Opportunity</div></div>
                  </div>
                </div>
                <div className="cr-hero-card">
                  <p className="cr-hero-card-title">Why join now?</p>
                  <ul className="cr-hero-card-list">
                    <li>Ground floor of a high-growth platform</li>
                    <li>FIFA World Cup 2026 is the biggest sporting event ever held in the US</li>
                    <li>Flexible, commission-driven roles</li>
                    <li>Real impact — your work ships to real users</li>
                    <li>Sports, hospitality & tech intersection</li>
                    <li>Houston-based with nationwide reach</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* ── Open Positions ── */}
          <section className="cr-section">
            <div className="cr-wrap">
              <div className="cr-sh">
                <div className="cr-sh-kicker">Now Hiring</div>
                <h2 className="cr-sh-title">Open Positions</h2>
                <p className="cr-sh-sub">We&apos;re looking for self-starters who move fast and want to be part of something big.</p>
              </div>

              <Link href="/careers/sales-rep" className="cr-job-card">
                <div>
                  <div className="cr-job-badges">
                    <span className="cr-badge-hot"><Zap size={10} /> Now Hiring</span>
                    <span className="cr-badge-type">Commission · Flexible</span>
                    <span className="cr-badge-type">Part-time / Full-time</span>
                  </div>
                  <div className="cr-job-title">Sales Rep &amp; Lead Follow-Up Specialist</div>
                  <div className="cr-job-meta">
                    <span className="cr-job-meta-item"><MapPin size={12} /> Houston, TX / Remote Hybrid</span>
                    <span className="cr-job-meta-item"><DollarSign size={12} /> Commission-based</span>
                    <span className="cr-job-meta-item"><Trophy size={12} /> World Cup Watch Party Packages</span>
                  </div>
                </div>
                <div className="cr-apply-btn">Apply Now <ArrowRight size={13} /></div>
              </Link>

              {/* Coming soon */}
              <div style={{ marginTop: 32 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", letterSpacing: ".12em", textTransform: "uppercase", color: "#6c6a64", marginBottom: 14 }}>Coming Soon</div>
                <div className="cr-soon-grid">
                  {[
                    { title: "City Manager — Dallas, TX" },
                    { title: "Venue Partnership Manager" },
                    { title: "Event Coordinator" },
                    { title: "Digital Marketing Specialist" },
                    { title: "Customer Success Rep" },
                    { title: "Full-Stack Developer" },
                  ].map((r) => (
                    <div key={r.title} className="cr-soon-card">
                      <div className="cr-soon-label">Coming soon</div>
                      <div className="cr-soon-title">{r.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Why MatchWatch ── */}
          <section className="cr-section">
            <div className="cr-wrap">
              <div className="cr-sh">
                <div className="cr-sh-kicker">Culture &amp; Mission</div>
                <h2 className="cr-sh-title">Why Work at MatchWatch</h2>
              </div>
              <div className="cr-why-grid">
                {[
                  { icon: Trophy, title: "Once-in-a-generation event", body: "The FIFA World Cup 2026 is the largest sporting event ever hosted in the US. Be part of building the infrastructure around it." },
                  { icon: Zap,    title: "Fast-moving startup energy", body: "We ship fast, iterate constantly, and give everyone real ownership of their work. No bureaucracy, no waiting." },
                  { icon: DollarSign, title: "Earn what you sell", body: "Commission-based roles reward performance. The more venues and events you bring on, the more you earn." },
                  { icon: MapPin, title: "11 cities, one platform", body: "Houston is home base but the opportunity spans Dallas, Miami, NYC, LA, and every other host city." },
                  { icon: Users,  title: "Small team, big reach", body: "Work directly with founders and decision-makers. Your ideas get heard and implemented, not buried." },
                  { icon: Heart,  title: "Sports & hospitality passion", body: "We're football fans building for football fans. If you love the beautiful game and live events, you'll fit right in." },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title} className="cr-why-card">
                    <div className="cr-why-icon"><Icon size={18} /></div>
                    <div className="cr-why-title">{title}</div>
                    <div className="cr-why-body">{body}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Bottom CTA ── */}
          <section className="cr-section" style={{ borderBottom: "none" }}>
            <div className="cr-wrap" style={{ textAlign: "center", maxWidth: 560, padding: "0 24px 40px" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", letterSpacing: ".16em", textTransform: "uppercase", color: "oklch(0.72 0.19 28)", marginBottom: 14 }}>Don&apos;t see your role?</div>
              <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 900, fontSize: "clamp(1.2rem,2.4vw,1.6rem)", color: "#f1ece4", margin: "0 0 12px", letterSpacing: "-0.01em" }}>Think you can add value?</h2>
              <p style={{ fontSize: ".9rem", color: "#a8a59d", lineHeight: 1.6, margin: "0 0 24px" }}>Send us a note. We&apos;re always open to meeting driven people who want to help grow the watch party economy.</p>
              <Link href="/careers/sales-rep#apply" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: "999px", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", background: "oklch(0.72 0.19 28)", color: "#0a0b0d", textDecoration: "none" }}>
                Get in Touch <ArrowRight size={13} />
              </Link>
            </div>
          </section>

        </div>
      </Suspense>
    </>
  );
}
