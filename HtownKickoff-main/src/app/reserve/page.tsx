"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Trophy } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { useData } from "../../lib/data-provider";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type CreateBookingResponse = {
    id: string;
    bookingReference: string;
    partySize: number;
    status: string;
    createdAt: string;
    venue?: { name: string; city?: string };
    match?: { homeTeamName: string; awayTeamName: string; matchDateUtc: string };
};

function TeamBadge({ src, fallback, alt }: { src?: string; fallback: string; alt: string }) {
    const safeSrc = src?.trim();
    if (safeSrc && (/^https?:\/\//.test(safeSrc) || safeSrc.startsWith("/"))) {
        return (
            <img
                src={safeSrc}
                alt={alt}
                style={{
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "999px",
                    objectFit: "cover",
                    border: "1px solid var(--border)",
                    background: "var(--secondary)",
                }}
            />
        );
    }

    return (
        <div
            style={{
                width: "2rem",
                height: "2rem",
                borderRadius: "999px",
                border: "1px solid var(--border)",
                background: "var(--secondary)",
                color: "var(--foreground)",
                fontSize: "0.72rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
            }}
            aria-label={alt}
            title={alt}
        >
            {(fallback || "TM").slice(0, 3).toUpperCase()}
        </div>
    );
}

export default function ReservePage() {
    const { isAuthenticated } = useAuth();
    const { matches, getTeam, getLeague, getVenueEvents } = useData();

    const [selectedMatchId, setSelectedMatchId] = useState("");
    const [selectedEventId, setSelectedEventId] = useState("");
    const [partySize, setPartySize] = useState(2);
    const [requests, setRequests] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdBooking, setCreatedBooking] = useState<CreateBookingResponse | null>(null);

    const upcomingMatches = useMemo(
        () =>
            matches
                .filter((m) => m.status === "SCHEDULED" || m.status === "TIMED")
                .sort((a, b) => new Date(a.matchDateUTC).getTime() - new Date(b.matchDateUTC).getTime()),
        [matches],
    );

    useEffect(() => {
        if (!selectedMatchId && upcomingMatches.length > 0) {
            setSelectedMatchId(upcomingMatches[0].id);
        }
    }, [selectedMatchId, upcomingMatches]);

    const selectedMatch = matches.find((m) => m.id === selectedMatchId);
    const events = selectedMatch ? getVenueEvents(selectedMatch.id) : [];

    useEffect(() => {
        if (events.length === 0) {
            setSelectedEventId("");
            return;
        }
        if (!events.find((e) => e.id === selectedEventId)) {
            setSelectedEventId(events[0].id);
        }
    }, [events, selectedEventId]);

    const selectedEvent = events.find((e) => e.id === selectedEventId);
    const home = selectedMatch ? getTeam(selectedMatch.homeTeamId) : undefined;
    const away = selectedMatch ? getTeam(selectedMatch.awayTeamId) : undefined;
    const league = selectedMatch ? getLeague(selectedMatch.leagueId) : undefined;

    const handleReserve = async () => {
        if (!selectedEventId) {
            setError("Please select a venue event.");
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const res = await api.post<CreateBookingResponse>("/bookings", {
                venueEventId: selectedEventId,
                partySize,
                specialRequests: requests || undefined,
            });
            setCreatedBooking(res.data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create booking";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isAuthenticated) {
        return (
            
                <AppShell>
                    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "46px 20px", textAlign: "center" }}>
                        <h1 className="font-display text-h1" style={{ color: "var(--foreground)", marginBottom: "8px" }}>LOGIN REQUIRED</h1>
                        <p className="text-body" style={{ color: "var(--muted-foreground)", marginBottom: "16px" }}>
                            Sign in to reserve a spot at a watch party.
                        </p>
                        <Link href="/login" className="btn-primary" style={{ textDecoration: "none" }}>Go to Login</Link>
                    </div>
                </AppShell>
            
        );
    }

    return (
        
            <AppShell>
                <div style={{ maxWidth: "760px", margin: "0 auto", padding: "28px 20px 56px" }}>
                    <h1 className="font-display text-h1" style={{ color: "var(--foreground)", marginBottom: "6px" }}>RESERVE A WATCH PARTY</h1>
                    <p className="text-sm" style={{ color: "var(--muted-foreground)", marginBottom: "18px" }}>
                        Choose a match, pick a venue event, and confirm your booking.
                    </p>

                    {error && (
                        <div style={{
                            padding: "12px 14px",
                            marginBottom: "12px",
                            borderRadius: "10px",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.35)",
                            color: "var(--accent-danger)",
                            fontSize: "0.82rem",
                        }}>
                            {error}
                        </div>
                    )}

                    {createdBooking ? (
                        <div className="card-flat" style={{ padding: "20px" }}>
                            <h2 className="font-display text-h2" style={{ color: "var(--foreground)", marginBottom: "8px" }}>BOOKING CONFIRMED</h2>
                            <div className="text-sm" style={{ color: "var(--muted-foreground)", marginBottom: "6px" }}>
                                Reference: <strong>{createdBooking.bookingReference}</strong>
                            </div>
                            <div className="text-sm" style={{ color: "var(--muted-foreground)", marginBottom: "6px" }}>
                                Status: {createdBooking.status}
                            </div>
                            <div className="text-sm" style={{ color: "var(--muted-foreground)", marginBottom: "12px" }}>
                                Party size: {createdBooking.partySize}
                            </div>
                            <Link href="/dashboard" className="btn-primary" style={{ textDecoration: "none", padding: "10px 14px", display: "inline-block" }}>
                                View My Bookings
                            </Link>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: "12px" }}>
                            <div className="section-label">1. SELECT MATCH</div>
                            {upcomingMatches.length === 0 ? (
                                <div
                                    className="card-flat"
                                    style={{
                                        padding: "14px",
                                        border: "1px dashed var(--border)",
                                        color: "var(--muted-foreground)",
                                        fontSize: "0.86rem",
                                    }}
                                >
                                    No upcoming matches available yet.
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: "grid",
                                        gap: "8px",
                                        maxHeight: "320px",
                                        overflowY: "auto",
                                        paddingRight: "4px",
                                    }}
                                >
                                    {upcomingMatches.map((match) => {
                                        const h = getTeam(match.homeTeamId);
                                        const a = getTeam(match.awayTeamId);
                                        const matchLeague = getLeague(match.leagueId);
                                        const selected = selectedMatchId === match.id;

                                        return (
                                            <button
                                                key={match.id}
                                                type="button"
                                                onClick={() => setSelectedMatchId(match.id)}
                                                style={{
                                                    width: "100%",
                                                    textAlign: "left",
                                                    borderRadius: "12px",
                                                    border: selected ? "1px solid var(--primary)" : "1px solid var(--border)",
                                                    background: selected ? "rgba(243, 199, 84, 0.12)" : "var(--card)",
                                                    padding: "11px 12px",
                                                    cursor: "pointer",
                                                    display: "grid",
                                                    gap: "8px",
                                                }}
                                            >
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                                                        <TeamBadge src={h?.image} fallback={h?.shortName || "H"} alt={`${h?.name || "Home"} logo`} />
                                                        <span style={{ color: "var(--foreground)", fontSize: "0.86rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                            {h?.shortName || "HOME"}
                                                        </span>
                                                        <span style={{ color: "var(--muted-foreground)", fontSize: "0.72rem", letterSpacing: "0.12em", fontWeight: 700 }}>VS</span>
                                                        <span style={{ color: "var(--foreground)", fontSize: "0.86rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                            {a?.shortName || "AWAY"}
                                                        </span>
                                                        <TeamBadge src={a?.image} fallback={a?.shortName || "A"} alt={`${a?.name || "Away"} logo`} />
                                                    </div>
                                                    {selected && (
                                                        <span
                                                            style={{
                                                                borderRadius: "999px",
                                                                border: "1px solid rgba(243, 199, 84, 0.4)",
                                                                background: "rgba(243, 199, 84, 0.2)",
                                                                color: "var(--primary)",
                                                                fontSize: "0.66rem",
                                                                fontWeight: 700,
                                                                letterSpacing: "0.08em",
                                                                padding: "3px 7px",
                                                            }}
                                                        >
                                                            SELECTED
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--muted-foreground)", fontSize: "0.74rem" }}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                                        <Trophy size={13} />
                                                        {matchLeague?.shortName || "League"}
                                                    </span>
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                                        <CalendarDays size={13} />
                                                        {new Date(match.matchDateUTC).toLocaleString("en-US")}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {selectedMatch && (
                                <div className="card-flat" style={{ padding: "14px" }}>
                                    <div className="text-sm" style={{ color: "var(--foreground)", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                                        <TeamBadge src={home?.image} fallback={home?.shortName || "H"} alt={`${home?.name || "Home"} logo`} />
                                        <span>{home?.name || "Home"} vs {away?.name || "Away"}</span>
                                        <TeamBadge src={away?.image} fallback={away?.shortName || "A"} alt={`${away?.name || "Away"} logo`} />
                                    </div>
                                    <div className="text-xs" style={{ color: "var(--muted-foreground)", marginTop: "4px" }}>
                                        {league?.shortName || "League"} · {new Date(selectedMatch.matchDateUTC).toLocaleString("en-US")}
                                    </div>
                                </div>
                            )}

                            <div className="section-label" style={{ marginTop: "4px" }}>2. SELECT VENUE EVENT</div>
                            <select
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    borderRadius: "10px",
                                    border: "1px solid var(--border)",
                                    background: "var(--card)",
                                    color: "var(--foreground)",
                                }}
                            >
                                {events.length === 0 && <option value="">No venue event available</option>}
                                {events.map((event) => (
                                    <option key={event.id} value={event.id}>
                                        {event.venue.name} · {event.bookingLimit ? `${event.confirmedBookings}/${event.bookingLimit} booked` : `${event.confirmedBookings} booked`}
                                    </option>
                                ))}
                            </select>

                            {selectedEvent && (
                                <div className="card-flat" style={{ padding: "14px" }}>
                                    <div className="text-sm" style={{ color: "var(--foreground)", fontWeight: 700 }}>{selectedEvent.venue.name}</div>
                                    <div className="text-xs" style={{ color: "var(--muted-foreground)", marginTop: "4px" }}>{selectedEvent.venue.addressLine1}, {selectedEvent.venue.city}</div>
                                    {selectedEvent.specialNotes && (
                                        <div className="text-xs" style={{ color: "var(--muted-foreground)", marginTop: "6px" }}>{selectedEvent.specialNotes}</div>
                                    )}
                                </div>
                            )}

                            <div className="section-label" style={{ marginTop: "4px" }}>3. BOOKING DETAILS</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={partySize}
                                    onChange={(e) => setPartySize(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                                    placeholder="Party size"
                                    style={{
                                        width: "100%",
                                        padding: "12px 14px",
                                        borderRadius: "10px",
                                        border: "1px solid var(--border)",
                                        background: "var(--card)",
                                        color: "var(--foreground)",
                                    }}
                                />
                                <button className="btn-primary" onClick={() => void handleReserve()} disabled={submitting || !selectedEventId} style={{ padding: "12px 14px" }}>
                                    {submitting ? "Booking..." : "Reserve Spot"}
                                </button>
                            </div>

                            <textarea
                                value={requests}
                                onChange={(e) => setRequests(e.target.value)}
                                placeholder="Special requests (optional)"
                                rows={3}
                                style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    borderRadius: "10px",
                                    border: "1px solid var(--border)",
                                    background: "var(--card)",
                                    color: "var(--foreground)",
                                    resize: "vertical",
                                }}
                            />
                        </div>
                    )}
                </div>
            </AppShell>
        
    );
}
