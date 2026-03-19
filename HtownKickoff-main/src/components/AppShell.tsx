"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LogIn, Menu, Store, Trophy, UserCircle2, X } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { ThemeToggle } from "./ThemeToggle";

/* ═══════════════════════════════════════════════════
   FLOATING PILL NAVIGATION (Desktop & Mobile Unified)
   ═══════════════════════════════════════════════════ */
export function FloatingNav() {
    const pathname = usePathname();
    const { isAuthenticated, user, logout } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const dashboardHref =
        user?.role === "BUSINESS" || user?.role === "VENUE_OWNER" ? "/admin"
        : user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? "/admin"
        : "/account";
    const avatarUrl = (user?.avatarUrl || "").trim();

    const navLinks = [
        { label: "Matches", href: "/matches", icon: Trophy },
        { label: "Venues", href: "/venues", icon: Store },
    ];

    return (
        <div
            style={{
                position: "fixed",
                top: 0, left: 0, right: 0,
                zIndex: 50,
                display: "flex",
                justifyContent: "center",
                padding: "16px 24px 8px",
                pointerEvents: "none",
            }}
        >
            {/* The Pill */}
            <nav
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pointerEvents: "auto",
                    borderRadius: 999,
                    width: "100%",
                    maxWidth: 900,
                    padding: "12px 24px",
                    transition: "all 0.5s",
                    backgroundColor: scrolled ? "color-mix(in oklch, var(--background) 70%, transparent)" : "color-mix(in oklch, var(--background) 40%, transparent)",
                    backdropFilter: scrolled ? "blur(24px)" : "blur(16px)",
                    border: `1px solid ${scrolled ? "var(--border)" : "color-mix(in oklch, var(--border) 50%, transparent)"}`,
                    boxShadow: scrolled ? "0 8px 32px rgba(0,0,0,0.12)" : "0 2px 12px rgba(0,0,0,0.06)",
                }}
            >
                {/* Logo */}
                <Link href="/" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: "-0.02em", color: "var(--foreground)", lineHeight: 1.1 }}>
                        matchwatch
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.25em", color: "var(--primary)", fontWeight: 700, textTransform: "uppercase", marginTop: -2, opacity: 0.8 }}>
                        Watchparty Hub
                    </span>
                </Link>

                {/* Desktop Links — centered absolutely */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, position: "absolute", left: "50%", transform: "translateX(-50%)" }} className="hidden md:flex">
                    {navLinks.map((link) => {
                        const isActive = pathname.startsWith(link.href);
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                style={{
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "8px 18px",
                                    borderRadius: 999,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    textDecoration: "none",
                                    color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                                    backgroundColor: isActive ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                                    transition: "all 0.2s",
                                }}
                            >
                                <link.icon size={16} style={{ color: isActive ? "var(--primary)" : "var(--muted-foreground)" }} />
                                {link.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Right Side */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="hidden sm:block">
                        <ThemeToggle />
                    </div>

                    {isAuthenticated ? (
                        <Link
                            href={dashboardHref}
                            className="hidden sm:flex"
                            style={{
                                alignItems: "center", gap: 8, padding: "6px 16px 6px 8px",
                                borderRadius: 999, fontSize: 12, fontWeight: 700, textDecoration: "none",
                                backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)",
                                border: "1px solid var(--border)", transition: "all 0.2s",
                            }}
                        >
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={user?.name || "Profile"} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                            ) : (
                                <UserCircle2 size={20} style={{ color: "var(--foreground)" }} />
                            )}
                            {user?.role === "BUSINESS" || user?.role === "VENUE_OWNER" ? (user?.name || "Business") : "Account"}
                        </Link>
                    ) : (
                        <Link
                            href="/login"
                            className="hidden sm:flex"
                            style={{
                                alignItems: "center", gap: 6, padding: "8px 20px",
                                borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: "none",
                                backgroundColor: "var(--primary)", color: "var(--primary-foreground)",
                                transition: "all 0.2s",
                            }}
                        >
                            Log In
                        </Link>
                    )}

                    {/* Mobile Menu Toggle */}
                    <button
                        className="md:hidden"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        style={{
                            padding: 8, marginRight: -8, borderRadius: 999,
                            border: "none", backgroundColor: "transparent", color: "var(--foreground)",
                            cursor: "pointer",
                        }}
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Dropdown */}
            {mobileMenuOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        left: 16, right: 16,
                        backgroundColor: "color-mix(in oklch, var(--background) 95%, transparent)",
                        backdropFilter: "blur(24px)",
                        border: "1px solid var(--border)",
                        borderRadius: 16, padding: 16,
                        display: "flex", flexDirection: "column", gap: 8,
                        boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
                        pointerEvents: "auto",
                    }}
                    className="md:hidden"
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 8px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted-foreground)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Navigation</span>
                        <ThemeToggle />
                    </div>
                    {[
                        { label: "Home", href: "/", icon: House },
                        ...navLinks,
                        ...(isAuthenticated
                            ? [{ label: "Dashboard", href: dashboardHref, icon: UserCircle2 }]
                            : [{ label: "Log In", href: "/login", icon: LogIn }])
                    ].map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMobileMenuOpen(false)}
                            style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "12px 16px", borderRadius: 12,
                                backgroundColor: "color-mix(in oklch, var(--secondary) 50%, transparent)",
                                color: "var(--foreground)", fontWeight: 600, fontSize: 14,
                                textDecoration: "none", transition: "all 0.2s",
                            }}
                        >
                            <link.icon size={18} style={{ color: "var(--primary)" }} />
                            {link.label}
                        </Link>
                    ))}
                    {isAuthenticated && (
                        <button
                            onClick={() => { logout(); setMobileMenuOpen(false); }}
                            style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "12px 16px", marginTop: 8, borderRadius: 12,
                                border: "1px solid color-mix(in oklch, var(--destructive) 30%, transparent)",
                                backgroundColor: "transparent", color: "var(--destructive)",
                                fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                            }}
                        >
                            Log Out
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   APP SHELL  (wraps everything)
   ═══════════════════════════════════════════════════ */
export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div suppressHydrationWarning style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", backgroundColor: "var(--background)", fontFamily: "var(--font-body), system-ui, sans-serif" }}>
            <FloatingNav />
            {/* Top padding accounts for the fixed floating nav pill */}
            <main style={{ flex: 1, paddingTop: 96, paddingBottom: 48, overflowX: "hidden" }}>
                {children}
            </main>
        </div>
    );
}
