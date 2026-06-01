"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheckBig, Lock, ArrowLeft } from "lucide-react";
import { authApi } from "../../lib/api";
import { FloatingNav } from "../../components/AppShell";

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token")?.trim() ?? "";

    const [password, setPassword] = React.useState("");
    const [confirm, setConfirm] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [formError, setFormError] = React.useState<string | null>(null);
    const [done, setDone] = React.useState(false);

    const checks = [
        { label: "10+ characters", pass: password.length >= 10 },
        { label: "Uppercase", pass: /[A-Z]/.test(password) },
        { label: "Lowercase", pass: /[a-z]/.test(password) },
        { label: "Number", pass: /[0-9]/.test(password) },
        { label: "Symbol", pass: /[^A-Za-z0-9]/.test(password) },
    ];
    const score = checks.filter((c) => c.pass).length;
    const strong = score === 5;
    const color = score <= 1 ? "#ef4444" : score <= 2 ? "#f97316" : score <= 3 ? "#eab308" : score <= 4 ? "#84cc16" : "#22c55e";
    const label = score <= 1 ? "Weak" : score <= 2 ? "Fair" : score <= 3 ? "Moderate" : score <= 4 ? "Good" : "Strong";

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setFormError(null);
        if (!token) {
            setFormError("Missing reset token. Re-request a reset link.");
            return;
        }
        if (!strong) {
            setFormError("Password must include uppercase, lowercase, number, and symbol (10+ chars).");
            return;
        }
        if (password !== confirm) {
            setFormError("Passwords do not match.");
            return;
        }
        setIsLoading(true);
        try {
            await authApi.resetPassword({ token, password });
            setDone(true);
            setTimeout(() => router.push("/login"), 2500);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Reset failed. The link may have expired.";
            setFormError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
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
                    {done ? "Password updated" : "Set a new password"}
                </h1>
                <p style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 28, lineHeight: 1.55 }}>
                    {done
                        ? "All set. Redirecting you to sign in…"
                        : "Choose a strong password. We'll sign you out of all other devices for security."}
                </p>

                {!token && !done && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderRadius: 12, backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", marginBottom: 20, fontSize: 14, color: "#ef4444" }}>
                        <CircleAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                        This reset link is missing its token. <Link href="/forgot-password" style={{ color: "#ef4444", textDecoration: "underline", marginLeft: 4 }}>Request a new one</Link>.
                    </div>
                )}

                {formError && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderRadius: 12, backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", marginBottom: 20, fontSize: 14, color: "#ef4444" }}>
                        <CircleAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} /> {formError}
                    </div>
                )}

                {done ? (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 16px", borderRadius: 12, backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", marginBottom: 8, fontSize: 14, color: "#22c55e" }}>
                        <CircleCheckBig size={18} style={{ flexShrink: 0, marginTop: 2 }} /> Password successfully changed.
                    </div>
                ) : (
                    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>New password</label>
                            <div style={{ position: "relative" }}>
                                <Lock size={18} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted-foreground)", pointerEvents: "none" }} />
                                <input
                                    type="password"
                                    placeholder="10+ characters, complex"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoFocus
                                    disabled={!token}
                                    style={{
                                        width: "100%", height: 48, paddingLeft: 42, paddingRight: 16, fontSize: 15,
                                        borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--background)",
                                        color: "var(--foreground)", outline: "none", fontFamily: "inherit",
                                    }}
                                />
                            </div>
                            {password.length > 0 && (
                                <div style={{ marginTop: 10 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
                                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{score}/5</span>
                                    </div>
                                    <div style={{ width: "100%", height: 6, borderRadius: 99, backgroundColor: "var(--border)", overflow: "hidden" }}>
                                        <div style={{ width: `${(score / 5) * 100}%`, height: "100%", borderRadius: 99, backgroundColor: color, transition: "all 0.3s ease" }} />
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                                        {checks.map((c) => (
                                            <span key={c.label} style={{
                                                fontSize: 11, padding: "3px 8px", borderRadius: 12,
                                                backgroundColor: c.pass ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.1)",
                                                color: c.pass ? "#22c55e" : "var(--muted-foreground)",
                                                fontWeight: 600, border: `1px solid ${c.pass ? "rgba(34,197,94,0.3)" : "transparent"}`,
                                            }}>{c.pass ? "✓" : "•"} {c.label}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Confirm password</label>
                            <div style={{ position: "relative" }}>
                                <Lock size={18} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted-foreground)", pointerEvents: "none" }} />
                                <input
                                    type="password"
                                    placeholder="Repeat your password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    required
                                    disabled={!token}
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
                            disabled={isLoading || !token}
                            style={{
                                width: "100%", height: 48, borderRadius: 12, border: "none", cursor: isLoading || !token ? "not-allowed" : "pointer",
                                backgroundColor: "var(--primary)", color: "var(--primary-foreground)",
                                fontWeight: 700, fontSize: 15, fontFamily: "inherit",
                                opacity: isLoading || !token ? 0.6 : 1, transition: "all 0.2s",
                            }}
                        >
                            {isLoading ? "Updating password..." : "Update password"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <React.Suspense fallback={<div style={{ minHeight: "100dvh", backgroundColor: "var(--background)" }} />}>
            <ResetPasswordContent />
        </React.Suspense>
    );
}
