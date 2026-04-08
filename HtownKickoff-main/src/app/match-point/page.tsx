"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useData } from "../../lib/data-provider";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { PhoneAuthModal } from "../../components/PhoneAuthModal";

type Prediction = {
    matchId: string;
    predictedWinner: "home" | "away" | "draw";
    predictedHomeScore?: number;
    predictedAwayScore?: number;
    venueId?: string;
    points?: number;
    settled?: boolean;
};

type LeaderboardEntry = {
    rank: number;
    userId: string;
    name: string;
    avatarUrl?: string;
    displayPhone?: string;
    totalPoints: number;
    predictions: number;
    correctPredictions: number;
};

export default function MatchPointPage() {
    const { matches, venues, isLoading, getTeam } = useData();
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // QR scan params: pre-selected venue + match from URL
    const qrVenueId = searchParams.get("venue") ?? null;
    const qrMatchId = searchParams.get("match") ?? null;
    const qrVenue = qrVenueId ? venues.find((v) => v.id === qrVenueId) : null;

    const [showAuthModal, setShowAuthModal] = useState(false);
    const [myPredictions, setMyPredictions] = useState<Prediction[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [pendingPred, setPendingPred] = useState<{ matchId: string; winner: "home" | "away" | "draw" } | null>(null);
    const [checkedInVenueId, setCheckedInVenueId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    // Pre-fill venue selection from QR param for all match cards
    const [selectedVenueId, setSelectedVenueId] = useState<Record<string, string>>(
        qrVenueId && qrMatchId ? { [qrMatchId]: qrVenueId } : {},
    );

    // Upcoming matches — QR-linked match pinned first
    const upcoming = useMemo(() => {
        const now = new Date();
        const cutoff = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const list = matches
            .filter((m) => {
                const d = new Date(m.matchDateUTC);
                return d > now && d < cutoff && ["SCHEDULED", "TIMED"].includes(m.status);
            })
            .sort((a, b) => new Date(a.matchDateUTC).getTime() - new Date(b.matchDateUTC).getTime())
            .slice(0, 12);
        if (qrMatchId) {
            return [...list.filter((m) => m.id === qrMatchId), ...list.filter((m) => m.id !== qrMatchId)];
        }
        return list;
    }, [matches, qrMatchId]);

    // Finished matches with results
    const finished = useMemo(() =>
        matches
            .filter((m) => m.status === "FINISHED" && m.homeScore !== null)
            .sort((a, b) => new Date(b.matchDateUTC).getTime() - new Date(a.matchDateUTC).getTime())
            .slice(0, 6),
        [matches],
    );

    // Auto-check in if arriving via QR with venue+match
    useEffect(() => {
        if (!qrVenueId || !user || checkedInVenueId === qrVenueId) return;
        api.post("/checkins", { venueId: qrVenueId, matchId: qrMatchId ?? undefined, source: "qr" })
            .then(() => {
                setCheckedInVenueId(qrVenueId);
                showToast(`✓ Checked in at ${qrVenue?.name ?? "venue"}! +1 bonus point`);
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, qrVenueId]);

    useEffect(() => {
        if (user) {
            api.get<{ data: Prediction[] }>("/predictions?limit=50")
                .then((res) => setMyPredictions(Array.isArray(res.data) ? res.data : []))
                .catch(() => {});
        }
        api.get<{ leaderboard: LeaderboardEntry[] }>("/predictions/leaderboard?limit=10")
            .then((res) => setLeaderboard(res.data?.leaderboard ?? []))
            .catch(() => {});
    }, [user]);

    function showToast(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    }

    async function submitPrediction(matchId: string, winner: "home" | "away" | "draw") {
        if (!user) {
            setPendingPred({ matchId, winner });
            setShowAuthModal(true);
            return;
        }
        setSubmitting(matchId);
        try {
            await api.post("/predictions", {
                matchId,
                predictedWinner: winner,
                venueId: selectedVenueId[matchId] || undefined,
            });
            setMyPredictions((prev) => {
                const filtered = prev.filter((p) => p.matchId !== matchId);
                return [...filtered, { matchId, predictedWinner: winner, venueId: selectedVenueId[matchId] }];
            });
            showToast("Prediction saved!");
        } catch (err: any) {
            showToast(err?.message || "Failed to save prediction");
        } finally {
            setSubmitting(null);
        }
    }

    async function handleAuthSuccess() {
        if (pendingPred) {
            await submitPrediction(pendingPred.matchId, pendingPred.winner);
            setPendingPred(null);
        }
    }

    function myPredFor(matchId: string) {
        return myPredictions.find((p) => p.matchId === matchId);
    }

    function formatMatchTime(dateUtc: string) {
        return new Date(dateUtc).toLocaleString(undefined, {
            weekday: "short", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    }

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--background)", color: "var(--foreground)" }}>

            {/* Hero */}
            <div style={{
                background: "linear-gradient(135deg, #0a0a0b 0%, #1a1a2e 50%, #0a0a0b 100%)",
                borderBottom: "1px solid var(--border)",
                padding: "60px 24px 48px",
                textAlign: "center",
                position: "relative", overflow: "hidden",
            }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 50% 0%, rgba(34,197,94,0.12) 0%, transparent 60%)", pointerEvents: "none" }} />
                <div style={{ position: "relative", maxWidth: 700, margin: "0 auto" }}>
                    <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 99, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#22c55e", textTransform: "uppercase", marginBottom: 16 }}>
                        FIFA World Cup 2026 · Prediction Game
                    </div>
                    <h1 style={{ fontSize: "clamp(36px,7vw,64px)", fontWeight: 900, lineHeight: 1.05, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
                        Match <span style={{ color: "#22c55e" }}>Point</span>
                    </h1>
                    <p style={{ fontSize: "clamp(15px,2vw,18px)", color: "var(--muted-foreground)", maxWidth: 500, margin: "0 auto 28px", lineHeight: 1.6 }}>
                        Predict match winners, earn points, and climb the leaderboard. Win prizes at your favorite Houston watch party venue.
                    </p>
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                        <div style={statChipStyle}>🏆 Correct score = 5 pts</div>
                        <div style={statChipStyle}>✓ Correct winner = 2 pts</div>
                        <div style={statChipStyle}>📍 Check in = +1 bonus</div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr min(320px,35%)", gap: 32, alignItems: "start" }}>

                    {/* Left: Upcoming Matches */}
                    <div>
                        <h2 style={sectionHead}>Predict Upcoming Matches</h2>
                        {isLoading && upcoming.length === 0 ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} style={{ height: 120, borderRadius: 16, background: "var(--card)", marginBottom: 12, animation: "pulse 1.5s infinite" }} />
                            ))
                        ) : upcoming.length === 0 ? (
                            <p style={{ color: "var(--muted-foreground)", padding: 24 }}>No upcoming matches to predict right now.</p>
                        ) : upcoming.map((match) => {
                            const myPred = myPredFor(match.id);
                            const busy = submitting === match.id;
                            return (
                                <div key={match.id} style={matchCard}>
                                    {/* Match header */}
                                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                        {formatMatchTime(match.matchDateUTC)}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                        {/* Home */}
                                        <div style={{ flex: 1, textAlign: "right" }}>
                                            {getTeam(match.homeTeamId)?.image && <img src={getTeam(match.homeTeamId)!.image} alt="" style={{ width: 36, height: 36, objectFit: "contain", marginBottom: 4 }} loading="lazy" />}
                                            <div style={{ fontWeight: 800, fontSize: 15 }}>{match.homeTeamName}</div>
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", flexShrink: 0 }}>VS</div>
                                        {/* Away */}
                                        <div style={{ flex: 1, textAlign: "left" }}>
                                            {getTeam(match.awayTeamId)?.image && <img src={getTeam(match.awayTeamId)!.image} alt="" style={{ width: 36, height: 36, objectFit: "contain", marginBottom: 4 }} loading="lazy" />}
                                            <div style={{ fontWeight: 800, fontSize: 15 }}>{match.awayTeamName}</div>
                                        </div>
                                    </div>

                                    {/* Prediction buttons */}
                                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                        {(["home", "draw", "away"] as const).map((opt) => {
                                            const label = opt === "home" ? match.homeTeamName || "Home" : opt === "away" ? match.awayTeamName || "Away" : "Draw";
                                            const active = myPred?.predictedWinner === opt;
                                            return (
                                                <button
                                                    key={opt}
                                                    onClick={() => submitPrediction(match.id, opt)}
                                                    disabled={busy}
                                                    style={{
                                                        flex: 1, padding: "10px 4px", borderRadius: 10,
                                                        border: active ? "2px solid #22c55e" : "1px solid var(--border)",
                                                        background: active ? "rgba(34,197,94,0.15)" : "var(--secondary)",
                                                        color: active ? "#22c55e" : "var(--foreground)",
                                                        fontSize: 12, fontWeight: 800, cursor: "pointer",
                                                        transition: "all 0.15s",
                                                    }}
                                                >
                                                    {busy ? "…" : label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Optional venue selection */}
                                    <select
                                        value={selectedVenueId[match.id] || ""}
                                        onChange={(e) => setSelectedVenueId((prev) => ({ ...prev, [match.id]: e.target.value }))}
                                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--secondary)", color: selectedVenueId[match.id] ? "var(--foreground)" : "var(--muted-foreground)", fontSize: 12, fontFamily: "inherit" }}
                                    >
                                        <option value="">📍 Where are you watching? (optional)</option>
                                        {venues.filter((v) => v.isActive).slice(0, 30).map((v) => (
                                            <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
                                        ))}
                                    </select>

                                    {myPred && (
                                        <div style={{ marginTop: 8, fontSize: 11, color: "#22c55e", fontWeight: 700 }}>
                                            ✓ Your pick: {myPred.predictedWinner.toUpperCase()}
                                            {myPred.settled && ` · ${myPred.points} pts`}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Recent Results */}
                        {finished.length > 0 && (
                            <>
                                <h2 style={{ ...sectionHead, marginTop: 40 }}>Recent Results</h2>
                                {finished.map((match) => {
                                    const myPred = myPredFor(match.id);
                                    const actualWinner = (match.homeScore ?? 0) > (match.awayScore ?? 0) ? "home" : (match.awayScore ?? 0) > (match.homeScore ?? 0) ? "away" : "draw";
                                    const correct = myPred && myPred.predictedWinner === actualWinner;
                                    return (
                                        <div key={match.id} style={{ ...matchCard, opacity: 0.85 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ fontWeight: 800, fontSize: 14, flex: 1, textAlign: "right" }}>{match.homeTeamName}</span>
                                                <span style={{ fontWeight: 900, fontSize: 20, minWidth: 60, textAlign: "center", color: "var(--primary)" }}>
                                                    {match.homeScore} – {match.awayScore}
                                                </span>
                                                <span style={{ fontWeight: 800, fontSize: 14, flex: 1 }}>{match.awayTeamName}</span>
                                            </div>
                                            {myPred && (
                                                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: correct ? "#22c55e" : "#ef4444" }}>
                                                    {correct ? "✓ Correct!" : "✗ Wrong"} — You picked {myPred.predictedWinner}
                                                    {myPred.settled && ` · +${myPred.points} pts`}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    {/* Right: Leaderboard */}
                    <div style={{ position: "sticky", top: 80 }}>
                        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: 24 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>🏆 Leaderboard</h2>
                                <button onClick={() => router.push("/match-point/leaderboard")} style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}>
                                    Full →
                                </button>
                            </div>
                            {leaderboard.length === 0 ? (
                                <p style={{ color: "var(--muted-foreground)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                                    No predictions settled yet. Be first!
                                </p>
                            ) : leaderboard.map((entry) => (
                                <div key={entry.userId} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: user?.id === entry.userId ? "rgba(34,197,94,0.1)" : "var(--secondary)", border: user?.id === entry.userId ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent" }}>
                                    <span style={{ fontSize: 13, fontWeight: 900, color: entry.rank <= 3 ? "#22c55e" : "var(--muted-foreground)", minWidth: 22 }}>
                                        {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
                                    </span>
                                    {entry.avatarUrl
                                        ? <img src={entry.avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
                                        : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "var(--muted-foreground)" }}>{entry.name[0]}</div>
                                    }
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.name}</div>
                                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{entry.correctPredictions}/{entry.predictions} correct</div>
                                    </div>
                                    <span style={{ fontWeight: 900, fontSize: 16, color: "#22c55e" }}>{entry.totalPoints}</span>
                                </div>
                            ))}

                            {!user && (
                                <button onClick={() => setShowAuthModal(true)} style={{ display: "block", width: "100%", marginTop: 16, padding: "12px", borderRadius: 12, background: "#22c55e", color: "#fff", fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer" }}>
                                    Join with Phone Number
                                </button>
                            )}
                        </div>

                        {/* Points guide */}
                        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: 20, marginTop: 16 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 900, marginBottom: 14 }}>How to Earn Points</h3>
                            {[
                                ["🎯", "Exact score prediction", "5 pts"],
                                ["✓", "Correct match winner", "2 pts"],
                                ["📍", "Check in at your venue", "+1 bonus"],
                            ].map(([icon, label, pts]) => (
                                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
                                    <span>{icon} {label}</span>
                                    <span style={{ fontWeight: 800, color: "#22c55e" }}>{pts}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(34,197,94,0.08)", borderRadius: 10, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                                🏅 Top scorer at each venue wins a free drink or table upgrade!
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Sponsors ── */}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 60, padding: "48px 24px" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                    <p style={{ textAlign: "center", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "var(--muted-foreground)", textTransform: "uppercase", marginBottom: 28 }}>
                        Official Sponsors
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 40 }}>
                        {SPONSORS.map((s) => (
                            <a
                                key={s.name}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={s.name}
                                style={{ opacity: 0.55, transition: "opacity 0.2s", display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--foreground)" }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.55")}
                            >
                                {s.logo
                                    ? <img src={s.logo} alt={s.name} style={{ height: 36, objectFit: "contain", maxWidth: 120 }} />
                                    : <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em" }}>{s.name}</span>
                                }
                            </a>
                        ))}
                        {/* Become a sponsor CTA */}
                        <a
                            href="mailto:sponsors@matchwatch.us"
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 99, border: "1.5px dashed var(--border)", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textDecoration: "none", transition: "border-color 0.2s, color 0.2s" }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#22c55e"; e.currentTarget.style.color = "#22c55e"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted-foreground)"; }}
                        >
                            + Become a Sponsor
                        </a>
                    </div>
                </div>
            </div>

            <PhoneAuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onSuccess={handleAuthSuccess}
            />

            {toast && (
                <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#22c55e", color: "#fff", padding: "12px 24px", borderRadius: 99, fontSize: 14, fontWeight: 700, zIndex: 999, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
                    {toast}
                </div>
            )}
        </div>
    );
}

// ── Sponsor data — replace with real logos/URLs ──
const SPONSORS: { name: string; url: string; logo?: string }[] = [
    { name: "Modelo", url: "https://www.modelousa.com", logo: "/sponsors/modelo.png" },
    { name: "Buffalo Wild Wings", url: "https://www.buffalowildwings.com", logo: "/sponsors/bww.png" },
    { name: "Visit Houston", url: "https://www.visithoustontexas.com", logo: "/sponsors/visit-houston.png" },
    { name: "Audi", url: "https://www.audiusa.com", logo: "/sponsors/audi.png" },
];

// — static-ish styles —

const statChipStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 16px", borderRadius: 99,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    fontSize: 13, fontWeight: 700, color: "var(--foreground)",
};
const sectionHead: React.CSSProperties = {
    fontSize: 20, fontWeight: 900, marginBottom: 16,
};

const matchCard: React.CSSProperties = {
    background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: 16, padding: "20px", marginBottom: 12,
};