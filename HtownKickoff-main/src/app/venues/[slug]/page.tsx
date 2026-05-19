"use client";

import React, { use, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingDrawer } from "../../../components/BookingDrawer";
import { AMENITY_LABELS, PRICE_LABELS } from "../../../lib/data";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useData } from "../../../lib/data-provider";
import { getLeagueVisual, getMatchDisplay } from "../../../lib/match-display";
import { FloatingNav } from "../../../components/AppShell";

/* ── types ── */
type VenueMenuCategory = {
    id: string;
    name: string;
    items: Array<{
        id: string;
        name: string;
        description?: string | null;
        price: string | number;
        isAvailable: boolean;
        isFeatured?: boolean | null;
        dietaryTags?: string[] | null;
    }>;
};
type VenueCustomEvent = {
    id: string;
    title: string;
    description?: string | null;
    eventTypeTags: string[];
    startsAt: string;
    endsAt: string;
    imageUrl?: string | null;
    bookingNotes?: string | null;
};
type VenueFanTeam = {
    id: string;
    slug: string;
    name: string;
    shortName?: string | null;
    crestUrl?: string | null;
    shortDescription?: string | null;
    league?: { id: string; slug: string; name: string; shortName?: string | null } | null;
};
type ActiveTab = "overview" | "menu" | "google-reviews" | "reviews" | "posts";

/* ── CSS ── */
const VP_VARS = `
:root{
  --vp-bg:var(--background);--vp-bg-1:var(--card);--vp-bg-2:var(--card);--vp-bg-3:var(--secondary);
  --vp-line:var(--border);--vp-line-2:var(--border);
  --vp-fg:var(--foreground);--vp-fg-dim:var(--muted-foreground);--vp-fg-mute:var(--muted-foreground);
  --vp-accent:oklch(0.72 0.19 28);--vp-accent-ink:#0a0b0d;
}
`;
const VP_CSS = `
*{box-sizing:border-box;}
body{background:var(--vp-bg)!important;color:var(--vp-fg)!important;overflow-x:hidden;}
.vp-wrap{min-height:100vh;background:var(--vp-bg);overflow-x:hidden;max-width:100vw;}
/* topbar (hidden — using FloatingNav) */
.vp-topbar{display:none!important;}
/* hero */
.vp-hero{position:relative;height:420px;overflow:hidden;width:100%;}
.vp-hero-img{width:100%;height:100%;object-fit:cover;display:block;}
.vp-hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.2) 0%,rgba(10,11,13,0.7) 60%,rgba(10,11,13,0.97) 100%);}
.vp-hero-content{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:20px 24px 24px;}
.vp-hero-top{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.vp-back{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--vp-fg-dim);text-decoration:none;padding:7px 14px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.3);backdrop-filter:blur(8px);transition:all .14s;white-space:nowrap;}
.vp-back:hover{color:var(--vp-fg);border-color:rgba(255,255,255,0.3);}
.vp-follow{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;padding:7px 14px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);backdrop-filter:blur(8px);color:var(--vp-fg-dim);cursor:pointer;transition:all .14s;white-space:nowrap;}
.vp-follow:hover,.vp-follow.on{border-color:var(--vp-accent);color:var(--vp-accent);}
.vp-hero-body{display:flex;flex-direction:column;gap:8px;}
.vp-badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:2px;}
.vp-badge{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;padding:3px 8px;border:1px solid var(--vp-accent);color:var(--vp-accent);}
.vp-venue-name{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:clamp(22px,5vw,52px);line-height:1.05;letter-spacing:-0.02em;margin:0;color:var(--vp-fg);word-break:break-word;}
.vp-venue-sub{font-size:13px;color:var(--vp-fg-dim);margin:0;max-width:560px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.vp-hero-stats{display:flex;gap:12px;flex-wrap:wrap;}
.vp-stat{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.06em;color:var(--vp-fg-dim);display:flex;align-items:center;gap:5px;white-space:nowrap;}
.vp-stat b{color:var(--vp-fg);font-size:13px;}
.vp-stat .accent{color:var(--vp-accent);}
/* gallery */
.vp-gallery{display:flex;gap:2px;height:90px;overflow-x:auto;scrollbar-width:none;width:100%;max-width:100vw;}
.vp-gallery::-webkit-scrollbar{display:none;}
.vp-gallery-item{flex-shrink:0;width:130px;cursor:pointer;overflow:hidden;position:relative;}
.vp-gallery-item:hover .vp-gallery-img{transform:scale(1.06);}
.vp-gallery-img{width:100%;height:100%;object-fit:cover;transition:transform .2s;}
/* crumb */
.vp-crumb{padding:12px 20px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;color:var(--vp-fg-mute);text-transform:uppercase;border-bottom:1px solid var(--vp-line);display:flex;align-items:center;gap:6px;overflow:hidden;min-width:0;}
.vp-crumb a{color:var(--vp-fg-mute);text-decoration:none;white-space:nowrap;flex-shrink:0;}.vp-crumb a:hover{color:var(--vp-fg);}
.vp-crumb .sep{color:var(--vp-line-2);flex-shrink:0;}
.vp-crumb-current{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--vp-fg-dim);}
/* tabs */
.vp-tabs{display:flex;gap:0;border-bottom:1px solid var(--vp-line);padding:0 20px;overflow-x:auto;scrollbar-width:none;}
.vp-tabs::-webkit-scrollbar{display:none;}
.vp-tab{border-radius:12px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;padding:14px 14px;color:var(--vp-fg-mute);border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;white-space:nowrap;transition:all .14s;margin-bottom:-1px;}
.vp-tab:hover{color:var(--vp-fg);}
.vp-tab.on{color:var(--vp-fg);border-bottom-color:var(--vp-accent);}
/* layout */
.vp-page{display:grid;grid-template-columns:1fr 300px;gap:0;}
.vp-main{padding:24px 20px 80px;min-width:0;overflow-x:hidden;}
.vp-rail{border-left:1px solid var(--vp-line);padding:24px 20px;position:sticky;top:61px;height:calc(100vh - 61px);overflow-y:auto;}
/* panels */
.vp-panel{border:1px solid var(--vp-line);background:var(--vp-bg-1);padding:16px;margin-bottom:16px;}
.vp-panel-title{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:16px;margin:0 0 12px;color:var(--vp-fg);}
.vp-panel-sub{font-size:13px;color:var(--vp-fg-dim);line-height:1.55;margin:0;}
/* amenities */
.vp-amenity-grid{display:flex;flex-wrap:wrap;gap:8px;}
.vp-amenity{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;padding:6px 10px;border:1px solid var(--vp-line);color:var(--vp-fg-dim);}
/* cuisine chips */
.vp-chip-row{display:flex;gap:8px;flex-wrap:wrap;}
.vp-chip{border-radius:999px;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;padding:5px 10px;border:1px solid var(--vp-line-2);color:var(--vp-fg-dim);}
/* facts — 4 col desktop, 2 col mobile */
.vp-facts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;border:1px solid var(--vp-line);}
.vp-fact{padding:14px 10px;background:var(--vp-bg-2);text-align:center;min-width:0;}
.vp-fact-val{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:700;font-size:22px;color:var(--vp-fg);display:block;}
.vp-fact-lbl{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--vp-fg-mute);margin-top:4px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
/* hours */
.vp-hours{display:flex;flex-direction:column;gap:8px;}
.vp-hours-row{display:flex;justify-content:space-between;font-size:13px;padding-bottom:8px;border-bottom:1px dashed var(--vp-line);}
.vp-hours-row:last-child{border-bottom:0;}
.vp-hours-day{color:var(--vp-fg-dim);}
/* contact */
.vp-info-row{font-size:13px;color:var(--vp-fg-dim);margin:0 0 8px;line-height:1.4;word-break:break-word;}
.vp-map-link{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:var(--vp-accent);text-decoration:none;display:inline-block;margin-top:8px;}
.vp-map-link:hover{color:var(--vp-fg);}
/* menu */
.vp-menu-cat{margin-bottom:24px;}
.vp-menu-cat-title{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:14px;color:var(--vp-fg-mute);text-transform:uppercase;letter-spacing:0.08em;padding-bottom:10px;border-bottom:1px solid var(--vp-line);margin-bottom:12px;}
.vp-menu-item{border-radius:12px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px dashed var(--vp-line);}
.vp-menu-item:last-child{border-bottom:0;}
.vp-menu-name{font-size:14px;font-weight:500;color:var(--vp-fg);}
.vp-menu-desc{font-size:12px;color:var(--vp-fg-dim);margin-top:3px;line-height:1.4;}
.vp-menu-price{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:13px;font-weight:600;color:var(--vp-accent);white-space:nowrap;flex-shrink:0;}
.vp-menu-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;}
.vp-menu-tag{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:9px;letter-spacing:0.06em;text-transform:uppercase;padding:2px 6px;border:1px solid var(--vp-line);color:var(--vp-fg-mute);}
/* reviews */
.vp-review-card{border:1px solid var(--vp-line);background:var(--vp-bg-1);padding:16px;margin-bottom:12px;}
.vp-review-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;flex-wrap:wrap;}
.vp-review-author{font-weight:600;font-size:14px;color:var(--vp-fg);}
.vp-review-date{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--vp-fg-mute);white-space:nowrap;}
.vp-stars{color:var(--vp-accent);letter-spacing:1px;font-size:13px;}
.vp-review-text{font-size:13px;color:var(--vp-fg-dim);line-height:1.55;margin:0;word-break:break-word;}
.vp-owner-reply{margin-top:10px;padding:10px;border-left:2px solid var(--vp-accent);font-size:12px;color:var(--vp-fg-dim);font-style:italic;}
/* posts */
.vp-post-card{border-radius:12px;border:1px solid var(--vp-line);background:var(--vp-bg-1);padding:16px;margin-bottom:12px;}
.vp-post-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
.vp-post-label{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--vp-accent);}
.vp-post-date{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--vp-fg-mute);white-space:nowrap;}
.vp-post-text{font-size:13px;color:var(--vp-fg-dim);line-height:1.55;margin:0;word-break:break-word;}
/* event cards in rail */
.vp-event-row{border-radius:12px;border:1px solid var(--vp-line);background:var(--vp-bg-1);padding:12px;margin-bottom:8px;cursor:pointer;transition:border-color .14s;}
.vp-event-row:hover{border-color:var(--vp-line-2);}
.vp-event-row.sel{border-color:var(--vp-accent);}
.vp-event-meta{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--vp-fg-mute);margin-bottom:6px;display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;}
.vp-event-teams{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:14px;color:var(--vp-fg);line-height:1.25;margin-bottom:8px;word-break:break-word;}
.vp-event-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:8px;border-top:1px dashed var(--vp-line);flex-wrap:wrap;}
.vp-spots{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--vp-fg-mute);}
.vp-spots.low{color:var(--vp-accent);}
.vp-book-btn{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;padding:7px 12px;background:var(--vp-accent);color:var(--vp-accent-ink);border:none;cursor:pointer;font-weight:600;white-space:nowrap;}
/* rail */
.vp-rail h3{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:15px;margin:0 0 14px;color:var(--vp-fg);}
.vp-rail h4{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--vp-fg-mute);margin:22px 0 10px;font-weight:500;}
/* fan teams */
.vp-fan-team{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px dashed var(--vp-line);}
.vp-fan-team:last-child{border-bottom:0;}
.vp-fan-crest{width:28px;height:28px;display:grid;place-items:center;font-weight:700;font-size:11px;background:var(--vp-bg-3);color:var(--vp-fg);flex-shrink:0;}
.vp-fan-name{font-size:13px;font-weight:500;color:var(--vp-fg);}
.vp-fan-league{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;color:var(--vp-fg-mute);}
/* banner event */
.vp-banner{border:1px solid var(--vp-line);border-left:3px solid var(--vp-accent);background:linear-gradient(135deg,rgba(255,95,45,0.06),var(--vp-bg-1));padding:14px 16px;margin:12px 20px;}
.vp-banner-kicker{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--vp-accent);margin-bottom:8px;}
.vp-banner-match{font-family:'Space Grotesk',var(--font-space),sans-serif;font-weight:600;font-size:16px;color:var(--vp-fg);margin-bottom:10px;word-break:break-word;line-height:1.3;}
.vp-banner-foot{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.vp-view-link{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:var(--vp-fg-dim);text-decoration:none;padding:8px 14px;border:1px solid var(--vp-line);white-space:nowrap;}
.vp-view-link:hover{color:var(--vp-fg);border-color:var(--vp-line-2);}
.vp-reserve-btn{font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;padding:8px 16px;background:var(--vp-accent);color:var(--vp-accent-ink);border:none;cursor:pointer;font-weight:700;white-space:nowrap;}
/* empty / alert */
.vp-empty{padding:40px 0;text-align:center;font-family:'JetBrains Mono',var(--font-mono),monospace;font-size:12px;color:var(--vp-fg-mute);letter-spacing:0.1em;text-transform:uppercase;}
.vp-alert{padding:12px 16px;border:1px solid oklch(0.65 0.2 20);color:oklch(0.65 0.2 20);font-size:13px;margin:0 20px 16px;}
/* lightbox */
.vp-lightbox{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.94);display:flex;align-items:center;justify-content:center;}
.vp-lightbox-img{max-width:90vw;max-height:88vh;object-fit:contain;}
.vp-lightbox-close{position:absolute;top:20px;right:24px;font-size:24px;color:var(--vp-fg-dim);background:none;border:none;cursor:pointer;font-family:'JetBrains Mono',monospace;}
.vp-lightbox-close:hover{color:var(--vp-fg);}
.vp-lightbox-nav{position:absolute;top:50%;transform:translateY(-50%);font-size:32px;color:var(--vp-fg-dim);background:none;border:none;cursor:pointer;padding:0 16px;}
.vp-lightbox-nav:hover{color:var(--vp-fg);}
.vp-lightbox-counter{position:absolute;bottom:20px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--vp-fg-mute);}
/* no venue */
.vp-not-found{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:24px;}
/* skeleton */
.vp-skeleton{background:var(--vp-bg-1);animation:vpPulse 1.5s ease-in-out infinite;}
@keyframes vpPulse{0%,100%{opacity:1}50%{opacity:0.4}}
/* ── RESPONSIVE ── */
/* tablet */
@media(max-width:900px){
  .vp-page{grid-template-columns:1fr;}
  .vp-rail{display:none;}
  .vp-facts{grid-template-columns:repeat(2,1fr);}
  .vp-hero{height:360px;}
  .vp-hero-content{padding:16px 20px 20px;}
  .vp-main{padding:20px 20px 60px;}
  .vp-banner{margin:12px 20px;}
  .vp-tabs{padding:0 20px;}
  .vp-crumb{padding:10px 20px;}
  .vp-alert{margin:0 20px 16px;}
}
/* mobile */
@media(max-width:640px){
  .vp-hero{height:300px;}
  .vp-hero-content{padding:14px 14px 18px;}
  .vp-venue-name{font-size:clamp(20px,6vw,32px);line-height:1.1;}
  .vp-venue-sub{display:none;}
  .vp-hero-stats{gap:8px;}
  .vp-stat{font-size:10px;}
  .vp-main{padding:14px 14px 60px;}
  .vp-panel{padding:14px;}
  .vp-banner{margin:10px 14px;padding:12px 14px;}
  .vp-banner-match{font-size:14px;}
  .vp-banner-foot{flex-direction:column;align-items:stretch;}
  .vp-view-link,.vp-reserve-btn{text-align:center;display:block;width:100%;}
  .vp-tabs{padding:0 14px;}
  .vp-crumb{padding:8px 14px;font-size:10px;}
  .vp-facts{grid-template-columns:repeat(2,1fr);}
  .vp-fact{padding:12px 8px;}
  .vp-fact-val{font-size:18px;}
  .vp-alert{margin:0 14px 12px;}
  .vp-gallery{height:76px;}
  .vp-gallery-item{width:100px;}
}
/* very small phones */
@media(max-width:400px){
  .vp-hero{height:260px;}
  .vp-hero-content{padding:12px 12px 16px;}
  .vp-main{padding:12px 12px 60px;}
  .vp-panel{padding:12px;}
  .vp-banner{margin:8px 12px;padding:10px 12px;}
  .vp-tabs{padding:0 12px;}
  .vp-crumb{padding:8px 12px;}
  .vp-fact{padding:10px 6px;}
  .vp-fact-val{font-size:16px;}
  .vp-fact-lbl{font-size:8px;letter-spacing:0.06em;}
  .vp-alert{margin:0 12px 10px;}
  .vp-gallery-item{width:90px;}
}
`;

/* ── helpers ── */
function normalizeImage(value?: string | null) {
    const raw = (value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) return raw;
    return `https://${raw}`;
}

function TeamCrest({ src, fallback, alt }: { src?: string; fallback: string; alt: string }) {
    const [failed, setFailed] = useState(false);
    const normalized = normalizeImage(src);
    const useImg = Boolean(normalized) && !failed;
    return (
        <div style={{ width: 28, height: 28, display: "grid", placeItems: "center", background: "var(--vp-bg-3)", flexShrink: 0 }} aria-label={alt}>
            {useImg
                ? <img src={normalized} alt={alt} style={{ width: 28, height: 28, objectFit: "contain" }} onError={() => setFailed(true)} />
                : <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 11, color: "var(--vp-fg)" }}>{fallback.substring(0, 2).toUpperCase()}</span>
            }
        </div>
    );
}

function VenueHeroImage({ src, alt }: { src?: string; alt: string }) {
    const [failed, setFailed] = useState(false);
    return (
        <img
            src={!failed && src ? src : "/venue-hero.webp"}
            alt={alt}
            className="vp-hero-img"
            onError={() => setFailed(true)}
        />
    );
}

function formatMatchDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: "TBD", time: "TBD" };
    return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
}

/* ── page component ── */
function VenueProfilePageContent({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const preselectedMatchId = searchParams.get("matchId");
    const { isAuthenticated, user } = useAuth();
    const { venues: venueList, getTeam, getLeague, getVenueReviews, getVenuePosts, getVenueMatchEvents, isLoading } = useData();
    const venue = venueList.find((v) => v.slug === slug || v.id === slug);
    const venueSlugOrId = venue?.slug || venue?.id || slug;

    const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
    const [bookingOpen, setBookingOpen] = useState(false);
    const [bookingEventIdx, setBookingEventIdx] = useState(0);
    const [prefillApplied, setPrefillApplied] = useState(false);
    const [menu, setMenu] = useState<VenueMenuCategory[]>([]);
    const [menuLoading, setMenuLoading] = useState(false);
    const [menuError, setMenuError] = useState<string | null>(null);
    const [packages, setPackages] = useState<Array<{ id: string; name: string; description?: string | null; price: string; currency?: string | null; maxPartySize?: number | null; inclusions?: string[] | null }>>([]);
    const [localMatchEvents, setLocalMatchEvents] = useState<(ReturnType<typeof getVenueMatchEvents>[number])[]>([]);
    const [followBusy, setFollowBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [fanTeams, setFanTeams] = useState<VenueFanTeam[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    const reviews = venue ? getVenueReviews(venue.id) : [];
    const posts = venue ? getVenuePosts(venue.id) : [];
    const matchEvents = localMatchEvents.length > 0 ? localMatchEvents : (venue ? getVenueMatchEvents(venue.id) : []);

    useEffect(() => {
        if (bookingEventIdx >= matchEvents.length) setBookingEventIdx(0);
    }, [bookingEventIdx, matchEvents.length]);

    useEffect(() => {
        if (!venue || prefillApplied) return;
        if (!preselectedMatchId) { setPrefillApplied(true); return; }
        const eventIdx = matchEvents.findIndex((e) => e.match.id === preselectedMatchId);
        if (eventIdx !== -1) { setBookingEventIdx(eventIdx); setBookingOpen(true); }
        setPrefillApplied(true);
    }, [prefillApplied, preselectedMatchId, matchEvents, venue]);

    useEffect(() => {
        if (!venue) return;
        setFollowerCount(venue.followerCount || 0);
        let active = true;
        const load = async () => {
            setMenuLoading(true);
            setMenuError(null);
            setMenu([]);
            setPackages([]);
            setLocalMatchEvents([]);
            setFanTeams([]);
            const [venueResult, menuResult, eventsResult, packagesResult] = await Promise.allSettled([
                api.get<{ followerCount: number; isFollowing: boolean; fanTeams?: VenueFanTeam[] }>(`/venues/${venueSlugOrId}`),
                api.get<VenueMenuCategory[]>(`/venues/${venueSlugOrId}/menu`),
                api.get<any[]>(`/venues/${venueSlugOrId}/events?limit=20`),
                api.get<Array<{ id: string; name: string; description?: string | null; price: string; currency?: string | null; maxPartySize?: number | null; inclusions?: string[] | null }>>(`/venues/${venueSlugOrId}/packages`),
            ]);
            if (!active) return;
            if (venueResult.status === "fulfilled") {
                setFollowerCount(Number(venueResult.value.data.followerCount || venue.followerCount || 0));
                setIsFollowing(Boolean(venueResult.value.data.isFollowing));
                setFanTeams(Array.isArray(venueResult.value.data.fanTeams) ? venueResult.value.data.fanTeams : []);
            }
            if (menuResult.status === "fulfilled") {
                setMenu(menuResult.value.data || []);
            } else {
                setMenuError(menuResult.reason instanceof Error ? menuResult.reason.message : "Failed to load menu");
            }
            if (packagesResult.status === "fulfilled") {
                setPackages(packagesResult.value.data || []);
            }
            if (eventsResult.status === "fulfilled") {
                const rawEvents: any[] = eventsResult.value.data || [];
                const mapped = rawEvents.map((ev: any) => {
                    const m = ev.match;
                    return {
                        id: ev.id, venueId: venue.id, matchId: ev.matchId || m?.id || "",
                        isActive: ev.isActive !== false, bookingLimit: ev.bookingLimit ?? null,
                        confirmedBookings: Number(ev.confirmedBookingsCount || 0),
                        specialNotes: ev.specialNotes || "", entryFee: ev.customPrice != null ? Number(ev.customPrice) : null,
                        doorsOpenAt: ev.doorsOpenAt || "", requiresApproval: Boolean(ev.requiresApproval),
                        match: m ? {
                            id: m.id, isFeatured: Boolean(m.isFeatured),
                            homeTeamId: m.homeTeamId || m.homeTeamName || "", awayTeamId: m.awayTeamId || m.awayTeamName || "",
                            homeTeamName: m.homeTeamName || "", awayTeamName: m.awayTeamName || "",
                            homeTeamCrestUrl: m.homeTeamCrestUrl, awayTeamCrestUrl: m.awayTeamCrestUrl,
                            leagueId: m.leagueId || m.league?.id || "",
                            matchDateUTC: m.matchDateUtc || "", status: m.status || "SCHEDULED",
                            homeScore: m.homeScore ?? null, awayScore: m.awayScore ?? null,
                            matchDay: m.matchDay ? String(m.matchDay) : "", stage: m.stage || "",
                            stadiumName: m.venueName || "", venueCount: 0, isHot: false,
                            eventFormat: (m.eventFormat || "HEAD_TO_HEAD") as any,
                            eventTitle: m.eventTitle, eventSubtitle: m.eventSubtitle,
                        } : undefined,
                    };
                });
                setLocalMatchEvents(mapped as any);
            }
            setMenuLoading(false);
        };
        void load();
        return () => { active = false; };
    }, [venue, venueSlugOrId]);

    const handleToggleFollow = async () => {
        if (!venue) return;
        setActionError(null);
        if (!isAuthenticated) { router.push(`/login?next=/venues/${venueSlugOrId}`); return; }
        setFollowBusy(true);
        try {
            const res = await api.post<{ following: boolean }>(`/venues/${venueSlugOrId}/follow`);
            const next = Boolean(res.data.following);
            setIsFollowing(next);
            setFollowerCount((prev) => Math.max(0, prev + (next ? 1 : -1)));
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : "Failed to update follow status");
        } finally {
            setFollowBusy(false);
        }
    };

    const selectedEvent = matchEvents[bookingEventIdx];
    const bookingMatch = selectedEvent?.match;
    const bookingHome = bookingMatch ? getTeam(bookingMatch.homeTeamId) : undefined;
    const bookingAway = bookingMatch ? getTeam(bookingMatch.awayTeamId) : undefined;
    const bookingLeague = bookingMatch ? getLeague(bookingMatch.leagueId) : undefined;
    const bookingDisplay = bookingMatch ? getMatchDisplay(bookingMatch, { homeTeam: bookingHome, awayTeam: bookingAway, league: bookingLeague }) : null;
    const bookingLeagueVisual = getLeagueVisual(bookingLeague);

    const heroImage = venue?.coverImageUrl || "/venue-hero.webp";
    const galleryImages = venue?.galleryImageUrls?.length ? venue.galleryImageUrls : [];
    const workingHours = venue?.workingHours || [];
    const googleReviews = venue?.googleReviews || [];

    const tabs: Array<{ id: ActiveTab; label: string }> = [
        { id: "overview", label: "Overview" },
        { id: "menu", label: "Menu" },
        ...(googleReviews.length > 0 ? [{ id: "google-reviews" as ActiveTab, label: `Google Reviews (${googleReviews.length})` }] : []),
        ...(reviews.length > 0 ? [{ id: "reviews" as ActiveTab, label: `Reviews (${reviews.length})` }] : []),
        { id: "posts", label: `Posts (${posts.length})` },
    ];

    const mainEvent = useMemo(() => {
        if (matchEvents.length === 0) return null;
        if (selectedEvent) return { event: selectedEvent, idx: bookingEventIdx };
        return { event: matchEvents[0], idx: 0 };
    }, [matchEvents, selectedEvent, bookingEventIdx]);

    const nearestEvent = useMemo(() => matchEvents[0] || null, [matchEvents]);
    const promotedEvent = useMemo(() => {
        if (!venue?.promotedVenueEventId) return null;
        return matchEvents.find((e) => e.id === venue.promotedVenueEventId) || null;
    }, [matchEvents, venue?.promotedVenueEventId]);
    const bannerEvent = promotedEvent || nearestEvent;

    const initials = user?.name ? user.name.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase() : "MW";

    /* loading */
    if (isLoading && !venue) {
        return (
            <>
                <style dangerouslySetInnerHTML={{ __html: VP_VARS + VP_CSS }} />
                <div className="vp-wrap">
                    <FloatingNav />
                    <header className="vp-topbar">
                        <div className="vp-topbar-inner">
                            <Link href="/" className="vp-brand"><img className="vp-brand-logo" src="/logo.svg" alt="MatchWatch" /></Link>
                            <nav className="vp-nav"><Link href="/">Home</Link><Link href="/venues" className="active">Venues</Link><Link href="/matches">Matches</Link></nav>
                            <div className="vp-top-right"><Link href="/login" className="vp-btn-pill">Log in</Link></div>
                        </div>
                    </header>
                    <div className="vp-hero vp-skeleton" />
                    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: 12 }}>
                        {[60, 40, 80].map((w, i) => <div key={i} className="vp-skeleton" style={{ height: 18, width: `${w}%`, borderRadius: 4 }} />)}
                    </div>
                </div>
            </>
        );
    }

    /* not found */
    if (!venue) {
        return (
            <>
                <style dangerouslySetInnerHTML={{ __html: VP_VARS + VP_CSS }} />
                <div className="vp-wrap">
                    <div className="vp-not-found">
                        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 48, fontWeight: 700, color: "var(--vp-line-2)" }}>404</div>
                        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 600, color: "var(--vp-fg)" }}>Venue not found</div>
                        <p style={{ color: "var(--vp-fg-dim)", fontSize: 14 }}>This venue may have been removed or the URL is incorrect.</p>
                        <Link href="/venues" className="vp-btn-pill">Browse venues</Link>
                    </div>
                </div>
            </>
        );
    }

    const address = [venue.addressLine1, venue.addressLine2, `${venue.city}, ${venue.state} ${venue.postalCode}`].filter(Boolean).join(", ");
    const mapUrl = venue.lat && venue.lng ? `https://maps.google.com/?q=${venue.lat},${venue.lng}` : "";

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: VP_VARS + VP_CSS }} />
            <div className="vp-wrap">
                <FloatingNav />

                {/* Topbar */}
                <header className="vp-topbar">
                    <div className="vp-topbar-inner">
                        <Link href="/" className="vp-brand">
                            <img className="vp-brand-logo" src="/logo.svg" alt="MatchWatch" />
                        </Link>
                        <nav className="vp-nav">
                            <Link href="/">Home</Link>
                            <Link href="/matches">Matches</Link>
                            <Link href="/venues" className="active">Venues</Link>
                            {user && <Link href="/dashboard">My bookings</Link>}
                        </nav>
                        <div className="vp-top-right">
                            {user
                                ? <Link href="/dashboard" className="vp-btn-pill ghost">{initials}</Link>
                                : <>
                                    <Link href="/for-venues/register" className="vp-btn-pill ghost">List venue</Link>
                                    <Link href="/login" className="vp-btn-pill">Log in</Link>
                                  </>
                            }
                        </div>
                    </div>
                </header>

                {/* Hero */}
                <section className="vp-hero">
                    <VenueHeroImage src={heroImage} alt={venue.name} />
                    <div className="vp-hero-overlay" />
                    <div className="vp-hero-content">
                        <div className="vp-hero-top">
                            <Link href="/venues" className="vp-back">← Venues</Link>
                            <button
                                className={`vp-follow${isFollowing ? " on" : ""}`}
                                onClick={() => void handleToggleFollow()}
                                disabled={followBusy}
                            >
                                {followBusy ? "..." : isFollowing ? "✓ Following" : "+ Follow"}
                            </button>
                        </div>
                        <div className="vp-hero-body">
                            {(venue.isFeatured || venue.isVerified) && (
                                <div className="vp-badges">
                                    {venue.isFeatured && <span className="vp-badge">Featured</span>}
                                    {venue.isVerified && <span className="vp-badge">Verified</span>}
                                </div>
                            )}
                            <h1 className="vp-venue-name">{venue.name}</h1>
                            {venue.shortDescription && <p className="vp-venue-sub">{venue.shortDescription}</p>}
                            <div className="vp-hero-stats">
                                <span className="vp-stat"><b className="accent">★</b> <b>{venue.rating.toFixed(1)}</b> rating</span>
                                <span className="vp-stat"><b>{PRICE_LABELS[venue.priceRange]}</b></span>
                                <span className="vp-stat"><b>{matchEvents.length}</b> upcoming events</span>
                                <span className="vp-stat"><b>{followerCount.toLocaleString()}</b> followers</span>
                                <span className="vp-stat">{venue.city}{venue.state ? `, ${venue.state}` : ""}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Gallery */}
                {galleryImages.length > 0 && (
                    <div className="vp-gallery">
                        {galleryImages.slice(0, 6).map((img, idx) => (
                            <div key={idx} className="vp-gallery-item" onClick={() => setLightboxIndex(idx)}>
                                <img src={img} alt={`${venue.name} ${idx + 1}`} className="vp-gallery-img" loading="lazy" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Crumb */}
                <div className="vp-crumb">
                    <Link href="/">Home</Link>
                    <span className="sep">›</span>
                    <Link href="/venues">Venues</Link>
                    <span className="sep">›</span>
                    <span className="vp-crumb-current">{venue.name}</span>
                </div>

                {/* Banner event */}
                {bannerEvent && (
                    <div className="vp-banner">
                        <div className="vp-banner-kicker">{promotedEvent ? "Featured match" : "Next up at this venue"}</div>
                        {(() => {
                            const home = getTeam(bannerEvent.match.homeTeamId);
                            const away = getTeam(bannerEvent.match.awayTeamId);
                            const league = getLeague(bannerEvent.match.leagueId);
                            const display = getMatchDisplay(bannerEvent.match, { homeTeam: home, awayTeam: away, league });
                            const { date, time } = formatMatchDate(bannerEvent.match.matchDateUTC);
                            return (
                                <>
                                    <div className="vp-banner-match">
                                        {display.isSingleEvent ? display.title : `${display.homeName} vs ${display.awayName}`}
                                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 400, color: "var(--vp-fg-mute)", marginLeft: 12 }}>{date} · {time}</span>
                                    </div>
                                    <div className="vp-banner-foot">
                                        <Link href={`/matches/${bannerEvent.match.id}`} className="vp-view-link">View match</Link>
                                        <button className="vp-reserve-btn" onClick={() => {
                                            const idx = matchEvents.findIndex((e) => e.id === bannerEvent.id);
                                            if (idx !== -1) setBookingEventIdx(idx);
                                            setBookingOpen(true);
                                        }}>Reserve spot →</button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                {actionError && <div className="vp-alert">{actionError}</div>}

                {/* Tabs */}
                <nav className="vp-tabs">
                    {tabs.map((tab) => (
                        <button key={tab.id} className={`vp-tab${activeTab === tab.id ? " on" : ""}`} onClick={() => setActiveTab(tab.id)}>
                            {tab.label}
                        </button>
                    ))}
                </nav>

                {/* Content grid */}
                <div className="vp-page">
                    <main className="vp-main">

                        {/* Overview */}
                        {activeTab === "overview" && (
                            <>
                                <div className="vp-panel">
                                    <h2 className="vp-panel-title">About</h2>
                                    <p className="vp-panel-sub">{venue.description || venue.shortDescription || "No description available."}</p>
                                </div>

                                {packages.length > 0 && (
                                    <div className="vp-panel" style={{ marginTop: 16 }}>
                                        <h2 className="vp-panel-title">Watch-Party Packages</h2>
                                        <p className="vp-panel-sub" style={{ marginBottom: 12 }}>Bookable bundles for your group on match day.</p>
                                        <div style={{ display: "grid", gap: 10 }}>
                                            {packages.map((pkg) => (
                                                <div key={pkg.id} style={{ border: "1px solid var(--vp-line)", borderRadius: 12, padding: 14 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                                                        <span style={{ fontWeight: 700, color: "var(--vp-fg)" }}>{pkg.name}</span>
                                                        <span style={{ fontWeight: 700, color: "var(--vp-accent)", whiteSpace: "nowrap" }}>
                                                            ${Number(pkg.price).toFixed(2)}{pkg.maxPartySize ? ` · up to ${pkg.maxPartySize}` : ""}
                                                        </span>
                                                    </div>
                                                    {pkg.description && <p style={{ marginTop: 4, fontSize: 13, color: "var(--vp-fg-dim)" }}>{pkg.description}</p>}
                                                    {Array.isArray(pkg.inclusions) && pkg.inclusions.length > 0 && (
                                                        <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12.5, color: "var(--vp-fg-dim)", display: "grid", gap: 2 }}>
                                                            {pkg.inclusions.map((inc, i) => <li key={i}>{inc}</li>)}
                                                        </ul>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="vp-facts">
                                    <div className="vp-fact"><span className="vp-fact-val">{venue.capacity || "—"}</span><span className="vp-fact-lbl">Capacity</span></div>
                                    <div className="vp-fact"><span className="vp-fact-val">{venue.totalBookings?.toLocaleString() || "0"}</span><span className="vp-fact-lbl">Bookings</span></div>
                                    <div className="vp-fact"><span className="vp-fact-val">{venue.reviewCount || "0"}</span><span className="vp-fact-lbl">Reviews</span></div>
                                    <div className="vp-fact"><span className="vp-fact-val">{venue.upcomingEventsCount || matchEvents.length || "0"}</span><span className="vp-fact-lbl">Events</span></div>
                                </div>

                                {venue.amenities.length > 0 && (
                                    <div className="vp-panel" style={{ marginTop: 16 }}>
                                        <h2 className="vp-panel-title">Amenities</h2>
                                        <div className="vp-amenity-grid">
                                            {venue.amenities.map((a) => (
                                                <span key={a} className="vp-amenity">{AMENITY_LABELS[a]?.label || a}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {venue.cuisineTags.length > 0 && (
                                    <div className="vp-panel">
                                        <h2 className="vp-panel-title">Cuisine</h2>
                                        <div className="vp-chip-row">
                                            {venue.cuisineTags.map((tag) => <span key={tag} className="vp-chip">{tag}</span>)}
                                        </div>
                                    </div>
                                )}

                                {workingHours.length > 0 && (
                                    <div className="vp-panel">
                                        <h2 className="vp-panel-title">Hours</h2>
                                        <div className="vp-hours">
                                            {workingHours.map((entry) => (
                                                <div key={`${entry.day}-${entry.sortOrder}`} className="vp-hours-row">
                                                    <span className="vp-hours-day">{entry.day}</span>
                                                    <span style={{ color: "var(--vp-fg-dim)", fontSize: 13 }}>{entry.hours}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="vp-panel">
                                    <h2 className="vp-panel-title">Contact & Location</h2>
                                    <p className="vp-info-row">{address}</p>
                                    {venue.phone && <p className="vp-info-row">{venue.phone}</p>}
                                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                                        {venue.website && <a href={venue.website} target="_blank" rel="noreferrer" className="vp-map-link">Website ↗</a>}
                                        {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="vp-map-link">Google Maps ↗</a>}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Menu */}
                        {activeTab === "menu" && (
                            <div className="vp-panel">
                                <h2 className="vp-panel-title">Food &amp; Drinks</h2>
                                {menuLoading && <p className="vp-panel-sub">Loading menu…</p>}
                                {menuError && <div className="vp-alert">{menuError}</div>}
                                {!menuLoading && !menuError && menu.length === 0 && (
                                    <div className="vp-empty">No menu published yet</div>
                                )}
                                {menu.map((cat) => (
                                    <div key={cat.id} className="vp-menu-cat">
                                        <div className="vp-menu-cat-title">{cat.name}</div>
                                        {cat.items.map((item) => (
                                            <div key={item.id} className="vp-menu-item">
                                                <div>
                                                    <div className="vp-menu-name">
                                                        {item.name}
                                                        {item.isFeatured && <span className="vp-menu-tag" style={{ marginLeft: 8, color: "var(--vp-accent)", borderColor: "var(--vp-accent)" }}>Popular</span>}
                                                        {!item.isAvailable && <span className="vp-menu-tag" style={{ marginLeft: 8 }}>Sold out</span>}
                                                    </div>
                                                    {item.description && <div className="vp-menu-desc">{item.description}</div>}
                                                    {(item.dietaryTags || []).length > 0 && (
                                                        <div className="vp-menu-tags">
                                                            {(item.dietaryTags || []).map((d) => <span key={d} className="vp-menu-tag">{d.replace(/_/g, " ")}</span>)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="vp-menu-price">${Number(item.price).toFixed(2)}</div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Google Reviews */}
                        {activeTab === "google-reviews" && (
                            <>
                                {googleReviews.length === 0 && <div className="vp-empty">No Google reviews available</div>}
                                {googleReviews.map((review, idx) => (
                                    <div key={idx} className="vp-review-card">
                                        <div className="vp-review-head">
                                            <div>
                                                <div className="vp-review-author">{review.authorName}</div>
                                                <div className="vp-review-date">{review.relativePublishTimeText || (review.publishedAt ? new Date(review.publishedAt).toLocaleDateString("en-US") : "Google review")}</div>
                                            </div>
                                            <div className="vp-stars">{"★".repeat(Math.max(1, review.rating || 0))}</div>
                                        </div>
                                        <p className="vp-review-text">{review.text || "No review text."}</p>
                                        {review.sourceUrl && <a href={review.sourceUrl} target="_blank" rel="noreferrer" className="vp-map-link">View on Google ↗</a>}
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Reviews */}
                        {activeTab === "reviews" && (
                            <>
                                {reviews.length === 0 && <div className="vp-empty">No reviews yet</div>}
                                {reviews.map((review) => (
                                    <div key={review.id} className="vp-review-card">
                                        <div className="vp-review-head">
                                            <div>
                                                <div className="vp-review-author">{review.title || "Venue Review"}</div>
                                                <div className="vp-review-date">{review.userName} · {new Date(review.date).toLocaleDateString("en-US")}</div>
                                            </div>
                                            <div className="vp-stars">{"★".repeat(Math.max(1, review.rating))}</div>
                                        </div>
                                        <p className="vp-review-text">{review.content}</p>
                                        {review.ownerReply && <div className="vp-owner-reply">Owner: {review.ownerReply}</div>}
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Posts */}
                        {activeTab === "posts" && (
                            <>
                                {posts.length === 0 && <div className="vp-empty">No posts from this venue yet</div>}
                                {posts.map((post) => (
                                    <div key={post.id} className="vp-post-card">
                                        <div className="vp-post-head">
                                            <span className="vp-post-label">Venue Update</span>
                                            <span className="vp-post-date">{new Date(post.createdAt).toLocaleDateString("en-US")}</span>
                                        </div>
                                        <p className="vp-post-text">{post.content}</p>
                                        {post.matchId && <Link href={`/matches/${post.matchId}`} className="vp-map-link">View related match →</Link>}
                                    </div>
                                ))}
                            </>
                        )}

                    </main>

                    {/* Right rail */}
                    <aside className="vp-rail">
                        <h3>Reserve a spot</h3>
                        {matchEvents.length === 0
                            ? <p style={{ fontSize: 13, color: "var(--vp-fg-dim)" }}>No upcoming events at this venue.</p>
                            : matchEvents.slice(0, 6).map((row, idx) => {
                                const home = getTeam(row.match.homeTeamId);
                                const away = getTeam(row.match.awayTeamId);
                                const league = getLeague(row.match.leagueId);
                                const display = getMatchDisplay(row.match, { homeTeam: home, awayTeam: away, league });
                                const { date, time } = formatMatchDate(row.match.matchDateUTC);
                                const spots = row.bookingLimit ? row.bookingLimit - row.confirmedBookings : null;
                                return (
                                    <div key={row.id} className={`vp-event-row${bookingEventIdx === idx ? " sel" : ""}`}>
                                        <div className="vp-event-meta">
                                            <span>{league?.name || "Match"}</span>
                                            <span>{date}</span>
                                        </div>
                                        <div className="vp-event-teams">
                                            {display.isSingleEvent ? display.title : `${display.homeName} vs ${display.awayName}`}
                                        </div>
                                        <div className="vp-event-foot">
                                            <span className={`vp-spots${spots !== null && spots < 5 ? " low" : ""}`}>
                                                {spots !== null ? `${spots} spots left` : time}
                                            </span>
                                            <button className="vp-book-btn" onClick={() => { setBookingEventIdx(idx); setBookingOpen(true); }}>
                                                Book →
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        }

                        {fanTeams.length > 0 && (
                            <>
                                <h4>Fans of</h4>
                                {fanTeams.map((team) => (
                                    <div key={team.id} className="vp-fan-team">
                                        <div className="vp-fan-crest">
                                            {team.crestUrl
                                                ? <img src={normalizeImage(team.crestUrl)} alt={team.name} style={{ width: 28, height: 28, objectFit: "contain" }} />
                                                : (team.shortName || team.name).slice(0, 2).toUpperCase()
                                            }
                                        </div>
                                        <div>
                                            <div className="vp-fan-name">{team.name}</div>
                                            {team.league && <div className="vp-fan-league">{team.league.shortName || team.league.name}</div>}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        <h4>Venue info</h4>
                        <div style={{ fontSize: 12, color: "var(--vp-fg-dim)", lineHeight: 1.6 }}>
                            <div>{venue.city}{venue.state ? `, ${venue.state}` : ""}</div>
                            {venue.phone && <div>{venue.phone}</div>}
                            {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="vp-map-link" style={{ fontSize: 11, marginTop: 6 }}>Get directions ↗</a>}
                        </div>
                    </aside>
                </div>

                {/* Lightbox */}
                {lightboxIndex !== null && galleryImages.length > 0 && (
                    <div className="vp-lightbox" onClick={() => setLightboxIndex(null)}>
                        <button className="vp-lightbox-close" onClick={() => setLightboxIndex(null)}>✕</button>
                        {galleryImages.length > 1 && (
                            <>
                                <button className="vp-lightbox-nav" style={{ left: 0 }} onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + galleryImages.length) % galleryImages.length); }}>‹</button>
                                <button className="vp-lightbox-nav" style={{ right: 0 }} onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % galleryImages.length); }}>›</button>
                            </>
                        )}
                        <img src={galleryImages[lightboxIndex]} alt={`${venue.name} gallery`} className="vp-lightbox-img" onClick={(e) => e.stopPropagation()} />
                        <span className="vp-lightbox-counter">{lightboxIndex + 1} / {galleryImages.length}</span>
                    </div>
                )}

                {/* Booking drawer */}
                {matchEvents.length > 0 && (
                    <BookingDrawer
                        isOpen={bookingOpen}
                        onClose={() => setBookingOpen(false)}
                        venueEventId={selectedEvent?.id}
                        venue={{ name: venue.name, address: `${venue.addressLine1}, ${venue.city}` }}
                        match={{
                            eventFormat: bookingMatch?.eventFormat,
                            title: bookingDisplay?.title || "Match",
                            subtitle: bookingDisplay?.subtitle,
                            homeTeam: bookingDisplay?.homeName,
                            awayTeam: bookingDisplay?.awayName,
                            homeCrest: bookingHome?.image || bookingHome?.crest || "H",
                            awayCrest: bookingAway?.image || bookingAway?.crest || "A",
                            eventBadge: bookingLeagueVisual.image || bookingLeagueVisual.logo,
                            kickoff: bookingMatch ? formatMatchDate(bookingMatch.matchDateUTC).date : "TBD",
                            league: bookingLeague?.name || "League",
                        }}
                        spotsRemaining={selectedEvent?.bookingLimit ? selectedEvent.bookingLimit - selectedEvent.confirmedBookings : 50}
                        entryFee={selectedEvent?.entryFee || undefined}
                    />
                )}
            </div>
        </>
    );
}

export default function VenueProfilePage({ params }: { params: Promise<{ slug: string }> }) {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#0a0b0d" }} />}>
            <VenueProfilePageContent params={params} />
        </Suspense>
    );
}
