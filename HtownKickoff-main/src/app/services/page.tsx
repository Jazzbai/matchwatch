"use client";

import React, { useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FloatingNav } from "@/components/AppShell";
import {
  Music, Camera, Megaphone, Bot, QrCode,
  Send, Check, MapPin, ArrowRight, Building2, Utensils,
} from "lucide-react";

/* ── Data ── */
const CITIES = [
  { slug: "houston",       name: "Houston, TX" },
  { slug: "dallas",        name: "Dallas, TX" },
  { slug: "new-york",      name: "New York / New Jersey" },
  { slug: "los-angeles",   name: "Los Angeles, CA" },
  { slug: "miami",         name: "Miami, FL" },
  { slug: "atlanta",       name: "Atlanta, GA" },
  { slug: "san-francisco", name: "San Francisco Bay Area, CA" },
  { slug: "philadelphia",  name: "Philadelphia, PA" },
  { slug: "seattle",       name: "Seattle, WA" },
  { slug: "boston",        name: "Boston, MA" },
  { slug: "kansas-city",   name: "Kansas City, MO/KS" },
];

const COMPANY_TYPES = [
  "Oil & Gas",
  "Medical / Healthcare",
  "Tech / Software",
  "Finance / Banking",
  "Legal",
  "Real Estate",
  "Manufacturing",
  "Retail",
  "Education",
  "Government",
  "Other",
];

const CAPACITY_OPTIONS = [
  "Under 50",
  "50 – 100",
  "100 – 250",
  "250 – 500",
  "500+",
];

const SERVICES = [
  { slug: "dj-entertainment",  title: "DJ & Entertainment",   description: "Hype your crowd before and after every match.", icon: Music },
  { slug: "photography-video", title: "Photography & Video",  description: "Event photos and video recaps for social media.", icon: Camera },
  { slug: "digital-marketing", title: "Digital Marketing",    description: "Paid ads, social promotion, and email campaigns.", icon: Megaphone },
  { slug: "ai-receptionist",   title: "AI Receptionist / CRM",description: "AI phone agent that handles reservations 24/7.", icon: Bot },
  { slug: "qr-campaigns",      title: "QR Code Campaigns",    description: "QR-driven fan experiences, contests, and giveaways.", icon: QrCode },
];

/* ── CSS ── */
const CSS = `
*{box-sizing:border-box;}
body{background:#0a0b0d!important;color:#f1ece4!important;overflow-x:hidden;}
.sv-page{background:#0a0b0d;min-height:100vh;color:#f1ece4;overflow-x:hidden;}
.sv-wrap{max-width:1200px;margin:0 auto;padding:0 24px;width:100%;}

/* hero */
.sv-hero{position:relative;overflow:hidden;padding:calc(var(--site-nav-height,64px) + 56px) 0 56px;border-bottom:1px solid #23272f;background:linear-gradient(160deg,#0a0b0d 0%,#0d1520 50%,#1a0a05 100%);}
.sv-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 65% 50%,color-mix(in srgb,oklch(0.72 0.19 28) 10%,transparent),transparent 70%);pointer-events:none;}
.sv-hero-inner{position:relative;z-index:2;max-width:1200px;margin:0 auto;padding:0 24px;text-align:center;}
.sv-kicker{display:inline-flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:oklch(0.72 0.19 28);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 30%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:20px;}
.sv-kicker .bd{width:6px;height:6px;background:oklch(0.72 0.19 28);border-radius:50%;animation:svbd 1.4s ease-in-out infinite;}
@keyframes svbd{0%,100%{opacity:.4;}50%{opacity:1;}}
.sv-hero-h1{font-family:'Space Grotesk',sans-serif;font-size:clamp(1.8rem,4vw,3rem);font-weight:900;line-height:1.05;letter-spacing:-0.02em;margin:0 0 14px;color:#f1ece4;}
.sv-hero-h1 b{color:oklch(0.72 0.19 28);}
.sv-hero-sub{font-size:1rem;color:#a8a59d;line-height:1.6;max-width:540px;margin:0 auto 36px;}

/* mode tabs */
.sv-tabs{display:inline-flex;background:#101217;border:1px solid #23272f;border-radius:14px;padding:4px;gap:4px;margin-bottom:0;}
.sv-tab{display:flex;align-items:center;gap:8px;padding:12px 24px;border-radius:10px;font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;cursor:pointer;border:none;background:transparent;color:#a8a59d;transition:all .15s;}
.sv-tab:hover{color:#f1ece4;}
.sv-tab.on{background:oklch(0.72 0.19 28);color:#0a0b0d;}
.sv-tab-icon{opacity:.7;}
.sv-tab.on .sv-tab-icon{opacity:1;}

/* content sections */
.sv-section{padding:64px 0;border-bottom:1px solid #23272f;}
.sv-section:last-child{border-bottom:none;}
.sv-sh{margin-bottom:36px;}
.sv-sh-title{font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(1.3rem,2.6vw,1.8rem);color:#f1ece4;margin:0 0 8px;letter-spacing:-0.01em;}
.sv-sh-sub{font-size:.93rem;color:#a8a59d;line-height:1.55;margin:0;max-width:580px;}

/* city row */
.sv-city-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:40px;}
.sv-city-label{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#6c6a64;white-space:nowrap;}
.sv-city-select{appearance:none;background:#14171d;border:1px solid #2f3540;color:#f1ece4;font-size:14px;font-weight:600;padding:10px 40px 10px 14px;border-radius:12px;cursor:pointer;min-width:240px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a8a59d' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;transition:border-color .15s;}
.sv-city-select:focus{outline:none;border-color:oklch(0.72 0.19 28);}
.sv-city-link{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:oklch(0.72 0.19 28);text-decoration:none;padding:10px 16px;border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 30%,transparent);border-radius:999px;transition:all .15s;white-space:nowrap;}
.sv-city-link:hover{background:color-mix(in srgb,oklch(0.72 0.19 28) 10%,transparent);}

/* service cards */
.sv-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;}
.sv-card{background:color-mix(in srgb,oklch(0.72 0.19 28) 5%,#101217);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 15%,#23272f);padding:20px 16px;display:flex;flex-direction:column;gap:12px;transition:border-color .15s,background .15s,transform .15s;border-radius:12px;}
.sv-card:hover{border-color:color-mix(in srgb,oklch(0.72 0.19 28) 40%,#23272f);background:color-mix(in srgb,oklch(0.72 0.19 28) 9%,#101217);transform:translateY(-2px);}
.sv-icon{width:44px;height:44px;background:color-mix(in srgb,oklch(0.72 0.19 28) 14%,transparent);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 22%,transparent);display:flex;align-items:center;justify-content:center;color:oklch(0.72 0.19 28);border-radius:10px;flex-shrink:0;}
.sv-card-name{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:14px;color:#f1ece4;line-height:1.2;}
.sv-card-desc{font-size:12px;color:#a8a59d;line-height:1.45;flex:1;}
.sv-req-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 14px;border-radius:999px;font-size:12px;font-weight:800;font-family:'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;background:oklch(0.72 0.19 28);color:#0a0b0d;border:none;cursor:pointer;transition:all .15s;text-decoration:none;width:100%;margin-top:auto;}
.sv-req-btn:hover{filter:brightness(1.1);transform:translateY(-1px);}

/* corporate highlight boxes */
.sv-corp-intro{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:48px;}
.sv-corp-box{background:#101217;border:1px solid #23272f;padding:24px;border-radius:12px;}
.sv-corp-box-title{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:15px;color:#f1ece4;margin:0 0 8px;}
.sv-corp-box-body{font-size:13px;color:#a8a59d;line-height:1.55;margin:0;}
.sv-corp-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px;}
.sv-corp-tag{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border:1px solid #2f3540;color:#a8a59d;border-radius:999px;}

/* form */
.sv-form-section{padding:0 0 72px;}
.sv-form-wrap{max-width:680px;}
.sv-form-head{margin-bottom:28px;}
.sv-form-title{font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:1.3rem;color:#f1ece4;margin:0 0 6px;}
.sv-form-sub{font-size:.88rem;color:#a8a59d;line-height:1.55;margin:0;}
.sv-form{background:#101217;border:1px solid #23272f;padding:32px;display:flex;flex-direction:column;gap:18px;border-radius:12px;}
.sv-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.sv-field{display:flex;flex-direction:column;gap:6px;}
.sv-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#6c6a64;font-weight:700;}
.sv-input,.sv-select,.sv-textarea{width:100%;background:#14171d;border:1px solid #2f3540;color:#f1ece4;font-size:14px;padding:11px 14px;border-radius:10px;transition:border-color .15s;font-family:inherit;}
.sv-input::placeholder,.sv-textarea::placeholder{color:#6c6a64;}
.sv-input:focus,.sv-select:focus,.sv-textarea:focus{outline:none;border-color:oklch(0.72 0.19 28);}
.sv-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a8a59d' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;cursor:pointer;}
.sv-textarea{min-height:100px;resize:vertical;line-height:1.5;}
.sv-submit{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:800;font-family:'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;background:oklch(0.72 0.19 28);color:#0a0b0d;border:none;cursor:pointer;transition:all .15s;width:100%;}
.sv-submit:hover:not(:disabled){filter:brightness(1.1);box-shadow:0 10px 28px color-mix(in srgb,oklch(0.72 0.19 28) 30%,transparent);}
.sv-submit:disabled{opacity:.6;cursor:not-allowed;}
.sv-success{text-align:center;padding:48px 24px;display:flex;flex-direction:column;align-items:center;gap:14px;}
.sv-success-icon{width:56px;height:56px;background:color-mix(in srgb,#22c55e 12%,transparent);border:1px solid color-mix(in srgb,#22c55e 25%,transparent);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#22c55e;}
.sv-success-title{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:1.2rem;color:#f1ece4;margin:0;}
.sv-success-body{font-size:.88rem;color:#a8a59d;max-width:360px;line-height:1.5;margin:0;}
.sv-err{font-size:12px;color:#ef4444;margin-top:4px;}
.sv-pill-group{display:flex;flex-wrap:wrap;gap:8px;}
.sv-pill{display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:999px;font-size:13px;font-weight:600;border:1px solid #2f3540;background:#14171d;color:#a8a59d;cursor:pointer;transition:all .15s;font-family:inherit;}
.sv-pill:hover{border-color:oklch(0.72 0.19 28);color:#f1ece4;}
.sv-pill.on{border-color:oklch(0.72 0.19 28);background:color-mix(in srgb,oklch(0.72 0.19 28) 15%,#14171d);color:oklch(0.72 0.19 28);font-weight:700;}

/* responsive */
@media(max-width:900px){
  .sv-grid{grid-template-columns:repeat(3,1fr);}
  .sv-corp-intro{grid-template-columns:1fr;}
}
@media(max-width:640px){
  .sv-grid{grid-template-columns:repeat(2,1fr);}
  .sv-row{grid-template-columns:1fr;}
  .sv-form{padding:20px 14px;}
  .sv-tab{padding:10px 16px;font-size:13px;}
}
@media(max-width:400px){.sv-grid{grid-template-columns:1fr;}}
`;

/* ── Shared success state ── */
function SuccessState() {
  return (
    <div className="sv-success">
      <div className="sv-success-icon"><Check size={26} /></div>
      <p className="sv-success-title">Request received!</p>
      <p className="sv-success-body">We&apos;ll be in touch within 24 hours to discuss your event.</p>
      <Link href="/venues" className="sv-req-btn" style={{ width: "auto", padding: "11px 24px" }}>Browse venues</Link>
    </div>
  );
}

/* ── Venue services tab ── */
function VenueTab({ selectedCity, setSelectedCity }: { selectedCity: string; setSelectedCity: (s: string) => void }) {
  const formRef = useRef<HTMLDivElement>(null);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const cityLabel = CITIES.find((c) => c.slug === selectedCity)?.name || "";

  function toggleService(slug: string) {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }

  function requestService(slug: string) {
    setSelectedServices(new Set([slug]));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const serviceLabels = SERVICES.filter((s) => selectedServices.has(s.slug)).map((s) => s.title).join(", ");
    const topic = serviceLabels || "Venue Service Inquiry";
    const msgBody = [cityLabel ? `City: ${cityLabel}` : null, form.phone ? `Phone: ${form.phone}` : null, "", form.message].filter((l) => l !== null).join("\n");
    try {
      const res = await fetch("/api/v1/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, topic, message: msgBody }) });
      if (!res.ok) throw new Error("failed");
      setSubmitted(true);
    } catch { setError("Something went wrong — please try again."); }
    finally { setSubmitting(false); }
  }

  return (
    <>
      {/* City selector */}
      <div className="sv-section">
        <div className="sv-wrap">
          <div className="sv-city-row">
            <span className="sv-city-label"><MapPin size={12} style={{ display: "inline", marginRight: 4 }} />Host city</span>
            <select className="sv-city-select" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
              <option value="">Select a host city…</option>
              {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            {selectedCity && (
              <Link href={`/world-cup/${selectedCity}`} className="sv-city-link">
                View {cityLabel} matches <ArrowRight size={12} />
              </Link>
            )}
          </div>

          <div className="sv-sh">
            <h2 className="sv-sh-title">Watch Party Services</h2>
            <p className="sv-sh-sub">Click &ldquo;Request Service&rdquo; to pre-fill the form below, or select multiple services manually.</p>
          </div>
          <div className="sv-grid">
            {SERVICES.map((svc) => {
              const Icon = svc.icon;
              return (
                <div key={svc.slug} className="sv-card">
                  <div className="sv-icon"><Icon size={20} /></div>
                  <div className="sv-card-name">{svc.title}</div>
                  <div className="sv-card-desc">{svc.description}</div>
                  <button type="button" className="sv-req-btn" onClick={() => requestService(svc.slug)}>Request Service</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Venue inquiry form */}
      <div className="sv-form-section" ref={formRef}>
        <div className="sv-wrap">
          <div className="sv-form-wrap">
            <div className="sv-form-head">
              <h2 className="sv-form-title">Get in Touch</h2>
              <p className="sv-form-sub">Tell us what you need and we&apos;ll connect you with a vendor in your city within 24 hours.</p>
            </div>
            {submitted ? <SuccessState /> : (
              <form className="sv-form" onSubmit={handleSubmit}>
                <div className="sv-row">
                  <div className="sv-field">
                    <label className="sv-label">Your name *</label>
                    <input className="sv-input" placeholder="Jane Smith" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="sv-field">
                    <label className="sv-label">Email *</label>
                    <input className="sv-input" type="email" placeholder="jane@venue.com" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
                <div className="sv-row">
                  <div className="sv-field">
                    <label className="sv-label">Phone</label>
                    <input className="sv-input" type="tel" placeholder="+1 (713) 000-0000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="sv-field">
                    <label className="sv-label">City</label>
                    <select className="sv-select sv-input" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                      <option value="">Select a host city…</option>
                      {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="sv-field">
                  <label className="sv-label">Services needed <span style={{ color: "#6c6a64", fontWeight: 400 }}>(select one or more)</span></label>
                  <div className="sv-pill-group">
                    {SERVICES.map((s) => (
                      <button key={s.slug} type="button" className={`sv-pill${selectedServices.has(s.slug) ? " on" : ""}`} onClick={() => toggleService(s.slug)}>
                        {selectedServices.has(s.slug) && <Check size={11} style={{ flexShrink: 0 }} />}
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sv-field">
                  <label className="sv-label">About your venue / event *</label>
                  <textarea className="sv-textarea" placeholder="Venue name, expected attendance, event dates, specific requirements…" required value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
                </div>
                {error && <p className="sv-err">{error}</p>}
                <button type="submit" className="sv-submit" disabled={submitting}>
                  <Send size={15} />{submitting ? "Sending…" : "Send Request"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Corporate tab ── */
function CorporateTab({ selectedCity, setSelectedCity }: { selectedCity: string; setSelectedCity: (s: string) => void }) {
  const [form, setForm] = useState({ name: "", company: "", companyType: "", email: "", phone: "", capacity: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const cityLabel = CITIES.find((c) => c.slug === selectedCity)?.name || "";
    const topic = `Corporate Watch Party — ${form.companyType || "Company"}`;
    const msgBody = [
      `Company: ${form.company}`,
      `Industry: ${form.companyType}`,
      cityLabel ? `City: ${cityLabel}` : null,
      `Capacity: ${form.capacity}`,
      form.phone ? `Phone: ${form.phone}` : null,
      "",
      form.message || "(no additional notes)",
    ].filter((l) => l !== null).join("\n");
    try {
      const res = await fetch("/api/v1/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, topic, message: msgBody }) });
      if (!res.ok) throw new Error("failed");
      setSubmitted(true);
    } catch { setError("Something went wrong — please try again."); }
    finally { setSubmitting(false); }
  }

  return (
    <>
      {/* Intro section */}
      <div className="sv-section">
        <div className="sv-wrap">
          <div className="sv-sh">
            <h2 className="sv-sh-title">Corporate Watch Party Packages</h2>
            <p className="sv-sh-sub">
              Bring your team together for FIFA World Cup 2026. We organize private watch parties
              for companies, employee events, client entertainment, and group bookings at venues across all 11 host cities.
            </p>
          </div>

          <div className="sv-corp-intro">
            <div className="sv-corp-box">
              <div className="sv-corp-box-title">Who is this for?</div>
              <div className="sv-corp-box-body">
                Any company looking to host a World Cup watch party for employees, clients, or partners.
                We handle venue sourcing, catering, AV, and logistics.
              </div>
              <div className="sv-corp-tags">
                {["Oil & Gas", "Medical", "Tech", "Finance", "Legal", "Real Estate", "Manufacturing", "Government"].map((t) => (
                  <span key={t} className="sv-corp-tag">{t}</span>
                ))}
              </div>
            </div>
            <div className="sv-corp-box">
              <div className="sv-corp-box-title">What&apos;s included?</div>
              <div className="sv-corp-box-body">
                Private venue booking · Match-day AV setup · Catering options · Branded experience ·
                Event coordination · Capacity from 20 to 500+ guests.
              </div>
              <div className="sv-corp-tags">
                {["Private Booking", "Catering", "AV Setup", "Branding", "20 – 500+ Guests", "All 11 Cities"].map((t) => (
                  <span key={t} className="sv-corp-tag">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Corporate form */}
      <div className="sv-form-section">
        <div className="sv-wrap">
          <div className="sv-form-wrap">
            <div className="sv-form-head">
              <h2 className="sv-form-title">Request a Corporate Watch Party</h2>
              <p className="sv-form-sub">Fill in the details below and we&apos;ll get back to you within 24 hours with options and pricing.</p>
            </div>
            {submitted ? <SuccessState /> : (
              <form className="sv-form" onSubmit={handleSubmit}>
                <div className="sv-row">
                  <div className="sv-field">
                    <label className="sv-label">Contact name *</label>
                    <input className="sv-input" placeholder="John Smith" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="sv-field">
                    <label className="sv-label">Company name *</label>
                    <input className="sv-input" placeholder="Acme Corp" required value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
                  </div>
                </div>
                <div className="sv-row">
                  <div className="sv-field">
                    <label className="sv-label">Industry *</label>
                    <select className="sv-select sv-input" required value={form.companyType} onChange={(e) => setForm((f) => ({ ...f, companyType: e.target.value }))}>
                      <option value="">Select industry…</option>
                      {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="sv-field">
                    <label className="sv-label">Expected capacity *</label>
                    <select className="sv-select sv-input" required value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}>
                      <option value="">Number of guests…</option>
                      {CAPACITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="sv-row">
                  <div className="sv-field">
                    <label className="sv-label">Email *</label>
                    <input className="sv-input" type="email" placeholder="john@company.com" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="sv-field">
                    <label className="sv-label">Phone</label>
                    <input className="sv-input" type="tel" placeholder="+1 (713) 000-0000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="sv-field">
                  <label className="sv-label">Host city</label>
                  <select className="sv-select sv-input" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                    <option value="">Select a host city…</option>
                    {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
                <div className="sv-field">
                  <label className="sv-label">Additional notes</label>
                  <textarea className="sv-textarea" placeholder="Preferred match dates, catering requirements, budget range, or anything else we should know…" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
                </div>
                {error && <p className="sv-err">{error}</p>}
                <button type="submit" className="sv-submit" disabled={submitting}>
                  <Send size={15} />{submitting ? "Sending…" : "Request Watch Party"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Inner (reads searchParams) ── */
function ServicesInner() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"venue" | "corporate">(
    searchParams.get("for") === "corporate" ? "corporate" : "venue",
  );
  const [selectedCity, setSelectedCity] = useState(searchParams.get("city") || "");

  return (
    <div className="sv-page">
      {/* Hero */}
      <section className="sv-hero">
        <div className="sv-hero-inner">
          <div className="sv-kicker"><span className="bd" />FIFA World Cup 2026 · Event Services</div>
          <h1 className="sv-hero-h1">
            World Cup <b>Watch Party</b> Services
          </h1>
          <p className="sv-hero-sub">
            Whether you run a bar or manage a company, we make World Cup watch parties unforgettable — in all 11 US host cities.
          </p>
          <div className="sv-tabs">
            <button type="button" className={`sv-tab${mode === "venue" ? " on" : ""}`} onClick={() => setMode("venue")}>
              <Utensils size={16} className="sv-tab-icon" />
              Bars &amp; Restaurants
            </button>
            <button type="button" className={`sv-tab${mode === "corporate" ? " on" : ""}`} onClick={() => setMode("corporate")}>
              <Building2 size={16} className="sv-tab-icon" />
              Companies &amp; Groups
            </button>
          </div>
        </div>
      </section>

      {mode === "venue"
        ? <VenueTab selectedCity={selectedCity} setSelectedCity={setSelectedCity} />
        : <CorporateTab selectedCity={selectedCity} setSelectedCity={setSelectedCity} />}
    </div>
  );
}

export default function ServicesPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <FloatingNav />
      <Suspense fallback={null}>
        <ServicesInner />
      </Suspense>
    </>
  );
}
