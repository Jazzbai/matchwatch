"use client";

import { AppShell } from "../../components/AppShell";

export default function TermsPage() {
    return (
        
            <AppShell>
                <section style={{ padding: "48px 20px", maxWidth: "700px", margin: "0 auto" }}>
                    <div className="section-label" style={{ marginBottom: "8px" }}>LEGAL</div>
                    <h1 className="font-display text-display animate-fade-up" style={{ color: "var(--foreground)", marginBottom: "16px" }}>
                        TERMS OF <span style={{ color: "var(--primary)" }}>SERVICE</span>
                    </h1>
                    <div className="animate-fade-up stagger-1" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        {[
                            { title: "Acceptance of Terms", content: "By using MatchWatch, you agree to these terms. If you don't agree, please don't use our platform. We may update these terms from time to time — continued use constitutes acceptance of changes." },
                            { title: "User Accounts", content: "You must provide accurate information when creating an account. You're responsible for maintaining the security of your account and for all activities under it. One account per person." },
                            { title: "Bookings & Reservations", content: "Bookings made through MatchWatch are agreements between you and the venue. We facilitate the booking process but are not responsible for venue-side issues. Cancellation policies are set by individual venues." },
                            { title: "Venue Listings", content: "Venue owners are responsible for the accuracy of their listings, including capacity, amenities, pricing, and event details. Fraudulent or misleading listings may be removed without notice." },
                            { title: "Content & Conduct", content: "You agree not to post offensive, fraudulent, or illegal content. Reviews must be honest and based on real visits. We reserve the right to remove content and suspend accounts that violate these guidelines." },
                            { title: "Limitation of Liability", content: "MatchWatch provides information and booking facilitation. We are not liable for the quality of venue experiences, match results, or any disputes between users and venues." },
                        ].map((s, i) => (
                            <div key={i} className="card-flat" style={{ padding: "20px" }}>
                                <h2 className="font-display text-h3" style={{ color: "var(--foreground)", marginBottom: "6px" }}>{s.title.toUpperCase()}</h2>
                                <p className="text-sm" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>{s.content}</p>
                            </div>
                        ))}
                        <div className="text-xs" style={{ color: "var(--muted-foreground)", marginTop: "8px" }}>
                            Last updated: February 22, 2026 · Contact: legal@matchwatch.us
                        </div>
                    </div>
                </section>
            </AppShell>
        
    );
}
