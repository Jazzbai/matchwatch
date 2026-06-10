"use client";

import React, { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { FloatingNav } from "../../../../../components/AppShell";
import { api } from "../../../../../lib/api";

type WinnersPayload = {
    status: string;
    winners: Array<{
        prizeId: string;
        prizeTitle: string;
        prizeImageUrl: string | null;
        winnerName: string;
        drawnAt: string;
    }>;
    message?: string;
};

const MW_VARS = `
  :root{
    --mw-bg:var(--background);--mw-card:var(--card);--mw-line:var(--border);
    --mw-fg:var(--foreground);--mw-dim:var(--muted-foreground);
    --mw-accent:oklch(0.72 0.19 28);--mw-ink:#0a0b0d;
  }
`;

const CSS = `
  .pw{background:var(--mw-bg);color:var(--mw-fg);min-height:100vh;}
  .pw-wrap{max-width:760px;margin-inline:auto;padding:140px clamp(16px,4vw,28px) 80px;}
  .pw-back{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--mw-dim);text-decoration:none;margin-bottom:16px;}
  .pw-back:hover{color:var(--mw-accent);}
  .pw-h1{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:clamp(2rem,4.5vw,3rem);line-height:1.05;letter-spacing:-0.02em;margin:0 0 8px;}
  .pw-h1 em{color:var(--mw-accent);font-style:normal;}
  .pw-sub{font-size:15px;color:var(--mw-dim);margin:0 0 32px;line-height:1.55;}
  .pw-list{display:grid;gap:14px;}
  .pw-row{display:grid;grid-template-columns:80px 1fr;gap:18px;align-items:center;padding:16px;border-radius:14px;border:1px solid var(--mw-line);background:var(--mw-card);}
  .pw-img{width:80px;height:80px;border-radius:10px;background:linear-gradient(135deg,#1a1108,#3a2410);overflow:hidden;}
  .pw-img img{width:100%;height:100%;object-fit:cover;}
  .pw-prize{font-family:var(--font-mono),monospace;font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--mw-accent);margin-bottom:4px;}
  .pw-winner{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:900;font-size:1.2rem;}
  .pw-when{font-size:12px;color:var(--mw-dim);margin-top:4px;font-family:var(--font-mono),monospace;}
  .pw-empty{padding:40px;text-align:center;border:1px dashed var(--mw-line);border-radius:14px;color:var(--mw-dim);font-size:14px;}
`;

function WinnersContent({ params }: { params: Promise<{ venueSlug: string; matchId: string }> }) {
    const { venueSlug, matchId } = use(params);
    const [data, setData] = useState<WinnersPayload | null>(null);
    const [campaignId, setCampaignId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const campaign = await api.get<{ id: string }>(`/venues/${venueSlug}/prediction-campaigns/by-match/${matchId}`);
                if (!active || !campaign.data) {
                    setLoading(false);
                    return;
                }
                setCampaignId(campaign.data.id);
                const winners = await api.get<WinnersPayload>(`/prediction-campaigns/${campaign.data.id}/winners`);
                if (!active) return;
                setData(winners.data);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [venueSlug, matchId]);

    return (
        <div className="pw">
            <style dangerouslySetInnerHTML={{ __html: MW_VARS + CSS + `body{background:var(--mw-bg)!important;color:var(--mw-fg)!important;}` }} />
            <FloatingNav />
            <div className="pw-wrap">
                <Link href={`/predict/${venueSlug}/${matchId}`} className="pw-back">← Back to predictions</Link>
                <h1 className="pw-h1">The <em>winners</em> are…</h1>
                <p className="pw-sub">Drawn from everyone who entered. Bring ID to the venue to claim your prize.</p>

                {loading ? (
                    <div className="pw-empty">Loading…</div>
                ) : !data || data.winners.length === 0 ? (
                    <div className="pw-empty">
                        {data?.message || "Winners haven't been drawn yet. Check back after the venue draws the raffle."}
                    </div>
                ) : (
                    <div className="pw-list">
                        {data.winners.map((w, i) => (
                            <div key={`${w.prizeId}-${i}`} className="pw-row">
                                <div className="pw-img">
                                    {w.prizeImageUrl && <img src={w.prizeImageUrl} alt={w.prizeTitle} />}
                                </div>
                                <div>
                                    <div className="pw-prize">{w.prizeTitle}</div>
                                    <div className="pw-winner">{w.winnerName}</div>
                                    <div className="pw-when">Drawn {new Date(w.drawnAt).toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {campaignId && (
                    <p style={{ marginTop: 24, fontSize: 12, color: "var(--mw-dim)", textAlign: "center" }}>
                        Powered by MatchWatch · Raffle drawn by the venue
                    </p>
                )}
            </div>
        </div>
    );
}

export default function WinnersPage({ params }: { params: Promise<{ venueSlug: string; matchId: string }> }) {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />}>
            <WinnersContent params={params} />
        </Suspense>
    );
}
