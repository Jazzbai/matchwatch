"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FloatingNav } from "../../../components/AppShell";

type FormState = {
    company: string;
    contactName: string;
    email: string;
    phone: string;
    website: string;
    tier: string;
    message: string;
};

const TIERS = [
    {
        id: "title",
        name: "Title Sponsor",
        price: "$5,000 / World Cup",
        perks: [
            "Logo top of Match Point hero",
            "Full sponsor page feature",
            "Logo on every QR banner in all venues",
            "Social media shoutout (10k+ fans)",
            "Venue notification blast to all followers",
            "Grand-prize sweepstakes branding",
        ],
    },
    {
        id: "gold",
        name: "Gold Sponsor",
        price: "$2,000 / World Cup",
        perks: [
            "Logo in sponsors bar",
            "Logo on QR banners",
            "Social shoutout",
            "Leaderboard badge",
        ],
    },
    {
        id: "venue",
        name: "Venue Partner",
        price: "$500 / month",
        perks: [
            "Featured venue badge",
            "Priority in venue selector",
            "Custom prize for venue leaderboard",
            "QR banner with your branding",
        ],
    },
    {
        id: "prize",
        name: "Prize Donor",
        price: "In-kind",
        perks: [
            "Logo on prize section",
            "Winner announcement post",
            "In-app notification to all fans",
        ],
    },
];

/* Same theme tokens as the home page */
const MW_VARS = `
  :root{
    --mw-bg:var(--background);--mw-card:var(--card);--mw-line:var(--border);
    --mw-fg:var(--foreground);--mw-dim:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);--mw-ink:#0a0b0d;
  }
`;

/* Reuses the home page's .hp-* visual language verbatim (hero, sections,
   buttons, photo-card patterns), plus a couple of .hp-tier-* / .hp-fld-*
   classes for the sponsor-specific tier cards and form fields. */
const CSS = `
  .hp{background:var(--mw-bg);color:var(--mw-fg);}
  .hp-wrap{max-width:1100px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  .hp-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mw-line);min-height:460px;display:flex;align-items:center;}
  .hp-hero-bg{position:absolute;inset:0;background:#06070a url(/home-hero.webp) center/cover no-repeat;}
  .hp-hero-scrim{position:absolute;inset:0;background:linear-gradient(110deg,rgba(6,7,10,0.94) 0%,rgba(6,7,10,0.78) 40%,rgba(6,7,10,0.45) 100%),linear-gradient(0deg,var(--mw-bg) 2%,transparent 40%);}
  .hp-hero-inner{position:relative;z-index:2;max-width:1100px;margin-inline:auto;width:100%;padding:140px clamp(16px,4vw,28px) 56px;}
  .hp-back{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);text-decoration:none;margin-bottom:18px;}
  .hp-back:hover{color:#fff;}
  .hp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mw-accent) 32%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:20px;}
  .hp-kicker .bd{width:6px;height:6px;border-radius:50%;background:var(--mw-accent);animation:hpPulse 1.4s ease-in-out infinite;}
  @keyframes hpPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
  .hp-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2.2rem,5.5vw,3.6rem);line-height:1;letter-spacing:-0.025em;margin:0 0 14px;color:#fff;max-width:760px;text-wrap:balance;}
  .hp-h1 em{font-style:normal;color:var(--mw-accent);}
  .hp-sub{max-width:620px;font-size:1.02rem;line-height:1.55;color:rgba(255,255,255,0.82);margin:0;}
  .hp-stats{display:flex;flex-wrap:wrap;gap:28px;margin-top:32px;}
  .hp-stat .v{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.7rem;color:var(--mw-accent);line-height:1;}
  .hp-stat .l{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.65);margin-top:6px;}

  .hp-sec{padding:48px 0;border-top:1px solid var(--mw-line);}
  .hp-sec:first-of-type{border-top:0;}
  .hp-sh{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap;}
  .hp-st{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.5rem;letter-spacing:-0.01em;display:flex;align-items:center;gap:12px;}
  .hp-st .tag{font-family:var(--font-mono),monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;color:var(--mw-accent);border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:6px;}
  .hp-sh-sub{font-size:14px;color:var(--mw-dim);margin:8px 0 0;}

  /* Sponsorship tier cards (photo-card chrome) */
  .hp-tiers{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;}
  .hp-tier{display:block;text-align:left;padding:22px 20px;border-radius:12px;border:1px solid var(--mw-line);background:var(--mw-card);cursor:pointer;transition:all .15s;color:var(--mw-fg);font-family:inherit;}
  .hp-tier:hover{border-color:color-mix(in srgb,var(--mw-accent) 50%,transparent);transform:translateY(-2px);}
  .hp-tier.on{border-color:var(--mw-accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--mw-accent) 16%,transparent);background:color-mix(in srgb,var(--mw-accent) 6%,var(--mw-card));}
  .hp-tier-name{font-family:var(--font-mono),monospace;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--mw-accent);margin-bottom:6px;}
  .hp-tier-price{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:20px;font-weight:900;margin-bottom:14px;}
  .hp-tier ul{list-style:none;padding:0;margin:0;display:grid;gap:6px;}
  .hp-tier li{font-size:12.5px;color:var(--mw-dim);display:flex;align-items:flex-start;gap:6px;line-height:1.4;}
  .hp-tier li span{color:var(--mw-accent);flex-shrink:0;margin-top:1px;}

  /* Form card */
  .hp-form-card{max-width:680px;margin:0 auto;background:var(--mw-card);border:1px solid var(--mw-line);border-radius:14px;padding:36px clamp(20px,4vw,36px);}
  .hp-form-card h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:22px;font-weight:900;margin:0 0 6px;}
  .hp-form-card .sub{color:var(--mw-dim);font-size:14px;margin:0 0 24px;}
  .hp-form{display:grid;gap:16px;}
  .hp-fld-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  @media(max-width:560px){.hp-fld-row{grid-template-columns:1fr;}}
  .hp-fld-label{display:block;font-family:var(--font-mono),monospace;font-size:10px;font-weight:800;color:var(--mw-dim);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;}
  .hp-fld{width:100%;min-height:44px;padding:10px 14px;border-radius:10px;border:1px solid var(--mw-line);background:var(--mw-bg);color:var(--mw-fg);font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;}
  .hp-fld:focus{border-color:var(--mw-accent);}
  textarea.hp-fld{min-height:100px;resize:vertical;}
  .hp-error{color:#ef4444;font-size:13px;margin:0;}

  /* Buttons (same as home) */
  .hp-cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;}
  .hp-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;border:1px solid rgba(255,255,255,0.22);color:#fff;transition:all .18s;cursor:pointer;font-family:inherit;}
  .hp-btn:hover{border-color:rgba(255,255,255,0.5);}
  .hp-btn.primary{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}
  .hp-btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}
  .hp-btn.dark{border-color:var(--mw-line);color:var(--mw-fg);}
  .hp-btn.dark:hover{border-color:var(--mw-accent);}
  .hp-submit{padding:14px;border-radius:12px;background:var(--mw-accent);color:var(--mw-ink);font-size:15px;font-weight:900;border:none;cursor:pointer;letter-spacing:0.01em;font-family:inherit;}
  .hp-submit:hover{transform:translateY(-1px);box-shadow:0 12px 24px color-mix(in srgb,var(--mw-accent) 32%,transparent);}
  .hp-submit:disabled{opacity:0.6;cursor:wait;transform:none;box-shadow:none;}

  .hp-altmail{font-size:11px;color:var(--mw-dim);text-align:center;margin:0;}
  .hp-altmail a{color:var(--mw-accent);text-decoration:none;}

  /* Success card */
  .hp-thanks{max-width:560px;margin:0 auto;text-align:center;background:var(--mw-card);border:1px solid var(--mw-line);border-radius:14px;padding:56px 36px;}
  .hp-thanks .glyph{font-size:56px;margin-bottom:14px;}
  .hp-thanks h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:26px;font-weight:900;margin:0 0 10px;}
  .hp-thanks p{color:var(--mw-dim);line-height:1.6;margin:0 0 24px;}

  @media(max-width:760px){
    .hp-hero-inner{padding:120px 16px 44px;}
  }
`;

export default function SponsorPage() {
    const router = useRouter();
    const [form, setForm] = useState<FormState>({
        company: "", contactName: "", email: "", phone: "",
        website: "", tier: "", message: "",
    });
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function update(field: keyof FormState, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.company || !form.email || !form.tier) {
            setError("Please fill in company, email, and pick a tier.");
            return;
        }
        setError(null);
        setSubmitting(true);

        try {
            const res = await fetch("/api/v1/sponsor-inquiry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                setSubmitted(true);
                setSubmitting(false);
                return;
            }
        } catch {
            // fall through to mailto fallback
        }

        const subject = encodeURIComponent(`Sponsor Inquiry — ${form.company} (${form.tier})`);
        const body = encodeURIComponent(
            `Company: ${form.company}\nContact: ${form.contactName}\nEmail: ${form.email}\nPhone: ${form.phone}\nWebsite: ${form.website}\nTier: ${form.tier}\n\nMessage:\n${form.message}`,
        );
        window.location.href = `mailto:sponsors@matchwatch.us?subject=${subject}&body=${body}`;
        setSubmitted(true);
        setSubmitting(false);
    }

    return (
        <div className="hp">
            <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
            <FloatingNav />

            {/* Hero */}
            <section className="hp-hero">
                <div className="hp-hero-bg" />
                <div className="hp-hero-scrim" />
                <div className="hp-hero-inner">
                    <Link href="/match-point" className="hp-back">← Back to Match Point</Link>
                    <span className="hp-kicker"><span className="bd" />Match Point · Sponsorship & Venue Partners</span>
                    <h1 className="hp-h1">Reach fans at <em>every match.</em></h1>
                    <p className="hp-sub">
                        Sponsor the Match Point prediction game and put your brand in front of engaged football
                        fans across all 11 US World Cup host cities. Venues that host the QR fill seats on match
                        nights; sponsors get reach across every check-in.
                    </p>
                    <div className="hp-stats">
                        <div className="hp-stat">
                            <div className="v">11</div>
                            <div className="l">US host cities</div>
                        </div>
                        <div className="hp-stat">
                            <div className="v">104</div>
                            <div className="l">World Cup matches</div>
                        </div>
                        <div className="hp-stat">
                            <div className="v">500+</div>
                            <div className="l">Watch-party venues</div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="hp-wrap">
                {/* Tier picker */}
                <section className="hp-sec" style={{ borderTop: 0 }}>
                    <div className="hp-sh">
                        <div>
                            <div className="hp-st">Choose your sponsorship tier <span className="tag">4 tiers</span></div>
                            <p className="hp-sh-sub">Pick a tier and it pre-fills the form below.</p>
                        </div>
                    </div>
                    <div className="hp-tiers">
                        {TIERS.map((tier) => {
                            const selected = form.tier === tier.id;
                            return (
                                <button
                                    key={tier.id}
                                    type="button"
                                    onClick={() => update("tier", tier.id)}
                                    className={`hp-tier${selected ? " on" : ""}`}
                                >
                                    <div className="hp-tier-name">{tier.name}</div>
                                    <div className="hp-tier-price">{tier.price}</div>
                                    <ul>
                                        {tier.perks.map((perk) => (
                                            <li key={perk}><span>✓</span>{perk}</li>
                                        ))}
                                    </ul>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Application form */}
                <section className="hp-sec">
                    {submitted ? (
                        <div className="hp-thanks">
                            <div className="glyph">🎉</div>
                            <h2>Thank you, {form.company}!</h2>
                            <p>
                                We&apos;ve received your sponsorship inquiry. We&apos;ll reach out to{" "}
                                <strong style={{ color: "var(--mw-fg)" }}>{form.email}</strong> within 24 hours.
                            </p>
                            <button type="button" className="hp-submit" onClick={() => router.push("/match-point")}>Back to Match Point →</button>
                        </div>
                    ) : (
                        <div className="hp-form-card">
                            <h2>Sponsor application</h2>
                            <p className="sub">Tell us about your brand and we&apos;ll get back to you within 24 hours.</p>

                            <form className="hp-form" onSubmit={handleSubmit}>
                                <div className="hp-fld-row">
                                    <div>
                                        <label className="hp-fld-label" htmlFor="sp-company">Company / brand *</label>
                                        <input id="sp-company" className="hp-fld" value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Your company name" required />
                                    </div>
                                    <div>
                                        <label className="hp-fld-label" htmlFor="sp-contact">Contact name</label>
                                        <input id="sp-contact" className="hp-fld" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Your full name" />
                                    </div>
                                </div>

                                <div className="hp-fld-row">
                                    <div>
                                        <label className="hp-fld-label" htmlFor="sp-email">Email *</label>
                                        <input id="sp-email" className="hp-fld" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" required />
                                    </div>
                                    <div>
                                        <label className="hp-fld-label" htmlFor="sp-phone">Phone</label>
                                        <input id="sp-phone" className="hp-fld" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 (555) 000-0000" />
                                    </div>
                                </div>

                                <div>
                                    <label className="hp-fld-label" htmlFor="sp-website">Website</label>
                                    <input id="sp-website" className="hp-fld" type="url" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://yourcompany.com" />
                                </div>

                                <div>
                                    <label className="hp-fld-label" htmlFor="sp-tier">Sponsorship tier *</label>
                                    <select id="sp-tier" className="hp-fld" value={form.tier} onChange={(e) => update("tier", e.target.value)} required>
                                        <option value="">Select a tier…</option>
                                        {TIERS.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name} — {t.price}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="hp-fld-label" htmlFor="sp-message">Message / goals</label>
                                    <textarea id="sp-message" className="hp-fld" value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="Tell us about your brand, target audience, or any custom ideas…" />
                                </div>

                                {error && <p className="hp-error">{error}</p>}

                                <button type="submit" className="hp-submit" disabled={submitting}>
                                    {submitting ? "Sending…" : "Submit sponsorship application →"}
                                </button>

                                <p className="hp-altmail">
                                    Or email us directly at <a href="mailto:sponsors@matchwatch.us">sponsors@matchwatch.us</a>
                                </p>
                            </form>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
