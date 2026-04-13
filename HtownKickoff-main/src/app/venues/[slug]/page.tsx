"use client";

import React, { use, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";
import { AppShell } from "../../../components/AppShell";
import { BookingDrawer } from "../../../components/BookingDrawer";
import { AMENITY_LABELS, PRICE_LABELS } from "../../../lib/data";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useData } from "../../../lib/data-provider";
import { getLeagueVisual, getMatchDisplay } from "../../../lib/match-display";
import styles from "./page.module.css";

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
    league?: {
        id: string;
        slug: string;
        name: string;
        shortName?: string | null;
    } | null;
};

type ActiveTab = "overview" | "menu" | "google-reviews" | "reviews" | "posts";

function normalizeImage(value?: string | null) {
    const raw = (value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) return raw;
    return `https://${raw}`;
}

function TeamCrest({ src, fallback, alt }: { src?: string; fallback: string; alt: string }) {
    const [failed, setFailed] = useState(false);
    const normalized = normalizeImage(src);
    const useImage = Boolean(normalized) && !failed;
    return (
        <div className={styles.crest} aria-label={alt}>
            {useImage ? (
                <img
                    src={normalized}
                    alt={alt}
                    className={styles.crestImage}
                    onError={() => setFailed(true)}
                />
            ) : (
                <span className={styles.crestFallback}>{fallback}</span>
            )}
        </div>
    );
}

function LeagueCrest({ src, fallback, alt }: { src?: string; fallback: string; alt: string }) {
    const [failed, setFailed] = useState(false);
    const normalized = normalizeImage(src);
    const useImage = Boolean(normalized) && !failed;
    return (
        <div className={styles.leagueCrest} aria-label={alt}>
            {useImage ? (
                <img
                    src={normalized}
                    alt={alt}
                    className={styles.leagueCrestImage}
                    onError={() => setFailed(true)}
                />
            ) : (
                <span className={styles.leagueCrestFallback}>{fallback}</span>
            )}
        </div>
    );
}

function formatMatchDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return { date: "TBD", time: "TBD" };
    }
    return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
}

function VenueProfilePageContent({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const preselectedMatchId = searchParams.get("matchId");
    const { isAuthenticated } = useAuth();
    const { venues: venueList, getTeam, getLeague, getVenueReviews, getVenuePosts, getVenueMatchEvents, isLoading, refetch } = useData();
    const venue = venueList.find((v) => v.slug === slug);

    const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
    const [bookingOpen, setBookingOpen] = useState(false);
    const [bookingEventIdx, setBookingEventIdx] = useState(0);
    const [prefillApplied, setPrefillApplied] = useState(false);
    const [menu, setMenu] = useState<VenueMenuCategory[]>([]);
    const [menuLoading, setMenuLoading] = useState(false);
    const [menuError, setMenuError] = useState<string | null>(null);
    const [customEvents, setCustomEvents] = useState<VenueCustomEvent[]>([]);
    const [localMatchEvents, setLocalMatchEvents] = useState<(ReturnType<typeof getVenueMatchEvents>[number])[]>([]);
    const [followBusy, setFollowBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [fanTeams, setFanTeams] = useState<VenueFanTeam[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    const reviews = venue ? getVenueReviews(venue.id) : [];
    const posts = venue ? getVenuePosts(venue.id) : [];
    // Use locally fetched events (loaded on-demand) — fallback to DataProvider for backwards compat
    const matchEvents = localMatchEvents.length > 0 ? localMatchEvents : (venue ? getVenueMatchEvents(venue.id) : []);

    useEffect(() => {
        if (bookingEventIdx >= matchEvents.length) {
            setBookingEventIdx(0);
        }
    }, [bookingEventIdx, matchEvents.length]);

    // Removed: void refetch() on every venue visit was re-fetching all 200+ venues + matches

    useEffect(() => {
        if (!venue || prefillApplied) return;
        if (!preselectedMatchId) {
            setPrefillApplied(true);
            return;
        }
        const eventIdx = matchEvents.findIndex((event) => event.match.id === preselectedMatchId);
        if (eventIdx !== -1) {
            setBookingEventIdx(eventIdx);
            setBookingOpen(true);
        }
        setPrefillApplied(true);
    }, [prefillApplied, preselectedMatchId, matchEvents, venue]);

    useEffect(() => {
        if (!venue) return;
        setFollowerCount(venue.followerCount || 0);

        let active = true;
        const loadVenueExtras = async () => {
            setMenuLoading(true);
            setMenuError(null);
            setMenu([]);
            setCustomEvents([]);
            setLocalMatchEvents([]);
            setFanTeams([]);

            const [venueResult, menuResult, customResult, eventsResult] = await Promise.allSettled([
                api.get<{ followerCount: number; isFollowing: boolean; fanTeams?: VenueFanTeam[] }>(`/venues/${venue.slug}`),
                api.get<VenueMenuCategory[]>(`/venues/${venue.slug}/menu`),
                api.get<VenueCustomEvent[]>(`/venues/${venue.slug}/custom-events`),
                api.get<any[]>(`/venues/${venue.slug}/events?limit=20`),
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

            if (customResult.status === "fulfilled") {
                setCustomEvents(customResult.value.data || []);
            }

            if (eventsResult.status === "fulfilled") {
                const rawEvents: any[] = eventsResult.value.data || [];
                const mapped = rawEvents.map((ev: any) => {
                    const m = ev.match;
                    return {
                        id: ev.id,
                        venueId: venue.id,
                        matchId: ev.matchId || m?.id || "",
                        isActive: ev.isActive !== false,
                        bookingLimit: ev.bookingLimit ?? null,
                        confirmedBookings: Number(ev.confirmedBookingsCount || 0),
                        specialNotes: ev.specialNotes || "",
                        entryFee: ev.customPrice != null ? Number(ev.customPrice) : null,
                        doorsOpenAt: ev.doorsOpenAt || "",
                        requiresApproval: Boolean(ev.requiresApproval),
                        match: m ? {
                            id: m.id,
                            isFeatured: Boolean(m.isFeatured),
                            homeTeamId: m.homeTeamId || m.homeTeamName || "",
                            awayTeamId: m.awayTeamId || m.awayTeamName || "",
                            homeTeamName: m.homeTeamName || "",
                            awayTeamName: m.awayTeamName || "",
                            homeTeamCrestUrl: m.homeTeamCrestUrl,
                            awayTeamCrestUrl: m.awayTeamCrestUrl,
                            leagueId: m.leagueId || m.league?.id || "",
                            matchDateUTC: m.matchDateUtc || "",
                            status: m.status || "SCHEDULED",
                            homeScore: m.homeScore ?? null,
                            awayScore: m.awayScore ?? null,
                            matchDay: m.matchDay ? String(m.matchDay) : "",
                            stage: m.stage || "",
                            stadiumName: m.venueName || "",
                            venueCount: 0,
                            isHot: false,
                            eventFormat: (m.eventFormat || "HEAD_TO_HEAD") as any,
                            eventTitle: m.eventTitle,
                            eventSubtitle: m.eventSubtitle,
                        } : undefined,
                    };
                });
                setLocalMatchEvents(mapped as any);
            }

            setMenuLoading(false);
        };

        void loadVenueExtras();
        return () => {
            active = false;
        };
    }, [venue]);

    const handleToggleFollow = async () => {
        if (!venue) return;
        setActionError(null);
        if (!isAuthenticated) {
            router.push(`/login?next=/venues/${venue.slug}`);
            return;
        }

        setFollowBusy(true);
        try {
            const res = await api.post<{ following: boolean }>(`/venues/${venue.slug}/follow`);
            const nextFollowing = Boolean(res.data.following);
            setIsFollowing(nextFollowing);
            setFollowerCount((prev) => Math.max(0, prev + (nextFollowing ? 1 : -1)));
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
    const coverAttributions = venue?.coverImageAttributions || [];
    const galleryImageAttributions = venue?.galleryImageAttributions || [];
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
        return matchEvents.find((event) => event.id === venue.promotedVenueEventId) || null;
    }, [matchEvents, venue?.promotedVenueEventId]);
    const bannerEvent = promotedEvent || nearestEvent;

    if (isLoading && !venue) {
        return (
            <AppShell>
                <article className={styles.page}>
                    {/* Skeleton hero */}
                    <section className={styles.hero} style={{ background: "var(--secondary)", minHeight: 340 }}>
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, var(--background))" }} />
                    </section>
                    {/* Skeleton body */}
                    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ height: 36, width: "55%", borderRadius: 10, background: "var(--secondary)", animation: "pulse 1.5s ease-in-out infinite" }} />
                        <div style={{ height: 18, width: "35%", borderRadius: 8, background: "var(--secondary)", animation: "pulse 1.5s ease-in-out infinite" }} />
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} style={{ height: 32, width: 80, borderRadius: 99, background: "var(--secondary)", animation: "pulse 1.5s ease-in-out infinite" }} />
                            ))}
                        </div>
                        <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
                        <div style={{ height: 14, width: "90%", borderRadius: 6, background: "var(--secondary)", animation: "pulse 1.5s ease-in-out infinite" }} />
                        <div style={{ height: 14, width: "75%", borderRadius: 6, background: "var(--secondary)", animation: "pulse 1.5s ease-in-out infinite" }} />
                        <div style={{ height: 14, width: "60%", borderRadius: 6, background: "var(--secondary)", animation: "pulse 1.5s ease-in-out infinite" }} />
                    </div>
                    <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
                </article>
            </AppShell>
        );
    }

    if (!venue) {
        return (
                <AppShell>
                    <section className={styles.notFound}>
                        <p className={styles.notFoundIcon}>Venue Not Found</p>
                        <p className={styles.notFoundText}>This venue may have been removed.</p>
                        <Link href="/venues" className="btn-primary">Back to Venues</Link>
                    </section>
                </AppShell>
        );
    }

    const address = [venue.addressLine1, venue.addressLine2, `${venue.city}, ${venue.state} ${venue.postalCode}`]
        .filter(Boolean)
        .join(", ");
    const mapUrl = venue.lat && venue.lng ? `https://maps.google.com/?q=${venue.lat},${venue.lng}` : "";

    return (
            <AppShell>
                <article className={styles.page}>
                    <section className={styles.hero}>
                        <img src={heroImage} alt={venue.name} className={styles.heroImage} />
                        <div className={styles.heroShade} />
                        <div className={styles.heroFade} />

                        <div className={styles.heroTop}>
                            <Link href="/venues" className={styles.backButton}>Back</Link>
                            <button
                                className={styles.followButton}
                                onClick={() => void handleToggleFollow()}
                                disabled={followBusy}
                            >
                                {followBusy ? "Saving..." : isFollowing ? "Following" : "Follow"}
                            </button>
                        </div>

                        <div className={styles.heroBody}>
                            <div className={styles.heroBadges}>
                                {venue.isFeatured && <span className={styles.badge}>Featured</span>}
                                {venue.isVerified && <span className={styles.badgeVerified}>Verified</span>}
                            </div>
                            <h1 className={styles.heroTitle}>{venue.name}</h1>
                            <p className={styles.heroSubtitle}>{venue.shortDescription}</p>
                            <div className={styles.heroStatRow}>
                                <div className={styles.statChip}>
                                    <span className={styles.statValue}>{venue.rating.toFixed(1)}</span>
                                    <span className={styles.statLabel}>Rating</span>
                                </div>
                                <div className={styles.statChip}>
                                    <span className={styles.statValue}>{PRICE_LABELS[venue.priceRange]}</span>
                                    <span className={styles.statLabel}>Price</span>
                                </div>
                                <div className={styles.statChip}>
                                    <span className={styles.statValue}>{matchEvents.length}</span>
                                    <span className={styles.statLabel}>Events</span>
                                </div>
                                <div className={styles.statChip}>
                                    <span className={styles.statValue}>{followerCount.toLocaleString()}</span>
                                    <span className={styles.statLabel}>Followers</span>
                                </div>
                            </div>
                        </div>
                    </section>
                    {coverAttributions.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)" }}>
                            Photo credit: {coverAttributions.map((author) => author.displayName).join(", ")}
                        </div>
                    )}

                    {bannerEvent && (
                        <section className={styles.panel} style={{ marginTop: "16px" }}>
                            <h2 className={styles.panelTitle}>
                                {promotedEvent ? "Featured Match" : "Closest Upcoming Match"}
                            </h2>
                            <div className={styles.eventCard}>
                                <header className={styles.eventTop}>
                                    <div className={styles.teamsWrap}>
                                        {(() => {
                                            const home = getTeam(bannerEvent.match.homeTeamId);
                                            const away = getTeam(bannerEvent.match.awayTeamId);
                                            const league = getLeague(bannerEvent.match.leagueId);
                                            const display = getMatchDisplay(bannerEvent.match, { homeTeam: home, awayTeam: away, league });
                                            return display.isSingleEvent ? (
                                                <div className={styles.sideMeta}>
                                                    <strong>{display.title}</strong>
                                                    {display.subtitle ? <span>{display.subtitle}</span> : null}
                                                </div>
                                            ) : (
                                                <>
                                                    <div className={styles.teamBlock}>
                                                        <TeamCrest src={home?.image} fallback={home?.crest || "H"} alt={display.homeName} />
                                                        <span className={styles.teamName}>{display.homeName}</span>
                                                    </div>
                                                    <span className={styles.vsText}>vs</span>
                                                    <div className={styles.teamBlock}>
                                                        <TeamCrest src={away?.image} fallback={away?.crest || "A"} alt={display.awayName} />
                                                        <span className={styles.teamName}>{display.awayName}</span>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div className={styles.teamMeta}>
                                        <span>{formatMatchDate(bannerEvent.match.matchDateUTC).date}</span>
                                        <span>{formatMatchDate(bannerEvent.match.matchDateUTC).time}</span>
                                    </div>
                                </header>
                                <div className={styles.sideActions}>
                                    <Link href={`/matches/${bannerEvent.match.id}`} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--secondary)', color: 'var(--foreground)', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}>
                                        View Match
                                    </Link>
                                    <button
                                        style={{ padding: '8px 16px', borderRadius: 10, border: 'none', backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                                        onClick={() => {
                                            const idx = matchEvents.findIndex((event) => event.id === bannerEvent.id);
                                            if (idx !== -1) setBookingEventIdx(idx);
                                            setBookingOpen(true);
                                        }}
                                    >
                                        Reserve for This Match
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}

                    {galleryImages.length > 0 && (
                        <section className={styles.galleryStrip}>
                            {galleryImages.slice(0, 5).map((img, idx) => (
                                <div key={`${img}-${idx}`} className={styles.galleryItem} onClick={() => setLightboxIndex(idx)}>
                                    <img src={img} alt={`${venue.name} photo ${idx + 1}`} className={styles.galleryImage} loading="lazy" />
                                    {(galleryImageAttributions[idx] || []).length > 0 && (
                                        <div style={{ padding: "6px 8px", fontSize: 11, color: "var(--muted-foreground)", backgroundColor: "var(--card)" }}>
                                            Photo credit: {galleryImageAttributions[idx]!.map((author) => author.displayName).join(", ")}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </section>
                    )}

                    {/* Gallery Lightbox */}
                    {lightboxIndex !== null && galleryImages.length > 0 && (
                        <div className={styles.lightbox} onClick={() => setLightboxIndex(null)}>
                            <button className={styles.lightboxClose} onClick={() => setLightboxIndex(null)} aria-label="Close">✕</button>
                            {galleryImages.length > 1 && (
                                <>
                                    <button className={`${styles.lightboxNav} ${styles.lightboxPrev}`} onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + galleryImages.length) % galleryImages.length); }} aria-label="Previous">‹</button>
                                    <button className={`${styles.lightboxNav} ${styles.lightboxNext}`} onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % galleryImages.length); }} aria-label="Next">›</button>
                                </>
                            )}
                            <img
                                src={galleryImages[lightboxIndex]}
                                alt={`${venue.name} gallery ${lightboxIndex + 1}`}
                                className={styles.lightboxImage}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <span className={styles.lightboxCounter}>{lightboxIndex + 1} / {galleryImages.length}</span>
                        </div>
                    )}

                    {actionError && <div className={styles.alert}>{actionError}</div>}

                    <nav className={styles.tabRail}>
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ""}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    <section className={styles.contentGrid}>
                        <div className={styles.mainColumn}>
                            {activeTab === "overview" && (
                                <div className={styles.overviewGrid}>
                                    <section className={styles.panel}>
                                        <h2 className={styles.panelTitle}>About</h2>
                                        <p className={styles.panelSubtle}>{venue.description || venue.shortDescription}</p>
                                    </section>

                                    <section className={styles.panel}>
                                        <h2 className={styles.panelTitle}>Amenities</h2>
                                        <div className={styles.amenityGrid}>
                                            {venue.amenities.length === 0 && <p className={styles.panelSubtle}>No amenities listed.</p>}
                                            {venue.amenities.map((amenity) => (
                                                <div key={amenity} className={styles.amenityItem}>
                                                    <span>{AMENITY_LABELS[amenity]?.label || amenity}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className={styles.panel}>
                                        <h2 className={styles.panelTitle}>Working Hours</h2>
                                        {workingHours.length === 0 ? (
                                            <p className={styles.panelSubtle}>Working hours are not available yet.</p>
                                        ) : (
                                            <div className={styles.hoursTable}>
                                                {workingHours.map((entry) => (
                                                    <div key={`${entry.day}-${entry.sortOrder}`} className={styles.hoursRow}>
                                                        <span className={styles.hoursDay}>{entry.day}</span>
                                                        <span>{entry.hours}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <section className={styles.panel}>
                                        <h2 className={styles.panelTitle}>Cuisine</h2>
                                        <div className={styles.chipRow}>
                                            {venue.cuisineTags.length === 0 && <p className={styles.panelSubtle}>No cuisine tags listed.</p>}
                                            {venue.cuisineTags.map((tag) => (
                                                <span key={tag} className={styles.chip}>{tag}</span>
                                            ))}
                                        </div>
                                    </section>

                                    <section className={styles.panel}>
                                        <h2 className={styles.panelTitle}>Contact</h2>
                                        <p className={styles.infoRow}>{address}</p>
                                        {venue.phone && <p className={styles.infoRow}>{venue.phone}</p>}
                                        {venue.website && (
                                            <a href={venue.website} target="_blank" rel="noreferrer" className={styles.mapLink}>
                                                Venue Website
                                            </a>
                                        )}
                                        {mapUrl && (
                                            <a href={mapUrl} target="_blank" rel="noreferrer" className={styles.mapLink}>
                                                View on Map
                                            </a>
                                        )}
                                    </section>

                                    <section className={styles.panel}>
                                        <h2 className={styles.panelTitle}>Quick Facts</h2>
                                        <div className={styles.factsGrid}>
                                            <div className={styles.factCard}>
                                                <span className={styles.factValue}>{venue.capacity}</span>
                                                <span className={styles.factLabel}>Capacity</span>
                                            </div>
                                            <div className={styles.factCard}>
                                                <span className={styles.factValue}>{venue.totalBookings.toLocaleString()}</span>
                                                <span className={styles.factLabel}>Bookings</span>
                                            </div>
                                            <div className={styles.factCard}>
                                                <span className={styles.factValue}>{venue.reviewCount}</span>
                                                <span className={styles.factLabel}>Reviews</span>
                                            </div>
                                            <div className={styles.factCard}>
                                                <span className={styles.factValue}>{venue.upcomingEventsCount}</span>
                                                <span className={styles.factLabel}>Upcoming</span>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}
                            {activeTab === "menu" && (
                                <section className={styles.panel}>
                                    <h2 className={styles.panelTitle}>Food and Drinks</h2>
                                    {menuLoading && <p className={styles.panelSubtle}>Loading menu...</p>}
                                    {menuError && <div className={styles.alert}>{menuError}</div>}
                                    {!menuLoading && !menuError && menu.length === 0 && (
                                        <p className={styles.panelSubtle}>This venue has not published a menu yet.</p>
                                    )}

                                    {menu.map((category) => (
                                        <div key={category.id} className={styles.menuCategory}>
                                            <h3 className={styles.panelTitle}>{category.name}</h3>
                                            {category.items.map((item) => (
                                                <div key={item.id} className={styles.menuItem}>
                                                    <div>
                                                        <div className={styles.menuItemHeader}>
                                                            <span>{item.name}</span>
                                                            {item.isFeatured && <span className={styles.tag}>Popular</span>}
                                                            {!item.isAvailable && <span className={styles.tag}>Sold Out</span>}
                                                        </div>
                                                        {item.description && <p className={styles.panelSubtle}>{item.description}</p>}
                                                        {!!(item.dietaryTags || []).length && (
                                                            <div className={styles.menuTags}>
                                                                {(item.dietaryTags || []).map((diet) => (
                                                                    <span key={diet} className={styles.tag}>{diet.replace(/_/g, " ")}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className={styles.menuPrice}>${Number(item.price).toFixed(2)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </section>
                            )}

                            {activeTab === "google-reviews" && (
                                <div className={styles.overviewGrid}>
                                    {venue.reviewCount > googleReviews.length && googleReviews.length > 0 && (
                                        <div className={styles.reviewSampleNote}>
                                            Showing {googleReviews.length} Google review samples. Google reports {venue.reviewCount.toLocaleString("en-US")} total reviews for this venue.
                                        </div>
                                    )}
                                    {googleReviews.length === 0 && <div className={styles.emptyState}>No Google reviews are available for this venue.</div>}
                                    {googleReviews.map((review, idx) => (
                                        <article key={`${review.authorName}-${review.publishedAt || idx}`} className={styles.reviewCard}>
                                            <header className={styles.eventTop}>
                                                <div>
                                                    <h3 className={styles.panelTitle}>{review.authorName}</h3>
                                                    <p className={styles.panelSubtle}>
                                                        {review.relativePublishTimeText || (review.publishedAt ? new Date(review.publishedAt).toLocaleDateString("en-US") : "Google review")}
                                                    </p>
                                                </div>
                                                <div className={styles.teamMeta} style={{ display: "inline-flex", gap: "2px" }}>
                                                    {Array.from({ length: Math.max(1, review.rating || 0) }).map((_, starIdx) => (
                                                        <Star key={starIdx} size={12} fill="currentColor" />
                                                    ))}
                                                </div>
                                            </header>
                                            <p className={styles.panelSubtle}>{review.text || "No review text provided."}</p>
                                            {review.sourceUrl && (
                                                <a href={review.sourceUrl} target="_blank" rel="noreferrer" className={styles.mapLink}>
                                                    View on Google
                                                </a>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            )}

                            {activeTab === "reviews" && (
                                <div className={styles.overviewGrid}>
                                    {reviews.length === 0 && <div className={styles.emptyState}>No reviews yet for this venue.</div>}
                                    {reviews.map((review) => (
                                        <article key={review.id} className={styles.reviewCard}>
                                            <header className={styles.eventTop}>
                                                <div>
                                                    <h3 className={styles.panelTitle}>{review.title || "Venue Review"}</h3>
                                                    <p className={styles.panelSubtle}>{review.userName} · {new Date(review.date).toLocaleDateString("en-US")}</p>
                                                </div>
                                                <div className={styles.teamMeta} style={{ display: "inline-flex", gap: "2px" }}>
                                                    {Array.from({ length: Math.max(1, review.rating) }).map((_, idx) => (
                                                        <Star key={idx} size={12} fill="currentColor" />
                                                    ))}
                                                </div>
                                            </header>
                                            <p className={styles.panelSubtle}>{review.content}</p>
                                            {review.ownerReply && <p className={styles.ownerReply}>Owner reply: {review.ownerReply}</p>}
                                        </article>
                                    ))}
                                </div>
                            )}

                            {activeTab === "posts" && (
                                <div className={styles.overviewGrid}>
                                    {posts.length === 0 && <div className={styles.emptyState}>No posts from this venue yet.</div>}
                                    {posts.map((post) => (
                                        <article key={post.id} className={styles.postCard}>
                                            <header className={styles.eventTop}>
                                                <h3 className={styles.panelTitle}>Venue Update</h3>
                                                <span className={styles.panelSubtle}>{new Date(post.createdAt).toLocaleDateString("en-US")}</span>
                                            </header>
                                            <p className={styles.panelSubtle}>{post.content}</p>
                                            {post.matchId && <Link href={`/matches/${post.matchId}`} className={styles.mapLink}>View related match</Link>}
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>

                        <aside className={styles.sideColumn}>
                            <div className={styles.panel}>
                                <h2 className={styles.panelTitle}>Reserve a Table</h2>
                                {mainEvent ? (
                                    <>
                                        <div className={styles.sideListItem}>
                                            {(() => {
                                                const home = getTeam(mainEvent.event.match.homeTeamId);
                                                const away = getTeam(mainEvent.event.match.awayTeamId);
                                                const league = getLeague(mainEvent.event.match.leagueId);
                                                const display = getMatchDisplay(mainEvent.event.match, { homeTeam: home, awayTeam: away, league });
                                                return (
                                                    <>
                                                        <div className={styles.teamsWrap}>
                                                            {display.isSingleEvent ? (
                                                                <LeagueCrest src={league?.image} fallback={league?.logo || "L"} alt={league?.name || "League"} />
                                                            ) : (
                                                                <>
                                                                    <TeamCrest src={home?.image} fallback={home?.crest || "H"} alt={display.homeName} />
                                                                    <span className={styles.vsText}>vs</span>
                                                                    <TeamCrest src={away?.image} fallback={away?.crest || "A"} alt={display.awayName} />
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className={styles.sideMeta}>
                                                            <strong>
                                                                <Link href={`/matches/${mainEvent.event.match.id}`} className={styles.mapLink}>
                                                                    {display.isSingleEvent ? display.title : `${display.homeName} vs ${display.awayName}`}
                                                                </Link>
                                                            </strong>
                                                            <span>{display.isSingleEvent ? display.subtitle || formatMatchDate(mainEvent.event.match.matchDateUTC).date : formatMatchDate(mainEvent.event.match.matchDateUTC).date}</span>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        <div className={styles.sideActions}>
                                            <button
                                                className="btn-primary"
                                                onClick={() => {
                                                    setBookingEventIdx(mainEvent.idx);
                                                    setBookingOpen(true);
                                                }}
                                            >
                                                Book Now
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <p className={styles.panelSubtle}>No active events available for booking.</p>
                                )}
                            </div>

                            {fanTeams.length > 0 && (
                                <div className={styles.panel}>
                                    <h2 className={styles.panelTitle}>This Is a Place for Fans Of</h2>
                                    <p className={styles.panelSubtle}>
                                        {fanTeams.length === 1
                                            ? `This venue welcomes supporters of ${fanTeams[0].name}.`
                                            : "This venue is a strong matchday spot for supporters of these teams."}
                                    </p>
                                    <div className={styles.fanTeamRail}>
                                        {fanTeams.map((team) => (
                                            <Link key={team.id} href={`/teams/${team.slug}`} className={styles.fanTeamCard}>
                                                <div className={styles.fanTeamHeader}>
                                                    <TeamCrest
                                                        src={team.crestUrl || undefined}
                                                        fallback={(team.shortName || team.name).slice(0, 1)}
                                                        alt={team.name}
                                                    />
                                                    <div className={styles.fanTeamText}>
                                                        <strong>{team.name}</strong>
                                                        {team.league ? (
                                                            <span className={styles.fanTeamLeague}>{team.league.shortName || team.league.name}</span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                {team.shortDescription ? (
                                                    <p className={styles.fanTeamDescription}>{team.shortDescription}</p>
                                                ) : null}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className={styles.panel}>
                                <h2 className={styles.panelTitle}>Upcoming at This Venue</h2>
                                <div className={styles.sideList}>
                                    {matchEvents.length === 0 && (
                                        <p className={styles.panelSubtle}>No upcoming events.</p>
                                    )}
                                    {matchEvents.slice(0, 6).map((row, idx) => {
                                        const home = getTeam(row.match.homeTeamId);
                                        const away = getTeam(row.match.awayTeamId);
                                        const league = getLeague(row.match.leagueId);
                                        const display = getMatchDisplay(row.match, { homeTeam: home, awayTeam: away, league });
                                        return (
                                            <div key={row.id} className={styles.sideListItem}>
                                                <div className={styles.teamsWrap}>
                                                    {display.isSingleEvent ? (
                                                        <LeagueCrest src={league?.image} fallback={league?.logo || "L"} alt={league?.name || "League"} />
                                                    ) : (
                                                        <>
                                                            <TeamCrest src={home?.image} fallback={home?.crest || "H"} alt={display.homeName} />
                                                            <span className={styles.vsText}>vs</span>
                                                            <TeamCrest src={away?.image} fallback={away?.crest || "A"} alt={display.awayName} />
                                                        </>
                                                    )}
                                                </div>
                                                <div className={styles.sideMeta}>
                                                    <strong>
                                                        <Link href={`/matches/${row.match.id}`} className={styles.mapLink}>
                                                            {display.isSingleEvent ? display.title : `${display.homeName} vs ${display.awayName}`}
                                                        </Link>
                                                    </strong>
                                                    <span>{display.isSingleEvent ? display.subtitle || formatMatchDate(row.match.matchDateUTC).date : formatMatchDate(row.match.matchDateUTC).date}</span>
                                                </div>
                                                <button
                                                    className="btn-ghost"
                                                    onClick={() => {
                                                        setBookingEventIdx(idx);
                                                        setBookingOpen(true);
                                                    }}
                                                >
                                                    Book
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </aside>
                    </section>

                    {matchEvents.length > 0 && (
                        <BookingDrawer
                            isOpen={bookingOpen}
                            onClose={() => setBookingOpen(false)}
                            venueEventId={selectedEvent?.id}
                            venue={{
                                name: venue.name,
                                address: `${venue.addressLine1}, ${venue.city}`,
                            }}
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
                            spotsRemaining={
                                selectedEvent?.bookingLimit
                                    ? selectedEvent.bookingLimit - selectedEvent.confirmedBookings
                                    : 50
                            }
                            entryFee={selectedEvent?.entryFee || undefined}
                        />
                    )}
                </article>
            </AppShell>
    );
}


export default function VenueProfilePage({ params }: { params: Promise<{ slug: string }> }) {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />}>
            <VenueProfilePageContent params={params} />
        </Suspense>
    );
}
