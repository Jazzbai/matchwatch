"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Ticket, X } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useData } from "../lib/data-provider";

/* ═══════════════════════════════════════════════════
   BOOKING DRAWER — Slides up from bottom.
   Contains match info, party size stepper, special
   requests, spots indicator, and Reserve button.
   All inline-styled for guaranteed rendering.
   ═══════════════════════════════════════════════════ */

interface BookingDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    venue: {
        name: string;
        address: string;
    };
    match: {
        eventFormat?: "HEAD_TO_HEAD" | "SINGLE_EVENT";
        title: string;
        subtitle?: string;
        homeTeam?: string;
        awayTeam?: string;
        homeCrest?: string;
        awayCrest?: string;
        eventBadge?: string;
        kickoff: string;
        league: string;
    };
    spotsRemaining: number;
    entryFee?: number;
    venueEventId?: string;
    venueSlug?: string;
    packages?: Array<{
        id: string;
        name: string;
        description?: string | null;
        price: string;
        maxPartySize?: number | null;
        inclusions?: string[] | null;
    }>;
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
    venueSlug,
    packages,
}: BookingDrawerProps) {
    const isSingleEvent = match.eventFormat === "SINGLE_EVENT";

    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { refetch } = useData();
    const [partySize, setPartySize] = useState(2);
    const [requests, setRequests] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [selectedPackageId, setSelectedPackageId] = useState("");
    const [promoCode, setPromoCode] = useState("");
    const [promoStatus, setPromoStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
    const [appliedPromo, setAppliedPromo] = useState<{ code: string; title: string; discountType: string; discountValue: string } | null>(null);
    const selectedPackage = (packages || []).find((p) => p.id === selectedPackageId) || null;

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setSuccess(null);
        setSelectedPackageId("");
        setPromoCode("");
        setPromoStatus("idle");
        setAppliedPromo(null);
    }, [isOpen]);

    const applyPromo = async () => {
        if (!venueSlug || !promoCode.trim()) return;
        setPromoStatus("checking");
        try {
            const res = await api.get<{ code: string; title: string; discountType: string; discountValue: string }>(
                `/venues/${venueSlug}/promotions/${encodeURIComponent(promoCode.trim().toUpperCase())}`,
            );
            setAppliedPromo(res.data);
            setPromoStatus("valid");
        } catch {
            setAppliedPromo(null);
            setPromoStatus("invalid");
        }
    };

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
                packageId: selectedPackageId || undefined,
                promoCode: appliedPromo ? appliedPromo.code : undefined,
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
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: "fixed", inset: 0, zIndex: 9998,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
                }}
            />

            {/* Drawer */}
            <div
                style={{
                    position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
                    maxHeight: "85dvh", overflowY: "auto",
                    backgroundColor: "var(--card)",
                    borderTop: "1px solid var(--border)",
                    borderTopLeftRadius: 24, borderTopRightRadius: 24,
                    padding: "24px 24px 48px",
                    boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
                    animation: "slideUp 0.3s ease-out",
                }}
            >
                {/* Drag Handle */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                    <div style={{ width: 40, height: 4, borderRadius: 99, backgroundColor: "var(--border)" }} />
                </div>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
                            RESERVE YOUR SPOT
                        </div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>
                            {venue.name}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)",
                            backgroundColor: "var(--secondary)", color: "var(--muted-foreground)",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "inherit", transition: "all 0.2s",
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Match Preview */}
                <div style={{
                    padding: 16, borderRadius: 14, marginBottom: 20,
                    backgroundColor: "var(--secondary)",
                    border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", gap: 12,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                        {isSingleEvent ? (
                            <CrestToken value={match.eventBadge || "EV"} alt={`${match.league} badge`} />
                        ) : (
                            <>
                                <CrestToken value={match.homeCrest || "HOME"} alt={`${match.homeTeam || match.title} crest`} />
                                <span style={{ fontWeight: 900, fontSize: 11, color: "var(--muted-foreground)", letterSpacing: "0.15em" }}>
                                    VS
                                </span>
                                <CrestToken value={match.awayCrest || "AWAY"} alt={`${match.awayTeam || match.subtitle || match.title} crest`} />
                            </>
                        )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                            {match.title}
                        </div>
                        {match.subtitle ? (
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                                {isSingleEvent ? match.subtitle : `vs ${match.subtitle}`}
                            </div>
                        ) : null}
                        <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--primary)", marginTop: 2 }}>
                            {match.kickoff}
                        </div>
                    </div>
                </div>

                {/* Party Size Stepper */}
                <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", display: "block", marginBottom: 10 }}>
                        Party Size
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <button
                            onClick={() => setPartySize(Math.max(1, partySize - 1))}
                            disabled={partySize <= 1}
                            style={{
                                width: 44, height: 44, borderRadius: 12, border: "1px solid var(--border)",
                                backgroundColor: "var(--secondary)", color: "var(--foreground)",
                                fontSize: 20, cursor: partySize <= 1 ? "not-allowed" : "pointer",
                                fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: partySize <= 1 ? 0.4 : 1,
                            }}
                        >
                            −
                        </button>
                        <span style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, color: "var(--primary)", minWidth: 40, textAlign: "center" }}>
                            {partySize}
                        </span>
                        <button
                            onClick={() => setPartySize(Math.min(20, partySize + 1))}
                            disabled={partySize >= 20}
                            style={{
                                width: 44, height: 44, borderRadius: 12, border: "1px solid var(--border)",
                                backgroundColor: "var(--secondary)", color: "var(--foreground)",
                                fontSize: 20, cursor: partySize >= 20 ? "not-allowed" : "pointer",
                                fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: partySize >= 20 ? 0.4 : 1,
                            }}
                        >
                            +
                        </button>
                        <span style={{ fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                            max 20
                        </span>
                    </div>
                </div>

                {/* Special Requests */}
                <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", display: "block", marginBottom: 10 }}>
                        Special Requests{" "}
                        <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>(optional)</span>
                    </label>
                    <textarea
                        value={requests}
                        onChange={(e) => setRequests(e.target.value)}
                        placeholder="VIP seating, hookah setup, dietary needs..."
                        rows={3}
                        style={{
                            width: "100%", padding: "12px 14px", borderRadius: 14,
                            border: "1px solid var(--border)",
                            backgroundColor: "color-mix(in oklch, var(--secondary) 30%, transparent)",
                            color: "var(--foreground)", fontFamily: "inherit", fontSize: 14,
                            resize: "none", outline: "none",
                        }}
                    />
                </div>

                {/* Watch-Party Package */}
                {packages && packages.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", display: "block", marginBottom: 10 }}>
                            Watch-Party Package{" "}
                            <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>(optional)</span>
                        </label>
                        <select
                            value={selectedPackageId}
                            onChange={(e) => setSelectedPackageId(e.target.value)}
                            style={{
                                width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--border)",
                                backgroundColor: "color-mix(in oklch, var(--secondary) 30%, transparent)",
                                color: "var(--foreground)", fontFamily: "inherit", fontSize: 14, outline: "none",
                            }}
                        >
                            <option value="">No package — standard booking</option>
                            {packages.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} — ${Number(p.price).toFixed(2)}{p.maxPartySize ? ` (up to ${p.maxPartySize})` : ""}
                                </option>
                            ))}
                        </select>
                        {selectedPackage && (
                            <div style={{ marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "color-mix(in oklch, var(--secondary) 30%, transparent)" }}>
                                {selectedPackage.description && (
                                    <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{selectedPackage.description}</p>
                                )}
                                {Array.isArray(selectedPackage.inclusions) && selectedPackage.inclusions.length > 0 && (
                                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--muted-foreground)" }}>
                                        {selectedPackage.inclusions.map((inc, i) => <li key={i}>{inc}</li>)}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Promo Code */}
                <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", display: "block", marginBottom: 10 }}>
                        Promo Code{" "}
                        <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>(optional)</span>
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            value={promoCode}
                            onChange={(e) => { setPromoCode(e.target.value); setPromoStatus("idle"); setAppliedPromo(null); }}
                            placeholder="e.g. DERBY15"
                            style={{
                                flex: 1, padding: "12px 14px", borderRadius: 14, border: "1px solid var(--border)",
                                backgroundColor: "color-mix(in oklch, var(--secondary) 30%, transparent)",
                                color: "var(--foreground)", fontFamily: "inherit", fontSize: 14, outline: "none",
                                textTransform: "uppercase",
                            }}
                        />
                        <button
                            onClick={() => void applyPromo()}
                            disabled={!promoCode.trim() || promoStatus === "checking" || !venueSlug}
                            style={{
                                padding: "0 18px", borderRadius: 14, border: "1px solid var(--border)",
                                backgroundColor: "var(--secondary)", color: "var(--foreground)",
                                fontWeight: 700, fontSize: 13, fontFamily: "inherit",
                                cursor: (!promoCode.trim() || promoStatus === "checking" || !venueSlug) ? "not-allowed" : "pointer",
                                opacity: (!promoCode.trim() || promoStatus === "checking" || !venueSlug) ? 0.5 : 1,
                            }}
                        >
                            {promoStatus === "checking" ? "..." : "Apply"}
                        </button>
                    </div>
                    {promoStatus === "valid" && appliedPromo && (
                        <div style={{ marginTop: 8, fontSize: 13, color: "#22c55e", fontWeight: 600 }}>
                            ✓ {appliedPromo.title} applied to your booking
                        </div>
                    )}
                    {promoStatus === "invalid" && (
                        <div style={{ marginTop: 8, fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>
                            That code isn&apos;t valid for this venue.
                        </div>
                    )}
                </div>

                {/* Spots & Entry Fee */}
                <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: 14, borderRadius: 14, marginBottom: 20,
                    backgroundColor: "color-mix(in oklch, var(--secondary) 30%, transparent)",
                    border: "1px solid var(--border)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                            width: 10, height: 10, borderRadius: "50%",
                            backgroundColor: spotsRemaining > 10 ? "var(--primary)" : spotsRemaining > 0 ? "#f59e0b" : "#ef4444",
                        }} />
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
                                {spotsRemaining > 0 ? `${spotsRemaining} spots remaining` : "Event full"}
                            </div>
                            {spotsRemaining <= 5 && spotsRemaining > 0 && (
                                <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 500, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                    <CircleAlert size={12} />
                                    Almost full, book now.
                                </div>
                            )}
                        </div>
                    </div>
                    {entryFee && (
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Entry fee</div>
                            <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: "var(--primary)" }}>
                                ${entryFee}
                            </div>
                        </div>
                    )}
                </div>

                {/* Estimated Total */}
                {entryFee && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "0 4px" }}>
                        <span style={{ fontSize: 14, color: "var(--secondary-foreground)" }}>
                            Estimated total ({partySize} guests)
                        </span>
                        <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 800, color: "var(--foreground)" }}>
                            ${(entryFee * partySize).toFixed(2)}
                        </span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={{ marginBottom: 12, borderRadius: 14, border: "1px solid rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)", padding: "10px 14px", color: "#ef4444", fontSize: 14 }}>
                        {error}
                    </div>
                )}

                {/* Success */}
                {success && (
                    <div style={{ marginBottom: 12, borderRadius: 14, border: "1px solid rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.08)", padding: "10px 14px", color: "#22c55e", fontSize: 14 }}>
                        {success}
                    </div>
                )}

                {/* Unavailable warning */}
                {!venueEventId && (
                    <div style={{ marginBottom: 12, borderRadius: 14, border: "1px solid rgba(245,158,11,0.3)", backgroundColor: "rgba(245,158,11,0.08)", padding: "10px 14px", color: "#f59e0b", fontSize: 14 }}>
                        This venue event is unavailable for direct booking right now.
                    </div>
                )}

                {/* Reserve Button */}
                <button
                    onClick={() => void handleReserve()}
                    disabled={submitting || !venueEventId}
                    style={{
                        width: "100%", padding: "16px 24px", borderRadius: 16,
                        border: "none", cursor: submitting || !venueEventId ? "not-allowed" : "pointer",
                        backgroundColor: "var(--primary)", color: "var(--primary-foreground)",
                        fontSize: 15, fontWeight: 800, fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        opacity: submitting || !venueEventId ? 0.5 : 1,
                        boxShadow: "0 4px 16px color-mix(in oklch, var(--primary) 40%, transparent)",
                        transition: "all 0.2s",
                        marginBottom: 12,
                    }}
                >
                    {submitting ? "Booking..." : (
                        <>
                            <Ticket size={18} />
                            Confirm Reservation for {partySize} {partySize === 1 ? "Spot" : "Spots"}
                        </>
                    )}
                </button>

                {/* Cancellation Policy */}
                <p style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center", margin: 0 }}>
                    Free cancellation up to 2 hours before kickoff
                </p>
            </div>
        </>
    );
}
