"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { ThemeProvider, AppShell } from "../../components/AppShell";
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
            <ThemeProvider>
                <AppShell>
                    <div style={{ padding: "40px 20px", color: "var(--text-secondary)" }}>Loading account...</div>
                </AppShell>
            </ThemeProvider>
        );
    }

    if (!isAuthenticated || !user) {
        return (
            <ThemeProvider>
                <AppShell>
                    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
                        <h1 className="font-display text-h1" style={{ color: "var(--text-primary)", marginBottom: "8px" }}>SIGN IN REQUIRED</h1>
                        <p className="text-body" style={{ color: "var(--text-secondary)", marginBottom: "18px" }}>
                            Log in to view your dashboard, bookings, and followed venues.
                        </p>
                        <Link href="/login" className="btn-primary" style={{ textDecoration: "none" }}>Go to Login</Link>
                    </div>
                </AppShell>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider>
            <AppShell>
                <div style={{ maxWidth: "920px", margin: "0 auto", padding: "28px 20px 56px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
                        <div>
                            <h1 className="font-display text-h1" style={{ color: "var(--text-primary)", marginBottom: "4px" }}>
                                {profile?.name || user.name}
                            </h1>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {profile?.email || user.email} · {profile?.role || user.role}
                            </p>
                        </div>
                        <button className="btn-ghost" onClick={() => void logout()} style={{ padding: "10px 14px" }}>Log Out</button>
                    </div>

                    {error && (
                        <div style={{
                            padding: "12px 14px",
                            marginBottom: "14px",
                            borderRadius: "10px",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.35)",
                            color: "var(--accent-danger)",
                            fontSize: "0.82rem",
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                className="btn-ghost"
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: "8px 14px",
                                    borderColor: activeTab === tab.id ? "var(--accent-primary)" : "var(--border)",
                                    color: activeTab === tab.id ? "var(--accent-primary)" : "var(--text-secondary)",
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === "bookings" && (
                        <section>
                            <div className="section-label" style={{ marginBottom: "8px" }}>UPCOMING & PAST BOOKINGS</div>
                            {bookings.length === 0 ? (
                                <div className="card-flat" style={{ padding: "22px" }}>
                                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>No bookings yet.</p>
                                </div>
                            ) : (
                                <div style={{ display: "grid", gap: "10px" }}>
                                    {bookings.map((booking) => (
                                        <div key={booking.id} className="card-flat" style={{ padding: "14px" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                                <span className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                                                    {booking.match?.homeTeamName} vs {booking.match?.awayTeamName}
                                                </span>
                                                <span className="text-xs" style={{ color: "var(--accent-primary)", fontWeight: 700 }}>{booking.status}</span>
                                            </div>
                                            <div className="text-xs" style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
                                                {booking.venue?.name} · Party size {booking.partySize} · Ref {booking.bookingReference}
                                            </div>
                                            <div className="text-xs" style={{ color: "var(--text-muted)", marginTop: "2px" }}>
                                                {new Date(booking.createdAt).toLocaleString("en-US")}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {activeTab === "following" && (
                        <section>
                            <div className="section-label" style={{ marginBottom: "8px" }}>FOLLOWED VENUES</div>
                            {following.length === 0 ? (
                                <div className="card-flat" style={{ padding: "22px" }}>
                                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>You are not following any venues yet.</p>
                                </div>
                            ) : (
                                <div style={{ display: "grid", gap: "10px" }}>
                                    {following.map((venue) => (
                                        <Link key={venue.id} href={`/venues/${venue.slug}`} className="card-flat" style={{ padding: "14px", textDecoration: "none", color: "inherit" }}>
                                            <div className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 700 }}>{venue.name}</div>
                                            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{venue.city || ""}</div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {activeTab === "interests" && (
                        <section>
                            <div className="section-label" style={{ marginBottom: "8px" }}>TEAM INTERESTS</div>
                            <p className="text-xs" style={{ color: "var(--text-muted)", marginBottom: "10px" }}>
                                Select teams to personalize reminders and venue updates.
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px" }}>
                                {interestTeams.map((team) => {
                                    const selected = interestIds.includes(team.id);
                                    return (
                                        <button
                                            key={team.id}
                                            className="btn-ghost"
                                            onClick={() => {
                                                setInterestIds((prev) => selected ? prev.filter((id) => id !== team.id) : [...prev, team.id]);
                                            }}
                                            style={{
                                                padding: "10px",
                                                justifyContent: "flex-start",
                                                borderColor: selected ? "var(--accent-primary)" : "var(--border)",
                                            }}
                                        >
                                            <span>{team.crest}</span>
                                            <span className="text-xs">{team.shortName}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <button className="btn-primary" onClick={() => void handleSaveInterests()} disabled={saving} style={{ marginTop: "12px", padding: "10px 14px" }}>
                                {saving ? "Saving..." : "Save Interests"}
                            </button>
                        </section>
                    )}

                    {activeTab === "profile" && (
                        <section>
                            <div className="section-label" style={{ marginBottom: "8px" }}>PROFILE SETTINGS</div>
                            <div style={{ display: "grid", gap: "10px", maxWidth: "560px" }}>
                                <div className="card-flat" style={{ padding: "12px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                    {normalizeImageUrl(avatarDraft || profile?.avatarUrl || user.avatarUrl) ? (
                                        <img
                                            src={normalizeImageUrl(avatarDraft || profile?.avatarUrl || user.avatarUrl)}
                                            alt="Profile avatar"
                                            style={{
                                                width: "58px",
                                                height: "58px",
                                                borderRadius: "999px",
                                                objectFit: "cover",
                                                border: "1px solid var(--border)",
                                                background: "var(--bg-elevated)",
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: "58px",
                                                height: "58px",
                                                borderRadius: "999px",
                                                border: "1px solid var(--border)",
                                                background: "var(--bg-elevated)",
                                                color: "var(--text-primary)",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "1rem",
                                                fontWeight: 700,
                                            }}
                                            aria-label="Profile avatar placeholder"
                                        >
                                            {(nameDraft || profile?.name || user.name || "U").slice(0, 1).toUpperCase()}
                                        </div>
                                    )}
                                    <label
                                        className="btn-ghost"
                                        style={{
                                            padding: "10px 14px",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            cursor: uploadingAvatar ? "not-allowed" : "pointer",
                                            opacity: uploadingAvatar ? 0.65 : 1,
                                        }}
                                    >
                                        {uploadingAvatar ? <LoaderCircle size={14} /> : <ImagePlus size={14} />}
                                        {uploadingAvatar ? "Uploading..." : "Select Image"}
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
                                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Max file size 4MB</span>
                                </div>
                                <input
                                    value={nameDraft}
                                    onChange={(e) => setNameDraft(e.target.value)}
                                    placeholder="Full name"
                                    style={{
                                        width: "100%",
                                        padding: "12px 14px",
                                        borderRadius: "10px",
                                        border: "1px solid var(--border)",
                                        background: "var(--bg-card)",
                                        color: "var(--text-primary)",
                                    }}
                                />
                                <input
                                    value={avatarDraft}
                                    onChange={(e) => setAvatarDraft(e.target.value)}
                                    placeholder="Avatar image URL"
                                    style={{
                                        width: "100%",
                                        padding: "12px 14px",
                                        borderRadius: "10px",
                                        border: "1px solid var(--border)",
                                        background: "var(--bg-card)",
                                        color: "var(--text-primary)",
                                    }}
                                />
                                <button className="btn-primary" onClick={() => void handleSaveProfile()} disabled={saving} style={{ padding: "10px 14px" }}>
                                    {saving ? "Saving..." : "Save Profile"}
                                </button>
                            </div>
                        </section>
                    )}
                </div>
            </AppShell>
        </ThemeProvider>
    );
}
