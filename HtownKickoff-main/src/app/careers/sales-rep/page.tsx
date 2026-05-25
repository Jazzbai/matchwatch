"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { FloatingNav } from "@/components/AppShell";
import {
  ArrowLeft, CheckCircle2, DollarSign, MapPin, Clock, Users,
  Zap, Trophy, Target, Send, ChevronRight
} from "lucide-react";

const CSS = `
*{box-sizing:border-box;}
body{background:#0a0b0d!important;color:#f1ece4!important;overflow-x:hidden;}
.sr-page{background:#0a0b0d;min-height:100vh;color:#f1ece4;overflow-x:hidden;}
.sr-wrap{max-width:880px;margin:0 auto;padding:0 24px;width:100%;}
.sr-wrap-wide{max-width:1080px;margin:0 auto;padding:0 24px;width:100%;}

/* hero */
.sr-hero{position:relative;overflow:hidden;padding:calc(var(--site-nav-height,64px) + 64px) 0 56px;border-bottom:1px solid #23272f;}
.sr-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(160deg,#0a0b0d 0%,#0d1520 55%,#1a0a05 100%);pointer-events:none;}
.sr-hero::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 80% 40%,color-mix(in srgb,oklch(0.72 0.19 28) 10%,transparent),transparent 70%);pointer-events:none;}
.sr-hero-inner{position:relative;z-index:2;}
.sr-back{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6c6a64;text-decoration:none;margin-bottom:24px;transition:color .2s;}
.sr-back:hover{color:oklch(0.72 0.19 28);}
.sr-kicker{display:inline-flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:oklch(0.72 0.19 28);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 30%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:18px;}
.sr-kicker .bd{width:6px;height:6px;background:oklch(0.72 0.19 28);border-radius:50%;animation:srbd 1.4s ease-in-out infinite;}
@keyframes srbd{0%,100%{opacity:.4;}50%{opacity:1;}}
.sr-h1{font-family:'Space Grotesk',sans-serif;font-size:clamp(1.9rem,4vw,3rem);font-weight:900;line-height:1.06;letter-spacing:-0.025em;margin:0 0 16px;color:#f1ece4;}
.sr-h1 b{color:oklch(0.72 0.19 28);}
.sr-sub{font-size:1rem;color:#a8a59d;line-height:1.65;max-width:580px;margin:0 0 32px;}
.sr-tags{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:0;}
.sr-tag{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;background:#101217;border:1px solid #23272f;font-size:.8rem;color:#a8a59d;font-weight:500;}
.sr-tag svg{color:oklch(0.72 0.19 28);}

/* content sections */
.sr-section{padding:56px 0;border-bottom:1px solid #23272f;}
.sr-section:last-of-type{border-bottom:none;}
.sr-section-title{font-family:'Space Grotesk',sans-serif;font-size:1.35rem;font-weight:800;color:#f1ece4;margin:0 0 24px;letter-spacing:-0.01em;}

/* ai warm bar */
.sr-warm{background:color-mix(in srgb,oklch(0.72 0.19 28) 7%,#0d0e12);border-bottom:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 18%,transparent);padding:16px 24px;}
.sr-warm-inner{max-width:880px;margin:0 auto;display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
.sr-warm-badge{display:inline-flex;align-items:center;gap:6px;background:color-mix(in srgb,oklch(0.72 0.19 28) 15%,transparent);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 35%,transparent);border-radius:999px;padding:4px 12px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:oklch(0.72 0.19 28);white-space:nowrap;flex-shrink:0;}
.sr-warm-badge .dot{width:6px;height:6px;background:oklch(0.72 0.19 28);border-radius:50%;animation:srbd 1.4s ease-in-out infinite;}
.sr-warm-text{font-size:.84rem;color:#c8c5be;line-height:1.5;}
.sr-warm-text b{color:#f1ece4;}

/* highlights bar */
.sr-highlights{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:32px 0;}
.sr-hl{background:#101217;border:1px solid #1e2128;border-radius:12px;padding:20px;text-align:center;}
.sr-hl-v{font-family:'Space Grotesk',sans-serif;font-size:1.4rem;font-weight:900;color:oklch(0.72 0.19 28);line-height:1;margin-bottom:4px;}
.sr-hl-l{font-size:.72rem;color:#6c6a64;text-transform:uppercase;letter-spacing:.08em;font-weight:600;}

/* two col */
.sr-two{display:grid;grid-template-columns:1fr 1fr;gap:32px;}
.sr-box{background:#101217;border:1px solid #1e2128;border-radius:14px;padding:28px;}
.sr-box-title{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:.9rem;text-transform:uppercase;letter-spacing:.06em;color:oklch(0.72 0.19 28);margin:0 0 16px;}
.sr-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;}
.sr-list li{display:flex;align-items:flex-start;gap:10px;font-size:.88rem;color:#c8c5be;line-height:1.5;}
.sr-list li svg{flex-shrink:0;margin-top:2px;color:oklch(0.72 0.19 28);}

/* comp table */
.sr-comp{display:grid;gap:12px;}
.sr-comp-row{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#101217;border:1px solid #1e2128;border-radius:10px;}
.sr-comp-label{font-size:.88rem;color:#a8a59d;}
.sr-comp-val{font-family:'Space Grotesk',sans-serif;font-weight:700;color:#f1ece4;font-size:.95rem;}
.sr-comp-val.accent{color:oklch(0.72 0.19 28);}

/* timeline */
.sr-timeline{display:flex;flex-direction:column;gap:0;}
.sr-tl-item{display:flex;gap:20px;position:relative;}
.sr-tl-item:not(:last-child)::after{content:"";position:absolute;left:19px;top:40px;bottom:-12px;width:2px;background:linear-gradient(to bottom,#23272f,transparent);}
.sr-tl-dot{width:40px;height:40px;border-radius:50%;background:color-mix(in srgb,oklch(0.72 0.19 28) 12%,#101217);border:2px solid color-mix(in srgb,oklch(0.72 0.19 28) 35%,transparent);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sr-tl-dot svg{color:oklch(0.72 0.19 28);}
.sr-tl-body{padding:8px 0 32px;}
.sr-tl-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:.95rem;color:#f1ece4;margin:0 0 4px;}
.sr-tl-desc{font-size:.84rem;color:#a8a59d;line-height:1.55;}

/* apply form */
.sr-apply{background:#101217;border:1px solid #23272f;border-radius:20px;padding:48px;margin-top:16px;}
.sr-apply-title{font-family:'Space Grotesk',sans-serif;font-size:1.6rem;font-weight:900;color:#f1ece4;margin:0 0 8px;}
.sr-apply-sub{font-size:.9rem;color:#a8a59d;margin:0 0 36px;}
.sr-form{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.sr-field{display:flex;flex-direction:column;gap:6px;}
.sr-field.full{grid-column:1/-1;}
.sr-label{font-size:.78rem;font-weight:600;color:#a8a59d;text-transform:uppercase;letter-spacing:.07em;}
.sr-label span{color:#e05c3a;margin-left:2px;}
.sr-input,.sr-select,.sr-textarea{width:100%;background:#0d0e12;border:1px solid #23272f;border-radius:8px;padding:10px 14px;font-size:.92rem;color:#f1ece4;font-family:inherit;outline:none;transition:border-color .2s;}
.sr-input::placeholder,.sr-textarea::placeholder{color:#45444e;}
.sr-input:focus,.sr-select:focus,.sr-textarea:focus{border-color:oklch(0.72 0.19 28);}
.sr-select{appearance:none;cursor:pointer;}
.sr-textarea{resize:vertical;min-height:100px;}
.sr-submit{grid-column:1/-1;display:flex;align-items:center;gap:10px;}
.sr-btn{display:inline-flex;align-items:center;gap:8px;padding:14px 32px;background:oklch(0.72 0.19 28);color:#0a0b0d;border:none;border-radius:999px;font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:.9rem;cursor:pointer;transition:opacity .2s,transform .15s;white-space:nowrap;}
.sr-btn:hover:not(:disabled){opacity:.88;transform:translateY(-1px);}
.sr-btn:disabled{opacity:.5;cursor:not-allowed;}
.sr-note{font-size:.78rem;color:#6c6a64;margin-top:4px;}
.sr-success{grid-column:1/-1;text-align:center;padding:40px 0;}
.sr-success-icon{width:52px;height:52px;background:color-mix(in srgb,oklch(0.72 0.19 28) 12%,transparent);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 30%,transparent);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:oklch(0.72 0.19 28);}
.sr-success h3{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:1.2rem;color:#f1ece4;margin:0 0 8px;}
.sr-success p{font-size:.88rem;color:#a8a59d;margin:0;}

@media(max-width:767px){
  .sr-highlights{grid-template-columns:repeat(2,1fr);}
  .sr-two{grid-template-columns:1fr;}
  .sr-form{grid-template-columns:1fr;}
  .sr-field.full{grid-column:1;}
  .sr-submit{grid-column:1;}
  .sr-apply{padding:28px 20px;}
  .sr-section-title{font-size:1.15rem;}
}
`;

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  linkedin: string;
  website: string;
  experience: string;
  why: string;
};

function SalesRepContent() {
  const [form, setForm] = useState<FormState>({
    firstName: "", lastName: "", email: "", phone: "",
    city: "", linkedin: "", website: "", experience: "", why: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const body = {
        topic: "Job Application — Sales Rep",
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        phone: form.phone,
        message: [
          `City: ${form.city}`,
          form.linkedin ? `LinkedIn: ${form.linkedin}` : null,
          form.website ? `Website/Portfolio: ${form.website}` : null,
          `Sales Experience: ${form.experience}`,
          `Why MatchWatch: ${form.why}`,
        ].filter(Boolean).join("\n"),
      };
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Send failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please email us directly at careers@matchwatch.us");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sr-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <FloatingNav />

      {/* Hero */}
      <section className="sr-hero">
        <div className="sr-wrap">
          <div className="sr-hero-inner">
            <Link href="/careers" className="sr-back">
              <ArrowLeft size={13} /> Back to Careers
            </Link>
            <div className="sr-kicker">
              <span className="bd" />
              Open Position · Sales
            </div>
            <h1 className="sr-h1">
              City Sales Rep —<br />
              <b>World Cup 2026</b>
            </h1>
            <p className="sr-sub">
              Own your city. Sell watch party packages to bars, restaurants, and corporate clients.
              Commission-first with serious upside during the biggest sporting event in a generation.
            </p>
            <div className="sr-tags">
              <span className="sr-tag"><MapPin size={13} /> Multiple US Cities</span>
              <span className="sr-tag"><DollarSign size={13} /> Commission + Bonuses</span>
              <span className="sr-tag"><Clock size={13} /> Part-Time / Contract</span>
              <span className="sr-tag"><Users size={13} /> Remote-Friendly</span>
              <span className="sr-tag"><Trophy size={13} /> World Cup 2026</span>
            </div>
          </div>
        </div>
      </section>

      {/* Warm Leads Strip */}
      <div className="sr-warm">
        <div className="sr-warm-inner">
          <span className="sr-warm-badge"><span className="dot" />AI Outreach Active</span>
          <p className="sr-warm-text">
            <b>Your leads are already warm.</b> MatchWatch&apos;s AI system is actively calling bars &amp; restaurants across all host cities — qualifying venues before you even knock. You&apos;re closing, not cold calling from scratch.
          </p>
        </div>
      </div>

      {/* Highlights bar */}
      <div className="sr-wrap" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="sr-highlights">
          {[
            { v: "$50–$150", l: "Per venue closed" },
            { v: "11", l: "Host cities" },
            { v: "48", l: "Matches in 2026" },
            { v: "No cap", l: "On earnings" },
          ].map(h => (
            <div className="sr-hl" key={h.l}>
              <div className="sr-hl-v">{h.v}</div>
              <div className="sr-hl-l">{h.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Overview */}
      <section className="sr-section">
        <div className="sr-wrap">
          <h2 className="sr-section-title">The Role</h2>
          <p style={{ fontSize: ".93rem", color: "#a8a59d", lineHeight: 1.7, maxWidth: 640, margin: "0 0 28px" }}>
            MatchWatch is building the go-to platform for World Cup 2026 watch parties across every host city in the US.
            We need hungry, locally-connected sales reps to sign up bars, restaurants, and corporate clients
            before the tournament kicks off in June 2026.
          </p>
          <p style={{ fontSize: ".93rem", color: "#a8a59d", lineHeight: 1.7, maxWidth: 640, margin: 0 }}>
            You&apos;ll be the face of MatchWatch in your market — building relationships, closing deals, and
            helping venues make the most of the biggest sporting event to ever hit the United States.
            This is a high-autonomy, commission-heavy role with real money on the table.
          </p>
        </div>
      </section>

      {/* Responsibilities + Requirements */}
      <section className="sr-section">
        <div className="sr-wrap">
          <div className="sr-two">
            <div className="sr-box">
              <div className="sr-box-title">What You&apos;ll Do</div>
              <ul className="sr-list">
                {[
                  "Prospect and cold-approach bars, restaurants, and hotel venues in your assigned city",
                  "Pitch and close MatchWatch listing & service packages (DJ, photography, AI tools, etc.)",
                  "Manage a pipeline of 30–60 active accounts through our CRM",
                  "Attend local networking events, sports bars, and watch parties to build relationships",
                  "Upsell corporate group packages to local companies, sports groups, and fan clubs",
                  "Coordinate with the MatchWatch team on onboarding and delivery for new clients",
                  "Hit monthly quotas and report progress weekly",
                ].map(t => (
                  <li key={t}>
                    <CheckCircle2 size={14} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="sr-box">
              <div className="sr-box-title">What We&apos;re Looking For</div>
              <ul className="sr-list">
                {[
                  "Based in one of the 11 World Cup 2026 host cities (or willing to work one remotely)",
                  "1+ years in B2B sales, hospitality sales, or sponsorship/media sales",
                  "Self-starter who can manage their own schedule and hit targets without hand-holding",
                  "Strong local network in hospitality, entertainment, or corporate sectors",
                  "Passion for football / soccer — you understand the magnitude of this event",
                  "Comfortable with cold outreach (in-person, email, phone, LinkedIn)",
                  "Bonus: experience with event sales, media packages, or SaaS to SMBs",
                ].map(t => (
                  <li key={t}>
                    <CheckCircle2 size={14} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Compensation */}
      <section className="sr-section">
        <div className="sr-wrap">
          <h2 className="sr-section-title">Compensation</h2>
          <p style={{ fontSize: ".88rem", color: "#a8a59d", lineHeight: 1.6, marginBottom: 24 }}>
            This is a commission-first role. High performers in a single host city can realistically earn
            $4,000–$12,000+ between now and the tournament.
          </p>
          <div className="sr-comp">
            {[
              { label: "Venue Listing Commission", val: "$50–$75 per venue activated" },
              { label: "Full Package Close (Listing + Services)", val: "$100–$150 per deal", accent: true },
              { label: "Corporate Group Package", val: "$200–$500 per group event" },
              { label: "Monthly Quota Bonus", val: "$250 bonus at 10+ venues/month", accent: true },
              { label: "Tournament Performance Bonus", val: "Up to $1,000 if city target is hit" },
              { label: "Payment Schedule", val: "Paid monthly, net-30 after deal confirms" },
            ].map(r => (
              <div className="sr-comp-row" key={r.label}>
                <span className="sr-comp-label">{r.label}</span>
                <span className={`sr-comp-val${r.accent ? " accent" : ""}`}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="sr-section">
        <div className="sr-wrap">
          <h2 className="sr-section-title">What Happens After You Apply</h2>
          <div className="sr-timeline">
            {[
              { icon: <Send size={16} />, title: "Apply below", desc: "Takes 5 minutes. We review every application within 3 business days." },
              { icon: <Users size={16} />, title: "15-min intro call", desc: "Quick chat with our Head of Sales to see if the city and role are a fit." },
              { icon: <Target size={16} />, title: "Paid trial week", desc: "Complete 3 warm outreach attempts in your market. We'll evaluate together." },
              { icon: <Zap size={16} />, title: "Onboard & start earning", desc: "Get access to pitch deck, CRM, pricing sheets, and a dedicated Slack channel. Start closing." },
            ].map((step, i) => (
              <div className="sr-tl-item" key={i}>
                <div className="sr-tl-dot">{step.icon}</div>
                <div className="sr-tl-body">
                  <div className="sr-tl-title">{step.title}</div>
                  <div className="sr-tl-desc">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="sr-section" id="apply">
        <div className="sr-wrap">
          <div className="sr-apply">
            <h2 className="sr-apply-title">Apply Now</h2>
            <p className="sr-apply-sub">
              Fill out the form below and we&apos;ll be in touch within 3 business days.
            </p>
            <form className="sr-form" onSubmit={handleSubmit}>
              {submitted ? (
                <div className="sr-success">
                  <div className="sr-success-icon"><CheckCircle2 size={26} /></div>
                  <h3>Application received!</h3>
                  <p>We&apos;ll review your application and reach out within 3 business days.</p>
                </div>
              ) : (
                <>
                  <div className="sr-field">
                    <label className="sr-label">First Name <span>*</span></label>
                    <input className="sr-input" required value={form.firstName} onChange={set("firstName")} placeholder="Alex" />
                  </div>
                  <div className="sr-field">
                    <label className="sr-label">Last Name <span>*</span></label>
                    <input className="sr-input" required value={form.lastName} onChange={set("lastName")} placeholder="Rivera" />
                  </div>
                  <div className="sr-field">
                    <label className="sr-label">Email <span>*</span></label>
                    <input className="sr-input" type="email" required value={form.email} onChange={set("email")} placeholder="alex@example.com" />
                  </div>
                  <div className="sr-field">
                    <label className="sr-label">Phone <span>*</span></label>
                    <input className="sr-input" type="tel" required value={form.phone} onChange={set("phone")} placeholder="+1 (713) 555-0000" />
                  </div>
                  <div className="sr-field">
                    <label className="sr-label">Your City <span>*</span></label>
                    <select className="sr-select sr-input" required value={form.city} onChange={set("city")}>
                      <option value="">Select your city…</option>
                      <option>Houston, TX</option>
                      <option>New York, NY</option>
                      <option>Los Angeles, CA</option>
                      <option>Dallas, TX</option>
                      <option>San Francisco, CA</option>
                      <option>Seattle, WA</option>
                      <option>Boston, MA</option>
                      <option>Miami, FL</option>
                      <option>Atlanta, GA</option>
                      <option>Kansas City, MO</option>
                      <option>Philadelphia, PA</option>
                      <option>Vancouver, BC (Canada)</option>
                      <option>Toronto, ON (Canada)</option>
                      <option>Guadalajara (Mexico)</option>
                      <option>Mexico City (Mexico)</option>
                      <option>Monterrey (Mexico)</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="sr-field">
                    <label className="sr-label">Sales Experience <span>*</span></label>
                    <select className="sr-select sr-input" required value={form.experience} onChange={set("experience")}>
                      <option value="">Select…</option>
                      <option>Less than 1 year</option>
                      <option>1–2 years</option>
                      <option>3–5 years</option>
                      <option>5+ years</option>
                    </select>
                  </div>
                  <div className="sr-field">
                    <label className="sr-label">LinkedIn Profile <span style={{ color: "#6c6a64", fontWeight: 400 }}>(optional)</span></label>
                    <input className="sr-input" type="url" value={form.linkedin} onChange={set("linkedin")} placeholder="https://linkedin.com/in/..." />
                  </div>
                  <div className="sr-field">
                    <label className="sr-label">Website / Portfolio <span style={{ color: "#6c6a64", fontWeight: 400 }}>(optional)</span></label>
                    <input className="sr-input" type="url" value={form.website} onChange={set("website")} placeholder="https://..." />
                  </div>
                  <div className="sr-field full">
                    <label className="sr-label">Why do you want this role? <span>*</span></label>
                    <textarea
                      className="sr-textarea"
                      required
                      value={form.why}
                      onChange={set("why")}
                      placeholder="Tell us about your connection to your city, your sales style, and why World Cup 2026 excites you..."
                    />
                  </div>
                  {error && (
                    <div className="full" style={{ gridColumn: "1/-1", padding: "12px 16px", background: "color-mix(in srgb,#e05c3a 10%,transparent)", border: "1px solid color-mix(in srgb,#e05c3a 30%,transparent)", borderRadius: 8, fontSize: ".84rem", color: "#e05c3a" }}>
                      {error}
                    </div>
                  )}
                  <div className="sr-submit">
                    <button className="sr-btn" type="submit" disabled={submitting}>
                      {submitting ? "Sending…" : <><Send size={15} /> Submit Application</>}
                    </button>
                    <span className="sr-note">We respond within 3 business days.</span>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "32px 0", borderTop: "1px solid #1a1c22" }}>
        <div className="sr-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".78rem", color: "#45444e" }}>
            © 2026 MatchWatch · All rights reserved
          </span>
          <Link href="/careers" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Space Grotesk',sans-serif", fontSize: ".82rem", fontWeight: 700, color: "oklch(0.72 0.19 28)", textDecoration: "none" }}>
            See all open roles <ChevronRight size={14} />
          </Link>
        </div>
      </footer>
    </div>
  );
}

export default function SalesRepPage() {
  return (
    <Suspense fallback={<div style={{ background: "#0a0b0d", minHeight: "100vh" }} />}>
      <SalesRepContent />
    </Suspense>
  );
}
