"use client";

import React, { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FloatingNav } from "../../../../components/AppShell";
import { PhoneAuthModal } from "../../../../components/PhoneAuthModal";
import { Countdown } from "../../../../components/Countdown";
import { api, getAccessToken } from "../../../../lib/api";

type Eligibility = "CORRECT_WINNER" | "EXACT_SCORE" | "ANY_ENTRY";
type WinnerPick = "HOME" | "AWAY" | "DRAW";

type CampaignPayload = {
    id: string;
    title: string;
    description: string | null;
    status: "DRAFT" | "OPEN" | "LOCKED" | "SETTLED" | "DRAWN";
    opensAt: string;
    closesAt: string;
    pointsExactScore: number;
    pointsCorrectWinner: number;
    totalEntries: number;
    isOpen: boolean;
    venue: { id: string; name: string; slug: string; city: string | null; coverImageUrl?: string | null };
    match: {
        id: string;
        homeTeamName: string | null;
        awayTeamName: string | null;
        homeTeamCrestUrl: string | null;
        awayTeamCrestUrl: string | null;
        matchDateUtc: string;
        status: string;
        venueName: string | null;
    };
    prizes: Array<{
        id: string;
        sortOrder: number;
        title: string;
        description: string | null;
        imageUrl: string | null;
        eligibility: Eligibility;
        drawCount: number;
        isDrawn: boolean;
    }>;
};

const MW_VARS = `
  :root{
    --mw-bg:var(--background);--mw-card:var(--card);--mw-line:var(--border);
    --mw-fg:var(--foreground);--mw-dim:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);--mw-ink:#0a0b0d;
  }
`;

const CSS = `
  .pp{background:var(--mw-bg);color:var(--mw-fg);min-height:100vh;}
  .pp-wrap{max-width:920px;margin-inline:auto;padding:0 clamp(16px,4vw,28px);}

  .pp-hero{position:relative;overflow:hidden;border-bottom:1px solid var(--mw-line);min-height:520px;display:flex;align-items:center;}
  .pp-hero-bg{position:absolute;inset:0;background-color:#06070a;background-position:center;background-size:cover;background-repeat:no-repeat;}
  .pp-hero-bg.fallback{background-image:url(/home-hero.webp);}
  .pp-hero-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,7,10,0.72) 0%,rgba(6,7,10,0.88) 60%,var(--mw-bg) 100%);}
  .pp-hero-inner{position:relative;z-index:2;max-width:920px;margin-inline:auto;width:100%;padding:140px clamp(16px,4vw,28px) 48px;text-align:center;}
  .pp-bc{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:16px;}
  .pp-bc a{color:rgba(255,255,255,0.7);text-decoration:none;}
  .pp-bc .sep{opacity:.5;margin:0 6px;}
  .pp-kicker{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--mw-accent);font-weight:800;border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);padding:5px 12px;border-radius:999px;margin-bottom:16px;}

  .pp-mh{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:24px;max-width:760px;margin:0 auto 22px;}
  .pp-mht{display:flex;flex-direction:column;align-items:center;gap:12px;}
  .pp-mht img{width:84px;height:84px;object-fit:contain;}
  .pp-mhc{width:84px;height:84px;border-radius:16px;background:rgba(255,255,255,0.1);display:grid;place-items:center;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;color:#fff;font-size:24px;border:1px solid rgba(255,255,255,0.18);}
  .pp-mhn{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.3rem;color:#fff;text-align:center;line-height:1.1;}
  .pp-mvs{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:2.6rem;color:var(--mw-accent);line-height:1;}
  .pp-kickoff{font-family:var(--font-mono),monospace;font-size:13px;letter-spacing:0.08em;color:rgba(255,255,255,0.85);margin-bottom:6px;}
  .pp-meta{font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;color:rgba(255,255,255,0.6);}

  .pp-title{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(1.6rem,3.6vw,2.4rem);line-height:1.05;letter-spacing:-0.02em;margin:18px 0 8px;color:#fff;}
  .pp-sub{font-size:14.5px;color:rgba(255,255,255,0.78);max-width:520px;margin:0 auto 22px;line-height:1.55;}

  .pp-sec{padding:48px 0;border-top:1px solid var(--mw-line);}
  .pp-sec:first-of-type{border-top:0;}
  .pp-sh{margin-bottom:22px;text-align:center;}
  .pp-st{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:1.5rem;letter-spacing:-0.01em;margin:0;}
  .pp-sh-sub{font-size:14px;color:var(--mw-dim);margin:8px auto 0;max-width:620px;line-height:1.55;}

  /* Prizes */
  .pp-prizes{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
  .pp-prize{display:flex;flex-direction:column;border-radius:14px;border:1px solid var(--mw-line);background:var(--mw-card);overflow:hidden;}
  .pp-prize .img{aspect-ratio:16/10;background:linear-gradient(135deg,#1a1108 0%,#3a2410 40%,#0d0f14 100%);position:relative;}
  .pp-prize .img img{width:100%;height:100%;object-fit:cover;display:block;}
  .pp-prize .body{padding:16px;display:flex;flex-direction:column;gap:8px;flex:1;}
  .pp-prize .tag{font-family:var(--font-mono),monospace;font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--mw-accent);}
  .pp-prize h3{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:16px;margin:0;}
  .pp-prize p{font-size:13px;color:var(--mw-dim);margin:0;line-height:1.5;}
  .pp-prize .draws{font-size:12px;color:var(--mw-fg);font-weight:700;font-family:var(--font-mono),monospace;}

  /* Form */
  .pp-form-card{background:var(--mw-card);border:1px solid var(--mw-line);border-radius:18px;padding:28px clamp(20px,4vw,36px);max-width:560px;margin:0 auto;}
  .pp-form-card h3{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:800;font-size:18px;margin:0 0 4px;}
  .pp-form-card .sub{color:var(--mw-dim);font-size:13.5px;margin:0 0 22px;line-height:1.5;}
  .pp-fld{margin-bottom:16px;}
  .pp-lbl{display:block;font-family:var(--font-mono),monospace;font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--mw-dim);margin-bottom:6px;}
  .pp-inp{width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--mw-line);background:var(--mw-bg);color:var(--mw-fg);font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;}
  .pp-inp:focus{border-color:var(--mw-accent);}
  .pp-picks{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
  .pp-pick{padding:14px 10px;border-radius:10px;border:1px solid var(--mw-line);background:var(--mw-bg);color:var(--mw-fg);font-weight:800;font-size:14px;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:0.06em;transition:all .15s;}
  .pp-pick:hover{border-color:color-mix(in srgb,var(--mw-accent) 50%,transparent);}
  .pp-pick.on{background:var(--mw-accent);color:var(--mw-ink);border-color:var(--mw-accent);}
  .pp-scores{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-top:10px;}
  .pp-score{padding:14px;text-align:center;font-size:22px;font-weight:900;font-family:var(--font-space),'Space Grotesk',sans-serif;}
  .pp-score-x{font-family:var(--font-mono),monospace;font-size:13px;color:var(--mw-dim);}
  .pp-submit{width:100%;padding:14px;border-radius:12px;background:var(--mw-accent);color:var(--mw-ink);font-size:15px;font-weight:900;border:none;cursor:pointer;font-family:inherit;margin-top:6px;}
  .pp-submit:disabled{opacity:0.6;cursor:wait;}
  .pp-error{color:#ef4444;font-size:13px;margin:8px 0 0;}
  .pp-success{background:color-mix(in srgb,#22c55e 12%,var(--mw-card));border:1px solid color-mix(in srgb,#22c55e 35%,transparent);border-radius:14px;padding:24px;text-align:center;}
  .pp-success h3{color:#22c55e;font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:20px;margin:0 0 8px;}
  .pp-success p{color:var(--mw-fg);font-size:14px;margin:0;line-height:1.55;}

  .pp-closed-banner{background:color-mix(in srgb,var(--mw-accent) 12%,var(--mw-card));border:1px solid color-mix(in srgb,var(--mw-accent) 35%,transparent);border-radius:14px;padding:22px;text-align:center;}
  .pp-closed-banner b{color:var(--mw-accent);}
  .pp-loading{color:var(--mw-dim);font-size:14px;text-align:center;padding:48px;}

  @media(max-width:760px){
    .pp-hero-inner{padding:120px 16px 36px;}
    .pp-mh{grid-template-columns:1fr;gap:14px;}
    .pp-mvs{font-size:1.4rem;}
  }
`;

function formatKickoff(dateUtc: string) {
    try {
        return new Date(dateUtc).toLocaleString(undefined, {
            weekday: "long", month: "long", day: "numeric",
            hour: "2-digit", minute: "2-digit", timeZoneName: "short",
        });
    } catch {
        return dateUtc;
    }
}

const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
    CORRECT_WINNER: "Pick the winner",
    EXACT_SCORE: "Call the exact score",
    ANY_ENTRY: "Open to all entrants",
};

function PredictContent({ params }: { params: Promise<{ venueSlug: string; matchId: string }> }) {
    const { venueSlug, matchId } = use(params);

    const [campaign, setCampaign] = useState<CampaignPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFoundFlag, setNotFoundFlag] = useState(false);

    const [displayName, setDisplayName] = useState("");
    const [winner, setWinner] = useState<WinnerPick | null>(null);
    const [homeScore, setHomeScore] = useState("");
    const [awayScore, setAwayScore] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);

    const hasExactScorePrize = useMemo(
        () => Boolean(campaign?.prizes.some((p) => p.eligibility === "EXACT_SCORE")),
        [campaign],
    );

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await api.get<CampaignPayload>(
                    `/venues/${venueSlug}/prediction-campaigns/by-match/${matchId}`,
                );
                if (!active) return;
                if (!res.data) {
                    setNotFoundFlag(true);
                    return;
                }
                setCampaign(res.data);
            } catch {
                if (active) setNotFoundFlag(true);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [venueSlug, matchId]);

    useEffect(() => {
        if (notFoundFlag) notFound();
    }, [notFoundFlag]);

    async function submit() {
        if (!campaign) return;
        if (!winner) {
            setSubmitError("Pick a winner first.");
            return;
        }
        if (hasExactScorePrize && (!homeScore || !awayScore)) {
            setSubmitError("Enter both scores to qualify for the exact-score prize.");
            return;
        }
        if (!displayName.trim()) {
            setSubmitError("Enter your name.");
            return;
        }
        if (!getAccessToken()) {
            setShowAuthModal(true);
            return;
        }
        setSubmitting(true);
        setSubmitError(null);
        try {
            const payload: Record<string, unknown> = {
                displayName: displayName.trim(),
                predictedWinner: winner,
            };
            if (homeScore) payload.predictedHomeScore = Number(homeScore);
            if (awayScore) payload.predictedAwayScore = Number(awayScore);

            await api.post(`/prediction-campaigns/${campaign.id}/entries`, payload);
            setSubmitted(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to submit prediction.";
            setSubmitError(message);
        } finally {
            setSubmitting(false);
        }
    }

    function handlePhoneSuccess() {
        setShowAuthModal(false);
        // Retry submit after auth
        void submit();
    }

    if (loading) {
        return (
            <div className="pp">
                <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
                <FloatingNav />
                <div className="pp-loading">Loading match…</div>
            </div>
        );
    }

    if (!campaign) return null;

    const m = campaign.match;
    const fallbackHero = !campaign.venue.coverImageUrl;
    const homeLabel = m.homeTeamName || "Home";
    const awayLabel = m.awayTeamName || "Away";

    return (
        <div className="pp">
            <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
            <FloatingNav />

            <section className="pp-hero">
                <div
                    className={`pp-hero-bg${fallbackHero ? " fallback" : ""}`}
                    style={fallbackHero ? undefined : { backgroundImage: `url(${campaign.venue.coverImageUrl})` }}
                />
                <div className="pp-hero-scrim" />
                <div className="pp-hero-inner">
                    <div className="pp-bc">
                        <Link href={`/venues/${campaign.venue.slug}`}>{campaign.venue.name}</Link>
                        <span className="sep">/</span>
                        <span>Predict to win</span>
                    </div>
                    <span className="pp-kicker">Predict · Win · Live at {campaign.venue.name}</span>

                    <div className="pp-mh">
                        <div className="pp-mht">
                            {m.homeTeamCrestUrl
                                ? <img src={m.homeTeamCrestUrl} alt="" />
                                : <span className="pp-mhc">{homeLabel.slice(0, 2).toUpperCase()}</span>}
                            <span className="pp-mhn">{homeLabel}</span>
                        </div>
                        <span className="pp-mvs">VS</span>
                        <div className="pp-mht">
                            {m.awayTeamCrestUrl
                                ? <img src={m.awayTeamCrestUrl} alt="" />
                                : <span className="pp-mhc">{awayLabel.slice(0, 2).toUpperCase()}</span>}
                            <span className="pp-mhn">{awayLabel}</span>
                        </div>
                    </div>

                    <div className="pp-kickoff">{formatKickoff(m.matchDateUtc)}</div>
                    {m.venueName && <div className="pp-meta">Stadium · {m.venueName}</div>}

                    {campaign.isOpen && (
                        <div style={{ marginTop: 22 }}>
                            <Countdown target={campaign.closesAt} label="Predictions close in" accent="#fff" />
                        </div>
                    )}

                    <h1 className="pp-title">{campaign.title}</h1>
                    {campaign.description && <p className="pp-sub">{campaign.description}</p>}
                </div>
            </section>

            <div className="pp-wrap">
                <section className="pp-sec" style={{ borderTop: 0 }}>
                    <div className="pp-sh">
                        <h2 className="pp-st">Prizes</h2>
                        <p className="pp-sh-sub">{campaign.prizes.length} prize{campaign.prizes.length === 1 ? "" : "s"} on offer. Winners drawn after the match.</p>
                    </div>
                    <div className="pp-prizes">
                        {campaign.prizes.map((p) => (
                            <div key={p.id} className="pp-prize">
                                <div className="img">
                                    {p.imageUrl && <img src={p.imageUrl} alt={p.title} />}
                                </div>
                                <div className="body">
                                    <span className="tag">{ELIGIBILITY_LABEL[p.eligibility]}</span>
                                    <h3>{p.title}</h3>
                                    {p.description && <p>{p.description}</p>}
                                    <div className="draws">{p.drawCount} winner{p.drawCount === 1 ? "" : "s"}{p.isDrawn ? " · Drawn ✓" : ""}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="pp-sec" id="predict">
                    <div className="pp-sh">
                        <h2 className="pp-st">Make your prediction</h2>
                        <p className="pp-sh-sub">
                            {campaign.pointsCorrectWinner} pt for picking the winner · {campaign.pointsExactScore} pts for the exact score.
                        </p>
                    </div>

                    {submitted ? (
                        <div className="pp-success">
                            <h3>You&apos;re in 🎉</h3>
                            <p>
                                Good luck. Stick around at <strong>{campaign.venue.name}</strong> for the result — if you win we&apos;ll
                                ping you via in-app notification and email. Bring ID to claim your prize.
                            </p>
                        </div>
                    ) : !campaign.isOpen ? (
                        <div className="pp-closed-banner">
                            <p>
                                Predictions are <b>{campaign.status === "DRAFT" ? "not yet open" : campaign.status === "OPEN" ? "open" : "closed"}</b> for this match.
                                {(campaign.status === "DRAWN") && (
                                    <> Winners have been drawn — <Link href={`/predict/${campaign.venue.slug}/${m.id}/winners`} style={{ color: "var(--mw-accent)", fontWeight: 800 }}>see the results →</Link></>
                                )}
                            </p>
                        </div>
                    ) : (
                        <div className="pp-form-card">
                            <h3>Pick a winner</h3>
                            <p className="sub">
                                {hasExactScorePrize
                                    ? "Call the exact score to qualify for the exact-score prize."
                                    : "Optional: also predict the score for bragging rights."}
                            </p>

                            <div className="pp-fld">
                                <span className="pp-lbl">Who wins?</span>
                                <div className="pp-picks">
                                    {(["HOME", "DRAW", "AWAY"] as WinnerPick[]).map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            className={`pp-pick${winner === opt ? " on" : ""}`}
                                            onClick={() => setWinner(opt)}
                                        >
                                            {opt === "HOME" ? homeLabel.split(" ").pop() : opt === "AWAY" ? awayLabel.split(" ").pop() : "Draw"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pp-fld">
                                <span className="pp-lbl">Score</span>
                                <div className="pp-scores">
                                    <input
                                        className="pp-inp pp-score"
                                        type="number" inputMode="numeric" min={0} max={30} placeholder="0"
                                        value={homeScore}
                                        onChange={(e) => setHomeScore(e.target.value)}
                                    />
                                    <span className="pp-score-x">–</span>
                                    <input
                                        className="pp-inp pp-score"
                                        type="number" inputMode="numeric" min={0} max={30} placeholder="0"
                                        value={awayScore}
                                        onChange={(e) => setAwayScore(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="pp-fld">
                                <label className="pp-lbl" htmlFor="pp-name">Your name</label>
                                <input
                                    id="pp-name"
                                    className="pp-inp"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="What should we call you on the leaderboard?"
                                    maxLength={100}
                                />
                            </div>

                            <button className="pp-submit" disabled={submitting} onClick={submit}>
                                {submitting ? "Submitting…" : "Submit prediction →"}
                            </button>

                            {submitError && <p className="pp-error">{submitError}</p>}

                            <p style={{ fontSize: 11, color: "var(--mw-dim)", marginTop: 14, textAlign: "center" }}>
                                One entry per person per match. Phone verification required.
                            </p>
                        </div>
                    )}
                </section>
            </div>

            <PhoneAuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onSuccess={handlePhoneSuccess}
                title="Verify your phone to enter"
            />
        </div>
    );
}

export default function PredictPage({ params }: { params: Promise<{ venueSlug: string; matchId: string }> }) {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />}>
            <PredictContent params={params} />
        </Suspense>
    );
}
