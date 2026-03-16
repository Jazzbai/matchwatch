"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImagePlus, LoaderCircle, MapPin, CalendarClock, Settings, Bookmark, X, Loader2 } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { api, uploadApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useData } from "../../lib/data-provider";

type UserProfile = {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    role: string;
    timezone?: string;
    locale?: string;
    stats?: {
        bookings: number;
        following: number;
        unreadNotifications: number;
    };
};

type BookingApiRow = {
    id: string;
    bookingReference: string;
    partySize: number;
    status: string;
    specialRequests?: string;
    createdAt: string;
    venue?: { id: string; name: string; slug?: string; city?: string };
    match?: { id: string; homeTeamName: string; awayTeamName: string; matchDateUtc: string; status?: string };
};

type FollowingVenue = {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string;
    city?: string;
};

const TABS = [
    { id: "bookings", label: "My Bookings" },
    { id: "following", label: "Following" },
    { id: "interests", label: "My Interests" },
    { id: "profile", label: "Profile" },
] as const;

const MAX_AVATAR_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

function normalizeImageUrl(url?: string | null) {
    const value = (url || "").trim();
    if (!value) return "";
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
        return value;
    }
    return `https://${value}`;
}

export default function AccountPage() {
    const { user, isAuthenticated, isLoading: authLoading, logout, refreshUser } = useAuth();
    const { teams } = useData();

    const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("bookings");
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [bookings, setBookings] = useState<BookingApiRow[]>([]);
    const [following, setFollowing] = useState<FollowingVenue[]>([]);
    const [interestIds, setInterestIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [nameDraft, setNameDraft] = useState("");
    const [avatarDraft, setAvatarDraft] = useState("");

    const interestTeams = useMemo(
        () => teams.slice(0, 80),
        [teams],
    );

    const loadData = async () => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const [profileRes, bookingsRes, followingRes, interestsRes] = await Promise.all([
                api.get<UserProfile>("/user/profile"),
                api.get<BookingApiRow[]>("/bookings"),
                api.get<FollowingVenue[]>("/venues/following"),
                api.get<Array<{ id: string }>>("/user/interests"),
            ]);

            setProfile(profileRes.data);
            setNameDraft(profileRes.data.name || "");
            setAvatarDraft(profileRes.data.avatarUrl || "");
            setBookings(bookingsRes.data || []);
            setFollowing(followingRes.data || []);
            setInterestIds((interestsRes.data || []).map((t) => t.id));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load account";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [isAuthenticated]);

    const handleSaveProfile = async () => {
        setSaving(true);
        setError(null);
        try {
            await api.put<{ message: string }>("/user/profile", {
                name: nameDraft,
            });
            if (avatarDraft) {
                await api.post<{ message: string }>("/user/avatar", { avatarUrl: avatarDraft });
            }
            await loadData();
            await refreshUser();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save profile";
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarFileChange = async (file: File | null) => {
        if (!file) return;
        setError(null);

        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            setError("Only JPG, PNG, WEBP, and GIF files are allowed.");
            return;
        }
        if (file.size > MAX_AVATAR_FILE_SIZE) {
            setError("Image is too large. Maximum file size is 4MB.");
            return;
        }

        setUploadingAvatar(true);
        try {
            const presigned = await uploadApi.createPresignedUrl({
                filename: file.name,
                contentType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                purpose: "avatar",
                fileSize: file.size,
            });

            const uploadRes = await fetch(presigned.data.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file,
            });

            if (!uploadRes.ok) {
                throw new Error("Avatar upload failed. Check S3 bucket configuration.");
            }

            const avatarUrl = normalizeImageUrl(presigned.data.publicUrl);
            await api.post<{ message: string }>("/user/avatar", {
                avatarUrl,
                avatarS3Key: presigned.data.key,
            });

            setAvatarDraft(avatarUrl);
            setProfile((prev) => (prev ? { ...prev, avatarUrl } : prev));
            await refreshUser();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to upload avatar";
            setError(message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleCancelBooking = async (bookingId: string) => {
        setCancellingBookingId(bookingId);
        setError(null);
        try {
            await api.delete(`/bookings/${bookingId}`);
            await loadData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to cancel booking";
            setError(message);
        } finally {
            setCancellingBookingId(null);
        }
    };

    const handleSaveInterests = async () => {
        setSaving(true);
        setError(null);
        try {
            await api.post<{ message: string }>("/user/interests", { teamIds: interestIds });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save interests";
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <AppShell>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh", color: "var(--muted-foreground)" }}>Loading account...</div>
            </AppShell>
        );
    }

    if (!isAuthenticated || !user) {
        return (
            <AppShell>
                <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
                    <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 32, fontWeight: 900, color: "var(--foreground)", marginBottom: 16 }}>SIGN IN REQUIRED</h1>
                    <p style={{ fontSize: 15, color: "var(--muted-foreground)", marginBottom: 32 }}>
                        Log in to view your dashboard, bookings, and followed venues.
                    </p>
                    <Link href="/login" style={{ display: "inline-block", padding: "12px 32px", backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, borderRadius: 12, textDecoration: "none", fontSize: 14, boxShadow: "0 4px 12px color-mix(in oklch, var(--primary) 30%, transparent)" }}>
                        Go to Login
                    </Link>
                </div>
            </AppShell>
        );
    }

    const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
        whiteSpace: "nowrap", cursor: "pointer", border: "none", fontFamily: "inherit",
        transition: "all 0.2s",
        backgroundColor: isActive ? "var(--background)" : "transparent",
        color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
        boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        outline: isActive ? "1px solid var(--border)" : "none",
    });

    const sectionTitleStyle: React.CSSProperties = {
        fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
        color: "var(--muted-foreground)", marginBottom: 16,
    };

    const cardBoxStyle: React.CSSProperties = {
        backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
        padding: 20, transition: "box-shadow 0.2s",
    };

    const emptyStateStyle: React.CSSProperties = {
        ...cardBoxStyle, padding: "48px 24px", textAlign: "center",
    };

    const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
        padding: "12px 24px", borderRadius: 12, border: "none",
        backgroundColor: "var(--primary)", color: "var(--primary-foreground)",
        fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit", opacity: disabled ? 0.5 : 1, transition: "all 0.2s",
        boxShadow: "0 2px 8px color-mix(in oklch, var(--primary) 25%, transparent)",
    });

    const inputStyle: React.CSSProperties = {
        width: "100%", padding: "12px 14px", borderRadius: 12,
        border: "1px solid var(--border)", backgroundColor: "var(--background)",
        color: "var(--foreground)", fontFamily: "inherit", fontSize: 14, outline: "none",
    };

    return (
        <AppShell>
            <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px 80px" }}>
                {/* Header */}
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 32 }}>
                    <div>
                        <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 28, fontWeight: 900, color: "var(--foreground)", margin: 0 }}>
                            {profile?.name || user.name}
                        </h1>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{profile?.email || user.email}</span>
                            <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "var(--border)" }} />
                            <span style={{ textTransform: "capitalize" }}>{profile?.role || user.role}</span>
                        </p>
                    </div>
                    <button
                        style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
                        onClick={() => void logout()}
                    >
                        Log Out
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div style={{ marginBottom: 24, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.2)", backgroundColor: "rgba(239,68,68,0.06)", color: "#ef4444", fontSize: 13, fontWeight: 500 }}>
                        {error}
                    </div>
                )}

                {/* Tab Navigation */}
                <div style={{ display: "flex", overflowX: "auto", gap: 6, marginBottom: 32, backgroundColor: "color-mix(in oklch, var(--secondary) 50%, transparent)", padding: 6, borderRadius: 12, border: "1px solid var(--border)" }}>
                    {TABS.map((tab) => (
                        <button key={tab.id} style={tabButtonStyle(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}>
                            {tab.id === "bookings" && <CalendarClock size={16} style={{ color: activeTab === "bookings" ? "var(--primary)" : "inherit" }} />}
                            {tab.id === "following" && <MapPin size={16} style={{ color: activeTab === "following" ? "var(--primary)" : "inherit" }} />}
                            {tab.id === "interests" && <Bookmark size={16} style={{ color: activeTab === "interests" ? "var(--primary)" : "inherit" }} />}
                            {tab.id === "profile" && <Settings size={16} style={{ color: activeTab === "profile" ? "var(--primary)" : "inherit" }} />}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content: Bookings */}
                {activeTab === "bookings" && (
                    <section>
                        <h2 style={sectionTitleStyle}>Upcoming & Past Bookings</h2>
                        {bookings.length === 0 ? (
                            <div style={emptyStateStyle}>
                                <CalendarClock size={40} style={{ margin: "0 auto 12px", color: "var(--muted-foreground)", opacity: 0.5 }} />
                                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>No bookings yet</p>
                                <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>When you book a spot at a watch party, it will appear here.</p>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                                {bookings.map((booking) => {
                                    const statusColor = booking.status === "CONFIRMED" ? "var(--primary)" : booking.status === "CANCELLED" ? "#ef4444" : "var(--muted-foreground)";
                                    return (
                                        <div key={booking.id} style={cardBoxStyle}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                                                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.3 }}>
                                                    {booking.match?.homeTeamName} vs {booking.match?.awayTeamName}
                                                </h3>
                                                <span style={{ flexShrink: 0, padding: "3px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: statusColor, backgroundColor: `color-mix(in oklch, ${statusColor} 10%, transparent)`, border: `1px solid color-mix(in oklch, ${statusColor} 20%, transparent)` }}>
                                                    {booking.status}
                                                </span>
                                            </div>
                                            <div style={{ marginBottom: 16 }}>
                                                <p style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "var(--foreground)", fontWeight: 500 }}>
                                                    <MapPin size={14} style={{ color: "var(--muted-foreground)" }} />
                                                    {booking.venue?.name}
                                                </p>
                                                <p style={{ fontSize: 12, color: "var(--muted-foreground)", paddingLeft: 22, marginTop: 4 }}>
                                                    <strong style={{ color: "var(--foreground)" }}>Party Size:</strong> {booking.partySize} guests
                                                </p>
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontFamily: "monospace", color: "var(--muted-foreground)", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                                                <span>Ref: {booking.bookingReference}</span>
                                                <span>{new Date(booking.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                            </div>
                                            {booking.status !== "CANCELLED_BY_USER" && booking.status !== "CANCELLED_BY_VENUE" && booking.status !== "CANCELLED" && booking.status !== "NO_SHOW" && (
                                                <button
                                                    style={{
                                                        marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                                        padding: "10px 16px", borderRadius: 10,
                                                        border: "1px solid rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.06)",
                                                        color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: cancellingBookingId === booking.id ? "not-allowed" : "pointer",
                                                        fontFamily: "inherit", opacity: cancellingBookingId === booking.id ? 0.5 : 1,
                                                        transition: "all 0.2s",
                                                    }}
                                                    disabled={cancellingBookingId === booking.id}
                                                    onClick={() => void handleCancelBooking(booking.id)}
                                                >
                                                    {cancellingBookingId === booking.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <X size={14} />}
                                                    {cancellingBookingId === booking.id ? "Cancelling..." : "Cancel Reservation"}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {/* Tab Content: Following */}
                {activeTab === "following" && (
                    <section>
                        <h2 style={sectionTitleStyle}>Followed Venues</h2>
                        {following.length === 0 ? (
                            <div style={emptyStateStyle}>
                                <MapPin size={40} style={{ margin: "0 auto 12px", color: "var(--muted-foreground)", opacity: 0.5 }} />
                                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>Not following anywhere yet</p>
                                <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Discover venues on the home page and follow them to get updates.</p>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                                {following.map((venue) => (
                                    <Link key={venue.id} href={`/venues/${venue.slug}`} style={{ textDecoration: "none" }}>
                                        <div style={{ ...cardBoxStyle, cursor: "pointer" }}
                                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                                        >
                                            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>{venue.name}</h3>
                                            <p style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
                                                <MapPin size={12} /> {venue.city || "Unknown Location"}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Tab Content: Interests */}
                {activeTab === "interests" && (
                    <section>
                        <h2 style={sectionTitleStyle}>Team Interests</h2>
                        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24 }}>
                            Select teams to personalize reminders and venue updates.
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
                            {interestTeams.map((team) => {
                                const selected = interestIds.includes(team.id);
                                return (
                                    <button
                                        key={team.id}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 12,
                                            border: selected ? "1px solid var(--primary)" : "1px solid var(--border)",
                                            backgroundColor: selected ? "color-mix(in oklch, var(--primary) 5%, transparent)" : "var(--card)",
                                            cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s",
                                            outline: selected ? "1px solid var(--primary)" : "none",
                                        }}
                                        onClick={() => {
                                            setInterestIds((prev) => selected ? prev.filter((id) => id !== team.id) : [...prev, team.id]);
                                        }}
                                    >
                                        <span style={{ fontSize: 20 }}>{team.crest}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: selected ? "var(--primary)" : "var(--foreground)" }}>{team.shortName}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button style={primaryBtnStyle(saving)} onClick={() => void handleSaveInterests()} disabled={saving}>
                            {saving ? "Saving..." : "Save Interests"}
                        </button>
                    </section>
                )}

                {/* Tab Content: Profile Settings */}
                {activeTab === "profile" && (
                    <section>
                        <h2 style={sectionTitleStyle}>Profile Settings</h2>
                        <div style={{ ...cardBoxStyle, maxWidth: 560, padding: 24 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 24, marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid var(--border)" }}>
                                {normalizeImageUrl(avatarDraft || profile?.avatarUrl || user.avatarUrl) ? (
                                    <img
                                        src={normalizeImageUrl(avatarDraft || profile?.avatarUrl || user.avatarUrl)}
                                        alt="Profile avatar"
                                        style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--background)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", backgroundColor: "var(--secondary)", flexShrink: 0 }}
                                    />
                                ) : (
                                    <div style={{ width: 80, height: 80, borderRadius: "50%", border: "2px solid var(--background)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, flexShrink: 0 }}>
                                        {(nameDraft || profile?.name || user.name || "U").slice(0, 1).toUpperCase()}
                                    </div>
                                )}
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Profile Image</h3>
                                    <label style={{
                                        display: "inline-flex", alignItems: "center", gap: 8,
                                        padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border)",
                                        backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)",
                                        fontSize: 13, fontWeight: 700, cursor: uploadingAvatar ? "not-allowed" : "pointer",
                                        fontFamily: "inherit", opacity: uploadingAvatar ? 0.65 : 1,
                                    }}>
                                        {uploadingAvatar ? <LoaderCircle size={16} /> : <ImagePlus size={16} />}
                                        {uploadingAvatar ? "Uploading..." : "Select New Image"}
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            disabled={uploadingAvatar}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0] || null;
                                                void handleAvatarFileChange(file);
                                                e.currentTarget.value = "";
                                            }}
                                            style={{ display: "none" }}
                                        />
                                    </label>
                                    <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 8 }}>Maximum file size 4MB. Recommended aspect ratio 1:1.</p>
                                </div>
                            </div>

                            <div style={{ display: "grid", gap: 16 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Full Name</label>
                                    <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Enter your full name" style={inputStyle} />
                                </div>

                                <div style={{ paddingTop: 16, display: "flex", justifyContent: "flex-end" }}>
                                    <button style={primaryBtnStyle(saving)} onClick={() => void handleSaveProfile()} disabled={saving}>
                                        {saving ? "Saving Changes..." : "Save Profile"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </AppShell>
    );
}
