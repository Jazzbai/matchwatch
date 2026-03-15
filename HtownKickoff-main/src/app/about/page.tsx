"use client";

import { ThemeProvider, AppShell } from "../../components/AppShell";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";

export default function AboutPage() {
    return (
        <ThemeProvider>
            <AppShell>
                <section style={{ padding: "48px 20px", maxWidth: "700px", margin: "0 auto" }}>
                    <div className="section-label" style={{ marginBottom: "8px" }}>ABOUT US</div>
                    <h1 className="font-display text-display animate-fade-up" style={{ color: "var(--text-primary)", marginBottom: "16px" }}>
                        MATCHWATCH<br /><span style={{ color: "var(--accent-primary)" }}>WATCHPARTY</span>
                    </h1>

                    <div className="animate-fade-up stagger-1" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <p className="text-body" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                            MatchWatch is Houston&apos;s premier football watch-party directory. We connect fans with the best bars, lounges, and restaurants hosting live match screenings across the city.
                        </p>

                        <div className="card-flat" style={{ padding: "20px" }}>
                            <h2 className="font-display text-h3" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>OUR MISSION</h2>
                            <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                                To make every major match an unforgettable experience by helping fans find the perfect venue, book their spot, and join the action in one place.
                            </p>
                        </div>

                        <div className="card-flat" style={{ padding: "20px" }}>
                            <h2 className="font-display text-h3" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>WHY HOUSTON?</h2>
                            <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                                Houston has incredible diversity, a world-class dining scene, and a passionate sports culture, which makes it a top destination for the beautiful game.
                            </p>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                            {[
                                { value: "8+", label: "Partner Venues" },
                                { value: "15+", label: "Matches Covered" },
                                { value: "1.2K+", label: "Fans Connected" },
                            ].map((s, i) => (
                                <div key={i} className={`card-flat animate-fade-up stagger-${i + 2}`} style={{ padding: "16px", textAlign: "center" }}>
                                    <div className="font-mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent-primary)" }}>{s.value}</div>
                                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: "32px", display: "flex", gap: "12px" }}>
                        <Link href="/matches" className="btn-primary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}><CalendarDays size={16} />Browse Matches</Link>
                        <Link href="/venues" className="btn-ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}><MapPin size={16} />Explore Venues</Link>
                    </div>
                </section>
            </AppShell>
        </ThemeProvider>
    );
}
