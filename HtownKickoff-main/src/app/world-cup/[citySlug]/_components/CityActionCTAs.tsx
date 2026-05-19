"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Building2, Music, Camera, Megaphone,
  ArrowRight, Send, Check, X, Users, Zap,
} from "lucide-react";

interface Props {
  citySlug: string;
  cityName: string;
}

const COMPANY_TYPES = [
  "Oil & Gas", "Medical / Healthcare", "Tech / Software", "Finance / Banking",
  "Legal", "Real Estate", "Manufacturing", "Retail", "Education", "Government", "Other",
];
const CAPACITY_OPTIONS = ["Under 50", "50 – 100", "100 – 250", "250 – 500", "500+"];
const TIME_OPTIONS = [
  "Match Kickoff (follows schedule)",
  "Morning — before noon",
  "Afternoon — 12:00 to 5:00 pm",
  "Evening — after 5:00 pm",
];

const QUICK_SERVICES = [
  { slug: "dj-entertainment",  label: "DJ & Entertainment",   icon: Music },
  { slug: "photography-video", label: "Photography & Video",  icon: Camera },
  { slug: "digital-marketing", label: "Digital Marketing",    icon: Megaphone },
];

const CSS = `
/* ── Three-CTA wrapper ── */
.cac-wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; width: 100%; }

/* ── Section 1: Venue Activation ── */
.cac-venue { padding: 72px 0; border-bottom: 1px solid var(--mw-line); background: var(--mw-bg-1); }
.cac-venue-inner { display: grid; grid-template-columns: 1fr 340px; gap: 48px; align-items: center; }
.cac-badge { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--mw-accent); border: 1px solid color-mix(in srgb, var(--mw-accent) 30%, transparent); padding: 4px 10px; border-radius: 999px; margin-bottom: 16px; width: fit-content; }
.cac-h2 { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: clamp(1.4rem, 2.6vw, 2rem); color: var(--mw-fg); margin: 0 0 10px; letter-spacing: -0.01em; line-height: 1.1; }
.cac-body { font-size: .93rem; color: var(--mw-fg-dim); line-height: 1.6; margin: 0 0 24px; max-width: 480px; }
.cac-btns { display: flex; gap: 10px; flex-wrap: wrap; }
.cac-btn-p { display: inline-flex; align-items: center; gap: 7px; padding: 12px 22px; border-radius: 999px; font-size: 13px; font-weight: 800; text-decoration: none; background: var(--mw-accent); color: #0a0b0d; transition: all .18s; border: none; cursor: pointer; font-family: inherit; }
.cac-btn-p:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 8px 24px color-mix(in srgb, var(--mw-accent) 30%, transparent); }
.cac-btn-g { display: inline-flex; align-items: center; gap: 7px; padding: 12px 22px; border-radius: 999px; font-size: 13px; font-weight: 700; text-decoration: none; border: 1px solid var(--mw-line-2); color: var(--mw-fg-dim); transition: all .18s; background: transparent; cursor: pointer; font-family: inherit; }
.cac-btn-g:hover { border-color: var(--mw-fg); color: var(--mw-fg); }
.cac-venue-card { background: var(--mw-bg-2); border: 1px solid var(--mw-line); border-left: 3px solid var(--mw-accent); padding: 24px; border-radius: 12px; }
.cac-venue-card-title { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 15px; color: var(--mw-fg); margin: 0 0 12px; }
.cac-checklist { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.cac-checklist li { font-size: 13px; color: var(--mw-fg-dim); display: flex; align-items: flex-start; gap: 8px; }
.cac-checklist li::before { content: "✓"; color: #22c55e; font-weight: 800; font-size: 12px; flex-shrink: 0; margin-top: 1px; }

/* ── Section 2: Quick Services ── */
.cac-services { padding: 72px 0; border-bottom: 1px solid var(--mw-line); }
.cac-services-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
.cac-services-title { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: clamp(1.2rem, 2.4vw, 1.7rem); color: var(--mw-fg); margin: 0 0 6px; }
.cac-services-sub { font-size: .9rem; color: var(--mw-fg-dim); margin: 0; }
.cac-see-all { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mw-accent); text-decoration: none; transition: gap .15s; white-space: nowrap; }
.cac-see-all:hover { gap: 10px; }
.cac-svc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.cac-svc-card { background: var(--mw-bg-1); border: 1px solid var(--mw-line); padding: 22px; display: flex; align-items: center; gap: 16px; border-radius: 12px; text-decoration: none; transition: border-color .15s, background .15s, transform .15s; }
.cac-svc-card:hover { border-color: color-mix(in srgb, var(--mw-accent) 40%, transparent); background: var(--mw-bg-2); transform: translateY(-2px); }
.cac-svc-icon { width: 44px; height: 44px; background: color-mix(in srgb, var(--mw-accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--mw-accent) 22%, transparent); display: flex; align-items: center; justify-content: center; color: var(--mw-accent); border-radius: 10px; flex-shrink: 0; }
.cac-svc-label { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; color: var(--mw-fg); margin: 0 0 3px; }
.cac-svc-hint { font-size: 12px; color: var(--mw-fg-mute); }

/* ── Section 3: Corporate Group ── */
.cac-corp { padding: 72px 0; background: linear-gradient(160deg, #0a0b0d 0%, #0d1520 50%, #1a0a05 100%); }
.cac-corp-inner { text-align: center; max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.cac-corp-badge { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: oklch(0.72 0.19 28); border: 1px solid color-mix(in srgb, oklch(0.72 0.19 28) 30%, transparent); padding: 4px 10px; border-radius: 999px; }
.cac-corp-h2 { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: clamp(1.4rem, 2.8vw, 2.1rem); color: #f1ece4; margin: 0; letter-spacing: -0.02em; line-height: 1.1; }
.cac-corp-sub { font-size: .95rem; color: #a8a59d; line-height: 1.6; margin: 0; max-width: 480px; }
.cac-corp-tags { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; }
.cac-corp-tag { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 11px; border: 1px solid rgba(255,255,255,.12); color: rgba(255,255,255,.55); border-radius: 999px; }
.cac-corp-btn { display: inline-flex; align-items: center; gap: 10px; padding: 15px 36px; border-radius: 999px; font-size: 14px; font-weight: 800; font-family: 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; background: oklch(0.72 0.19 28); color: #0a0b0d; border: none; cursor: pointer; transition: all .18s; margin-top: 4px; }
.cac-corp-btn:hover { filter: brightness(1.12); box-shadow: 0 12px 32px color-mix(in srgb, oklch(0.72 0.19 28) 32%, transparent); transform: translateY(-2px); }

/* ── Modal ── */
.cac-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.75); z-index: 1100; display: flex; align-items: flex-end; justify-content: flex-end; backdrop-filter: blur(4px); animation: cac-fi .18s ease; }
@keyframes cac-fi { from { opacity: 0; } to { opacity: 1; } }
.cac-modal { position: relative; width: 100%; max-width: 560px; max-height: 92vh; background: #101217; border: 1px solid #2f3540; border-radius: 20px 20px 0 0; overflow-y: auto; display: flex; flex-direction: column; animation: cac-su .22s cubic-bezier(.25,.8,.25,1); }
@keyframes cac-su { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@media (min-width: 640px) { .cac-overlay { align-items: center; padding: 24px; } .cac-modal { border-radius: 20px; max-height: 88vh; } }
.cac-mhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 24px 24px 0; flex-shrink: 0; }
.cac-mtitle { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 1.1rem; color: #f1ece4; margin: 0 0 4px; }
.cac-msub { font-size: .82rem; color: #a8a59d; margin: 0; line-height: 1.45; }
.cac-mclose { width: 36px; height: 36px; background: #14171d; border: 1px solid #2f3540; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #a8a59d; cursor: pointer; flex-shrink: 0; transition: all .12s; }
.cac-mclose:hover { border-color: #f1ece4; color: #f1ece4; }
.cac-mbody { padding: 20px 24px 28px; flex: 1; }

/* ── Form inside modal ── */
.cac-form { display: flex; flex-direction: column; gap: 14px; }
.cac-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cac-field { display: flex; flex-direction: column; gap: 5px; }
.cac-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #6c6a64; font-weight: 700; }
.cac-input, .cac-select, .cac-textarea { width: 100%; background: #14171d; border: 1px solid #2f3540; color: #f1ece4; font-size: 14px; padding: 10px 13px; border-radius: 10px; transition: border-color .15s; font-family: inherit; }
.cac-input::placeholder, .cac-textarea::placeholder { color: #6c6a64; }
.cac-input:focus, .cac-select:focus, .cac-textarea:focus { outline: none; border-color: oklch(0.72 0.19 28); }
.cac-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a8a59d' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 13px center; cursor: pointer; padding-right: 36px; }
.cac-textarea { min-height: 80px; resize: vertical; line-height: 1.5; }
.cac-submit { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 24px; border-radius: 999px; font-size: 13px; font-weight: 800; font-family: 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; background: oklch(0.72 0.19 28); color: #0a0b0d; border: none; cursor: pointer; transition: all .15s; width: 100%; }
.cac-submit:hover:not(:disabled) { filter: brightness(1.1); box-shadow: 0 8px 24px color-mix(in srgb, oklch(0.72 0.19 28) 30%, transparent); }
.cac-submit:disabled { opacity: .6; cursor: not-allowed; }
.cac-err { font-size: 12px; color: #ef4444; }
.cac-success { text-align: center; padding: 40px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.cac-success-icon { width: 52px; height: 52px; background: color-mix(in srgb, #22c55e 12%, transparent); border: 1px solid color-mix(in srgb, #22c55e 25%, transparent); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #22c55e; }
.cac-success-title { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 1.1rem; color: #f1ece4; margin: 0; }
.cac-success-body { font-size: .85rem; color: #a8a59d; max-width: 300px; line-height: 1.5; margin: 0; }

/* ── Responsive ── */
@media (max-width: 900px) {
  .cac-venue-inner { grid-template-columns: 1fr; }
  .cac-svc-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .cac-venue, .cac-services, .cac-corp { padding: 52px 0; }
  .cac-row { grid-template-columns: 1fr; }
  .cac-mhead, .cac-mbody { padding-left: 16px; padding-right: 16px; }
  .cac-svc-grid { grid-template-columns: 1fr 1fr; }
}
`;

function CorpModal({ cityName, citySlug, onClose }: { cityName: string; citySlug: string; onClose: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    name: "", company: "", companyType: "", email: "", phone: "",
    capacity: "", matchDate: "", timePreference: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const topic = `Corporate Watch Party — ${form.companyType || "Company"} — ${cityName}`;
    const lines = [
      `Company: ${form.company}`,
      `Industry: ${form.companyType}`,
      `City: ${cityName}`,
      `Capacity: ${form.capacity}`,
      form.matchDate ? `Preferred Date: ${form.matchDate}` : null,
      form.timePreference ? `Preferred Time: ${form.timePreference}` : null,
      form.phone ? `Phone: ${form.phone}` : null,
      "",
      form.notes || "(no additional notes)",
    ].filter((l) => l !== null).join("\n");
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, topic, message: lines }),
      });
      if (!res.ok) throw new Error("failed");
      setSubmitted(true);
    } catch { setError("Something went wrong — please try again."); }
    finally { setSubmitting(false); }
  }

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="cac-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cac-modal" role="dialog" aria-modal="true">
        <div className="cac-mhead">
          <div>
            <p className="cac-mtitle">Corporate Watch Party Request — {cityName}</p>
            <p className="cac-msub">We&apos;ll respond within 24 hours with venue options and pricing.</p>
          </div>
          <button type="button" className="cac-mclose" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="cac-mbody">
          {submitted ? (
            <div className="cac-success">
              <div className="cac-success-icon"><Check size={24} /></div>
              <p className="cac-success-title">Request received!</p>
              <p className="cac-success-body">We&apos;ll be in touch within 24 hours with venue options and pricing for your group.</p>
              <button type="button" className="cac-submit" style={{ width: "auto", padding: "11px 28px" }} onClick={onClose}>Close</button>
            </div>
          ) : (
            <form className="cac-form" onSubmit={handleSubmit}>
              <div className="cac-row">
                <div className="cac-field">
                  <label className="cac-label">Contact name *</label>
                  <input className="cac-input" placeholder="John Smith" required value={form.name} onChange={f("name")} />
                </div>
                <div className="cac-field">
                  <label className="cac-label">Company name *</label>
                  <input className="cac-input" placeholder="Acme Corp" required value={form.company} onChange={f("company")} />
                </div>
              </div>
              <div className="cac-row">
                <div className="cac-field">
                  <label className="cac-label">Industry *</label>
                  <select className="cac-select" required value={form.companyType} onChange={f("companyType")}>
                    <option value="">Select industry…</option>
                    {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="cac-field">
                  <label className="cac-label">Expected capacity *</label>
                  <select className="cac-select" required value={form.capacity} onChange={f("capacity")}>
                    <option value="">Number of guests…</option>
                    {CAPACITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="cac-row">
                <div className="cac-field">
                  <label className="cac-label">Email *</label>
                  <input className="cac-input" type="email" placeholder="john@company.com" required value={form.email} onChange={f("email")} />
                </div>
                <div className="cac-field">
                  <label className="cac-label">Phone</label>
                  <input className="cac-input" type="tel" placeholder="+1 (713) 000-0000" value={form.phone} onChange={f("phone")} />
                </div>
              </div>
              <div className="cac-row">
                <div className="cac-field">
                  <label className="cac-label">Preferred match date</label>
                  <input className="cac-input" type="date" min={today} value={form.matchDate} onChange={f("matchDate")} />
                </div>
                <div className="cac-field">
                  <label className="cac-label">Preferred time</label>
                  <select className="cac-select" value={form.timePreference} onChange={f("timePreference")}>
                    <option value="">Select time…</option>
                    {TIME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="cac-field">
                <label className="cac-label">Additional notes</label>
                <textarea className="cac-textarea" placeholder="Budget range, catering needs, AV requirements, match preferences…" value={form.notes} onChange={f("notes")} />
              </div>
              {error && <p className="cac-err">{error}</p>}
              <button type="submit" className="cac-submit" disabled={submitting}>
                <Send size={14} />{submitting ? "Sending…" : "Request Corporate Package"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function CityActionCTAs({ citySlug, cityName }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── Section 1: Activate Your Venue ── */}
      <section className="cac-venue">
        <div className="cac-wrap">
          <div className="cac-venue-inner">
            <div>
              <div className="cac-badge"><Building2 size={11} /> For Venue Owners</div>
              <h2 className="cac-h2">Activate Your {cityName} Venue<br />for World Cup Watch Parties</h2>
              <p className="cac-body">
                Get your bar, restaurant, or event space listed on MatchWatch and start receiving World Cup 2026
                booking requests from fans searching for {cityName} watch parties.
              </p>
              <div className="cac-btns">
                <Link href="/for-venues/register" className="cac-btn-p">
                  <Building2 size={14} /> List Your Venue
                </Link>
                <Link href={`/services?city=${citySlug}`} className="cac-btn-g">
                  View Watch Party Packages
                </Link>
              </div>
            </div>
            <div className="cac-venue-card">
              <div className="cac-venue-card-title">What you get</div>
              <ul className="cac-checklist">
                <li>Listed on the {cityName} World Cup page</li>
                <li>Booking requests directly to your inbox</li>
                <li>Featured in map and venue search</li>
                <li>Access to DJ, photo & marketing services</li>
                <li>World Cup match schedule on your profile</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Quick Services ── */}
      <section className="cac-services">
        <div className="cac-wrap">
          <div className="cac-services-head">
            <div>
              <div className="cac-badge"><Zap size={11} /> Quick Services</div>
              <h2 className="cac-services-title">Enhance Your {cityName} Watch Party</h2>
              <p className="cac-services-sub">Book professional services to make your event stand out.</p>
            </div>
            <Link href={`/services?city=${citySlug}`} className="cac-see-all">
              All services <ArrowRight size={12} />
            </Link>
          </div>
          <div className="cac-svc-grid">
            {QUICK_SERVICES.map(({ slug, label, icon: Icon }) => (
              <Link key={slug} href={`/services?service=${slug}&city=${citySlug}`} className="cac-svc-card">
                <div className="cac-svc-icon"><Icon size={20} /></div>
                <div>
                  <div className="cac-svc-label">{label}</div>
                  <div className="cac-svc-hint">Request via contact form →</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Corporate & Group ── */}
      <section className="cac-corp">
        <div className="cac-wrap">
          <div className="cac-corp-inner">
            <div className="cac-corp-badge"><Users size={11} /> Corporate &amp; Group Events</div>
            <h2 className="cac-corp-h2">Plan a Corporate Watch Party<br />in {cityName}</h2>
            <p className="cac-corp-sub">
              Private group bookings for companies, employee events, and client entertainment.
              We handle venue sourcing, AV, catering, and full logistics for 20 to 500+ guests.
            </p>
            <div className="cac-corp-tags">
              {["Oil & Gas", "Medical", "Tech", "Finance", "Legal", "Manufacturing", "Government"].map((t) => (
                <span key={t} className="cac-corp-tag">{t}</span>
              ))}
            </div>
            <button type="button" className="cac-corp-btn" onClick={() => setModalOpen(true)}>
              <Users size={17} /> Request Corporate Package
            </button>
          </div>
        </div>
      </section>

      {modalOpen && (
        <CorpModal cityName={cityName} citySlug={citySlug} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
