"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "../../../../lib/api";
import QRCode from "qrcode";

type QrData = {
    venue: { id: string; name: string; coverImageUrl?: string };
    banner: { title: string; landingUrl: string; isActive: boolean };
    match: { homeTeamName: string; awayTeamName: string; matchDateUtc: string } | null;
    qrTargetUrl: string;
};

export default function QrBannerPage() {
    const { venueId } = useParams<{ venueId: string }>();
    const searchParams = useSearchParams();
    const matchId = searchParams.get("matchId");
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [data, setData] = useState<QrData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<QrData>(`/checkins/qr/${venueId}${matchId ? `?matchId=${matchId}` : ""}`)
            .then((res) => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [venueId, matchId]);

    useEffect(() => {
        if (!data?.qrTargetUrl || !canvasRef.current) return;
        QRCode.toCanvas(canvasRef.current, data.qrTargetUrl, {
            width: 220,
            margin: 2,
            color: { dark: "#0a0a0b", light: "#ffffff" },
        });
    }, [data]);

    if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#999" }}>Generating QR…</div>;
    if (!data) return <div style={{ padding: 60, textAlign: "center" }}>Venue not found.</div>;

    const { venue, banner, match } = data;

    return (
        <div style={{
            minHeight: "100vh", backgroundColor: "#0a0a0b", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 24,
        }}>
            {/* Print banner */}
            <div id="qr-banner" style={{
                width: 480, background: "#fff", borderRadius: 24,
                padding: "40px 36px", textAlign: "center", color: "#0a0a0b",
                boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                fontFamily: "system-ui, -apple-system, sans-serif",
            }}>
                {/* MatchWatch logo / branding */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 24 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚽</div>
                    <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-0.02em" }}>MatchWatch</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#22c55e", background: "rgba(34,197,94,0.12)", padding: "3px 8px", borderRadius: 6, marginLeft: 2 }}>MATCH POINT</span>
                </div>

                {/* Banner title */}
                <h1 style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, margin: "0 0 8px", color: "#0a0a0b" }}>
                    {banner.title}
                </h1>

                {/* Venue name */}
                <p style={{ fontSize: 18, fontWeight: 700, color: "#22c55e", margin: "0 0 6px" }}>@ {venue.name}</p>

                {/* Match context */}
                {match && (
                    <p style={{ fontSize: 13, color: "#666", margin: "0 0 28px" }}>
                        {match.homeTeamName} vs {match.awayTeamName} ·{" "}
                        {new Date(match.matchDateUtc).toLocaleString(undefined, {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                    </p>
                )}

                {/* QR Code */}
                <div style={{
                    display: "inline-block", padding: 16, borderRadius: 16,
                    border: "3px solid #22c55e", marginBottom: 24,
                    boxShadow: "0 4px 20px rgba(34,197,94,0.2)",
                }}>
                    <canvas ref={canvasRef} />
                </div>

                {/* Instructions */}
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>How it works:</div>
                    {[
                        "1. Scan QR with your phone camera",
                        "2. Sign in with your phone number",
                        "3. Check in to earn bonus points",
                        "4. Predict the match winner",
                    ].map((step) => (
                        <div key={step} style={{ fontSize: 13, color: "#444", marginBottom: 4 }}>{step}</div>
                    ))}
                </div>

                {/* Prize callout */}
                <div style={{
                    background: "#f0fdf4", border: "2px dashed #22c55e",
                    borderRadius: 14, padding: "14px 18px", marginBottom: 24,
                    fontSize: 13, color: "#166534", fontWeight: 700, lineHeight: 1.5,
                }}>
                    🏆 Top World Cup predictor wins a brand new car — sponsored by Ford, GM & Chrysler!
                </div>

                {/* URL hint */}
                <p style={{ fontSize: 11, color: "#999", margin: 0, wordBreak: "break-all" }}>
                    {data.qrTargetUrl}
                </p>
            </div>

            {/* Print button (screen only) */}
            <div style={{ position: "fixed", bottom: 24, right: 24 }} className="no-print">
                <button
                    onClick={() => window.print()}
                    style={{ padding: "14px 28px", borderRadius: 12, background: "#22c55e", color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", boxShadow: "0 8px 24px rgba(34,197,94,0.4)" }}
                >
                    🖨 Print Banner
                </button>
            </div>

            <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
        </div>
    );
}