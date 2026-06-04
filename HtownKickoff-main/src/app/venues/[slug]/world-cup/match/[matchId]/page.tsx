"use client";

import React, { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FloatingNav } from "../../../../../../components/AppShell";
import { BookingDrawer } from "../../../../../../components/BookingDrawer";
import { Countdown } from "../../../../../../components/Countdown";
import { api } from "../../../../../../lib/api";
import { isWorldCupLeague } from "../../../../../../lib/league-utils";

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
    worldCup?: { enabled?: boolean } | null;
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
        homeTeamName?: string | null;
        awayTeamName?: string | null;
        homeTeamCrestUrl?: string | null;
        awayTeamCrestUrl?: string | null;
        matchDateUtc: string;
        status: string;
        venueName?: string | null;
        stage?: string | null;
        matchDay?: number | null;
        eventFormat?: "HEAD_TO_HEAD" | "SINGLE_EVENT" | null;
        league?: { id?: string; name?: string | null; shortName?: string | null; externalId?: string | null } | null;
    };
};

const MW_VARS = `
  :root{
    --mw-bg:var(--background);--mw-card:var(--card);--mw-line:var(--border);
    --mw-fg:var(--foreground);--mw-dim:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);--mw-ink:#0a0b0d;
  }
`;

const CSS = `
  .hp{background:var(--mw-bg);color:var(--mw-fg);min-height:100vh;}
  .hp-wrap{max-width:980px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  .hp-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mw-line);min-height:520px;display:flex;align-items:center;}
  .hp-hero-bg{position:absolute;inset:0;background-color:#06070a;background-position:center;background-size:cover;background-repeat:no-repeat;}
  .hp-hero-bg.fallback{background-image:url(/home-hero.webp);}
  .hp-hero-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,7,10,0.75) 0%,rgba(6,7,10,0.85) 60%,var(--mw-bg) 100%);}
  .hp-hero-inner{position:relative;z-index:2;max-width:980px;margin-inline:auto;width:100%;padding:140px clamp(16px,4vw,28px) 56px;text-align:center;}
  .hp-bc{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:18px;}
  .hp-bc a{color:rgba(255,255,255,0.7);text-decoration:none;}
  .hp-bc a:hover{color:#fff;}
  .hp-bc .sep{opacity:.5;}
  .hp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mw-accent) 32%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:18px;}

  /* Match header */
  .hp-mh{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:24px;max-width:760px;margin:0 auto 28px;}
  .hp-mhteam{display:flex;flex-direction:column;align-items:center;gap:12px;}
  .hp-mhteam img{width:84px;height:84px;object-fit:contain;}
  .hp-mhcrest{width:84px;height:84px;border-radius:16px;background:rgba(255,255,255,0.1);display:grid;place-items:center;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;color:#fff;font-size:24px;border:1px solid rgba(255,255,255,0.18);}
  .hp-mhname{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.4rem;color:#fff;text-align:center;line-height:1.1;}
  .hp-mhvs{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:3rem;color:var(--mw-accent);line-height:1;}
  .hp-kickoff{font-family:var(--font-mono),monospace;font-size:13px;letter-spacing:0.08em;color:rgba(255,255,255,0.85);margin-bottom:8px;}
  .hp-stage{font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.65);}
  .hp-venue-line{font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;color:rgba(255,255,255,0.6);margin-top:18px;}

  .hp-cta-row{display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:28px;}
  .hp-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 26px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;border:1px solid rgba(255,255,255,0.22);color:#fff;transition:all .18s;cursor:pointer;font-family:inherit;background:transparent;}
  .hp-btn:hover{border-color:rgba(255,255,255,0.5);}
  .hp-btn.primary{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}
  .hp-btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}

  /* Sections */
  .hp-sec{padding:56px 0;border-top:1px solid var(--mw-line);}
  .hp-sec:first-of-type{border-top:0;}
  .hp-sh{margin-bottom:22px;}
  .hp-st{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.4rem;letter-spacing:-0.01em;margin:0;}
  .hp-sh-sub{font-size:14px;color:var(--mw-dim);margin:8px 0 0;max-width:640px;line-height:1.55;}

  .hp-note{padding:24px;border-radius:14px;background:var(--mw-card);border:1px solid var(--mw-line);font-size:15px;color:var(--mw-fg);line-height:1.55;white-space:pre-wrap;}

  .hp-meta-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;}
  .hp-meta-card{padding:18px 20px;border-radius:12px;background:var(--mw-card);border:1px solid var(--mw-line);}
  .hp-meta-card .l{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--mw-dim);margin-bottom:6px;}
  .hp-meta-card .v{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:18px;color:var(--mw-fg);}

  /* Packages — reused from microsite landing */
  .hp-pkgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}
  .hp-pkg{padding:20px;border-radius:12px;border:1px solid var(--mw-line);background:var(--mw-card);display:flex;flex-direction:column;gap:8px;}
  .hp-pkg .nm{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:15px;margin:0;}
  .hp-pkg .pr{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;color:var(--mw-accent);font-size:22px;margin:0;}
  .hp-pkg .pr small{font-size:12px;font-weight:600;color:var(--mw-dim);margin-left:4px;}
  .hp-pkg .desc{font-size:13px;color:var(--mw-dim);line-height:1.5;margin:0;}
  .hp-pkg ul{list-style:none;padding:0;margin:6px 0 0;display:grid;gap:4px;}
  .hp-pkg li{font-size:12px;color:var(--mw-fg);display:flex;align-items:flex-start;gap:6px;line-height:1.4;}
  .hp-pkg li::before{content:"✓";color:var(--mw-accent);font-weight:800;flex-shrink:0;}

  @media(max-width:760px){
    .hp-hero-inner{padding:120px 16px 44px;}
    .hp-sec{padding:44px 0;}
    .hp-mh{grid-template-columns:1fr;gap:16px;}
    .hp-mhvs{font-size:1.5rem;}
  }
`;

function formatKickoffLong(dateUtc: string) {
    try {
        const d = new Date(dateUtc);
        return d.toLocaleString(undefined, {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit", timeZoneName: "short",
        });
    } catch {
        return dateUtc;
    }
}

function VenueWcMatchContent({ params }: { params: Promise<{ slug: string; matchId: string }> }) {
    const { slug, matchId } = use(params);

    const [venue, setVenue] = useState<VenueRow | null>(null);
    const [eventForMatch, setEventForMatch] = useState<VenueMatchEvent | null>(null);
    const [packages, setPackages] = useState<VenuePackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [notFoundFlag, setNotFoundFlag] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const [venueRes, eventsRes, packagesRes] = await Promise.allSettled([
                    api.get<VenueRow>(`/venues/${slug}`),
                    api.get<VenueMatchEvent[]>(`/venues/${slug}/events?limit=40`),
                    api.get<VenuePackage[]>(`/venues/${slug}/packages`),
                ]);
                if (!active) return;
                const v = venueRes.status === "fulfilled" ? venueRes.value.data : null;
                if (!v || v.worldCup?.enabled !== true) {
                    setNotFoundFlag(true);
                    return;
                }
                setVenue(v);
                const events: VenueMatchEvent[] = eventsRes.status === "fulfilled" ? (eventsRes.value.data || []) : [];
                const ev = events.find((e) => e.matchId === matchId || e.match?.id === matchId);
                const lg = ev?.match?.league;
                const lgInput = lg ? { name: lg.name || "", shortName: lg.shortName || "", externalId: lg.externalId || "" } : null;
                if (!ev || !ev.match || !isWorldCupLeague(lgInput) || ev.match.eventFormat === "SINGLE_EVENT") {
                    setNotFoundFlag(true);
                    return;
                }
                setEventForMatch(ev);
                if (packagesRes.status === "fulfilled") setPackages(packagesRes.value.data || []);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [slug, matchId]);

    useEffect(() => {
        if (notFoundFlag) notFound();
    }, [notFoundFlag]);

    const drawerMatch = useMemo(() => {
        if (!eventForMatch?.match) return null;
        const m = eventForMatch.match;
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
    }, [eventForMatch]);

    if (loading || !venue || !eventForMatch?.match) {
        return (
            <div className="hp">
                <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
                <FloatingNav />
                <section className="hp-hero">
                    <div className="hp-hero-bg fallback" />
                    <div className="hp-hero-scrim" />
                    <div className="hp-hero-inner">
                        <h1 className="hp-st" style={{ color: "#fff", fontSize: "1.6rem" }}>Loading match…</h1>
                    </div>
                </section>
            </div>
        );
    }

    const m = eventForMatch.match;
    const fallbackHero = !venue.coverImageUrl;
    const spotsRemaining = eventForMatch.bookingLimit
        ? Math.max(0, eventForMatch.bookingLimit - Number(eventForMatch.confirmedBookingsCount || 0))
        : 999;
    const entryFee = eventForMatch.customPrice ? Number(eventForMatch.customPrice) : undefined;

    return (
        <div className="hp">
            <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
            <FloatingNav />

            <section className="hp-hero">
                <div
                    className={`hp-hero-bg${fallbackHero ? " fallback" : ""}`}
                    style={fallbackHero ? undefined : { backgroundImage: `url(${venue.coverImageUrl})` }}
                />
                <div className="hp-hero-scrim" />
                <div className="hp-hero-inner">
                    <div className="hp-bc" style={{ justifyContent: "center" }}>
                        <Link href={`/venues/${venue.slug || venue.id}/world-cup`}>← {venue.name} · World Cup</Link>
                        <span className="sep">/</span>
                        <span>Match day</span>
                    </div>
                    <span className="hp-kicker">{m.league?.name || "FIFA World Cup 2026"}{m.stage ? ` · ${m.stage}` : ""}{m.matchDay ? ` · MD ${m.matchDay}` : ""}</span>

                    <div className="hp-mh">
                        <div className="hp-mhteam">
                            {m.homeTeamCrestUrl
                                ? <img src={m.homeTeamCrestUrl} alt="" />
                                : <span className="hp-mhcrest">{(m.homeTeamName || "?").slice(0, 2).toUpperCase()}</span>}
                            <span className="hp-mhname">{m.homeTeamName || "TBD"}</span>
                        </div>
                        <span className="hp-mhvs">VS</span>
                        <div className="hp-mhteam">
                            {m.awayTeamCrestUrl
                                ? <img src={m.awayTeamCrestUrl} alt="" />
                                : <span className="hp-mhcrest">{(m.awayTeamName || "?").slice(0, 2).toUpperCase()}</span>}
                            <span className="hp-mhname">{m.awayTeamName || "TBD"}</span>
                        </div>
                    </div>

                    <div className="hp-kickoff">{formatKickoffLong(m.matchDateUtc)}</div>
                    {m.venueName && <div className="hp-stage">Stadium · {m.venueName}</div>}

                    <div style={{ marginTop: 28 }}>
                        <Countdown target={m.matchDateUtc} label="Kickoff" accent="#fff" />
                    </div>

                    <div className="hp-venue-line">
                        Watching at <strong style={{ color: "#fff", fontWeight: 800 }}>{venue.name}</strong>
                        {venue.addressLine1 ? ` · ${venue.addressLine1}` : ""}{venue.city ? `, ${venue.city}` : ""}
                    </div>

                    <div className="hp-cta-row">
                        <button type="button" onClick={() => setDrawerOpen(true)} className="hp-btn primary">
                            Reserve your spot →
                        </button>
                        <Link href={`/venues/${venue.slug || venue.id}/world-cup`} className="hp-btn">All matches at this venue</Link>
                    </div>
                </div>
            </section>

            <div className="hp-wrap">
                {/* Match-day quick facts */}
                <section className="hp-sec" style={{ borderTop: 0 }}>
                    <div className="hp-sh">
                        <h2 className="hp-st">Match-day details</h2>
                    </div>
                    <div className="hp-meta-grid">
                        <div className="hp-meta-card">
                            <div className="l">Spots remaining</div>
                            <div className="v">{eventForMatch.bookingLimit ? spotsRemaining : "Open seating"}</div>
                        </div>
                        {entryFee !== undefined && (
                            <div className="hp-meta-card">
                                <div className="l">Entry fee</div>
                                <div className="v">${entryFee}</div>
                            </div>
                        )}
                        {eventForMatch.doorsOpenAt && (
                            <div className="hp-meta-card">
                                <div className="l">Doors open</div>
                                <div className="v">{formatKickoffLong(eventForMatch.doorsOpenAt)}</div>
                            </div>
                        )}
                        <div className="hp-meta-card">
                            <div className="l">Reservation policy</div>
                            <div className="v">{eventForMatch.requiresApproval ? "Manual confirmation" : "Auto-confirmed"}</div>
                        </div>
                    </div>
                </section>

                {/* Venue notes */}
                {eventForMatch.specialNotes && (
                    <section className="hp-sec">
                        <div className="hp-sh">
                            <h2 className="hp-st">Notes from the venue</h2>
                        </div>
                        <div className="hp-note">{eventForMatch.specialNotes}</div>
                    </section>
                )}

                {/* Reservation packages */}
                {packages.length > 0 && (
                    <section className="hp-sec">
                        <div className="hp-sh">
                            <h2 className="hp-st">Reserve a package</h2>
                            <p className="hp-sh-sub">Pick the experience that fits your party — tables, VIP, private rooms, or corporate buyouts.</p>
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
            </div>

            {drawerMatch && (
                <BookingDrawer
                    isOpen={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    venue={{ name: venue.name, address: [venue.addressLine1, venue.city].filter(Boolean).join(", ") }}
                    match={drawerMatch}
                    spotsRemaining={spotsRemaining}
                    entryFee={entryFee}
                    venueEventId={eventForMatch.id}
                    venueSlug={venue.slug || venue.id}
                    packages={packages}
                />
            )}
        </div>
    );
}

export default function VenueWcMatchPage({ params }: { params: Promise<{ slug: string; matchId: string }> }) {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />}>
            <VenueWcMatchContent params={params} />
        </Suspense>
    );
}
