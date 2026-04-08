"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { PhoneAuthModal } from "../../../components/PhoneAuthModal";

type Entry = {
    rank: number;
    userId: string;
    name: string;
    avatarUrl?: string;
    displayPhone?: string;
    totalPoints: number;
    predictions: number;
    correctPredictions: number;
};

export default function LeaderboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [myRank, setMyRank] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAuth, setShowAuth] = useState(false);

    useEffect(() => {
        api.get<{ leaderboard: Entry[]; myRank: number | null }>("/predictions/leaderboard?limit=100")
            .then((res) => {
                setEntries(res.data?.leaderboard ?? []);
                setMyRank(res.data?.myRank ?? null);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [user]);

    const medals = ["🥇", "🥈", "🥉"];

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--background)", color: "var(--foreground)" }}>
            {/* Header */}
            <div style={{ borderBottom: "1px solid var(--border)", padding: "40px 24px 32px", textAlign: "center", background: "linear-gradient(180deg, rgba(34,197,94,0.06) 0%, transparent 100%)" }}>
                <button onClick={() => router.push("/match-point")} style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
                    ← Back to Match Point
                </button>
                <h1 style={{ fontSize: 36, fontWeight: 900, margin: "0 0 8px" }}>🏆 Leaderboard</h1>
                <p style={{ color: "var(--muted-foreground)", fontSize: 15 }}>
                    Top predictors across all matches
                </p>
                {myRank && <div style={{ marginTop: 12, display: "inline-block", padding: "6px 16px", borderRadius: 99, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", fontSize: 13, fontWeight: 800, color: "#22c55e" }}>You are #{myRank}</div>}
            </div>

            <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
                {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} style={{ height: 60, borderRadius: 14, background: "var(--card)", marginBottom: 8, opacity: 1 - i * 0.06 }} />
                    ))
                ) : entries.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60 }}>
                        <div style={{ fontSize: 56, marginBottom: 16 }}>🎯</div>
                        <h2 style={{ fontWeight: 900 }}>No scores yet</h2>
                        <p style={{ color: "var(--muted-foreground)" }}>Be the first to predict a match!</p>
                        <button onClick={() => router.push("/match-point")} style={{ marginTop: 20, padding: "12px 24px", borderRadius: 12, background: "#22c55e", color: "#fff", fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer" }}>
                            Make a Prediction →
                        </button>
                    </div>
                ) : entries.map((entry) => {
                    const isMe = user?.id === entry.userId;
                    const pct = entry.predictions > 0 ? Math.round((entry.correctPredictions / entry.predictions) * 100) : 0;
                    return (
                        <div key={entry.userId} style={{
                            display: "flex", alignItems: "center", gap: 14,
                            padding: "14px 18px", borderRadius: 16, marginBottom: 8,
                            background: isMe ? "rgba(34,197,94,0.1)" : "var(--card)",
                            border: isMe ? "1.5px solid rgba(34,197,94,0.4)" : "1px solid var(--border)",
                            transition: "all 0.15s",
                        }}>
                            <span style={{ fontSize: 20, minWidth: 36, textAlign: "center", fontWeight: 900, color: entry.rank <= 3 ? "#22c55e" : "var(--muted-foreground)" }}>
                                {entry.rank <= 3 ? medals[entry.rank - 1] : `#${entry.rank}`}
                            </span>
                            {entry.avatarUrl
                                ? <img src={entry.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                                : <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, flexShrink: 0 }}>{entry.name[0]?.toUpperCase()}</div>
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                                    {entry.name}
                                    {isMe && <span style={{ fontSize: 10, fontWeight: 800, color: "#22c55e", background: "rgba(34,197,94,0.15)", padding: "2px 6px", borderRadius: 4 }}>YOU</span>}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                                    {entry.correctPredictions}/{entry.predictions} correct · {pct}% accuracy
                                </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 22, fontWeight: 900, color: "#22c55e" }}>{entry.totalPoints}</div>
                                <div style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 700 }}>PTS</div>
                            </div>
                        </div>
                    );
                })}

                {!user && (
                    <div style={{ marginTop: 32, textAlign: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: 32 }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>📱</div>
                        <h3 style={{ fontWeight: 900, marginBottom: 8 }}>Join the competition</h3>
                        <p style={{ color: "var(--muted-foreground)", fontSize: 14, marginBottom: 20 }}>Sign in with your phone to start predicting and appear on the leaderboard.</p>
                        <button onClick={() => setShowAuth(true)} style={{ padding: "14px 32px", borderRadius: 12, background: "#22c55e", color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer" }}>
                            Join with Phone →
                        </button>
                    </div>
                )}
            </div>

            <PhoneAuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => window.location.reload()} />
        </div>
    );
}