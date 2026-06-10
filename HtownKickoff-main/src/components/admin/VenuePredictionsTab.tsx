"use client";

import * as React from "react";
import { api, uploadApi } from "../../lib/api";

const ELIGIBILITY = ["CORRECT_WINNER", "EXACT_SCORE", "ANY_ENTRY"] as const;
type Eligibility = typeof ELIGIBILITY[number];
type Status = "DRAFT" | "OPEN" | "LOCKED" | "SETTLED" | "DRAWN";

type CampaignRow = {
    campaign: {
        id: string;
        title: string;
        status: Status;
        opensAt: string;
        closesAt: string;
        totalEntries: number;
        correctWinnerCount: number;
        exactScoreCount: number;
    };
    match: {
        id: string;
        homeTeamName: string | null;
        awayTeamName: string | null;
        matchDateUtc: string;
        status: string;
    };
    prizeCount: number;
    drawnPrizeCount: number;
};

type Prize = {
    id?: string;
    title: string;
    description: string;
    imageUrl: string;
    imageS3Key: string;
    eligibility: Eligibility;
    drawCount: number;
};

type CampaignDetail = {
    campaign: {
        id: string;
        title: string;
        description: string | null;
        status: Status;
        opensAt: string;
        closesAt: string;
        pointsExactScore: number;
        pointsCorrectWinner: number;
        totalEntries: number;
        correctWinnerCount: number;
        exactScoreCount: number;
    };
    prizes: Array<Prize & { id: string; sortOrder: number; drawnAt: string | null }>;
    match: { id: string; homeTeamName: string | null; awayTeamName: string | null; matchDateUtc: string; status: string };
};

type Entry = {
    id: string;
    displayName: string;
    phone: string;
    email: string | null;
    predictedWinner: "HOME" | "AWAY" | "DRAW";
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
    points: number;
    isCorrectWinner: boolean;
    isExactScore: boolean;
    createdAt: string;
};

type UpcomingMatch = {
    id: string;
    homeTeamName: string | null;
    awayTeamName: string | null;
    matchDateUtc: string;
    leagueShortName?: string;
};

type Props = {
    selectedVenueId: string;
    venueSlug?: string;
};

const cardStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
};
const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 10,
    fontWeight: 800,
    color: "var(--muted-foreground)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
    display: "block",
};
const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
};

function toLocalDatetimeInput(d: Date) {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60_000);
    return local.toISOString().slice(0, 16);
}

function statusColor(status: Status) {
    if (status === "DRAFT") return "var(--muted-foreground)";
    if (status === "OPEN") return "#22c55e";
    if (status === "LOCKED") return "#eab308";
    if (status === "SETTLED") return "#3b82f6";
    return "var(--primary)";
}

export function VenuePredictionsTab({ selectedVenueId, venueSlug }: Props) {
    const [campaigns, setCampaigns] = React.useState<CampaignRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<string | null>(null);

    const [showCreate, setShowCreate] = React.useState(false);
    const [activeCampaignId, setActiveCampaignId] = React.useState<string | null>(null);

    const loadCampaigns = React.useCallback(async () => {
        if (!selectedVenueId) return;
        setLoading(true);
        try {
            const res = await api.get<CampaignRow[]>(
                `/dashboard/prediction-campaigns?venueId=${encodeURIComponent(selectedVenueId)}`,
            );
            setCampaigns(res.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load campaigns");
        } finally {
            setLoading(false);
        }
    }, [selectedVenueId]);

    React.useEffect(() => { void loadCampaigns(); }, [loadCampaigns]);

    function showToast(setter: (msg: string | null) => void, msg: string) {
        setter(msg);
        setTimeout(() => setter(null), 4000);
    }

    if (loading) {
        return <div style={{ ...cardStyle, color: "var(--muted-foreground)" }}>Loading prediction campaigns…</div>;
    }

    return (
        <div style={{ display: "grid", gap: 20 }}>
            <div style={{ ...cardStyle, flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Venue Predictions</div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
                        Run per-match prediction campaigns at this venue. Configure prizes,
                        share the QR with customers, then draw winners after the match.
                    </div>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    style={{ padding: "10px 18px", borderRadius: 10, background: "var(--primary)", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontSize: 13 }}
                >
                    + New campaign
                </button>
            </div>

            {error && <div style={{ ...cardStyle, color: "#ef4444", borderColor: "rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.08)" }}>{error}</div>}
            {success && <div style={{ ...cardStyle, color: "#22c55e", borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)" }}>{success}</div>}

            {campaigns.length === 0 ? (
                <div style={{ ...cardStyle, color: "var(--muted-foreground)", textAlign: "center", padding: 36 }}>
                    No prediction campaigns yet. Click <b>+ New campaign</b> to set one up for an upcoming match.
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {campaigns.map((c) => {
                        const m = c.match;
                        const drawProgress = c.prizeCount > 0 ? `${c.drawnPrizeCount}/${c.prizeCount} prizes drawn` : "No prizes";
                        return (
                            <div key={c.campaign.id} style={cardStyle}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 800, color: statusColor(c.campaign.status), letterSpacing: "0.1em" }}>
                                        {c.campaign.status}
                                    </span>
                                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--muted-foreground)" }}>
                                        {new Date(m.matchDateUtc).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                    </span>
                                </div>
                                <div style={{ fontWeight: 800, fontSize: 14.5, lineHeight: 1.3 }}>
                                    {(m.homeTeamName || "TBD")} vs {(m.awayTeamName || "TBD")}
                                </div>
                                <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{c.campaign.title}</div>
                                <div style={{ fontSize: 12, color: "var(--foreground)", fontFamily: "var(--font-mono), monospace" }}>
                                    {c.campaign.totalEntries} entries · {drawProgress}
                                </div>
                                <button
                                    onClick={() => setActiveCampaignId(c.campaign.id)}
                                    style={{ marginTop: "auto", padding: "8px 14px", borderRadius: 999, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}
                                >
                                    Manage →
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {showCreate && (
                <CreateCampaignModal
                    selectedVenueId={selectedVenueId}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        setShowCreate(false);
                        showToast(setSuccess, "Campaign created — publish it from the detail view to open submissions.");
                        void loadCampaigns();
                    }}
                />
            )}

            {activeCampaignId && (
                <CampaignDetailModal
                    campaignId={activeCampaignId}
                    selectedVenueId={selectedVenueId}
                    venueSlug={venueSlug}
                    onClose={() => setActiveCampaignId(null)}
                    onMutated={() => {
                        void loadCampaigns();
                    }}
                    onError={(msg) => showToast(setError, msg)}
                    onSuccess={(msg) => showToast(setSuccess, msg)}
                />
            )}
        </div>
    );
}

// ─── Create modal ──────────────────────────────────────────────────

function CreateCampaignModal({
    selectedVenueId,
    onClose,
    onCreated,
}: {
    selectedVenueId: string;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [matches, setMatches] = React.useState<UpcomingMatch[]>([]);
    const [matchId, setMatchId] = React.useState("");
    const [title, setTitle] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [opensAt, setOpensAt] = React.useState(toLocalDatetimeInput(new Date()));
    const [closesAt, setClosesAt] = React.useState("");
    const [pointsCorrectWinner, setPointsCorrectWinner] = React.useState("1");
    const [pointsExactScore, setPointsExactScore] = React.useState("2");
    const [prizes, setPrizes] = React.useState<Prize[]>([
        { title: "", description: "", imageUrl: "", imageS3Key: "", eligibility: "CORRECT_WINNER", drawCount: 1 },
    ]);
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        (async () => {
            try {
                const res = await api.get<Record<string, UpcomingMatch[]>>("/matches/upcoming");
                const flat = Object.values(res.data || {}).flat();
                setMatches(flat);
            } catch { /* ignore */ }
        })();
    }, []);

    React.useEffect(() => {
        // Default closesAt to (matchDateUtc - 5min) when match selected.
        const m = matches.find((x) => x.id === matchId);
        if (m && !closesAt) {
            const close = new Date(m.matchDateUtc);
            close.setMinutes(close.getMinutes() - 5);
            setClosesAt(toLocalDatetimeInput(close));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchId, matches]);

    function addPrize() {
        setPrizes((prev) => [...prev, { title: "", description: "", imageUrl: "", imageS3Key: "", eligibility: "CORRECT_WINNER", drawCount: 1 }]);
    }
    function removePrize(i: number) {
        setPrizes((prev) => prev.filter((_, idx) => idx !== i));
    }
    function updatePrize(i: number, patch: Partial<Prize>) {
        setPrizes((prev) => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
    }

    async function uploadPrizeImage(file: File, i: number) {
        if (!file.type.startsWith("image/")) { setError("Image files only"); return; }
        if (file.size > 4 * 1024 * 1024) { setError("Max 4 MB"); return; }
        try {
            const ct = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
            const presigned = await uploadApi.createPresignedUrl({
                filename: file.name, contentType: ct,
                purpose: "prediction_prize", fileSize: file.size,
            });
            const put = await fetch(presigned.data.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type, ...(presigned.data.uploadHeaders || {}) },
                body: file,
            });
            if (!put.ok) throw new Error("Upload failed");
            updatePrize(i, { imageUrl: presigned.data.publicUrl, imageS3Key: presigned.data.key });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        }
    }

    async function submit() {
        setError(null);
        if (!matchId) { setError("Pick a match"); return; }
        if (!title.trim()) { setError("Title is required"); return; }
        if (!opensAt || !closesAt) { setError("Pick open/close times"); return; }
        if (prizes.length === 0 || prizes.some((p) => !p.title.trim())) {
            setError("Every prize needs a title");
            return;
        }
        setSubmitting(true);
        try {
            await api.post(`/dashboard/prediction-campaigns?venueId=${encodeURIComponent(selectedVenueId)}`, {
                matchId,
                title: title.trim(),
                description: description.trim() || undefined,
                opensAt: new Date(opensAt).toISOString(),
                closesAt: new Date(closesAt).toISOString(),
                pointsCorrectWinner: Number(pointsCorrectWinner) || 1,
                pointsExactScore: Number(pointsExactScore) || 2,
                prizes: prizes.map((p, idx) => ({
                    title: p.title.trim(),
                    description: p.description.trim() || undefined,
                    imageUrl: p.imageUrl || undefined,
                    imageS3Key: p.imageS3Key || undefined,
                    eligibility: p.eligibility,
                    drawCount: Number(p.drawCount) || 1,
                    sortOrder: idx * 10,
                })),
            });
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create campaign");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal onClose={onClose}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>New prediction campaign</div>

            <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
                <div>
                    <label style={labelStyle}>Match</label>
                    <select style={inputStyle} value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                        <option value="">Pick an upcoming match…</option>
                        {matches.map((m) => (
                            <option key={m.id} value={m.id}>
                                {(m.homeTeamName || "TBD")} vs {(m.awayTeamName || "TBD")} · {new Date(m.matchDateUtc).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={labelStyle}>Title</label>
                    <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Predict & Win for USA vs Brazil" maxLength={200} />
                </div>

                <div>
                    <label style={labelStyle}>Description (optional)</label>
                    <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="Short pitch shown on the public landing page" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                        <label style={labelStyle}>Submissions open at</label>
                        <input type="datetime-local" style={inputStyle} value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Submissions close at</label>
                        <input type="datetime-local" style={inputStyle} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                        <label style={labelStyle}>Points · winner</label>
                        <input type="number" min={0} max={100} style={inputStyle} value={pointsCorrectWinner} onChange={(e) => setPointsCorrectWinner(e.target.value)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Points · exact score</label>
                        <input type="number" min={0} max={100} style={inputStyle} value={pointsExactScore} onChange={(e) => setPointsExactScore(e.target.value)} />
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>Prizes ({prizes.length})</div>
                    <button onClick={addPrize} disabled={prizes.length >= 20} type="button"
                        style={{ padding: "6px 12px", borderRadius: 999, background: "var(--primary)", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 12 }}>
                        + Add prize
                    </button>
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                    {prizes.map((p, i) => (
                        <div key={i} style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, display: "grid", gap: 10 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 10, alignItems: "start" }}>
                                <label style={{ ...cardStyle, padding: 0, aspectRatio: "1/1", borderRadius: 10, cursor: "pointer", overflow: "hidden", position: "relative", justifyContent: "center", alignItems: "center" }}>
                                    {p.imageUrl ? (
                                        <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Upload image</span>
                                    )}
                                    <input type="file" accept="image/*" style={{ display: "none" }}
                                        onChange={(e) => e.target.files?.[0] && uploadPrizeImage(e.target.files[0], i)} />
                                </label>
                                <div style={{ display: "grid", gap: 8 }}>
                                    <input style={inputStyle} value={p.title} onChange={(e) => updatePrize(i, { title: e.target.value })} placeholder="Prize title" maxLength={200} />
                                    <input style={inputStyle} value={p.description} onChange={(e) => updatePrize(i, { description: e.target.value })} placeholder="Description (optional)" maxLength={400} />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8 }}>
                                        <select style={inputStyle} value={p.eligibility} onChange={(e) => updatePrize(i, { eligibility: e.target.value as Eligibility })}>
                                            <option value="CORRECT_WINNER">Eligibility · Correct winner</option>
                                            <option value="EXACT_SCORE">Eligibility · Exact score</option>
                                            <option value="ANY_ENTRY">Eligibility · Any entry</option>
                                        </select>
                                        <input type="number" min={1} max={1000} style={inputStyle} value={p.drawCount} onChange={(e) => updatePrize(i, { drawCount: Number(e.target.value) })} placeholder="Draws" />
                                    </div>
                                </div>
                                <button onClick={() => removePrize(i)} disabled={prizes.length === 1} type="button"
                                    style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(220,38,38,0.12)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 10 }}>{error}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>
                <button onClick={submit} disabled={submitting} style={{ padding: "10px 22px", borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", cursor: submitting ? "wait" : "pointer", fontWeight: 800, fontSize: 13, opacity: submitting ? 0.6 : 1 }}>
                    {submitting ? "Creating…" : "Create as DRAFT"}
                </button>
            </div>
        </Modal>
    );
}

// ─── Campaign detail modal ─────────────────────────────────────────

function CampaignDetailModal({
    campaignId,
    selectedVenueId,
    venueSlug,
    onClose,
    onMutated,
    onSuccess,
    onError,
}: {
    campaignId: string;
    selectedVenueId: string;
    venueSlug?: string;
    onClose: () => void;
    onMutated: () => void;
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
}) {
    const [detail, setDetail] = React.useState<CampaignDetail | null>(null);
    const [entries, setEntries] = React.useState<Entry[]>([]);
    const [ipCollisions, setIpCollisions] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState(false);

    const qrCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

    const refresh = React.useCallback(async () => {
        setLoading(true);
        try {
            const [campRes, entriesRes] = await Promise.allSettled([
                api.get<{ campaigns?: CampaignDetail[]; prizes?: CampaignDetail["prizes"] }>(`/prediction-campaigns/${campaignId}`),
                api.get<{ entries: Entry[]; ipCollisionCount: number }>(`/dashboard/prediction-campaigns/${campaignId}/entries?venueId=${encodeURIComponent(selectedVenueId)}&limit=50`),
            ]);
            if (campRes.status === "fulfilled" && campRes.value.data) {
                // The public endpoint returns the campaign/prizes shape; coerce.
                const cd = campRes.value.data as unknown as CampaignDetail;
                setDetail(cd);
            }
            if (entriesRes.status === "fulfilled" && entriesRes.value.data) {
                setEntries(entriesRes.value.data.entries || []);
                setIpCollisions(entriesRes.value.data.ipCollisionCount || 0);
            }
        } finally {
            setLoading(false);
        }
    }, [campaignId, selectedVenueId]);

    React.useEffect(() => { void refresh(); }, [refresh]);

    React.useEffect(() => {
        if (!qrCanvasRef.current || !detail || !venueSlug) return;
        // Lazy-load qrcode to keep main bundle slim.
        void (async () => {
            const { default: QRCode } = await import("qrcode");
            const url = `${window.location.origin}/predict/${venueSlug}/${detail.match.id}`;
            await QRCode.toCanvas(qrCanvasRef.current, url, { width: 220, margin: 1, color: { dark: "#000000", light: "#ffffff" } });
        })();
    }, [detail, venueSlug]);

    async function callDashboard(path: string, init?: RequestInit & { jsonBody?: unknown }) {
        const headers: HeadersInit = { ...(init?.headers || {}) };
        if (init?.jsonBody !== undefined) {
            (headers as Record<string, string>)["Content-Type"] = "application/json";
        }
        const fullPath = `/dashboard/prediction-campaigns/${campaignId}${path}?venueId=${encodeURIComponent(selectedVenueId)}`;
        // Use api.post / api.delete shape via fetch for arbitrary methods.
        const m = (init?.method || "POST").toUpperCase();
        if (m === "POST") return api.post(fullPath, init?.jsonBody);
        if (m === "PATCH") return api.patch(fullPath, init?.jsonBody);
        if (m === "DELETE") return api.delete(fullPath);
        return api.get(fullPath);
    }

    async function action(label: string, fn: () => Promise<unknown>) {
        setBusy(true);
        try {
            await fn();
            onSuccess(label);
            void refresh();
            onMutated();
        } catch (err) {
            onError(err instanceof Error ? err.message : `${label} failed`);
        } finally {
            setBusy(false);
        }
    }

    function downloadQr() {
        if (!qrCanvasRef.current) return;
        const url = qrCanvasRef.current.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `prediction-qr-${campaignId}.png`;
        a.click();
    }

    if (loading || !detail) {
        return (
            <Modal onClose={onClose}>
                <div style={{ color: "var(--muted-foreground)" }}>Loading…</div>
            </Modal>
        );
    }

    const c = detail.campaign;
    const m = detail.match;
    const publicUrl = venueSlug ? `${typeof window !== "undefined" ? window.location.origin : ""}/predict/${venueSlug}/${m.id}` : "";

    return (
        <Modal onClose={onClose} wide>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                <div>
                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 800, color: statusColor(c.status), letterSpacing: "0.1em" }}>{c.status}</span>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{c.title}</div>
                    <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                        {(m.homeTeamName || "TBD")} vs {(m.awayTeamName || "TBD")} · {new Date(m.matchDateUtc).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6, fontFamily: "var(--font-mono), monospace" }}>
                        {c.totalEntries} entries · {c.correctWinnerCount} correct · {c.exactScoreCount} exact-score
                    </div>
                </div>
                {ipCollisions > 0 && (
                    <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)", color: "#eab308", fontSize: 12, fontWeight: 700 }}>
                        ⚠ {ipCollisions} IP collision{ipCollisions === 1 ? "" : "s"} — likely shared venue WiFi
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {c.status === "DRAFT" && (
                    <button disabled={busy} onClick={() => action("Campaign is now OPEN", () => callDashboard("/publish"))}
                        style={{ padding: "10px 16px", borderRadius: 8, background: "#22c55e", color: "#fff", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
                        Publish (OPEN)
                    </button>
                )}
                {c.status === "OPEN" && (
                    <button disabled={busy} onClick={() => action("Campaign LOCKED", () => callDashboard("/lock"))}
                        style={{ padding: "10px 16px", borderRadius: 8, background: "#eab308", color: "#0a0b0d", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
                        Lock submissions
                    </button>
                )}
                {(c.status === "OPEN" || c.status === "LOCKED") && (
                    <button disabled={busy} onClick={() => action("Campaign settled", () => callDashboard("/settle"))}
                        style={{ padding: "10px 16px", borderRadius: 8, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
                        Settle (after match)
                    </button>
                )}
                {(c.status === "SETTLED" || c.status === "DRAWN") && (
                    <a href={`/api/v1/dashboard/prediction-campaigns/${campaignId}/export.csv?venueId=${encodeURIComponent(selectedVenueId)}`} target="_blank" rel="noreferrer"
                        style={{ padding: "10px 16px", borderRadius: 8, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                        Download CSV
                    </a>
                )}
            </div>

            {/* QR + public URL */}
            {venueSlug && (
                <div style={{ ...cardStyle, flexDirection: "row", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
                    <canvas ref={qrCanvasRef} style={{ background: "#fff", borderRadius: 8 }} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>QR for this campaign</div>
                        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>Print this and put it on tables. Scanning lands at the public form.</div>
                        <code style={{ fontSize: 11, padding: "6px 10px", background: "var(--secondary)", borderRadius: 6, display: "inline-block", wordBreak: "break-all" }}>{publicUrl}</code>
                        <div style={{ marginTop: 10 }}>
                            <button onClick={downloadQr} style={{ padding: "8px 14px", borderRadius: 999, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                                Download PNG
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prize list with draw / redraw */}
            <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Prizes ({detail.prizes.length})</div>
                <div style={{ display: "grid", gap: 10 }}>
                    {detail.prizes.map((p) => (
                        <div key={p.id} style={{ ...cardStyle, flexDirection: "row", alignItems: "center", gap: 14 }}>
                            <div style={{ width: 64, height: 64, borderRadius: 8, background: "var(--secondary)", overflow: "hidden", flexShrink: 0 }}>
                                {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, color: "var(--primary)", fontWeight: 800, letterSpacing: "0.08em" }}>
                                    {p.eligibility.replace("_", " ")} · {p.drawCount} winner{p.drawCount === 1 ? "" : "s"}
                                </div>
                                <div style={{ fontWeight: 800, fontSize: 14 }}>{p.title}</div>
                                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{p.drawnAt ? `Drawn ${new Date(p.drawnAt).toLocaleString()}` : "Not drawn yet"}</div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {!p.drawnAt && c.status === "SETTLED" && (
                                    <button disabled={busy} onClick={() => action(`Drew "${p.title}"`, () => callDashboard(`/prizes/${p.id}/draw`))}
                                        style={{ padding: "8px 14px", borderRadius: 999, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12 }}>
                                        Draw winner
                                    </button>
                                )}
                                {p.drawnAt && (
                                    <button disabled={busy} onClick={() => {
                                        const reason = window.prompt("Reason for redraw (will be audited):");
                                        if (!reason) return;
                                        void action(`Redrew "${p.title}"`, () => callDashboard(`/prizes/${p.id}/redraw`, { method: "POST", jsonBody: { reason, excludeEntryIds: [] } }));
                                    }}
                                        style={{ padding: "8px 14px", borderRadius: 999, background: "rgba(220,38,38,0.12)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                                        Redraw
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Entries table */}
            <div>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Entries ({entries.length})</div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", maxHeight: 360, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead style={{ background: "var(--secondary)", position: "sticky", top: 0 }}>
                            <tr>
                                {["Name", "Phone", "Pick", "Score", "Pts", ""].map((h) => (
                                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 800, color: "var(--muted-foreground)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e) => (
                                <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>{e.displayName}</td>
                                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono), monospace", fontSize: 11 }}>{e.phone}</td>
                                    <td style={{ padding: "10px 12px" }}>{e.predictedWinner}</td>
                                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono), monospace" }}>
                                        {e.predictedHomeScore != null && e.predictedAwayScore != null ? `${e.predictedHomeScore}–${e.predictedAwayScore}` : "—"}
                                    </td>
                                    <td style={{ padding: "10px 12px", fontWeight: 800, color: e.points > 0 ? "var(--primary)" : "var(--muted-foreground)" }}>{e.points}</td>
                                    <td style={{ padding: "10px 12px" }}>
                                        {e.isExactScore && <span style={{ padding: "2px 8px", borderRadius: 999, background: "color-mix(in oklch, var(--primary) 18%, transparent)", color: "var(--primary)", fontSize: 10, fontWeight: 800 }}>Exact</span>}
                                        {!e.isExactScore && e.isCorrectWinner && <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(34,197,94,0.18)", color: "#22c55e", fontSize: 10, fontWeight: 800 }}>Correct</span>}
                                    </td>
                                </tr>
                            ))}
                            {entries.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--muted-foreground)" }}>No entries yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
}

// ─── Modal primitive ───────────────────────────────────────────────

function Modal({ onClose, wide, children }: { onClose: () => void; wide?: boolean; children: React.ReactNode }) {
    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 100,
            display: "grid", placeItems: "center", padding: 20, backdropFilter: "blur(4px)",
            overflowY: "auto",
        }} onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()}
                style={{
                    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
                    padding: 28, maxWidth: wide ? 880 : 620, width: "100%",
                    maxHeight: "calc(100vh - 40px)", overflowY: "auto",
                }}>
                {children}
            </div>
        </div>
    );
}
