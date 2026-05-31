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

/* Same theme tokens as home */
const MW_VARS = `
  :root{
    --mw-bg:var(--background);--mw-card:var(--card);--mw-line:var(--border);
    --mw-fg:var(--foreground);--mw-dim:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);--mw-ink:#0a0b0d;
  }
`;

/* Home page's .hp-* visual language + a couple of .hp-lb-* additions. */
const CSS = `
  .hp{background:var(--mw-bg);color:var(--mw-fg);}
  .hp-wrap{max-width:720px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  .hp-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mw-line);min-height:340px;display:flex;align-items:center;}
  .hp-hero-bg{position:absolute;inset:0;background:#06070a url(/home-hero.webp) center/cover no-repeat;}
  .hp-hero-scrim{position:absolute;inset:0;background:linear-gradient(110deg,rgba(6,7,10,0.94) 0%,rgba(6,7,10,0.78) 40%,rgba(6,7,10,0.5) 100%),linear-gradient(0deg,var(--mw-bg) 2%,transparent 50%);}
  .hp-hero-inner{position:relative;z-index:2;max-width:720px;margin-inline:auto;width:100%;padding:130px clamp(16px,4vw,28px) 48px;}
  .hp-back{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);text-decoration:none;margin-bottom:16px;}
  .hp-back:hover{color:#fff;}
  .hp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:14px;}
  .hp-kicker .bd{width:6px;height:6px;border-radius:50%;background:var(--mw-accent);animation:hpPulse 1.4s ease-in-out infinite;}
  @keyframes hpPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
  .hp-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2rem,5vw,3rem);line-height:1;letter-spacing:-0.025em;margin:0 0 8px;color:#fff;}
  .hp-sub{font-size:1rem;color:rgba(255,255,255,0.78);margin:0;}
  .hp-myrank{display:inline-block;margin-top:14px;padding:7px 16px;border-radius:999px;background:color-mix(in srgb,var(--mw-accent) 18%,transparent);border:1px solid color-mix(in srgb,var(--mw-accent) 40%,transparent);font-size:13px;font-weight:800;color:var(--mw-accent);}

  /* Filter chips */
  .hp-filter{display:flex;flex-wrap:wrap;gap:8px;padding:24px 0 16px;align-items:center;}
  .hp-chip{padding:8px 14px;border-radius:999px;border:1px solid var(--mw-line);background:var(--mw-card);color:var(--mw-fg);font-family:var(--font-mono),monospace;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;font-family:var(--font-mono),monospace;}
  .hp-chip:hover{border-color:color-mix(in srgb,var(--mw-accent) 40%,transparent);}
  .hp-chip.on{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}
  .hp-vsel{padding:8px 14px;border-radius:999px;border:1px solid var(--mw-line);background:var(--mw-card);color:var(--mw-fg);font-family:inherit;font-size:12px;}

  /* Rows */
  .hp-lb-row{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:12px;margin-bottom:8px;background:var(--mw-card);border:1px solid var(--mw-line);transition:border-color .14s;}
  .hp-lb-row:hover{border-color:color-mix(in srgb,var(--mw-accent) 32%,transparent);}
  .hp-lb-row.me{background:color-mix(in srgb,var(--mw-accent) 10%,transparent);border-color:color-mix(in srgb,var(--mw-accent) 35%,transparent);}
  .hp-lb-rank{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:20px;min-width:38px;text-align:center;color:var(--mw-dim);}
  .hp-lb-rank.top{color:var(--mw-accent);}
  .hp-lb-av{width:40px;height:40px;border-radius:50%;background:var(--mw-bg);display:grid;place-items:center;font-weight:800;font-size:16px;color:var(--mw-dim);overflow:hidden;flex-shrink:0;}
  .hp-lb-av img{width:100%;height:100%;object-fit:cover;}
  .hp-lb-meta{flex:1;min-width:0;}
  .hp-lb-name{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:15px;display:flex;align-items:center;gap:8px;}
  .hp-lb-name .you{font-family:var(--font-mono),monospace;font-size:10px;font-weight:800;color:var(--mw-accent);background:color-mix(in srgb,var(--mw-accent) 18%,transparent);padding:2px 7px;border-radius:4px;}
  .hp-lb-stats{font-size:12px;color:var(--mw-dim);margin-top:2px;}
  .hp-lb-pts{text-align:right;flex-shrink:0;}
  .hp-lb-pts .v{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:22px;color:var(--mw-accent);}
  .hp-lb-pts .l{font-family:var(--font-mono),monospace;font-size:9px;letter-spacing:0.1em;color:var(--mw-dim);font-weight:700;}

  /* States */
  .hp-skel{height:64px;border-radius:12px;background:var(--mw-card);border:1px solid var(--mw-line);margin-bottom:8px;opacity:0.5;}
  .hp-empty{text-align:center;padding:60px 20px;border:1px dashed var(--mw-line);border-radius:12px;}
  .hp-empty .glyph{font-size:48px;margin-bottom:14px;}
  .hp-empty h2{font-weight:900;font-size:22px;margin:0 0 8px;}
  .hp-empty p{color:var(--mw-dim);margin:0 0 20px;}
  .hp-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:999px;font-size:13px;font-weight:800;text-decoration:none;cursor:pointer;background:var(--mw-accent);color:var(--mw-ink);border:none;font-family:inherit;}
  .hp-btn:hover{transform:translateY(-1px);box-shadow:0 12px 24px color-mix(in srgb,var(--mw-accent) 32%,transparent);}

  /* Auth nudge */
  .hp-join{margin-top:32px;text-align:center;background:var(--mw-card);border:1px solid var(--mw-line);border-radius:12px;padding:32px;}
  .hp-join .glyph{font-size:36px;margin-bottom:12px;}
  .hp-join h3{font-weight:900;font-size:18px;margin:0 0 8px;}
  .hp-join p{color:var(--mw-dim);font-size:14px;margin:0 0 18px;}
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
        <div className="hp">
            <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
            <FloatingNav />

            {/* Hero */}
            <section className="hp-hero">
                <div className="hp-hero-bg" />
                <div className="hp-hero-scrim" />
                <div className="hp-hero-inner">
                    <Link href="/match-point" className="hp-back">← Back to Match Point</Link>
                    <span className="hp-kicker"><span className="bd" />Match Point · Leaderboard</span>
                    <h1 className="hp-h1">Top predictors</h1>
                    <p className="hp-sub">Climb the ranks for a shot at the grand-prize sweepstakes.</p>
                    {myRank != null && <span className="hp-myrank">You&apos;re ranked #{myRank}</span>}
                </div>
            </section>

            <div className="hp-wrap">
                {/* Filter chips */}
                <div className="hp-filter">
                    <button type="button" className={`hp-chip${mode === "all" ? " on" : ""}`} onClick={() => { setMode("all"); setVenueId(""); }}>All-time</button>
                    <button type="button" className={`hp-chip${mode === "venue" ? " on" : ""}`} onClick={() => setMode("venue")}>By venue</button>
                    {mode === "venue" && (
                        <select className="hp-vsel" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
                            <option value="">Select a venue…</option>
                            {activeVenues.map((v) => (
                                <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Rows */}
                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => <div key={i} className="hp-skel" />)
                ) : entries.length === 0 ? (
                    <div className="hp-empty">
                        <div className="glyph">🎯</div>
                        <h2>No scores yet</h2>
                        <p>{mode === "venue" ? "No predictions settled for this venue yet." : "Be the first to log a prediction and claim #1."}</p>
                        <Link href="/match-point#predict" className="hp-btn">Make a prediction →</Link>
                    </div>
                ) : entries.map((entry) => {
                    const isMe = user?.id === entry.userId;
                    const pct = entry.predictions > 0 ? Math.round((entry.correctPredictions / entry.predictions) * 100) : 0;
                    return (
                        <div key={entry.userId} className={`hp-lb-row${isMe ? " me" : ""}`}>
                            <span className={`hp-lb-rank${entry.rank <= 3 ? " top" : ""}`}>
                                {entry.rank <= 3 ? medals[entry.rank - 1] : `#${entry.rank}`}
                            </span>
                            <span className="hp-lb-av">
                                {entry.avatarUrl
                                    ? <img src={entry.avatarUrl} alt="" />
                                    : (entry.name?.[0] || "?").toUpperCase()}
                            </span>
                            <div className="hp-lb-meta">
                                <div className="hp-lb-name">
                                    {entry.name || entry.displayPhone || "Anonymous"}
                                    {isMe && <span className="you">You</span>}
                                </div>
                                <div className="hp-lb-stats">{entry.correctPredictions}/{entry.predictions} correct · {pct}% accuracy</div>
                            </div>
                            <div className="hp-lb-pts">
                                <div className="v">{entry.totalPoints}</div>
                                <div className="l">pts</div>
                            </div>
                        </div>
                    );
                })}

                {!user && (
                    <div className="hp-join">
                        <div className="glyph">📱</div>
                        <h3>Join the competition</h3>
                        <p>Sign in with your phone to start predicting and appear on the leaderboard.</p>
                        <button type="button" className="hp-btn" onClick={() => setShowAuth(true)}>Join with phone →</button>
                    </div>
                )}
            </div>

            <PhoneAuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => window.location.reload()} />
        </div>
    );
}
