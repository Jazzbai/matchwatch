"use client";

/**
 * Super-admin (/jazzbai) cross-venue prediction-campaign control.
 *
 * Distinct from VenuePredictionsTab (which is the venue-owner /admin tab,
 * scoped to a single venue). This one talks to /api/v1/super-admin/* using
 * raw fetch + credentials: 'include' because super-admin auth is
 * cookie-based, not bearer-token-based.
 */

import * as React from "react";

const ELIGIBILITY = ["CORRECT_WINNER", "EXACT_SCORE", "ANY_ENTRY"] as const;
type Eligibility = typeof ELIGIBILITY[number];
type Status = "DRAFT" | "OPEN" | "LOCKED" | "SETTLED" | "DRAWN";

type Venue = { id: string; name: string; slug: string; city: string | null };
type Match = {
    id: string;
    homeTeamName: string | null;
    awayTeamName: string | null;
    matchDateUtc: string;
    status: string;
};
type Campaign = {
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
    strictIpDedup: boolean;
    settledAt: string | null;
    raffleDrawnAt: string | null;
    createdAt: string;
};
type ListRow = {
    campaign: Campaign;
    venue: Venue;
    match: Match;
    prizeCount: number;
    drawnPrizeCount: number;
};
type Prize = {
    id: string;
    sortOrder: number;
    title: string;
    description: string | null;
    imageUrl: string | null;
    imageS3Key: string | null;
    eligibility: Eligibility;
    drawCount: number;
    drawnAt: string | null;
};
type DetailPayload = {
    campaign: Campaign;
    venue: Venue & { ownerId: string };
    match: Match;
    prizes: Prize[];
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
type AuditEntry = {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
};

const ALL_STATUSES: Status[] = ["DRAFT", "OPEN", "LOCKED", "SETTLED", "DRAWN"];

const cardStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 16,
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

function statusColor(status: Status) {
    if (status === "DRAFT") return "var(--muted-foreground)";
    if (status === "OPEN") return "#22c55e";
    if (status === "LOCKED") return "#eab308";
    if (status === "SETTLED") return "#3b82f6";
    return "var(--primary)";
}

function toLocalDatetimeInput(d: Date) {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60_000);
    return local.toISOString().slice(0, 16);
}

async function saFetch<T>(path: string, init?: RequestInit & { jsonBody?: unknown }): Promise<T> {
    const headers: HeadersInit = { ...(init?.headers || {}) };
    let body = init?.body;
    if (init?.jsonBody !== undefined) {
        body = JSON.stringify(init.jsonBody);
        (headers as Record<string, string>)["Content-Type"] = "application/json";
    }
    const res = await fetch(`/api/v1/super-admin${path}`, {
        ...init,
        headers,
        body,
        credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const errMsg = json?.error?.message || `${res.status} ${res.statusText}`;
        throw new Error(errMsg);
    }
    return json.data as T;
}

export function SuperAdminVenuePredictionsPanel() {
    const [rows, setRows] = React.useState<ListRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<string | null>(null);
    const [filterStatus, setFilterStatus] = React.useState<Status | "ALL">("ALL");
    const [filterVenue, setFilterVenue] = React.useState<string>("");

    const [showCreate, setShowCreate] = React.useState(false);
    const [activeId, setActiveId] = React.useState<string | null>(null);

    const flash = React.useCallback((setter: typeof setError, msg: string) => {
        setter(msg);
        setTimeout(() => setter(null), 5000);
    }, []);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ limit: "100" });
            if (filterStatus !== "ALL") params.set("status", filterStatus);
            if (filterVenue.trim()) params.set("venueId", filterVenue.trim());
            const data = await saFetch<ListRow[]>(`/prediction-campaigns?${params.toString()}`);
            setRows(data || []);
        } catch (err) {
            flash(setError, err instanceof Error ? err.message : "Failed to load campaigns");
        } finally {
            setLoading(false);
        }
    }, [filterStatus, filterVenue, flash]);

    React.useEffect(() => { void load(); }, [load]);

    // Unique venues from the current result set for the filter dropdown.
    const seenVenues = React.useMemo(() => {
        const m = new Map<string, Venue>();
        for (const r of rows) m.set(r.venue.id, r.venue);
        return Array.from(m.values());
    }, [rows]);

    return (
        <div style={{ display: "grid", gap: 16 }}>
            <div style={{ ...cardStyle, flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Venue Predictions (cross-venue)</div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
                        Every prediction campaign across every venue. Create on behalf, edit,
                        settle, draw, redraw, renotify winners, force status, or delete.
                    </div>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    style={{ padding: "10px 18px", borderRadius: 10, background: "var(--primary)", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontSize: 13 }}
                >
                    + New campaign
                </button>
            </div>

            {/* Filters */}
            <div style={{ ...cardStyle, flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 200px" }}>
                    <label style={labelStyle}>Status</label>
                    <select style={inputStyle} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as Status | "ALL")}>
                        <option value="ALL">All statuses</option>
                        {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div style={{ flex: "1 1 240px" }}>
                    <label style={labelStyle}>Venue (visible in current results)</label>
                    <select style={inputStyle} value={filterVenue} onChange={(e) => setFilterVenue(e.target.value)}>
                        <option value="">All venues</option>
                        {seenVenues.map((v) => <option key={v.id} value={v.id}>{v.name}{v.city ? ` — ${v.city}` : ""}</option>)}
                    </select>
                </div>
                <button onClick={() => void load()} style={{ padding: "10px 16px", borderRadius: 10, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                    Refresh
                </button>
            </div>

            {error && <div style={{ ...cardStyle, color: "#ef4444", borderColor: "rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.08)" }}>{error}</div>}
            {success && <div style={{ ...cardStyle, color: "#22c55e", borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)" }}>{success}</div>}

            {loading ? (
                <div style={{ ...cardStyle, color: "var(--muted-foreground)" }}>Loading…</div>
            ) : rows.length === 0 ? (
                <div style={{ ...cardStyle, color: "var(--muted-foreground)", textAlign: "center", padding: 36 }}>
                    No campaigns matching these filters.
                </div>
            ) : (
                <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead style={{ background: "var(--secondary)" }}>
                            <tr>
                                {["Venue", "Match", "Title", "Status", "Entries", "Prizes", "Closes", ""].map((h) => (
                                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontFamily: "var(--font-mono), monospace", fontSize: 10, color: "var(--muted-foreground)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.campaign.id} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ padding: "12px", fontWeight: 700 }}>{r.venue.name}<div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>{r.venue.city || ""}</div></td>
                                    <td style={{ padding: "12px" }}>{(r.match.homeTeamName || "TBD")} vs {(r.match.awayTeamName || "TBD")}<div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{new Date(r.match.matchDateUtc).toLocaleString()}</div></td>
                                    <td style={{ padding: "12px" }}>{r.campaign.title}</td>
                                    <td style={{ padding: "12px" }}>
                                        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 800, color: statusColor(r.campaign.status), letterSpacing: "0.1em" }}>{r.campaign.status}</span>
                                    </td>
                                    <td style={{ padding: "12px", fontFamily: "var(--font-mono), monospace" }}>{r.campaign.totalEntries}</td>
                                    <td style={{ padding: "12px", fontFamily: "var(--font-mono), monospace" }}>{r.drawnPrizeCount}/{r.prizeCount}</td>
                                    <td style={{ padding: "12px", fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--muted-foreground)" }}>{new Date(r.campaign.closesAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                                    <td style={{ padding: "12px", textAlign: "right" }}>
                                        <button onClick={() => setActiveId(r.campaign.id)}
                                            style={{ padding: "6px 14px", borderRadius: 999, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                                            Manage
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showCreate && (
                <CreateCampaignModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        setShowCreate(false);
                        flash(setSuccess, "Campaign created as DRAFT");
                        void load();
                    }}
                />
            )}

            {activeId && (
                <DetailModal
                    campaignId={activeId}
                    onClose={() => setActiveId(null)}
                    onSuccess={(msg) => flash(setSuccess, msg)}
                    onError={(msg) => flash(setError, msg)}
                    onMutated={() => void load()}
                />
            )}
        </div>
    );
}

// ─── Create modal (venue picker first, then the rest) ──────────────

type PrizeInput = {
    title: string;
    description: string;
    imageUrl: string;
    imageS3Key: string;
    eligibility: Eligibility;
    drawCount: number;
};

function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [venues, setVenues] = React.useState<Venue[]>([]);
    const [matches, setMatches] = React.useState<Match[]>([]);
    const [venueId, setVenueId] = React.useState("");
    const [venueSearch, setVenueSearch] = React.useState("");
    const [matchId, setMatchId] = React.useState("");
    const [title, setTitle] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [opensAt, setOpensAt] = React.useState(toLocalDatetimeInput(new Date()));
    const [closesAt, setClosesAt] = React.useState("");
    const [pointsWinner, setPointsWinner] = React.useState("1");
    const [pointsExact, setPointsExact] = React.useState("2");
    const [prizes, setPrizes] = React.useState<PrizeInput[]>([
        { title: "", description: "", imageUrl: "", imageS3Key: "", eligibility: "CORRECT_WINNER", drawCount: 1 },
    ]);
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Debounced venue search — re-queries /super-admin/venues?search=... so the
    // dropdown isn't capped at the first 200 venues.
    React.useEffect(() => {
        const timer = setTimeout(async () => {
            try {
                const q = venueSearch.trim();
                const path = q
                    ? `/venues?page=1&limit=100&search=${encodeURIComponent(q)}`
                    : "/venues?page=1&limit=100";
                const venuesData = await saFetch<{ data?: Array<{ id: string; name: string; slug: string; city: string | null }> } | Venue[]>(path);
                const list = Array.isArray(venuesData) ? venuesData : (venuesData as any)?.data || [];
                setVenues(list);
            } catch {
                // ignore — admin can still type the venueId manually if dropdown empty
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [venueSearch]);

    React.useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/v1/matches/upcoming", { credentials: "include" });
                if (res.ok) {
                    const json = await res.json();
                    const grouped = json?.data || {};
                    const flat: Match[] = Object.values(grouped).flat() as Match[];
                    setMatches(flat);
                }
            } catch { /* ignore */ }
        })();
    }, []);

    React.useEffect(() => {
        const m = matches.find((x) => x.id === matchId);
        if (m && !closesAt) {
            const close = new Date(m.matchDateUtc);
            close.setMinutes(close.getMinutes() - 5);
            setClosesAt(toLocalDatetimeInput(close));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchId, matches]);

    function updatePrize(i: number, patch: Partial<PrizeInput>) {
        setPrizes((prev) => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
    }
    function addPrize() {
        setPrizes((prev) => [...prev, { title: "", description: "", imageUrl: "", imageS3Key: "", eligibility: "CORRECT_WINNER", drawCount: 1 }]);
    }
    function removePrize(i: number) {
        setPrizes((prev) => prev.filter((_, idx) => idx !== i));
    }

    async function uploadImage(file: File, i: number) {
        if (!file.type.startsWith("image/")) { setError("Image files only"); return; }
        if (file.size > 4 * 1024 * 1024) { setError("Max 4 MB"); return; }
        try {
            const presigned = await saFetch<{ uploadUrl: string; publicUrl: string; key: string; uploadHeaders?: Record<string, string> }>("/uploads/presigned-url", {
                method: "POST",
                jsonBody: {
                    filename: file.name,
                    contentType: file.type,
                    purpose: "prediction_prize",
                    fileSize: file.size,
                },
            });
            const put = await fetch(presigned.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type, ...(presigned.uploadHeaders || {}) },
                body: file,
            });
            if (!put.ok) throw new Error("S3 upload failed");
            updatePrize(i, { imageUrl: presigned.publicUrl, imageS3Key: presigned.key });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        }
    }

    async function submit() {
        setError(null);
        if (!venueId) { setError("Pick a venue"); return; }
        if (!matchId) { setError("Pick a match"); return; }
        if (!title.trim()) { setError("Title is required"); return; }
        if (!opensAt || !closesAt) { setError("Pick open/close times"); return; }
        if (prizes.length === 0 || prizes.some((p) => !p.title.trim())) { setError("Every prize needs a title"); return; }

        setSubmitting(true);
        try {
            await saFetch("/prediction-campaigns", {
                method: "POST",
                jsonBody: {
                    venueId,
                    matchId,
                    title: title.trim(),
                    description: description.trim() || undefined,
                    opensAt: new Date(opensAt).toISOString(),
                    closesAt: new Date(closesAt).toISOString(),
                    pointsCorrectWinner: Number(pointsWinner) || 1,
                    pointsExactScore: Number(pointsExact) || 2,
                    prizes: prizes.map((p, idx) => ({
                        title: p.title.trim(),
                        description: p.description.trim() || undefined,
                        imageUrl: p.imageUrl || undefined,
                        imageS3Key: p.imageS3Key || undefined,
                        eligibility: p.eligibility,
                        drawCount: Number(p.drawCount) || 1,
                        sortOrder: idx * 10,
                    })),
                },
            });
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Create failed");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal onClose={onClose}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>New campaign (on behalf of any venue)</div>

            <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
                <div>
                    <label style={labelStyle}>Venue</label>
                    <input
                        style={{ ...inputStyle, marginBottom: 6 }}
                        value={venueSearch}
                        onChange={(e) => setVenueSearch(e.target.value)}
                        placeholder="Search venues by name…"
                    />
                    <select style={inputStyle} value={venueId} onChange={(e) => setVenueId(e.target.value)}>
                        <option value="">Pick a venue…</option>
                        {venues.map((v) => <option key={v.id} value={v.id}>{v.name}{v.city ? ` — ${v.city}` : ""}</option>)}
                    </select>
                </div>
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
                    <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
                </div>
                <div>
                    <label style={labelStyle}>Description (optional)</label>
                    <textarea style={{ ...inputStyle, minHeight: 60 }} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                        <label style={labelStyle}>Opens at</label>
                        <input type="datetime-local" style={inputStyle} value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Closes at</label>
                        <input type="datetime-local" style={inputStyle} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                    </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                        <label style={labelStyle}>Points · winner</label>
                        <input type="number" style={inputStyle} value={pointsWinner} onChange={(e) => setPointsWinner(e.target.value)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Points · exact score</label>
                        <input type="number" style={inputStyle} value={pointsExact} onChange={(e) => setPointsExact(e.target.value)} />
                    </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", padding: 10, borderRadius: 8, background: "var(--secondary)" }}>
                    Dedup: one entry per phone and one per network address per campaign (always on).
                </div>
            </div>

            <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>Prizes ({prizes.length})</div>
                    <button onClick={addPrize} disabled={prizes.length >= 20} type="button"
                        style={{ padding: "6px 12px", borderRadius: 999, background: "var(--primary)", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 12 }}>
                        + Add prize
                    </button>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                    {prizes.map((p, i) => (
                        <div key={i} style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: 10, alignItems: "start" }}>
                                <label style={{ aspectRatio: "1/1", borderRadius: 8, background: "var(--card)", border: "1px solid var(--border)", display: "grid", placeItems: "center", cursor: "pointer", overflow: "hidden" }}>
                                    {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Upload</span>}
                                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], i)} />
                                </label>
                                <div style={{ display: "grid", gap: 6 }}>
                                    <input style={inputStyle} value={p.title} onChange={(e) => updatePrize(i, { title: e.target.value })} placeholder="Prize title" maxLength={200} />
                                    <input style={inputStyle} value={p.description} onChange={(e) => updatePrize(i, { description: e.target.value })} placeholder="Description" maxLength={400} />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 6 }}>
                                        <select style={inputStyle} value={p.eligibility} onChange={(e) => updatePrize(i, { eligibility: e.target.value as Eligibility })}>
                                            <option value="CORRECT_WINNER">Correct winner</option>
                                            <option value="EXACT_SCORE">Exact score</option>
                                            <option value="ANY_ENTRY">Any entry</option>
                                        </select>
                                        <input type="number" min={1} style={inputStyle} value={p.drawCount} onChange={(e) => updatePrize(i, { drawCount: Number(e.target.value) })} />
                                    </div>
                                </div>
                                <button disabled={prizes.length === 1} onClick={() => removePrize(i)} type="button"
                                    style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(220,38,38,0.12)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontSize: 12 }}>
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
                <button onClick={submit} disabled={submitting} style={{ padding: "10px 20px", borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", cursor: submitting ? "wait" : "pointer", fontWeight: 800, fontSize: 13, opacity: submitting ? 0.6 : 1 }}>
                    {submitting ? "Creating…" : "Create as DRAFT"}
                </button>
            </div>
        </Modal>
    );
}

// ─── Detail modal ──────────────────────────────────────────────────

function DetailModal({
    campaignId,
    onClose,
    onSuccess,
    onError,
    onMutated,
}: {
    campaignId: string;
    onClose: () => void;
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
    onMutated: () => void;
}) {
    const [detail, setDetail] = React.useState<DetailPayload | null>(null);
    const [entries, setEntries] = React.useState<Entry[]>([]);
    const [ipCollisions, setIpCollisions] = React.useState(0);
    const [auditEntries, setAuditEntries] = React.useState<AuditEntry[]>([]);
    const [showAudit, setShowAudit] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [showEdit, setShowEdit] = React.useState(false);
    const [editPrizeId, setEditPrizeId] = React.useState<string | null>(null);
    const [showAddPrize, setShowAddPrize] = React.useState(false);
    const qrCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

    const refresh = React.useCallback(async () => {
        try {
            const [d, e] = await Promise.allSettled([
                saFetch<DetailPayload>(`/prediction-campaigns/${campaignId}`),
                saFetch<{ entries: Entry[]; ipCollisionCount: number }>(`/prediction-campaigns/${campaignId}/entries?limit=100`),
            ]);
            if (d.status === "fulfilled") setDetail(d.value);
            if (e.status === "fulfilled") {
                setEntries(e.value.entries || []);
                setIpCollisions(e.value.ipCollisionCount || 0);
            }
        } catch (err) {
            onError(err instanceof Error ? err.message : "Refresh failed");
        }
    }, [campaignId, onError]);

    const loadAudit = React.useCallback(async () => {
        try {
            const a = await saFetch<AuditEntry[]>(`/prediction-campaigns/${campaignId}/audit-log`);
            setAuditEntries(a || []);
        } catch (err) {
            onError(err instanceof Error ? err.message : "Audit load failed");
        }
    }, [campaignId, onError]);

    React.useEffect(() => { void refresh(); }, [refresh]);

    // Render the QR for the campaign's public landing once detail is loaded.
    // Same pattern as the venue-owner side: client-side toCanvas via dynamic
    // import so the qrcode dep doesn't bloat the bundle.
    React.useEffect(() => {
        if (!detail || !qrCanvasRef.current) return;
        void (async () => {
            const { default: QRCode } = await import("qrcode");
            const url = `${window.location.origin}/predict/${detail.venue.slug}/${detail.match.id}`;
            await QRCode.toCanvas(qrCanvasRef.current, url, { width: 220, margin: 1, color: { dark: "#000000", light: "#ffffff" } });
        })();
    }, [detail]);

    function downloadQr() {
        if (!qrCanvasRef.current || !detail) return;
        const a = document.createElement("a");
        a.href = qrCanvasRef.current.toDataURL("image/png");
        a.download = `prediction-qr-${detail.campaign.id}.png`;
        a.click();
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

    function call(path: string, init?: RequestInit & { jsonBody?: unknown }) {
        return saFetch(`/prediction-campaigns/${campaignId}${path}`, init);
    }

    if (!detail) {
        return <Modal onClose={onClose}><div style={{ color: "var(--muted-foreground)" }}>Loading…</div></Modal>;
    }

    const c = detail.campaign;
    const m = detail.match;

    return (
        <Modal onClose={onClose} wide>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div>
                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 800, color: statusColor(c.status), letterSpacing: "0.1em" }}>{c.status}</span>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{c.title}</div>
                    <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                        <strong>{detail.venue.name}</strong> · {(m.homeTeamName || "TBD")} vs {(m.awayTeamName || "TBD")} · {new Date(m.matchDateUtc).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6, fontFamily: "var(--font-mono), monospace" }}>
                        {c.totalEntries} entries · {c.correctWinnerCount} correct · {c.exactScoreCount} exact-score · IP collisions: {ipCollisions}
                    </div>
                </div>
            </div>

            {/* Status / lifecycle actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {c.status === "DRAFT" && (
                    <button disabled={busy} onClick={() => action("Published", () => call("/publish", { method: "POST" }))}
                        style={{ padding: "9px 14px", borderRadius: 8, background: "#22c55e", color: "#fff", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12 }}>
                        Publish
                    </button>
                )}
                {c.status === "OPEN" && (
                    <button disabled={busy} onClick={() => action("Locked", () => call("/lock", { method: "POST" }))}
                        style={{ padding: "9px 14px", borderRadius: 8, background: "#eab308", color: "#0a0b0d", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12 }}>
                        Lock
                    </button>
                )}
                {c.status === "LOCKED" && (
                    <button disabled={busy} onClick={() => {
                        const ts = window.prompt("New closesAt (ISO 8601 or yyyy-mm-ddThh:mm)");
                        if (!ts) return;
                        void action("Unlocked", () => call("/unlock", { method: "POST", jsonBody: { closesAt: new Date(ts).toISOString() } }));
                    }} style={{ padding: "9px 14px", borderRadius: 8, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                        Unlock + extend
                    </button>
                )}
                {(c.status === "OPEN" || c.status === "LOCKED") && (
                    <button disabled={busy} onClick={() => action("Settled", () => call("/settle", { method: "POST" }))}
                        style={{ padding: "9px 14px", borderRadius: 8, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12 }}>
                        Settle
                    </button>
                )}
                {(c.status === "SETTLED" || c.status === "DRAWN") && (
                    <button disabled={busy} onClick={() => {
                        if (!window.confirm("Unsettle will invalidate all winners + reset entries. Continue?")) return;
                        void action("Unsettled", () => call("/unsettle", { method: "POST" }));
                    }} style={{ padding: "9px 14px", borderRadius: 8, background: "rgba(220,38,38,0.12)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                        Unsettle
                    </button>
                )}
                <button disabled={busy} onClick={() => {
                    const status = window.prompt("Force status to (DRAFT|OPEN|LOCKED|SETTLED|DRAWN):");
                    if (!status) return;
                    const reason = window.prompt("Reason (audited):");
                    if (!reason) return;
                    void action(`Forced to ${status}`, () => call("/force-status", { method: "POST", jsonBody: { status: status.toUpperCase(), reason } }));
                }} style={{ padding: "9px 14px", borderRadius: 8, background: "rgba(234,179,8,0.12)", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                    Force status…
                </button>
                <button onClick={() => { setShowAudit((s) => !s); if (!showAudit) void loadAudit(); }}
                    style={{ padding: "9px 14px", borderRadius: 8, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                    {showAudit ? "Hide audit log" : "Audit log"}
                </button>
                <a href={`/api/v1/super-admin/prediction-campaigns/${campaignId}/export.csv`} target="_blank" rel="noreferrer"
                    style={{ padding: "9px 14px", borderRadius: 8, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 12, textDecoration: "none" }}>
                    CSV
                </a>
                <button disabled={busy} onClick={() => {
                    if (!window.confirm(`Delete this campaign (${c.totalEntries} entries) PERMANENTLY?`)) return;
                    void action("Deleted", async () => {
                        await call("", { method: "DELETE" });
                        onClose();
                    });
                }} style={{ marginLeft: "auto", padding: "9px 14px", borderRadius: 8, background: "rgba(220,38,38,0.12)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontWeight: 800, fontSize: 12 }}>
                    Delete
                </button>
            </div>

            {/* QR + public landing URL */}
            <div style={{ ...cardStyle, flexDirection: "row", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                <canvas ref={qrCanvasRef} style={{ background: "#fff", borderRadius: 8 }} />
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Public landing QR</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>Print this for the venue or share the URL.</div>
                    <code style={{ fontSize: 11, padding: "5px 9px", background: "var(--secondary)", borderRadius: 6, display: "inline-block", wordBreak: "break-all" }}>
                        {typeof window !== "undefined" ? `${window.location.origin}/predict/${detail.venue.slug}/${detail.match.id}` : ""}
                    </code>
                    <div style={{ marginTop: 10 }}>
                        <button onClick={downloadQr} style={{ padding: "7px 14px", borderRadius: 999, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                            Download PNG
                        </button>
                    </div>
                </div>
                <button onClick={() => setShowEdit(true)} style={{ padding: "9px 14px", borderRadius: 8, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                    Edit details
                </button>
            </div>

            {/* Prizes */}
            <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>Prizes ({detail.prizes.length})</div>
                    {c.status !== "DRAWN" && (
                        <button onClick={() => setShowAddPrize(true)}
                            style={{ padding: "6px 12px", borderRadius: 999, background: "var(--primary)", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 12 }}>
                            + Add prize
                        </button>
                    )}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                    {detail.prizes.map((p) => (
                        <div key={p.id} style={{ ...cardStyle, flexDirection: "row", gap: 12, alignItems: "center" }}>
                            <div style={{ width: 56, height: 56, borderRadius: 8, background: "var(--secondary)", overflow: "hidden", flexShrink: 0 }}>
                                {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, color: "var(--primary)", fontWeight: 800, letterSpacing: "0.08em" }}>
                                    {p.eligibility.replace("_", " ")} · {p.drawCount}x
                                </div>
                                <div style={{ fontWeight: 800, fontSize: 14 }}>{p.title}</div>
                                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{p.drawnAt ? `Drawn ${new Date(p.drawnAt).toLocaleString()}` : "Not drawn"}</div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {!p.drawnAt && (c.status === "SETTLED" || c.status === "DRAWN") && (
                                    <button disabled={busy} onClick={() => action(`Drew ${p.title}`, () => call(`/prizes/${p.id}/draw`, { method: "POST" }))}
                                        style={{ padding: "5px 12px", borderRadius: 999, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11 }}>Draw</button>
                                )}
                                {p.drawnAt && (
                                    <>
                                        <button disabled={busy} onClick={() => {
                                            const reason = window.prompt("Redraw reason (audited):");
                                            if (!reason) return;
                                            void action("Redrawn", () => call(`/prizes/${p.id}/redraw`, { method: "POST", jsonBody: { reason, excludeEntryIds: [] } }));
                                        }} style={{ padding: "5px 12px", borderRadius: 999, background: "rgba(220,38,38,0.12)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontWeight: 700, fontSize: 11 }}>Redraw</button>
                                        <button disabled={busy} onClick={() => action("Re-notified", () => call(`/prizes/${p.id}/renotify`, { method: "POST" }))}
                                            style={{ padding: "5px 12px", borderRadius: 999, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 11 }}>Renotify</button>
                                    </>
                                )}
                                {!p.drawnAt && (
                                    <>
                                        <button disabled={busy} onClick={() => setEditPrizeId(p.id)}
                                            style={{ padding: "5px 12px", borderRadius: 999, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 11 }}>Edit</button>
                                        <button disabled={busy} onClick={() => {
                                            if (!window.confirm(`Delete prize "${p.title}"?`)) return;
                                            void action("Prize deleted", () => call(`/prizes/${p.id}`, { method: "DELETE" }));
                                        }} style={{ padding: "5px 12px", borderRadius: 999, background: "rgba(220,38,38,0.12)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontWeight: 700, fontSize: 11 }}>Delete</button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit campaign / Add prize / Edit prize nested modals */}
            {showEdit && (
                <EditCampaignNestedModal
                    campaign={detail.campaign}
                    onClose={() => setShowEdit(false)}
                    onSave={(patch) => action("Campaign updated", async () => {
                        await call("", { method: "PATCH", jsonBody: patch });
                        setShowEdit(false);
                    })}
                />
            )}
            {showAddPrize && (
                <PrizeNestedModal
                    modalTitle="Add prize"
                    onClose={() => setShowAddPrize(false)}
                    onSave={(payload) => action("Prize added", async () => {
                        await call("/prizes", { method: "POST", jsonBody: payload });
                        setShowAddPrize(false);
                    })}
                />
            )}
            {editPrizeId && (() => {
                const prize = detail.prizes.find((p) => p.id === editPrizeId);
                if (!prize) return null;
                return (
                    <PrizeNestedModal
                        modalTitle="Edit prize"
                        initial={prize}
                        onClose={() => setEditPrizeId(null)}
                        onSave={(payload) => action("Prize updated", async () => {
                            await call(`/prizes/${editPrizeId}`, { method: "PATCH", jsonBody: payload });
                            setEditPrizeId(null);
                        })}
                    />
                );
            })()}

            {/* Entries */}
            <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Entries ({entries.length})</div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead style={{ background: "var(--secondary)", position: "sticky", top: 0 }}>
                            <tr>{["Name", "Phone", "Pick", "Score", "Pts", ""].map((h) =>
                                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontFamily: "var(--font-mono), monospace", fontSize: 9, color: "var(--muted-foreground)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e) => (
                                <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ padding: "8px 10px", fontWeight: 700 }}>{e.displayName}</td>
                                    <td style={{ padding: "8px 10px", fontFamily: "var(--font-mono), monospace", fontSize: 11 }}>{e.phone}</td>
                                    <td style={{ padding: "8px 10px" }}>{e.predictedWinner}</td>
                                    <td style={{ padding: "8px 10px", fontFamily: "var(--font-mono), monospace" }}>
                                        {e.predictedHomeScore != null && e.predictedAwayScore != null ? `${e.predictedHomeScore}–${e.predictedAwayScore}` : "—"}
                                    </td>
                                    <td style={{ padding: "8px 10px", fontWeight: 800, color: e.points > 0 ? "var(--primary)" : "var(--muted-foreground)" }}>{e.points}</td>
                                    <td style={{ padding: "8px 10px" }}>
                                        {e.isExactScore && <span style={{ padding: "2px 6px", borderRadius: 999, background: "color-mix(in oklch, var(--primary) 18%, transparent)", color: "var(--primary)", fontSize: 10, fontWeight: 800 }}>Exact</span>}
                                        {!e.isExactScore && e.isCorrectWinner && <span style={{ padding: "2px 6px", borderRadius: 999, background: "rgba(34,197,94,0.18)", color: "#22c55e", fontSize: 10, fontWeight: 800 }}>Correct</span>}
                                    </td>
                                </tr>
                            ))}
                            {entries.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--muted-foreground)" }}>No entries.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Audit log (lazy) */}
            {showAudit && (
                <div>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Audit log ({auditEntries.length})</div>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", maxHeight: 240, overflowY: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead style={{ background: "var(--secondary)" }}>
                                <tr>{["When", "Action", "Actor", "Metadata"].map((h) =>
                                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontFamily: "var(--font-mono), monospace", fontSize: 9, color: "var(--muted-foreground)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {auditEntries.map((a) => {
                                    const meta = a.metadata || {};
                                    const actor = (meta as any).actorUsername ? `super:${(meta as any).actorUsername}` : (a.entityType === "PredictionCampaign" || a.entityType === "PredictionPrize" ? "venue-owner" : "system");
                                    return (
                                        <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                                            <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono), monospace" }}>{new Date(a.createdAt).toLocaleString()}</td>
                                            <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono), monospace", fontWeight: 700 }}>{a.action}</td>
                                            <td style={{ padding: "6px 10px" }}>{actor}</td>
                                            <td style={{ padding: "6px 10px", color: "var(--muted-foreground)", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{JSON.stringify(meta)}</td>
                                        </tr>
                                    );
                                })}
                                {auditEntries.length === 0 && <tr><td colSpan={4} style={{ padding: 14, textAlign: "center", color: "var(--muted-foreground)" }}>No entries.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Modal>
    );
}

// ─── Edit campaign nested modal ────────────────────────────────────

function EditCampaignNestedModal({
    campaign,
    onClose,
    onSave,
}: {
    campaign: Campaign;
    onClose: () => void;
    onSave: (patch: Record<string, unknown>) => void;
}) {
    const [title, setTitle] = React.useState(campaign.title);
    const [description, setDescription] = React.useState(campaign.description || "");
    const [opensAt, setOpensAt] = React.useState(toLocalDatetimeInput(new Date(campaign.opensAt)));
    const [closesAt, setClosesAt] = React.useState(toLocalDatetimeInput(new Date(campaign.closesAt)));
    const [pointsWinner, setPointsWinner] = React.useState(String(campaign.pointsCorrectWinner));
    const [pointsExact, setPointsExact] = React.useState(String(campaign.pointsExactScore));

    function submit() {
        onSave({
            title: title.trim() || undefined,
            description: description.trim() || null,
            opensAt: new Date(opensAt).toISOString(),
            closesAt: new Date(closesAt).toISOString(),
            pointsCorrectWinner: Number(pointsWinner) || campaign.pointsCorrectWinner,
            pointsExactScore: Number(pointsExact) || campaign.pointsExactScore,
        });
    }

    return (
        <Modal onClose={onClose}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Edit campaign</div>
            <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
                <div>
                    <label style={labelStyle}>Title</label>
                    <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
                </div>
                <div>
                    <label style={labelStyle}>Description</label>
                    <textarea style={{ ...inputStyle, minHeight: 60 }} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                        <label style={labelStyle}>Opens at</label>
                        <input type="datetime-local" style={inputStyle} value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Closes at</label>
                        <input type="datetime-local" style={inputStyle} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                    </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                        <label style={labelStyle}>Points · winner</label>
                        <input type="number" style={inputStyle} value={pointsWinner} onChange={(e) => setPointsWinner(e.target.value)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Points · exact score</label>
                        <input type="number" style={inputStyle} value={pointsExact} onChange={(e) => setPointsExact(e.target.value)} />
                    </div>
                </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>
                <button onClick={submit} style={{ padding: "10px 22px", borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>Save</button>
            </div>
        </Modal>
    );
}

// ─── Prize add/edit nested modal ───────────────────────────────────

function PrizeNestedModal({
    modalTitle,
    initial,
    onClose,
    onSave,
}: {
    modalTitle?: string;
    initial?: Prize;
    onClose: () => void;
    onSave: (payload: Record<string, unknown>) => void;
}) {
    const [title, setTitle] = React.useState(initial?.title || "");
    const [description, setDescription] = React.useState(initial?.description || "");
    const [imageUrl, setImageUrl] = React.useState(initial?.imageUrl || "");
    const [imageS3Key, setImageS3Key] = React.useState(initial?.imageS3Key || "");
    const [eligibility, setEligibility] = React.useState<Eligibility>(initial?.eligibility || "CORRECT_WINNER");
    const [drawCount, setDrawCount] = React.useState(String(initial?.drawCount || 1));
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function uploadImage(file: File) {
        if (!file.type.startsWith("image/")) { setError("Image files only"); return; }
        if (file.size > 4 * 1024 * 1024) { setError("Max 4 MB"); return; }
        setUploading(true);
        setError(null);
        try {
            const presigned = await saFetch<{ uploadUrl: string; publicUrl: string; key: string; uploadHeaders?: Record<string, string> }>("/uploads/presigned-url", {
                method: "POST",
                jsonBody: { filename: file.name, contentType: file.type, purpose: "prediction_prize", fileSize: file.size },
            });
            const put = await fetch(presigned.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type, ...(presigned.uploadHeaders || {}) },
                body: file,
            });
            if (!put.ok) throw new Error("S3 upload failed");
            setImageUrl(presigned.publicUrl);
            setImageS3Key(presigned.key);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    }

    function submit() {
        setError(null);
        if (!title.trim()) { setError("Title is required"); return; }
        onSave({
            title: title.trim(),
            description: description.trim() || undefined,
            imageUrl: imageUrl || undefined,
            imageS3Key: imageS3Key || undefined,
            eligibility,
            drawCount: Number(drawCount) || 1,
        });
    }

    return (
        <Modal onClose={onClose}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>{modalTitle || (initial ? "Edit prize" : "Add prize")}</div>
            <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
                    <label style={{ aspectRatio: "1/1", borderRadius: 8, background: "var(--secondary)", border: "1px solid var(--border)", display: "grid", placeItems: "center", cursor: "pointer", overflow: "hidden" }}>
                        {imageUrl
                            ? <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{uploading ? "Uploading…" : "Upload"}</span>}
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                    </label>
                    <div style={{ display: "grid", gap: 8 }}>
                        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Prize title" maxLength={200} />
                        <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" maxLength={400} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8 }}>
                            <select style={inputStyle} value={eligibility} onChange={(e) => setEligibility(e.target.value as Eligibility)}>
                                <option value="CORRECT_WINNER">Correct winner</option>
                                <option value="EXACT_SCORE">Exact score</option>
                                <option value="ANY_ENTRY">Any entry</option>
                            </select>
                            <input type="number" min={1} style={inputStyle} value={drawCount} onChange={(e) => setDrawCount(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>
            {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>
                <button onClick={submit} style={{ padding: "10px 22px", borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>Save</button>
            </div>
        </Modal>
    );
}

function Modal({ onClose, wide, children }: { onClose: () => void; wide?: boolean; children: React.ReactNode }) {
    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200,
            display: "grid", placeItems: "center", padding: 20, backdropFilter: "blur(4px)",
            overflowY: "auto",
        }} onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()}
                style={{
                    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
                    padding: 24, maxWidth: wide ? 980 : 640, width: "100%",
                    maxHeight: "calc(100vh - 40px)", overflowY: "auto",
                }}>
                {children}
            </div>
        </div>
    );
}
