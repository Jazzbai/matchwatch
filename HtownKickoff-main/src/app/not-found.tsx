"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, CircleDot, Lightbulb, MapPin } from "lucide-react";
import { AppShell } from "../components/AppShell";

export default function NotFoundPage() {
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setRotation((prev) => (prev + 2) % 360);
        }, 50);
        return () => clearInterval(interval);
    }, []);

    return (
        
            <AppShell>
                <div
                    style={{
                        minHeight: "calc(100dvh - 120px)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "40px 20px",
                        textAlign: "center",
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    {/* Background decorations */}
                    <div style={{ position: "absolute", top: "10%", left: "10%", width: "300px", height: "300px", borderRadius: "50%", background: "var(--primary)", opacity: 0.03, filter: "blur(80px)" }} />
                    <div style={{ position: "absolute", bottom: "10%", right: "10%", width: "250px", height: "250px", borderRadius: "50%", background: "var(--accent-danger)", opacity: 0.03, filter: "blur(80px)" }} />

                    {/* Field pattern lines faded */}
                    <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 38px, color-mix(in oklch, var(--primary) 15%, transparent) 38px, color-mix(in oklch, var(--primary) 15%, transparent) 40px)", opacity: 0.06, pointerEvents: "none" }} />

                    {/* Rotating ball glyph */}
                    <div
                        className="animate-float"
                        style={{
                            marginBottom: "24px",
                            transform: `rotate(${rotation}deg)`,
                            filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.3))",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <CircleDot size={76} color="var(--primary)" />
                    </div>

                    {/* Error Code */}
                    <div
                        className="font-mono animate-fade-up"
                        style={{
                            fontSize: "7rem",
                            fontWeight: 700,
                            lineHeight: 1,
                            color: "var(--primary)",
                            textShadow: "0 0 40px color-mix(in oklch, var(--primary) 15%, transparent)",
                            marginBottom: "8px",
                        }}
                    >
                        404
                    </div>

                    {/* Headline */}
                    <h1
                        className="font-display text-display animate-fade-up stagger-1"
                        style={{ color: "var(--foreground)", marginBottom: "8px" }}
                    >
                        OFFSIDE!
                    </h1>

                    {/* Description */}
                    <p
                        className="text-body animate-fade-up stagger-2"
                        style={{
                            color: "var(--muted-foreground)",
                            maxWidth: "420px",
                            marginBottom: "32px",
                        }}
                    >
                        The page you're looking for has left the pitch. It might have been moved, deleted, or maybe it never existed — like that goal the ref disallowed.
                    </p>

                    {/* Status strip */}
                    <div
                        className="card-flat animate-fade-up stagger-3"
                        style={{ padding: "12px 20px", marginBottom: "28px", display: "inline-flex", alignItems: "center", gap: "12px" }}
                    >
                        <span className="live-dot" style={{ width: "8px", height: "8px" }} />
                        <span className="font-mono text-xs" style={{ color: "var(--live-pulse)" }}>VAR REVIEW:</span>
                        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Page not found. No goal.</span>
                    </div>

                    {/* CTA Buttons */}
                    <div className="animate-fade-up stagger-4" style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                        <a href="/" className="btn-primary" style={{ textDecoration: "none", padding: "14px 28px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <ArrowLeft size={16} />
                            Back to MatchWatch
                        </a>
                        <a href="/matches" className="btn-ghost" style={{ textDecoration: "none", padding: "14px 28px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <CalendarDays size={16} />
                            Browse Matches
                        </a>
                        <a href="/venues" className="btn-ghost" style={{ textDecoration: "none", padding: "14px 28px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <MapPin size={16} />
                            Find Venues
                        </a>
                    </div>

                    {/* Fun fact */}
                    <div className="animate-fade-up stagger-5" style={{ marginTop: "36px" }}>
                        <div className="text-xs" style={{ color: "var(--muted-foreground)", maxWidth: "350px", display: "inline-flex", alignItems: "flex-start", gap: "8px" }}>
                            <Lightbulb size={14} style={{ marginTop: "1px", flexShrink: 0 }} />
                            <p><strong>Fun fact:</strong> Lucien Laurent scored the first goal in men&apos;s international tournament history in 1930. This page, however, will never score.</p>
                        </div>
                    </div>
                </div>
            </AppShell>
        
    );
}
