"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useData } from "../../../lib/data-provider";
import { FloatingNav } from "../../../components/AppShell";
import { PhoneAuthModal } from "../../../components/PhoneAuthModal";

type Entry = {
    rank: number;
    userId: string;
    name: string;
    avatarUrl?: string | null;
    displayPhone?: string | null;
    totalPoints: number;
    predictions: number;
    correctPredictions: number;
};

const MP_VARS = `
  :root{
    --mp-bg:var(--background);--mp-card:var(--card);--mp-line:var(--border);
    --mp-fg:var(--foreground);--mp-dim:var(--muted-foreground);
    --mp-accent:oklch(0.72 0.19 28);--mp-ink:#0a0b0d;
  }
`;

const LB_CSS = `
  .lb{background:var(--mp-bg);color:var(--mp-fg);min-height:100vh;}
  .lb-wrap{max-width:720px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  /* Hero */
  .lb-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mp-line);min-height:340px;display:flex;align-items:center;}
  .lb-hero-bg{position:absolute;inset:0;background:#06070a url(/match-hero.webp) center/cover no-repeat;}
  .lb-hero-scrim{position:absolute;inset:0;background:linear-gradient(110deg,rgba(6,7,10,0.94) 0%,rgba(6,7,10,0.78) 40%,rgba(6,7,10,0.5) 100%),linear-gradient(0deg,var(--mp-bg) 2%,transparent 50%);}
  .lb-hero-inner{position:relative;z-index:2;max-width:720px;margin-inline:auto;width:100%;padding:130px clamp(16px,4vw,28px) 48px;}
  .lb-back{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);text-decoration:none;margin-bottom:16px;}
  .lb-back:hover{color:#fff;}
  .lb-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mp-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mp-accent) 35%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:14px;}
  .lb-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2rem,5vw,3rem);line-height:1;letter-spacing:-0.025em;margin:0 0 8px;color:#fff;}
  .lb-sub{font-size:1rem;color:rgba(255,255,255,0.78);margin:0;}
  .lb-myrank{display:inline-block;margin-top:14px;padding:7px 16px;border-radius:999px;background:color-mix(in srgb,var(--mp-accent) 18%,transparent);border:1px solid color-mix(in srgb,var(--mp-accent) 40%,transparent);font-size:13px;font-weight:800;color:var(--mp-accent);}

  /* Filter chips */
  .lb-filter{display:flex;flex-wrap:wrap;gap:8px;padding:24px 0 16px;}
  .lb-chip{padding:8px 14px;border-radius:999px;border:1px solid var(--mp-line);background:var(--mp-card);color:var(--mp-fg);font-family:var(--font-mono),monospace;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;}
  .lb-chip:hover{border-color:color-mix(in srgb,var(--mp-accent) 40%,transparent);}
  .lb-chip.on{background:var(--mp-accent);color:var(--mp-ink);border-color:var(--mp-accent);}
  .lb-venue-sel{padding:8px 14px;border-radius:999px;border:1px solid var(--mp-line);background:var(--mp-card);color:var(--mp-fg);font-family:inherit;font-size:12px;}

  /* Rows */
  .lb-row{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:12px;margin-bottom:8px;background:var(--mp-card);border:1px solid var(--mp-line);transition:border-color .14s;}
  .lb-row:hover{border-color:color-mix(in srgb,var(--mp-accent) 30%,transparent);}
  .lb-row.me{background:color-mix(in srgb,var(--mp-accent) 10%,transparent);border-color:color-mix(in srgb,var(--mp-accent) 35%,transparent);}
  .lb-rank{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:20px;min-width:38px;text-align:center;color:var(--mp-dim);}
  .lb-rank.top{color:var(--mp-accent);}
  .lb-avatar{width:40px;height:40px;border-radius:50%;background:var(--mp-bg);display:grid;place-items:center;font-weight:800;font-size:16px;color:var(--mp-dim);overflow:hidden;flex-shrink:0;}
  .lb-avatar img{width:100%;height:100%;object-fit:cover;}
  .lb-meta{flex:1;min-width:0;}
  .lb-name{font-weight:800;font-size:15px;display:flex;align-items:center;gap:8px;}
  .lb-name .you{font-family:var(--font-mono),monospace;font-size:10px;font-weight:800;color:var(--mp-accent);background:color-mix(in srgb,var(--mp-accent) 18%,transparent);padding:2px 7px;border-radius:4px;}
  .lb-stats{font-size:12px;color:var(--mp-dim);margin-top:2px;}
  .lb-pts{text-align:right;flex-shrink:0;}
  .lb-pts .v{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:22px;color:var(--mp-accent);}
  .lb-pts .l{font-family:var(--font-mono),monospace;font-size:9px;letter-spacing:0.1em;color:var(--mp-dim);font-weight:700;}

  /* States */
  .lb-skel{height:64px;border-radius:12px;background:var(--mp-card);border:1px solid var(--mp-line);margin-bottom:8px;opacity:0.5;}
  .lb-empty{text-align:center;padding:60px 20px;border:1px dashed var(--mp-line);border-radius:12px;}
  .lb-empty .glyph{font-size:48px;margin-bottom:14px;}
  .lb-empty h2{font-weight:900;font-size:22px;margin:0 0 8px;}
  .lb-empty p{color:var(--mp-dim);margin:0 0 20px;}
  .lb-btn{display:inline-block;padding:12px 24px;border-radius:12px;background:var(--mp-accent);color:var(--mp-ink);font-size:14px;font-weight:800;border:none;cursor:pointer;text-decoration:none;font-family:inherit;}

  /* Auth nudge */
  .lb-join{margin-top:32px;text-align:center;background:var(--mp-card);border:1px solid var(--mp-line);border-radius:12px;padding:32px;}
  .lb-join .glyph{font-size:36px;margin-bottom:12px;}
  .lb-join h3{font-weight:900;font-size:18px;margin:0 0 8px;}
  .lb-join p{color:var(--mp-dim);font-size:14px;margin:0 0 18px;}
`;

type Mode = "all" | "venue";

export default function LeaderboardPage() {
    const { user } = useAuth();
    const { venues } = useData();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [myRank, setMyRank] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAuth, setShowAuth] = useState(false);

    const [mode, setMode] = useState<Mode>("all");
    const [venueId, setVenueId] = useState<string>("");

    const activeVenues = useMemo(() => venues.filter((v) => v.isActive).slice(0, 80), [venues]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        const query = mode === "venue" && venueId
            ? `/predictions/leaderboard?limit=100&venueId=${encodeURIComponent(venueId)}`
            : "/predictions/leaderboard?limit=100";
        api.get<{ leaderboard: Entry[]; myRank: number | null }>(query)
            .then((res) => {
                setEntries(res.data?.leaderboard ?? []);
                setMyRank(res.data?.myRank ?? null);
            })
            .catch(() => { setEntries([]); setMyRank(null); })
            .finally(() => setLoading(false));
    }, [user, mode, venueId]);

    const medals = ["🥇", "🥈", "🥉"];

    return (
        <div className="lb">
            <style dangerouslySetInnerHTML={{ __html: MP_VARS + LB_CSS + `body{background:var(--mp-bg)!important;color:var(--mp-fg)!important;}` }} />
            <FloatingNav />

            {/* Hero */}
            <section className="lb-hero">
                <div className="lb-hero-bg" />
                <div className="lb-hero-scrim" />
                <div className="lb-hero-inner">
                    <Link href="/match-point" className="lb-back">← Back to Match Point</Link>
                    <span className="lb-kicker">Match Point · Leaderboard</span>
                    <h1 className="lb-h1">Top predictors</h1>
                    <p className="lb-sub">Climb the ranks for a shot at the grand-prize sweepstakes.</p>
                    {myRank != null && <span className="lb-myrank">You&apos;re ranked #{myRank}</span>}
                </div>
            </section>

            <div className="lb-wrap">
                {/* Filter chips */}
                <div className="lb-filter">
                    <button type="button" className={`lb-chip${mode === "all" ? " on" : ""}`} onClick={() => { setMode("all"); setVenueId(""); }}>All-time</button>
                    <button type="button" className={`lb-chip${mode === "venue" ? " on" : ""}`} onClick={() => setMode("venue")}>By venue</button>
                    {mode === "venue" && (
                        <select className="lb-venue-sel" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
                            <option value="">Select a venue…</option>
                            {activeVenues.map((v) => (
                                <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Rows */}
                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => <div key={i} className="lb-skel" />)
                ) : entries.length === 0 ? (
                    <div className="lb-empty">
                        <div className="glyph">🎯</div>
                        <h2>No scores yet</h2>
                        <p>{mode === "venue" ? "No predictions settled for this venue yet." : "Be the first to log a prediction and claim #1."}</p>
                        <Link href="/match-point#predict" className="lb-btn">Make a prediction →</Link>
                    </div>
                ) : entries.map((entry) => {
                    const isMe = user?.id === entry.userId;
                    const pct = entry.predictions > 0 ? Math.round((entry.correctPredictions / entry.predictions) * 100) : 0;
                    return (
                        <div key={entry.userId} className={`lb-row${isMe ? " me" : ""}`}>
                            <span className={`lb-rank${entry.rank <= 3 ? " top" : ""}`}>
                                {entry.rank <= 3 ? medals[entry.rank - 1] : `#${entry.rank}`}
                            </span>
                            <span className="lb-avatar">
                                {entry.avatarUrl
                                    ? <img src={entry.avatarUrl} alt="" />
                                    : (entry.name?.[0] || "?").toUpperCase()}
                            </span>
                            <div className="lb-meta">
                                <div className="lb-name">
                                    {entry.name || entry.displayPhone || "Anonymous"}
                                    {isMe && <span className="you">You</span>}
                                </div>
                                <div className="lb-stats">{entry.correctPredictions}/{entry.predictions} correct · {pct}% accuracy</div>
                            </div>
                            <div className="lb-pts">
                                <div className="v">{entry.totalPoints}</div>
                                <div className="l">pts</div>
                            </div>
                        </div>
                    );
                })}

                {!user && (
                    <div className="lb-join">
                        <div className="glyph">📱</div>
                        <h3>Join the competition</h3>
                        <p>Sign in with your phone to start predicting and appear on the leaderboard.</p>
                        <button type="button" className="lb-btn" onClick={() => setShowAuth(true)}>Join with phone →</button>
                    </div>
                )}
            </div>

            <PhoneAuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => window.location.reload()} />
        </div>
    );
}
