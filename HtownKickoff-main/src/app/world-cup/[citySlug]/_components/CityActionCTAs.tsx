"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Building2, Users, Send, Check, X, Music, Camera, Trophy, Bot, QrCode } from "lucide-react";

interface Props {
  citySlug: string;
  cityName: string;
}

const SERVICES = [
  { slug: "dj-entertainment",  label: "DJ & Entertainment",         Icon: Music },
  { slug: "photography-video", label: "Photography & Video",        Icon: Camera },
  { slug: "watchparty-listing",label: "World Cup Watch Party Page", Icon: Trophy },
  { slug: "ai-receptionist",   label: "AI Receptionist / CRM",      Icon: Bot },
  { slug: "qr-campaigns",      label: "QR Code Campaigns",          Icon: QrCode },
];

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

const CSS = `
/* ── Quick Service Request ── */
.cac-qs { padding: 56px 0; border-top: 1px solid var(--mw-line); }
.cac-qs-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: flex-start; }
.cac-qs-left {}
.cac-qs-badge { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--mw-accent); border: 1px solid color-mix(in srgb, var(--mw-accent) 28%, transparent); padding: 3px 10px; border-radius: 999px; margin-bottom: 14px; }
.cac-qs-title { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: clamp(1.1rem, 2vw, 1.4rem); color: var(--mw-fg); margin: 0 0 8px; letter-spacing: -0.01em; }
.cac-qs-sub { font-size: .88rem; color: var(--mw-fg-dim); line-height: 1.55; margin: 0 0 20px; }
.cac-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.cac-pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid var(--mw-line-2); background: var(--mw-bg-2); color: var(--mw-fg-dim); cursor: pointer; transition: all .14s; font-family: inherit; }
.cac-pill:hover { border-color: var(--mw-accent); color: var(--mw-fg); }
.cac-pill.on { border-color: var(--mw-accent); background: color-mix(in srgb, var(--mw-accent) 12%, var(--mw-bg-2)); color: var(--mw-accent); font-weight: 700; }
.cac-pill-icon { opacity: .65; }
.cac-pill.on .cac-pill-icon { opacity: 1; }
.cac-qs-form { display: flex; flex-direction: column; gap: 12px; background: var(--mw-bg-1); border: 1px solid var(--mw-line); padding: 24px; border-radius: 14px; }
.cac-qs-hint { font-size: .8rem; color: var(--mw-fg-mute); margin: 0; line-height: 1.45; }
.cac-qs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cac-qs-field { display: flex; flex-direction: column; gap: 5px; }
.cac-qs-lbl { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mw-fg-mute); font-weight: 700; }
.cac-qs-inp, .cac-qs-ta { width: 100%; background: var(--mw-bg-2); border: 1px solid var(--mw-line-2); color: var(--mw-fg); font-size: 13px; padding: 9px 12px; border-radius: 9px; transition: border-color .14s; font-family: inherit; }
.cac-qs-inp::placeholder, .cac-qs-ta::placeholder { color: var(--mw-fg-mute); }
.cac-qs-inp:focus, .cac-qs-ta:focus { outline: none; border-color: var(--mw-accent); }
.cac-qs-ta { min-height: 72px; resize: vertical; line-height: 1.5; }
.cac-qs-submit { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 20px; border-radius: 999px; font-size: 12px; font-weight: 800; font-family: 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; background: var(--mw-accent); color: #0a0b0d; border: none; cursor: pointer; transition: all .15s; width: 100%; }
.cac-qs-submit:hover:not(:disabled) { filter: brightness(1.1); box-shadow: 0 8px 20px color-mix(in srgb, var(--mw-accent) 28%, transparent); }
.cac-qs-submit:disabled { opacity: .6; cursor: not-allowed; }
.cac-qs-ok { display: flex; align-items: center; gap: 10px; padding: 16px; background: color-mix(in srgb, #22c55e 8%, var(--mw-bg-1)); border: 1px solid color-mix(in srgb, #22c55e 22%, transparent); border-radius: 10px; }
.cac-qs-ok-icon { width: 36px; height: 36px; background: color-mix(in srgb, #22c55e 14%, transparent); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #22c55e; flex-shrink: 0; }
.cac-qs-ok-title { font-weight: 700; font-size: .9rem; color: var(--mw-fg); margin: 0 0 2px; font-family: 'Space Grotesk', sans-serif; }
.cac-qs-ok-body { font-size: .8rem; color: var(--mw-fg-dim); margin: 0; }
.cac-qs-err { font-size: 12px; color: #ef4444; }

/* ── Split section ── */
.cac-section { padding: 72px 0; background: var(--mw-bg-1); border-top: 1px solid var(--mw-line); }
.cac-wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; width: 100%; }
.cac-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--mw-fg-mute); text-align: center; margin-bottom: 24px; }
.cac-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

/* cards */
.cac-card { padding: 32px; border-radius: 16px; display: flex; flex-direction: column; gap: 16px; }
.cac-card-venue { background: var(--mw-bg-2); border: 1px solid var(--mw-line); }
.cac-card-corp { background: linear-gradient(145deg, #0d1520 0%, #1a0a05 100%); border: 1px solid color-mix(in srgb, oklch(0.72 0.19 28) 30%, transparent); position: relative; overflow: hidden; }
.cac-card-corp::before { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse 80% 60% at 100% 0%, color-mix(in srgb, oklch(0.72 0.19 28) 8%, transparent), transparent 70%); pointer-events: none; }

/* card top */
.cac-card-top { display: flex; align-items: flex-start; gap: 14px; position: relative; z-index: 1; }
.cac-card-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cac-card-venue .cac-card-icon { background: color-mix(in srgb, var(--mw-accent) 10%, transparent); color: var(--mw-accent); border: 1px solid color-mix(in srgb, var(--mw-accent) 20%, transparent); }
.cac-card-corp .cac-card-icon { background: color-mix(in srgb, oklch(0.72 0.19 28) 14%, transparent); color: oklch(0.72 0.19 28); border: 1px solid color-mix(in srgb, oklch(0.72 0.19 28) 28%, transparent); }
.cac-card-hed { display: flex; flex-direction: column; gap: 4px; }
.cac-card-title { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: clamp(1.05rem, 2vw, 1.25rem); letter-spacing: -0.01em; line-height: 1.15; }
.cac-card-venue .cac-card-title { color: var(--mw-fg); }
.cac-card-corp .cac-card-title { color: #f1ece4; }
.cac-card-for { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
.cac-card-venue .cac-card-for { color: var(--mw-fg-mute); }
.cac-card-corp .cac-card-for { color: color-mix(in srgb, oklch(0.72 0.19 28) 75%, #fff); }

/* card body */
.cac-card-body { font-size: .9rem; line-height: 1.6; position: relative; z-index: 1; }
.cac-card-venue .cac-card-body { color: var(--mw-fg-dim); }
.cac-card-corp .cac-card-body { color: rgba(241,236,228,.72); }

/* tags (corporate) */
.cac-tags { display: flex; flex-wrap: wrap; gap: 6px; position: relative; z-index: 1; }
.cac-tag { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); color: rgba(255,255,255,.48); }

/* checklist (venue) */
.cac-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 7px; }
.cac-list li { font-size: .85rem; color: var(--mw-fg-dim); display: flex; align-items: center; gap: 8px; }
.cac-list li::before { content: "✓"; color: #22c55e; font-weight: 800; font-size: 11px; flex-shrink: 0; }

/* CTAs */
.cac-btn-p { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 24px; border-radius: 999px; font-size: 13px; font-weight: 800; font-family: 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; background: oklch(0.72 0.19 28); color: #0a0b0d; border: none; cursor: pointer; transition: all .18s; text-decoration: none; width: 100%; margin-top: auto; position: relative; z-index: 1; }
.cac-btn-p:hover { filter: brightness(1.1); box-shadow: 0 10px 28px color-mix(in srgb, oklch(0.72 0.19 28) 30%, transparent); transform: translateY(-1px); }
.cac-btn-g { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 24px; border-radius: 999px; font-size: 13px; font-weight: 800; font-family: 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; background: transparent; color: var(--mw-fg); border: 1.5px solid var(--mw-line-2); cursor: pointer; transition: all .18s; text-decoration: none; width: 100%; margin-top: auto; }
.cac-btn-g:hover { border-color: var(--mw-fg); color: var(--mw-fg); }

/* ── Modal ── */
.cac-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.75); z-index: 1100; display: flex; align-items: flex-end; justify-content: center; backdrop-filter: blur(4px); animation: cac-fi .18s ease; }
@keyframes cac-fi { from { opacity: 0; } to { opacity: 1; } }
.cac-modal { width: 100%; max-width: 560px; max-height: 92vh; background: #101217; border: 1px solid #2f3540; border-radius: 20px 20px 0 0; overflow-y: auto; display: flex; flex-direction: column; animation: cac-su .22s cubic-bezier(.25,.8,.25,1); }
@keyframes cac-su { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@media (min-width: 640px) { .cac-overlay { align-items: center; justify-content: center; padding: 24px; } .cac-modal { border-radius: 20px; max-height: 88vh; } }
.cac-mhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 24px 24px 0; flex-shrink: 0; }
.cac-mtitle { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 1.05rem; color: #f1ece4; margin: 0 0 3px; }
.cac-msub { font-size: .82rem; color: #a8a59d; margin: 0; line-height: 1.45; }
.cac-mclose { width: 36px; height: 36px; background: #14171d; border: 1px solid #2f3540; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #a8a59d; cursor: pointer; flex-shrink: 0; transition: all .12s; }
.cac-mclose:hover { border-color: #f1ece4; color: #f1ece4; }
.cac-mbody { padding: 20px 24px 28px; flex: 1; overflow-y: auto; }
.cac-form { display: flex; flex-direction: column; gap: 14px; }
.cac-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cac-field { display: flex; flex-direction: column; gap: 5px; }
.cac-lbl { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #6c6a64; font-weight: 700; }
.cac-inp, .cac-sel, .cac-ta { width: 100%; background: #14171d; border: 1px solid #2f3540; color: #f1ece4; font-size: 14px; padding: 10px 13px; border-radius: 10px; transition: border-color .15s; font-family: inherit; }
.cac-inp::placeholder, .cac-ta::placeholder { color: #6c6a64; }
.cac-inp:focus, .cac-sel:focus, .cac-ta:focus { outline: none; border-color: oklch(0.72 0.19 28); }
.cac-sel { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a8a59d' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 13px center; cursor: pointer; padding-right: 36px; }
.cac-ta { min-height: 80px; resize: vertical; line-height: 1.5; }
.cac-sub-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 24px; border-radius: 999px; font-size: 13px; font-weight: 800; font-family: 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; background: oklch(0.72 0.19 28); color: #0a0b0d; border: none; cursor: pointer; transition: all .15s; width: 100%; }
.cac-sub-btn:hover:not(:disabled) { filter: brightness(1.1); box-shadow: 0 8px 24px color-mix(in srgb, oklch(0.72 0.19 28) 30%, transparent); }
.cac-sub-btn:disabled { opacity: .6; cursor: not-allowed; }
.cac-err { font-size: 12px; color: #ef4444; }
.cac-ok { text-align: center; padding: 40px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.cac-ok-icon { width: 52px; height: 52px; background: color-mix(in srgb, #22c55e 12%, transparent); border: 1px solid color-mix(in srgb, #22c55e 25%, transparent); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #22c55e; }
.cac-ok-title { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 1.1rem; color: #f1ece4; margin: 0; }
.cac-ok-body { font-size: .85rem; color: #a8a59d; max-width: 300px; line-height: 1.5; margin: 0; }

/* responsive */
@media (max-width: 860px) { .cac-qs-inner { grid-template-columns: 1fr; } }
@media (max-width: 720px) { .cac-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .cac-section { padding: 52px 0; } .cac-card { padding: 24px; } .cac-row { grid-template-columns: 1fr; } .cac-mhead, .cac-mbody { padding-left: 16px; padding-right: 16px; } .cac-qs-row { grid-template-columns: 1fr; } }
`;

function QuickServiceRequest({ cityName }: { cityName: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", email: "", phone: "", website: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSubmitting(true);
    const labels = SERVICES.filter((s) => selected.has(s.slug)).map((s) => s.label).join(", ");
    const topic = labels || "Venue Service Inquiry";
    const body = [
      `City: ${cityName}`,
      `Phone: ${form.phone}`,
      form.website ? `Website: ${form.website}` : null,
      "", form.message,
    ].filter(Boolean).join("\n");
    try {
      const r = await fetch("/api/v1/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, topic, message: body }) });
      if (!r.ok) throw new Error();
      setSubmitted(true);
    } catch { setError("Something went wrong — please try again."); }
    finally { setSubmitting(false); }
  }

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <section className="cac-qs">
      <div className="cac-wrap">
        <div className="cac-qs-inner">
          {/* Left: service selector */}
          <div className="cac-qs-left">
            <div className="cac-qs-badge">For bars &amp; restaurants</div>
            <h2 className="cac-qs-title">Quick Service Request</h2>
            <p className="cac-qs-sub">
              Select the services you need for your {cityName} watch party and submit a quick inquiry.
              We&apos;ll connect you with the right vendor within 24 hours.
            </p>
            <div className="cac-pills">
              {SERVICES.map(({ slug, label, Icon }) => (
                <button
                  key={slug}
                  type="button"
                  className={`cac-pill${selected.has(slug) ? " on" : ""}`}
                  onClick={() => toggle(slug)}
                >
                  <span className="cac-pill-icon"><Icon size={13} /></span>
                  {selected.has(slug) && <Check size={11} style={{ flexShrink: 0 }} />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: quick form */}
          <div>
            {submitted ? (
              <div className="cac-qs-ok">
                <div className="cac-qs-ok-icon"><Check size={18} /></div>
                <div>
                  <p className="cac-qs-ok-title">Request received!</p>
                  <p className="cac-qs-ok-body">We&apos;ll be in touch within 24 hours to discuss your event.</p>
                </div>
              </div>
            ) : (
              <form className="cac-qs-form" onSubmit={handleSubmit}>
                <p className="cac-qs-hint">
                  {selected.size > 0
                    ? `Selected: ${SERVICES.filter((s) => selected.has(s.slug)).map((s) => s.label).join(", ")}`
                    : "Select one or more services on the left, then fill in your details."}
                </p>
                <div className="cac-qs-row">
                  <div className="cac-qs-field">
                    <label className="cac-qs-lbl">Your name *</label>
                    <input className="cac-qs-inp" placeholder="Jane Smith" required value={form.name} onChange={f("name")} />
                  </div>
                  <div className="cac-qs-field">
                    <label className="cac-qs-lbl">Email *</label>
                    <input className="cac-qs-inp" type="email" placeholder="jane@venue.com" required value={form.email} onChange={f("email")} />
                  </div>
                </div>
                <div className="cac-qs-row">
                  <div className="cac-qs-field">
                    <label className="cac-qs-lbl">Phone *</label>
                    <input className="cac-qs-inp" type="tel" placeholder="+1 (713) 000-0000" required value={form.phone} onChange={f("phone")} />
                  </div>
                  <div className="cac-qs-field">
                    <label className="cac-qs-lbl">Website <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--mw-fg-mute)" }}>(optional)</span></label>
                    <input className="cac-qs-inp" type="url" placeholder="https://myvenue.com" value={form.website} onChange={f("website")} />
                  </div>
                </div>
                <div className="cac-qs-field">
                  <label className="cac-qs-lbl">Brief message</label>
                  <textarea className="cac-qs-ta" placeholder="Venue name, expected attendance, event dates…" value={form.message} onChange={f("message")} />
                </div>
                {error && <p className="cac-qs-err">{error}</p>}
                <button type="submit" className="cac-qs-submit" disabled={submitting}>
                  <Send size={13} />{submitting ? "Sending…" : "Submit Quick Request"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CorpModal({ cityName, onClose }: { cityName: string; onClose: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ name: "", company: "", companyType: "", email: "", phone: "", capacity: "", matchDate: "", timePreference: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSubmitting(true);
    const topic = `Corporate Watch Party — ${form.companyType || "Company"} — ${cityName}`;
    const body = [
      `Company: ${form.company}`, `Industry: ${form.companyType}`, `City: ${cityName}`,
      `Capacity: ${form.capacity}`,
      form.matchDate ? `Preferred Date: ${form.matchDate}` : null,
      form.timePreference ? `Preferred Time: ${form.timePreference}` : null,
      form.phone ? `Phone: ${form.phone}` : null,
      "", form.notes || "(no additional notes)",
    ].filter(Boolean).join("\n");
    try {
      const r = await fetch("/api/v1/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, topic, message: body }) });
      if (!r.ok) throw new Error();
      setSubmitted(true);
    } catch { setError("Something went wrong — please try again."); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="cac-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cac-modal" role="dialog" aria-modal="true">
        <div className="cac-mhead">
          <div>
            <p className="cac-mtitle">Corporate Watch Party — {cityName}</p>
            <p className="cac-msub">We&apos;ll respond within 24 hours with venue options and pricing.</p>
          </div>
          <button type="button" className="cac-mclose" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="cac-mbody">
          {submitted ? (
            <div className="cac-ok">
              <div className="cac-ok-icon"><Check size={24} /></div>
              <p className="cac-ok-title">Request received!</p>
              <p className="cac-ok-body">We&apos;ll be in touch within 24 hours with options and pricing for your group.</p>
              <button type="button" className="cac-sub-btn" style={{ width: "auto", padding: "11px 28px" }} onClick={onClose}>Close</button>
            </div>
          ) : (
            <form className="cac-form" onSubmit={submit}>
              <div className="cac-row">
                <div className="cac-field"><label className="cac-lbl">Contact name *</label><input className="cac-inp" placeholder="John Smith" required value={form.name} onChange={f("name")} /></div>
                <div className="cac-field"><label className="cac-lbl">Company *</label><input className="cac-inp" placeholder="Acme Corp" required value={form.company} onChange={f("company")} /></div>
              </div>
              <div className="cac-row">
                <div className="cac-field"><label className="cac-lbl">Industry *</label>
                  <select className="cac-sel" required value={form.companyType} onChange={f("companyType")}>
                    <option value="">Select…</option>
                    {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="cac-field"><label className="cac-lbl">Capacity *</label>
                  <select className="cac-sel" required value={form.capacity} onChange={f("capacity")}>
                    <option value="">Guests…</option>
                    {CAPACITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="cac-row">
                <div className="cac-field"><label className="cac-lbl">Email *</label><input className="cac-inp" type="email" placeholder="you@company.com" required value={form.email} onChange={f("email")} /></div>
                <div className="cac-field"><label className="cac-lbl">Phone</label><input className="cac-inp" type="tel" placeholder="+1 (713) 000-0000" value={form.phone} onChange={f("phone")} /></div>
              </div>
              <div className="cac-row">
                <div className="cac-field"><label className="cac-lbl">Preferred date</label><input className="cac-inp" type="date" min={today} value={form.matchDate} onChange={f("matchDate")} /></div>
                <div className="cac-field"><label className="cac-lbl">Preferred time</label>
                  <select className="cac-sel" value={form.timePreference} onChange={f("timePreference")}>
                    <option value="">Select time…</option>
                    {TIME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="cac-field"><label className="cac-lbl">Notes</label><textarea className="cac-ta" placeholder="Budget range, catering needs, AV requirements, match preferences…" value={form.notes} onChange={f("notes")} /></div>
              {error && <p className="cac-err">{error}</p>}
              <button type="submit" className="cac-sub-btn" disabled={submitting}><Send size={14} />{submitting ? "Sending…" : "Request Corporate Package"}</button>
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

      <QuickServiceRequest cityName={cityName} />

      <section className="cac-section" id="for-business">
        <div className="cac-wrap">
          <p className="cac-label">For venues &amp; businesses</p>
          <div className="cac-grid">

            {/* ── Card 1: Venue Owner ── */}
            <div className="cac-card cac-card-venue">
              <div className="cac-card-top">
                <div className="cac-card-icon"><Building2 size={22} /></div>
                <div className="cac-card-hed">
                  <div className="cac-card-for">For venue owners</div>
                  <div className="cac-card-title">Activate Your {cityName} Venue for World Cup</div>
                </div>
              </div>
              <p className="cac-card-body">
                Get your bar, restaurant, or event space listed and start receiving World Cup 2026
                booking requests from fans searching for {cityName} watch parties.
              </p>
              <ul className="cac-list">
                <li>Listed on the {cityName} World Cup page</li>
                <li>Booking requests sent directly to you</li>
                <li>Access to DJ, photo &amp; marketing services</li>
                <li>Featured in the venue map &amp; search</li>
              </ul>
              <Link href="/for-venues/register" className="cac-btn-g">
                <Building2 size={14} /> List My Venue
              </Link>
            </div>

            {/* ── Card 2: Corporate / Group ── */}
            <div className="cac-card cac-card-corp">
              <div className="cac-card-top">
                <div className="cac-card-icon"><Users size={22} /></div>
                <div className="cac-card-hed">
                  <div className="cac-card-for">For companies &amp; groups</div>
                  <div className="cac-card-title">Book a Private Corporate Watch Party</div>
                </div>
              </div>
              <p className="cac-card-body">
                Private venue booking for employee events, client entertainment, and team outings.
                We handle venue sourcing, AV, catering, and logistics for 20 to 500+ guests.
              </p>
              <div className="cac-tags">
                {["Oil & Gas", "Medical", "Tech", "Finance", "Legal", "Real Estate", "Gov"].map((t) => (
                  <span key={t} className="cac-tag">{t}</span>
                ))}
              </div>
              <button type="button" className="cac-btn-p" onClick={() => setModalOpen(true)}>
                <Users size={14} /> Request Corporate Package
              </button>
            </div>

          </div>
        </div>
      </section>

      {modalOpen && <CorpModal cityName={cityName} onClose={() => setModalOpen(false)} />}
    </>
  );
}
