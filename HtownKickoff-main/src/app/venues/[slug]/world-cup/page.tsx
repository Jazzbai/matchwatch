"use client";

import React, { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FloatingNav } from "../../../../components/AppShell";
import { BookingDrawer } from "../../../../components/BookingDrawer";
import { Countdown } from "../../../../components/Countdown";
import { api } from "../../../../lib/api";
import { isWorldCupLeague } from "../../../../lib/league-utils";

type WorldCupConfig = {
    enabled?: boolean;
    heroHeadline?: string | null;
    heroSub?: string | null;
    faqs?: Array<{ q: string; a: string }>;
    specials?: Array<{ title: string; desc?: string | null; price?: string | null }>;
    sponsors?: Array<{ name: string; logoUrl?: string | null; tier?: string }>;
};

type VenueRow = {
    id: string;
    name: string;
    slug: string;
    coverImageUrl?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    website?: string | null;
    worldCup?: WorldCupConfig | null;
};

type VenuePackage = {
    id: string;
    name: string;
    description?: string | null;
    price: string;
    currency?: string | null;
    maxPartySize?: number | null;
    inclusions?: string[] | null;
};

type VenueMatchEvent = {
    id: string;
    matchId: string;
    isActive: boolean;
    bookingLimit?: number | null;
    confirmedBookingsCount?: number | null;
    specialNotes?: string | null;
    customPrice?: string | number | null;
    doorsOpenAt?: string | null;
    requiresApproval?: boolean;
    match?: {
        id: string;
        homeTeamId?: string | null;
        awayTeamId?: string | null;
        homeTeamName?: string | null;
        awayTeamName?: string | null;
        homeTeamCrestUrl?: string | null;
        awayTeamCrestUrl?: string | null;
        homeScore?: number | null;
        awayScore?: number | null;
        matchDateUtc: string;
        status: string;
        venueName?: string | null;
        eventFormat?: "HEAD_TO_HEAD" | "SINGLE_EVENT" | null;
        league?: { id?: string; name?: string | null; shortName?: string | null; externalId?: string | null } | null;
    };
};

type MenuItem = {
    id: string;
    name: string;
    description?: string | null;
    price: string | number;
    isFeatured?: boolean | null;
};
type MenuCategory = { id: string; name: string; items: MenuItem[] };

const MW_VARS = `
  :root{
    --mw-bg:var(--background);--mw-card:var(--card);--mw-line:var(--border);
    --mw-fg:var(--foreground);--mw-dim:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);--mw-ink:#0a0b0d;
  }
`;

const CSS = `
  .hp{background:var(--mw-bg);color:var(--mw-fg);min-height:100vh;}
  .hp-wrap{max-width:1100px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  /* Hero */
  .hp-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mw-line);min-height:540px;display:flex;align-items:center;}
  .hp-hero-bg{position:absolute;inset:0;background-color:#06070a;background-position:center;background-size:cover;background-repeat:no-repeat;}
  .hp-hero-bg.fallback{background-image:url(/home-hero.webp);}
  .hp-hero-scrim{position:absolute;inset:0;background:linear-gradient(110deg,rgba(6,7,10,0.94) 0%,rgba(6,7,10,0.78) 40%,rgba(6,7,10,0.40) 100%),linear-gradient(0deg,var(--mw-bg) 2%,transparent 40%);}
  .hp-hero-inner{position:relative;z-index:2;max-width:1100px;margin-inline:auto;width:100%;padding:140px clamp(16px,4vw,28px) 56px;}
  .hp-bc{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:18px;}
  .hp-bc a{color:rgba(255,255,255,0.7);text-decoration:none;}
  .hp-bc a:hover{color:#fff;}
  .hp-bc .sep{opacity:.5;}
  .hp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mw-accent) 32%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:20px;}
  .hp-kicker .bd{width:6px;height:6px;border-radius:50%;background:var(--mw-accent);animation:hpPulse 1.4s ease-in-out infinite;}
  @keyframes hpPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
  .hp-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2.4rem,6vw,4rem);line-height:1;letter-spacing:-0.025em;margin:0 0 14px;color:#fff;max-width:780px;text-wrap:balance;}
  .hp-h1 em{font-style:normal;color:var(--mw-accent);}
  .hp-sub{max-width:620px;font-size:1.02rem;line-height:1.55;color:rgba(255,255,255,0.85);margin:0 0 24px;}
  .hp-meta{display:flex;flex-wrap:wrap;gap:14px;font-family:var(--font-mono),monospace;font-size:11.5px;color:rgba(255,255,255,0.75);letter-spacing:0.04em;margin-bottom:24px;}
  .hp-meta span{display:inline-flex;align-items:center;gap:6px;}
  .hp-cta-row{display:flex;flex-wrap:wrap;gap:12px;}
  .hp-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;border:1px solid rgba(255,255,255,0.22);color:#fff;transition:all .18s;cursor:pointer;font-family:inherit;background:transparent;}
  .hp-btn:hover{border-color:rgba(255,255,255,0.5);}
  .hp-btn.primary{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}
  .hp-btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}

  /* Sections */
  .hp-sec{padding:56px 0;border-top:1px solid var(--mw-line);}
  .hp-sh{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap;}
  .hp-st{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.5rem;letter-spacing:-0.01em;display:flex;align-items:center;gap:12px;}
  .hp-st .tag{font-family:var(--font-mono),monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;color:var(--mw-accent);border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:6px;}
  .hp-sh-sub{font-size:14px;color:var(--mw-dim);margin:8px 0 0;max-width:640px;line-height:1.55;}

  /* Match cards */
  .hp-mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;}
  .hp-mcard{border:1px solid var(--mw-line);border-radius:14px;background:var(--mw-card);padding:18px;display:flex;flex-direction:column;gap:12px;text-decoration:none;color:inherit;transition:all .15s;}
  .hp-mcard:hover{border-color:color-mix(in srgb,var(--mw-accent) 45%,var(--mw-line));transform:translateY(-2px);box-shadow:0 10px 24px color-mix(in srgb,var(--mw-accent) 14%,transparent);}
  .hp-mcard .top{display:flex;align-items:center;justify-content:space-between;font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--mw-dim);}
  .hp-mcard .top .tag-wc{color:var(--mw-accent);font-weight:800;}
  .hp-mteams{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;}
  .hp-mteam{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;}
  .hp-mteam img{width:42px;height:42px;object-fit:contain;}
  .hp-mcrest{width:42px;height:42px;border-radius:10px;background:var(--mw-bg);display:grid;place-items:center;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;color:var(--mw-accent);font-size:14px;}
  .hp-mtnm{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:13px;line-height:1.2;}
  .hp-mvs{font-family:var(--font-mono),monospace;font-size:11px;color:var(--mw-dim);font-weight:700;}
  .hp-mfoot{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px dashed var(--mw-line);font-size:12px;color:var(--mw-dim);}
  .hp-mfoot .go{color:var(--mw-accent);font-weight:800;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;}
  .hp-mnote{font-size:12.5px;color:var(--mw-fg);line-height:1.45;border-top:1px dashed var(--mw-line);padding-top:10px;}

  /* Packages */
  .hp-pkgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}
  .hp-pkg{padding:20px;border-radius:12px;border:1px solid var(--mw-line);background:var(--mw-card);display:flex;flex-direction:column;gap:8px;}
  .hp-pkg .nm{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:15px;margin:0;}
  .hp-pkg .pr{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;color:var(--mw-accent);font-size:22px;margin:0;}
  .hp-pkg .pr small{font-size:12px;font-weight:600;color:var(--mw-dim);margin-left:4px;}
  .hp-pkg .desc{font-size:13px;color:var(--mw-dim);line-height:1.5;margin:0;}
  .hp-pkg ul{list-style:none;padding:0;margin:6px 0 0;display:grid;gap:4px;}
  .hp-pkg li{font-size:12px;color:var(--mw-fg);display:flex;align-items:flex-start;gap:6px;line-height:1.4;}
  .hp-pkg li::before{content:"✓";color:var(--mw-accent);font-weight:800;flex-shrink:0;}

  /* Specials */
  .hp-spec{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}
  .hp-scard{padding:18px 20px;border-radius:12px;border:1px solid var(--mw-line);background:var(--mw-card);}
  .hp-scard .nm{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:14.5px;margin:0 0 4px;}
  .hp-scard .pr{color:var(--mw-accent);font-weight:800;font-family:var(--font-mono),monospace;font-size:13px;}
  .hp-scard .desc{font-size:12.5px;color:var(--mw-dim);line-height:1.5;margin:4px 0 0;}

  /* Sponsors */
  .hp-spn{display:flex;flex-wrap:wrap;gap:14px;align-items:center;}
  .hp-spn-item{padding:14px 22px;border-radius:12px;border:1px solid var(--mw-line);background:var(--mw-card);font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:13px;display:inline-flex;align-items:center;gap:10px;}
  .hp-spn-item img{height:24px;width:auto;object-fit:contain;}

  /* FAQ */
  .hp-faq{display:grid;gap:10px;}
  .hp-fq{border:1px solid var(--mw-line);border-radius:12px;background:var(--mw-card);overflow:hidden;}
  .hp-fq summary{cursor:pointer;padding:18px 22px;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:15px;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:18px;}
  .hp-fq summary::-webkit-details-marker{display:none;}
  .hp-fq summary::after{content:"+";color:var(--mw-accent);font-size:22px;font-weight:300;line-height:1;}
  .hp-fq[open] summary::after{content:"–";}
  .hp-fq-body{padding:0 22px 20px;font-size:14px;color:var(--mw-dim);line-height:1.6;}

  .hp-empty{padding:36px 20px;text-align:center;border:1px dashed var(--mw-line);border-radius:12px;color:var(--mw-dim);font-size:14px;}
  .hp-skel{height:140px;border-radius:12px;background:var(--mw-card);border:1px solid var(--mw-line);opacity:.5;}

  /* Sticky CTA band */
  .hp-band{border:1px solid var(--mw-line);border-radius:14px;background:linear-gradient(120deg,color-mix(in srgb,var(--mw-accent) 12%,transparent),transparent 60%),var(--mw-card);padding:32px clamp(20px,4vw,36px);display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;}
  .hp-band h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.5rem;margin:0 0 6px;}
  .hp-band p{font-size:14px;color:var(--mw-dim);margin:0;max-width:540px;}
  .hp-band-cta{padding:13px 24px;border-radius:999px;background:var(--mw-accent);color:var(--mw-ink);font-weight:800;text-decoration:none;font-size:14px;display:inline-flex;align-items:center;gap:8px;}

  @media(max-width:760px){
    .hp-hero-inner{padding:120px 16px 44px;}
    .hp-sec{padding:44px 0;}
  }
`;

function formatKickoff(dateUtc: string) {
    try {
        return new Date(dateUtc).toLocaleString(undefined, {
            weekday: "short", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return dateUtc;
    }
}

function VenueWorldCupContent({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);

    const [venue, setVenue] = useState<VenueRow | null>(null);
    const [events, setEvents] = useState<VenueMatchEvent[]>([]);
    const [packages, setPackages] = useState<VenuePackage[]>([]);
    const [menu, setMenu] = useState<MenuCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerEventIdx, setDrawerEventIdx] = useState(0);

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setLoadError(null);
            try {
                const [venueRes, eventsRes, packagesRes, menuRes] = await Promise.allSettled([
                    api.get<VenueRow>(`/venues/${slug}`),
                    api.get<VenueMatchEvent[]>(`/venues/${slug}/events?limit=40`),
                    api.get<VenuePackage[]>(`/venues/${slug}/packages`),
                    api.get<MenuCategory[]>(`/venues/${slug}/menu`),
                ]);
                if (!active) return;
                if (venueRes.status === "fulfilled" && venueRes.value.data) {
                    setVenue(venueRes.value.data);
                } else {
                    setLoadError("Venue not found");
                }
                if (eventsRes.status === "fulfilled") setEvents(eventsRes.value.data || []);
                if (packagesRes.status === "fulfilled") setPackages(packagesRes.value.data || []);
                if (menuRes.status === "fulfilled") setMenu(menuRes.value.data || []);
            } catch (err) {
                if (!active) return;
                setLoadError(err instanceof Error ? err.message : "Failed to load venue");
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [slug]);

    // Gate: the microsite only renders for venues whose owner has flipped
    // metadata.worldCup.enabled = true. Everything else 404s — matches the
    // plan's "404s if !worldCup.enabled" decision.
    useEffect(() => {
        if (!loading && (venue === null || venue?.worldCup?.enabled !== true)) {
            // Only redirect after the load completes AND venue isn't WC-enabled
            // (or doesn't exist). Avoid notFound() during the initial loading state.
            if (loadError === "Venue not found" || (venue && venue.worldCup?.enabled !== true)) {
                notFound();
            }
        }
    }, [loading, venue, loadError]);

    const wcEvents = useMemo(() => {
        return events
            .filter((ev) => ev.isActive)
            .filter((ev) => {
                if (!ev.match) return false;
                if (ev.match.eventFormat === "SINGLE_EVENT") return false;
                const lg = ev.match.league;
                return isWorldCupLeague(lg ? { name: lg.name || "", shortName: lg.shortName || "", externalId: lg.externalId || "" } : null);
            })
            .sort((a, b) => new Date(a.match!.matchDateUtc).getTime() - new Date(b.match!.matchDateUtc).getTime());
    }, [events]);

    const nextEvent = wcEvents[0];
    const featuredMenu = useMemo(() => {
        const items: Array<{ id: string; name: string; price: string | number; description?: string | null }> = [];
        for (const cat of menu) {
            for (const item of cat.items || []) {
                if (item.isFeatured) items.push(item);
            }
        }
        return items.slice(0, 8);
    }, [menu]);

    // Map a venue event into the shape BookingDrawer expects.
    const drawerMatch = useMemo(() => {
        const ev = wcEvents[drawerEventIdx];
        if (!ev || !ev.match) return null;
        const m = ev.match;
        return {
            eventFormat: "HEAD_TO_HEAD" as const,
            title: m.homeTeamName || "Home",
            subtitle: m.awayTeamName || "Away",
            homeTeam: m.homeTeamName || "Home",
            awayTeam: m.awayTeamName || "Away",
            homeCrest: m.homeTeamCrestUrl || undefined,
            awayCrest: m.awayTeamCrestUrl || undefined,
            kickoff: m.matchDateUtc,
            league: m.league?.name || "World Cup 2026",
        };
    }, [wcEvents, drawerEventIdx]);

    const drawerEvent = wcEvents[drawerEventIdx];
    const drawerSpotsRemaining = drawerEvent?.bookingLimit
        ? Math.max(0, drawerEvent.bookingLimit - Number(drawerEvent.confirmedBookingsCount || 0))
        : 999;
    const drawerEntryFee = drawerEvent?.customPrice ? Number(drawerEvent.customPrice) : undefined;

    if (loading) {
        return (
            <div className="hp">
                <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
                <FloatingNav />
                <section className="hp-hero">
                    <div className="hp-hero-bg fallback" />
                    <div className="hp-hero-scrim" />
                    <div className="hp-hero-inner">
                        <h1 className="hp-h1">Loading…</h1>
                    </div>
                </section>
            </div>
        );
    }

    if (!venue) return null;

    const cfg = venue.worldCup || {};
    const heroHeadline = cfg.heroHeadline || `${venue.name}'s World Cup HQ`;
    const heroSub = cfg.heroSub
        || `Watch every match of FIFA World Cup 2026 at ${venue.name}. Reserve your table, pick a jersey night, and join the fans.`;
    const fallbackHero = !venue.coverImageUrl;

    return (
        <div className="hp">
            <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
            <FloatingNav />

            {/* Hero */}
            <section className="hp-hero">
                <div
                    className={`hp-hero-bg${fallbackHero ? " fallback" : ""}`}
                    style={fallbackHero ? undefined : { backgroundImage: `url(${venue.coverImageUrl})` }}
                />
                <div className="hp-hero-scrim" />
                <div className="hp-hero-inner">
                    <div className="hp-bc">
                        <Link href={`/venues/${venue.slug || venue.id}`}>← {venue.name}</Link>
                        <span className="sep">/</span>
                        <span>World Cup 2026</span>
                    </div>
                    <span className="hp-kicker"><span className="bd" />World Cup 2026 · June 11 – July 19</span>
                    <h1 className="hp-h1">{heroHeadline}</h1>
                    <p className="hp-sub">{heroSub}</p>
                    <div className="hp-meta">
                        {venue.addressLine1 && <span>📍 {venue.addressLine1}{venue.city ? `, ${venue.city}` : ""}</span>}
                        {venue.phone && <span>📞 {venue.phone}</span>}
                        {nextEvent && <span>⚽ {wcEvents.length} match{wcEvents.length === 1 ? "" : "es"} hosted</span>}
                    </div>
                    {nextEvent && (
                        <div style={{ marginBottom: 24 }}>
                            <Countdown target={nextEvent.match!.matchDateUtc} label="Next match kickoff" accent="#fff" />
                        </div>
                    )}
                    <div className="hp-cta-row">
                        <button
                            type="button"
                            onClick={() => { setDrawerEventIdx(0); setDrawerOpen(true); }}
                            disabled={!nextEvent}
                            className="hp-btn primary"
                            style={!nextEvent ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                        >
                            Reserve a table →
                        </button>
                        {venue.website && (
                            <a href={venue.website} target="_blank" rel="noreferrer" className="hp-btn">Venue website</a>
                        )}
                    </div>
                </div>
            </section>

            <div className="hp-wrap">
                {/* Upcoming WC matches */}
                <section className="hp-sec" style={{ borderTop: 0 }} id="matches">
                    <div className="hp-sh">
                        <div>
                            <div className="hp-st">Upcoming matches <span className="tag">{wcEvents.length}</span></div>
                            <p className="hp-sh-sub">Every World Cup 2026 fixture being hosted at {venue.name}. Click a match for kickoff details and reservations.</p>
                        </div>
                        <Link href="/matches" className="hp-btn" style={{ borderColor: "var(--mw-line)", color: "var(--mw-fg)" }}>All fixtures →</Link>
                    </div>
                    {wcEvents.length === 0 ? (
                        <div className="hp-empty">No World Cup matches scheduled yet — check back closer to kickoff.</div>
                    ) : (
                        <div className="hp-mgrid">
                            {wcEvents.map((ev, idx) => {
                                const m = ev.match!;
                                return (
                                    <Link key={ev.id} href={`/venues/${venue.slug || venue.id}/world-cup/match/${m.id}`} className="hp-mcard">
                                        <div className="top">
                                            <span>{formatKickoff(m.matchDateUtc)}</span>
                                            <span className="tag-wc">WC 2026</span>
                                        </div>
                                        <div className="hp-mteams">
                                            <div className="hp-mteam">
                                                {m.homeTeamCrestUrl
                                                    ? <img src={m.homeTeamCrestUrl} alt="" />
                                                    : <span className="hp-mcrest">{(m.homeTeamName || "?").slice(0, 2).toUpperCase()}</span>}
                                                <span className="hp-mtnm">{m.homeTeamName || "TBD"}</span>
                                            </div>
                                            <span className="hp-mvs">VS</span>
                                            <div className="hp-mteam">
                                                {m.awayTeamCrestUrl
                                                    ? <img src={m.awayTeamCrestUrl} alt="" />
                                                    : <span className="hp-mcrest">{(m.awayTeamName || "?").slice(0, 2).toUpperCase()}</span>}
                                                <span className="hp-mtnm">{m.awayTeamName || "TBD"}</span>
                                            </div>
                                        </div>
                                        {ev.specialNotes && <div className="hp-mnote">{ev.specialNotes}</div>}
                                        <div className="hp-mfoot">
                                            <span>{ev.bookingLimit ? `${Math.max(0, ev.bookingLimit - Number(ev.confirmedBookingsCount || 0))} spots left` : "Open seating"}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); setDrawerEventIdx(idx); setDrawerOpen(true); }}
                                                className="go"
                                                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
                                            >
                                                Reserve →
                                            </button>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Reservation packages */}
                {packages.length > 0 && (
                    <section className="hp-sec">
                        <div className="hp-sh">
                            <div>
                                <div className="hp-st">Reservation packages <span className="tag">{packages.length}</span></div>
                                <p className="hp-sh-sub">Tables, VIP booths, private rooms, group bookings, and corporate buyouts — pick the experience that fits your party.</p>
                            </div>
                        </div>
                        <div className="hp-pkgs">
                            {packages.map((p) => (
                                <div key={p.id} className="hp-pkg">
                                    <h3 className="nm">{p.name}</h3>
                                    <p className="pr">${p.price}<small>{p.currency || "USD"}</small></p>
                                    {p.description && <p className="desc">{p.description}</p>}
                                    {Array.isArray(p.inclusions) && p.inclusions.length > 0 && (
                                        <ul>
                                            {p.inclusions.slice(0, 6).map((inc) => <li key={inc}>{inc}</li>)}
                                        </ul>
                                    )}
                                    {p.maxPartySize && <div style={{ fontSize: 11, color: "var(--mw-dim)", fontFamily: "var(--font-mono), monospace", letterSpacing: 0.06, textTransform: "uppercase", marginTop: 6 }}>Up to {p.maxPartySize} guests</div>}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* F&B specials (admin-configured + featured menu items) */}
                {(cfg.specials?.length || featuredMenu.length > 0) && (
                    <section className="hp-sec">
                        <div className="hp-sh">
                            <div>
                                <div className="hp-st">Match-day specials</div>
                                <p className="hp-sh-sub">Featured food &amp; drink during the tournament.</p>
                            </div>
                        </div>
                        <div className="hp-spec">
                            {(cfg.specials || []).map((s) => (
                                <div key={s.title} className="hp-scard">
                                    <h3 className="nm">{s.title}</h3>
                                    {s.price && <div className="pr">{s.price}</div>}
                                    {s.desc && <p className="desc">{s.desc}</p>}
                                </div>
                            ))}
                            {featuredMenu.map((item) => (
                                <div key={item.id} className="hp-scard">
                                    <h3 className="nm">{item.name}</h3>
                                    <div className="pr">${String(item.price)}</div>
                                    {item.description && <p className="desc">{item.description}</p>}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Sponsors */}
                {cfg.sponsors && cfg.sponsors.length > 0 && (
                    <section className="hp-sec">
                        <div className="hp-sh">
                            <div>
                                <div className="hp-st">Sponsors</div>
                                <p className="hp-sh-sub">Local brands making this watch party possible.</p>
                            </div>
                        </div>
                        <div className="hp-spn">
                            {cfg.sponsors.map((s) => (
                                <div key={s.name} className="hp-spn-item">
                                    {s.logoUrl && <img src={s.logoUrl} alt={s.name} />}
                                    <span>{s.name}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* FAQ */}
                {cfg.faqs && cfg.faqs.length > 0 && (
                    <section className="hp-sec">
                        <div className="hp-sh">
                            <div>
                                <div className="hp-st">FAQ</div>
                            </div>
                        </div>
                        <div className="hp-faq">
                            {cfg.faqs.map((f) => (
                                <details key={f.q} className="hp-fq">
                                    <summary>{f.q}</summary>
                                    <div className="hp-fq-body">{f.a}</div>
                                </details>
                            ))}
                        </div>
                    </section>
                )}

                {/* CTA */}
                <section className="hp-sec">
                    <div className="hp-band">
                        <div>
                            <h2>Reserve your World Cup spot at {venue.name}</h2>
                            <p>Pick your match, your party size, and your package. We hold tables for confirmed reservations only — book early for finals weekend.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setDrawerEventIdx(0); setDrawerOpen(true); }}
                            disabled={!nextEvent}
                            className="hp-band-cta"
                            style={!nextEvent ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                        >
                            Reserve a table →
                        </button>
                    </div>
                </section>
            </div>

            {drawerMatch && drawerEvent && (
                <BookingDrawer
                    isOpen={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    venue={{ name: venue.name, address: [venue.addressLine1, venue.city].filter(Boolean).join(", ") }}
                    match={drawerMatch}
                    spotsRemaining={drawerSpotsRemaining}
                    entryFee={drawerEntryFee}
                    venueEventId={drawerEvent.id}
                    venueSlug={venue.slug || venue.id}
                    packages={packages}
                />
            )}
        </div>
    );
}

export default function VenueWorldCupPage({ params }: { params: Promise<{ slug: string }> }) {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />}>
            <VenueWorldCupContent params={params} />
        </Suspense>
    );
}
