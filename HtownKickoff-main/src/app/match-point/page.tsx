"use client";
import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useData } from "../../lib/data-provider";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { FloatingNav } from "../../components/AppShell";
import { Countdown } from "../../components/Countdown";
import { PhoneAuthModal } from "../../components/PhoneAuthModal";

type Prediction = {
    matchId: string;
    predictedWinner: "home" | "away" | "draw";
    predictedHomeScore?: number | null;
    predictedAwayScore?: number | null;
    venueId?: string | null;
    points?: number | null;
    settled?: boolean | null;
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

const MP_VARS = `
  :root{
    --mp-bg:var(--background);--mp-card:var(--card);--mp-line:var(--border);
    --mp-fg:var(--foreground);--mp-dim:var(--muted-foreground);
    --mp-accent:oklch(0.72 0.19 28);--mp-ink:#0a0b0d;
  }
`;

const MP_CSS = `
  .mp{background:var(--mp-bg);color:var(--mp-fg);min-height:100vh;}
  .mp-wrap{max-width:1200px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  /* Hero */
  .mp-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mp-line);min-height:560px;display:flex;align-items:center;}
  .mp-hero-bg{position:absolute;inset:0;background:#06070a url(/match-hero.webp) center/cover no-repeat;}
  .mp-hero-scrim{position:absolute;inset:0;background:linear-gradient(110deg,rgba(6,7,10,0.94) 0%,rgba(6,7,10,0.78) 40%,rgba(6,7,10,0.45) 100%),linear-gradient(0deg,var(--mp-bg) 2%,transparent 40%);}
  .mp-hero-inner{position:relative;z-index:2;max-width:1200px;margin-inline:auto;width:100%;padding:150px clamp(16px,4vw,28px) 64px;}
  .mp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mp-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mp-accent) 32%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:20px;}
  .mp-kicker .bd{width:6px;height:6px;border-radius:50%;background:var(--mp-accent);animation:mpPulse 1.4s ease-in-out infinite;}
  @keyframes mpPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
  .mp-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2.4rem,6vw,4.2rem);line-height:0.98;letter-spacing:-0.025em;margin:0 0 16px;color:#fff;max-width:720px;text-wrap:balance;}
  .mp-h1 em{font-style:normal;color:var(--mp-accent);}
  .mp-sub{max-width:600px;font-size:1.05rem;line-height:1.55;color:rgba(255,255,255,0.82);margin:0 0 24px;}
  .mp-rules{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 28px;}
  .mp-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);font-size:12px;font-weight:700;color:#fff;}
  .mp-pill b{color:var(--mp-accent);}
  .mp-cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;}
  .mp-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;border:1px solid rgba(255,255,255,0.22);color:#fff;transition:all .18s;cursor:pointer;}
  .mp-btn:hover{border-color:rgba(255,255,255,0.5);}
  .mp-btn.primary{background:var(--mp-accent);color:var(--mp-ink);border-color:var(--mp-accent);}
  .mp-btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mp-accent) 35%,transparent);}

  /* Sections */
  .mp-sec{padding:48px 0;border-top:1px solid var(--mp-line);}
  .mp-sh{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap;}
  .mp-st{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.5rem;letter-spacing:-0.01em;display:flex;align-items:center;gap:12px;}
  .mp-st .tag{font-family:var(--font-mono),monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;color:var(--mp-accent);border:1px solid color-mix(in srgb,var(--mp-accent) 35%,transparent);padding:3px 8px;border-radius:6px;}
  .mp-see{font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--mp-dim);text-decoration:none;white-space:nowrap;}
  .mp-see:hover{color:var(--mp-accent);}

  /* How it works */
  .mp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
  .mp-step{border:1px solid var(--mp-line);border-radius:12px;background:var(--mp-card);padding:22px;}
  .mp-step .n{font-family:var(--font-mono),monospace;font-size:12px;font-weight:700;color:var(--mp-ink);background:var(--mp-accent);width:30px;height:30px;border-radius:8px;display:grid;place-items:center;margin-bottom:14px;}
  .mp-step h3{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:16px;margin:0 0 6px;}
  .mp-step p{font-size:13px;color:var(--mp-dim);line-height:1.55;margin:0;}

  /* Two-col layout: matches + rail */
  .mp-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start;}
  @media(max-width:920px){.mp-grid{grid-template-columns:1fr;}.mp-rail{position:static!important;}}

  /* Match prediction cards */
  .mp-mc{border:1px solid var(--mp-line);border-radius:12px;background:var(--mp-card);padding:18px;margin-bottom:12px;}
  .mp-mc.qr{border-color:color-mix(in srgb,var(--mp-accent) 50%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--mp-accent) 30%,transparent);}
  .mp-mc-top{display:flex;align-items:center;justify-content:space-between;font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--mp-dim);margin-bottom:14px;}
  .mp-mc-qr{color:var(--mp-accent);font-weight:700;}
  .mp-mc-teams{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;margin-bottom:14px;}
  .mp-mc-team{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;}
  .mp-mc-team img{width:42px;height:42px;object-fit:contain;}
  .mp-mc-team-name{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:14px;line-height:1.2;}
  .mp-mc-vs{font-family:var(--font-mono),monospace;font-size:12px;font-weight:700;color:var(--mp-dim);}
  .mp-mc-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;}
  .mp-pick{padding:11px 6px;border-radius:10px;border:1px solid var(--mp-line);background:var(--mp-card);color:var(--mp-fg);font-size:12px;font-weight:700;cursor:pointer;transition:all .14s;font-family:inherit;text-transform:uppercase;letter-spacing:0.04em;}
  .mp-pick:hover{border-color:color-mix(in srgb,var(--mp-accent) 50%,transparent);}
  .mp-pick.on{background:var(--mp-accent);color:var(--mp-ink);border-color:var(--mp-accent);}
  .mp-pick:disabled{opacity:0.6;cursor:wait;}
  .mp-score-row{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-bottom:10px;}
  .mp-score-input{width:100%;padding:8px;border-radius:8px;border:1px solid var(--mp-line);background:var(--mp-card);color:var(--mp-fg);text-align:center;font-family:inherit;font-size:18px;font-weight:800;}
  .mp-score-input:focus{outline:none;border-color:var(--mp-accent);}
  .mp-score-x{font-family:var(--font-mono),monospace;font-size:14px;color:var(--mp-dim);text-align:center;}
  .mp-mc-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;}
  .mp-venue-sel{flex:1;min-width:160px;padding:9px 10px;border-radius:8px;border:1px solid var(--mp-line);background:var(--mp-card);color:var(--mp-fg);font-family:inherit;font-size:12px;}
  .mp-save{padding:10px 18px;border-radius:8px;background:var(--mp-accent);color:var(--mp-ink);border:none;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;text-transform:uppercase;letter-spacing:0.06em;}
  .mp-save:disabled{opacity:0.6;cursor:wait;}
  .mp-mc-status{margin-top:10px;padding:8px 12px;border-radius:8px;background:color-mix(in srgb,var(--mp-accent) 10%,transparent);font-size:12px;font-weight:700;color:var(--mp-accent);display:flex;align-items:center;gap:6px;}

  /* Recent results card */
  .mp-rc{border:1px solid var(--mp-line);border-radius:12px;background:var(--mp-card);padding:14px 18px;margin-bottom:10px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
  .mp-rc-teams{flex:1;display:flex;align-items:center;justify-content:center;gap:12px;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;}
  .mp-rc-score{font-size:22px;color:var(--mp-accent);min-width:60px;text-align:center;}
  .mp-rc-mine{font-size:11px;font-weight:700;padding:5px 10px;border-radius:99px;}
  .mp-rc-mine.win{background:color-mix(in srgb,var(--mp-accent) 18%,transparent);color:var(--mp-accent);}
  .mp-rc-mine.lose{background:rgba(239,68,68,0.18);color:#ef4444;}

  /* Rail */
  .mp-rail{position:sticky;top:90px;display:flex;flex-direction:column;gap:14px;}
  .mp-card{border:1px solid var(--mp-line);border-radius:12px;background:var(--mp-card);padding:18px;}
  .mp-card h3{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:16px;margin:0 0 14px;display:flex;align-items:center;justify-content:space-between;}
  .mp-card h3 a{font-family:var(--font-mono),monospace;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--mp-accent);text-decoration:none;}
  .mp-lb-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;margin-bottom:6px;background:var(--mp-bg);border:1px solid transparent;}
  .mp-lb-row.me{background:color-mix(in srgb,var(--mp-accent) 12%,transparent);border-color:color-mix(in srgb,var(--mp-accent) 30%,transparent);}
  .mp-lb-rank{font-family:var(--font-mono),monospace;font-weight:800;font-size:13px;min-width:24px;color:var(--mp-dim);}
  .mp-lb-rank.top{color:var(--mp-accent);}
  .mp-lb-avatar{width:28px;height:28px;border-radius:50%;background:var(--mp-bg);display:grid;place-items:center;font-size:11px;font-weight:800;color:var(--mp-dim);overflow:hidden;flex-shrink:0;}
  .mp-lb-avatar img{width:100%;height:100%;object-fit:cover;}
  .mp-lb-name{flex:1;min-width:0;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .mp-lb-stats{font-size:10px;color:var(--mp-dim);}
  .mp-lb-pts{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:15px;color:var(--mp-accent);}
  .mp-rule{display:flex;align-items:center;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px dashed var(--mp-line);}
  .mp-rule:last-of-type{border-bottom:0;}
  .mp-rule b{color:var(--mp-accent);font-weight:800;}
  .mp-prize{margin-top:12px;padding:14px;border-radius:10px;background:color-mix(in srgb,var(--mp-accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--mp-accent) 24%,transparent);font-size:12px;color:var(--mp-dim);line-height:1.5;}
  .mp-prize b{color:var(--mp-accent);}

  /* Skeleton + empty */
  .mp-skel{height:140px;border-radius:12px;background:var(--mp-card);border:1px solid var(--mp-line);margin-bottom:12px;opacity:0.5;}
  .mp-empty{padding:36px;text-align:center;border:1px dashed var(--mp-line);border-radius:12px;color:var(--mp-dim);font-size:14px;}

  /* Venue CTA strip */
  .mp-vstrip{border:1px solid var(--mp-line);border-radius:12px;background:linear-gradient(120deg,color-mix(in srgb,var(--mp-accent) 8%,transparent),transparent 60%),var(--mp-card);padding:32px;display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between;margin-bottom:32px;}
  .mp-vstrip h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.4rem;margin:0 0 6px;}
  .mp-vstrip p{font-size:14px;color:var(--mp-dim);margin:0;max-width:560px;}

  /* Toast */
  .mp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--mp-accent);color:var(--mp-ink);padding:12px 24px;border-radius:99px;font-size:14px;font-weight:800;z-index:999;box-shadow:0 12px 32px rgba(0,0,0,0.4);}

  @media(max-width:760px){
    .mp-hero-inner{padding:128px 16px 48px;}
    .mp-steps{grid-template-columns:1fr;}
  }
`;

function MatchPointContent() {
    const { matches, venues, isLoading, getTeam } = useData();
    const { user } = useAuth();
    const searchParams = useSearchParams();

    const qrVenueId = searchParams.get("venue") ?? null;
    const qrMatchId = searchParams.get("match") ?? null;
    const qrVenue = qrVenueId ? venues.find((v) => v.id === qrVenueId) : null;

    const [showAuthModal, setShowAuthModal] = useState(false);
    const [myPredictions, setMyPredictions] = useState<Prediction[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [pendingPred, setPendingPred] = useState<{ matchId: string } | null>(null);
    const [checkedInVenueId, setCheckedInVenueId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    // Per-match working state (winner + scores + venue) — local only until "Save"
    const [draft, setDraft] = useState<Record<string, { winner?: "home" | "away" | "draw"; home?: string; away?: string; venueId?: string }>>(
        qrVenueId && qrMatchId ? { [qrMatchId]: { venueId: qrVenueId } } : {},
    );

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

    const nextKickoff = upcoming[0]?.matchDateUTC;

    const finished = useMemo(() =>
        matches
            .filter((m) => m.status === "FINISHED" && m.homeScore !== null && m.homeScore !== undefined)
            .sort((a, b) => new Date(b.matchDateUTC).getTime() - new Date(a.matchDateUTC).getTime())
            .slice(0, 6),
        [matches],
    );

    /* Auto-check in on QR arrival */
    useEffect(() => {
        if (!qrVenueId || !user || checkedInVenueId === qrVenueId) return;
        api.post("/checkins", { venueId: qrVenueId, matchId: qrMatchId ?? undefined, source: "qr" })
            .then(() => {
                setCheckedInVenueId(qrVenueId);
                showToast(`Checked in at ${qrVenue?.name ?? "venue"}`);
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, qrVenueId]);

    /* Load existing predictions + leaderboard */
    useEffect(() => {
        if (user) {
            api.get<Prediction[]>("/predictions?limit=50")
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

    function setDraftField(matchId: string, patch: Partial<{ winner: "home" | "away" | "draw"; home: string; away: string; venueId: string }>) {
        setDraft((prev) => ({ ...prev, [matchId]: { ...(prev[matchId] || {}), ...patch } }));
    }

    /* If user opens a prediction they've already made, seed draft with it */
    useEffect(() => {
        if (myPredictions.length === 0) return;
        setDraft((prev) => {
            const next = { ...prev };
            for (const p of myPredictions) {
                if (!next[p.matchId]) {
                    next[p.matchId] = {
                        winner: p.predictedWinner,
                        home: p.predictedHomeScore != null ? String(p.predictedHomeScore) : "",
                        away: p.predictedAwayScore != null ? String(p.predictedAwayScore) : "",
                        venueId: p.venueId ?? undefined,
                    };
                }
            }
            return next;
        });
    }, [myPredictions]);

    async function savePrediction(matchId: string) {
        const d = draft[matchId];
        if (!d?.winner) {
            showToast("Pick a winner first");
            return;
        }
        if (!user) {
            setPendingPred({ matchId });
            setShowAuthModal(true);
            return;
        }
        setSubmitting(matchId);
        try {
            const homeScore = d.home && d.home !== "" ? Number(d.home) : undefined;
            const awayScore = d.away && d.away !== "" ? Number(d.away) : undefined;
            await api.post("/predictions", {
                matchId,
                predictedWinner: d.winner,
                predictedHomeScore: Number.isFinite(homeScore) ? homeScore : undefined,
                predictedAwayScore: Number.isFinite(awayScore) ? awayScore : undefined,
                venueId: d.venueId || undefined,
            });
            setMyPredictions((prev) => {
                const filtered = prev.filter((p) => p.matchId !== matchId);
                return [...filtered, {
                    matchId,
                    predictedWinner: d.winner!,
                    predictedHomeScore: homeScore ?? null,
                    predictedAwayScore: awayScore ?? null,
                    venueId: d.venueId ?? null,
                }];
            });
            const hasScore = homeScore !== undefined && awayScore !== undefined;
            showToast(hasScore ? "Prediction saved — winner + exact score!" : "Prediction saved");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to save prediction";
            showToast(msg);
        } finally {
            setSubmitting(null);
        }
    }

    async function handleAuthSuccess() {
        if (pendingPred) {
            await savePrediction(pendingPred.matchId);
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
        <div className="mp">
            <style dangerouslySetInnerHTML={{ __html: MP_VARS + MP_CSS + `body{background:var(--mp-bg)!important;color:var(--mp-fg)!important;}` }} />
            <FloatingNav />

            {/* Hero */}
            <section className="mp-hero">
                <div className="mp-hero-bg" />
                <div className="mp-hero-scrim" />
                <div className="mp-hero-inner">
                    <span className="mp-kicker"><span className="bd" />Match Point · QR Prediction Campaign</span>
                    <h1 className="mp-h1">Watch. <em>Predict.</em> Win.</h1>
                    <p className="mp-sub">
                        Scan the QR at a host venue, pick the winner, and — if you&apos;re feeling bold — call the exact
                        score. Top scorers earn entries to the grand-prize sweepstakes. Every kickoff counts.
                    </p>
                    <div className="mp-rules">
                        <span className="mp-pill"><b>1 pt</b> · Correct winner</span>
                        <span className="mp-pill"><b>2 pts</b> · Exact score</span>
                        <span className="mp-pill">Top scorers → grand prize</span>
                    </div>
                    {nextKickoff && (
                        <div style={{ margin: "8px 0 24px" }}>
                            <Countdown target={nextKickoff} label="Next kickoff" accent="#fff" />
                        </div>
                    )}
                    <div className="mp-cta-row">
                        <a href="#predict" className="mp-btn primary">Start predicting</a>
                        <Link href="/venues" className="mp-btn">Find a watch party</Link>
                        <Link href="/match-point/sponsor" className="mp-btn">For venues / sponsors</Link>
                    </div>
                </div>
            </section>

            <div className="mp-wrap">
                {/* How it works */}
                <section className="mp-sec" style={{ borderTop: 0 }}>
                    <div className="mp-sh">
                        <div className="mp-st">How it works <span className="tag">3 steps</span></div>
                    </div>
                    <div className="mp-steps">
                        {[
                            { n: "1", h: "Scan at the venue", p: "Find the Match Point QR at a host bar or restaurant — your venue gets credit for every check-in." },
                            { n: "2", h: "Pick winner + score", p: "Tap the winner for 1 point. Call the exact score for 2 points. Stack picks across the whole tournament." },
                            { n: "3", h: "Watch the leaderboard", p: "Top scorers earn entries to the grand-prize sweepstakes. New rounds every match day." },
                        ].map((s) => (
                            <div key={s.n} className="mp-step">
                                <div className="n">{s.n}</div>
                                <h3>{s.h}</h3>
                                <p>{s.p}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Predict + rail */}
                <section className="mp-sec" id="predict">
                    <div className="mp-grid">
                        {/* Left: matches */}
                        <div>
                            <div className="mp-sh">
                                <div className="mp-st">Predict upcoming matches <span className="tag">{upcoming.length}</span></div>
                                <Link href="/matches" className="mp-see">All fixtures →</Link>
                            </div>

                            {qrVenue && (
                                <div style={{ padding: "12px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--mp-accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--mp-accent) 30%, transparent)", marginBottom: 14, fontSize: 13 }}>
                                    📍 Watching at <b>{qrVenue.name}</b> — your picks count for this venue.
                                </div>
                            )}

                            {isLoading && upcoming.length === 0 ? (
                                Array.from({ length: 3 }).map((_, i) => <div key={i} className="mp-skel" />)
                            ) : upcoming.length === 0 ? (
                                <div className="mp-empty">No upcoming matches to predict right now — check back soon.</div>
                            ) : upcoming.map((match) => {
                                const myPred = myPredFor(match.id);
                                const d = draft[match.id] || {};
                                const home = match.homeTeamId ? getTeam(match.homeTeamId) : undefined;
                                const away = match.awayTeamId ? getTeam(match.awayTeamId) : undefined;
                                const busy = submitting === match.id;
                                const isQr = qrMatchId === match.id;
                                return (
                                    <div key={match.id} className={`mp-mc${isQr ? " qr" : ""}`}>
                                        <div className="mp-mc-top">
                                            <span>{formatMatchTime(match.matchDateUTC)}</span>
                                            {isQr && <span className="mp-mc-qr">📍 From your QR scan</span>}
                                        </div>
                                        <div className="mp-mc-teams">
                                            <div className="mp-mc-team">
                                                {home?.image && <img src={home.image} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                                                <div className="mp-mc-team-name">{match.homeTeamName || "Home"}</div>
                                            </div>
                                            <div className="mp-mc-vs">VS</div>
                                            <div className="mp-mc-team">
                                                {away?.image && <img src={away.image} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                                                <div className="mp-mc-team-name">{match.awayTeamName || "Away"}</div>
                                            </div>
                                        </div>

                                        <div className="mp-mc-row">
                                            {(["home", "draw", "away"] as const).map((opt) => {
                                                const label = opt === "home" ? (match.homeTeamName?.split(" ").pop() || "Home") : opt === "away" ? (match.awayTeamName?.split(" ").pop() || "Away") : "Draw";
                                                const active = d.winner === opt;
                                                return (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => setDraftField(match.id, { winner: opt })}
                                                        disabled={busy}
                                                        className={`mp-pick${active ? " on" : ""}`}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="mp-score-row">
                                            <input
                                                className="mp-score-input"
                                                type="number"
                                                min={0}
                                                max={30}
                                                placeholder="0"
                                                value={d.home ?? ""}
                                                onChange={(e) => setDraftField(match.id, { home: e.target.value })}
                                                aria-label="Home score prediction"
                                            />
                                            <span className="mp-score-x">–</span>
                                            <input
                                                className="mp-score-input"
                                                type="number"
                                                min={0}
                                                max={30}
                                                placeholder="0"
                                                value={d.away ?? ""}
                                                onChange={(e) => setDraftField(match.id, { away: e.target.value })}
                                                aria-label="Away score prediction"
                                            />
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--mp-dim)", marginBottom: 8, textAlign: "center" }}>
                                            Exact score optional — adds 1 extra point on a correct call
                                        </div>

                                        <div className="mp-mc-controls">
                                            <select
                                                className="mp-venue-sel"
                                                value={d.venueId || ""}
                                                onChange={(e) => setDraftField(match.id, { venueId: e.target.value })}
                                            >
                                                <option value="">Where are you watching? (optional)</option>
                                                {venues.filter((v) => v.isActive).slice(0, 50).map((v) => (
                                                    <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
                                                ))}
                                            </select>
                                            <button type="button" className="mp-save" onClick={() => savePrediction(match.id)} disabled={busy || !d.winner}>
                                                {busy ? "Saving…" : myPred ? "Update pick" : "Save pick"}
                                            </button>
                                        </div>

                                        {myPred && (
                                            <div className="mp-mc-status">
                                                ✓ Your pick saved: <b style={{ color: "var(--mp-accent)" }}>{myPred.predictedWinner.toUpperCase()}</b>
                                                {myPred.predictedHomeScore != null && myPred.predictedAwayScore != null && (
                                                    <> · {myPred.predictedHomeScore}–{myPred.predictedAwayScore}</>
                                                )}
                                                {myPred.settled && myPred.points != null && <> · +{myPred.points} pts</>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Recent results */}
                            {finished.length > 0 && (
                                <>
                                    <div className="mp-sh" style={{ marginTop: 32 }}>
                                        <div className="mp-st">Recent results</div>
                                    </div>
                                    {finished.map((match) => {
                                        const myPred = myPredFor(match.id);
                                        const actualWinner = (match.homeScore ?? 0) > (match.awayScore ?? 0) ? "home" : (match.awayScore ?? 0) > (match.homeScore ?? 0) ? "away" : "draw";
                                        const correct = myPred && myPred.predictedWinner === actualWinner;
                                        return (
                                            <div key={match.id} className="mp-rc">
                                                <div className="mp-rc-teams">
                                                    <span>{match.homeTeamName}</span>
                                                    <span className="mp-rc-score">{match.homeScore} – {match.awayScore}</span>
                                                    <span>{match.awayTeamName}</span>
                                                </div>
                                                {myPred && (
                                                    <span className={`mp-rc-mine ${correct ? "win" : "lose"}`}>
                                                        {correct ? "✓ Correct" : "✗ Missed"}
                                                        {myPred.settled && myPred.points != null && ` · +${myPred.points}`}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>

                        {/* Right rail */}
                        <aside className="mp-rail">
                            <div className="mp-card">
                                <h3>🏆 Leaderboard <Link href="/match-point/leaderboard">Full →</Link></h3>
                                {leaderboard.length === 0 ? (
                                    <p style={{ fontSize: 13, color: "var(--mp-dim)", margin: "8px 0 14px" }}>No scores yet — be first on the board.</p>
                                ) : leaderboard.slice(0, 5).map((entry) => {
                                    const me = user?.id === entry.userId;
                                    return (
                                        <div key={entry.userId} className={`mp-lb-row${me ? " me" : ""}`}>
                                            <span className={`mp-lb-rank${entry.rank <= 3 ? " top" : ""}`}>
                                                {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
                                            </span>
                                            <span className="mp-lb-avatar">
                                                {entry.avatarUrl
                                                    ? <img src={entry.avatarUrl} alt="" />
                                                    : entry.name.charAt(0).toUpperCase()}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className="mp-lb-name">{entry.name}</div>
                                                <div className="mp-lb-stats">{entry.correctPredictions}/{entry.predictions} correct</div>
                                            </div>
                                            <span className="mp-lb-pts">{entry.totalPoints}</span>
                                        </div>
                                    );
                                })}
                                {!user && (
                                    <button type="button" onClick={() => setShowAuthModal(true)} style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 10, background: "var(--mp-accent)", color: "var(--mp-ink)", fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                                        Join with phone — it&apos;s free
                                    </button>
                                )}
                            </div>

                            <div className="mp-card">
                                <h3>How to earn points</h3>
                                <div className="mp-rule">Correct winner <b>1 pt</b></div>
                                <div className="mp-rule">Exact score <b>2 pts</b></div>
                                <div className="mp-rule">Check-in bonus <b>+1 pt</b></div>
                                <div className="mp-prize">
                                    🎁 Top scorers earn entries to the <b>grand-prize sweepstakes</b>. New rounds every match day.
                                </div>
                            </div>
                        </aside>
                    </div>
                </section>

                {/* Venue strip */}
                <section className="mp-sec">
                    <div className="mp-vstrip">
                        <div>
                            <h2>Run a bar or restaurant?</h2>
                            <p>Display the Match Point QR at your venue, fill seats on match nights, and put your brand in front of every fan who scans in.</p>
                        </div>
                        <Link href="/match-point/sponsor" className="mp-btn primary">For venues & sponsors</Link>
                    </div>
                </section>
            </div>

            <PhoneAuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onSuccess={handleAuthSuccess}
            />

            {toast && <div className="mp-toast">{toast}</div>}
        </div>
    );
}

export default function MatchPointPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />}>
            <MatchPointContent />
        </Suspense>
    );
}
