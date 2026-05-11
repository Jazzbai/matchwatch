"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, House, LogIn, Menu, Store, Trophy, UserCircle2, X } from "lucide-react";
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
    const [isMobile, setIsMobile] = useState(false);
    const [compactNav, setCompactNav] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const media = window.matchMedia("(max-width: 767px)");
        const compactMedia = window.matchMedia("(max-width: 1120px)");
        const update = () => {
            const mobile = media.matches;
            setIsMobile(mobile);
            setCompactNav(compactMedia.matches && !mobile);
            if (!mobile) {
                setMobileMenuOpen(false);
            }
        };

        update();
        media.addEventListener("change", update);
        compactMedia.addEventListener("change", update);
        return () => {
            media.removeEventListener("change", update);
            compactMedia.removeEventListener("change", update);
        };
    }, []);

    const dashboardHref =
        user?.role === "BUSINESS" || user?.role === "VENUE_OWNER" ? "/admin"
        : user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? "/admin"
        : "/account";
    const avatarUrl = (user?.avatarUrl || "").trim();

    const navLinks = [
        { label: "Home", href: "/", icon: House },
        { label: "Matches", href: "/matches", icon: Trophy },
        { label: "World Cup", href: "/world-cup", icon: Trophy },
        { label: "Venues", href: "/venues", icon: Store },
        { label: "For venues", href: "/for-venues", icon: Building2 },
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
                    display: "grid",
                    gridTemplateColumns: isMobile ? "minmax(0, 1fr) auto" : "auto minmax(0, 1fr) auto",
                    alignItems: "center",
                    columnGap: isMobile ? 10 : 18,
                    pointerEvents: "auto",
                    borderRadius: 999,
                    width: "100%",
                    maxWidth: isMobile ? "calc(100vw - 16px)" : 1160,
                    padding: isMobile ? "10px 14px" : "10px 16px",
                    transition: "all 0.5s",
                    backgroundColor: scrolled ? "color-mix(in oklch, var(--background) 70%, transparent)" : "color-mix(in oklch, var(--background) 40%, transparent)",
                    backdropFilter: scrolled ? "blur(24px)" : "blur(16px)",
                    border: `1px solid ${scrolled ? "var(--border)" : "color-mix(in oklch, var(--border) 50%, transparent)"}`,
                    boxShadow: scrolled ? "0 8px 32px rgba(0,0,0,0.12)" : "0 2px 12px rgba(0,0,0,0.06)",
                }}
            >
                {/* Logo */}
                <Link href="/" aria-label="MatchWatch home" style={{ textDecoration: "none", display: "flex", alignItems: "center", minWidth: 0 }}>
                    <img
                        src="/logo.svg"
                        alt="MatchWatch"
                        style={{
                            display: "block",
                            width: isMobile ? 118 : 148,
                            height: "auto",
                            maxHeight: isMobile ? 36 : 44,
                            objectFit: "contain",
                        }}
                    />
                </Link>

                {/* Desktop Links — centered absolutely */}
                <div
                    style={{
                        display: isMobile ? "none" : "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 3,
                        minWidth: 0,
                        overflow: "hidden",
                    }}
                >
                    {navLinks.map((link) => {
                        const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                style={{
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: compactNav ? 6 : 8,
                                    padding: compactNav ? "8px 11px" : "8px 14px",
                                    borderRadius: 999,
                                    fontSize: compactNav ? 13 : 14,
                                    fontWeight: 600,
                                    textDecoration: "none",
                                    color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                                    backgroundColor: isActive ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                                    transition: "all 0.2s",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                <link.icon size={compactNav ? 15 : 16} style={{ color: isActive ? "var(--primary)" : "var(--muted-foreground)", flexShrink: 0 }} />
                                {link.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Right Side */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: isMobile ? 8 : 10, minWidth: 0 }}>
                    <div style={{ display: isMobile ? "none" : "block" }}>
                        <ThemeToggle />
                    </div>

                    {isAuthenticated ? (
                        <Link
                            href={dashboardHref}
                            style={{
                                display: isMobile ? "none" : "flex",
                                alignItems: "center", gap: 8, padding: compactNav ? "6px 10px 6px 8px" : "6px 14px 6px 8px",
                                borderRadius: 999, fontSize: 12, fontWeight: 700, textDecoration: "none",
                                backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)",
                                border: "1px solid var(--border)", transition: "all 0.2s",
                                maxWidth: compactNav ? 132 : 180,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                            }}
                        >
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={user?.name || "Profile"} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                            ) : (
                                <UserCircle2 size={20} style={{ color: "var(--foreground)" }} />
                            )}
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                {user?.role === "BUSINESS" || user?.role === "VENUE_OWNER" ? (user?.name || "Business") : "Account"}
                            </span>
                        </Link>
                    ) : (
                        <div style={{ display: isMobile ? "none" : "flex", alignItems: "center", gap: 8 }}>
                            <Link
                                href="/login"
                                style={{
                                    fontSize: 13, fontWeight: 600, textDecoration: "none",
                                    color: "var(--muted-foreground)", padding: compactNav ? "8px 8px" : "8px 10px",
                                    borderRadius: 999, transition: "all 0.2s",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Sign in
                            </Link>
                            <Link
                                href="/for-venues/register"
                                style={{
                                    display: "flex", alignItems: "center", gap: 6, padding: compactNav ? "8px 12px" : "8px 16px",
                                    borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: "none",
                                    backgroundColor: "#F97316", color: "#ffffff",
                                    transition: "all 0.2s",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                <Building2 size={14} />
                                List your venue
                            </Link>
                        </div>
                    )}

                    {/* Mobile Menu Toggle */}
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        style={{
                            display: isMobile ? "inline-flex" : "none",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 8, marginRight: -4, borderRadius: 999,
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
                        ...navLinks,
                        ...(isAuthenticated
                            ? [{ label: "Dashboard", href: dashboardHref, icon: UserCircle2 }]
                            : [
                                { label: "Sign In", href: "/login", icon: LogIn },
                                { label: "List Your Venue", href: "/for-venues/register", icon: Building2 },
                              ])
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
