"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Building2,
  CircleAlert,
  CircleCheckBig,
  Lock,
  Mail,
  UserPlus,
  Users,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { executeRecaptcha, isRecaptchaEnabled } from "../../lib/recaptcha";
import { FloatingNav } from "../../components/AppShell";

type AccountType = "fan" | "venue";

export default function LoginPage() {
  const { login, register, logout, isLoading, error: authError } = useAuth();
  const router = useRouter();

  const [accountType, setAccountType] = React.useState<AccountType>("fan");
  const [remember, setRemember] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);

  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");

  const [signupName, setSignupName] = React.useState("");
  const [signupEmail, setSignupEmail] = React.useState("");
  const [signupPassword, setSignupPassword] = React.useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = React.useState("");
  const [signupAccepted, setSignupAccepted] = React.useState(false);
  const [authTab, setAuthTab] = React.useState<"signin" | "signup">("signin");
  const [nextPath, setNextPath] = React.useState<string | null>(null);
  const recaptchaEnabled = isRecaptchaEnabled();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAuthTab(params.get("view") === "signup" ? "signup" : "signin");
    const next = params.get("next");
    setNextPath(next && next.startsWith("/") ? next : null);
  }, []);

  const passwordStrong =
    signupPassword.length >= 10 &&
    /[A-Z]/.test(signupPassword) &&
    /[a-z]/.test(signupPassword) &&
    /[0-9]/.test(signupPassword) &&
    /[^A-Za-z0-9]/.test(signupPassword);

  const pwChecks = [
    { label: "10+ characters", pass: signupPassword.length >= 10 },
    { label: "Uppercase", pass: /[A-Z]/.test(signupPassword) },
    { label: "Lowercase", pass: /[a-z]/.test(signupPassword) },
    { label: "Number", pass: /[0-9]/.test(signupPassword) },
    { label: "Symbol", pass: /[^A-Za-z0-9]/.test(signupPassword) },
  ];
  const pwScore = pwChecks.filter((c) => c.pass).length;
  const pwColor = pwScore <= 1 ? "#ef4444" : pwScore <= 2 ? "#f97316" : pwScore <= 3 ? "#eab308" : pwScore <= 4 ? "#84cc16" : "#22c55e";
  const pwLabel = pwScore <= 1 ? "Weak" : pwScore <= 2 ? "Fair" : pwScore <= 3 ? "Moderate" : pwScore <= 4 ? "Good" : "Strong";

  const onLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    try {
      const normalizedEmail = loginEmail.trim().toLowerCase();
      const captchaToken = await executeRecaptcha("login");
      await login(normalizedEmail, loginPassword, captchaToken);
      const me = await api.get<{ role: string }>("/user/me");
      const role = me.data.role;
      const isVenueRole = role === "BUSINESS" || role === "VENUE_OWNER" || role === "ADMIN" || role === "SUPER_ADMIN";
      if (accountType === "venue" && !isVenueRole) {
        await logout();
        setFormError("This account is not a business account.");
        return;
      }
      if (nextPath) { router.push(nextPath); return; }
      router.push(isVenueRole ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setFormError(message);
    }
  };

  const onSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (accountType === "venue") { router.push("/for-venues/register"); return; }
    if (!signupName.trim()) { setFormError("Please enter your full name."); return; }
    if (!passwordStrong) { setFormError("Password must include uppercase, lowercase, number, and symbol."); return; }
    if (signupPassword !== signupPasswordConfirm) { setFormError("Passwords do not match."); return; }
    if (!signupAccepted) { setFormError("You must accept Terms and Privacy."); return; }
    try {
      const normalizedEmail = signupEmail.trim().toLowerCase();
      const normalizedName = signupName.trim();
      const registerCaptchaToken = await executeRecaptcha("register");
      await register(normalizedEmail, signupPassword, normalizedName, registerCaptchaToken);
      setFormSuccess("Account created. Signing you in...");
      const loginCaptchaToken = await executeRecaptcha("login");
      await login(normalizedEmail, signupPassword, loginCaptchaToken);
      setFormSuccess("Account created successfully.");
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      setFormError(message);
    }
  };

  const errorMsg = formError || authError;

  return (
    <div
      className="matchwatch-login-page"
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
      {/* ===== LEFT PANE — FORM ===== */}
      <div
        className="matchwatch-login-card"
        style={{
          width: "100%",
          maxWidth: 460,
          display: "flex",
          flexDirection: "column",
          padding: "40px 36px",
          position: "relative",
          zIndex: 10,
          border: "1px solid var(--border)",
          borderRadius: 20,
          backgroundColor: "var(--card)",
          boxShadow: "0 24px 70px color-mix(in oklch, var(--foreground) 14%, transparent)",
        }}
      >
        {/* Brand */}
        <Link href="/" style={{ textDecoration: "none", marginBottom: 32, display: "inline-block" }}>
          <span style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 900, fontSize: 24, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            matchwatch<span style={{ color: "var(--primary)" }}>.</span>
          </span>
        </Link>

        {/* Heading */}
        <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 36, fontWeight: 800, marginBottom: 8, lineHeight: 1.1 }}>
          {authTab === "signin" ? "Welcome back" : "Create an account"}
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 28 }}>
          Enter your credentials to access your account.
        </p>

        {/* Account Type Toggle */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 4, borderRadius: 12, backgroundColor: "var(--secondary)", marginBottom: 24, border: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={() => { setAccountType("fan"); setFormError(null); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 14, fontFamily: "inherit",
              backgroundColor: accountType === "fan" ? "var(--primary)" : "transparent",
              color: accountType === "fan" ? "var(--primary-foreground)" : "var(--muted-foreground)",
              transition: "all 0.2s",
            }}
          >
            <Users size={16} /> Fan
          </button>
          <button
            type="button"
            onClick={() => { setAccountType("venue"); setFormError(null); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 14, fontFamily: "inherit",
              backgroundColor: accountType === "venue" ? "var(--primary)" : "transparent",
              color: accountType === "venue" ? "var(--primary-foreground)" : "var(--muted-foreground)",
              transition: "all 0.2s",
            }}
          >
            <Building2 size={16} /> Business
          </button>
        </div>

        {/* Error / Success */}
        {errorMsg && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderRadius: 12, backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", marginBottom: 20, fontSize: 14, color: "#ef4444" }}>
            <CircleAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} /> {errorMsg}
          </div>
        )}
        {formSuccess && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderRadius: 12, backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", marginBottom: 20, fontSize: 14, color: "#22c55e" }}>
            <CircleCheckBig size={18} style={{ flexShrink: 0, marginTop: 2 }} /> {formSuccess}
          </div>
        )}

        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid var(--border)" }}>
          <button
            onClick={() => setAuthTab("signin")}
            style={{
              flex: 1, padding: "12px 0", border: "none", background: "transparent",
              fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
              color: authTab === "signin" ? "var(--foreground)" : "var(--muted-foreground)",
              borderBottom: authTab === "signin" ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -2, transition: "all 0.2s",
            }}
          >
            Log In
          </button>
          <button
            onClick={() => setAuthTab("signup")}
            style={{
              flex: 1, padding: "12px 0", border: "none", background: "transparent",
              fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
              color: authTab === "signup" ? "var(--foreground)" : "var(--muted-foreground)",
              borderBottom: authTab === "signup" ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -2, transition: "all 0.2s",
            }}
          >
            Sign Up
          </button>
        </div>

        {/* SIGN IN FORM */}
        {authTab === "signin" && (
          <form onSubmit={onLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--foreground)" }}>Email address</label>
              <div style={{ position: "relative" }}>
                <Mail size={18} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted-foreground)", pointerEvents: "none" }} />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  style={{
                    width: "100%", height: 48, paddingLeft: 42, paddingRight: 16, fontSize: 15,
                    borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--background)",
                    color: "var(--foreground)", outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Password</label>
                <Link href="/account" style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>Need help?</Link>
              </div>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted-foreground)", pointerEvents: "none" }} />
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  style={{
                    width: "100%", height: 48, paddingLeft: 42, paddingRight: 16, fontSize: 15,
                    borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--background)",
                    color: "var(--foreground)", outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--muted-foreground)", cursor: "pointer" }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--primary)" }} />
              Remember this device
            </label>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%", height: 48, borderRadius: 12, border: "none", cursor: "pointer",
                backgroundColor: "var(--primary)", color: "var(--primary-foreground)",
                fontWeight: 700, fontSize: 15, fontFamily: "inherit",
                opacity: isLoading ? 0.7 : 1, transition: "all 0.2s",
              }}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
            {recaptchaEnabled ? (
              <p style={{ marginTop: -6, fontSize: 12, color: "var(--muted-foreground)" }}>
                Protected by Google reCAPTCHA.
              </p>
            ) : null}
          </form>
        )}

        {/* SIGN UP FORM */}
        {authTab === "signup" && (
          <>
            {accountType === "venue" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 32, textAlign: "center", borderRadius: 16, border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Building2 size={28} style={{ color: "var(--primary)" }} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8, fontFamily: "var(--font-display), sans-serif" }}>Venue Onboarding</h3>
                <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 20, lineHeight: 1.6 }}>
                  Business accounts require business details, location data, and branding verification.
                </p>
                <button
                  onClick={() => router.push("/for-venues/register")}
                  style={{
                    width: "100%", height: 44, borderRadius: 12, border: "none", cursor: "pointer",
                    backgroundColor: "var(--primary)", color: "var(--primary-foreground)",
                    fontWeight: 700, fontSize: 14, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  Continue to Registration <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <form onSubmit={onSignup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Full name</label>
                    <input placeholder="John Doe" value={signupName} onChange={(e) => setSignupName(e.target.value)} required
                      style={{ width: "100%", height: 44, padding: "0 14px", fontSize: 14, borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)", outline: "none", fontFamily: "inherit" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Email</label>
                    <input type="email" placeholder="you@example.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required
                      style={{ width: "100%", height: 44, padding: "0 14px", fontSize: 14, borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)", outline: "none", fontFamily: "inherit" }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Password</label>
                  <input type="password" placeholder="10+ characters, complex" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required
                    style={{ width: "100%", height: 44, padding: "0 14px", fontSize: 14, borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)", outline: "none", fontFamily: "inherit" }} />
                  {/* Password Strength Bar */}
                  {signupPassword.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: pwColor }}>{pwLabel}</span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{pwScore}/5</span>
                      </div>
                      <div style={{ width: "100%", height: 6, borderRadius: 99, backgroundColor: "var(--border)", overflow: "hidden" }}>
                        <div style={{ width: `${(pwScore / 5) * 100}%`, height: "100%", borderRadius: 99, backgroundColor: pwColor, transition: "all 0.3s ease" }} />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {pwChecks.map((c) => (
                          <span key={c.label} style={{
                            fontSize: 11, padding: "3px 8px", borderRadius: 6,
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
                  <input type="password" placeholder="Repeat your password" value={signupPasswordConfirm} onChange={(e) => setSignupPasswordConfirm(e.target.value)} required
                    style={{ width: "100%", height: 44, padding: "0 14px", fontSize: 14, borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)", outline: "none", fontFamily: "inherit" }} />
                </div>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--muted-foreground)", cursor: "pointer", lineHeight: 1.5 }}>
                  <input type="checkbox" checked={signupAccepted} onChange={(e) => setSignupAccepted(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--primary)", marginTop: 2, flexShrink: 0 }} />
                  <span>I agree to the <Link href="/terms" style={{ fontWeight: 600, color: "var(--foreground)" }}>Terms</Link> and <Link href="/privacy" style={{ fontWeight: 600, color: "var(--foreground)" }}>Privacy Policy</Link>.</span>
                </label>
                <button type="submit" disabled={isLoading}
                  style={{ width: "100%", height: 48, borderRadius: 12, border: "none", cursor: "pointer", backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, fontSize: 15, fontFamily: "inherit", opacity: isLoading ? 0.7 : 1 }}>
                  {isLoading ? "Creating account..." : "Create Account"}
                </button>
                {recaptchaEnabled ? (
                  <p style={{ marginTop: -4, fontSize: 12, color: "var(--muted-foreground)" }}>
                    Protected by Google reCAPTCHA.
                  </p>
                ) : null}
              </form>
            )}
          </>
        )}
      </div>

      {/* ===== RIGHT PANE — IMAGE ===== */}
      <div
        style={{
          flex: "1 1 560px",
          maxWidth: 760,
          minWidth: 460,
          position: "relative",
          display: "none",
          backgroundColor: "#000",
          overflow: "hidden",
        }}
        className="matchwatch-login-hero"
      >
        <Image
          src="/assets/login-hero.png"
          alt="Fans watching a match"
          fill
          priority
          style={{ objectFit: "cover", opacity: 0.85 }}
          sizes="60vw"
        />
        {/* Gradient overlays */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent 50%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, var(--card) 0%, transparent 20%)" }} />

        {/* Floating card */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 40,
            right: 40,
            padding: 28,
            borderRadius: 24,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.1)",
            zIndex: 10,
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <UserPlus size={24} style={{ color: "var(--primary-foreground)" }} />
          </div>
          <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "clamp(28px, 2.4vw, 38px)", fontWeight: 800, color: "#fff", marginBottom: 12, lineHeight: 1.12 }}>
            Join the action. Never miss a moment.
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
            MatchWatch is the ultimate network for football fans. Find the best venues hosting the biggest games in your city.
          </p>
        </div>
      </div>
    </div>
  );
}
