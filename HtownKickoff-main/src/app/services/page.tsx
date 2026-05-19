"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FloatingNav } from "@/components/AppShell";
import {
  Music, Camera, Megaphone, Bot, QrCode,
  Send, Check, MapPin, ArrowRight, Building2, Utensils, X,
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
  "Oil & Gas", "Medical / Healthcare", "Tech / Software", "Finance / Banking",
  "Legal", "Real Estate", "Manufacturing", "Retail", "Education", "Government", "Other",
];
const CAPACITY_OPTIONS = ["Under 50", "50 – 100", "100 – 250", "250 – 500", "500+"];

const SERVICES = [
  { slug: "dj-entertainment",  title: "DJ & Entertainment",    description: "Hype your crowd with live DJs before and after every match.", icon: Music },
  { slug: "photography-video", title: "Photography & Video",   description: "Professional event photos and video recaps for social media.", icon: Camera },
  { slug: "digital-marketing", title: "Digital Marketing",     description: "Paid ads, social promotion, and email campaigns to fill seats.", icon: Megaphone },
  { slug: "ai-receptionist",   title: "AI Receptionist / CRM", description: "AI phone agent that handles reservations and inquiries 24/7.", icon: Bot },
  { slug: "qr-campaigns",      title: "QR Code Campaigns",     description: "QR-driven fan experiences, contests, and giveaways.", icon: QrCode },
];

/* ── CSS ── */
const CSS = `
*{box-sizing:border-box;}
body{background:#0a0b0d!important;color:#f1ece4!important;overflow-x:hidden;}
.sv-page{background:#0a0b0d;min-height:100vh;color:#f1ece4;overflow-x:hidden;}
.sv-wrap{max-width:1200px;margin:0 auto;padding:0 24px;width:100%;}

/* hero */
.sv-hero{position:relative;overflow:hidden;padding:calc(var(--site-nav-height,64px) + 72px) 0 72px;border-bottom:1px solid #23272f;}
.sv-hero-bg{position:absolute;inset:0;background-image:url('/assets/services-hero.jpg'),url('/match-hero.webp');background-size:cover;background-position:center 30%;filter:brightness(.38) saturate(1.1);}
.sv-hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,11,13,.45) 0%,rgba(10,11,13,.62) 60%,rgba(10,11,13,.92) 100%);}
.sv-hero-overlay2{position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 50% 110%,color-mix(in srgb,oklch(0.72 0.19 28) 18%,transparent),transparent 70%);}
.sv-hero-inner{position:relative;z-index:2;max-width:1200px;margin:0 auto;padding:0 24px;text-align:center;}
.sv-kicker{display:inline-flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:oklch(0.72 0.19 28);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 40%,transparent);padding:5px 14px;border-radius:999px;margin-bottom:24px;background:rgba(0,0,0,.35);backdrop-filter:blur(6px);}
.sv-kicker .bd{width:6px;height:6px;background:oklch(0.72 0.19 28);border-radius:50%;animation:svbd 1.4s ease-in-out infinite;}
@keyframes svbd{0%,100%{opacity:.4;}50%{opacity:1;}}
.sv-hero-h1{font-family:'Space Grotesk',sans-serif;font-size:clamp(2rem,5vw,3.6rem);font-weight:900;line-height:1.02;letter-spacing:-0.025em;margin:0 0 16px;color:#fff;text-shadow:0 2px 24px rgba(0,0,0,.5);}
.sv-hero-h1 b{color:oklch(0.72 0.19 28);}
.sv-hero-sub{font-size:1.05rem;color:rgba(241,236,228,.82);line-height:1.6;max-width:560px;margin:0 auto 40px;text-shadow:0 1px 8px rgba(0,0,0,.4);}

/* mode tabs */
.sv-tabs{display:inline-flex;background:#101217;border:1px solid #23272f;border-radius:14px;padding:4px;gap:4px;margin-bottom:0;}
.sv-tab{display:flex;align-items:center;gap:8px;padding:12px 24px;border-radius:10px;font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;cursor:pointer;border:none;background:transparent;color:#a8a59d;transition:all .15s;}
.sv-tab:hover{color:#f1ece4;}
.sv-tab.on{background:oklch(0.72 0.19 28);color:#0a0b0d;}
.sv-tab-icon{opacity:.7;}
.sv-tab.on .sv-tab-icon{opacity:1;}

/* content sections */
.sv-section{padding:64px 0;}
.sv-section+.sv-section{border-top:1px solid #23272f;}
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

/* corporate intro */
.sv-corp-intro{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:48px;}
.sv-corp-box{background:#101217;border:1px solid #23272f;padding:24px;border-radius:12px;}
.sv-corp-box-title{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:15px;color:#f1ece4;margin:0 0 8px;}
.sv-corp-box-body{font-size:13px;color:#a8a59d;line-height:1.55;margin:0;}
.sv-corp-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px;}
.sv-corp-tag{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border:1px solid #2f3540;color:#a8a59d;border-radius:999px;}
.sv-corp-cta-row{display:flex;justify-content:center;padding:8px 0 0;}
.sv-corp-cta{display:inline-flex;align-items:center;gap:10px;padding:16px 40px;border-radius:999px;font-size:15px;font-weight:800;font-family:'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;background:oklch(0.72 0.19 28);color:#0a0b0d;border:none;cursor:pointer;transition:all .18s;}
.sv-corp-cta:hover{filter:brightness(1.1);box-shadow:0 12px 32px color-mix(in srgb,oklch(0.72 0.19 28) 32%,transparent);transform:translateY(-2px);}

/* modal overlay */
.sv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:1000;display:flex;align-items:flex-end;justify-content:flex-end;backdrop-filter:blur(3px);animation:sv-fade-in .18s ease;}
@keyframes sv-fade-in{from{opacity:0;}to{opacity:1;}}

/* modal panel */
.sv-modal{position:relative;width:100%;max-width:540px;max-height:92vh;background:#101217;border:1px solid #2f3540;border-radius:20px 20px 0 0;overflow-y:auto;display:flex;flex-direction:column;animation:sv-slide-up .22s cubic-bezier(.25,.8,.25,1);}
@keyframes sv-slide-up{from{transform:translateY(40px);opacity:0;}to{transform:translateY(0);opacity:1;}}
@media(min-width:640px){
  .sv-overlay{align-items:center;justify-content:flex-end;padding:24px;}
  .sv-modal{border-radius:20px;max-height:90vh;}
}

.sv-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:24px 24px 0;flex-shrink:0;}
.sv-modal-title{font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:1.1rem;color:#f1ece4;margin:0 0 4px;letter-spacing:-0.01em;}
.sv-modal-sub{font-size:.82rem;color:#a8a59d;line-height:1.45;margin:0;}
.sv-modal-close{width:36px;height:36px;background:#14171d;border:1px solid #2f3540;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#a8a59d;cursor:pointer;flex-shrink:0;transition:all .12s;}
.sv-modal-close:hover{border-color:#f1ece4;color:#f1ece4;}
.sv-modal-body{padding:20px 24px 28px;flex:1;}

/* form */
.sv-form{display:flex;flex-direction:column;gap:16px;}
.sv-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.sv-field{display:flex;flex-direction:column;gap:5px;}
.sv-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#6c6a64;font-weight:700;}
.sv-input,.sv-select,.sv-textarea{width:100%;background:#14171d;border:1px solid #2f3540;color:#f1ece4;font-size:14px;padding:10px 13px;border-radius:10px;transition:border-color .15s;font-family:inherit;}
.sv-input::placeholder,.sv-textarea::placeholder{color:#6c6a64;}
.sv-input:focus,.sv-select:focus,.sv-textarea:focus{outline:none;border-color:oklch(0.72 0.19 28);}
.sv-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a8a59d' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;cursor:pointer;padding-right:36px;}
.sv-textarea{min-height:90px;resize:vertical;line-height:1.5;}
.sv-submit{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px 24px;border-radius:999px;font-size:13px;font-weight:800;font-family:'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;background:oklch(0.72 0.19 28);color:#0a0b0d;border:none;cursor:pointer;transition:all .15s;width:100%;}
.sv-submit:hover:not(:disabled){filter:brightness(1.1);box-shadow:0 10px 28px color-mix(in srgb,oklch(0.72 0.19 28) 30%,transparent);}
.sv-submit:disabled{opacity:.6;cursor:not-allowed;}
.sv-success{text-align:center;padding:36px 16px;display:flex;flex-direction:column;align-items:center;gap:12px;}
.sv-success-icon{width:52px;height:52px;background:color-mix(in srgb,#22c55e 12%,transparent);border:1px solid color-mix(in srgb,#22c55e 25%,transparent);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#22c55e;}
.sv-success-title{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:1.1rem;color:#f1ece4;margin:0;}
.sv-success-body{font-size:.85rem;color:#a8a59d;max-width:320px;line-height:1.5;margin:0;}
.sv-err{font-size:12px;color:#ef4444;}
.sv-pill-group{display:flex;flex-wrap:wrap;gap:7px;}
.sv-pill{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid #2f3540;background:#14171d;color:#a8a59d;cursor:pointer;transition:all .15s;font-family:inherit;}
.sv-pill:hover{border-color:oklch(0.72 0.19 28);color:#f1ece4;}
.sv-pill.on{border-color:oklch(0.72 0.19 28);background:color-mix(in srgb,oklch(0.72 0.19 28) 15%,#14171d);color:oklch(0.72 0.19 28);font-weight:700;}

/* general CTA button (outline) */
.sv-general-cta{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:999px;font-size:13px;font-weight:700;font-family:'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;background:transparent;color:oklch(0.72 0.19 28);border:1.5px solid color-mix(in srgb,oklch(0.72 0.19 28) 45%,transparent);cursor:pointer;transition:all .15s;text-decoration:none;}
.sv-general-cta:hover{background:color-mix(in srgb,oklch(0.72 0.19 28) 10%,transparent);border-color:oklch(0.72 0.19 28);}
.sv-general-cta-row{margin-top:32px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;}

/* responsive */
@media(max-width:900px){
  .sv-grid{grid-template-columns:repeat(3,1fr);}
  .sv-corp-intro{grid-template-columns:1fr;}
}
@media(max-width:640px){
  .sv-grid{grid-template-columns:repeat(2,1fr);}
  .sv-row{grid-template-columns:1fr;}
  .sv-modal-head,.sv-modal-body{padding-left:16px;padding-right:16px;}
  .sv-tab{padding:10px 14px;font-size:13px;}
}
@media(max-width:400px){.sv-grid{grid-template-columns:1fr;}}
`;

/* ── Success state (inside modal) ── */
function SuccessState({ onClose }: { onClose: () => void }) {
  return (
    <div className="sv-success">
      <div className="sv-success-icon"><Check size={24} /></div>
      <p className="sv-success-title">Request received!</p>
      <p className="sv-success-body">We&apos;ll be in touch within 24 hours to discuss your event.</p>
      <button type="button" className="sv-submit" style={{ width: "auto", padding: "11px 28px" }} onClick={onClose}>Close</button>
    </div>
  );
}

/* ── Venue form (inside modal) ── */
function VenueForm({
  preselectedService, selectedCity, setSelectedCity, onClose,
}: {
  preselectedService: string;
  selectedCity: string;
  setSelectedCity: (s: string) => void;
  onClose: () => void;
}) {
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    preselectedService ? new Set([preselectedService]) : new Set(),
  );
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function toggleService(slug: string) {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const cityLabel = CITIES.find((c) => c.slug === selectedCity)?.name || "";
    const serviceLabels = SERVICES.filter((s) => selectedServices.has(s.slug)).map((s) => s.title).join(", ");
    const topic = serviceLabels || "Venue Service Inquiry";
    const msgBody = [
      cityLabel ? `City: ${cityLabel}` : null,
      form.phone ? `Phone: ${form.phone}` : null,
      "",
      form.message,
    ].filter((l) => l !== null).join("\n");
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, topic, message: msgBody }),
      });
      if (!res.ok) throw new Error("failed");
      setSubmitted(true);
    } catch { setError("Something went wrong — please try again."); }
    finally { setSubmitting(false); }
  }

  if (submitted) return <SuccessState onClose={onClose} />;

  return (
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
          <label className="sv-label">Host city</label>
          <select className="sv-select" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
            <option value="">Select city…</option>
            {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="sv-field">
        <label className="sv-label">Services needed <span style={{ color: "#6c6a64", fontWeight: 400 }}>(select one or more)</span></label>
        <div className="sv-pill-group">
          {SERVICES.map((s) => (
            <button key={s.slug} type="button" className={`sv-pill${selectedServices.has(s.slug) ? " on" : ""}`} onClick={() => toggleService(s.slug)}>
              {selectedServices.has(s.slug) && <Check size={10} style={{ flexShrink: 0 }} />}
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
        <Send size={14} />{submitting ? "Sending…" : "Send Request"}
      </button>
    </form>
  );
}

/* ── Corporate form (inside modal) ── */
function CorporateForm({ selectedCity, setSelectedCity, onClose }: {
  selectedCity: string;
  setSelectedCity: (s: string) => void;
  onClose: () => void;
}) {
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
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, topic, message: msgBody }),
      });
      if (!res.ok) throw new Error("failed");
      setSubmitted(true);
    } catch { setError("Something went wrong — please try again."); }
    finally { setSubmitting(false); }
  }

  if (submitted) return <SuccessState onClose={onClose} />;

  return (
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
          <select className="sv-select" required value={form.companyType} onChange={(e) => setForm((f) => ({ ...f, companyType: e.target.value }))}>
            <option value="">Select industry…</option>
            {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="sv-field">
          <label className="sv-label">Expected capacity *</label>
          <select className="sv-select" required value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}>
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
        <select className="sv-select" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
          <option value="">Select a host city…</option>
          {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div className="sv-field">
        <label className="sv-label">Additional notes</label>
        <textarea className="sv-textarea" placeholder="Preferred match dates, catering requirements, budget range, or anything else…" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
      </div>
      {error && <p className="sv-err">{error}</p>}
      <button type="submit" className="sv-submit" disabled={submitting}>
        <Send size={14} />{submitting ? "Sending…" : "Request Watch Party"}
      </button>
    </form>
  );
}

/* ── Modal wrapper ── */
type ModalType = { kind: "venue"; service: string } | { kind: "corporate" } | null;

function Modal({
  modal, selectedCity, setSelectedCity, onClose,
}: {
  modal: ModalType;
  selectedCity: string;
  setSelectedCity: (s: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* lock body scroll */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  /* close on Escape */
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!modal) return null;

  const isVenue = modal.kind === "venue";
  const title = isVenue
    ? (modal.service ? `Request: ${SERVICES.find((s) => s.slug === modal.service)?.title ?? "Service"}` : "Watch Party Service Request")
    : "Corporate Watch Party Request";
  const sub = isVenue
    ? "We'll connect you with a vendor in your city within 24 hours."
    : "Tell us about your company and we'll send options & pricing within 24 hours.";

  return (
    <div className="sv-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sv-modal" ref={panelRef} role="dialog" aria-modal="true">
        <div className="sv-modal-head">
          <div>
            <p className="sv-modal-title">{title}</p>
            <p className="sv-modal-sub">{sub}</p>
          </div>
          <button type="button" className="sv-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="sv-modal-body">
          {isVenue
            ? <VenueForm preselectedService={modal.service} selectedCity={selectedCity} setSelectedCity={setSelectedCity} onClose={onClose} />
            : <CorporateForm selectedCity={selectedCity} setSelectedCity={setSelectedCity} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}

/* ── Venue services tab ── */
function VenueTab({
  selectedCity, setSelectedCity, onOpenModal,
}: {
  selectedCity: string;
  setSelectedCity: (s: string) => void;
  onOpenModal: (modal: ModalType) => void;
}) {
  const cityLabel = CITIES.find((c) => c.slug === selectedCity)?.name || "";
  return (
    <div className="sv-section">
      <div className="sv-wrap">
        {/* City selector */}
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
          <h2 className="sv-sh-title">Watch Party Services for Bars &amp; Restaurants</h2>
          <p className="sv-sh-sub">Click &ldquo;Request Service&rdquo; on any card to open the request form for that service.</p>
        </div>

        <div className="sv-grid">
          {SERVICES.map((svc) => {
            const Icon = svc.icon;
            return (
              <div key={svc.slug} className="sv-card">
                <div className="sv-icon"><Icon size={20} /></div>
                <div className="sv-card-name">{svc.title}</div>
                <div className="sv-card-desc">{svc.description}</div>
                <button
                  type="button"
                  className="sv-req-btn"
                  onClick={() => onOpenModal({ kind: "venue", service: svc.slug })}
                >
                  Request Service
                </button>
              </div>
            );
          })}
        </div>

        <div className="sv-general-cta-row">
          <button
            type="button"
            className="sv-general-cta"
            onClick={() => onOpenModal({ kind: "venue", service: "" })}
          >
            <Send size={13} /> General inquiry
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Corporate tab ── */
function CorporateTab({
  onOpenModal,
}: {
  onOpenModal: (modal: ModalType) => void;
}) {
  return (
    <div className="sv-section">
      <div className="sv-wrap">
        <div className="sv-sh">
          <h2 className="sv-sh-title">Corporate Watch Party Packages</h2>
          <p className="sv-sh-sub">
            Bring your team together for FIFA World Cup 2026. We organize private watch parties
            for companies, employee events, client entertainment, and group bookings across all 11 US host cities.
          </p>
        </div>

        <div className="sv-corp-intro">
          <div className="sv-corp-box">
            <div className="sv-corp-box-title">Who is this for?</div>
            <div className="sv-corp-box-body">
              Any company looking to host a World Cup watch party for employees, clients, or partners.
              We handle venue sourcing, catering, AV setup, and full logistics.
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

        <div className="sv-corp-cta-row">
          <button
            type="button"
            className="sv-corp-cta"
            onClick={() => onOpenModal({ kind: "corporate" })}
          >
            <Building2 size={18} /> Request Corporate Package
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Inner (reads searchParams) ── */
function ServicesInner() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"venue" | "corporate">(
    searchParams.get("for") === "corporate" ? "corporate" : "venue",
  );
  const [selectedCity, setSelectedCity] = useState(searchParams.get("city") || "");
  const [modal, setModal] = useState<ModalType>(() => {
    const svc = searchParams.get("service");
    if (svc) return { kind: "venue", service: svc };
    return null;
  });

  function openModal(m: ModalType) { setModal(m); }
  function closeModal() { setModal(null); }

  return (
    <div className="sv-page">
      {/* Hero */}
      <section className="sv-hero">
        <div className="sv-hero-bg" aria-hidden="true" />
        <div className="sv-hero-overlay" aria-hidden="true" />
        <div className="sv-hero-overlay2" aria-hidden="true" />
        <div className="sv-hero-inner">
          <div className="sv-kicker"><span className="bd" />FIFA World Cup 2026 · Event Services</div>
          <h1 className="sv-hero-h1">World Cup <b>Watch Party</b> Services</h1>
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
        ? <VenueTab selectedCity={selectedCity} setSelectedCity={setSelectedCity} onOpenModal={openModal} />
        : <CorporateTab onOpenModal={openModal} />}

      {modal && (
        <Modal
          modal={modal}
          selectedCity={selectedCity}
          setSelectedCity={setSelectedCity}
          onClose={closeModal}
        />
      )}
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
