"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
    company: string;
    contactName: string;
    email: string;
    phone: string;
    website: string;
    tier: string;
    message: string;
};

const TIERS = [
    {
        id: "title",
        name: "Title Sponsor",
        price: "$5,000 / tournament",
        color: "#f59e0b",
        perks: [
            "Logo top of Match Point hero",
            "Full sponsor page feature",
            "Logo on every QR banner in all venues",
            "Social media shoutout (10k+ fans)",
            "Venue notification blast to all followers",
            "Prize branding (winner drinks on you)",
        ],
    },
    {
        id: "gold",
        name: "Gold Sponsor",
        price: "$2,000 / tournament",
        color: "#22c55e",
        perks: [
            "Logo in sponsors bar",
            "Logo on QR banners",
            "Social shoutout",
            "Leaderboard badge",
        ],
    },
    {
        id: "venue",
        name: "Venue Partner",
        price: "$500 / month",
        color: "#3b82f6",
        perks: [
            "Featured venue badge",
            "Priority in venue selector",
            "Custom prize for venue leaderboard",
            "QR banner with your branding",
        ],
    },
    {
        id: "prize",
        name: "Prize Donor",
        price: "In-kind",
        color: "#8b5cf6",
        perks: [
            "Logo on prize section",
            "Winner announcement post",
            "In-app notification to all fans",
        ],
    },
];

export default function SponsorPage() {
    const router = useRouter();
    const [form, setForm] = useState<FormState>({
        company: "", contactName: "", email: "", phone: "",
        website: "", tier: "", message: "",
    });
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function update(field: keyof FormState, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.company || !form.email || !form.tier) {
            setError("Please fill in company name, email, and select a tier.");
            return;
        }
        setError(null);
        setSubmitting(true);

        // Send to backend API or fallback to mailto
        try {
            const res = await fetch("/api/v1/sponsor-inquiry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                setSubmitted(true);
                return;
            }
        } catch {
            // fallback — open mailto
        }

        // Fallback: open mailto with form data
        const subject = encodeURIComponent(`Sponsor Inquiry — ${form.company} (${form.tier})`);
        const body = encodeURIComponent(
            `Company: ${form.company}\nContact: ${form.contactName}\nEmail: ${form.email}\nPhone: ${form.phone}\nWebsite: ${form.website}\nTier: ${form.tier}\n\nMessage:\n${form.message}`,
        );
        window.location.href = `mailto:sponsors@matchwatch.us?subject=${subject}&body=${body}`;
        setSubmitted(true);
        setSubmitting(false);
    }

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--background)", color: "var(--foreground)" }}>

            {/* Hero */}
            <div style={{
                background: "linear-gradient(135deg, #0a0a0b 0%, #1a1a2e 60%, #0a0a0b 100%)",
                borderBottom: "1px solid var(--border)",
                padding: "64px 24px 52px",
                textAlign: "center",
                position: "relative", overflow: "hidden",
            }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 50% 0%, rgba(245,158,11,0.1) 0%, transparent 60%)", pointerEvents: "none" }} />
                <button onClick={() => router.push("/match-point")} style={{ position: "relative", background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 13, fontWeight: 700, marginBottom: 20 }}>
                    ← Back to Match Point
                </button>
                <div style={{ position: "relative" }}>
                    <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 99, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#f59e0b", textTransform: "uppercase", marginBottom: 16 }}>
                        MatchWatch · Match Point 2026
                    </div>
                    <h1 style={{ fontSize: "clamp(32px,6vw,56px)", fontWeight: 900, lineHeight: 1.05, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
                        Reach <span style={{ color: "#f59e0b" }}>10,000+</span> Fans<br />at Every Match
                    </h1>
                    <p style={{ fontSize: "clamp(15px,2vw,18px)", color: "var(--muted-foreground)", maxWidth: 540, margin: "0 auto", lineHeight: 1.6 }}>
                        Sponsor the Match Point prediction game and put your brand in front of engaged football fans across Houston's top watch party venues during the 2026 World Cup.
                    </p>

                    {/* Stats row */}
                    <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginTop: 36 }}>
                        {[
                            ["74+", "Partner Venues"],
                            ["10K+", "Registered Fans"],
                            ["500+", "QR Scans / Match"],
                            ["64", "World Cup Matches"],
                        ].map(([num, label]) => (
                            <div key={label} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 28, fontWeight: 900, color: "#f59e0b" }}>{num}</div>
                                <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 700 }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "52px 20px" }}>

                {/* Tier cards */}
                <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8, textAlign: "center" }}>Choose Your Sponsorship Tier</h2>
                <p style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 14, marginBottom: 36 }}>Select a tier below — it will pre-fill the form.</p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 52 }}>
                    {TIERS.map((tier) => {
                        const selected = form.tier === tier.id;
                        return (
                            <button
                                key={tier.id}
                                onClick={() => update("tier", tier.id)}
                                style={{
                                    textAlign: "left", padding: "22px 20px", borderRadius: 20,
                                    border: selected ? `2px solid ${tier.color}` : "1px solid var(--border)",
                                    background: selected ? `color-mix(in oklch, ${tier.color} 10%, var(--card))` : "var(--card)",
                                    cursor: "pointer", transition: "all 0.15s",
                                    boxShadow: selected ? `0 0 0 4px color-mix(in oklch, ${tier.color} 15%, transparent)` : "none",
                                }}
                            >
                                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: tier.color, marginBottom: 6 }}>
                                    {tier.name}
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 14 }}>{tier.price}</div>
                                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                                    {tier.perks.map((perk) => (
                                        <li key={perk} style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "flex-start", gap: 6 }}>
                                            <span style={{ color: tier.color, flexShrink: 0, marginTop: 1 }}>✓</span>
                                            {perk}
                                        </li>
                                    ))}
                                </ul>
                            </button>
                        );
                    })}
                </div>

                {/* Form */}
                {submitted ? (
                    <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: "48px 36px" }}>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
                        <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 12 }}>Thank you, {form.company}!</h2>
                        <p style={{ color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: 28 }}>
                            We've received your sponsorship inquiry. Our team will reach out to <strong style={{ color: "var(--foreground)" }}>{form.email}</strong> within 24 hours.
                        </p>
                        <button onClick={() => router.push("/match-point")} style={{ padding: "14px 32px", borderRadius: 12, background: "#22c55e", color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer" }}>
                            Back to Match Point →
                        </button>
                    </div>
                ) : (
                    <div style={{ maxWidth: 640, margin: "0 auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: "40px 36px" }}>
                        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Sponsor Application</h2>
                        <p style={{ color: "var(--muted-foreground)", fontSize: 14, marginBottom: 28 }}>Fill in your details and we'll get back to you within 24 hours.</p>

                        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <div>
                                    <label style={labelStyle}>Company / Brand *</label>
                                    <input style={inputStyle} value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="e.g. Modelo USA" required />
                                </div>
                                <div>
                                    <label style={labelStyle}>Contact Name</label>
                                    <input style={inputStyle} value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Your full name" />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <div>
                                    <label style={labelStyle}>Email *</label>
                                    <input style={inputStyle} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" required />
                                </div>
                                <div>
                                    <label style={labelStyle}>Phone</label>
                                    <input style={inputStyle} type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 (555) 000-0000" />
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Website</label>
                                <input style={inputStyle} type="url" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://yourcompany.com" />
                            </div>

                            <div>
                                <label style={labelStyle}>Sponsorship Tier *</label>
                                <select style={inputStyle} value={form.tier} onChange={(e) => update("tier", e.target.value)} required>
                                    <option value="">Select a tier…</option>
                                    {TIERS.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name} — {t.price}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={labelStyle}>Message / Goals</label>
                                <textarea
                                    style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                                    value={form.message}
                                    onChange={(e) => update("message", e.target.value)}
                                    placeholder="Tell us about your brand, target audience, or any custom ideas…"
                                />
                            </div>

                            {error && <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>}

                            <button type="submit" disabled={submitting} style={{
                                padding: "16px", borderRadius: 14,
                                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                                color: "#fff", fontSize: 16, fontWeight: 900,
                                border: "none", cursor: "pointer", letterSpacing: "0.01em",
                                boxShadow: "0 4px 20px rgba(245,158,11,0.35)",
                            }}>
                                {submitting ? "Sending…" : "Submit Sponsorship Application →"}
                            </button>

                            <p style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>
                                Or email us directly at{" "}
                                <a href="mailto:sponsors@matchwatch.us" style={{ color: "#f59e0b" }}>sponsors@matchwatch.us</a>
                            </p>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 800,
    color: "var(--muted-foreground)", textTransform: "uppercase",
    letterSpacing: "0.07em", marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
    width: "100%", minHeight: 44, padding: "10px 14px",
    borderRadius: 12, border: "1px solid var(--border)",
    backgroundColor: "var(--secondary)", color: "var(--foreground)",
    fontSize: 14, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
};