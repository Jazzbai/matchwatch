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
        accent: "var(--mp-accent)",
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
        accent: "var(--mp-accent)",
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
        accent: "var(--mp-accent)",
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
        accent: "var(--mp-accent)",
        perks: [
            "Logo on prize section",
            "Winner announcement post",
            "In-app notification to all fans",
        ],
    },
];

const MP_VARS = `
  :root{
    --mp-bg:var(--background);--mp-card:var(--card);--mp-line:var(--border);
    --mp-fg:var(--foreground);--mp-dim:var(--muted-foreground);
    --mp-accent:oklch(0.72 0.19 28);--mp-ink:#0a0b0d;
  }
`;

const SP_CSS = `
  .sp{background:var(--mp-bg);color:var(--mp-fg);min-height:100vh;}
  .sp-wrap{max-width:1100px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  /* Hero */
  .sp-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mp-line);min-height:480px;display:flex;align-items:center;}
  .sp-hero-bg{position:absolute;inset:0;background:#06070a url(/match-hero.webp) center/cover no-repeat;}
  .sp-hero-scrim{position:absolute;inset:0;background:linear-gradient(110deg,rgba(6,7,10,0.94) 0%,rgba(6,7,10,0.78) 40%,rgba(6,7,10,0.5) 100%),linear-gradient(0deg,var(--mp-bg) 2%,transparent 40%);}
  .sp-hero-inner{position:relative;z-index:2;max-width:1100px;margin-inline:auto;width:100%;padding:138px clamp(16px,4vw,28px) 60px;}
  .sp-back{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);text-decoration:none;margin-bottom:20px;}
  .sp-back:hover{color:#fff;}
  .sp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mp-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mp-accent) 35%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:18px;}
  .sp-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2.2rem,5.5vw,3.6rem);line-height:1.0;letter-spacing:-0.025em;margin:0 0 14px;color:#fff;max-width:760px;text-wrap:balance;}
  .sp-h1 em{font-style:normal;color:var(--mp-accent);}
  .sp-sub{max-width:600px;font-size:1.02rem;line-height:1.55;color:rgba(255,255,255,0.8);margin:0;}
  .sp-stats{display:flex;flex-wrap:wrap;gap:24px;margin-top:36px;}
  .sp-stat .v{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.7rem;color:var(--mp-accent);line-height:1;}
  .sp-stat .l{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.65);margin-top:6px;}

  /* Sections */
  .sp-sec{padding:48px 0;}
  .sp-sh{text-align:center;margin-bottom:8px;}
  .sp-sh h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.5rem;margin:0;}
  .sp-sh p{color:var(--mp-dim);font-size:14px;margin:8px 0 0;}

  /* Tier cards */
  .sp-tiers{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-top:28px;}
  .sp-tier{text-align:left;padding:22px 20px;border-radius:12px;border:1px solid var(--mp-line);background:var(--mp-card);cursor:pointer;transition:all .15s;font-family:inherit;color:var(--mp-fg);}
  .sp-tier:hover{border-color:color-mix(in srgb,var(--mp-accent) 50%,transparent);transform:translateY(-2px);}
  .sp-tier.on{border-color:var(--mp-accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--mp-accent) 16%,transparent);background:color-mix(in srgb,var(--mp-accent) 6%,var(--mp-card));}
  .sp-tier-name{font-family:var(--font-mono),monospace;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--mp-accent);margin-bottom:6px;}
  .sp-tier-price{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:20px;font-weight:900;margin-bottom:14px;}
  .sp-tier ul{list-style:none;padding:0;margin:0;display:grid;gap:6px;}
  .sp-tier li{font-size:12.5px;color:var(--mp-dim);display:flex;align-items:flex-start;gap:6px;line-height:1.4;}
  .sp-tier li span{color:var(--mp-accent);flex-shrink:0;margin-top:1px;}

  /* Form */
  .sp-form-card{max-width:680px;margin:0 auto;background:var(--mp-card);border:1px solid var(--mp-line);border-radius:16px;padding:36px clamp(20px,4vw,36px);}
  .sp-form-card h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:22px;font-weight:900;margin:0 0 6px;}
  .sp-form-card .sub{color:var(--mp-dim);font-size:14px;margin:0 0 24px;}
  .sp-form{display:grid;gap:16px;}
  .sp-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  @media(max-width:560px){.sp-row{grid-template-columns:1fr;}}
  .sp-label{display:block;font-family:var(--font-mono),monospace;font-size:10px;font-weight:800;color:var(--mp-dim);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;}
  .sp-input{width:100%;min-height:44px;padding:10px 14px;border-radius:10px;border:1px solid var(--mp-line);background:var(--mp-bg);color:var(--mp-fg);font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;}
  .sp-input:focus{border-color:var(--mp-accent);}
  textarea.sp-input{min-height:100px;resize:vertical;}
  .sp-error{color:#ef4444;font-size:13px;margin:0;}
  .sp-submit{padding:14px;border-radius:12px;background:var(--mp-accent);color:var(--mp-ink);font-size:15px;font-weight:900;border:none;cursor:pointer;letter-spacing:0.01em;font-family:inherit;}
  .sp-submit:hover{transform:translateY(-1px);box-shadow:0 12px 24px color-mix(in srgb,var(--mp-accent) 32%,transparent);}
  .sp-submit:disabled{opacity:0.6;cursor:wait;transform:none;box-shadow:none;}
  .sp-altmail{font-size:11px;color:var(--mp-dim);text-align:center;margin:0;}
  .sp-altmail a{color:var(--mp-accent);text-decoration:none;}

  /* Success card */
  .sp-thanks{max-width:540px;margin:0 auto;text-align:center;background:var(--mp-card);border:1px solid var(--mp-line);border-radius:16px;padding:52px 36px;}
  .sp-thanks .glyph{font-size:56px;margin-bottom:14px;}
  .sp-thanks h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:26px;font-weight:900;margin:0 0 10px;}
  .sp-thanks p{color:var(--mp-dim);line-height:1.6;margin:0 0 24px;}
  .sp-thanks button{padding:14px 28px;border-radius:12px;background:var(--mp-accent);color:var(--mp-ink);font-size:14px;font-weight:800;border:none;cursor:pointer;font-family:inherit;}
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
        <div className="sp">
            <style dangerouslySetInnerHTML={{ __html: MP_VARS + SP_CSS + `body{background:var(--mp-bg)!important;color:var(--mp-fg)!important;}` }} />
            <FloatingNav />

            <section className="sp-hero">
                <div className="sp-hero-bg" />
                <div className="sp-hero-scrim" />
                <div className="sp-hero-inner">
                    <Link href="/match-point" className="sp-back">← Back to Match Point</Link>
                    <span className="sp-kicker">Match Point · Sponsorship & Venue Partners</span>
                    <h1 className="sp-h1">Reach fans at <em>every match.</em></h1>
                    <p className="sp-sub">
                        Sponsor the Match Point prediction game and put your brand in front of engaged football
                        fans across all 11 US World Cup host cities. Venues that host the QR fill seats on match
                        nights; sponsors get reach across every check-in.
                    </p>
                    <div className="sp-stats">
                        <div className="sp-stat">
                            <div className="v">11</div>
                            <div className="l">US host cities</div>
                        </div>
                        <div className="sp-stat">
                            <div className="v">104</div>
                            <div className="l">World Cup matches</div>
                        </div>
                        <div className="sp-stat">
                            <div className="v">500+</div>
                            <div className="l">Watch-party venues</div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="sp-wrap">
                <section className="sp-sec">
                    <div className="sp-sh">
                        <h2>Choose your sponsorship tier</h2>
                        <p>Pick a tier and it pre-fills the form below.</p>
                    </div>
                    <div className="sp-tiers">
                        {TIERS.map((tier) => {
                            const selected = form.tier === tier.id;
                            return (
                                <button
                                    key={tier.id}
                                    type="button"
                                    onClick={() => update("tier", tier.id)}
                                    className={`sp-tier${selected ? " on" : ""}`}
                                >
                                    <div className="sp-tier-name">{tier.name}</div>
                                    <div className="sp-tier-price">{tier.price}</div>
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

                <section className="sp-sec">
                    {submitted ? (
                        <div className="sp-thanks">
                            <div className="glyph">🎉</div>
                            <h2>Thank you, {form.company}!</h2>
                            <p>
                                We&apos;ve received your sponsorship inquiry. We&apos;ll reach out to{" "}
                                <strong style={{ color: "var(--mp-fg)" }}>{form.email}</strong> within 24 hours.
                            </p>
                            <button type="button" onClick={() => router.push("/match-point")}>Back to Match Point →</button>
                        </div>
                    ) : (
                        <div className="sp-form-card">
                            <h2>Sponsor application</h2>
                            <p className="sub">Tell us about your brand and we&apos;ll get back to you within 24 hours.</p>

                            <form className="sp-form" onSubmit={handleSubmit}>
                                <div className="sp-row">
                                    <div>
                                        <label className="sp-label" htmlFor="sp-company">Company / brand *</label>
                                        <input id="sp-company" className="sp-input" value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Your company name" required />
                                    </div>
                                    <div>
                                        <label className="sp-label" htmlFor="sp-contact">Contact name</label>
                                        <input id="sp-contact" className="sp-input" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Your full name" />
                                    </div>
                                </div>

                                <div className="sp-row">
                                    <div>
                                        <label className="sp-label" htmlFor="sp-email">Email *</label>
                                        <input id="sp-email" className="sp-input" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" required />
                                    </div>
                                    <div>
                                        <label className="sp-label" htmlFor="sp-phone">Phone</label>
                                        <input id="sp-phone" className="sp-input" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 (555) 000-0000" />
                                    </div>
                                </div>

                                <div>
                                    <label className="sp-label" htmlFor="sp-website">Website</label>
                                    <input id="sp-website" className="sp-input" type="url" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://yourcompany.com" />
                                </div>

                                <div>
                                    <label className="sp-label" htmlFor="sp-tier">Sponsorship tier *</label>
                                    <select id="sp-tier" className="sp-input" value={form.tier} onChange={(e) => update("tier", e.target.value)} required>
                                        <option value="">Select a tier…</option>
                                        {TIERS.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name} — {t.price}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="sp-label" htmlFor="sp-message">Message / goals</label>
                                    <textarea id="sp-message" className="sp-input" value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="Tell us about your brand, target audience, or any custom ideas…" />
                                </div>

                                {error && <p className="sp-error">{error}</p>}

                                <button type="submit" className="sp-submit" disabled={submitting}>
                                    {submitting ? "Sending…" : "Submit sponsorship application →"}
                                </button>

                                <p className="sp-altmail">
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
