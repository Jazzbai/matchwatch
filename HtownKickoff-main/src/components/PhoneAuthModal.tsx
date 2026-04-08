"use client";
import React, { useState, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

interface PhoneAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    title?: string;
}

export function PhoneAuthModal({ isOpen, onClose, onSuccess, title = "Join Match Point" }: PhoneAuthModalProps) {
    const { refreshUser } = useAuth();
    const [step, setStep] = useState<"phone" | "otp">("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    if (!isOpen) return null;

    async function handleSendOtp(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await api.post("/auth/phone/send-otp", { phone });
            setStep("otp");
        } catch (err: any) {
            setError(err?.message || "Failed to send code. Check your number.");
        } finally {
            setLoading(false);
        }
    }

    async function handleVerifyOtp(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const code = otp.join("");
        if (code.length < 6) { setError("Enter all 6 digits"); return; }
        setLoading(true);
        try {
            const res = await api.post<{ accessToken: string; user: { id: string; name: string } }>(
                "/auth/phone/verify",
                { phone, otp: code, name: name || undefined },
            );
            localStorage.setItem("accessToken", res.data.accessToken);
            await refreshUser();
            onSuccess?.();
            onClose();
        } catch (err: any) {
            setError(err?.message || "Incorrect code. Try again.");
        } finally {
            setLoading(false);
        }
    }

    function handleOtpKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Backspace" && !otp[i] && i > 0) {
            otpRefs.current[i - 1]?.focus();
        }
    }

    function handleOtpChange(i: number, val: string) {
        const digit = val.replace(/\D/g, "").slice(-1);
        const next = [...otp];
        next[i] = digit;
        setOtp(next);
        if (digit && i < 5) otpRefs.current[i + 1]?.focus();
    }

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: "var(--card)", borderRadius: 20,
                padding: "36px 32px", maxWidth: 400, width: "90%",
                border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
            }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "var(--primary)", textTransform: "uppercase", marginBottom: 4 }}>
                            MatchWatch Match Point
                        </div>
                        <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--foreground)", margin: 0 }}>{title}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted-foreground)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
                </div>

                {step === "phone" ? (
                    <form onSubmit={handleSendOtp}>
                        <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 20 }}>
                            Enter your phone number. We'll send a 6-digit code to verify.
                        </p>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Your Name (optional)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Alex"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={inputStyle}
                        />
                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", margin: "16px 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            placeholder="+1 (555) 000-0000"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                            autoFocus
                            style={inputStyle}
                        />
                        {error && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 10 }}>{error}</p>}
                        <button type="submit" disabled={loading} style={btnStyle}>
                            {loading ? "Sending…" : "Send Code →"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp}>
                        <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 20 }}>
                            Enter the 6-digit code sent to <strong style={{ color: "var(--foreground)" }}>{phone}</strong>
                        </p>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
                            {otp.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={(el) => { otpRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleOtpChange(i, e.target.value)}
                                    onKeyDown={(e) => handleOtpKey(i, e)}
                                    style={{
                                        width: 44, height: 52, textAlign: "center",
                                        fontSize: 22, fontWeight: 800,
                                        borderRadius: 10, border: "2px solid var(--border)",
                                        backgroundColor: "var(--secondary)", color: "var(--foreground)",
                                        outline: "none",
                                    }}
                                />
                            ))}
                        </div>
                        {error && <p style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{error}</p>}
                        <button type="submit" disabled={loading} style={btnStyle}>
                            {loading ? "Verifying…" : "Verify & Continue →"}
                        </button>
                        <button type="button" onClick={() => { setStep("phone"); setOtp(["", "", "", "", "", ""]); setError(null); }}
                            style={{ display: "block", width: "100%", marginTop: 10, background: "none", border: "none", color: "var(--muted-foreground)", fontSize: 13, cursor: "pointer", textAlign: "center" }}>
                            ← Change number
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: "100%", minHeight: 44, padding: "10px 14px",
    borderRadius: 12, border: "1px solid var(--border)",
    backgroundColor: "var(--secondary)", color: "var(--foreground)",
    fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
    display: "block", width: "100%", marginTop: 20,
    padding: "14px 20px", borderRadius: 12,
    backgroundColor: "var(--primary)", color: "#fff",
    fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer",
    letterSpacing: "0.02em",
};