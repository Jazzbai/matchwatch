"use client";

import * as React from "react";
import { api } from "../../lib/api";

type SocialTemplate = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    category: string;
    copyTemplate: string;
    placeholders: string[];
    defaultMatchPhase: string | null;
    sortOrder: number;
};

type Props = { selectedVenueId: string };

const CATEGORY_LABEL: Record<string, string> = {
    "pre-tournament": "Pre-tournament",
    "match-day": "Match day",
    "themed": "Themed nights",
    "engagement": "Engagement",
    "finals": "Knockout & finals",
};
const CATEGORY_ORDER = ["pre-tournament", "match-day", "themed", "engagement", "finals"];

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

function renderTemplate(tpl: string, vars: Record<string, string>) {
    return tpl.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, key) => vars[key] || m);
}

function toLocalDatetimeInput(d: Date) {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60_000);
    return local.toISOString().slice(0, 16);
}

export function ContentCalendarTab({ selectedVenueId }: Props) {
    const [templates, setTemplates] = React.useState<SocialTemplate[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<string | null>(null);
    const [filter, setFilter] = React.useState<string>("all");

    const [activeTemplate, setActiveTemplate] = React.useState<SocialTemplate | null>(null);
    const [vars, setVars] = React.useState<Record<string, string>>({});
    const [scheduleAt, setScheduleAt] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const res = await api.get<SocialTemplate[]>("/social-post-templates");
                if (!active) return;
                setTemplates(res.data || []);
            } catch (err) {
                if (!active) return;
                setError(err instanceof Error ? err.message : "Failed to load templates");
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const grouped = React.useMemo(() => {
        const map = new Map<string, SocialTemplate[]>();
        for (const t of templates) {
            if (filter !== "all" && t.category !== filter) continue;
            const arr = map.get(t.category) || [];
            arr.push(t);
            map.set(t.category, arr);
        }
        return CATEGORY_ORDER
            .filter((cat) => map.has(cat))
            .map((cat) => ({ category: cat, items: map.get(cat)! }));
    }, [templates, filter]);

    function openTemplate(t: SocialTemplate) {
        const initial: Record<string, string> = {};
        for (const k of t.placeholders) initial[k] = "";
        setVars(initial);
        setScheduleAt("");
        setCopied(false);
        setActiveTemplate(t);
    }
    function closeModal() {
        setActiveTemplate(null);
        setVars({});
        setScheduleAt("");
        setCopied(false);
    }

    function setVar(key: string, value: string) {
        setVars((prev) => ({ ...prev, [key]: value }));
    }

    const rendered = activeTemplate ? renderTemplate(activeTemplate.copyTemplate, vars) : "";

    async function copyToClipboard() {
        try {
            await navigator.clipboard.writeText(rendered);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError("Couldn't copy — your browser blocked clipboard access.");
        }
    }

    async function savePost(scheduled: boolean) {
        if (!activeTemplate || !selectedVenueId) return;
        if (scheduled && !scheduleAt) {
            setError("Pick a schedule date/time first.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await api.post(
                `/dashboard/posts/from-template?venueId=${encodeURIComponent(selectedVenueId)}`,
                {
                    templateId: activeTemplate.id,
                    variables: vars,
                    autoSave: true,
                    scheduledPublishAt: scheduled ? new Date(scheduleAt).toISOString() : undefined,
                },
            );
            setSuccess(scheduled ? "Post scheduled" : "Post published");
            closeModal();
            setTimeout(() => setSuccess(null), 4000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save post");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div style={{ ...cardStyle, color: "var(--muted-foreground)" }}>Loading content calendar…</div>;
    }

    return (
        <div style={{ display: "grid", gap: 20 }}>
            <div style={{ ...cardStyle, flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Content Calendar</div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
                        {templates.length} pre-built social-media campaigns from the WC Watch Party Package.
                        Fill the placeholders, copy the text, or save as a scheduled post.
                    </div>
                </div>
                <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                    <option value="all">All categories</option>
                    {CATEGORY_ORDER.map((cat) => <option key={cat} value={cat}>{CATEGORY_LABEL[cat]}</option>)}
                </select>
            </div>

            {error && <div style={{ ...cardStyle, color: "#ef4444", borderColor: "rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.08)" }}>{error}</div>}
            {success && <div style={{ ...cardStyle, color: "#22c55e", borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)" }}>{success}</div>}

            {grouped.map(({ category, items }) => (
                <section key={category}>
                    <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, fontWeight: 800, color: "var(--primary)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
                        {CATEGORY_LABEL[category] || category} <span style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>· {items.length}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                        {items.map((t) => (
                            <div key={t.id} style={cardStyle}>
                                <div style={{ fontWeight: 800, fontSize: 14 }}>{t.title}</div>
                                {t.description && <div style={{ color: "var(--muted-foreground)", fontSize: 12, lineHeight: 1.5 }}>{t.description}</div>}
                                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, color: "var(--muted-foreground)", letterSpacing: "0.06em" }}>
                                    Placeholders: {t.placeholders.join(", ") || "(none)"}
                                </div>
                                <button onClick={() => openTemplate(t)} type="button"
                                    style={{
                                        marginTop: "auto", padding: "9px 14px", borderRadius: 999,
                                        background: "var(--primary)", color: "#fff", fontWeight: 800,
                                        border: "none", cursor: "pointer", fontSize: 12.5,
                                    }}>
                                    Use template →
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            {/* Template modal */}
            {activeTemplate && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
                    display: "grid", placeItems: "center", padding: 20, backdropFilter: "blur(4px)",
                    overflowY: "auto",
                }} onClick={closeModal}>
                    <div onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
                            padding: 28, maxWidth: 620, width: "100%", display: "grid", gap: 14, maxHeight: "calc(100vh - 40px)", overflowY: "auto",
                        }}>
                        <div>
                            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 800, color: "var(--primary)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
                                {CATEGORY_LABEL[activeTemplate.category] || activeTemplate.category}
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 18 }}>{activeTemplate.title}</div>
                            {activeTemplate.description && <div style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.55, marginTop: 4 }}>{activeTemplate.description}</div>}
                        </div>

                        {/* Placeholder inputs */}
                        {activeTemplate.placeholders.length > 0 && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                {activeTemplate.placeholders.map((key) => (
                                    <div key={key}>
                                        <label style={labelStyle} htmlFor={`cc-${key}`}>{key}</label>
                                        <input id={`cc-${key}`} style={inputStyle}
                                            value={vars[key] || ""} onChange={(e) => setVar(key, e.target.value)}
                                            placeholder={`{${key}}`} maxLength={500} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Preview */}
                        <div>
                            <label style={labelStyle}>Preview</label>
                            <div style={{
                                padding: 14, borderRadius: 10, border: "1px dashed var(--border)",
                                background: "var(--background)", color: "var(--foreground)",
                                fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap",
                                minHeight: 60,
                            }}>
                                {rendered || <em style={{ color: "var(--muted-foreground)" }}>Fill placeholders to see the rendered post.</em>}
                            </div>
                        </div>

                        {/* Schedule */}
                        <div>
                            <label style={labelStyle} htmlFor="cc-schedule">Schedule (optional)</label>
                            <input id="cc-schedule" type="datetime-local" style={inputStyle}
                                value={scheduleAt}
                                min={toLocalDatetimeInput(new Date())}
                                onChange={(e) => setScheduleAt(e.target.value)} />
                            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                                Leave empty to publish immediately on save.
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                            <button onClick={copyToClipboard} type="button"
                                style={{ padding: "10px 16px", borderRadius: 10, background: copied ? "#22c55e" : "var(--secondary)", color: copied ? "#fff" : "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                                {copied ? "Copied ✓" : "Copy text"}
                            </button>
                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={closeModal} type="button"
                                    style={{ padding: "10px 18px", borderRadius: 10, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                                    Cancel
                                </button>
                                <button onClick={() => savePost(false)} disabled={saving} type="button"
                                    style={{ padding: "10px 18px", borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", cursor: saving ? "wait" : "pointer", fontWeight: 800, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
                                    {saving ? "Saving…" : (scheduleAt ? "Schedule" : "Publish now")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
