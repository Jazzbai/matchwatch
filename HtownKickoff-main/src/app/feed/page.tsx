"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CircleDot, MapPin, Newspaper } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useData } from "../../lib/data-provider";

type FeedPost = {
    id: string;
    venueId: string;
    content: string;
    matchId?: string | null;
    createdAt: string;
    viewsCount: number;
    venue?: {
        id: string;
        name: string;
        slug: string;
    };
};

type FollowingVenue = {
    id: string;
    name: string;
    slug: string;
};

export default function FeedPage() {
    const { isAuthenticated } = useAuth();
    const { venueEvents, getVenue, getMatch, getTeam } = useData();
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [following, setFollowing] = useState<FollowingVenue[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [feedRes, followingRes] = await Promise.all([
                    api.get<FeedPost[]>("/user/feed"),
                    api.get<FollowingVenue[]>("/venues/following"),
                ]);
                setPosts(feedRes.data || []);
                setFollowing(followingRes.data || []);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to load feed";
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [isAuthenticated]);

    const upcomingAtFollowing = useMemo(() => {
        const followed = new Set(following.map((venue) => venue.id));
        return venueEvents
            .filter((event) => followed.has(event.venueId))
            .sort((a, b) => {
                const aMatch = getMatch(a.matchId);
                const bMatch = getMatch(b.matchId);
                const aDate = aMatch ? new Date(aMatch.matchDateUTC).getTime() : Number.MAX_SAFE_INTEGER;
                const bDate = bMatch ? new Date(bMatch.matchDateUTC).getTime() : Number.MAX_SAFE_INTEGER;
                return aDate - bDate;
            })
            .slice(0, 5);
    }, [following, venueEvents, getMatch]);

    if (!isAuthenticated) {
        return (
                <AppShell>
                    <section style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
                        <h1 className="font-display text-h1" style={{ color: "var(--foreground)", marginBottom: "8px" }}>
                            SIGN IN REQUIRED
                        </h1>
                        <p className="text-body" style={{ color: "var(--muted-foreground)", marginBottom: "16px" }}>
                            Log in to view updates from venues you follow.
                        </p>
                        <Link href="/login" className="btn-primary" style={{ textDecoration: "none" }}>
                            Go to Login
                        </Link>
                    </section>
                </AppShell>
        );
    }

    return (
            <AppShell>
                <section style={{ padding: "32px 20px 40px", maxWidth: "920px", margin: "0 auto" }}>
                    <div className="section-label" style={{ marginBottom: "8px" }}>FOLLOWING FEED</div>
                    <h1 className="font-display text-display" style={{ color: "var(--foreground)", marginBottom: "8px" }}>
                        LATEST FROM VENUES
                    </h1>
                    <p className="text-body" style={{ color: "var(--muted-foreground)", marginBottom: "20px" }}>
                        Posts and match reminders from venues you follow.
                    </p>

                    {loading && (
                        <div className="card-flat" style={{ padding: "24px", color: "var(--muted-foreground)" }}>
                            Loading feed...
                        </div>
                    )}

                    {error && (
                        <div style={{
                            padding: "12px 14px",
                            marginBottom: "12px",
                            borderRadius: "10px",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.35)",
                            color: "var(--accent-danger)",
                            fontSize: "0.82rem",
                        }}>
                            {error}
                        </div>
                    )}

                    {!loading && (
                        <>
                            <div style={{ marginBottom: "18px" }}>
                                <div className="section-label" style={{ marginBottom: "8px" }}>UPCOMING AT YOUR VENUES</div>
                                {upcomingAtFollowing.length === 0 ? (
                                    <div className="card-flat" style={{ padding: "16px" }}>
                                        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                                            No upcoming hosted events from followed venues.
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gap: "10px" }}>
                                        {upcomingAtFollowing.map((event) => {
                                            const venue = getVenue(event.venueId);
                                            const match = getMatch(event.matchId);
                                            const home = match ? getTeam(match.homeTeamId) : undefined;
                                            const away = match ? getTeam(match.awayTeamId) : undefined;
                                            return (
                                                <Link
                                                    key={event.id}
                                                    href={venue ? `/venues/${venue.slug}?matchId=${event.matchId}` : "/venues"}
                                                    className="card-flat"
                                                    style={{ padding: "12px 14px", textDecoration: "none", color: "inherit" }}
                                                >
                                                    <div className="text-sm" style={{ color: "var(--foreground)", fontWeight: 700 }}>
                                                        {home?.shortName || "HOME"} vs {away?.shortName || "AWAY"}
                                                    </div>
                                                    <div className="text-xs" style={{ color: "var(--muted-foreground)", marginTop: "2px" }}>
                                                        {venue?.name || "Venue"} · {match ? new Date(match.matchDateUTC).toLocaleString("en-US") : "TBD"}
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {posts.length === 0 ? (
                                <div className="card-flat" style={{ padding: "28px", textAlign: "center" }}>
                                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                                        <Newspaper size={28} style={{ color: "var(--muted-foreground)" }} />
                                    </div>
                                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                                        Nothing in your feed yet. Follow venues to see updates here.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    {posts.map((post) => {
                                        const venue = post.venue || (post.venueId ? getVenue(post.venueId) : undefined);
                                        const match = post.matchId ? getMatch(post.matchId) : undefined;
                                        const homeName = match ? (getTeam(match.homeTeamId)?.shortName || match.homeTeamId) : "";
                                        const awayName = match ? (getTeam(match.awayTeamId)?.shortName || match.awayTeamId) : "";
                                        const postedAt = new Date(post.createdAt);

                                        return (
                                            <article key={post.id} className="card-flat" style={{ padding: "16px" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <MapPin size={16} style={{ color: "var(--muted-foreground)" }} />
                                                        {venue ? (
                                                            <Link href={`/venues/${venue.slug}`} className="text-sm" style={{ color: "var(--foreground)", fontWeight: 700, textDecoration: "none" }}>
                                                                {venue.name}
                                                            </Link>
                                                        ) : (
                                                            <span className="text-sm" style={{ color: "var(--foreground)", fontWeight: 700 }}>
                                                                Venue Update
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                                                        {Number.isNaN(postedAt.getTime())
                                                            ? "Recently"
                                                            : postedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                                    </span>
                                                </div>

                                                <p className="text-sm" style={{ color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: "10px" }}>
                                                    {post.content}
                                                </p>

                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                                    {match ? (
                                                        <Link href={`/matches/${match.id}`} className="text-xs" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                            <CircleDot size={12} />
                                                            {homeName} vs {awayName}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Venue announcement</span>
                                                    )}
                                                    <span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
                                                        {Number(post.viewsCount || 0).toLocaleString()} views
                                                    </span>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </section>
            </AppShell>
    );
}
