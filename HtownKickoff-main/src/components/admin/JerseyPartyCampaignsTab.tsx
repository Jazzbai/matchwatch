"use client";

import * as React from "react";
import { api } from "../../lib/api";

type CampaignTemplate = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    defaultPrizes: Array<{ tier: string; prize: string }>;
    defaultTags: string[];
    defaultBookingNotes: string | null;
    defaultContestRules: string | null;
    category: string | null;
    sortOrder: number;
};

type ActivatedEvent = {
    id: string;
    title: string;
    description: string | null;
    startsAt: string;
    endsAt: string;
    campaignTemplateId: string | null;
    prizes?: Array<{ tier: string; prize: string }>;
    contestRules?: string | null;
};

type Props = { selectedVenueId: string };

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
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
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

export function JerseyPartyCampaignsTab({ selectedVenueId }: Props) {
    const [templates, setTemplates] = React.useState<CampaignTemplate[]>([]);
    const [activated, setActivated] = React.useState<ActivatedEvent[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<string | null>(null);

    const [modalTemplate, setModalTemplate] = React.useState<CampaignTemplate | null>(null);
    const [modalStart, setModalStart] = React.useState("");
    const [modalEnd, setModalEnd] = React.useState("");
    const [modalTitle, setModalTitle] = React.useState("");
    const [modalSubmitting, setModalSubmitting] = React.useState(false);

    React.useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const [tplRes, ownRes] = await Promise.allSettled([
                    api.get<CampaignTemplate[]>("/campaign-templates"),
                    selectedVenueId
                        ? api.get<ActivatedEvent[]>(`/dashboard/custom-events?venueId=${encodeURIComponent(selectedVenueId)}`)
                        : Promise.resolve({ data: [] }),
                ]);
                if (!active) return;
                if (tplRes.status === "fulfilled") setTemplates(tplRes.value.data || []);
                if (ownRes.status === "fulfilled") setActivated((ownRes.value.data || []).filter((e) => e.campaignTemplateId));
            } catch (err) {
                if (!active) return;
                setError(err instanceof Error ? err.message : "Failed to load campaigns");
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [selectedVenueId]);

    function openModal(tpl: CampaignTemplate) {
        const startDefault = new Date();
        startDefault.setMinutes(0, 0, 0);
        startDefault.setHours(startDefault.getHours() + 2);
        const endDefault = new Date(startDefault);
        endDefault.setHours(endDefault.getHours() + 4);
        setModalTemplate(tpl);
        setModalTitle(tpl.title);
        setModalStart(toLocalDatetimeInput(startDefault));
        setModalEnd(toLocalDatetimeInput(endDefault));
    }
    function closeModal() {
        setModalTemplate(null);
        setModalStart("");
        setModalEnd("");
        setModalTitle("");
    }

    async function activate() {
        if (!modalTemplate || !selectedVenueId) return;
        const start = new Date(modalStart);
        const end = new Date(modalEnd);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            setError("Pick valid start and end times.");
            return;
        }
        if (end <= start) {
            setError("End time must be after start time.");
            return;
        }
        setModalSubmitting(true);
        setError(null);
        try {
            const res = await api.post<ActivatedEvent>(
                `/dashboard/custom-events/from-template?venueId=${encodeURIComponent(selectedVenueId)}`,
                {
                    templateId: modalTemplate.id,
                    startsAt: start.toISOString(),
                    endsAt: end.toISOString(),
                    overrides: modalTitle.trim() && modalTitle.trim() !== modalTemplate.title
                        ? { title: modalTitle.trim() }
                        : undefined,
                },
            );
            setActivated((prev) => [{ ...res.data, campaignTemplateId: modalTemplate.id }, ...prev]);
            setSuccess(`Activated "${modalTemplate.title}"`);
            closeModal();
            setTimeout(() => setSuccess(null), 4000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to activate campaign");
        } finally {
            setModalSubmitting(false);
        }
    }

    if (loading) {
        return <div style={{ ...cardStyle, color: "var(--muted-foreground)" }}>Loading campaigns…</div>;
    }

    return (
        <div style={{ display: "grid", gap: 20 }}>
            <div style={{ ...cardStyle, flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Jersey Party Campaigns</div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
                        Pre-built themed events from the WC Watch Party Package. One-click activation
                        creates the event on this venue with the template&apos;s prizes and rules pre-filled.
                    </div>
                </div>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--muted-foreground)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {templates.length} templates · {activated.length} activated
                </div>
            </div>

            {error && <div style={{ ...cardStyle, color: "#ef4444", borderColor: "rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.08)" }}>{error}</div>}
            {success && <div style={{ ...cardStyle, color: "#22c55e", borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)" }}>{success}</div>}

            {/* Activated events */}
            {activated.length > 0 && (
                <section>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Activated for this venue</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                        {activated.map((e) => (
                            <div key={e.id} style={{ ...cardStyle, borderColor: "color-mix(in oklch, var(--primary) 35%, var(--border))", background: "color-mix(in oklch, var(--primary) 6%, var(--card))" }}>
                                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 800, color: "var(--primary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                                    {new Date(e.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                    {" – "}
                                    {new Date(e.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                </div>
                                <div style={{ fontWeight: 800, fontSize: 14 }}>{e.title}</div>
                                {e.description && <div style={{ color: "var(--muted-foreground)", fontSize: 12, lineHeight: 1.5 }}>{e.description}</div>}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Templates gallery */}
            <section>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Available templates</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                    {templates.map((t) => (
                        <div key={t.id} style={cardStyle}>
                            {t.category && (
                                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 800, color: "var(--primary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                                    {t.category.replace(/-/g, " ")}
                                </div>
                            )}
                            <div style={{ fontWeight: 800, fontSize: 15 }}>{t.title}</div>
                            {t.description && <div style={{ color: "var(--muted-foreground)", fontSize: 12.5, lineHeight: 1.55 }}>{t.description}</div>}
                            {Array.isArray(t.defaultPrizes) && t.defaultPrizes.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 8, borderTop: "1px dashed var(--border)", fontSize: 12, color: "var(--foreground)" }}>
                                    {t.defaultPrizes.map((p, i) => (
                                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                                            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 800, color: "var(--primary)", letterSpacing: "0.06em", textTransform: "uppercase", minWidth: 80 }}>{p.tier}</span>
                                            <span>{p.prize}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button onClick={() => openModal(t)} type="button"
                                style={{
                                    marginTop: "auto", padding: "10px 16px", borderRadius: 999,
                                    background: "var(--primary)", color: "#fff", fontWeight: 800,
                                    border: "none", cursor: "pointer", fontSize: 13,
                                }}>
                                Activate for this venue →
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Activation modal */}
            {modalTemplate && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
                    display: "grid", placeItems: "center", padding: 20, backdropFilter: "blur(4px)",
                }} onClick={closeModal}>
                    <div onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
                            padding: 28, maxWidth: 520, width: "100%", display: "grid", gap: 14,
                        }}>
                        <div style={{ fontWeight: 800, fontSize: 18 }}>Activate &ldquo;{modalTemplate.title}&rdquo;</div>
                        <div style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.55 }}>
                            Creates a themed event on this venue using the template&apos;s prizes, contest rules,
                            and booking notes. You can edit the title now or update everything later from the
                            Events tab.
                        </div>
                        <div>
                            <label style={labelStyle} htmlFor="jp-title">Event title</label>
                            <input id="jp-title" style={inputStyle} value={modalTitle} onChange={(e) => setModalTitle(e.target.value)} maxLength={160} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                                <label style={labelStyle} htmlFor="jp-start">Starts at</label>
                                <input id="jp-start" type="datetime-local" style={inputStyle} value={modalStart} onChange={(e) => setModalStart(e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle} htmlFor="jp-end">Ends at</label>
                                <input id="jp-end" type="datetime-local" style={inputStyle} value={modalEnd} onChange={(e) => setModalEnd(e.target.value)} />
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                            <button onClick={closeModal} type="button"
                                style={{ padding: "10px 18px", borderRadius: 10, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                                Cancel
                            </button>
                            <button onClick={activate} disabled={modalSubmitting} type="button"
                                style={{ padding: "10px 22px", borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", cursor: modalSubmitting ? "wait" : "pointer", fontWeight: 800, fontSize: 13, opacity: modalSubmitting ? 0.6 : 1 }}>
                                {modalSubmitting ? "Activating…" : "Activate"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
