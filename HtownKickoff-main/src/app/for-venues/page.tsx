"use client";

import { ThemeProvider, AppShell } from "../../components/AppShell";
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
    type LucideIcon,
} from "lucide-react";

export default function ForVenuesPage() {
    const features: Array<{ icon: LucideIcon; title: string; desc: string }> = [
        { icon: TrendingUp, title: "Increase Visibility", desc: "Get featured in our directory and reach fans actively searching for watch parties." },
        { icon: CalendarDays, title: "Manage Events", desc: "Create events for any match, set capacity limits, booking fees, and special notes." },
        { icon: Ticket, title: "Handle Bookings", desc: "Accept reservations, manage guest lists, and track attendance, all from your dashboard." },
        { icon: Megaphone, title: "Promote to Fans", desc: "Post updates, special offers, and match-day promotions directly to your followers." },
        { icon: BarChart3, title: "Track Analytics", desc: "View booking trends, follower growth, and revenue reports at a glance." },
        { icon: CheckCircle2, title: "Get Verified", desc: "Earn a verified badge to show fans you're a trusted, quality venue." },
    ];

    return (
        <ThemeProvider>
            <AppShell>
                <section style={{ padding: "48px 20px", maxWidth: "700px", margin: "0 auto" }}>
                    <div className="section-label" style={{ marginBottom: "8px" }}>FOR VENUE OWNERS</div>
                    <h1 className="font-display text-display animate-fade-up" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>
                        LIST YOUR <span style={{ color: "var(--accent-primary)" }}>VENUE</span>
                    </h1>
                    <p className="text-body animate-fade-up stagger-1" style={{ color: "var(--text-secondary)", marginBottom: "28px" }}>
                        Join Houston&apos;s premier match-night watch-party directory. Get discovered by thousands of football fans looking for the best game-day experience.
                    </p>

                    <div className="animate-fade-up stagger-2" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {features.map((f, i) => (
                            <div key={i} className="card-flat" style={{ padding: "20px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                                <span style={{ color: "var(--accent-primary)", marginTop: "2px" }}><f.icon size={22} /></span>
                                <div>
                                    <h3 className="font-display text-h3" style={{ color: "var(--text-primary)", marginBottom: "4px" }}>{f.title.toUpperCase()}</h3>
                                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="card-flat animate-fade-up stagger-3" style={{ padding: "24px", marginTop: "24px", textAlign: "center", background: "var(--gradient-hero)" }}>
                        <h2 className="font-display text-h2" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>READY TO JOIN?</h2>
                        <p className="text-sm" style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>
                            Listing your venue is free. Get started in under 5 minutes.
                        </p>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                            <Link href="/for-venues/register" className="btn-primary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}><Building2 size={16} />Register Now, Free</Link>
                            <Link href="/contact" className="btn-ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}><MessageSquare size={16} />Talk to Us</Link>
                        </div>
                    </div>
                </section>
            </AppShell>
        </ThemeProvider>
    );
}
