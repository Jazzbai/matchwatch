"use client";

import { ThemeProvider, AppShell } from "../../components/AppShell";

export default function PrivacyPage() {
    return (
        <ThemeProvider>
            <AppShell>
                <section style={{ padding: "48px 20px", maxWidth: "700px", margin: "0 auto" }}>
                    <div className="section-label" style={{ marginBottom: "8px" }}>LEGAL</div>
                    <h1 className="font-display text-display animate-fade-up" style={{ color: "var(--text-primary)", marginBottom: "16px" }}>
                        PRIVACY <span style={{ color: "var(--accent-primary)" }}>POLICY</span>
                    </h1>
                    <div className="animate-fade-up stagger-1" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        {[
                            { title: "Information We Collect", content: "We collect information you provide directly, such as your name, email address, and booking preferences. We also collect usage data including pages visited, matches viewed, and venues browsed." },
                            { title: "How We Use Your Data", content: "Your data is used to provide and improve our services, personalize your experience, process bookings, and send you relevant match and venue updates (with your consent)." },
                            { title: "Data Sharing", content: "We share booking information with venue partners to fulfill your reservations. We do not sell your personal data to third parties. Anonymous analytics may be used for platform improvements." },
                            { title: "Cookies & Tracking", content: "We use essential cookies for authentication and preferences, and optional analytics cookies to understand usage patterns. You can manage your cookie preferences in your browser settings." },
                            { title: "Your Rights", content: "You have the right to access, correct, or delete your personal data. You can unsubscribe from marketing communications at any time. Contact us at privacy@matchwatch.us for data requests." },
                            { title: "Security", content: "We implement industry-standard security measures to protect your data, including encryption in transit and at rest, regular security audits, and access controls." },
                        ].map((s, i) => (
                            <div key={i} className="card-flat" style={{ padding: "20px" }}>
                                <h2 className="font-display text-h3" style={{ color: "var(--text-primary)", marginBottom: "6px" }}>{s.title.toUpperCase()}</h2>
                                <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{s.content}</p>
                            </div>
                        ))}
                        <div className="text-xs" style={{ color: "var(--text-muted)", marginTop: "8px" }}>
                            Last updated: February 22, 2026 · Contact: privacy@matchwatch.us
                        </div>
                    </div>
                </section>
            </AppShell>
        </ThemeProvider>
    );
}
