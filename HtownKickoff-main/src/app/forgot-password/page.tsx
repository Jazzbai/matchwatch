"use client";

import * as React from "react";
import Link from "next/link";
import { CircleAlert, CircleCheckBig, Mail, ArrowLeft } from "lucide-react";
import { authApi } from "../../lib/api";
import { FloatingNav } from "../../components/AppShell";

export default function ForgotPasswordPage() {
    const [email, setEmail] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [formError, setFormError] = React.useState<string | null>(null);
    const [sent, setSent] = React.useState(false);

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setFormError(null);
        if (!email.trim()) {
            setFormError("Please enter your email address.");
            return;
        }
        setIsLoading(true);
        try {
            await authApi.forgotPassword(email);
            setSent(true);
        } catch (err: unknown) {
            // The API returns the same message regardless of whether the email exists,
            // so any error here is a transport / validation problem.
            const message = err instanceof Error ? err.message : "Could not send reset email. Please try again.";
            setFormError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="matchwatch-forgot-page"
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100dvh",
                width: "100%",
                padding: "120px 20px 56px",
                color: "var(--foreground)",
                fontFamily: "var(--font-body), system-ui, sans-serif",
                ["--primary" as string]: "oklch(0.72 0.19 28)",
                ["--primary-foreground" as string]: "oklch(0.99 0 0)",
            }}
        >
            <FloatingNav />
            <div
                style={{
                    width: "100%",
                    maxWidth: 460,
                    display: "flex",
                    flexDirection: "column",
                    padding: "40px 36px",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    backgroundColor: "var(--card)",
                    boxShadow: "0 24px 70px color-mix(in oklch, var(--foreground) 14%, transparent)",
                }}
            >
                <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 28, fontSize: 13, color: "var(--muted-foreground)", textDecoration: "none", fontWeight: 600 }}>
                    <ArrowLeft size={14} /> Back to sign in
                </Link>

                <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 8, lineHeight: 1.1 }}>
                    {sent ? "Check your email" : "Forgot your password?"}
                </h1>
                <p style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 28, lineHeight: 1.55 }}>
                    {sent
                        ? "If an account exists for that email, we've sent a reset link. It expires in 1 hour."
                        : "Enter the email address you signed up with and we'll send you a link to reset your password."}
                </p>

                {formError && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderRadius: 12, backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", marginBottom: 20, fontSize: 14, color: "#ef4444" }}>
                        <CircleAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} /> {formError}
                    </div>
                )}

                {sent ? (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 16px", borderRadius: 12, backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", marginBottom: 20, fontSize: 14, color: "#22c55e" }}>
                        <CircleCheckBig size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                        Reset link sent to <strong>{email}</strong>. Check your inbox (and spam folder).
                    </div>
                ) : (
                    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--foreground)" }}>Email address</label>
                            <div style={{ position: "relative" }}>
                                <Mail size={18} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted-foreground)", pointerEvents: "none" }} />
                                <input
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                    style={{
                                        width: "100%", height: 48, paddingLeft: 42, paddingRight: 16, fontSize: 15,
                                        borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--background)",
                                        color: "var(--foreground)", outline: "none", fontFamily: "inherit",
                                    }}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            style={{
                                width: "100%", height: 48, borderRadius: 12, border: "none", cursor: isLoading ? "wait" : "pointer",
                                backgroundColor: "var(--primary)", color: "var(--primary-foreground)",
                                fontWeight: 700, fontSize: 15, fontFamily: "inherit",
                                opacity: isLoading ? 0.7 : 1, transition: "all 0.2s",
                            }}
                        >
                            {isLoading ? "Sending reset link..." : "Send reset link"}
                        </button>
                    </form>
                )}

                <div style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>
                    Remember your password?{" "}
                    <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
                </div>
            </div>
        </div>
    );
}
