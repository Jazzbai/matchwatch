"use client";

import * as React from "react";
import { AppShell } from "../../components/AppShell";
import { Mail, MapPin, Send, Smartphone, CircleAlert, CircleCheckBig } from "lucide-react";

const TOPICS = [
    "General Inquiry",
    "Venue Partnership",
    "Sponsorship",
    "Technical Support",
    "Press / Media",
];

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--foreground)",
    fontFamily: "inherit",
    fontSize: "0.9rem",
    outline: "none",
};

const labelStyle: React.CSSProperties = {
    color: "var(--muted-foreground)",
    fontWeight: 600,
    display: "block",
    marginBottom: "6px",
};

export default function ContactPage() {
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [topic, setTopic] = React.useState(TOPICS[0]);
    const [message, setMessage] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [submitted, setSubmitted] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!name.trim() || !email.trim() || !message.trim()) {
            setError("Please fill in your name, email, and a message.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/v1/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    topic,
                    message: message.trim(),
                }),
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.success) {
                setSubmitted(true);
                return;
            }
            setError(data?.error?.message || "Something went wrong. Please try again.");
        } catch {
            setError("Couldn't reach the server. Please try again later.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AppShell>
            <section style={{ padding: "48px 20px", maxWidth: "600px", margin: "0 auto" }}>
                <div className="section-label" style={{ marginBottom: "8px" }}>GET IN TOUCH</div>
                <h1
                    className="font-display text-display animate-fade-up"
                    style={{ color: "var(--foreground)", marginBottom: "8px" }}
                >
                    CONTACT <span style={{ color: "var(--primary)" }}>US</span>
                </h1>
                <p
                    className="text-body animate-fade-up stagger-1"
                    style={{ color: "var(--muted-foreground)", marginBottom: "28px" }}
                >
                    Have questions, partnership inquiries, or need support? Reach out — we&apos;d love to hear from you.
                </p>

                {submitted ? (
                    <div
                        className="animate-fade-up"
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "12px",
                            padding: "20px",
                            borderRadius: "14px",
                            border: "1px solid color-mix(in oklch, var(--primary) 35%, var(--border))",
                            background: "color-mix(in oklch, var(--primary) 10%, var(--card))",
                            color: "var(--foreground)",
                        }}
                    >
                        <CircleCheckBig size={20} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <h3 className="font-display" style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "4px" }}>
                                Message sent
                            </h3>
                            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                                Thanks for reaching out — we&apos;ll get back to you soon.
                            </p>
                        </div>
                    </div>
                ) : (
                    <form
                        className="animate-fade-up stagger-2"
                        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
                        onSubmit={handleSubmit}
                    >
                        <div>
                            <label htmlFor="contact-name" className="text-xs" style={labelStyle}>NAME</label>
                            <input
                                id="contact-name"
                                type="text"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label htmlFor="contact-email" className="text-xs" style={labelStyle}>EMAIL</label>
                            <input
                                id="contact-email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label htmlFor="contact-topic" className="text-xs" style={labelStyle}>TOPIC</label>
                            <select
                                id="contact-topic"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                style={inputStyle}
                            >
                                {TOPICS.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="contact-message" className="text-xs" style={labelStyle}>MESSAGE</label>
                            <textarea
                                id="contact-message"
                                placeholder="Your message..."
                                rows={5}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                required
                                style={{ ...inputStyle, resize: "vertical" }}
                            />
                        </div>

                        {error && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "10px",
                                    padding: "12px 14px",
                                    borderRadius: "10px",
                                    border: "1px solid color-mix(in oklch, var(--destructive) 40%, var(--border))",
                                    background: "color-mix(in oklch, var(--destructive) 12%, transparent)",
                                    color: "var(--destructive)",
                                    fontSize: "0.85rem",
                                }}
                            >
                                <CircleAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                                {error}
                            </div>
                        )}

                        <button
                            className="btn-primary"
                            type="submit"
                            disabled={submitting}
                            style={{
                                padding: "14px 28px",
                                alignSelf: "flex-start",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                opacity: submitting ? 0.7 : 1,
                                cursor: submitting ? "not-allowed" : "pointer",
                            }}
                        >
                            <Send size={16} />
                            {submitting ? "Sending..." : "Send Message"}
                        </button>
                    </form>
                )}

                <div
                    className="animate-fade-up stagger-3"
                    style={{
                        padding: "20px",
                        marginTop: "28px",
                        borderRadius: "14px",
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                    }}
                >
                    <h3
                        className="font-display"
                        style={{ color: "var(--foreground)", fontWeight: 700, fontSize: "1.05rem", marginBottom: "12px" }}
                    >
                        OTHER WAYS TO REACH US
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <a
                            href="mailto:hello@matchwatch.us"
                            className="text-sm"
                            style={{ color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none" }}
                        >
                            <Mail size={14} />
                            hello@matchwatch.us
                        </a>
                        <div className="text-sm" style={{ color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <Smartphone size={14} />
                            @matchwatchus on Instagram, Twitter, TikTok
                        </div>
                        <div className="text-sm" style={{ color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <MapPin size={14} />
                            Houston, TX
                        </div>
                    </div>
                </div>
            </section>
        </AppShell>
    );
}
