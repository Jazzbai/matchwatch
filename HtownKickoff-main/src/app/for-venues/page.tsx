"use client";

import { AppShell } from "../../components/AppShell";
import Link from "next/link";
import {
    BarChart3,
    Building2,
    CalendarDays,
    CheckCircle2,
    Megaphone,
    MessageSquare,
    Ticket,
    TrendingUp,
    ArrowRight,
    type LucideIcon,
} from "lucide-react";

export default function ForVenuesPage() {
    const features: Array<{ icon: LucideIcon; title: string; desc: string }> = [
        { icon: TrendingUp, title: "Increase Visibility", desc: "Get featured in our directory and reach fans actively searching for watch parties near them." },
        { icon: CalendarDays, title: "Manage Events", desc: "Create events for any match, set capacity limits, booking fees, and special notes." },
        { icon: Ticket, title: "Handle Bookings", desc: "Accept reservations, manage guest lists, and track attendance — all from your dashboard." },
        { icon: Megaphone, title: "Promote to Fans", desc: "Post updates, special offers, and match-day promotions directly to your followers." },
        { icon: BarChart3, title: "Track Analytics", desc: "View booking trends, follower growth, and revenue reports at a glance." },
        { icon: CheckCircle2, title: "Get Verified", desc: "Earn a verified badge to show fans you're a trusted, quality venue." },
    ];

    const steps = [
        { n: "1", title: "Create your listing", desc: "Add your venue details, photos, amenities, and menu in minutes." },
        { n: "2", title: "Host matches", desc: "Pick the fixtures you're showing and set your capacity." },
        { n: "3", title: "Welcome fans", desc: "Take bookings, fill seats, and grow a loyal match-night crowd." },
    ];

    const stats = [
        { value: "+38%", label: "avg cover lift on match nights" },
        { value: "$0", label: "listing cost, forever" },
        { value: "2,400+", label: "venues onboard" },
    ];

    const cardStyle: React.CSSProperties = {
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
    };

    return (
        <AppShell>
            <section
                className="for-venues-page"
                style={{
                    "--primary": "#FF4B4B",
                    "--ring": "#FF4B4B",
                } as React.CSSProperties}
            >
                {/* ── HERO ── */}
                <div
                    style={{
                        maxWidth: 1200,
                        margin: "0 auto",
                        padding: "32px clamp(16px, 4vw, 32px) 8px",
                    }}
                >
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 0.85fr)",
                            gap: "clamp(24px, 4vw, 56px)",
                            alignItems: "center",
                        }}
                        className="for-venues-hero"
                    >
                        <div>
                            <div className="section-label" style={{ marginBottom: 12 }}>FOR VENUE OWNERS</div>
                            <h1
                                className="font-display animate-fade-up"
                                style={{
                                    color: "var(--foreground)",
                                    fontWeight: 900,
                                    fontSize: "clamp(32px, 5vw, 52px)",
                                    lineHeight: 1.07,
                                    letterSpacing: "-0.03em",
                                    marginBottom: 16,
                                }}
                            >
                                Pack your bar,{" "}
                                <span style={{ color: "var(--primary)" }}>every match night.</span>
                            </h1>
                            <p
                                className="animate-fade-up stagger-1"
                                style={{
                                    color: "var(--muted-foreground)",
                                    fontSize: 16,
                                    lineHeight: 1.65,
                                    maxWidth: 520,
                                    marginBottom: 28,
                                }}
                            >
                                List your venue on MatchWatch and get discovered by thousands of football fans
                                planning where to watch the next match. Free to list — no contracts, no setup fees.
                            </p>
                            <div
                                className="animate-fade-up stagger-2"
                                style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
                            >
                                <Link
                                    href="/for-venues/register"
                                    style={{
                                        display: "inline-flex", alignItems: "center", gap: 8,
                                        padding: "13px 22px", borderRadius: 12,
                                        background: "var(--primary)", color: "#fff",
                                        fontWeight: 700, fontSize: 15, textDecoration: "none",
                                    }}
                                >
                                    <Building2 size={17} /> Register Now — Free
                                </Link>
                                <Link
                                    href="/contact"
                                    style={{
                                        display: "inline-flex", alignItems: "center", gap: 8,
                                        padding: "13px 22px", borderRadius: 12,
                                        background: "transparent", color: "var(--foreground)",
                                        border: "1px solid var(--border)",
                                        fontWeight: 700, fontSize: 15, textDecoration: "none",
                                    }}
                                >
                                    <MessageSquare size={17} /> Talk to Us
                                </Link>
                            </div>
                        </div>

                        {/* Visual stat card */}
                        <div
                            className="animate-fade-up stagger-2 for-venues-hero-card"
                            style={{
                                ...cardStyle,
                                padding: 28,
                                display: "flex",
                                flexDirection: "column",
                                gap: 18,
                            }}
                        >
                            <div
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 8,
                                    fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
                                    textTransform: "uppercase", color: "var(--primary)",
                                }}
                            >
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)" }} />
                                Why venues join
                            </div>
                            {stats.map((s) => (
                                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span
                                        style={{
                                            fontFamily: "var(--font-display), sans-serif",
                                            fontWeight: 900, fontSize: 34, lineHeight: 1,
                                            color: "var(--primary)", letterSpacing: "-0.02em",
                                            minWidth: 88,
                                        }}
                                    >
                                        {s.value}
                                    </span>
                                    <span style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
                                        {s.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── BENEFITS GRID ── */}
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px clamp(16px, 4vw, 32px) 8px" }}>
                    <h2
                        className="font-display"
                        style={{
                            color: "var(--foreground)", fontWeight: 800,
                            fontSize: "clamp(22px, 3vw, 30px)", letterSpacing: "-0.02em",
                            marginBottom: 6,
                        }}
                    >
                        Everything you need to run match nights
                    </h2>
                    <p style={{ color: "var(--muted-foreground)", fontSize: 15, marginBottom: 28 }}>
                        One dashboard for events, bookings, promotion, and insights.
                    </p>
                    <div
                        className="for-venues-grid"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: 16,
                        }}
                    >
                        {features.map((f) => (
                            <div key={f.title} style={{ ...cardStyle, padding: 22 }}>
                                <span
                                    style={{
                                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                                        width: 42, height: 42, borderRadius: 11, marginBottom: 14,
                                        background: "color-mix(in oklch, var(--primary) 14%, transparent)",
                                        color: "var(--primary)",
                                    }}
                                >
                                    <f.icon size={21} />
                                </span>
                                <h3
                                    className="font-display"
                                    style={{
                                        color: "var(--foreground)", fontWeight: 700,
                                        fontSize: 17, marginBottom: 6,
                                    }}
                                >
                                    {f.title}
                                </h3>
                                <p style={{ color: "var(--muted-foreground)", fontSize: 14, lineHeight: 1.6 }}>
                                    {f.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── HOW IT WORKS ── */}
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px clamp(16px, 4vw, 32px) 8px" }}>
                    <h2
                        className="font-display"
                        style={{
                            color: "var(--foreground)", fontWeight: 800,
                            fontSize: "clamp(22px, 3vw, 30px)", letterSpacing: "-0.02em",
                            marginBottom: 28,
                        }}
                    >
                        Up and running in three steps
                    </h2>
                    <div
                        className="for-venues-grid"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: 16,
                        }}
                    >
                        {steps.map((s) => (
                            <div key={s.n} style={{ ...cardStyle, padding: 24 }}>
                                <span
                                    style={{
                                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                                        width: 36, height: 36, borderRadius: "50%", marginBottom: 14,
                                        background: "var(--primary)", color: "#fff",
                                        fontWeight: 800, fontSize: 15,
                                    }}
                                >
                                    {s.n}
                                </span>
                                <h3
                                    className="font-display"
                                    style={{ color: "var(--foreground)", fontWeight: 700, fontSize: 17, marginBottom: 6 }}
                                >
                                    {s.title}
                                </h3>
                                <p style={{ color: "var(--muted-foreground)", fontSize: 14, lineHeight: 1.6 }}>
                                    {s.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── FINAL CTA ── */}
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px clamp(16px, 4vw, 32px) 64px" }}>
                    <div
                        style={{
                            ...cardStyle,
                            padding: "clamp(28px, 5vw, 48px)",
                            textAlign: "center",
                            background:
                                "linear-gradient(135deg, color-mix(in oklch, var(--primary) 12%, var(--card)), var(--card))",
                        }}
                    >
                        <h2
                            className="font-display"
                            style={{
                                color: "var(--foreground)", fontWeight: 800,
                                fontSize: "clamp(24px, 4vw, 34px)", letterSpacing: "-0.02em",
                                marginBottom: 10,
                            }}
                        >
                            Ready to fill your venue?
                        </h2>
                        <p
                            style={{
                                color: "var(--muted-foreground)", fontSize: 15,
                                marginBottom: 24, maxWidth: 460, marginInline: "auto",
                            }}
                        >
                            Listing your venue is free. Get started in under five minutes.
                        </p>
                        <Link
                            href="/for-venues/register"
                            style={{
                                display: "inline-flex", alignItems: "center", gap: 8,
                                padding: "14px 26px", borderRadius: 12,
                                background: "var(--primary)", color: "#fff",
                                fontWeight: 700, fontSize: 15, textDecoration: "none",
                            }}
                        >
                            Register Your Venue <ArrowRight size={17} />
                        </Link>
                    </div>
                </div>
            </section>
        </AppShell>
    );
}
