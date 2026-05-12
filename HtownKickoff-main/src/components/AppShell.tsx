"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, House, LogIn, LogOut, Menu, Store, Trophy, UserCircle2, X } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { ThemeToggle } from "./ThemeToggle";

export function FloatingNav() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const dashboardHref =
    user?.role === "BUSINESS" || user?.role === "VENUE_OWNER"
      ? "/admin"
      : user?.role === "ADMIN" || user?.role === "SUPER_ADMIN"
        ? "/admin"
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
    <div className="site-nav-wrap">
      <nav
        className={`site-nav${scrolled ? " site-nav--scrolled" : ""}`}
        aria-label="Primary navigation"
      >
        <Link href="/" aria-label="MatchWatch home" className="site-nav__logo">
          <img src="/logo.svg" alt="MatchWatch" className="site-nav__logo-img" />
        </Link>

        <div className="site-nav__links">
          {navLinks.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="site-nav__link"
                data-active={isActive ? "true" : "false"}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="site-nav__actions">
          <div className="site-nav__desktop-only">
            <ThemeToggle />
          </div>

          {isAuthenticated ? (
            <Link href={dashboardHref} className="site-nav__account">
              {avatarUrl ? (
                <img src={avatarUrl} alt={user?.name || "Profile"} className="site-nav__avatar" />
              ) : (
                <UserCircle2 size={18} />
              )}
              <span className="site-nav__account-label">
                {user?.role === "BUSINESS" || user?.role === "VENUE_OWNER" ? user?.name || "Business" : "Account"}
              </span>
            </Link>
          ) : (
            <div className="site-nav__auth">
              <Link href="/login" className="site-nav__auth-link">
                Sign in
              </Link>
              <Link href="/for-venues/register" className="site-nav__cta">
                <Building2 size={14} />
                List your venue
              </Link>
            </div>
          )}

          <button
            type="button"
            className="site-nav__menu-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-primary-navigation"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div id="mobile-primary-navigation" className="site-nav__mobile-menu">
          <div className="site-nav__mobile-head">
            <span>Navigation</span>
            <ThemeToggle />
          </div>
          {[
            ...navLinks,
            ...(isAuthenticated
              ? [{ label: "Dashboard", href: dashboardHref, icon: UserCircle2 }]
              : [
                  { label: "Sign In", href: "/login", icon: LogIn },
                  { label: "List Your Venue", href: "/for-venues/register", icon: Building2 },
                ]),
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="site-nav__mobile-link"
            >
              <link.icon size={18} />
              {link.label}
            </Link>
          ))}
          {isAuthenticated && (
            <button
              type="button"
              className="site-nav__logout"
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
            >
              <LogOut size={18} />
              Log Out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell" suppressHydrationWarning>
      <FloatingNav />
      <main className="app-shell__main">{children}</main>
    </div>
  );
}
