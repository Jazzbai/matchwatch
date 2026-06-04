"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FloatingNav } from "../../../components/AppShell";

type FormState = {
    company: string;
    contactName: string;
    email: string;
    phone: string;
    website: string;
    partySize: string;
    venueCapacity: string;
    matchInterest: string;
    message: string;
};

const DELIVERABLES = [
    { n: "01", title: "World Cup landing page", body: "Dedicated WC microsite for your venue — hero, watch-party description, F&B specials, VIP seating, reservation, sponsors, FAQ." },
    { n: "02", title: "Reservation system", body: "Reserve Table, VIP Table, Private Room, Group Booking, Corporate Booking, and a waitlist when matches sell out." },
    { n: "03", title: "34 match-day pages", body: "Every World Cup fixture you host gets its own page with kickoff, team crests, specials, and direct reservation." },
    { n: "04", title: "Jersey Party Campaign", body: "10 themed tournament events — Opening Night, USA / Mexico / Brazil / Argentina Night, Retro, Family, Corporate — with prizes and contests." },
    { n: "05", title: "35 social-media campaigns", body: "Pre-built post templates for every match day — countdowns, jersey contests, goal predictions, halftime giveaways, final celebration." },
    { n: "06", title: "Sponsor section", body: "Local sponsors get logo placement on your microsite and across the Match Point game in your city." },
    { n: "07", title: "Revenue dashboards", body: "See reservations, party size, package mix, and revenue-projection per match in your venue admin." },
    { n: "08", title: "MatchWatch exposure", body: "Featured placement on the Houston city page, the World Cup hub, and the home-page rail during the tournament." },
    { n: "09", title: "Marketing materials", body: "Branded watch-party assets, social-share templates, and QR posters for your bar — ready to print and post." },
];

const RESERVATION_TIERS = [
    { name: "Reserve Table", line: "Walk-in confirmation for groups up to 4." },
    { name: "VIP Table", line: "Reserved booth, bottle service, dedicated server." },
    { name: "Private Room", line: "Closed-room watch parties for groups of 10–30." },
    { name: "Group Package", line: "Pre-set F&B for 6–12 with a kickoff time hold." },
    { name: "Corporate Package", line: "Branded event for 20–100, custom menu + AV." },
    { name: "Waitlist", line: "Automatic notify when a sold-out match opens up." },
];

const JERSEY_PARTIES = [
    { title: "Opening Night Jersey Party", note: "First match (Jun 11) · photo booth · after-party at partner venue" },
    { title: "USA Jersey Night", note: "Every USA group-stage match" },
    { title: "Mexico Jersey Night", note: "El Tri match days" },
    { title: "Brazil Jersey Night", note: "Selecão takeover" },
    { title: "Argentina Jersey Night", note: "Albiceleste takeover" },
    { title: "International Fan Night", note: "Bring your country's jersey · prizes for most represented nation" },
    { title: "Retro Soccer Jersey Night", note: "Vintage kits · throwback drinks menu" },
    { title: "Best Jersey Contest", note: "Photo contest · weekly winners" },
    { title: "Family Fan Night", note: "Kid-friendly viewing · early kickoff slots" },
    { title: "Corporate Fan Night", note: "Private buyout for company watch parties" },
];

const CONTENT_CAMPAIGNS: Array<{ category: string; ideas: string[] }> = [
    {
        category: "Pre-tournament",
        ideas: [
            "Opening Match Countdown", "Meet Your Team", "World Cup Bracket Challenge",
            "Soccer Trivia Night", "DJ Pre-Game Party", "Meet Local Soccer Clubs",
        ],
    },
    {
        category: "Match day",
        ideas: [
            "Goal Prediction Contest", "First Goal Giveaway", "Free Appetizer Promotion",
            "Happy Hour Match", "Halftime Giveaway", "Post-Match Celebration",
            "Pick the Winner",
        ],
    },
    {
        category: "Themed nights",
        ideas: [
            "Jersey Contest", "Country Pride Night", "International Food Night",
            "Ladies Soccer Night", "Kids Fan Day", "Youth Soccer Night",
            "Alumni Night", "Birthday During World Cup",
        ],
    },
    {
        category: "Engagement",
        ideas: [
            "Fan Photo Contest", "Best Dressed Fan", "VIP Table Promotion",
            "Group Package Promotion", "Sponsor Giveaway", "VIP Experience Giveaway",
            "Influencer Night", "Business Networking Match", "Corporate Watch Party",
        ],
    },
    {
        category: "Knockout & finals",
        ideas: [
            "Golden Boot Contest", "Final Countdown", "Semifinal Special",
            "Championship Weekend", "Closing Celebration Party",
        ],
    },
];

const VIDEO_ADDONS = [
    { name: "Single social-media video", price: "$499", body: "Pick one — Venue Intro, Watch Party Experience, Jersey Party Promotion, or Reserve Your Table. 30–45 seconds." },
    { name: "All 4 social-media videos", price: "$1,500", body: "Full bundle — venue intro, watch party, jersey party, and reservation CTA. Best value." },
    { name: "Premium promotional video", price: "$1,500", body: "60–90 sec sales presentation. World Cup opportunity, MatchWatch platform, revenue, signature close." },
];

const REVENUE_LINES = [
    "Reserved Tables", "VIP Tables", "Cover Charges", "Food Packages",
    "Drink Packages", "Sponsorships", "Private Events", "Corporate Events",
    "Merchandise", "Jersey Competitions",
];

const FAQS = [
    {
        q: "What does delivery look like for June 11 kickoff?",
        a: "Phase 1 — your World Cup landing page, 34 match-day pages, and reservation tiers — is delivered before opening match. Phase 2 — jersey-party campaigns and the 35-post social calendar — is delivered through the group and knockout stages. To launch on schedule we need hosting access or one day at your office before June 11.",
    },
    {
        q: "Do I need to switch reservation platforms?",
        a: "No. We integrate with what you already use — OpenTable, Toast, Resy, SevenRooms, Eventbrite — or our own booking form if you'd prefer a single dashboard.",
    },
    {
        q: "Is video production included?",
        a: "Video production is an optional add-on, not part of the base package. Pick one ($499) or all four ($1,500) social videos, plus an optional $1,500 premium promotional video.",
    },
    {
        q: "What happens after the group stage?",
        a: "Based on your satisfaction with the June delivery, the next month is confirmed and includes the full knockout stage and the Final on July 19 — with the highest-revenue match days of the tournament.",
    },
    {
        q: "What does the $12,650 actually cover?",
        a: "Full delivery of the World Cup Watch Party Package — landing page, reservation integration, 34 match-day pages, jersey-party campaign, 35 social-content campaigns, sponsor section, FAQ, contact form, watch-party marketing materials, and MatchWatch branding assets. Video production is billed separately.",
    },
];

const MW_VARS = `
  :root{
    --mw-bg:var(--background);--mw-card:var(--card);--mw-line:var(--border);
    --mw-fg:var(--foreground);--mw-dim:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);--mw-ink:#0a0b0d;
  }
`;

const CSS = `
  .hp{background:var(--mw-bg);color:var(--mw-fg);}
  .hp-wrap{max-width:1100px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  .hp-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mw-line);min-height:520px;display:flex;align-items:center;}
  .hp-hero-bg{position:absolute;inset:0;background:#06070a url(/home-hero.webp) center/cover no-repeat;}
  .hp-hero-scrim{position:absolute;inset:0;background:linear-gradient(110deg,rgba(6,7,10,0.95) 0%,rgba(6,7,10,0.80) 40%,rgba(6,7,10,0.40) 100%),linear-gradient(0deg,var(--mw-bg) 2%,transparent 40%);}
  .hp-hero-inner{position:relative;z-index:2;max-width:1100px;margin-inline:auto;width:100%;padding:140px clamp(16px,4vw,28px) 60px;}
  .hp-back{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);text-decoration:none;margin-bottom:18px;}
  .hp-back:hover{color:#fff;}
  .hp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mw-accent) 32%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:20px;}
  .hp-kicker .bd{width:6px;height:6px;border-radius:50%;background:var(--mw-accent);animation:hpPulse 1.4s ease-in-out infinite;}
  @keyframes hpPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
  .hp-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2.4rem,6vw,4rem);line-height:1;letter-spacing:-0.025em;margin:0 0 14px;color:#fff;max-width:780px;text-wrap:balance;}
  .hp-h1 em{font-style:normal;color:var(--mw-accent);}
  .hp-sub{max-width:640px;font-size:1.05rem;line-height:1.55;color:rgba(255,255,255,0.85);margin:0 0 28px;}
  .hp-price-row{display:flex;flex-wrap:wrap;gap:16px;align-items:center;margin:0 0 28px;}
  .hp-price{display:inline-flex;align-items:baseline;gap:10px;padding:14px 22px;border-radius:14px;background:color-mix(in srgb,var(--mw-accent) 16%,transparent);border:1px solid color-mix(in srgb,var(--mw-accent) 40%,transparent);}
  .hp-price .v{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.9rem;color:var(--mw-accent);line-height:1;}
  .hp-price .l{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.7);}
  .hp-pitch{font-family:var(--font-mono),monospace;font-size:13px;letter-spacing:0.04em;color:#fff;font-weight:700;}

  .hp-stats{display:flex;flex-wrap:wrap;gap:28px;margin-top:8px;}
  .hp-stat .v{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.7rem;color:var(--mw-accent);line-height:1;}
  .hp-stat .l{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.65);margin-top:6px;}

  .hp-sec{padding:56px 0;border-top:1px solid var(--mw-line);}
  .hp-sec:first-of-type{border-top:0;}
  .hp-sh{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap;}
  .hp-st{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.6rem;letter-spacing:-0.01em;display:flex;align-items:center;gap:12px;}
  .hp-st .tag{font-family:var(--font-mono),monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;color:var(--mw-accent);border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:6px;}
  .hp-sh-sub{font-size:14px;color:var(--mw-dim);margin:8px 0 0;max-width:640px;line-height:1.55;}

  /* Deliverables grid */
  .hp-deliv{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
  .hp-dcard{padding:22px;border-radius:14px;border:1px solid var(--mw-line);background:var(--mw-card);}
  .hp-dcard .n{font-family:var(--font-mono),monospace;font-size:11px;font-weight:800;color:var(--mw-accent);letter-spacing:0.1em;margin-bottom:8px;}
  .hp-dcard h3{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:16px;margin:0 0 8px;line-height:1.25;}
  .hp-dcard p{font-size:13px;color:var(--mw-dim);margin:0;line-height:1.55;}

  /* Reservation tiers */
  .hp-res{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}
  .hp-rcard{padding:18px 20px;border-radius:12px;border:1px solid var(--mw-line);background:var(--mw-card);}
  .hp-rcard .nm{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:14px;margin:0 0 4px;}
  .hp-rcard .ln{font-size:12.5px;color:var(--mw-dim);line-height:1.5;margin:0;}
  .hp-platforms{display:flex;flex-wrap:wrap;gap:6px;margin-top:18px;font-family:var(--font-mono),monospace;font-size:11px;color:var(--mw-dim);letter-spacing:0.04em;}
  .hp-platforms span{padding:5px 10px;border-radius:999px;border:1px solid var(--mw-line);background:var(--mw-bg);}

  /* Jersey parties */
  .hp-jp{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;}
  .hp-jcard{padding:18px 20px;border-radius:12px;border:1px solid var(--mw-line);background:var(--mw-card);display:flex;flex-direction:column;gap:6px;}
  .hp-jcard h3{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:14.5px;margin:0;line-height:1.25;}
  .hp-jcard .nt{font-size:12px;color:var(--mw-dim);line-height:1.5;margin:0;}

  /* Content calendar */
  .hp-cc{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;}
  .hp-ccol{padding:18px;border-radius:12px;border:1px solid var(--mw-line);background:var(--mw-card);}
  .hp-ccol h3{font-family:var(--font-mono),monospace;font-size:11px;font-weight:800;color:var(--mw-accent);letter-spacing:0.1em;text-transform:uppercase;margin:0 0 12px;}
  .hp-ccol ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:5px;}
  .hp-ccol li{font-size:12.5px;color:var(--mw-fg);line-height:1.45;display:flex;align-items:flex-start;gap:6px;}
  .hp-ccol li::before{content:"·";color:var(--mw-accent);font-weight:800;}

  /* Revenue chips */
  .hp-rev{display:flex;flex-wrap:wrap;gap:8px;}
  .hp-rchip{padding:8px 14px;border-radius:999px;border:1px solid color-mix(in srgb,var(--mw-accent) 30%,var(--mw-line));background:color-mix(in srgb,var(--mw-accent) 5%,var(--mw-card));font-size:13px;font-weight:700;color:var(--mw-fg);}

  /* Video add-ons */
  .hp-vid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;}
  .hp-vcard{padding:22px;border-radius:14px;border:1px solid var(--mw-line);background:var(--mw-card);}
  .hp-vcard h3{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:15px;margin:0 0 4px;}
  .hp-vcard .pr{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;color:var(--mw-accent);font-size:22px;margin:0 0 10px;}
  .hp-vcard p{font-size:13px;color:var(--mw-dim);margin:0;line-height:1.55;}
  .hp-vid-foot{margin-top:18px;font-size:12px;color:var(--mw-dim);font-family:var(--font-mono),monospace;letter-spacing:0.04em;}

  /* FAQ */
  .hp-faq{display:grid;gap:10px;}
  .hp-fq{border:1px solid var(--mw-line);border-radius:12px;background:var(--mw-card);overflow:hidden;}
  .hp-fq summary{cursor:pointer;padding:18px 22px;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:15px;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:18px;}
  .hp-fq summary::-webkit-details-marker{display:none;}
  .hp-fq summary::after{content:"+";color:var(--mw-accent);font-size:22px;font-weight:300;line-height:1;}
  .hp-fq[open] summary::after{content:"–";}
  .hp-fq-body{padding:0 22px 20px;font-size:14px;color:var(--mw-dim);line-height:1.6;}

  /* Form */
  .hp-form-card{max-width:720px;margin:0 auto;background:var(--mw-card);border:1px solid var(--mw-line);border-radius:14px;padding:36px clamp(20px,4vw,36px);}
  .hp-form-card h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:24px;font-weight:900;margin:0 0 6px;}
  .hp-form-card .sub{color:var(--mw-dim);font-size:14px;margin:0 0 24px;line-height:1.55;}
  .hp-form{display:grid;gap:16px;}
  .hp-fld-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  @media(max-width:560px){.hp-fld-row{grid-template-columns:1fr;}}
  .hp-fld-label{display:block;font-family:var(--font-mono),monospace;font-size:10px;font-weight:800;color:var(--mw-dim);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;}
  .hp-fld{width:100%;min-height:44px;padding:10px 14px;border-radius:10px;border:1px solid var(--mw-line);background:var(--mw-bg);color:var(--mw-fg);font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;}
  .hp-fld:focus{border-color:var(--mw-accent);}
  textarea.hp-fld{min-height:110px;resize:vertical;}
  .hp-error{color:#ef4444;font-size:13px;margin:0;}
  .hp-submit{padding:14px;border-radius:12px;background:var(--mw-accent);color:var(--mw-ink);font-size:15px;font-weight:900;border:none;cursor:pointer;letter-spacing:0.01em;font-family:inherit;}
  .hp-submit:hover{transform:translateY(-1px);box-shadow:0 12px 24px color-mix(in srgb,var(--mw-accent) 32%,transparent);}
  .hp-submit:disabled{opacity:0.6;cursor:wait;transform:none;box-shadow:none;}
  .hp-altmail{font-size:11px;color:var(--mw-dim);text-align:center;margin:0;}
  .hp-altmail a{color:var(--mw-accent);text-decoration:none;}
  .hp-thanks{max-width:560px;margin:0 auto;text-align:center;background:var(--mw-card);border:1px solid var(--mw-line);border-radius:14px;padding:56px 36px;}
  .hp-thanks .glyph{font-size:56px;margin-bottom:14px;}
  .hp-thanks h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:26px;font-weight:900;margin:0 0 10px;}
  .hp-thanks p{color:var(--mw-dim);line-height:1.6;margin:0 0 24px;}

  /* Buttons */
  .hp-cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;}
  .hp-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;border:1px solid rgba(255,255,255,0.22);color:#fff;transition:all .18s;cursor:pointer;font-family:inherit;}
  .hp-btn:hover{border-color:rgba(255,255,255,0.5);}
  .hp-btn.primary{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}
  .hp-btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}

  @media(max-width:760px){
    .hp-hero-inner{padding:120px 16px 44px;}
    .hp-sec{padding:44px 0;}
  }
`;

function WatchPartyPackageContent() {
    const searchParams = useSearchParams();
    const ref = searchParams.get("ref");

    const [form, setForm] = useState<FormState>({
        company: "", contactName: "", email: "", phone: "",
        website: "", partySize: "", venueCapacity: "",
        matchInterest: "", message: "",
    });
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function update(field: keyof FormState, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.company || !form.email) {
            setError("Please fill in your venue name and email.");
            return;
        }
        setError(null);
        setSubmitting(true);

        // Pack the package-specific fields into the message body so we don't
        // need to migrate the sponsor_inquiries schema. Super-admin sees the
        // labeled lines verbatim.
        const enrichedMessage = [
            `Estimated party size: ${form.partySize || "—"}`,
            `Venue capacity: ${form.venueCapacity || "—"}`,
            `Match interest: ${form.matchInterest || "—"}`,
            ref ? `Referrer: ${ref}` : null,
            "",
            form.message || "(no additional message)",
        ].filter(Boolean).join("\n");

        const payload = {
            company: form.company,
            contactName: form.contactName || undefined,
            email: form.email,
            phone: form.phone || undefined,
            website: form.website || undefined,
            tier: "watch_party_package",
            message: enrichedMessage,
        };

        try {
            const res = await fetch("/api/v1/sponsor-inquiry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                setSubmitted(true);
                setSubmitting(false);
                return;
            }
        } catch {
            // fall through to mailto
        }

        const subject = encodeURIComponent(`World Cup Watch Party Package — ${form.company}`);
        const body = encodeURIComponent(
            `Venue / company: ${form.company}\nContact: ${form.contactName}\nEmail: ${form.email}\nPhone: ${form.phone}\nWebsite: ${form.website}\n\n${enrichedMessage}`,
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
                    <Link href="/for-venues" className="hp-back">← Back to For Venues</Link>
                    <span className="hp-kicker"><span className="bd" />World Cup Watch Party Package · June 11 – July 19</span>
                    <h1 className="hp-h1">Turn your venue into a <em>World Cup destination.</em></h1>
                    <p className="hp-sub">
                        A complete hospitality package for FIFA World Cup 2026. Landing page, reservation
                        system, 34 match-day pages, jersey parties, and a 35-campaign content calendar —
                        delivered before opening match.
                    </p>
                    <div className="hp-price-row">
                        <div className="hp-price">
                            <span className="v">$12,650</span>
                            <span className="l">Full June delivery</span>
                        </div>
                        <span className="hp-pitch">More fans · More reservations · More revenue · More exposure</span>
                    </div>
                    <div className="hp-cta-row">
                        <a href="#apply" className="hp-btn primary">Apply for the package →</a>
                        <a href="#deliverables" className="hp-btn">See what&apos;s included</a>
                    </div>
                    <div className="hp-stats" style={{ marginTop: 32 }}>
                        <div className="hp-stat"><div className="v">9</div><div className="l">Deliverables</div></div>
                        <div className="hp-stat"><div className="v">34</div><div className="l">WC match days</div></div>
                        <div className="hp-stat"><div className="v">10</div><div className="l">Jersey parties</div></div>
                        <div className="hp-stat"><div className="v">35</div><div className="l">Content campaigns</div></div>
                    </div>
                </div>
            </section>

            <div className="hp-wrap">
                {/* Deliverables */}
                <section className="hp-sec" id="deliverables" style={{ borderTop: 0 }}>
                    <div className="hp-sh">
                        <div>
                            <div className="hp-st">What you get <span className="tag">9 deliverables</span></div>
                            <p className="hp-sh-sub">Everything in the base $12,650 package. Video production is offered separately as an add-on.</p>
                        </div>
                    </div>
                    <div className="hp-deliv">
                        {DELIVERABLES.map((d) => (
                            <div key={d.n} className="hp-dcard">
                                <div className="n">{d.n}</div>
                                <h3>{d.title}</h3>
                                <p>{d.body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Reservation tiers */}
                <section className="hp-sec">
                    <div className="hp-sh">
                        <div>
                            <div className="hp-st">Reservation tiers <span className="tag">6 packages</span></div>
                            <p className="hp-sh-sub">Match-night reservation flows that let you fill every seat — from walk-in tables to private buyouts.</p>
                        </div>
                    </div>
                    <div className="hp-res">
                        {RESERVATION_TIERS.map((t) => (
                            <div key={t.name} className="hp-rcard">
                                <div className="nm">{t.name}</div>
                                <p className="ln">{t.line}</p>
                            </div>
                        ))}
                    </div>
                    <div className="hp-platforms">
                        <span>Integrates with</span>
                        <span>OpenTable</span><span>Toast</span><span>Resy</span>
                        <span>SevenRooms</span><span>Eventbrite</span><span>Custom booking</span>
                    </div>
                </section>

                {/* Jersey parties */}
                <section className="hp-sec">
                    <div className="hp-sh">
                        <div>
                            <div className="hp-st">Jersey Party Campaign <span className="tag">10 themed nights</span></div>
                            <p className="hp-sh-sub">Pre-built themed events with prizes, contests, and giveaways. Each event drops on your venue page and across MatchWatch.</p>
                        </div>
                    </div>
                    <div className="hp-jp">
                        {JERSEY_PARTIES.map((j) => (
                            <div key={j.title} className="hp-jcard">
                                <h3>{j.title}</h3>
                                <p className="nt">{j.note}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Content calendar */}
                <section className="hp-sec">
                    <div className="hp-sh">
                        <div>
                            <div className="hp-st">Social-media content <span className="tag">35 campaigns</span></div>
                            <p className="hp-sh-sub">Pre-built post templates covering every stage of the tournament. Copy text and download branded images straight from your dashboard.</p>
                        </div>
                    </div>
                    <div className="hp-cc">
                        {CONTENT_CAMPAIGNS.map((col) => (
                            <div key={col.category} className="hp-ccol">
                                <h3>{col.category}</h3>
                                <ul>
                                    {col.ideas.map((i) => <li key={i}>{i}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Revenue */}
                <section className="hp-sec">
                    <div className="hp-sh">
                        <div>
                            <div className="hp-st">Revenue opportunities</div>
                            <p className="hp-sh-sub">Every match becomes a revenue moment. The package wires up the flows; you set the prices.</p>
                        </div>
                    </div>
                    <div className="hp-rev">
                        {REVENUE_LINES.map((r) => <span key={r} className="hp-rchip">{r}</span>)}
                    </div>
                </section>

                {/* Video add-ons */}
                <section className="hp-sec">
                    <div className="hp-sh">
                        <div>
                            <div className="hp-st">Video production <span className="tag">Optional add-on</span></div>
                            <p className="hp-sh-sub">Not included in the base package. Pick the videos that fit your social plan — pricing is per item.</p>
                        </div>
                    </div>
                    <div className="hp-vid">
                        {VIDEO_ADDONS.map((v) => (
                            <div key={v.name} className="hp-vcard">
                                <h3>{v.name}</h3>
                                <div className="pr">{v.price}</div>
                                <p>{v.body}</p>
                            </div>
                        ))}
                    </div>
                    <p className="hp-vid-foot">
                        Bundles available · 4 social videos = $1,500 (save $496) · Premium sales video = $1,500
                    </p>
                </section>

                {/* FAQ */}
                <section className="hp-sec">
                    <div className="hp-sh">
                        <div>
                            <div className="hp-st">Investment &amp; FAQ</div>
                        </div>
                    </div>
                    <div className="hp-faq">
                        {FAQS.map((f) => (
                            <details key={f.q} className="hp-fq">
                                <summary>{f.q}</summary>
                                <div className="hp-fq-body">{f.a}</div>
                            </details>
                        ))}
                    </div>
                </section>

                {/* Lead form */}
                <section className="hp-sec" id="apply">
                    {submitted ? (
                        <div className="hp-thanks">
                            <div className="glyph">⚽</div>
                            <h2>Thank you, {form.company}!</h2>
                            <p>
                                We&apos;ve received your World Cup package inquiry. Hamid will reach out to{" "}
                                <strong style={{ color: "var(--mw-fg)" }}>{form.email}</strong> within 24 hours to walk through delivery timing and final terms.
                            </p>
                            <Link href="/for-venues" className="hp-submit" style={{ display: "inline-block", textDecoration: "none" }}>Back to For Venues →</Link>
                        </div>
                    ) : (
                        <div className="hp-form-card">
                            <h2>Apply for the package</h2>
                            <p className="sub">
                                Tell us about your venue and we&apos;ll be in touch within 24 hours. To launch on schedule
                                for June 11, we need hosting access or one day at your office in the next two weeks.
                            </p>
                            <form className="hp-form" onSubmit={handleSubmit}>
                                <div className="hp-fld-row">
                                    <div>
                                        <label className="hp-fld-label" htmlFor="wp-company">Venue / company *</label>
                                        <input id="wp-company" className="hp-fld" value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Sport PBR" required />
                                    </div>
                                    <div>
                                        <label className="hp-fld-label" htmlFor="wp-contact">Contact name</label>
                                        <input id="wp-contact" className="hp-fld" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Your full name" />
                                    </div>
                                </div>

                                <div className="hp-fld-row">
                                    <div>
                                        <label className="hp-fld-label" htmlFor="wp-email">Email *</label>
                                        <input id="wp-email" className="hp-fld" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@venue.com" required />
                                    </div>
                                    <div>
                                        <label className="hp-fld-label" htmlFor="wp-phone">Phone</label>
                                        <input id="wp-phone" className="hp-fld" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 (555) 000-0000" />
                                    </div>
                                </div>

                                <div>
                                    <label className="hp-fld-label" htmlFor="wp-website">Website</label>
                                    <input id="wp-website" className="hp-fld" type="url" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://yourvenue.com" />
                                </div>

                                <div className="hp-fld-row">
                                    <div>
                                        <label className="hp-fld-label" htmlFor="wp-capacity">Venue capacity</label>
                                        <input id="wp-capacity" className="hp-fld" value={form.venueCapacity} onChange={(e) => update("venueCapacity", e.target.value)} placeholder="e.g. 150" />
                                    </div>
                                    <div>
                                        <label className="hp-fld-label" htmlFor="wp-party">Typical match-night party size</label>
                                        <input id="wp-party" className="hp-fld" value={form.partySize} onChange={(e) => update("partySize", e.target.value)} placeholder="e.g. 4–6 guests / table" />
                                    </div>
                                </div>

                                <div>
                                    <label className="hp-fld-label" htmlFor="wp-matches">Which matches are you most interested in hosting?</label>
                                    <input id="wp-matches" className="hp-fld" value={form.matchInterest} onChange={(e) => update("matchInterest", e.target.value)} placeholder="e.g. USA group stage, Mexico matches, the Final" />
                                </div>

                                <div>
                                    <label className="hp-fld-label" htmlFor="wp-message">Anything else?</label>
                                    <textarea id="wp-message" className="hp-fld" value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="Tell us about your goals, current setup, video add-on interest, etc." />
                                </div>

                                {error && <p className="hp-error">{error}</p>}

                                <button type="submit" className="hp-submit" disabled={submitting}>
                                    {submitting ? "Sending…" : "Apply for the package →"}
                                </button>

                                <p className="hp-altmail">
                                    Or email Hamid directly at <a href="mailto:sponsors@matchwatch.us">sponsors@matchwatch.us</a>
                                </p>
                            </form>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

export default function WatchPartyPackagePage() {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />}>
            <WatchPartyPackageContent />
        </Suspense>
    );
}
