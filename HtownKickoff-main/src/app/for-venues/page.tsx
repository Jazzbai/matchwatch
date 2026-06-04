"use client";

import Link from "next/link";
import {
    BarChart3,
    Building2,
    CalendarDays,
    Check,
    CheckCircle2,
    Megaphone,
    Package,
    Star,
    Ticket,
    Trophy,
    TrendingUp,
    type LucideIcon,
} from "lucide-react";
import { FloatingNav } from "../../components/AppShell";

type Pkg = {
    num: string;
    name: string;
    price: number;
    tagline: string;
    features: string[];
    bestFor: string;
    feat?: boolean;
    tag?: string;
};

const FREE_FEATURES: Array<{ icon: LucideIcon; title: string; desc: string }> = [
    { icon: TrendingUp, title: "Increase visibility", desc: "Get featured in our directory and reach fans actively searching for watch parties near them." },
    { icon: CalendarDays, title: "Manage events", desc: "Create events for any match, set capacity limits, booking fees, and special notes." },
    { icon: Ticket, title: "Handle bookings", desc: "Accept reservations, manage guest lists, and track attendance — all from your dashboard." },
    { icon: Megaphone, title: "Promote to fans", desc: "Post updates, special offers, and match-day promotions directly to your followers." },
    { icon: BarChart3, title: "Track analytics", desc: "View booking trends, follower growth, and revenue reports at a glance." },
    { icon: CheckCircle2, title: "Get verified", desc: "Earn a verified badge to show fans you're a trusted, quality venue." },
];

const MATCHPOINT_PACKAGES: Pkg[] = [
    {
        num: "01",
        name: "MatchPoint Starter Booth",
        price: 150,
        tagline: "Best for restaurants that want a simple promotional setup.",
        features: [
            "Standard photo-shoot booth setup",
            "MatchWatch banner / signage",
            "Schedule sign for restaurant display",
            "Website theme alignment for MatchPoint listing",
            "Basic venue / event visibility on MatchWatch",
        ],
        bestFor: "restaurants starting watch-party promotion",
    },
    {
        num: "02",
        name: "MatchPoint Reservation + Social Boost",
        price: 2000,
        tagline: "Best for venues that want bookings and social media promotion.",
        features: [
            "Everything in Starter Booth",
            "Reservation plugin setup",
            "Watch-party booking section",
            "6 promotional reels",
            "16 story posts",
            "MatchPoint landing page connection",
            "Event schedule promotion on MatchWatch",
        ],
        bestFor: "restaurants that want reservations and social traffic",
        feat: true,
        tag: "Most popular",
    },
    {
        num: "03",
        name: "MatchPoint Premium Venue Story",
        price: 3000,
        tagline: "Best for venues that want professional video and stronger branding.",
        features: [
            "Everything in Reservation + Social Boost",
            "On-site venue video recording",
            "Interview with venue owner / manager",
            "Stadium-style watch-party video concept",
            "Venue atmosphere shots",
            "Premium promotional content for MatchWatch, Instagram, and website",
        ],
        bestFor: "restaurants that want to become a featured watch-party destination",
    },
];

const WC_HIGHLIGHTS = [
    "World Cup landing page for your venue",
    "Reservation system (Reserve / VIP / Private / Group / Corporate / Waitlist)",
    "34 match-day pages with kickoff + crests + specials",
    "10 jersey-party themed events",
    "35-campaign social-media content calendar",
    "Featured placement on city + home pages",
    "Optional video add-ons ($499 – $1,500)",
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
  .hp-wrap{max-width:1180px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  /* Hero */
  .hp-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mw-line);min-height:480px;display:flex;align-items:center;}
  .hp-hero-bg{position:absolute;inset:0;background:#06070a url(/home-hero.webp) center/cover no-repeat;}
  .hp-hero-scrim{position:absolute;inset:0;background:linear-gradient(110deg,rgba(6,7,10,0.94) 0%,rgba(6,7,10,0.78) 40%,rgba(6,7,10,0.45) 100%),linear-gradient(0deg,var(--mw-bg) 2%,transparent 40%);}
  .hp-hero-inner{position:relative;z-index:2;max-width:1180px;margin-inline:auto;width:100%;padding:140px clamp(16px,4vw,28px) 56px;}
  .hp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mw-accent) 32%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:20px;}
  .hp-kicker .bd{width:6px;height:6px;border-radius:50%;background:var(--mw-accent);animation:hpPulse 1.4s ease-in-out infinite;}
  @keyframes hpPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
  .hp-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2.4rem,6vw,4rem);line-height:1;letter-spacing:-0.025em;margin:0 0 16px;color:#fff;max-width:780px;text-wrap:balance;}
  .hp-h1 em{font-style:normal;color:var(--mw-accent);}
  .hp-sub{max-width:620px;font-size:1.05rem;line-height:1.55;color:rgba(255,255,255,0.85);margin:0 0 28px;}

  /* Tier picker */
  .hp-tierpick{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px;}
  @media(max-width:760px){.hp-tierpick{grid-template-columns:1fr;}}
  .hp-tierpick a{display:flex;flex-direction:column;gap:6px;padding:18px 20px;border-radius:14px;border:1px solid rgba(255,255,255,0.18);background:rgba(0,0,0,0.32);backdrop-filter:blur(8px);color:#fff;text-decoration:none;transition:all .18s;}
  .hp-tierpick a:hover{border-color:var(--mw-accent);transform:translateY(-2px);}
  .hp-tierpick .lbl{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--mw-accent);font-weight:800;}
  .hp-tierpick .nm{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:17px;}
  .hp-tierpick .pr{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:13px;color:rgba(255,255,255,0.7);}

  /* Sections */
  .hp-sec{padding:64px 0;border-top:1px solid var(--mw-line);scroll-margin-top:88px;}
  .hp-sh{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:26px;flex-wrap:wrap;}
  .hp-st{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.7rem;letter-spacing:-0.01em;display:flex;align-items:center;gap:12px;}
  .hp-st .tag{font-family:var(--font-mono),monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;color:var(--mw-accent);border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:6px;}
  .hp-sh-sub{font-size:14.5px;color:var(--mw-dim);margin:8px 0 0;max-width:680px;line-height:1.55;}
  .hp-tag-pill{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--mw-accent);border:1px solid color-mix(in srgb,var(--mw-accent) 38%,transparent);padding:5px 12px;border-radius:999px;background:color-mix(in srgb,var(--mw-accent) 8%,transparent);margin-bottom:12px;font-weight:800;}

  /* Feature grid (free tier) */
  .hp-feats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
  @media(max-width:900px){.hp-feats{grid-template-columns:repeat(2,1fr);}}
  @media(max-width:560px){.hp-feats{grid-template-columns:1fr;}}
  .hp-fcard{padding:22px;border-radius:14px;border:1px solid var(--mw-line);background:var(--mw-card);}
  .hp-fcard .icon{width:44px;height:44px;border-radius:12px;background:color-mix(in srgb,var(--mw-accent) 14%,transparent);display:grid;place-items:center;color:var(--mw-accent);margin-bottom:14px;}
  .hp-fcard h3{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:15.5px;margin:0 0 6px;}
  .hp-fcard p{font-size:13px;color:var(--mw-dim);line-height:1.55;margin:0;}

  /* MatchPoint packages */
  .hp-mp{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
  @media(max-width:1024px){.hp-mp{grid-template-columns:1fr;max-width:560px;margin-inline:auto;}}
  .hp-mpcard{position:relative;padding:28px 26px;border-radius:18px;border:1px solid var(--mw-line);background:var(--mw-card);display:flex;flex-direction:column;gap:16px;transition:all .18s;}
  .hp-mpcard:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--mw-accent) 40%,var(--mw-line));box-shadow:0 14px 36px rgba(0,0,0,0.3);}
  .hp-mpcard.feat{border-color:color-mix(in srgb,var(--mw-accent) 55%,var(--mw-line));background:linear-gradient(160deg,color-mix(in srgb,var(--mw-accent) 8%,transparent) 0%,var(--mw-card) 60%);box-shadow:0 12px 36px color-mix(in srgb,var(--mw-accent) 16%,transparent);}
  .hp-mptag{position:absolute;top:-12px;left:24px;font-family:var(--font-mono),monospace;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;color:var(--mw-ink);background:var(--mw-accent);padding:5px 11px;border-radius:999px;display:inline-flex;align-items:center;gap:5px;}
  .hp-mpname{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.3rem;color:var(--mw-fg);letter-spacing:-0.01em;margin:0;}
  .hp-mppkg{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--mw-dim);margin-bottom:4px;}
  .hp-mpprice{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:2.4rem;line-height:1;color:var(--mw-accent);letter-spacing:-0.02em;}
  .hp-mpprice small{font-size:0.85rem;font-weight:600;color:var(--mw-dim);margin-left:6px;letter-spacing:0;}
  .hp-mpbest{font-size:0.92rem;color:var(--mw-dim);line-height:1.5;font-style:italic;border-left:2px solid color-mix(in srgb,var(--mw-accent) 50%,transparent);padding-left:10px;margin:0;}
  .hp-mpinc-label{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--mw-dim);}
  .hp-mpinc{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px;}
  .hp-mpinc li{display:flex;gap:10px;font-size:0.9rem;color:var(--mw-fg);line-height:1.45;}
  .hp-mpinc li svg{flex-shrink:0;color:var(--mw-accent);margin-top:2px;}
  .hp-mpfoot{margin-top:auto;padding-top:14px;border-top:1px dashed var(--mw-line);font-size:0.82rem;color:var(--mw-dim);line-height:1.5;}
  .hp-mpfoot b{color:var(--mw-fg);font-weight:700;}

  /* WC Package row */
  .hp-wc{position:relative;border-radius:18px;border:1px solid color-mix(in srgb,var(--mw-accent) 38%,var(--mw-line));overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--mw-accent) 11%,transparent) 0%,var(--mw-card) 65%);}
  .hp-wc-inner{padding:36px clamp(20px,4vw,40px);display:grid;grid-template-columns:1.3fr 1fr;gap:36px;align-items:start;}
  @media(max-width:900px){.hp-wc-inner{grid-template-columns:1fr;}}
  .hp-wc-price{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2.4rem,5vw,3.6rem);color:var(--mw-accent);line-height:1;letter-spacing:-0.02em;margin:0 0 10px;}
  .hp-wc-price small{font-size:0.85rem;font-weight:600;color:var(--mw-dim);margin-left:8px;letter-spacing:0;}
  .hp-wc-h{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.4rem;color:var(--mw-fg);margin:0 0 8px;}
  .hp-wc-p{font-size:14.5px;color:var(--mw-dim);line-height:1.55;margin:0 0 16px;}
  .hp-wc-inc{list-style:none;padding:0;margin:0;display:grid;gap:9px;}
  .hp-wc-inc li{display:flex;gap:10px;font-size:0.92rem;color:var(--mw-fg);line-height:1.45;}
  .hp-wc-inc li svg{flex-shrink:0;color:var(--mw-accent);margin-top:2px;}
  .hp-wc-cta-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px;}

  /* Buttons */
  .hp-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;border:1px solid var(--mw-line);color:var(--mw-fg);transition:all .18s;cursor:pointer;font-family:inherit;background:transparent;}
  .hp-btn:hover{border-color:var(--mw-accent);}
  .hp-btn.primary{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}
  .hp-btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}
  .hp-btn.hero-primary{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}
  .hp-btn.hero-primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}
  .hp-btn.hero-ghost{border-color:rgba(255,255,255,0.22);color:#fff;}
  .hp-btn.hero-ghost:hover{border-color:rgba(255,255,255,0.55);}

  /* Final CTA band */
  .hp-band{border:1px solid var(--mw-line);border-radius:18px;background:linear-gradient(120deg,color-mix(in srgb,var(--mw-accent) 10%,transparent),transparent 60%),var(--mw-card);padding:42px clamp(24px,4vw,48px);text-align:center;}
  .hp-band h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.6rem;margin:0 0 10px;}
  .hp-band p{font-size:14.5px;color:var(--mw-dim);margin:0 0 22px;max-width:560px;margin-inline:auto;line-height:1.55;}

  @media(max-width:760px){
    .hp-hero-inner{padding:120px 16px 44px;}
    .hp-sec{padding:48px 0;}
  }
`;

export default function ForVenuesPage() {
    return (
        <div className="hp">
            <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
            <FloatingNav />

            {/* Hero */}
            <section className="hp-hero">
                <div className="hp-hero-bg" />
                <div className="hp-hero-scrim" />
                <div className="hp-hero-inner">
                    <span className="hp-kicker"><span className="bd" />For venue owners · World Cup 2026</span>
                    <h1 className="hp-h1">List your venue. <em>Choose your tier.</em></h1>
                    <p className="hp-sub">
                        Three ways to put your bar on MatchWatch — free listing, MatchPoint Creator
                        Packages, or the full World Cup hospitality package. Pick the one that fits
                        your goals; upgrade any time.
                    </p>
                    <div className="hp-tierpick">
                        <a href="#free">
                            <span className="lbl">Tier 1</span>
                            <span className="nm">Free listing</span>
                            <span className="pr">$0 forever</span>
                        </a>
                        <a href="#matchpoint">
                            <span className="lbl">Tier 2</span>
                            <span className="nm">MatchPoint Packages</span>
                            <span className="pr">$150 – $3,000 one-time</span>
                        </a>
                        <a href="#wc-package">
                            <span className="lbl">Tier 3 · Premium</span>
                            <span className="nm">WC Watch Party Package</span>
                            <span className="pr">$12,650 full delivery</span>
                        </a>
                    </div>
                </div>
            </section>

            <div className="hp-wrap">
                {/* ─── Tier 1: Free Listing ─── */}
                <section className="hp-sec" id="free" style={{ borderTop: 0 }}>
                    <div className="hp-sh">
                        <div>
                            <span className="hp-tag-pill">Tier 1 · $0</span>
                            <div className="hp-st">Free listing <span className="tag">Always free</span></div>
                            <p className="hp-sh-sub">
                                Get discovered by football fans planning their next watch party. Free to list — no contracts, no setup fees, no commission on bookings.
                            </p>
                        </div>
                        <Link href="/for-venues/register" className="hp-btn primary">
                            <Building2 size={15} /> List your venue (Free)
                        </Link>
                    </div>
                    <div className="hp-feats">
                        {FREE_FEATURES.map((f) => (
                            <div key={f.title} className="hp-fcard">
                                <div className="icon"><f.icon size={20} /></div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ─── Tier 2: MatchPoint Creator Packages ─── */}
                <section className="hp-sec" id="matchpoint">
                    <div className="hp-sh">
                        <div>
                            <span className="hp-tag-pill">Tier 2 · One-time</span>
                            <div className="hp-st">MatchPoint Creator Packages <span className="tag">3 packages</span></div>
                            <p className="hp-sh-sub">
                                One-time setups to turn your venue into a featured MatchWatch destination — signage, reservations, social content, or premium video. Pick what you need; everything else stays free.
                            </p>
                        </div>
                    </div>

                    <div className="hp-mp">
                        {MATCHPOINT_PACKAGES.map((p) => (
                            <article key={p.num} className={`hp-mpcard${p.feat ? " feat" : ""}`}>
                                {p.tag && (
                                    <span className="hp-mptag">
                                        <Star size={10} style={{ display: "inline" }} />
                                        {p.tag}
                                    </span>
                                )}
                                <div>
                                    <div className="hp-mppkg">Package {p.num}</div>
                                    <h3 className="hp-mpname">{p.name}</h3>
                                </div>
                                <div className="hp-mpprice">
                                    ${p.price.toLocaleString()}<small>one-time</small>
                                </div>
                                <p className="hp-mpbest">{p.tagline}</p>
                                <div>
                                    <div className="hp-mpinc-label" style={{ marginBottom: 8 }}>Includes</div>
                                    <ul className="hp-mpinc">
                                        {p.features.map((f) => (
                                            <li key={f}>
                                                <Check size={16} />
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="hp-mpfoot">
                                    <b>Best for:</b> {p.bestFor}.
                                </div>
                                <Link href="/for-venues/register?package=matchpoint" className={`hp-btn${p.feat ? " primary" : ""}`}>
                                    Choose this package →
                                </Link>
                            </article>
                        ))}
                    </div>
                </section>

                {/* ─── Tier 3: WC Watch Party Package ─── */}
                <section className="hp-sec" id="wc-package">
                    <div className="hp-sh">
                        <div>
                            <span className="hp-tag-pill"><Trophy size={11} /> Tier 3 · World Cup premium</span>
                            <div className="hp-st">World Cup Watch Party Package <span className="tag">June 11 – July 19</span></div>
                            <p className="hp-sh-sub">
                                The full hospitality build for World Cup 2026. Your own WC microsite, reservation tiers, 34 match-day pages, 10 jersey parties, and a 35-campaign content calendar — all delivered before opening match.
                            </p>
                        </div>
                    </div>

                    <div className="hp-wc">
                        <div className="hp-wc-inner">
                            <div>
                                <div className="hp-wc-price">$12,650<small>full June delivery</small></div>
                                <h3 className="hp-wc-h">Turn your venue into a World Cup destination.</h3>
                                <p className="hp-wc-p">
                                    More fans. More reservations. More revenue. More exposure. Designed to capture the World Cup's once-in-four-years traffic with a complete venue activation — not just a listing.
                                </p>
                                <div className="hp-wc-cta-row">
                                    <Link href="/for-venues/watch-party-package?ref=for-venues" className="hp-btn primary">
                                        <Package size={15} /> See full package details →
                                    </Link>
                                    <Link href="/for-venues/watch-party-package?ref=for-venues#apply" className="hp-btn">
                                        Apply now
                                    </Link>
                                </div>
                            </div>
                            <div>
                                <div className="hp-mpinc-label" style={{ marginBottom: 10 }}>What you get</div>
                                <ul className="hp-wc-inc">
                                    {WC_HIGHLIGHTS.map((h) => (
                                        <li key={h}>
                                            <Check size={16} />
                                            <span>{h}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="hp-sec">
                    <div className="hp-band">
                        <h2>Not sure which tier fits?</h2>
                        <p>
                            Start free — you can always upgrade to a MatchPoint package or the full World Cup hospitality build. Most venues list free, then add a tier when match days approach.
                        </p>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                            <Link href="/for-venues/register" className="hp-btn primary">
                                <Building2 size={15} /> List your venue (Free)
                            </Link>
                            <Link href="/contact" className="hp-btn">Talk to us</Link>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
