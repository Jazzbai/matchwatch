"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "../../../../lib/api";
import { FloatingNav } from "../../../../components/AppShell";
import QRCode from "qrcode";

type QrData = {
    venue: { id: string; name: string; slug?: string; coverImageUrl?: string };
    banner: { title: string; landingUrl: string; isActive: boolean };
    match: { homeTeamName: string; awayTeamName: string; matchDateUtc: string } | null;
    qrTargetUrl: string;
};

function QrBannerPage() {
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

    function downloadPng() {
        if (!canvasRef.current || !data) return;
        const url = canvasRef.current.toDataURL("image/png");
        const link = document.createElement("a");
        const safeName = (data.venue.slug || data.venue.name || "matchpoint").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
        link.href = url;
        link.download = `matchpoint-qr-${safeName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    if (loading) return (
        <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--muted-foreground)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono), monospace", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Generating QR…
        </div>
    );
    if (!data) return (
        <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", display: "grid", placeItems: "center", padding: 40, textAlign: "center" }}>
            <div>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🤷</div>
                <h1 style={{ fontWeight: 900, marginBottom: 8 }}>Venue not found</h1>
                <p style={{ color: "var(--muted-foreground)", marginBottom: 20 }}>This QR banner is not available or the venue has not been configured yet.</p>
                <Link href="/admin" style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "underline" }}>Go to dashboard →</Link>
            </div>
        </div>
    );

    const { venue, banner, match } = data;
    const accent = "oklch(0.72 0.19 28)"; // orange — used on the print banner too
    const accentInk = "#0a0b0d";

    return (
        <>
            <FloatingNav />
            <div style={{
                minHeight: "100vh", background: "var(--background)", color: "var(--foreground)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "120px 24px 40px",
            }}>
                {/* Print banner */}
                <div id="qr-banner" style={{
                    width: 480, background: "#fff", borderRadius: 20,
                    padding: "40px 36px", textAlign: "center", color: "#0a0a0b",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                    {/* Brand mark */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: accent, display: "grid", placeItems: "center", fontSize: 16 }}>⚽</div>
                        <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-0.02em" }}>MatchWatch</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: accentInk, background: accent, padding: "3px 8px", borderRadius: 5, marginLeft: 2, letterSpacing: "0.04em" }}>MATCH POINT</span>
                    </div>

                    {/* Banner title */}
                    <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, margin: "0 0 8px", color: "#0a0a0b", textWrap: "balance" as React.CSSProperties["textWrap"] }}>
                        {banner.title}
                    </h1>

                    {/* Venue name */}
                    <p style={{ fontSize: 17, fontWeight: 700, color: accent, margin: "0 0 6px" }}>@ {venue.name}</p>

                    {/* Match context */}
                    {match && (
                        <p style={{ fontSize: 13, color: "#666", margin: "0 0 24px" }}>
                            {match.homeTeamName} vs {match.awayTeamName} ·{" "}
                            {new Date(match.matchDateUtc).toLocaleString(undefined, {
                                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                        </p>
                    )}

                    {/* QR Code */}
                    <div style={{
                        display: "inline-block", padding: 14, borderRadius: 14,
                        border: `3px solid ${accent}`, marginBottom: 22,
                        boxShadow: `0 4px 20px color-mix(in srgb, ${accent} 18%, transparent)`,
                    }}>
                        <canvas ref={canvasRef} />
                    </div>

                    {/* Instructions */}
                    <div style={{ marginBottom: 20, textAlign: "left", maxWidth: 320, marginInline: "auto" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, textAlign: "center" }}>How it works</div>
                        {[
                            ["1.", "Scan with your phone camera"],
                            ["2.", "Sign in with your phone number"],
                            ["3.", "Predict winner (1 pt) or exact score (2 pts)"],
                            ["4.", "Climb the leaderboard for the grand prize"],
                        ].map(([n, step]) => (
                            <div key={n} style={{ fontSize: 13, color: "#444", marginBottom: 5, display: "flex", gap: 8 }}>
                                <span style={{ color: accent, fontWeight: 800, minWidth: 16 }}>{n}</span>
                                <span>{step}</span>
                            </div>
                        ))}
                    </div>

                    {/* Prize callout — neutral */}
                    <div style={{
                        background: "#fff7ed", border: `2px dashed ${accent}`,
                        borderRadius: 12, padding: "12px 16px", marginBottom: 20,
                        fontSize: 12.5, color: "#7c2d12", fontWeight: 700, lineHeight: 1.5,
                    }}>
                        🎁 Top scorers earn entries to the grand-prize sweepstakes.
                    </div>

                    {/* URL hint */}
                    <p style={{ fontSize: 10.5, color: "#999", margin: 0, wordBreak: "break-all" }}>
                        {data.qrTargetUrl}
                    </p>
                </div>

                {/* Tip strip (screen only) */}
                <div className="no-print" style={{
                    maxWidth: 480, marginTop: 24, padding: "14px 18px",
                    borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)",
                    fontSize: 13, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.5,
                }}>
                    Display this banner at the bar, at host stands, or on table tents. Customers scan
                    once and their picks earn your venue points on the leaderboard.
                </div>

                {/* Action buttons (screen only) */}
                <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap", justifyContent: "center" }}>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{ padding: "12px 22px", borderRadius: 10, background: accent, color: accentInk, fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer" }}
                    >
                        🖨 Print banner
                    </button>
                    <button
                        type="button"
                        onClick={downloadPng}
                        style={{ padding: "12px 22px", borderRadius: 10, background: "var(--card)", color: "var(--foreground)", fontSize: 14, fontWeight: 800, border: "1px solid var(--border)", cursor: "pointer" }}
                    >
                        ⬇ Download QR (PNG)
                    </button>
                    {venue.slug && (
                        <Link
                            href={`/venues/${venue.slug}`}
                            style={{ display: "inline-flex", alignItems: "center", padding: "12px 22px", borderRadius: 10, background: "var(--card)", color: "var(--foreground)", fontSize: 14, fontWeight: 800, border: "1px solid var(--border)", textDecoration: "none" }}
                        >
                            View venue page →
                        </Link>
                    )}
                    <Link
                        href="/admin"
                        style={{ display: "inline-flex", alignItems: "center", padding: "12px 22px", borderRadius: 10, background: "var(--card)", color: "var(--foreground)", fontSize: 14, fontWeight: 800, border: "1px solid var(--border)", textDecoration: "none" }}
                    >
                        ← Back to dashboard
                    </Link>
                </div>

                <style>{`
                    @media print {
                        .no-print { display: none !important; }
                        body { background: white; }
                        .site-nav-wrap { display: none !important; }
                    }
                `}</style>
            </div>
        </>
    );
}

export default function QrBannerPageWrapper() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--muted-foreground)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono), monospace", fontSize: 13 }}>
                Generating QR…
            </div>
        }>
            <QrBannerPage />
        </Suspense>
    );
}
