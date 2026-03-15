"use client";

import { ThemeProvider, AppShell } from "../../components/AppShell";
import Link from "next/link";
import { Mail, MapPin, Send, Smartphone } from "lucide-react";

export default function ContactPage() {
    return (
        <ThemeProvider>
            <AppShell>
                <section style={{ padding: "48px 20px", maxWidth: "600px", margin: "0 auto" }}>
                    <div className="section-label" style={{ marginBottom: "8px" }}>GET IN TOUCH</div>
                    <h1 className="font-display text-display animate-fade-up" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>
                        CONTACT <span style={{ color: "var(--accent-primary)" }}>US</span>
                    </h1>
                    <p className="text-body animate-fade-up stagger-1" style={{ color: "var(--text-secondary)", marginBottom: "28px" }}>
                        Have questions, partnership inquiries, or need support? Reach out — we'd love to hear from you.
                    </p>

                    <form className="animate-fade-up stagger-2" style={{ display: "flex", flexDirection: "column", gap: "16px" }} onSubmit={(e) => e.preventDefault()}>
                        <div>
                            <label className="text-xs" style={{ color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "6px" }}>NAME</label>
                            <input type="text" placeholder="Your name" style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", outline: "none" }} />
                        </div>
                        <div>
                            <label className="text-xs" style={{ color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "6px" }}>EMAIL</label>
                            <input type="email" placeholder="you@example.com" style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", outline: "none" }} />
                        </div>
                        <div>
                            <label className="text-xs" style={{ color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "6px" }}>TOPIC</label>
                            <select style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", outline: "none" }}>
                                <option>General Inquiry</option>
                                <option>Venue Partnership</option>
                                <option>Sponsorship</option>
                                <option>Technical Support</option>
                                <option>Press / Media</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs" style={{ color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "6px" }}>MESSAGE</label>
                            <textarea placeholder="Your message..." rows={5} style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", outline: "none", resize: "vertical" }} />
                        </div>
                        <button className="btn-primary" type="submit" style={{ padding: "14px 28px", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <Send size={16} />
                            Send Message
                        </button>
                    </form>

                    <div className="card-flat animate-fade-up stagger-3" style={{ padding: "20px", marginTop: "28px" }}>
                        <h3 className="font-display text-h3" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>OTHER WAYS TO REACH US</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div className="text-sm" style={{ color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                <Mail size={14} />
                                hello@matchwatch.us
                            </div>
                            <div className="text-sm" style={{ color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                <Smartphone size={14} />
                                @matchwatchus on Instagram, Twitter, TikTok
                            </div>
                            <div className="text-sm" style={{ color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                <MapPin size={14} />
                                Houston, TX
                            </div>
                        </div>
                    </div>
                </section>
            </AppShell>
        </ThemeProvider>
    );
}
