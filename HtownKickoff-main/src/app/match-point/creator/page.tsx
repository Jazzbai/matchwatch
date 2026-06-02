"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
    venue: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
    package: string;
    message: string;
};

const PACKAGES = [
    {
        id: "starter",
        name: "Starter Booth",
        price: "$150",
        color: "#3b82f6",
        tagline: "Simple promotional setup.",
        inherits: null,
        perks: [
            "Standard photo-shoot booth setup",
            "MatchWatch banner / signage",
            "Schedule sign for restaurant display",
            "Website theme alignment for MatchPoint listing",
            "Basic venue / event visibility on MatchWatch",
        ],
        bestFor: "Restaurants starting watch-party promotion.",
    },
    {
        id: "reservation",
        name: "Reservation + Social Boost",
        price: "$2,000",
        color: "#22c55e",
        featured: true,
        tagline: "Bookings + social media promotion.",
        inherits: "Everything in Starter Booth, plus:",
        perks: [
            "Reservation plugin setup",
            "Watch-party booking section",
            "6 promotional reels",
            "16 story posts",
            "MatchPoint landing page connection",
            "Event schedule promotion on MatchWatch",
        ],
        bestFor: "Restaurants that want reservations and social traffic.",
    },
    {
        id: "premium",
        name: "Premium Venue Story",
        price: "$3,000",
        color: "#f59e0b",
        tagline: "Professional video + stronger branding.",
        inherits: "Everything in Reservation + Social Boost, plus:",
        perks: [
            "On-site venue video recording",
            "Interview with venue owner / manager",
            "Stadium-style watch-party video concept",
            "Venue atmosphere shots",
            "Premium content for MatchWatch, Instagram & website",
        ],
        bestFor: "Restaurants that want to become a featured watch-party destination.",
    },
];

export default function CreatorPackagesPage() {
    const router = useRouter();
    const [form, setForm] = useState<FormState>({
        venue: "", contactName: "", email: "", phone: "",
        address: "", package: "", message: "",
    });
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function update(field: keyof FormState, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.venue || !form.email || !form.package) {
            setError("Please fill in venue name, email, and select a package.");
            return;
        }
        setError(null);
        setSubmitting(true);

        try {
            const res = await fetch("/api/v1/venue-inquiry", {
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

        const subject = encodeURIComponent(`MatchPoint Venue Inquiry — ${form.venue} (${form.package})`);
        const body = encodeURIComponent(
            `Venue: ${form.venue}\nContact: ${form.contactName}\nEmail: ${form.email}\nPhone: ${form.phone}\nAddress: ${form.address}\nPackage: ${form.package}\n\nMessage:\n${form.message}`,
        );
        window.location.href = `mailto:venues@matchwatch.us?subject=${subject}&body=${body}`;
        setSubmitted(true);
        setSubmitting(false);
    }

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--background)", color: "var(--foreground)" }}>

            {/* Hero */}
            <div style={{
                background: "linear-gradient(135deg, #0a0a0b 0%, #102818 60%, #0a0a0b 100%)",
                borderBottom: "1px solid var(--border)",
                padding: "64px 24px 52px",
                textAlign: "center",
                position: "relative", overflow: "hidden",
            }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 50% 0%, rgba(34,197,94,0.12) 0%, transparent 60%)", pointerEvents: "none" }} />
                <button onClick={() => router.push("/match-point")} style={{ position: "relative", background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 13, fontWeight: 700, marginBottom: 20 }}>
                    ← Back to Match Point
                </button>
                <div style={{ position: "relative" }}>
                    <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 99, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#22c55e", textTransform: "uppercase", marginBottom: 16 }}>
                        MatchWatch · Creator Packages 2026
                    </div>
                    <h1 style={{ fontSize: "clamp(32px,6vw,56px)", fontWeight: 900, lineHeight: 1.05, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
                        Become a <span style={{ color: "#22c55e" }}>MatchPoint</span><br />Venue
                    </h1>
                    <p style={{ fontSize: "clamp(15px,2vw,18px)", color: "var(--muted-foreground)", maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
                        Turn your restaurant, bar, or venue into a professional MatchWatch destination with content, reservation tools, and World Cup watch-party promotion.
                    </p>

                    <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginTop: 36 }}>
                        {[
                            ["74+", "Partner Venues"],
                            ["10K+", "Registered Fans"],
                            ["500+", "QR Scans / Match"],
                            ["64", "World Cup Matches"],
                        ].map(([num, label]) => (
                            <div key={label} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 28, fontWeight: 900, color: "#22c55e" }}>{num}</div>
                                <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 700 }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "52px 20px" }}>

                {/* Package cards */}
                <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8, textAlign: "center" }}>Choose Your MatchPoint Package</h2>
                <p style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 14, marginBottom: 36 }}>Select a package below — it will pre-fill the form.</p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 52, alignItems: "start" }}>
                    {PACKAGES.map((pkg) => {
                        const selected = form.package === pkg.id;
                        return (
                            <button
                                key={pkg.id}
                                onClick={() => update("package", pkg.id)}
                                style={{
                                    position: "relative",
                                    textAlign: "left", padding: "24px 22px", borderRadius: 20,
                                    border: selected ? `2px solid ${pkg.color}` : pkg.featured ? `1.5px solid ${pkg.color}` : "1px solid var(--border)",
                                    background: selected ? `color-mix(in oklch, ${pkg.color} 10%, var(--card))` : "var(--card)",
                                    cursor: "pointer", transition: "all 0.15s",
                                    boxShadow: selected ? `0 0 0 4px color-mix(in oklch, ${pkg.color} 15%, transparent)` : "none",
                                }}
                            >
                                {pkg.featured && (
                                    <div style={{ position: "absolute", top: -11, left: 22, padding: "3px 12px", borderRadius: 99, background: pkg.color, color: "#062b16", fontSize: 10, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                        Most Popular
                                    </div>
                                )}
                                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: pkg.color, marginBottom: 6 }}>
                                    {pkg.name}
                                </div>
                                <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 4 }}>{pkg.price}</div>
                                <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginBottom: 14 }}>{pkg.tagline}</div>
                                {pkg.inherits && (
                                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, color: "var(--foreground)" }}>{pkg.inherits}</div>
                                )}
                                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", display: "grid", gap: 7 }}>
                                    {pkg.perks.map((perk) => (
                                        <li key={perk} style={{ fontSize: 12.5, color: "var(--muted-foreground)", display: "flex", alignItems: "flex-start", gap: 6 }}>
                                            <span style={{ color: pkg.color, flexShrink: 0, marginTop: 1 }}>✓</span>
                                            {perk}
                                        </li>
                                    ))}
                                </ul>
                                <div style={{ fontSize: 11.5, fontStyle: "italic", color: "var(--muted-foreground)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                                    Best for: {pkg.bestFor}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Form */}
                {submitted ? (
                    <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: "48px 36px" }}>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
                        <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 12 }}>Thank you, {form.venue}!</h2>
                        <p style={{ color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: 28 }}>
                            We've received your MatchPoint venue inquiry. Our team will reach out to <strong style={{ color: "var(--foreground)" }}>{form.email}</strong> within 24 hours.
                        </p>
                        <button onClick={() => router.push("/match-point")} style={{ padding: "14px 32px", borderRadius: 12, background: "#22c55e", color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer" }}>
                            Back to Match Point →
                        </button>
                    </div>
                ) : (
                    <div style={{ maxWidth: 640, margin: "0 auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: "40px 36px" }}>
                        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Create Your MatchPoint Page</h2>
                        <p style={{ color: "var(--muted-foreground)", fontSize: 14, marginBottom: 28 }}>Fill in your details and we'll get back to you within 24 hours.</p>

                        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <div>
                                    <label style={labelStyle}>Venue / Restaurant *</label>
                                    <input style={inputStyle} value={form.venue} onChange={(e) => update("venue", e.target.value)} placeholder="e.g. The Goal Post Pub" required />
                                </div>
                                <div>
                                    <label style={labelStyle}>Contact Name</label>
                                    <input style={inputStyle} value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Your full name" />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <div>
                                    <label style={labelStyle}>Email *</label>
                                    <input style={inputStyle} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@venue.com" required />
                                </div>
                                <div>
                                    <label style={labelStyle}>Phone</label>
                                    <input style={inputStyle} type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 (555) 000-0000" />
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Venue Address</label>
                                <input style={inputStyle} value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Street, City, State" />
                            </div>

                            <div>
                                <label style={labelStyle}>Package *</label>
                                <select style={inputStyle} value={form.package} onChange={(e) => update("package", e.target.value)} required>
                                    <option value="">Select a package…</option>
                                    {PACKAGES.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name} — {p.price}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={labelStyle}>Message / Goals</label>
                                <textarea
                                    style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                                    value={form.message}
                                    onChange={(e) => update("message", e.target.value)}
                                    placeholder="Tell us about your venue, capacity, or any custom ideas…"
                                />
                            </div>

                            {error && <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>}

                            <button type="submit" disabled={submitting} style={{
                                padding: "16px", borderRadius: 14,
                                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                color: "#fff", fontSize: 16, fontWeight: 900,
                                border: "none", cursor: "pointer", letterSpacing: "0.01em",
                                boxShadow: "0 4px 20px rgba(34,197,94,0.35)",
                            }}>
                                {submitting ? "Sending…" : "Create My MatchPoint Page →"}
                            </button>

                            <p style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>
                                Or email us directly at{" "}
                                <a href="mailto:venues@matchwatch.us" style={{ color: "#22c55e" }}>venues@matchwatch.us</a>
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
