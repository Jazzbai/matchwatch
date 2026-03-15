"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LogIn, ShieldCheck, Store, Trophy, UserCircle2 } from "lucide-react";
import { useAuth } from "../lib/auth-context";

/* ═══════════════════════════════════════════════════
   THEME PROVIDER (light only — no toggle)
   ═══════════════════════════════════════════════════ */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    return <div data-theme="light">{children}</div>;
}

/* ═══════════════════════════════════════════════════
   TOP HEADER BAR
   ═══════════════════════════════════════════════════ */
export function TopBar() {
    const { isAuthenticated, user, logout } = useAuth();
    const dashboardHref =
        user?.role === "VENUE_OWNER"
            ? "/admin"
            : user?.role === "ADMIN" || user?.role === "SUPER_ADMIN"
                ? "/admin"
                : "/account";
    const avatarUrl = (user?.avatarUrl || "").trim();

    return (
        <header
            className="glass-panel topbar"
            style={{
                position: "sticky",
                top: 0,
                zIndex: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 20px",
                borderBottom: "1px solid var(--border)",
            }}
        >
            {/* Logo — links to Home */}
            <Link
                href="/"
                className="topbar-brand"
                style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center" }}
                aria-label="MatchWatch Home"
            >
                <div
                    className="font-display"
                style={{
                    fontSize: "1.32rem",
                    letterSpacing: "0.04em",
                    lineHeight: 1,
                    color: "var(--accent-primary)",
                }}
            >
                    matchwatch.us
                </div>
                <div
                    className="font-display"
                    style={{
                        fontSize: "0.62rem",
                        letterSpacing: "0.18em",
                        color: "var(--text-secondary)",
                        marginTop: "2px",
                    }}
                >
                    LIVE MATCH HUB
                </div>
            </Link>

            {/* Quick nav links (desktop) */}
            <nav className="topbar-nav" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Link href="/matches" className="btn-ghost" style={{ textDecoration: "none" }}>
                    Matches
                </Link>
                <Link href="/venues" className="btn-ghost" style={{ textDecoration: "none" }}>
                    Venues
                </Link>
                <Link href="/reserve" className="btn-ghost" style={{ textDecoration: "none" }}>
                    Reserve
                </Link>
                <Link href="/for-venues" className="btn-ghost" style={{ textDecoration: "none" }}>
                    For Venues
                </Link>
            </nav>

            <div className="topbar-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {isAuthenticated ? (
                    <>
                        <Link
                            href={dashboardHref}
                            className="btn-ghost"
                            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}
                        >
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt={user?.name || "Profile"}
                                    style={{ width: "24px", height: "24px", borderRadius: "999px", objectFit: "cover", border: "1px solid var(--border)" }}
                                />
                            ) : (
                                <UserCircle2 size={16} />
                            )}
                            {user?.role === "VENUE_OWNER" ? "Venue" : "Account"}
                        </Link>
                        <button
                            onClick={() => void logout()}
                            className="btn-ghost"
                        >
                            Log Out
                        </button>
                    </>
                ) : (
                    <>
                        <Link
                            href="/login"
                            className="btn-ghost"
                            style={{ textDecoration: "none" }}
                        >
                            Log In
                        </Link>
                        <Link
                            href="/signup"
                            className="btn-primary"
                            style={{ textDecoration: "none" }}
                        >
                            Sign Up
                        </Link>
                    </>
                )}
            </div>
        </header>
    );
}

/* ═══════════════════════════════════════════════════
   BOTTOM TAB BAR  (Mobile Navigation — real links)
   ═══════════════════════════════════════════════════ */
export function BottomTabBar() {
    const pathname = usePathname();
    const { isAuthenticated, user } = useAuth();
    const dashboardHref =
        user?.role === "VENUE_OWNER"
            ? "/admin"
            : user?.role === "ADMIN" || user?.role === "SUPER_ADMIN"
                ? "/admin"
                : "/account";
    const tabs = [
        { id: "home", label: "Home", icon: House, href: "/" },
        { id: "matches", label: "Matches", icon: Trophy, href: "/matches" },
        { id: "venues", label: "Venues", icon: Store, href: "/venues" },
        ...(isAuthenticated
            ? [{
                id: "account",
                label: user?.role === "VENUE_OWNER" ? "Venue" : "Account",
                icon: user?.role === "VENUE_OWNER" ? Store : UserCircle2,
                href: dashboardHref,
            }]
            : [{ id: "login", label: "Login", icon: LogIn, href: "/login" }]),
        ...(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN"
            ? [{ id: "admin", label: "Admin", icon: ShieldCheck, href: "/admin" }]
            : []),
    ] as const;

    return (
        <nav
            className="glass-panel"
            style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 40,
                display: "flex",
                justifyContent: "space-around",
                padding: "6px 0 max(env(safe-area-inset-bottom, 8px), 8px)",
                borderTop: "1px solid var(--border)",
            }}
        >
            {tabs.map((tab) => {
                const isActive =
                    tab.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(tab.href);
                return (
                    <Link
                        key={tab.id}
                        href={tab.href}
                        aria-label={tab.label}
                        aria-current={isActive ? "page" : undefined}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "2px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px 12px",
                            borderRadius: "10px",
                            transition: "all 0.2s ease",
                            color: isActive
                                ? "var(--accent-primary)"
                                : "var(--text-muted)",
                            textDecoration: "none",
                        }}
                    >
                        <tab.icon
                            size={19}
                            strokeWidth={isActive ? 2.3 : 1.9}
                            style={{
                                transition: "transform 0.2s ease",
                                transform: isActive ? "scale(1.08)" : "scale(1)",
                            }}
                        />
                        <span
                            className="font-body"
                            style={{
                                fontSize: "0.625rem",
                                fontWeight: isActive ? 700 : 500,
                                letterSpacing: "0.02em",
                            }}
                        >
                            {tab.label}
                        </span>
                        {isActive && (
                            <span
                                style={{
                                    width: "4px",
                                    height: "4px",
                                    borderRadius: "50%",
                                    background: "var(--accent-primary)",
                                    marginTop: "1px",
                                }}
                            />
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}

/* ═══════════════════════════════════════════════════
   APP SHELL  (wraps everything)
   ═══════════════════════════════════════════════════ */
export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                minHeight: "100dvh",
                display: "flex",
                flexDirection: "column",
                background: "var(--bg-primary)",
            }}
        >
            <TopBar />
            <main style={{ flex: 1, paddingBottom: "80px" }}>{children}</main>
            <BottomTabBar />
        </div>
    );
}
