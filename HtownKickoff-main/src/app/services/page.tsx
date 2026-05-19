"use client";

import React, { useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FloatingNav } from "@/components/AppShell";
import {
  Music, Camera, Monitor, Volume2, Palette, Shield,
  UtensilsCrossed, Megaphone, Bot, QrCode,
  Send, Check, MapPin, ArrowRight,
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

const SERVICES = [
  {
    slug: "dj-entertainment",
    title: "DJ & Entertainment",
    description: "Hype your crowd before and after every match with a pro DJ who knows how to work a soccer crowd.",
    icon: Music,
  },
  {
    slug: "photography-video",
    title: "Photography & Video",
    description: "Event photos and 2–3 min video recaps ready for social media the same night.",
    icon: Camera,
  },
  {
    slug: "led-screens-av",
    title: "LED Screens & AV",
    description: "Large-format LED screens and full AV setup so every seat has a perfect view.",
    icon: Monitor,
  },
  {
    slug: "sound-lighting",
    title: "Sound & Lighting",
    description: "Professional sound and match-day lighting rigs that create an arena atmosphere.",
    icon: Volume2,
  },
  {
    slug: "decor-branding",
    title: "Decor & Branding",
    description: "Flags, banners, branded props, and full fan zone buildouts for your venue.",
    icon: Palette,
  },
  {
    slug: "security-staffing",
    title: "Security & Staffing",
    description: "Crowd management, door staff, and complete event staffing solutions.",
    icon: Shield,
  },
  {
    slug: "food-catering",
    title: "Food & Catering",
    description: "Catering packages and specialty match-day menus tailored for large watch parties.",
    icon: UtensilsCrossed,
  },
  {
    slug: "digital-marketing",
    title: "Digital Marketing",
    description: "Paid ads, social promotion, influencer outreach, and email campaigns to fill your venue.",
    icon: Megaphone,
  },
  {
    slug: "ai-receptionist",
    title: "AI Receptionist / CRM",
    description: "AI phone agent that handles reservations 24/7 so you never miss a booking.",
    icon: Bot,
  },
  {
    slug: "qr-campaigns",
    title: "QR Code Campaigns",
    description: "QR-driven fan experiences, contests, giveaways, and lead capture at your events.",
    icon: QrCode,
  },
];

/* ── CSS ── */
const CSS = `
*{box-sizing:border-box;}
body{background:#0a0b0d!important;color:#f1ece4!important;overflow-x:hidden;}
.sv-page{background:#0a0b0d;min-height:100vh;color:#f1ece4;overflow-x:hidden;}
.sv-wrap{max-width:1200px;margin:0 auto;padding:0 24px;width:100%;}

/* hero */
.sv-hero{position:relative;overflow:hidden;padding:100px 0 72px;border-bottom:1px solid #23272f;background:linear-gradient(160deg,#0a0b0d 0%,#0d1520 50%,#1a0a05 100%);}
.sv-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 65% 50%,color-mix(in srgb,oklch(0.72 0.19 28) 10%,transparent),transparent 70%);pointer-events:none;}
.sv-hero-inner{position:relative;z-index:2;max-width:1200px;margin:0 auto;padding:0 24px;}
.sv-kicker{display:inline-flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:oklch(0.72 0.19 28);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 30%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:20px;}
.sv-kicker .bd{width:6px;height:6px;background:oklch(0.72 0.19 28);border-radius:50%;animation:svbd 1.4s ease-in-out infinite;}
@keyframes svbd{0%,100%{opacity:.4;}50%{opacity:1;}}
.sv-hero-h1{font-family:'Space Grotesk',sans-serif;font-size:clamp(2rem,5vw,3.6rem);font-weight:900;line-height:1.05;letter-spacing:-0.02em;margin:0 0 16px;color:#f1ece4;}
.sv-hero-h1 b{color:oklch(0.72 0.19 28);}
.sv-hero-sub{font-size:1.05rem;color:#a8a59d;line-height:1.6;max-width:560px;margin:0 0 36px;}
.sv-city-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.sv-city-label{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#6c6a64;white-space:nowrap;}
.sv-city-select{appearance:none;background:#14171d;border:1px solid #2f3540;color:#f1ece4;font-size:14px;font-weight:600;padding:10px 40px 10px 14px;border-radius:12px;cursor:pointer;min-width:240px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a8a59d' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;transition:border-color .15s;}
.sv-city-select:focus{outline:none;border-color:oklch(0.72 0.19 28);}
.sv-city-link{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:oklch(0.72 0.19 28);text-decoration:none;padding:10px 16px;border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 30%,transparent);border-radius:999px;transition:all .15s;white-space:nowrap;}
.sv-city-link:hover{background:color-mix(in srgb,oklch(0.72 0.19 28) 10%,transparent);}

/* services section */
.sv-section{padding:72px 0;border-bottom:1px solid #23272f;}
.sv-sh{margin-bottom:40px;}
.sv-sh-title{font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(1.4rem,2.8vw,2rem);color:#f1ece4;margin:0 0 8px;letter-spacing:-0.01em;}
.sv-sh-sub{font-size:.95rem;color:#a8a59d;line-height:1.55;margin:0;max-width:600px;}
.sv-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;}
.sv-card{background:color-mix(in srgb,oklch(0.72 0.19 28) 5%,#101217);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 15%,#23272f);padding:20px 16px;display:flex;flex-direction:column;gap:12px;transition:border-color .15s,background .15s,transform .15s;}
.sv-card:hover{border-color:color-mix(in srgb,oklch(0.72 0.19 28) 40%,#23272f);background:color-mix(in srgb,oklch(0.72 0.19 28) 9%,#101217);transform:translateY(-2px);}
.sv-icon{width:44px;height:44px;background:color-mix(in srgb,oklch(0.72 0.19 28) 14%,transparent);border:1px solid color-mix(in srgb,oklch(0.72 0.19 28) 22%,transparent);display:flex;align-items:center;justify-content:center;color:oklch(0.72 0.19 28);border-radius:10px;flex-shrink:0;}
.sv-card-name{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:14px;color:#f1ece4;line-height:1.2;}
.sv-card-desc{font-size:12px;color:#a8a59d;line-height:1.45;flex:1;}
.sv-req-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 14px;border-radius:999px;font-size:12px;font-weight:800;font-family:'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;background:oklch(0.72 0.19 28);color:#0a0b0d;border:none;cursor:pointer;transition:all .15s;text-decoration:none;width:100%;margin-top:auto;}
.sv-req-btn:hover{filter:brightness(1.1);transform:translateY(-1px);}

/* contact form */
.sv-form-section{padding:72px 0;}
.sv-form-wrap{max-width:680px;margin:0 auto;}
.sv-form-head{text-align:center;margin-bottom:40px;}
.sv-form-title{font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(1.5rem,3vw,2.2rem);color:#f1ece4;margin:0 0 10px;letter-spacing:-0.01em;}
.sv-form-sub{font-size:.95rem;color:#a8a59d;line-height:1.6;margin:0;}
.sv-form{background:#101217;border:1px solid #23272f;padding:36px;display:flex;flex-direction:column;gap:20px;border-radius:12px;}
.sv-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.sv-field{display:flex;flex-direction:column;gap:6px;}
.sv-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#6c6a64;font-weight:700;}
.sv-input,.sv-select,.sv-textarea{width:100%;background:#14171d;border:1px solid #2f3540;color:#f1ece4;font-size:14px;padding:11px 14px;border-radius:10px;transition:border-color .15s;font-family:inherit;}
.sv-input::placeholder,.sv-textarea::placeholder{color:#6c6a64;}
.sv-input:focus,.sv-select:focus,.sv-textarea:focus{outline:none;border-color:oklch(0.72 0.19 28);}
.sv-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a8a59d' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;cursor:pointer;}
.sv-textarea{min-height:110px;resize:vertical;line-height:1.5;}
.sv-submit{display:flex;align-items:center;justify-content:center;gap:8px;padding:15px 28px;border-radius:999px;font-size:14px;font-weight:800;font-family:'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;background:oklch(0.72 0.19 28);color:#0a0b0d;border:none;cursor:pointer;transition:all .15s;width:100%;}
.sv-submit:hover:not(:disabled){filter:brightness(1.1);box-shadow:0 10px 28px color-mix(in srgb,oklch(0.72 0.19 28) 30%,transparent);}
.sv-submit:disabled{opacity:.6;cursor:not-allowed;}
.sv-success{text-align:center;padding:48px 24px;display:flex;flex-direction:column;align-items:center;gap:14px;}
.sv-success-icon{width:56px;height:56px;background:color-mix(in srgb,#22c55e 12%,transparent);border:1px solid color-mix(in srgb,#22c55e 25%,transparent);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#22c55e;}
.sv-success-title{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:1.3rem;color:#f1ece4;margin:0;}
.sv-success-body{font-size:.9rem;color:#a8a59d;max-width:360px;line-height:1.5;margin:0;}
.sv-err{font-size:12px;color:#ef4444;margin-top:4px;}

/* responsive */
@media(max-width:1024px){.sv-grid{grid-template-columns:repeat(4,1fr);}}
@media(max-width:860px){.sv-grid{grid-template-columns:repeat(3,1fr);}}
@media(max-width:640px){
  .sv-grid{grid-template-columns:repeat(2,1fr);}
  .sv-row{grid-template-columns:1fr;}
  .sv-form{padding:24px 16px;}
  .sv-hero{padding:80px 0 52px;}
}
@media(max-width:400px){.sv-grid{grid-template-columns:1fr;}}
`;

/* ── Inner component (reads searchParams) ── */
function ServicesInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);

  const initialCity = searchParams.get("city") || "";
  const initialService = searchParams.get("service") || "";

  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [formService, setFormService] = useState(initialService);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const cityLabel = CITIES.find((c) => c.slug === selectedCity)?.name || "";

  function handleCityChange(slug: string) {
    setSelectedCity(slug);
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("city", slug); else params.delete("city");
    router.replace(`/services?${params.toString()}`, { scroll: false });
  }

  function requestService(slug: string) {
    setFormService(slug);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const serviceLabel = SERVICES.find((s) => s.slug === formService)?.title || formService;
    const body = [
      serviceLabel ? `Service: ${serviceLabel}` : null,
      cityLabel ? `City: ${cityLabel}` : null,
      form.phone ? `Phone: ${form.phone}` : null,
      "",
      form.message,
    ]
      .filter((l) => l !== null)
      .join("\n");
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, message: body }),
      });
      if (!res.ok) throw new Error("failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please email us directly at hello@matchwatch.us");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sv-page">
      {/* Hero */}
      <section className="sv-hero">
        <div className="sv-hero-inner">
          <div className="sv-kicker">
            <span className="bd" />
            FIFA World Cup 2026 · Event Services
          </div>
          <h1 className="sv-hero-h1">
            Everything You Need for a<br />
            <b>World Cup Watch Party</b>
          </h1>
          <p className="sv-hero-sub">
            Connect with professional vendors for DJ, photography, LED screens, catering,
            digital marketing, AI reservations, and more — in all 11 US host cities.
          </p>

          <div className="sv-city-row">
            <span className="sv-city-label">
              <MapPin size={12} style={{ display: "inline", marginRight: 4 }} />
              Your city
            </span>
            <select
              className="sv-city-select"
              value={selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
            >
              <option value="">Select a host city…</option>
              {CITIES.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
            {selectedCity && (
              <Link href={`/world-cup/${selectedCity}`} className="sv-city-link">
                View {cityLabel} matches
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Services grid */}
      <section className="sv-section">
        <div className="sv-wrap">
          <div className="sv-sh">
            <h2 className="sv-sh-title">Watch Party Services</h2>
            <p className="sv-sh-sub">
              Click &ldquo;Request Service&rdquo; on any card to send us an inquiry — we&apos;ll connect you with a vendor in your city within 24 hours.
            </p>
          </div>
          <div className="sv-grid">
            {SERVICES.map((svc) => {
              const Icon = svc.icon;
              return (
                <div key={svc.slug} className="sv-card">
                  <div className="sv-icon">
                    <Icon size={20} />
                  </div>
                  <div className="sv-card-name">{svc.title}</div>
                  <div className="sv-card-desc">{svc.description}</div>
                  <button
                    type="button"
                    className="sv-req-btn"
                    onClick={() => requestService(svc.slug)}
                  >
                    Request Service
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section className="sv-form-section" ref={formRef}>
        <div className="sv-wrap">
          <div className="sv-form-wrap">
            <div className="sv-form-head">
              <h2 className="sv-form-title">Get in Touch</h2>
              <p className="sv-form-sub">
                Tell us what you need and which city you&apos;re in. We&apos;ll match you with the right vendor within 24 hours.
              </p>
            </div>

            {submitted ? (
              <div className="sv-success">
                <div className="sv-success-icon">
                  <Check size={26} />
                </div>
                <p className="sv-success-title">Request received!</p>
                <p className="sv-success-body">
                  We&apos;ll be in touch within 24 hours to connect you with the right vendor.
                </p>
                <Link href="/venues" className="sv-req-btn" style={{ width: "auto", padding: "11px 24px" }}>
                  Browse venues
                </Link>
              </div>
            ) : (
              <form className="sv-form" onSubmit={handleSubmit}>
                <div className="sv-row">
                  <div className="sv-field">
                    <label className="sv-label">Your name *</label>
                    <input
                      className="sv-input"
                      placeholder="Jane Smith"
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="sv-field">
                    <label className="sv-label">Email *</label>
                    <input
                      className="sv-input"
                      type="email"
                      placeholder="jane@venue.com"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="sv-row">
                  <div className="sv-field">
                    <label className="sv-label">Phone</label>
                    <input
                      className="sv-input"
                      type="tel"
                      placeholder="+1 (713) 000-0000"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <div className="sv-field">
                    <label className="sv-label">City</label>
                    <select
                      className="sv-select sv-input"
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                    >
                      <option value="">Select a host city…</option>
                      {CITIES.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="sv-field">
                  <label className="sv-label">Service needed</label>
                  <select
                    className="sv-select sv-input"
                    value={formService}
                    onChange={(e) => setFormService(e.target.value)}
                  >
                    <option value="">Select a service…</option>
                    {SERVICES.map((s) => (
                      <option key={s.slug} value={s.slug}>{s.title}</option>
                    ))}
                  </select>
                </div>

                <div className="sv-field">
                  <label className="sv-label">Tell us about your event *</label>
                  <textarea
                    className="sv-textarea"
                    placeholder="Venue name, expected attendance, event dates, specific requirements…"
                    required
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </div>

                {error && <p className="sv-err">{error}</p>}

                <button type="submit" className="sv-submit" disabled={submitting}>
                  <Send size={15} />
                  {submitting ? "Sending…" : "Send Request"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Page (wraps in Suspense for useSearchParams) ── */
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
