"use client";

import React, { useState, use, useEffect } from "react";
import Link from "next/link";
import {
    BadgeCheck,
    CircleX,
    DoorOpen,
    Landmark,
    LineChart,
    MapPin,
    Sparkles,
    Star,
    Ticket,
    Users,
} from "lucide-react";
import { ThemeProvider, AppShell } from "../../../components/AppShell";
import { BookingDrawer } from "../../../components/BookingDrawer";
import { MatchVenueMap } from "../../../components/MatchVenueMap";
import { AMENITY_LABELS, PRICE_LABELS } from "../../../lib/data";
import { useData, type Venue, type VenueEvent } from "../../../lib/data-provider";

/* ═══════════════════════════════════════════════════
   MATCH DETAIL — Single page template
   Fully informative: teams, scores, lineups, stats,
   venue events with booking CTA, related matches.
   ═══════════════════════════════════════════════════ */

function MatchVenueCard({
    venue,
    event,
    matchId,
    onBook,
}: {
    venue: Venue;
    event: VenueEvent;
    matchId: string;
    onBook: () => void;
}) {
    const spotsLeft = event.bookingLimit ? event.bookingLimit - event.confirmedBookings : null;
    const pct = event.bookingLimit ? (event.confirmedBookings / event.bookingLimit) * 100 : 0;

    return (
        <div className="card" style={{ overflow: "hidden" }}>
            {/* Cover gradient */}
            <div
                style={{
                    height: "80px",
                    background: `linear-gradient(135deg, ${venue.coverColor}33 0%, var(--bg-card) 100%)`,
                    position: "relative",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                }}
            >
                <div>
                    {venue.isFeatured && (
                        <span className="badge badge-hot" style={{ fontSize: "0.6rem", marginBottom: "4px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Sparkles size={11} />
                            PROMOTED
                        </span>
                    )}
                </div>
                {venue.isVerified && (
                    <span className="badge" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E", border: "1px solid #22C55E", fontSize: "0.6rem", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <BadgeCheck size={11} />
                        VERIFIED
                    </span>
                )}
            </div>

            <div style={{ padding: "16px" }}>
                {/* Name & Rating */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                        <Link href={`/venues/${venue.slug}?matchId=${matchId}`} style={{ textDecoration: "none", color: "inherit" }}>
                            <h3 className="font-body" style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>{venue.name}</h3>
                        </Link>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{venue.addressLine1}, {venue.city}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span className="font-mono text-xs" style={{ color: "var(--accent-hot)", fontWeight: 600 }}>{venue.rating.toFixed(1)}</span>
                            <Star size={11} style={{ color: "var(--accent-hot)", fill: "var(--accent-hot)" }} />
                        </div>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>({venue.reviewCount})</span>
                    </div>
                </div>

                {/* Amenities */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                    {venue.amenities.slice(0, 5).map((a) => (
                        <span key={a} className="amenity-icon" title={AMENITY_LABELS[a]?.label || a} style={{ width: "28px", height: "28px", fontSize: "0.75rem" }}>
                            {AMENITY_LABELS[a]?.icon || "•"}
                        </span>
                    ))}
                    <span className="text-xs font-mono" style={{ display: "flex", alignItems: "center", color: "var(--accent-primary)", fontWeight: 600 }}>{PRICE_LABELS[venue.priceRange]}</span>
                </div>

                {/* Event Details */}
                <div className="card-flat" style={{ padding: "10px 12px", marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span className="text-xs" style={{ color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "6px" }}><DoorOpen size={12} />Doors: <strong>{event.doorsOpenAt}</strong></span>
                        {event.entryFee && <span className="text-xs font-mono" style={{ color: "var(--accent-primary)", fontWeight: 600 }}>${event.entryFee}/person</span>}
                        {!event.entryFee && <span className="text-xs" style={{ color: "var(--accent-primary)", fontWeight: 600 }}>FREE ENTRY</span>}
                    </div>
                    {event.specialNotes && (
                        <p className="text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{event.specialNotes}</p>
                    )}
                </div>

                {/* Capacity Bar */}
                {event.bookingLimit && (
                    <div style={{ marginBottom: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{event.confirmedBookings}/{event.bookingLimit} booked</span>
                            {spotsLeft !== null && (
                                <span className="text-xs" style={{ color: spotsLeft <= 5 ? "var(--accent-danger)" : spotsLeft <= 20 ? "var(--accent-hot)" : "var(--accent-primary)", fontWeight: 600 }}>
                                    {spotsLeft > 0 ? `${spotsLeft} spots left` : "SOLD OUT"}
                                </span>
                            )}
                        </div>
                        <div style={{ height: "6px", background: "var(--bg-elevated)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{
                                height: "100%",
                                width: `${Math.min(pct, 100)}%`,
                                borderRadius: "3px",
                                background: pct > 90 ? "var(--accent-danger)" : pct > 70 ? "var(--accent-hot)" : "var(--accent-primary)",
                                transition: "width 0.4s ease",
                            }} />
                        </div>
                    </div>
                )}

                {/* Book Button */}
                <button
                    className="btn-primary"
                    onClick={(e) => { e.stopPropagation(); onBook(); }}
                    style={{ width: "100%", padding: "12px", fontSize: "0.85rem", borderRadius: "10px" }}
                    disabled={spotsLeft !== null && spotsLeft <= 0}
                >
                    {spotsLeft !== null && spotsLeft <= 0 ? "Join Waitlist" : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Ticket size={14} />
                            Book Your Spot
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
}

export default function MatchDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
    const { matchId } = use(params);
    const { matches: MATCHES, getTeam, getLeague, getVenueEvents, isLoading, refetch } = useData();
    const match = MATCHES.find((m) => m.id === matchId);
    const venueEvents = match ? getVenueEvents(match.id) : [];
    const [bookingOpen, setBookingOpen] = useState(false);
    const [bookingVenueIdx, setBookingVenueIdx] = useState(0);
    const [activeTab, setActiveTab] = useState<"venues" | "lineups" | "stats">("venues");

    useEffect(() => {
        void refetch();
    }, [refetch, matchId]);

    useEffect(() => {
        if (bookingVenueIdx >= venueEvents.length) {
            setBookingVenueIdx(0);
        }
    }, [bookingVenueIdx, venueEvents.length]);

    if (isLoading && !match) {
        return (
            <ThemeProvider>
                <AppShell>
                    <div style={{ padding: "40px 20px", color: "var(--text-secondary)" }}>Loading match...</div>
                </AppShell>
            </ThemeProvider>
        );
    }

    if (!match) {
        return (
            <ThemeProvider>
                <AppShell>
                    <div style={{ padding: "80px 20px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                            <CircleX size={56} style={{ color: "var(--text-muted)" }} />
                        </div>
                        <h1 className="font-display text-h1" style={{ color: "var(--text-primary)" }}>MATCH NOT FOUND</h1>
                        <p className="text-body" style={{ color: "var(--text-muted)", margin: "8px 0 24px" }}>This match doesn't exist or has been removed.</p>
                        <Link href="/matches" className="btn-primary" style={{ textDecoration: "none" }}>← Back to Matches</Link>
                    </div>
                </AppShell>
            </ThemeProvider>
        );
    }

    const home = getTeam(match.homeTeamId)!;
    const away = getTeam(match.awayTeamId)!;
    const league = getLeague(match.leagueId)!;
    const d = new Date(match.matchDateUTC);

    const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
    const isFinished = match.status === "FINISHED";
    const relatedMatches = MATCHES.filter((m) => m.leagueId === match.leagueId && m.id !== match.id).slice(0, 3);
    const bookedSpots = venueEvents.reduce((sum, event) => sum + event.confirmedBookings, 0);
    const cappedEvents = venueEvents.filter((event) => event.bookingLimit != null);
    const totalCapacity = cappedEvents.reduce((sum, event) => sum + (event.bookingLimit || 0), 0);
    const averageFillRate = totalCapacity > 0 ? Math.round((bookedSpots / totalCapacity) * 100) : null;
    const mappableVenueEvents = venueEvents.filter(
        (event) =>
            Number.isFinite(event.venue.lat) &&
            Number.isFinite(event.venue.lng) &&
            Math.abs(event.venue.lat) > 0 &&
            Math.abs(event.venue.lng) > 0,
    );

    return (
        <ThemeProvider>
            <AppShell>
                {/* ── Match Hero ─────────────────────────── */}
                <section
                    className="hero-field"
                    style={{
                        position: "relative",
                        padding: "32px 20px 36px",
                        textAlign: "center",
                        overflow: "hidden",
                    }}
                >
                    <img src="/match-hero.webp" alt="Match" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.15 }} />
                    <div style={{ position: "absolute", inset: 0, background: "var(--gradient-hero)" }} />
                    {/* Decorative team color orbs */}
                    <div style={{ position: "absolute", top: "-40px", left: "-20px", width: "180px", height: "180px", borderRadius: "50%", background: home.color, opacity: 0.06, filter: "blur(60px)" }} />
                    <div style={{ position: "absolute", bottom: "-40px", right: "-20px", width: "180px", height: "180px", borderRadius: "50%", background: away.color, opacity: 0.06, filter: "blur(60px)" }} />

                    <div style={{ position: "relative", zIndex: 2 }}>
                        {/* League badge */}
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                            <span className="badge badge-accent" style={{ fontSize: "0.85rem", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}>{league.image ? <img src={league.image} alt="" style={{ width: "22px", height: "22px", objectFit: "contain" }} /> : league.logo} {league.shortName}</span>
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {match.stage} · {match.matchDay}</span>
                        </div>

                        {/* Teams Face-off */}
                        <div className="animate-fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "24px", marginBottom: "16px" }}>
                            {/* Home */}
                            <Link href={`/teams/${home.id}`} style={{ textAlign: "center", minWidth: "100px", textDecoration: "none", color: "inherit" }}>
                                <div style={{ marginBottom: "8px", display: "flex", justifyContent: "center" }}>
                                    {home.image ? (
                                        <img src={home.image} alt={home.name} style={{ width: "64px", height: "64px", borderRadius: "16px", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }} />
                                    ) : (
                                        <span style={{ fontSize: "3.5rem", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>{home.crest}</span>
                                    )}
                                </div>
                                <h2 className="font-display text-h2" style={{ color: "var(--text-primary)", letterSpacing: "0.05em" }}>{home.shortName}</h2>
                                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{home.name}</div>
                            </Link>

                            {/* Score / VS */}
                            <div style={{ textAlign: "center" }}>
                                {(isLive || isFinished) ? (
                                    <>
                                        <div className="font-mono" style={{ fontSize: "2.8rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1, letterSpacing: "0.08em" }}>
                                            {match.homeScore} - {match.awayScore}
                                        </div>
                                        {isLive && (
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "8px" }}>
                                                <span className="live-dot" />
                                                <span className="badge badge-live" style={{ fontSize: "0.65rem" }}>{match.status === "PAUSED" ? "HALF TIME" : "LIVE"}</span>
                                            </div>
                                        )}
                                        {isFinished && <span className="badge" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", marginTop: "8px", fontSize: "0.65rem" }}>FULL TIME</span>}
                                    </>
                                ) : (
                                    <>
                                        <div className="font-display" style={{ fontSize: "1.8rem", color: "var(--text-muted)", letterSpacing: "0.1em" }}>VS</div>
                                        <div className="font-mono text-sm" style={{ color: "var(--accent-primary)", fontWeight: 600, marginTop: "6px" }}>
                                            {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                        </div>
                                        <div className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                                            {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} CDT
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Away */}
                            <Link href={`/teams/${away.id}`} style={{ textAlign: "center", minWidth: "100px", textDecoration: "none", color: "inherit" }}>
                                <div style={{ marginBottom: "8px", display: "flex", justifyContent: "center" }}>
                                    {away.image ? (
                                        <img src={away.image} alt={away.name} style={{ width: "64px", height: "64px", borderRadius: "16px", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }} />
                                    ) : (
                                        <span style={{ fontSize: "3.5rem", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>{away.crest}</span>
                                    )}
                                </div>
                                <h2 className="font-display text-h2" style={{ color: "var(--text-primary)", letterSpacing: "0.05em" }}>{away.shortName}</h2>
                                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{away.name}</div>
                            </Link>
                        </div>

                        {/* Stadium & Venue Count */}
                        <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
                            <span className="text-xs" style={{ color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "6px" }}><Landmark size={12} />{match.stadiumName}</span>
                            <span className="text-xs" style={{ color: "var(--accent-primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}><MapPin size={12} />{venueEvents.length} venues hosting</span>
                        </div>
                    </div>
                </section>

                <section style={{ padding: "16px 20px 8px" }}>
                    <div className="card-flat" style={{ padding: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                            <div className="section-label" style={{ marginBottom: 0 }}>HOSTING VENUES MAP</div>
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {mappableVenueEvents.length} of {venueEvents.length} venues mapped
                            </span>
                        </div>
                        {venueEvents.length === 0 ? (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                No venues are hosting this match yet.
                            </p>
                        ) : mappableVenueEvents.length === 0 ? (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                Hosting venues exist, but map coordinates are not available yet for these venues.
                            </p>
                        ) : (
                            <MatchVenueMap
                                venues={mappableVenueEvents.map((event) => ({
                                    id: event.venue.id,
                                    name: event.venue.name,
                                    slug: event.venue.slug,
                                    addressLine1: event.venue.addressLine1,
                                    city: event.venue.city,
                                    lat: event.venue.lat,
                                    lng: event.venue.lng,
                                    confirmedBookings: event.confirmedBookings,
                                    bookingLimit: event.bookingLimit,
                                }))}
                                onSelectVenue={(venueId) => {
                                    const idx = venueEvents.findIndex((event) => event.venue.id === venueId);
                                    if (idx >= 0) {
                                        setBookingVenueIdx(idx);
                                        setActiveTab("venues");
                                    }
                                }}
                            />
                        )}
                    </div>
                </section>

                {/* ── Tab Navigation ─────────────────────── */}
                <div style={{
                    position: "sticky",
                    top: "56px",
                    zIndex: 30,
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg-primary)",
                }}>
                    <div className="toggle-track" style={{ display: "inline-flex" }}>
                        {[
                            { id: "venues", label: `Venues (${venueEvents.length})` },
                            { id: "lineups", label: "Lineups" },
                            { id: "stats", label: "Stats" },
                        ].map((t) => (
                            <button
                                key={t.id}
                                className={`toggle-option ${activeTab === t.id ? "active" : ""}`}
                                onClick={() => setActiveTab(t.id as typeof activeTab)}
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                            >
                                {t.id === "venues" && <MapPin size={12} />}
                                {t.id === "lineups" && <Users size={12} />}
                                {t.id === "stats" && <LineChart size={12} />}
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Tab Content ────────────────────────── */}
                {activeTab === "venues" && (
                    <section style={{ padding: "20px" }}>
                        <div className="section-label" style={{ marginBottom: "16px" }}>WATCH PARTY VENUES · {venueEvents.length} hosting</div>
                        {venueEvents.length === 0 ? (
                            <div className="card-flat" style={{ padding: "40px 20px", textAlign: "center" }}>
                                <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}><Landmark size={32} style={{ color: "var(--text-muted)" }} /></div>
                                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No venues are hosting this match yet. Check back later or <Link href="/venues" style={{ color: "var(--accent-primary)" }}>browse all venues</Link>.</p>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gap: "16px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
                                    {venueEvents.map((ve, i) => (
                                        <div key={ve.id} className={`animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
                                            <MatchVenueCard
                                                venue={ve.venue}
                                                event={ve}
                                                matchId={match.id}
                                                onBook={() => {
                                                    setBookingVenueIdx(i);
                                                    setBookingOpen(true);
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {activeTab === "lineups" && (
                    <section style={{ padding: "20px" }}>
                        <div className="section-label" style={{ marginBottom: "16px" }}>
                            {isLive || isFinished ? "MATCH TIMELINE" : "PRE-MATCH INFO"}
                        </div>
                        <div className="card-flat" style={{ padding: "18px" }}>
                            <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "8px" }}>
                                {isLive || isFinished
                                    ? "Detailed lineups and minute-by-minute events are not provided by the current match feed."
                                    : "Lineups are published closer to kickoff and will appear here when available."}
                            </p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                Kickoff: {d.toLocaleString("en-US")} · Stadium: {match.stadiumName || "TBD"}
                            </p>
                        </div>
                    </section>
                )}

                {activeTab === "stats" && (
                    <section style={{ padding: "20px" }}>
                        <div className="section-label" style={{ marginBottom: "16px" }}>MATCH INSIGHTS</div>
                        <div className="card-flat" style={{ padding: "20px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
                                <div style={{ padding: "12px", border: "1px solid var(--border)", borderRadius: "10px" }}>
                                    <div className="text-xs" style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Status</div>
                                    <div className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 700 }}>{match.status}</div>
                                </div>
                                <div style={{ padding: "12px", border: "1px solid var(--border)", borderRadius: "10px" }}>
                                    <div className="text-xs" style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Score</div>
                                    <div className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                                        {match.homeScore ?? "-"} : {match.awayScore ?? "-"}
                                    </div>
                                </div>
                                <div style={{ padding: "12px", border: "1px solid var(--border)", borderRadius: "10px" }}>
                                    <div className="text-xs" style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Hosting Venues</div>
                                    <div className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 700 }}>{venueEvents.length}</div>
                                </div>
                                <div style={{ padding: "12px", border: "1px solid var(--border)", borderRadius: "10px" }}>
                                    <div className="text-xs" style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Booked Spots</div>
                                    <div className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                                        {bookedSpots.toLocaleString()}
                                        {averageFillRate != null ? ` (${averageFillRate}% fill)` : ""}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Related Matches ────────────────────── */}
                {relatedMatches.length > 0 && (
                    <section style={{ padding: "24px 20px 40px", borderTop: "1px solid var(--border)" }}>
                        <div className="section-label" style={{ marginBottom: "8px" }}>MORE IN {league.shortName.toUpperCase()}</div>
                        <h2 className="font-display text-h2" style={{ color: "var(--text-primary)", marginBottom: "16px" }}>RELATED MATCHES</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
                            {relatedMatches.map((rm) => {
                                const rh = getTeam(rm.homeTeamId)!, ra = getTeam(rm.awayTeamId)!;
                                const rd = new Date(rm.matchDateUTC);
                                return (
                                    <Link href={`/matches/${rm.id}`} key={rm.id} style={{ textDecoration: "none", color: "inherit" }}>
                                        <div className="card-flat" style={{ padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                {rh.image ? (
                                                    <img
                                                        src={rh.image}
                                                        alt={rh.shortName}
                                                        style={{ width: "26px", height: "26px", objectFit: "contain", borderRadius: "6px" }}
                                                    />
                                                ) : (
                                                    <span style={{ fontSize: "1.4rem" }}>{rh.crest}</span>
                                                )}
                                                <span className="text-sm font-body" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{rh.shortName} vs {ra.shortName}</span>
                                                {ra.image ? (
                                                    <img
                                                        src={ra.image}
                                                        alt={ra.shortName}
                                                        style={{ width: "26px", height: "26px", objectFit: "contain", borderRadius: "6px" }}
                                                    />
                                                ) : (
                                                    <span style={{ fontSize: "1.4rem" }}>{ra.crest}</span>
                                                )}
                                            </div>
                                            <span className="font-mono text-xs" style={{ color: "var(--accent-primary)" }}>
                                                {rd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ── Booking Drawer ─────────────────────── */}
                {venueEvents.length > 0 && (
                    <BookingDrawer
                        isOpen={bookingOpen}
                        onClose={() => setBookingOpen(false)}
                        venueEventId={venueEvents[bookingVenueIdx]?.id}
                        venue={{
                            name: venueEvents[bookingVenueIdx]?.venue.name || "",
                            address: `${venueEvents[bookingVenueIdx]?.venue.addressLine1 || ""}, ${venueEvents[bookingVenueIdx]?.venue.city || ""}`,
                        }}
                        match={{
                            homeTeam: home.shortName,
                            awayTeam: away.shortName,
                            homeCrest: home.crest,
                            awayCrest: away.crest,
                            kickoff: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
                            league: league.name,
                        }}
                        spotsRemaining={venueEvents[bookingVenueIdx]?.bookingLimit ? venueEvents[bookingVenueIdx].bookingLimit! - venueEvents[bookingVenueIdx].confirmedBookings : 50}
                        entryFee={venueEvents[bookingVenueIdx]?.entryFee || undefined}
                    />
                )}
            </AppShell>
        </ThemeProvider>
    );
}
