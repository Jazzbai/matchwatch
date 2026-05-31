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

type Settings = {
    prizeName: string;
    prizeDescription: string | null;
    prizeImageUrl: string | null;
    heroSubtitle: string | null;
    isActive: boolean;
};

const SETTINGS_DEFAULT: Settings = {
    prizeName: "Mercedes-Benz C300",
    prizeDescription: "Top point earners across the tournament enter a grand-prize sweepstakes to win a Mercedes-Benz C300.",
    prizeImageUrl: null,
    heroSubtitle: "Scan the QR at a host venue, pick the winner, and call the exact score. Top scorers play for the Mercedes-Benz C300 grand prize.",
    isActive: true,
};

/* ── Same theme tokens as the home page (visually identical) ── */
const MW_VARS = `
  :root{
    --mw-bg:var(--background);--mw-card:var(--card);--mw-line:var(--border);
    --mw-fg:var(--foreground);--mw-dim:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);--mw-ink:#0a0b0d;
  }
`;

/* ── Reuses the home page's .hp-* visual language verbatim, with a few extra
   .hp-prize-* / .hp-pred-* / .hp-lb-* classes for prize, predictions and
   leaderboard cards. ── */
const CSS = `
  .hp{background:var(--mw-bg);color:var(--mw-fg);}
  .hp-wrap{max-width:1200px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  /* Hero */
  .hp-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mw-line);min-height:560px;display:flex;align-items:center;}
  .hp-hero-bg{position:absolute;inset:0;background:#06070a url(/home-hero.webp) center/cover no-repeat;}
  .hp-hero-scrim{position:absolute;inset:0;background:linear-gradient(110deg,rgba(6,7,10,0.94) 0%,rgba(6,7,10,0.78) 40%,rgba(6,7,10,0.45) 100%),linear-gradient(0deg,var(--mw-bg) 2%,transparent 40%);}
  .hp-hero-inner{position:relative;z-index:2;max-width:1200px;margin-inline:auto;width:100%;padding:150px clamp(16px,4vw,28px) 64px;}
  .hp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mw-accent) 32%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:20px;}
  .hp-kicker .bd{width:6px;height:6px;border-radius:50%;background:var(--mw-accent);animation:hpPulse 1.4s ease-in-out infinite;}
  @keyframes hpPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
  .hp-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2.4rem,6vw,4.2rem);line-height:0.98;letter-spacing:-0.025em;margin:0 0 16px;color:#fff;max-width:720px;text-wrap:balance;}
  .hp-h1 em{font-style:normal;color:var(--mw-accent);}
  .hp-sub{max-width:600px;font-size:1.05rem;line-height:1.55;color:rgba(255,255,255,0.82);margin:0 0 24px;}
  .hp-rules{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px;}
  .hp-rule-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);font-size:12px;font-weight:700;color:#fff;}
  .hp-rule-pill b{color:var(--mw-accent);}
  .hp-cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;}
  .hp-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;border:1px solid rgba(255,255,255,0.22);color:#fff;transition:all .18s;cursor:pointer;}
  .hp-btn:hover{border-color:rgba(255,255,255,0.5);}
  .hp-btn.primary{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}
  .hp-btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px color-mix(in srgb,var(--mw-accent) 35%,transparent);}

  /* Section scaffolding */
  .hp-sec{padding:48px 0;border-top:1px solid var(--mw-line);}
  .hp-sec:first-of-type{border-top:0;}
  .hp-sh{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap;}
  .hp-st{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.5rem;letter-spacing:-0.01em;display:flex;align-items:center;gap:12px;}
  .hp-st .tag{font-family:var(--font-mono),monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;color:var(--mw-accent);border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:3px 8px;border-radius:6px;}
  .hp-see{font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--mw-dim);text-decoration:none;white-space:nowrap;}
  .hp-see:hover{color:var(--mw-accent);}

  /* Grand-prize showcase (photo card pattern, big) */
  .hp-prize{position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--mw-line);min-height:320px;background:var(--mw-card);}
  .hp-prize-bg{position:absolute;inset:0;background:#06070a;background-size:cover;background-position:center;}
  .hp-prize-bg.gradient{background:linear-gradient(135deg,#1a1108 0%,#3a2410 35%,#0d0f14 100%);}
  .hp-prize-scrim{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0.55) 50%,rgba(0,0,0,0.1) 100%);}
  .hp-prize-in{position:relative;z-index:2;padding:40px clamp(20px,4vw,40px);min-height:320px;display:flex;flex-direction:column;justify-content:center;max-width:620px;}
  .hp-prize-kicker{display:inline-flex;width:fit-content;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--mw-accent);font-weight:700;border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:18px;}
  .hp-prize-h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(1.8rem,4vw,2.6rem);line-height:1.05;letter-spacing:-0.02em;margin:0 0 12px;color:#fff;}
  .hp-prize-h2 em{font-style:normal;color:var(--mw-accent);}
  .hp-prize-desc{font-size:14.5px;color:rgba(255,255,255,0.82);line-height:1.55;margin:0 0 18px;}
  .hp-prize-glyph{position:absolute;right:36px;top:36px;font-size:80px;opacity:0.18;pointer-events:none;z-index:2;}

  /* How it works */
  .hp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
  .hp-step{border:1px solid var(--mw-line);border-radius:12px;background:var(--mw-card);padding:22px;}
  .hp-step .n{font-family:var(--font-mono),monospace;font-size:12px;font-weight:700;color:var(--mw-ink);background:var(--mw-accent);width:28px;height:28px;border-radius:8px;display:grid;place-items:center;margin-bottom:12px;}
  .hp-step h3{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:16px;margin:0 0 6px;}
  .hp-step p{font-size:13px;color:var(--mw-dim);line-height:1.5;margin:0;}

  /* Prediction cards — built on the home .hp-match palette */
  .hp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;}
  .hp-match{border:1px solid var(--mw-line);border-radius:12px;background:var(--mw-card);padding:16px;display:flex;flex-direction:column;gap:12px;color:inherit;}
  .hp-match.qr{border-color:color-mix(in srgb,var(--mw-accent) 50%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--mw-accent) 30%,transparent);}
  .hp-match-top{display:flex;align-items:center;justify-content:space-between;font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--mw-dim);}
  .hp-match-top .qr-tag{color:var(--mw-accent);font-weight:700;}
  .hp-teams{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;}
  .hp-team-col{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;min-width:0;}
  .hp-team-col img{width:38px;height:38px;object-fit:contain;}
  .hp-crest{width:38px;height:38px;border-radius:8px;display:grid;place-items:center;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:13px;color:#fff;flex-shrink:0;}
  .hp-tnm{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:13px;line-height:1.2;}
  .hp-vs{font-family:var(--font-mono),monospace;font-size:11px;color:var(--mw-dim);font-weight:700;}
  .hp-pred-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
  .hp-pick{padding:10px 4px;border-radius:8px;border:1px solid var(--mw-line);background:var(--mw-bg);color:var(--mw-fg);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:0.04em;transition:all .14s;}
  .hp-pick:hover{border-color:color-mix(in srgb,var(--mw-accent) 50%,transparent);}
  .hp-pick.on{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}
  .hp-pick:disabled{opacity:0.55;cursor:wait;}
  .hp-score-row{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;}
  .hp-score-input{width:100%;padding:8px;border-radius:8px;border:1px solid var(--mw-line);background:var(--mw-bg);color:var(--mw-fg);text-align:center;font-family:inherit;font-size:17px;font-weight:800;}
  .hp-score-input:focus{outline:none;border-color:var(--mw-accent);}
  .hp-score-x{font-family:var(--font-mono),monospace;font-size:13px;color:var(--mw-dim);text-align:center;}
  .hp-score-hint{font-size:10.5px;color:var(--mw-dim);text-align:center;}
  .hp-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:10px;border-top:1px dashed var(--mw-line);}
  .hp-venue-sel{flex:1;min-width:140px;padding:9px 10px;border-radius:8px;border:1px solid var(--mw-line);background:var(--mw-bg);color:var(--mw-fg);font-family:inherit;font-size:12px;}
  .hp-save{padding:10px 16px;border-radius:8px;background:var(--mw-accent);color:var(--mw-ink);border:none;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;text-transform:uppercase;letter-spacing:0.06em;}
  .hp-save:disabled{opacity:0.5;cursor:wait;}
  .hp-saved{font-size:12px;font-weight:700;color:var(--mw-accent);}

  /* Mini leaderboard */
  .hp-lb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;}
  .hp-lb{border:1px solid var(--mw-line);border-radius:12px;background:var(--mw-card);padding:14px 16px;display:flex;align-items:center;gap:12px;}
  .hp-lb.me{border-color:color-mix(in srgb,var(--mw-accent) 40%,transparent);background:color-mix(in srgb,var(--mw-accent) 8%,var(--mw-card));}
  .hp-lb-rank{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:18px;min-width:34px;text-align:center;color:var(--mw-dim);}
  .hp-lb-rank.top{color:var(--mw-accent);}
  .hp-lb-av{width:34px;height:34px;border-radius:50%;background:var(--mw-bg);display:grid;place-items:center;font-weight:800;font-size:13px;color:var(--mw-dim);overflow:hidden;flex-shrink:0;}
  .hp-lb-av img{width:100%;height:100%;object-fit:cover;}
  .hp-lb-name{flex:1;min-width:0;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .hp-lb-pts{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:18px;color:var(--mw-accent);}

  /* Recent results row */
  .hp-rr{border:1px solid var(--mw-line);border-radius:12px;background:var(--mw-card);padding:12px 16px;display:flex;align-items:center;gap:14px;margin-bottom:8px;flex-wrap:wrap;}
  .hp-rr .lh{flex:1;display:flex;align-items:center;justify-content:center;gap:12px;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:14px;}
  .hp-rr .sc{font-size:20px;color:var(--mw-accent);min-width:54px;text-align:center;}
  .hp-rr .mine{font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;}
  .hp-rr .mine.win{background:color-mix(in srgb,var(--mw-accent) 16%,transparent);color:var(--mw-accent);}
  .hp-rr .mine.lose{background:rgba(239,68,68,0.18);color:#ef4444;}

  /* Bottom CTA band */
  .hp-band{border:1px solid var(--mw-line);border-radius:12px;background:linear-gradient(120deg,color-mix(in srgb,var(--mw-accent) 10%,transparent),transparent 60%),var(--mw-card);padding:36px;display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;}
  .hp-band h2{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.6rem;margin:0 0 6px;}
  .hp-band p{font-size:14px;color:var(--mw-dim);margin:0;max-width:520px;}

  .hp-empty{padding:36px 20px;text-align:center;border:1px dashed var(--mw-line);border-radius:12px;color:var(--mw-dim);font-size:14px;}
  .hp-skel{height:180px;border-radius:12px;background:var(--mw-card);border:1px solid var(--mw-line);opacity:0.5;}

  .hp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--mw-accent);color:var(--mw-ink);padding:12px 24px;border-radius:99px;font-size:14px;font-weight:800;z-index:999;box-shadow:0 12px 32px rgba(0,0,0,0.4);}

  @media(max-width:760px){
    .hp-hero-inner{padding:128px 16px 48px;}
    .hp-steps{grid-template-columns:1fr;}
  }
`;

function Crest({ src, label, color }: { src?: string; label: string; color?: string }) {
    const [failed, setFailed] = React.useState(false);
    if (src && !failed) {
        return <img src={src} alt="" onError={() => setFailed(true)} />;
    }
    return (
        <span className="hp-crest" style={{ background: color || "var(--mw-accent)" }}>
            {label.substring(0, 2).toUpperCase()}
        </span>
    );
}

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
    const [settings, setSettings] = useState<Settings>(SETTINGS_DEFAULT);

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

    useEffect(() => {
        api.get<Settings>("/match-point/settings")
            .then((res) => {
                if (res.data) setSettings({ ...SETTINGS_DEFAULT, ...res.data });
            })
            .catch(() => { /* keep defaults */ });
    }, []);

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
            showToast(hasScore ? "Saved — winner + exact score!" : "Saved");
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

    const prizeBgStyle: React.CSSProperties = settings.prizeImageUrl
        ? { backgroundImage: `url(${settings.prizeImageUrl})` }
        : {};

    return (
        <div className="hp">
            <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
            <FloatingNav />

            {/* ── Hero (same shape as home) ── */}
            <section className="hp-hero">
                <div className="hp-hero-bg" />
                <div className="hp-hero-scrim" />
                <div className="hp-hero-inner">
                    <span className="hp-kicker"><span className="bd" />Match Point · QR Prediction Campaign</span>
                    <h1 className="hp-h1">Watch. <em>Predict.</em> Win.</h1>
                    <p className="hp-sub">{settings.heroSubtitle || SETTINGS_DEFAULT.heroSubtitle}</p>
                    <div className="hp-rules">
                        <span className="hp-rule-pill"><b>1 pt</b> · Correct winner</span>
                        <span className="hp-rule-pill"><b>2 pts</b> · Exact score</span>
                        <span className="hp-rule-pill">Grand prize · <b>{settings.prizeName}</b></span>
                    </div>
                    {nextKickoff && (
                        <div style={{ marginBottom: 24 }}>
                            <Countdown target={nextKickoff} label="Next kickoff" accent="#fff" />
                        </div>
                    )}
                    <div className="hp-cta-row">
                        <a href="#predict" className="hp-btn primary">Start predicting</a>
                        <Link href="/venues" className="hp-btn">Find a watch party</Link>
                        <Link href="/match-point/sponsor" className="hp-btn">For venues / sponsors</Link>
                    </div>
                </div>
            </section>

            <div className="hp-wrap">
                {/* ── Grand-prize showcase ── */}
                <section className="hp-sec" style={{ borderTop: 0 }}>
                    <div className="hp-sh">
                        <div className="hp-st">Grand prize <span className="tag">Sweepstakes</span></div>
                    </div>
                    <div className="hp-prize">
                        <div className={`hp-prize-bg${settings.prizeImageUrl ? "" : " gradient"}`} style={prizeBgStyle} />
                        <div className="hp-prize-scrim" />
                        <span className="hp-prize-glyph">🏆</span>
                        <div className="hp-prize-in">
                            <span className="hp-prize-kicker">Top scorers play for</span>
                            <h2 className="hp-prize-h2"><em>{settings.prizeName}</em></h2>
                            <p className="hp-prize-desc">{settings.prizeDescription || SETTINGS_DEFAULT.prizeDescription}</p>
                            <div className="hp-cta-row">
                                <a href="#predict" className="hp-btn primary">Make a prediction</a>
                                <Link href="/match-point/leaderboard" className="hp-btn">View leaderboard</Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── How it works ── */}
                <section className="hp-sec">
                    <div className="hp-sh">
                        <div className="hp-st">How it works <span className="tag">3 steps</span></div>
                    </div>
                    <div className="hp-steps">
                        {[
                            { n: "1", h: "Scan at the venue", p: "Find the Match Point QR at a host bar or restaurant — your venue gets credit for every check-in." },
                            { n: "2", h: "Pick winner + score", p: "Tap the winner for 1 point. Call the exact score for 2 points. Stack picks across the whole tournament." },
                            { n: "3", h: "Watch the leaderboard", p: `Top scorers earn entries to the ${settings.prizeName} sweepstakes. New rounds every match day.` },
                        ].map((s) => (
                            <div key={s.n} className="hp-step">
                                <div className="n">{s.n}</div>
                                <h3>{s.h}</h3>
                                <p>{s.p}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Predict upcoming matches ── */}
                <section className="hp-sec" id="predict">
                    <div className="hp-sh">
                        <div className="hp-st">Predict upcoming matches <span className="tag">{upcoming.length}</span></div>
                        <Link href="/matches" className="hp-see">All fixtures →</Link>
                    </div>

                    {qrVenue && (
                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--mw-accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--mw-accent) 30%, transparent)", marginBottom: 14, fontSize: 13 }}>
                            📍 Watching at <b>{qrVenue.name}</b> — your picks count for this venue.
                        </div>
                    )}

                    {isLoading && upcoming.length === 0 ? (
                        <div className="hp-grid">
                            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="hp-skel" />)}
                        </div>
                    ) : upcoming.length === 0 ? (
                        <div className="hp-empty">No upcoming matches to predict right now — check back soon.</div>
                    ) : (
                        <div className="hp-grid">
                            {upcoming.map((match) => {
                                const myPred = myPredFor(match.id);
                                const d = draft[match.id] || {};
                                const home = match.homeTeamId ? getTeam(match.homeTeamId) : undefined;
                                const away = match.awayTeamId ? getTeam(match.awayTeamId) : undefined;
                                const busy = submitting === match.id;
                                const isQr = qrMatchId === match.id;
                                return (
                                    <div key={match.id} className={`hp-match${isQr ? " qr" : ""}`}>
                                        <div className="hp-match-top">
                                            <span>{formatMatchTime(match.matchDateUTC)}</span>
                                            {isQr && <span className="qr-tag">📍 From QR</span>}
                                        </div>
                                        <div className="hp-teams">
                                            <div className="hp-team-col">
                                                <Crest src={home?.image} label={match.homeTeamName || "Home"} color={home?.color} />
                                                <div className="hp-tnm">{match.homeTeamName || "Home"}</div>
                                            </div>
                                            <div className="hp-vs">VS</div>
                                            <div className="hp-team-col">
                                                <Crest src={away?.image} label={match.awayTeamName || "Away"} color={away?.color} />
                                                <div className="hp-tnm">{match.awayTeamName || "Away"}</div>
                                            </div>
                                        </div>

                                        <div className="hp-pred-row">
                                            {(["home", "draw", "away"] as const).map((opt) => {
                                                const label = opt === "home" ? (match.homeTeamName?.split(" ").pop() || "Home") : opt === "away" ? (match.awayTeamName?.split(" ").pop() || "Away") : "Draw";
                                                const active = d.winner === opt;
                                                return (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => setDraftField(match.id, { winner: opt })}
                                                        disabled={busy}
                                                        className={`hp-pick${active ? " on" : ""}`}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="hp-score-row">
                                            <input
                                                className="hp-score-input"
                                                type="number" min={0} max={30} placeholder="0"
                                                value={d.home ?? ""}
                                                onChange={(e) => setDraftField(match.id, { home: e.target.value })}
                                                aria-label="Home score prediction"
                                            />
                                            <span className="hp-score-x">–</span>
                                            <input
                                                className="hp-score-input"
                                                type="number" min={0} max={30} placeholder="0"
                                                value={d.away ?? ""}
                                                onChange={(e) => setDraftField(match.id, { away: e.target.value })}
                                                aria-label="Away score prediction"
                                            />
                                        </div>
                                        <div className="hp-score-hint">Optional — exact score adds 1 extra point on a correct call</div>

                                        <div className="hp-controls">
                                            <select
                                                className="hp-venue-sel"
                                                value={d.venueId || ""}
                                                onChange={(e) => setDraftField(match.id, { venueId: e.target.value })}
                                            >
                                                <option value="">Where are you watching? (optional)</option>
                                                {venues.filter((v) => v.isActive).slice(0, 50).map((v) => (
                                                    <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
                                                ))}
                                            </select>
                                            <button type="button" className="hp-save" onClick={() => savePrediction(match.id)} disabled={busy || !d.winner}>
                                                {busy ? "Saving…" : myPred ? "Update" : "Save pick"}
                                            </button>
                                        </div>

                                        {myPred && (
                                            <div className="hp-saved">
                                                ✓ Your pick: {myPred.predictedWinner.toUpperCase()}
                                                {myPred.predictedHomeScore != null && myPred.predictedAwayScore != null && (
                                                    <> · {myPred.predictedHomeScore}–{myPred.predictedAwayScore}</>
                                                )}
                                                {myPred.settled && myPred.points != null && <> · +{myPred.points} pts</>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* ── Top predictors ── */}
                <section className="hp-sec">
                    <div className="hp-sh">
                        <div className="hp-st">Top predictors <span className="tag">Live</span></div>
                        <Link href="/match-point/leaderboard" className="hp-see">Full leaderboard →</Link>
                    </div>
                    {leaderboard.length === 0 ? (
                        <div className="hp-empty">No scores yet — be the first on the board.</div>
                    ) : (
                        <div className="hp-lb-grid">
                            {leaderboard.slice(0, 6).map((entry) => {
                                const me = user?.id === entry.userId;
                                return (
                                    <div key={entry.userId} className={`hp-lb${me ? " me" : ""}`}>
                                        <span className={`hp-lb-rank${entry.rank <= 3 ? " top" : ""}`}>
                                            {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
                                        </span>
                                        <span className="hp-lb-av">
                                            {entry.avatarUrl
                                                ? <img src={entry.avatarUrl} alt="" />
                                                : (entry.name?.[0] || "?").toUpperCase()}
                                        </span>
                                        <span className="hp-lb-name">{entry.name}</span>
                                        <span className="hp-lb-pts">{entry.totalPoints}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* ── Recent results ── */}
                {finished.length > 0 && (
                    <section className="hp-sec">
                        <div className="hp-sh">
                            <div className="hp-st">Recent results</div>
                        </div>
                        <div>
                            {finished.map((match) => {
                                const myPred = myPredFor(match.id);
                                const actualWinner = (match.homeScore ?? 0) > (match.awayScore ?? 0) ? "home" : (match.awayScore ?? 0) > (match.homeScore ?? 0) ? "away" : "draw";
                                const correct = myPred && myPred.predictedWinner === actualWinner;
                                return (
                                    <div key={match.id} className="hp-rr">
                                        <div className="lh">
                                            <span>{match.homeTeamName}</span>
                                            <span className="sc">{match.homeScore} – {match.awayScore}</span>
                                            <span>{match.awayTeamName}</span>
                                        </div>
                                        {myPred && (
                                            <span className={`mine ${correct ? "win" : "lose"}`}>
                                                {correct ? "✓ Correct" : "✗ Missed"}
                                                {myPred.settled && myPred.points != null && ` · +${myPred.points}`}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ── Venue/sponsor CTA band ── */}
                <section className="hp-sec">
                    <div className="hp-band">
                        <div>
                            <h2>Run a bar or restaurant?</h2>
                            <p>Display the Match Point QR at your venue, fill seats on match nights, and put your brand in front of every fan who scans in.</p>
                        </div>
                        <Link href="/match-point/sponsor" className="hp-btn primary">For venues & sponsors</Link>
                    </div>
                </section>
            </div>

            <PhoneAuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onSuccess={handleAuthSuccess}
            />

            {toast && <div className="hp-toast">{toast}</div>}
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
