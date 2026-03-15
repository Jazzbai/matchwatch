"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Ticket } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useData } from "../lib/data-provider";

/* ═══════════════════════════════════════════════════
   BOOKING DRAWER — Slides up from bottom on mobile.
   Contains match info, party size stepper, special
   requests, spots indicator, and Reserve button.
   ═══════════════════════════════════════════════════ */

interface BookingDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    venue: {
        name: string;
        address: string;
    };
    match: {
        homeTeam: string;
        awayTeam: string;
        homeCrest: string;
        awayCrest: string;
        kickoff: string;
        league: string;
    };
    spotsRemaining: number;
    entryFee?: number;
    venueEventId?: string;
}

type DrawerBookingResponse = {
    id?: string;
    bookingReference?: string;
    status?: string;
    waitlisted?: boolean;
    position?: number;
    message?: string;
};

function CrestToken({ value, alt }: { value: string; alt: string }) {
    const isImage = /^https?:\/\//.test(value) || value.startsWith("/");
    if (isImage) {
        return (
            <img
                src={value}
                alt={alt}
                style={{ width: "1.6rem", height: "1.6rem", objectFit: "contain" }}
            />
        );
    }
    return <span style={{ fontSize: "1.6rem" }}>{value}</span>;
}

export function BookingDrawer({
    isOpen,
    onClose,
    venue,
    match,
    spotsRemaining,
    entryFee,
    venueEventId,
}: BookingDrawerProps) {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { refetch } = useData();
    const [partySize, setPartySize] = useState(2);
    const [requests, setRequests] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setSuccess(null);
    }, [isOpen]);

    useEffect(() => {
        if (!success) return;
        const timer = window.setTimeout(() => {
            onClose();
        }, 1200);
        return () => window.clearTimeout(timer);
    }, [success, onClose]);

    const handleReserve = async () => {
        setError(null);
        setSuccess(null);

        if (!venueEventId) {
            setError("This venue event is unavailable for booking right now.");
            return;
        }

        if (!isAuthenticated) {
            const nextPath = typeof window !== "undefined"
                ? `${window.location.pathname}${window.location.search}`
                : "/";
            router.push(`/login?next=${encodeURIComponent(nextPath)}`);
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post<DrawerBookingResponse>("/bookings", {
                venueEventId,
                partySize,
                specialRequests: requests || undefined,
            });

            if (res.data?.waitlisted) {
                const queuePosition = res.data.position ? ` at position ${res.data.position}` : "";
                setSuccess(`Added to waitlist${queuePosition}.`);
            } else {
                const refText = res.data?.bookingReference ? ` (${res.data.bookingReference})` : "";
                setSuccess(`Booking confirmed${refText}.`);
            }
            await refetch();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create booking.";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div className="drawer-overlay" onClick={onClose} />

            {/* Drawer Panel */}
            <div className="drawer-panel" role="dialog" aria-label="Book your spot">
                <div className="drawer-handle" />

                <div style={{ padding: "8px 24px 32px" }}>
                    {/* Header */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "20px",
                        }}
                    >
                        <div>
                            <div className="section-label" style={{ marginBottom: "4px" }}>
                                RESERVE YOUR SPOT
                            </div>
                            <h3
                                className="font-body"
                                style={{
                                    fontSize: "1.15rem",
                                    fontWeight: 700,
                                    color: "var(--text-primary)",
                                }}
                            >
                                {venue.name}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border)",
                                borderRadius: "50%",
                                width: "36px",
                                height: "36px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                color: "var(--text-secondary)",
                                fontSize: "1.1rem",
                                transition: "all 0.2s ease",
                            }}
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>

                    {/* Match Preview */}
                    <div
                        className="card-flat"
                        style={{
                            padding: "14px",
                            marginBottom: "20px",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flex: 1,
                            }}
                        >
                            <CrestToken value={match.homeCrest} alt={`${match.homeTeam} crest`} />
                            <span
                                className="font-display text-xs"
                                style={{
                                    color: "var(--text-muted)",
                                    letterSpacing: "0.1em",
                                }}
                            >
                                VS
                            </span>
                            <CrestToken value={match.awayCrest} alt={`${match.awayTeam} crest`} />
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div
                                className="text-xs font-body"
                                style={{
                                    fontWeight: 600,
                                    color: "var(--text-primary)",
                                }}
                            >
                                {match.homeTeam} vs {match.awayTeam}
                            </div>
                            <div
                                className="text-xs font-mono"
                                style={{
                                    color: "var(--accent-primary)",
                                    marginTop: "2px",
                                }}
                            >
                                {match.kickoff}
                            </div>
                        </div>
                    </div>

                    {/* Party Size Stepper */}
                    <div style={{ marginBottom: "20px" }}>
                        <label
                            className="text-sm font-body"
                            style={{
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                display: "block",
                                marginBottom: "8px",
                            }}
                        >
                            Party Size
                        </label>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "16px",
                            }}
                        >
                            <button
                                className="btn-ghost"
                                onClick={() => setPartySize(Math.max(1, partySize - 1))}
                                style={{
                                    width: "44px",
                                    height: "44px",
                                    padding: 0,
                                    fontSize: "1.25rem",
                                    borderRadius: "12px",
                                }}
                                disabled={partySize <= 1}
                            >
                                −
                            </button>
                            <span
                                className="font-mono"
                                style={{
                                    fontSize: "1.5rem",
                                    fontWeight: 700,
                                    color: "var(--accent-primary)",
                                    minWidth: "40px",
                                    textAlign: "center",
                                }}
                            >
                                {partySize}
                            </span>
                            <button
                                className="btn-ghost"
                                onClick={() => setPartySize(Math.min(20, partySize + 1))}
                                style={{
                                    width: "44px",
                                    height: "44px",
                                    padding: 0,
                                    fontSize: "1.25rem",
                                    borderRadius: "12px",
                                }}
                                disabled={partySize >= 20}
                            >
                                +
                            </button>
                            <span
                                className="text-xs"
                                style={{ color: "var(--text-muted)" }}
                            >
                                max 20
                            </span>
                        </div>
                    </div>

                    {/* Special Requests */}
                    <div style={{ marginBottom: "20px" }}>
                        <label
                            className="text-sm font-body"
                            style={{
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                display: "block",
                                marginBottom: "8px",
                            }}
                        >
                            Special Requests{" "}
                            <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>
                                (optional)
                            </span>
                        </label>
                        <textarea
                            value={requests}
                            onChange={(e) => setRequests(e.target.value)}
                            placeholder="VIP seating, hookah setup, dietary needs..."
                            rows={3}
                            style={{
                                width: "100%",
                                padding: "12px 14px",
                                borderRadius: "12px",
                                border: "1px solid var(--border)",
                                background: "var(--bg-elevated)",
                                color: "var(--text-primary)",
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: "0.875rem",
                                resize: "none",
                                outline: "none",
                                transition: "border-color 0.2s ease",
                            }}
                            onFocus={(e) =>
                                (e.target.style.borderColor = "var(--accent-primary)")
                            }
                            onBlur={(e) =>
                                (e.target.style.borderColor = "var(--border)")
                            }
                        />
                    </div>

                    {/* Spots & Entry Fee */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "20px",
                            padding: "12px 14px",
                            borderRadius: "12px",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                                style={{
                                    width: "10px",
                                    height: "10px",
                                    borderRadius: "50%",
                                    background:
                                        spotsRemaining > 10
                                            ? "var(--accent-primary)"
                                            : spotsRemaining > 0
                                                ? "var(--accent-hot)"
                                                : "var(--accent-danger)",
                                }}
                            />
                            <div>
                                <div
                                    className="text-sm font-body"
                                    style={{
                                        fontWeight: 600,
                                        color: "var(--text-primary)",
                                    }}
                                >
                                    {spotsRemaining > 0
                                        ? `${spotsRemaining} spots remaining`
                                        : "Event full"}
                                </div>
                                {spotsRemaining <= 5 && spotsRemaining > 0 && (
                                    <div
                                        className="text-xs"
                                        style={{
                                            color: "var(--accent-hot)",
                                            fontWeight: 500,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                        }}
                                    >
                                        <CircleAlert size={12} />
                                        Almost full, book now.
                                    </div>
                                )}
                            </div>
                        </div>
                        {entryFee && (
                            <div style={{ textAlign: "right" }}>
                                <div
                                    className="text-xs"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Entry fee
                                </div>
                                <div
                                    className="font-mono"
                                    style={{
                                        fontSize: "1.1rem",
                                        fontWeight: 700,
                                        color: "var(--accent-primary)",
                                    }}
                                >
                                    ${entryFee}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Estimated Total */}
                    {entryFee && (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "16px",
                                padding: "0 4px",
                            }}
                        >
                            <span
                                className="text-sm"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                Estimated total ({partySize} guests)
                            </span>
                            <span
                                className="font-mono"
                                style={{
                                    fontSize: "1.2rem",
                                    fontWeight: 700,
                                    color: "var(--text-primary)",
                                }}
                            >
                                ${(entryFee * partySize).toFixed(2)}
                            </span>
                        </div>
                    )}

                    {/* Reserve Button */}
                    {error && (
                        <div
                            style={{
                                marginBottom: "12px",
                                borderRadius: "10px",
                                border: "1px solid rgba(240, 82, 82, 0.4)",
                                background: "rgba(240, 82, 82, 0.12)",
                                padding: "10px 12px",
                                color: "var(--accent-danger)",
                                fontSize: "0.8rem",
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {success && (
                        <div
                            style={{
                                marginBottom: "12px",
                                borderRadius: "10px",
                                border: "1px solid rgba(34, 197, 94, 0.45)",
                                background: "rgba(34, 197, 94, 0.14)",
                                padding: "10px 12px",
                                color: "#86efac",
                                fontSize: "0.8rem",
                            }}
                        >
                            {success}
                        </div>
                    )}

                    {!venueEventId && (
                        <div
                            style={{
                                marginBottom: "12px",
                                borderRadius: "10px",
                                border: "1px solid rgba(251, 140, 67, 0.45)",
                                background: "rgba(251, 140, 67, 0.12)",
                                padding: "10px 12px",
                                color: "var(--accent-hot)",
                                fontSize: "0.8rem",
                            }}
                        >
                            This venue event is unavailable for direct booking right now.
                        </div>
                    )}

                    <button
                        className="btn-primary"
                        onClick={() => void handleReserve()}
                        style={{
                            width: "100%",
                            padding: "16px",
                            fontSize: "1rem",
                            borderRadius: "14px",
                            marginBottom: "10px",
                        }}
                        disabled={submitting || !venueEventId}
                    >
                        {submitting
                            ? "Booking..."
                            : (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                    <Ticket size={16} />
                                    Confirm Reservation for {partySize} {partySize === 1 ? "Spot" : "Spots"}
                                </span>
                            )}
                    </button>

                    {/* Cancellation Policy */}
                    <p
                        className="text-xs"
                        style={{
                            color: "var(--text-muted)",
                            textAlign: "center",
                        }}
                    >
                        Free cancellation up to 2 hours before kickoff
                    </p>
                </div>
            </div>
        </>
    );
}
