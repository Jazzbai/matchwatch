"use client";

import * as React from "react";
import { api } from "../../lib/api";

type WorldCupConfig = {
    enabled?: boolean;
    heroHeadline?: string | null;
    heroSub?: string | null;
    faqs?: Array<{ q: string; a: string }>;
    specials?: Array<{ title: string; desc?: string | null; price?: string | null }>;
    sponsors?: Array<{ name: string; logoUrl?: string | null; tier?: "title" | "gold" | "venue" | "prize" | undefined }>;
};

type Props = {
    selectedVenueId: string;
    venueSlug?: string;
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

const cardStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
};

const subCardStyle: React.CSSProperties = {
    background: "var(--secondary)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: 14,
};

export function WorldCupConfigTab({ selectedVenueId, venueSlug }: Props) {
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<string | null>(null);

    const [enabled, setEnabled] = React.useState(false);
    const [heroHeadline, setHeroHeadline] = React.useState("");
    const [heroSub, setHeroSub] = React.useState("");
    const [faqs, setFaqs] = React.useState<Array<{ q: string; a: string }>>([]);
    const [specials, setSpecials] = React.useState<Array<{ title: string; desc: string; price: string }>>([]);
    const [sponsors, setSponsors] = React.useState<Array<{ name: string; logoUrl: string; tier: string }>>([]);

    React.useEffect(() => {
        if (!selectedVenueId) return;
        let active = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                // Read venue config from the public venue endpoint — it includes
                // the `worldCup` field whenever metadata.worldCup is set.
                const res = await api.get<{ worldCup?: WorldCupConfig | null; slug?: string }>(
                    `/venues/${venueSlug || selectedVenueId}`,
                );
                if (!active) return;
                const cfg = res.data?.worldCup || {};
                setEnabled(Boolean(cfg.enabled));
                setHeroHeadline(cfg.heroHeadline || "");
                setHeroSub(cfg.heroSub || "");
                setFaqs(Array.isArray(cfg.faqs) ? cfg.faqs : []);
                setSpecials(
                    Array.isArray(cfg.specials)
                        ? cfg.specials.map((s) => ({ title: s.title, desc: s.desc || "", price: s.price || "" }))
                        : [],
                );
                setSponsors(
                    Array.isArray(cfg.sponsors)
                        ? cfg.sponsors.map((s) => ({ name: s.name, logoUrl: s.logoUrl || "", tier: s.tier || "" }))
                        : [],
                );
            } catch (err: unknown) {
                if (!active) return;
                setError(err instanceof Error ? err.message : "Failed to load World Cup config");
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [selectedVenueId, venueSlug]);

    async function handleSave() {
        if (!selectedVenueId) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await api.patch<{ message: string }>(
                `/dashboard/world-cup-config?venueId=${encodeURIComponent(selectedVenueId)}`,
                {
                    enabled,
                    heroHeadline: heroHeadline.trim() || null,
                    heroSub: heroSub.trim() || null,
                    faqs: faqs.filter((f) => f.q.trim() && f.a.trim()),
                    specials: specials
                        .filter((s) => s.title.trim())
                        .map((s) => ({
                            title: s.title.trim(),
                            desc: s.desc.trim() || null,
                            price: s.price.trim() || null,
                        })),
                    sponsors: sponsors
                        .filter((s) => s.name.trim())
                        .map((s) => ({
                            name: s.name.trim(),
                            logoUrl: s.logoUrl.trim() || null,
                            tier: s.tier && ["title", "gold", "venue", "prize"].includes(s.tier) ? s.tier : undefined,
                        })),
                },
            );
            setSuccess("Saved — visit /venues/<slug>/world-cup to see changes.");
            setTimeout(() => setSuccess(null), 4000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to save World Cup config");
        } finally {
            setSaving(false);
        }
    }

    function addFaq() { setFaqs((prev) => [...prev, { q: "", a: "" }]); }
    function removeFaq(i: number) { setFaqs((prev) => prev.filter((_, idx) => idx !== i)); }
    function updateFaq(i: number, field: "q" | "a", value: string) {
        setFaqs((prev) => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f));
    }

    function addSpecial() { setSpecials((prev) => [...prev, { title: "", desc: "", price: "" }]); }
    function removeSpecial(i: number) { setSpecials((prev) => prev.filter((_, idx) => idx !== i)); }
    function updateSpecial(i: number, field: "title" | "desc" | "price", value: string) {
        setSpecials((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
    }

    function addSponsor() { setSponsors((prev) => [...prev, { name: "", logoUrl: "", tier: "" }]); }
    function removeSponsor(i: number) { setSponsors((prev) => prev.filter((_, idx) => idx !== i)); }
    function updateSponsor(i: number, field: "name" | "logoUrl" | "tier", value: string) {
        setSponsors((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
    }

    if (loading) {
        return <div style={{ ...cardStyle, color: "var(--muted-foreground)" }}>Loading World Cup config…</div>;
    }

    return (
        <div style={{ display: "grid", gap: 16 }}>
            {/* Header / status */}
            <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>World Cup microsite</div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
                        When enabled, this venue exposes <code style={{ fontFamily: "var(--font-mono), monospace", padding: "2px 6px", background: "var(--secondary)", borderRadius: 4 }}>
                            /venues/{venueSlug || "<slug>"}/world-cup
                        </code>.
                        While disabled, the URL 404s.
                    </div>
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        style={{ width: 20, height: 20, accentColor: "var(--primary)" }}
                    />
                    <span style={{ fontWeight: 700, color: enabled ? "var(--primary)" : "var(--foreground)" }}>
                        {enabled ? "Live" : "Disabled"}
                    </span>
                </label>
            </div>

            {error && <div style={{ ...cardStyle, color: "#ef4444", borderColor: "rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.08)" }}>{error}</div>}
            {success && <div style={{ ...cardStyle, color: "#22c55e", borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)" }}>{success}</div>}

            {/* Hero copy */}
            <div style={cardStyle}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Hero copy</div>
                <div style={{ display: "grid", gap: 14 }}>
                    <div>
                        <label style={labelStyle} htmlFor="wc-headline">Headline (max 160 chars)</label>
                        <input
                            id="wc-headline"
                            style={inputStyle}
                            value={heroHeadline}
                            onChange={(e) => setHeroHeadline(e.target.value)}
                            maxLength={160}
                            placeholder="e.g. Sport PBR — Houston's World Cup HQ"
                        />
                    </div>
                    <div>
                        <label style={labelStyle} htmlFor="wc-sub">Sub copy (max 400 chars)</label>
                        <textarea
                            id="wc-sub"
                            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                            value={heroSub}
                            onChange={(e) => setHeroSub(e.target.value)}
                            maxLength={400}
                            placeholder="Short paragraph under the hero headline. Falls back to a venue-specific default if empty."
                        />
                    </div>
                </div>
            </div>

            {/* Specials */}
            <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>Match-day specials ({specials.length}/20)</div>
                    <button onClick={addSpecial} disabled={specials.length >= 20} type="button"
                        style={{ padding: "6px 12px", borderRadius: 999, background: "var(--primary)", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 12 }}>
                        + Add special
                    </button>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                    {specials.map((s, i) => (
                        <div key={i} style={{ ...subCardStyle, display: "grid", gridTemplateColumns: "2fr 3fr 1fr auto", gap: 10, alignItems: "start" }}>
                            <input style={inputStyle} placeholder="Title" value={s.title} onChange={(e) => updateSpecial(i, "title", e.target.value)} maxLength={120} />
                            <input style={inputStyle} placeholder="Description (optional)" value={s.desc} onChange={(e) => updateSpecial(i, "desc", e.target.value)} maxLength={400} />
                            <input style={inputStyle} placeholder="$15" value={s.price} onChange={(e) => updateSpecial(i, "price", e.target.value)} maxLength={40} />
                            <button onClick={() => removeSpecial(i)} type="button"
                                style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(220,38,38,0.12)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                                ✕
                            </button>
                        </div>
                    ))}
                    {specials.length === 0 && <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>No specials yet.</div>}
                </div>
            </div>

            {/* FAQs */}
            <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>FAQs ({faqs.length}/12)</div>
                    <button onClick={addFaq} disabled={faqs.length >= 12} type="button"
                        style={{ padding: "6px 12px", borderRadius: 999, background: "var(--primary)", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 12 }}>
                        + Add FAQ
                    </button>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                    {faqs.map((f, i) => (
                        <div key={i} style={subCardStyle}>
                            <div style={{ display: "grid", gap: 8 }}>
                                <input style={inputStyle} placeholder="Question" value={f.q} onChange={(e) => updateFaq(i, "q", e.target.value)} maxLength={200} />
                                <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} placeholder="Answer" value={f.a} onChange={(e) => updateFaq(i, "a", e.target.value)} maxLength={2000} />
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                    <button onClick={() => removeFaq(i)} type="button"
                                        style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(220,38,38,0.12)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontWeight: 700, fontSize: 11 }}>
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {faqs.length === 0 && <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>No FAQs yet.</div>}
                </div>
            </div>

            {/* Sponsors */}
            <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>Sponsors ({sponsors.length}/20)</div>
                    <button onClick={addSponsor} disabled={sponsors.length >= 20} type="button"
                        style={{ padding: "6px 12px", borderRadius: 999, background: "var(--primary)", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 12 }}>
                        + Add sponsor
                    </button>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                    {sponsors.map((s, i) => (
                        <div key={i} style={{ ...subCardStyle, display: "grid", gridTemplateColumns: "2fr 3fr 1fr auto", gap: 10, alignItems: "start" }}>
                            <input style={inputStyle} placeholder="Sponsor name" value={s.name} onChange={(e) => updateSponsor(i, "name", e.target.value)} maxLength={120} />
                            <input style={inputStyle} placeholder="Logo URL (optional)" value={s.logoUrl} onChange={(e) => updateSponsor(i, "logoUrl", e.target.value)} maxLength={800} />
                            <select style={inputStyle} value={s.tier} onChange={(e) => updateSponsor(i, "tier", e.target.value)}>
                                <option value="">(no tier)</option>
                                <option value="title">Title</option>
                                <option value="gold">Gold</option>
                                <option value="venue">Venue</option>
                                <option value="prize">Prize donor</option>
                            </select>
                            <button onClick={() => removeSponsor(i)} type="button"
                                style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(220,38,38,0.12)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.3)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                                ✕
                            </button>
                        </div>
                    ))}
                    {sponsors.length === 0 && <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>No sponsors yet.</div>}
                </div>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button onClick={handleSave} disabled={saving || !selectedVenueId} type="button"
                    style={{
                        padding: "14px 28px", borderRadius: 12, background: "var(--primary)", color: "#fff",
                        fontWeight: 800, border: "none", cursor: saving ? "wait" : "pointer", fontSize: 15,
                        opacity: saving || !selectedVenueId ? 0.6 : 1,
                    }}>
                    {saving ? "Saving…" : "Save World Cup config"}
                </button>
                {venueSlug && (
                    <a href={`/venues/${venueSlug}/world-cup`} target="_blank" rel="noreferrer"
                        style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none", fontSize: 13 }}>
                        View live microsite →
                    </a>
                )}
            </div>
        </div>
    );
}
