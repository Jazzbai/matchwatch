"use client";
import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { PhoneAuthModal } from "../../../components/PhoneAuthModal";

type VenueInfo = {
    id: string;
    name: string;
    slug: string;
    coverImageUrl?: string;
};

type MatchInfo = {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    homeTeamCrestUrl?: string;
    awayTeamCrestUrl?: string;
    matchDateUtc: string;
    status: string;
};

type QrData = {
    venue: VenueInfo;
    match: MatchInfo | null;
};

export default function CheckinPage() {
    const { venueId } = useParams<{ venueId: string }>();
    const searchParams = useSearchParams();
    const matchId = searchParams.get("matchId");
    const router = useRouter();
    const { user } = useAuth();

    const [data, setData] = useState<QrData | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkinDone, setCheckinDone] = useState(false);
    const [checkinError, setCheckinError] = useState<string | null>(null);
    const [showAuth, setShowAuth] = useState(false);
    const [checkingIn, setCheckingIn] = useState(false);

    useEffect(() => {
        api.get<QrData>(`/checkins/qr/${venueId}${matchId ? `?matchId=${matchId}` : ""}`)
            .then((res) => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [venueId, matchId]);

    async function doCheckin() {
        if (!user) { setShowAuth(true); return; }
        setCheckingIn(true);
        try {
            await api.post("/checkins", { venueId, matchId: matchId || undefined, source: "qr" });
            setCheckinDone(true);
        } catch (err: any) {
            setCheckinError(err?.message || "Check-in failed. Try again.");
        } finally {
            setCheckingIn(false);
        }
    }

    async function handleAuthSuccess() {
        await doCheckin();
    }

    if (loading) {
        return (
            <div style={pageWrap}>
                <div style={{ textAlign: "center", padding: 80, color: "var(--muted-foreground)" }}>Loading…</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div style={pageWrap}>
                <div style={{ textAlign: "center", padding: 80 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
                    <h2 style={{ fontWeight: 800 }}>Venue not found</h2>
                </div>
            </div>
        );
    }

    const { venue, match } = data;

    return (
        <div style={pageWrap}>
            <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px" }}>

                {/* MatchWatch branding */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: "#22c55e", textTransform: "uppercase", marginBottom: 6 }}>
                        MatchWatch · Match Point
                    </div>
                </div>

                {/* Venue card */}
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
                    {venue.coverImageUrl && (
                        <div style={{ height: 160, overflow: "hidden" }}>
                            <img src={venue.coverImageUrl} alt={venue.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                    )}
                    <div style={{ padding: 24 }}>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                            You're at
                        </div>
                        <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 4px" }}>{venue.name}</h1>
                    </div>
                </div>

                {/* Match context */}
                {match && (
                    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                            Today's Match
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {match.homeTeamCrestUrl && <img src={match.homeTeamCrestUrl} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />}
                            <div style={{ flex: 1, textAlign: "center" }}>
                                <div style={{ fontWeight: 900, fontSize: 15 }}>
                                    {match.homeTeamName} <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>vs</span> {match.awayTeamName}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                                    {new Date(match.matchDateUtc).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                </div>
                            </div>
                            {match.awayTeamCrestUrl && <img src={match.awayTeamCrestUrl} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />}
                        </div>
                    </div>
                )}

                {/* Check-in action */}
                {checkinDone ? (
                    <div style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 20, padding: 32, textAlign: "center" }}>
                        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
                        <h2 style={{ fontWeight: 900, fontSize: 22, color: "#22c55e", marginBottom: 8 }}>Checked In!</h2>
                        <p style={{ color: "var(--muted-foreground)", marginBottom: 20 }}>
                            You've earned a +1 point bonus on your predictions for today's match!
                        </p>
                        <button
                            onClick={() => router.push("/match-point")}
                            style={primaryBtn}
                        >
                            Predict the Match →
                        </button>
                    </div>
                ) : (
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
                        <h2 style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>
                            Check in at {venue.name}
                        </h2>
                        <p style={{ color: "var(--muted-foreground)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                            Scan your attendance to earn a bonus point on your match predictions and compete on the venue leaderboard.
                        </p>
                        {checkinError && (
                            <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{checkinError}</p>
                        )}
                        <button onClick={doCheckin} disabled={checkingIn} style={primaryBtn}>
                            {checkingIn ? "Checking in…" : "✓ Check In Now"}
                        </button>
                        <button onClick={() => router.push("/match-point")} style={{ display: "block", width: "100%", marginTop: 10, background: "none", border: "none", color: "var(--muted-foreground)", fontSize: 13, cursor: "pointer", padding: "10px" }}>
                            Go to Match Point →
                        </button>
                    </div>
                )}
            </div>

            <PhoneAuthModal
                isOpen={showAuth}
                onClose={() => setShowAuth(false)}
                onSuccess={handleAuthSuccess}
                title="Check In to Earn Points"
            />
        </div>
    );
}

const pageWrap: React.CSSProperties = {
    minHeight: "100vh",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
};

const primaryBtn: React.CSSProperties = {
    display: "block", width: "100%", padding: "16px",
    borderRadius: 14, background: "#22c55e", color: "#fff",
    fontSize: 16, fontWeight: 800, border: "none", cursor: "pointer",
};