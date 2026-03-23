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
import { AppShell } from "../../../components/AppShell";
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
    const [hovered, setHovered] = React.useState(false);

    return (
        <div
            style={{
                backgroundColor: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column",
                height: "100%", transition: "all 0.3s",
                transform: hovered ? "translateY(-4px)" : "none",
                boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Cover gradient */}
            <div style={{
                height: 80, position: "relative", padding: "12px 16px",
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                background: `linear-gradient(135deg, ${venue.coverColor}33 0%, var(--card) 100%)`,
            }}>
                <div>
                    {venue.isFeatured && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 99, backgroundColor: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                            <Sparkles size={10} /> PROMOTED
                        </span>
                    )}
                </div>
                {venue.isVerified && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 99, backgroundColor: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
                        <BadgeCheck size={10} /> VERIFIED
                    </span>
                )}
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
                {/* Name & Rating */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ flex: 1, paddingRight: 8 }}>
                        <Link href={`/venues/${venue.slug}?matchId=${matchId}`} style={{ textDecoration: "none" }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.3, marginBottom: 2 }}>{venue.name}</h3>
                        </Link>
                        <p style={{ fontSize: 12, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{venue.addressLine1}, {venue.city}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{venue.rating.toFixed(1)}</span>
                            <Star size={12} style={{ color: "#f59e0b", fill: "#f59e0b" }} />
                        </div>
                        <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>({venue.reviewCount})</span>
                    </div>
                </div>

                {/* Amenities */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {venue.amenities.slice(0, 5).map((a) => (
                        <span key={a} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", fontSize: 12 }} title={AMENITY_LABELS[a]?.label || a}>
                            {AMENITY_LABELS[a]?.icon || "•"}
                        </span>
                    ))}
                    <span style={{ display: "flex", alignItems: "center", fontSize: 10, fontFamily: "monospace", fontWeight: 700, color: "var(--primary)", padding: "0 6px", borderRadius: 99, backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)", border: "1px solid color-mix(in oklch, var(--primary) 20%, transparent)" }}>
                        {PRICE_LABELS[venue.priceRange]}
                    </span>
                </div>

                {/* Event Details */}
                <div style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
                            <DoorOpen size={12} />Doors: <strong style={{ color: "var(--foreground)" }}>{event.doorsOpenAt}</strong>
                        </span>
                        {event.entryFee && <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "var(--primary)" }}>${event.entryFee}/person</span>}
                        {!event.entryFee && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>FREE ENTRY</span>}
                    </div>
                    {event.specialNotes && (
                        <p style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{event.specialNotes}</p>
                    )}
                </div>

                <div style={{ marginTop: "auto" }}>
                    {/* Capacity Bar */}
                    {event.bookingLimit && (
                        <div style={{ marginBottom: 12, paddingLeft: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>{event.confirmedBookings}/{event.bookingLimit} booked</span>
                                {spotsLeft !== null && (
                                    <span style={{ fontSize: 11, fontWeight: 700, color: spotsLeft <= 5 ? "#ef4444" : spotsLeft <= 20 ? "#f59e0b" : "var(--primary)" }}>
                                        {spotsLeft > 0 ? `${spotsLeft} spots left` : "SOLD OUT"}
                                    </span>
                                )}
                            </div>
                            <div style={{ height: 6, backgroundColor: "var(--secondary)", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: 99, transition: "width 0.5s", width: `${Math.min(pct, 100)}%`, backgroundColor: pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "var(--primary)" }} />
                            </div>
                        </div>
                    )}

                    {/* Book Button */}
                    <button
                        style={{
                            width: "100%", padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700,
                            fontFamily: "inherit", border: "none", cursor: spotsLeft !== null && spotsLeft <= 0 ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            transition: "all 0.2s",
                            backgroundColor: spotsLeft !== null && spotsLeft <= 0 ? "var(--secondary)" : "var(--primary)",
                            color: spotsLeft !== null && spotsLeft <= 0 ? "var(--muted-foreground)" : "var(--primary-foreground)",
                            boxShadow: spotsLeft !== null && spotsLeft <= 0 ? "none" : "0 2px 8px color-mix(in oklch, var(--primary) 25%, transparent)",
                        }}
                        onClick={(e) => { e.stopPropagation(); onBook(); }}
                        disabled={spotsLeft !== null && spotsLeft <= 0}
                    >
                        {spotsLeft !== null && spotsLeft <= 0 ? "Join Waitlist" : (
                            <>
                                <Ticket size={16} />
                                Book Your Spot
                            </>
                        )}
                    </button>
                </div>
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
            <AppShell>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh", color: "var(--muted-foreground)" }}>Loading match...</div>
            </AppShell>
        );
    }

    if (!match) {
        return (
            <AppShell>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                        <CircleX size={64} style={{ color: "var(--muted-foreground)" }} />
                    </div>
                    <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 32, fontWeight: 900, color: "var(--foreground)", marginBottom: 16 }}>MATCH NOT FOUND</h1>
                    <p style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 32, maxWidth: 360 }}>This match doesn't exist or has been removed.</p>
                    <Link href="/matches" style={{ padding: "12px 24px", backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, borderRadius: 12, textDecoration: "none", fontSize: 14, boxShadow: "0 4px 12px color-mix(in oklch, var(--primary) 30%, transparent)" }}>
                        ← Back to Matches
                    </Link>
                </div>
            </AppShell>
        );
    }


    const home = getTeam(match.homeTeamId) || {
        id: match.homeTeamId || "home-team",
        name: match.homeTeamName || "Home Team",
        shortName: match.homeTeamName || "Home Team",
        crest: "TEAM",
        color: "var(--primary)",
        leagueId: match.leagueId,
        country: "INT",
        image: "",
    };
    const away = getTeam(match.awayTeamId) || {
        id: match.awayTeamId || "away-team",
        name: match.awayTeamName || "Away Team",
        shortName: match.awayTeamName || "Away Team",
        crest: "TEAM",
        color: "var(--primary)",
        leagueId: match.leagueId,
        country: "INT",
        image: "",
    };
    const league = getLeague(match.leagueId) || {
        id: match.leagueId,
        sportId: undefined,
        name: "League",
        shortName: "League",
        logo: "LG",
        image: undefined,
        country: "International",
        externalId: match.leagueId,
    };
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
        <AppShell>
            {/* ── Match Hero ─────────────────────────── */}
            <section style={{ position: "relative", overflow: "hidden", paddingTop: 40, paddingBottom: 48, paddingLeft: 20, paddingRight: 20, textAlign: "center", backgroundColor: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                {/* Decorative background */}
                <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
                    <img src="/match-hero.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.1 }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, color-mix(in oklch, var(--background) 40%, transparent), color-mix(in oklch, var(--background) 80%, transparent), var(--background))" }} />
                </div>

                {/* Team color orbs */}
                <div style={{ position: "absolute", top: -40, left: -40, width: 192, height: 192, borderRadius: "50%", opacity: 0.1, filter: "blur(48px)", background: home.color }} />
                <div style={{ position: "absolute", bottom: -40, right: -40, width: 192, height: 192, borderRadius: "50%", opacity: 0.1, filter: "blur(48px)", background: away.color }} />

                <div style={{ position: "relative", zIndex: 10, maxWidth: 700, margin: "0 auto" }}>
                    {/* League badge */}
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 32 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 99, backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)", fontSize: 12, fontWeight: 700, border: "1px solid var(--border)" }}>
                            {league.image ? <img src={league.image} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} /> : <span style={{ fontSize: 16 }}>{league.logo}</span>}
                            {league.shortName}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500, backgroundColor: "color-mix(in oklch, var(--background) 50%, transparent)", padding: "4px 8px", borderRadius: 99, border: "1px solid var(--border)" }}>
                            {match?.stage} · {match?.matchDay}
                        </span>
                    </div>

                    {/* Teams Face-off */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 32 }}>
                        {/* Home */}
                        <Link href={`/teams/${home.id}`} style={{ flex: 1, maxWidth: 140, display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none" }}>
                            <div style={{ width: 80, height: 80, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", padding: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                                {home.image ? (
                                    <img src={home.image} alt={home.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                ) : (
                                    <span style={{ fontSize: 40 }}>{home.crest}</span>
                                )}
                            </div>
                            <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 20, fontWeight: 900, color: "var(--foreground)", letterSpacing: "-0.02em", textAlign: "center" }}>{home.shortName}</h2>
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", padding: "0 4px" }}>{home.name}</div>
                        </Link>

                        {/* Score / VS */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 8px" }}>
                            {(isLive || isFinished) ? (
                                <>
                                    <div style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 900, color: "var(--foreground)", letterSpacing: "0.1em", backgroundColor: "var(--card)", padding: "8px 16px", borderRadius: 12, border: "1px solid var(--border)" }}>
                                        {match?.homeScore} - {match?.awayScore}
                                    </div>
                                    {isLive && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, backgroundColor: "rgba(245,158,11,0.1)", padding: "4px 12px", borderRadius: 99, border: "1px solid rgba(245,158,11,0.2)" }}>
                                            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#f59e0b", animation: "pulse 2s infinite" }} />
                                            <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em" }}>
                                                {match?.status === "PAUSED" ? "HALF TIME" : "LIVE"}
                                            </span>
                                        </div>
                                    )}
                                    {isFinished && <span style={{ display: "inline-block", marginTop: 16, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", padding: "4px 12px", borderRadius: 99, backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>FULL TIME</span>}
                                </>
                            ) : (
                                <>
                                    <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 28, fontWeight: 900, color: "var(--muted-foreground)", opacity: 0.4, letterSpacing: "0.1em", marginBottom: 8 }}>VS</div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "color-mix(in oklch, var(--card) 80%, transparent)", padding: "8px 16px", borderRadius: 12, border: "1px solid var(--border)" }}>
                                        <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "var(--primary)", marginBottom: 4 }}>
                                            {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                        </div>
                                        <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted-foreground)" }}>
                                            {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Away */}
                        <Link href={`/teams/${away.id}`} style={{ flex: 1, maxWidth: 140, display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none" }}>
                            <div style={{ width: 80, height: 80, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", padding: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                                {away.image ? (
                                    <img src={away.image} alt={away.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                ) : (
                                    <span style={{ fontSize: 40 }}>{away.crest}</span>
                                )}
                            </div>
                            <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 20, fontWeight: 900, color: "var(--foreground)", letterSpacing: "-0.02em", textAlign: "center" }}>{away.shortName}</h2>
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", padding: "0 4px" }}>{away.name}</div>
                        </Link>
                    </div>

                    {/* Stadium & Venue Count */}
                    <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", backgroundColor: "color-mix(in oklch, var(--secondary) 50%, transparent)", padding: "6px 12px", borderRadius: 10, border: "1px solid var(--border)" }}>
                            <Landmark size={14} style={{ opacity: 0.5 }} />
                            {match?.stadiumName}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--primary)", backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)", padding: "6px 12px", borderRadius: 10, border: "1px solid color-mix(in oklch, var(--primary) 20%, transparent)" }}>
                            <MapPin size={14} />
                            {venueEvents.length} venues hosting
                        </span>
                    </div>
                </div>
            </section>

            {/* Map Section */}
            <section style={{ padding: 20 }}>
                <div style={{ backgroundColor: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
                    <div style={{ padding: 16, backgroundColor: "color-mix(in oklch, var(--secondary) 30%, transparent)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Hosting Venues Map</div>
                        <span style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)", padding: "2px 8px", borderRadius: 99 }}>
                            {mappableVenueEvents.length} of {venueEvents.length} mapped
                        </span>
                    </div>
                    <div style={{ padding: 8, backgroundColor: "var(--card)" }}>
                        {venueEvents.length === 0 ? (
                            <div style={{ padding: "32px 16px", textAlign: "center" }}>
                                <MapPin size={32} style={{ margin: "0 auto 8px", color: "var(--muted-foreground)", opacity: 0.5 }} />
                                <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No venues are hosting this match yet.</p>
                            </div>
                        ) : mappableVenueEvents.length === 0 ? (
                            <div style={{ padding: "32px 16px", textAlign: "center" }}>
                                <MapPin size={32} style={{ margin: "0 auto 8px", color: "var(--muted-foreground)", opacity: 0.5 }} />
                                <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Hosting venues exist, but map coordinates are not available yet.</p>
                            </div>
                        ) : (
                            <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
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
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Tab Navigation ─────────────────────── */}
            <div style={{ position: "sticky", top: 56, zIndex: 30, padding: "8px 20px 16px", borderBottom: "1px solid var(--border)", backgroundColor: "color-mix(in oklch, var(--background) 90%, transparent)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
                <div style={{ display: "inline-flex", padding: 4, backgroundColor: "var(--secondary)", borderRadius: 12, border: "1px solid var(--border)", maxWidth: "100%", overflowX: "auto" }}>
                    {[
                        { id: "venues", label: `Venues (${venueEvents.length})`, icon: MapPin },
                        { id: "lineups", label: "Lineups", icon: Users },
                        { id: "stats", label: "Stats", icon: LineChart },
                    ].map((t) => (
                        <button
                            key={t.id}
                            style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
                                borderRadius: 10, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                                cursor: "pointer", border: "none", fontFamily: "inherit",
                                transition: "all 0.2s",
                                backgroundColor: activeTab === t.id ? "var(--background)" : "transparent",
                                color: activeTab === t.id ? "var(--foreground)" : "var(--muted-foreground)",
                                boxShadow: activeTab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                                outline: activeTab === t.id ? "1px solid var(--border)" : "none",
                            }}
                            onClick={() => setActiveTab(t.id as typeof activeTab)}
                        >
                            <t.icon size={14} style={{ color: activeTab === t.id ? "var(--primary)" : "inherit" }} />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab Content ────────────────────────── */}
            <div style={{ backgroundColor: "color-mix(in oklch, var(--secondary) 10%, transparent)", minHeight: "40vh" }}>
                {activeTab === "venues" && (
                    <section style={{ padding: "32px 20px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
                            Watch Party Venues <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "var(--border)" }} /> {venueEvents.length} hosting
                        </div>
                        {venueEvents.length === 0 ? (
                            <div style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "64px 24px", textAlign: "center" }}>
                                <Landmark size={48} style={{ margin: "0 auto 16px", color: "var(--muted-foreground)" }} />
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>No venues listed</h3>
                                <p style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 360, margin: "0 auto" }}>
                                    No venues are hosting this match yet. Check back closer to match day or <Link href="/venues" style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}>browse all venues</Link>.
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                                {venueEvents.map((ve, i) => (
                                    <div key={ve.id} style={{ display: "flex", height: "100%" }}>
                                        <MatchVenueCard
                                            venue={ve.venue}
                                            event={ve}
                                            matchId={match?.id || matchId}
                                            onBook={() => {
                                                setBookingVenueIdx(i);
                                                setBookingOpen(true);
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === "lineups" && (
                    <section style={{ padding: "32px 20px", maxWidth: 640, margin: "0 auto" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 24, textAlign: "center" }}>
                            {isLive || isFinished ? "Match Timeline" : "Pre-Match Info"}
                        </div>
                        <div style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, textAlign: "center" }}>
                            <Users size={32} style={{ margin: "0 auto 16px", color: "var(--muted-foreground)", opacity: 0.6 }} />
                            <p style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500, marginBottom: 16 }}>
                                {isLive || isFinished
                                    ? "Detailed lineups and minute-by-minute events are not provided by the current match feed."
                                    : "Lineups are published closer to kickoff and will appear here when available."}
                            </p>
                            <div style={{ display: "inline-block", padding: "8px 16px", backgroundColor: "var(--secondary)", borderRadius: 10, fontSize: 12, fontFamily: "monospace", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                                Kickoff: {d.toLocaleString("en-US")} · Stadium: {match?.stadiumName || "TBD"}
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === "stats" && (
                    <section style={{ padding: "32px 20px", maxWidth: 900, margin: "0 auto" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 24 }}>Match Insights</div>
                        <div style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
                                {[
                                    { label: "Status", value: match?.status, mono: false, color: "var(--foreground)" },
                                    { label: "Score", value: `${match?.homeScore ?? "-"} : ${match?.awayScore ?? "-"}`, mono: true, color: "var(--foreground)" },
                                    { label: "Hosting Venues", value: venueEvents.length, mono: true, color: "var(--primary)" },
                                    { label: "Booked Spots", value: `${bookedSpots.toLocaleString()}${averageFillRate != null ? ` (${averageFillRate}% fill)` : ""}`, mono: true, color: "var(--foreground)" },
                                ].map((stat) => (
                                    <div key={stat.label} style={{ padding: 16, backgroundColor: "color-mix(in oklch, var(--secondary) 30%, transparent)", border: "1px solid var(--border)", borderRadius: 12 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 8 }}>{stat.label}</div>
                                        <div style={{ fontSize: 18, fontFamily: stat.mono ? "monospace" : "var(--font-display), sans-serif", fontWeight: stat.mono ? 700 : 900, color: stat.color }}>{stat.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </div>

            {/* ── Related Matches ────────────────────── */}
            {relatedMatches.length > 0 && (
                <section style={{ padding: "40px 20px 80px", borderTop: "1px solid var(--border)", backgroundColor: "var(--background)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 8 }}>More in {league.shortName}</div>
                    <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 24, fontWeight: 900, color: "var(--foreground)", marginBottom: 24 }}>Related Matches</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                        {relatedMatches.map((rm) => {
                            const rh = getTeam(rm.homeTeamId) || {
                                id: rm.homeTeamId || `${rm.id}-home`,
                                name: rm.homeTeamName || "Home Team",
                                shortName: rm.homeTeamName || "Home Team",
                                crest: "TEAM",
                                color: "var(--primary)",
                                leagueId: rm.leagueId,
                                country: "INT",
                                image: "",
                            };
                            const ra = getTeam(rm.awayTeamId) || {
                                id: rm.awayTeamId || `${rm.id}-away`,
                                name: rm.awayTeamName || "Away Team",
                                shortName: rm.awayTeamName || "Away Team",
                                crest: "TEAM",
                                color: "var(--primary)",
                                leagueId: rm.leagueId,
                                country: "INT",
                                image: "",
                            };
                            const rd = new Date(rm.matchDateUTC);
                            return (
                                <Link href={`/matches/${rm.id}`} key={rm.id} style={{ textDecoration: "none" }}>
                                    <div
                                        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s", cursor: "pointer" }}
                                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            {rh.image ? (
                                                <img src={rh.image} alt={rh.shortName} style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 6 }} />
                                            ) : (
                                                <span style={{ fontSize: 20 }}>{rh.crest}</span>
                                            )}
                                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>vs</span>
                                            {ra.image ? (
                                                <img src={ra.image} alt={ra.shortName} style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 6 }} />
                                            ) : (
                                                <span style={{ fontSize: 20 }}>{ra.crest}</span>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>
                                                {rd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </span>
                                            <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                                                {rd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                            </span>
                                        </div>
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
    );
}
