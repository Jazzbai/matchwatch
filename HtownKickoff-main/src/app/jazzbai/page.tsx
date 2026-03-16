"use client";

import * as React from "react";
import { AppShell } from "../../components/AppShell";

type TabId = "overview" | "users" | "venues" | "events" | "customEvents" | "matches";

type ApiListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type SuperAdminStats = {
  users: { total: number; active: number };
  venues: { total: number; active: number };
  matches: { total: number };
  bookings: { total: number };
  events: {
    upcoming: number;
    ongoing: number;
    upcomingMatchEvents: number;
    upcomingCustomEvents: number;
  };
};

type SuperAdminSystem = {
  node: string;
  platform: string;
  uptimeSeconds: number;
  loadAverage: number[];
  cpuCores: number;
  memory: {
    totalGb: number;
    usedGb: number;
    freeGb: number;
    usedPercent: number;
  };
  disk: {
    totalGb: number | null;
    usedGb: number | null;
    freeGb: number | null;
    usedPercent: number | null;
  };
  database: { ok: boolean; error?: string };
  s3: {
    region: string;
    bucket: string;
    hasAccessKey: boolean;
    hasCdnUrl: boolean;
    configured: boolean;
    reachable: boolean;
    error: string | null;
  };
};

type LookupVenue = { id: string; name: string; city: string; ownerId: string };
type LookupMatch = {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  matchDateUtc: string;
  status: string;
  leagueId: string | null;
};
type LookupLeague = { id: string; name: string; shortName: string | null };

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "VENUE_OWNER" | "ADMIN" | "SUPER_ADMIN";
  isActive: boolean;
  isSuspended: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  avatarUrl?: string | null;
};

type VenueRow = {
  id: string;
  ownerId: string;
  ownerEmail?: string | null;
  name: string;
  slug: string;
  city: string;
  country: string;
  addressLine1: string;
  lat: string | number;
  lng: string | number;
  coverImageUrl?: string | null;
  galleryImageUrls?: string[];
  galleryS3Keys?: string[] | null;
  isActive: boolean;
  isVerified: boolean;
  isFeatured: boolean;
  phone?: string | null;
  createdAt: string;
};

type MatchEventRow = {
  id: string;
  venueId: string;
  matchId: string;
  isActive: boolean;
  bookingLimit?: number | null;
  confirmedBookingsCount: number;
  specialNotes?: string | null;
  customPrice?: string | null;
  currency?: string | null;
  doorsOpenAt?: string | null;
  requiresApproval: boolean;
  createdAt: string;
  venueName: string;
  homeTeamName: string;
  awayTeamName: string;
  matchDateUtc: string;
};

type CustomEventRow = {
  id: string;
  venueId: string;
  title: string;
  description?: string | null;
  eventTypeTags: string[];
  startsAt: string;
  endsAt: string;
  imageUrl?: string | null;
  imageS3Key?: string | null;
  bookingNotes?: string | null;
  isActive: boolean;
  venueName: string;
  createdAt: string;
};

type CustomEventDraft = {
  title?: string;
  startsAt?: string;
  endsAt?: string;
  eventTypeTags?: string;
  isActive?: boolean;
};

type MatchRow = {
  id: string;
  leagueId?: string | null;
  leagueName?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamCrestUrl?: string | null;
  awayTeamCrestUrl?: string | null;
  matchDateUtc: string;
  status: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED" | "CANCELLED" | "SUSPENDED";
  stage?: string | null;
  venueName?: string | null;
  createdAt: string;
};

type ListResponse<T> = {
  rows: T[];
  meta?: ApiListMeta;
};

async function superAdminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/super-admin${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.error?.message || "Request failed") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return payload.data as T;
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const MATCH_STATUSES: Array<MatchRow["status"]> = [
  "SCHEDULED",
  "TIMED",
  "IN_PLAY",
  "PAUSED",
  "FINISHED",
  "POSTPONED",
  "CANCELLED",
  "SUSPENDED",
];

export default function JazzbaiSuperAdminPage() {
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [adminUsername, setAdminUsername] = React.useState("");
  const [loginUsername, setLoginUsername] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [loggingIn, setLoggingIn] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [activeTab, setActiveTab] = React.useState<TabId>("overview");

  const [stats, setStats] = React.useState<SuperAdminStats | null>(null);
  const [system, setSystem] = React.useState<SuperAdminSystem | null>(null);

  const [lookupsLoading, setLookupsLoading] = React.useState(false);
  const [lookupVenues, setLookupVenues] = React.useState<LookupVenue[]>([]);
  const [lookupMatches, setLookupMatches] = React.useState<LookupMatch[]>([]);
  const [lookupLeagues, setLookupLeagues] = React.useState<LookupLeague[]>([]);

  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [usersMeta, setUsersMeta] = React.useState<ApiListMeta | null>(null);
  const [usersSearch, setUsersSearch] = React.useState("");
  const [usersLoading, setUsersLoading] = React.useState(false);
  const [userDrafts, setUserDrafts] = React.useState<Record<string, Partial<UserRow>>>({});
  const [newUser, setNewUser] = React.useState({
    email: "",
    name: "",
    password: "",
    role: "USER" as UserRow["role"],
  });

  const [venues, setVenues] = React.useState<VenueRow[]>([]);
  const [venuesMeta, setVenuesMeta] = React.useState<ApiListMeta | null>(null);
  const [venuesSearch, setVenuesSearch] = React.useState("");
  const [venuesLoading, setVenuesLoading] = React.useState(false);
  const [venueDrafts, setVenueDrafts] = React.useState<Record<string, Partial<VenueRow>>>({});
  const [newVenue, setNewVenue] = React.useState({
    ownerEmail: "",
    name: "",
    addressLine1: "",
    city: "Houston",
    country: "US",
    lat: "29.7604",
    lng: "-95.3698",
    timezone: "America/Chicago",
    phone: "",
    coverImageUrl: "",
  });

  const [events, setEvents] = React.useState<MatchEventRow[]>([]);
  const [eventsMeta, setEventsMeta] = React.useState<ApiListMeta | null>(null);
  const [eventsSearch, setEventsSearch] = React.useState("");
  const [eventsLoading, setEventsLoading] = React.useState(false);
  const [eventDrafts, setEventDrafts] = React.useState<Record<string, Partial<MatchEventRow>>>({});
  const [newEvent, setNewEvent] = React.useState({
    venueId: "",
    matchId: "",
    bookingLimit: "",
    specialNotes: "",
  });

  const [customEvents, setCustomEvents] = React.useState<CustomEventRow[]>([]);
  const [customEventsMeta, setCustomEventsMeta] = React.useState<ApiListMeta | null>(null);
  const [customEventsSearch, setCustomEventsSearch] = React.useState("");
  const [customEventsLoading, setCustomEventsLoading] = React.useState(false);
  const [customEventDrafts, setCustomEventDrafts] = React.useState<Record<string, CustomEventDraft>>({});
  const [newCustomEvent, setNewCustomEvent] = React.useState({
    venueId: "",
    title: "",
    startsAt: "",
    endsAt: "",
    eventTypeTags: "",
  });

  const [matches, setMatches] = React.useState<MatchRow[]>([]);
  const [matchesMeta, setMatchesMeta] = React.useState<ApiListMeta | null>(null);
  const [matchesSearch, setMatchesSearch] = React.useState("");
  const [matchesLoading, setMatchesLoading] = React.useState(false);
  const [matchDrafts, setMatchDrafts] = React.useState<Record<string, Partial<MatchRow>>>({});
  const [newMatch, setNewMatch] = React.useState({
    leagueId: "",
    homeTeamName: "",
    awayTeamName: "",
    matchDateUtc: "",
    status: "SCHEDULED" as MatchRow["status"],
    venueName: "",
  });

  const [submittingAction, setSubmittingAction] = React.useState<string | null>(null);

  const loadOverview = React.useCallback(async () => {
    const [statsData, systemData] = await Promise.all([
      superAdminFetch<SuperAdminStats>("/stats"),
      superAdminFetch<SuperAdminSystem>("/system"),
    ]);
    setStats(statsData);
    setSystem(systemData);
  }, []);

  const loadLookups = React.useCallback(async () => {
    setLookupsLoading(true);
    try {
      const data = await superAdminFetch<{
        venues: LookupVenue[];
        matches: LookupMatch[];
        leagues: LookupLeague[];
      }>("/lookups");
      setLookupVenues(data.venues || []);
      setLookupMatches(data.matches || []);
      setLookupLeagues(data.leagues || []);
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  const loadUsers = React.useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await fetch(`/api/v1/super-admin/users?page=1&limit=100&search=${encodeURIComponent(usersSearch.trim())}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Failed to load users");
      setUsers(payload.data || []);
      setUsersMeta(payload.meta || null);
    } finally {
      setUsersLoading(false);
    }
  }, [usersSearch]);

  const loadVenues = React.useCallback(async () => {
    setVenuesLoading(true);
    try {
      const response = await fetch(`/api/v1/super-admin/venues?page=1&limit=100&search=${encodeURIComponent(venuesSearch.trim())}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Failed to load venues");
      setVenues(payload.data || []);
      setVenuesMeta(payload.meta || null);
    } finally {
      setVenuesLoading(false);
    }
  }, [venuesSearch]);

  const loadEvents = React.useCallback(async () => {
    setEventsLoading(true);
    try {
      const response = await fetch(`/api/v1/super-admin/events?page=1&limit=100&search=${encodeURIComponent(eventsSearch.trim())}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Failed to load events");
      setEvents(payload.data || []);
      setEventsMeta(payload.meta || null);
    } finally {
      setEventsLoading(false);
    }
  }, [eventsSearch]);

  const loadCustomEvents = React.useCallback(async () => {
    setCustomEventsLoading(true);
    try {
      const response = await fetch(`/api/v1/super-admin/custom-events?page=1&limit=100&search=${encodeURIComponent(customEventsSearch.trim())}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Failed to load custom events");
      setCustomEvents(payload.data || []);
      setCustomEventsMeta(payload.meta || null);
    } finally {
      setCustomEventsLoading(false);
    }
  }, [customEventsSearch]);

  const loadMatches = React.useCallback(async () => {
    setMatchesLoading(true);
    try {
      const response = await fetch(`/api/v1/super-admin/matches?page=1&limit=120&search=${encodeURIComponent(matchesSearch.trim())}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Failed to load matches");
      setMatches(payload.data || []);
      setMatchesMeta(payload.meta || null);
    } finally {
      setMatchesLoading(false);
    }
  }, [matchesSearch]);

  const loadTabData = React.useCallback(async (tab: TabId) => {
    if (tab === "overview") {
      await Promise.all([loadOverview(), loadLookups()]);
      return;
    }
    if (tab === "users") {
      await loadUsers();
      return;
    }
    if (tab === "venues") {
      await Promise.all([loadVenues(), loadLookups()]);
      return;
    }
    if (tab === "events") {
      await Promise.all([loadEvents(), loadLookups()]);
      return;
    }
    if (tab === "customEvents") {
      await Promise.all([loadCustomEvents(), loadLookups()]);
      return;
    }
    await Promise.all([loadMatches(), loadLookups()]);
  }, [loadCustomEvents, loadEvents, loadLookups, loadMatches, loadOverview, loadUsers, loadVenues]);

  React.useEffect(() => {
    async function checkSession() {
      setCheckingSession(true);
      try {
        const data = await superAdminFetch<{ authenticated: boolean; username: string }>("/session");
        setAuthenticated(Boolean(data.authenticated));
        setAdminUsername(data.username || "");
      } catch {
        setAuthenticated(false);
        setAdminUsername("");
      } finally {
        setCheckingSession(false);
      }
    }
    void checkSession();
  }, []);

  React.useEffect(() => {
    if (!authenticated) return;
    void loadTabData(activeTab);
  }, [activeTab, authenticated, loadTabData]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoggingIn(true);
    try {
      const data = await superAdminFetch<{ username: string }>("/login", {
        method: "POST",
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      setAuthenticated(true);
      setAdminUsername(data.username || loginUsername.trim());
      setLoginPassword("");
      setActiveTab("overview");
      await loadTabData("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await superAdminFetch<{ message: string }>("/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setAuthenticated(false);
      setAdminUsername("");
      setUsers([]);
      setVenues([]);
      setEvents([]);
      setCustomEvents([]);
      setMatches([]);
    }
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    setError(null);
    setSubmittingAction(key);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmittingAction(null);
    }
  };

  if (checkingSession) {
    return (
      <AppShell>
        <main style={{ maxWidth: 840, margin: "0 auto", padding: "48px 20px" }}>
          <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", padding: 24, color: "var(--muted-foreground)" }}>
            Checking super admin session...
          </div>
        </main>
      </AppShell>
    );
  }

  if (!authenticated) {
    return (
      <AppShell>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "72px 20px" }}>
          <section style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--card)", padding: 24 }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 800 }}>
              JazzBai Control
            </p>
            <h1 style={{ margin: "8px 0 6px", fontSize: 30, lineHeight: 1.1, color: "var(--foreground)", fontWeight: 900 }}>Super Admin Login</h1>
            <p style={{ margin: "0 0 20px", color: "var(--muted-foreground)", fontSize: 14 }}>
              Restricted area. Enter super admin credentials from server environment variables.
            </p>

            {error && (
              <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", background: "rgba(239,68,68,0.08)", fontSize: 13 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
                  Username
                </span>
                <input
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="super-admin"
                  autoComplete="username"
                  style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)", padding: "11px 12px", fontSize: 14 }}
                  required
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
                  Password
                </span>
                <input
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)", padding: "11px 12px", fontSize: 14 }}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={loggingIn}
                style={{ marginTop: 4, border: "none", borderRadius: 10, padding: "11px 14px", background: "var(--primary)", color: "var(--primary-foreground)", fontSize: 14, fontWeight: 800, cursor: loggingIn ? "not-allowed" : "pointer", opacity: loggingIn ? 0.7 : 1 }}
              >
                {loggingIn ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </section>
        </main>
      </AppShell>
    );
  }

  const pageStyle: React.CSSProperties = {
    maxWidth: 1440,
    margin: "0 auto",
    padding: "28px 20px 80px",
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "var(--card)",
    overflow: "hidden",
  };

  const sectionHeadStyle: React.CSSProperties = {
    padding: "16px 18px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  };

  const tableWrapStyle: React.CSSProperties = {
    overflowX: "auto",
    width: "100%",
  };

  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    minWidth: 940,
  };

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 12px",
    color: "var(--muted-foreground)",
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    borderBottom: "1px solid var(--border)",
    background: "color-mix(in oklch, var(--secondary) 70%, transparent)",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
    color: "var(--foreground)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--secondary)",
    color: "var(--foreground)",
    padding: "8px 10px",
    fontSize: 13,
  };

  const smallBtn = (kind: "primary" | "outline" | "danger" = "outline", disabled = false): React.CSSProperties => ({
    borderRadius: 8,
    border: kind === "outline" ? "1px solid var(--border)" : kind === "danger" ? "1px solid rgba(239,68,68,0.35)" : "none",
    background: kind === "primary" ? "var(--primary)" : kind === "danger" ? "rgba(239,68,68,0.08)" : "var(--secondary)",
    color: kind === "primary" ? "var(--primary-foreground)" : kind === "danger" ? "#ef4444" : "var(--secondary-foreground)",
    padding: "8px 10px",
    fontWeight: 700,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  });

  const usersCount = usersMeta?.total ?? users.length;
  const venuesCount = venuesMeta?.total ?? venues.length;
  const eventsCount = eventsMeta?.total ?? events.length;
  const customEventsCount = customEventsMeta?.total ?? customEvents.length;
  const matchesCount = matchesMeta?.total ?? matches.length;

  return (
    <AppShell>
      <main style={pageStyle}>
        <header style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 800 }}>
              JazzBai Domain
            </p>
            <h1 style={{ margin: "6px 0 4px", fontSize: 30, lineHeight: 1.05, color: "var(--foreground)", fontWeight: 900 }}>Super Admin Control Center</h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
              Logged in as <strong style={{ color: "var(--foreground)" }}>{adminUsername}</strong>
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => void loadTabData(activeTab)}
              style={smallBtn("outline", Boolean(submittingAction))}
              disabled={Boolean(submittingAction)}
            >
              Refresh
            </button>
            <button
              onClick={() => void handleLogout()}
              style={smallBtn("danger")}
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", background: "rgba(239,68,68,0.08)", fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {([
            ["overview", "Overview"],
            ["users", "Users"],
            ["venues", "Venues"],
            ["events", "Match Events"],
            ["customEvents", "Custom Events"],
            ["matches", "Matches"],
          ] as Array<[TabId, string]>).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                ...smallBtn(activeTab === id ? "primary" : "outline"),
                padding: "9px 13px",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <section style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              {[
                { label: "Total Users", value: stats?.users.total ?? 0 },
                { label: "Active Users", value: stats?.users.active ?? 0 },
                { label: "Active Venues", value: stats?.venues.active ?? 0 },
                { label: "Ongoing Events", value: stats?.events.ongoing ?? 0 },
                { label: "Upcoming Events", value: stats?.events.upcoming ?? 0 },
                { label: "Total Matches", value: stats?.matches.total ?? 0 },
                { label: "Total Bookings", value: stats?.bookings.total ?? 0 },
              ].map((item) => (
                <div key={item.label} style={{ ...cardStyle, padding: 14 }}>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                    {item.label}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 900, color: "var(--foreground)" }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 16, color: "var(--foreground)", fontWeight: 800 }}>Infrastructure Status</h2>
                {lookupsLoading && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Refreshing...</span>}
              </div>
              <div style={{ padding: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>System Memory</p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
                    Used {system?.memory.usedGb ?? 0} GB / {system?.memory.totalGb ?? 0} GB ({system?.memory.usedPercent ?? 0}%)
                  </p>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>Disk</p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
                    Used {system?.disk.usedGb ?? 0} GB / {system?.disk.totalGb ?? 0} GB ({system?.disk.usedPercent ?? 0}%)
                  </p>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>Database</p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: (system?.database.ok ? "#22c55e" : "#ef4444") }}>
                    {system?.database.ok ? "Connected" : `Down: ${system?.database.error || "Unknown error"}`}
                  </p>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>S3 Bucket</p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: system?.s3.reachable ? "#22c55e" : "#ef4444" }}>
                    {system?.s3.reachable ? "Reachable" : "Not reachable"}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
                    {system?.s3.bucket || "No bucket configured"} ({system?.s3.region || "N/A"})
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "users" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Create User</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "2fr 2fr 2fr 1.2fr auto" }}>
                <input style={inputStyle} placeholder="Email" value={newUser.email} onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))} />
                <input style={inputStyle} placeholder="Name" value={newUser.name} onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))} />
                <input style={inputStyle} placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))} />
                <select style={inputStyle} value={newUser.role} onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value as UserRow["role"] }))}>
                  <option value="USER">USER</option>
                  <option value="VENUE_OWNER">VENUE_OWNER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
                <button
                  style={smallBtn("primary", submittingAction === "create-user")}
                  disabled={submittingAction === "create-user"}
                  onClick={() => void runAction("create-user", async () => {
                    await superAdminFetch("/users", {
                      method: "POST",
                      body: JSON.stringify(newUser),
                    });
                    setNewUser({ email: "", name: "", password: "", role: "USER" });
                    await loadUsers();
                    await loadOverview();
                  })}
                >
                  Create
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Users ({usersCount})</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    placeholder="Search users"
                    style={{ ...inputStyle, minWidth: 220 }}
                  />
                  <button style={smallBtn("outline", usersLoading)} onClick={() => void loadUsers()} disabled={usersLoading}>Search</button>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Suspended</th>
                      <th style={thStyle}>Created</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((row) => {
                      const draft = userDrafts[row.id] ?? {
                        name: row.name,
                        role: row.role,
                        isActive: row.isActive,
                        isSuspended: row.isSuspended,
                      };
                      return (
                        <tr key={row.id}>
                          <td style={tdStyle}>{row.email}</td>
                          <td style={tdStyle}>
                            <input style={inputStyle} value={String(draft.name ?? "")} onChange={(e) => setUserDrafts((prev) => ({ ...prev, [row.id]: { ...draft, name: e.target.value } }))} />
                          </td>
                          <td style={tdStyle}>
                            <select style={inputStyle} value={String(draft.role ?? "USER")} onChange={(e) => setUserDrafts((prev) => ({ ...prev, [row.id]: { ...draft, role: e.target.value as UserRow["role"] } }))}>
                              <option value="USER">USER</option>
                              <option value="VENUE_OWNER">VENUE_OWNER</option>
                              <option value="ADMIN">ADMIN</option>
                              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                            </select>
                          </td>
                          <td style={tdStyle}>
                            <input type="checkbox" checked={Boolean(draft.isActive)} onChange={(e) => setUserDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isActive: e.target.checked } }))} />
                          </td>
                          <td style={tdStyle}>
                            <input type="checkbox" checked={Boolean(draft.isSuspended)} onChange={(e) => setUserDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isSuspended: e.target.checked } }))} />
                          </td>
                          <td style={tdStyle}>{formatDateTime(row.createdAt)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={smallBtn("primary", submittingAction === `save-user-${row.id}`)}
                                disabled={submittingAction === `save-user-${row.id}`}
                                onClick={() => void runAction(`save-user-${row.id}`, async () => {
                                  await superAdminFetch(`/users/${row.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      name: draft.name,
                                      role: draft.role,
                                      isActive: draft.isActive,
                                      isSuspended: draft.isSuspended,
                                    }),
                                  });
                                  await loadUsers();
                                  await loadOverview();
                                })}
                              >
                                Save
                              </button>
                              <button
                                style={smallBtn("danger", submittingAction === `deactivate-user-${row.id}`)}
                                disabled={submittingAction === `deactivate-user-${row.id}`}
                                onClick={() => void runAction(`deactivate-user-${row.id}`, async () => {
                                  await superAdminFetch(`/users/${row.id}`, { method: "DELETE" });
                                  await loadUsers();
                                  await loadOverview();
                                })}
                              >
                                Deactivate
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "venues" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Create Venue</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <input style={inputStyle} placeholder="Owner email" value={newVenue.ownerEmail} onChange={(e) => setNewVenue((prev) => ({ ...prev, ownerEmail: e.target.value }))} />
                <input style={inputStyle} placeholder="Venue name" value={newVenue.name} onChange={(e) => setNewVenue((prev) => ({ ...prev, name: e.target.value }))} />
                <input style={inputStyle} placeholder="Address" value={newVenue.addressLine1} onChange={(e) => setNewVenue((prev) => ({ ...prev, addressLine1: e.target.value }))} />
                <input style={inputStyle} placeholder="City" value={newVenue.city} onChange={(e) => setNewVenue((prev) => ({ ...prev, city: e.target.value }))} />
                <input style={inputStyle} placeholder="Country" value={newVenue.country} onChange={(e) => setNewVenue((prev) => ({ ...prev, country: e.target.value }))} />
                <input style={inputStyle} placeholder="Lat" value={newVenue.lat} onChange={(e) => setNewVenue((prev) => ({ ...prev, lat: e.target.value }))} />
                <input style={inputStyle} placeholder="Lng" value={newVenue.lng} onChange={(e) => setNewVenue((prev) => ({ ...prev, lng: e.target.value }))} />
                <input style={inputStyle} placeholder="Timezone" value={newVenue.timezone} onChange={(e) => setNewVenue((prev) => ({ ...prev, timezone: e.target.value }))} />
                <input style={inputStyle} placeholder="Cover image URL" value={newVenue.coverImageUrl} onChange={(e) => setNewVenue((prev) => ({ ...prev, coverImageUrl: e.target.value }))} />
                <button
                  style={smallBtn("primary", submittingAction === "create-venue")}
                  disabled={submittingAction === "create-venue"}
                  onClick={() => void runAction("create-venue", async () => {
                    await superAdminFetch("/venues", {
                      method: "POST",
                      body: JSON.stringify({
                        ...newVenue,
                        lat: Number(newVenue.lat),
                        lng: Number(newVenue.lng),
                      }),
                    });
                    setNewVenue({
                      ownerEmail: "",
                      name: "",
                      addressLine1: "",
                      city: "Houston",
                      country: "US",
                      lat: "29.7604",
                      lng: "-95.3698",
                      timezone: "America/Chicago",
                      phone: "",
                      coverImageUrl: "",
                    });
                    await Promise.all([loadVenues(), loadLookups(), loadOverview()]);
                  })}
                >
                  Create Venue
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Venues ({venuesCount})</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={venuesSearch} onChange={(e) => setVenuesSearch(e.target.value)} placeholder="Search venues" style={{ ...inputStyle, minWidth: 220 }} />
                  <button style={smallBtn("outline", venuesLoading)} onClick={() => void loadVenues()} disabled={venuesLoading}>Search</button>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Owner</th>
                      <th style={thStyle}>City</th>
                      <th style={thStyle}>Cover</th>
                      <th style={thStyle}>Gallery URLs</th>
                      <th style={thStyle}>Verified</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Featured</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venues.map((row) => {
                      const draft = venueDrafts[row.id] ?? {
                        name: row.name,
                        city: row.city,
                        coverImageUrl: row.coverImageUrl || "",
                        galleryImageUrls: row.galleryImageUrls || [],
                        isVerified: row.isVerified,
                        isActive: row.isActive,
                        isFeatured: row.isFeatured,
                      };
                      return (
                        <tr key={row.id}>
                          <td style={tdStyle}>
                            <input style={inputStyle} value={String(draft.name ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, name: e.target.value } }))} />
                          </td>
                          <td style={tdStyle}>{row.ownerEmail || row.ownerId}</td>
                          <td style={tdStyle}>
                            <input style={inputStyle} value={String(draft.city ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, city: e.target.value } }))} />
                          </td>
                          <td style={tdStyle}>
                            <input style={inputStyle} value={String(draft.coverImageUrl ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, coverImageUrl: e.target.value } }))} />
                          </td>
                          <td style={tdStyle}>
                            <input
                              style={inputStyle}
                              value={Array.isArray(draft.galleryImageUrls) ? draft.galleryImageUrls.join(", ") : ""}
                              onChange={(e) => setVenueDrafts((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...draft,
                                  galleryImageUrls: e.target.value
                                    .split(",")
                                    .map((item) => item.trim())
                                    .filter(Boolean),
                                },
                              }))}
                            />
                          </td>
                          <td style={tdStyle}><input type="checkbox" checked={Boolean(draft.isVerified)} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isVerified: e.target.checked } }))} /></td>
                          <td style={tdStyle}><input type="checkbox" checked={Boolean(draft.isActive)} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isActive: e.target.checked } }))} /></td>
                          <td style={tdStyle}><input type="checkbox" checked={Boolean(draft.isFeatured)} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isFeatured: e.target.checked } }))} /></td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={smallBtn("primary", submittingAction === `save-venue-${row.id}`)}
                                disabled={submittingAction === `save-venue-${row.id}`}
                                onClick={() => void runAction(`save-venue-${row.id}`, async () => {
                                  await superAdminFetch(`/venues/${row.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      name: draft.name,
                                      city: draft.city,
                                      coverImageUrl: draft.coverImageUrl || null,
                                      galleryImageUrls: draft.galleryImageUrls || [],
                                      isVerified: draft.isVerified,
                                      isActive: draft.isActive,
                                      isFeatured: draft.isFeatured,
                                    }),
                                  });
                                  await Promise.all([loadVenues(), loadOverview()]);
                                })}
                              >
                                Save
                              </button>
                              <button
                                style={smallBtn("danger", submittingAction === `archive-venue-${row.id}`)}
                                disabled={submittingAction === `archive-venue-${row.id}`}
                                onClick={() => void runAction(`archive-venue-${row.id}`, async () => {
                                  await superAdminFetch(`/venues/${row.id}`, { method: "DELETE" });
                                  await Promise.all([loadVenues(), loadOverview()]);
                                })}
                              >
                                Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "events" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Create Match Event</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "2fr 3fr 1.4fr 2fr auto" }}>
                <select style={inputStyle} value={newEvent.venueId} onChange={(e) => setNewEvent((prev) => ({ ...prev, venueId: e.target.value }))}>
                  <option value="">Select venue</option>
                  {lookupVenues.map((venue) => (
                    <option key={venue.id} value={venue.id}>{venue.name} ({venue.city})</option>
                  ))}
                </select>
                <select style={inputStyle} value={newEvent.matchId} onChange={(e) => setNewEvent((prev) => ({ ...prev, matchId: e.target.value }))}>
                  <option value="">Select match</option>
                  {lookupMatches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.homeTeamName} vs {match.awayTeamName} - {formatDateTime(match.matchDateUtc)}
                    </option>
                  ))}
                </select>
                <input style={inputStyle} placeholder="Booking limit" value={newEvent.bookingLimit} onChange={(e) => setNewEvent((prev) => ({ ...prev, bookingLimit: e.target.value }))} />
                <input style={inputStyle} placeholder="Special notes" value={newEvent.specialNotes} onChange={(e) => setNewEvent((prev) => ({ ...prev, specialNotes: e.target.value }))} />
                <button
                  style={smallBtn("primary", submittingAction === "create-event")}
                  disabled={submittingAction === "create-event"}
                  onClick={() => void runAction("create-event", async () => {
                    await superAdminFetch("/events", {
                      method: "POST",
                      body: JSON.stringify({
                        venueId: newEvent.venueId,
                        matchId: newEvent.matchId,
                        bookingLimit: newEvent.bookingLimit ? Number(newEvent.bookingLimit) : undefined,
                        specialNotes: newEvent.specialNotes || undefined,
                      }),
                    });
                    setNewEvent({ venueId: "", matchId: "", bookingLimit: "", specialNotes: "" });
                    await Promise.all([loadEvents(), loadOverview()]);
                  })}
                >
                  Create
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Match Events ({eventsCount})</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={eventsSearch} onChange={(e) => setEventsSearch(e.target.value)} placeholder="Search events" style={{ ...inputStyle, minWidth: 220 }} />
                  <button style={smallBtn("outline", eventsLoading)} onClick={() => void loadEvents()} disabled={eventsLoading}>Search</button>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Venue</th>
                      <th style={thStyle}>Match</th>
                      <th style={thStyle}>Kickoff</th>
                      <th style={thStyle}>Limit</th>
                      <th style={thStyle}>Notes</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((row) => {
                      const draft = eventDrafts[row.id] ?? {
                        bookingLimit: row.bookingLimit ?? null,
                        specialNotes: row.specialNotes || "",
                        isActive: row.isActive,
                      };
                      return (
                        <tr key={row.id}>
                          <td style={tdStyle}>{row.venueName}</td>
                          <td style={tdStyle}>{row.homeTeamName} vs {row.awayTeamName}</td>
                          <td style={tdStyle}>{formatDateTime(row.matchDateUtc)}</td>
                          <td style={tdStyle}>
                            <input
                              style={inputStyle}
                              type="number"
                              value={draft.bookingLimit == null ? "" : String(draft.bookingLimit)}
                              onChange={(e) => setEventDrafts((prev) => ({ ...prev, [row.id]: { ...draft, bookingLimit: e.target.value ? Number(e.target.value) : null } }))}
                            />
                          </td>
                          <td style={tdStyle}>
                            <input style={inputStyle} value={String(draft.specialNotes ?? "")} onChange={(e) => setEventDrafts((prev) => ({ ...prev, [row.id]: { ...draft, specialNotes: e.target.value } }))} />
                          </td>
                          <td style={tdStyle}>
                            <input type="checkbox" checked={Boolean(draft.isActive)} onChange={(e) => setEventDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isActive: e.target.checked } }))} />
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={smallBtn("primary", submittingAction === `save-event-${row.id}`)}
                                disabled={submittingAction === `save-event-${row.id}`}
                                onClick={() => void runAction(`save-event-${row.id}`, async () => {
                                  await superAdminFetch(`/events/${row.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      bookingLimit: draft.bookingLimit,
                                      specialNotes: draft.specialNotes || null,
                                      isActive: draft.isActive,
                                    }),
                                  });
                                  await Promise.all([loadEvents(), loadOverview()]);
                                })}
                              >
                                Save
                              </button>
                              <button
                                style={smallBtn("danger", submittingAction === `archive-event-${row.id}`)}
                                disabled={submittingAction === `archive-event-${row.id}`}
                                onClick={() => void runAction(`archive-event-${row.id}`, async () => {
                                  await superAdminFetch(`/events/${row.id}`, { method: "DELETE" });
                                  await Promise.all([loadEvents(), loadOverview()]);
                                })}
                              >
                                Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "customEvents" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Create Custom Event</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "2fr 2fr 1.6fr 1.6fr 2fr auto" }}>
                <select style={inputStyle} value={newCustomEvent.venueId} onChange={(e) => setNewCustomEvent((prev) => ({ ...prev, venueId: e.target.value }))}>
                  <option value="">Select venue</option>
                  {lookupVenues.map((venue) => (
                    <option key={venue.id} value={venue.id}>{venue.name} ({venue.city})</option>
                  ))}
                </select>
                <input style={inputStyle} placeholder="Title" value={newCustomEvent.title} onChange={(e) => setNewCustomEvent((prev) => ({ ...prev, title: e.target.value }))} />
                <input style={inputStyle} type="datetime-local" placeholder="Starts at" value={newCustomEvent.startsAt} onChange={(e) => setNewCustomEvent((prev) => ({ ...prev, startsAt: e.target.value }))} />
                <input style={inputStyle} type="datetime-local" placeholder="Ends at" value={newCustomEvent.endsAt} onChange={(e) => setNewCustomEvent((prev) => ({ ...prev, endsAt: e.target.value }))} />
                <input style={inputStyle} placeholder="Tags (comma separated)" value={newCustomEvent.eventTypeTags} onChange={(e) => setNewCustomEvent((prev) => ({ ...prev, eventTypeTags: e.target.value }))} />
                <button
                  style={smallBtn("primary", submittingAction === "create-custom-event")}
                  disabled={submittingAction === "create-custom-event"}
                  onClick={() => void runAction("create-custom-event", async () => {
                    await superAdminFetch("/custom-events", {
                      method: "POST",
                      body: JSON.stringify({
                        venueId: newCustomEvent.venueId,
                        title: newCustomEvent.title,
                        startsAt: new Date(newCustomEvent.startsAt).toISOString(),
                        endsAt: new Date(newCustomEvent.endsAt).toISOString(),
                        eventTypeTags: newCustomEvent.eventTypeTags
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      }),
                    });
                    setNewCustomEvent({ venueId: "", title: "", startsAt: "", endsAt: "", eventTypeTags: "" });
                    await Promise.all([loadCustomEvents(), loadOverview()]);
                  })}
                >
                  Create
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Custom Events ({customEventsCount})</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={customEventsSearch} onChange={(e) => setCustomEventsSearch(e.target.value)} placeholder="Search custom events" style={{ ...inputStyle, minWidth: 220 }} />
                  <button style={smallBtn("outline", customEventsLoading)} onClick={() => void loadCustomEvents()} disabled={customEventsLoading}>Search</button>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Venue</th>
                      <th style={thStyle}>Title</th>
                      <th style={thStyle}>Starts</th>
                      <th style={thStyle}>Ends</th>
                      <th style={thStyle}>Tags</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customEvents.map((row) => {
                      const draft = customEventDrafts[row.id] ?? {
                        title: row.title,
                        startsAt: toDatetimeLocal(row.startsAt),
                        endsAt: toDatetimeLocal(row.endsAt),
                        eventTypeTags: row.eventTypeTags.join(", "),
                        isActive: row.isActive,
                      };
                      return (
                        <tr key={row.id}>
                          <td style={tdStyle}>{row.venueName}</td>
                          <td style={tdStyle}>
                            <input style={inputStyle} value={String(draft.title ?? "")} onChange={(e) => setCustomEventDrafts((prev) => ({ ...prev, [row.id]: { ...draft, title: e.target.value } }))} />
                          </td>
                          <td style={tdStyle}>
                            <input style={inputStyle} type="datetime-local" value={String(draft.startsAt ?? "")} onChange={(e) => setCustomEventDrafts((prev) => ({ ...prev, [row.id]: { ...draft, startsAt: e.target.value } }))} />
                          </td>
                          <td style={tdStyle}>
                            <input style={inputStyle} type="datetime-local" value={String(draft.endsAt ?? "")} onChange={(e) => setCustomEventDrafts((prev) => ({ ...prev, [row.id]: { ...draft, endsAt: e.target.value } }))} />
                          </td>
                          <td style={tdStyle}>
                            <input style={inputStyle} value={String(draft.eventTypeTags ?? "")} onChange={(e) => setCustomEventDrafts((prev) => ({ ...prev, [row.id]: { ...draft, eventTypeTags: e.target.value } }))} />
                          </td>
                          <td style={tdStyle}>
                            <input type="checkbox" checked={Boolean(draft.isActive)} onChange={(e) => setCustomEventDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isActive: e.target.checked } }))} />
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={smallBtn("primary", submittingAction === `save-custom-event-${row.id}`)}
                                disabled={submittingAction === `save-custom-event-${row.id}`}
                                onClick={() => void runAction(`save-custom-event-${row.id}`, async () => {
                                  await superAdminFetch(`/custom-events/${row.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      title: draft.title,
                                      startsAt: draft.startsAt ? new Date(String(draft.startsAt)).toISOString() : undefined,
                                      endsAt: draft.endsAt ? new Date(String(draft.endsAt)).toISOString() : undefined,
                                      eventTypeTags: String(draft.eventTypeTags || "")
                                        .split(",")
                                        .map((item) => item.trim())
                                        .filter(Boolean),
                                      isActive: draft.isActive,
                                    }),
                                  });
                                  await Promise.all([loadCustomEvents(), loadOverview()]);
                                })}
                              >
                                Save
                              </button>
                              <button
                                style={smallBtn("danger", submittingAction === `archive-custom-event-${row.id}`)}
                                disabled={submittingAction === `archive-custom-event-${row.id}`}
                                onClick={() => void runAction(`archive-custom-event-${row.id}`, async () => {
                                  await superAdminFetch(`/custom-events/${row.id}`, { method: "DELETE" });
                                  await Promise.all([loadCustomEvents(), loadOverview()]);
                                })}
                              >
                                Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "matches" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Create Match</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "2fr 2fr 2fr 2fr 1.2fr 2fr auto" }}>
                <select style={inputStyle} value={newMatch.leagueId} onChange={(e) => setNewMatch((prev) => ({ ...prev, leagueId: e.target.value }))}>
                  <option value="">League</option>
                  {lookupLeagues.map((league) => (
                    <option key={league.id} value={league.id}>{league.shortName || league.name}</option>
                  ))}
                </select>
                <input style={inputStyle} placeholder="Home team" value={newMatch.homeTeamName} onChange={(e) => setNewMatch((prev) => ({ ...prev, homeTeamName: e.target.value }))} />
                <input style={inputStyle} placeholder="Away team" value={newMatch.awayTeamName} onChange={(e) => setNewMatch((prev) => ({ ...prev, awayTeamName: e.target.value }))} />
                <input style={inputStyle} type="datetime-local" value={newMatch.matchDateUtc} onChange={(e) => setNewMatch((prev) => ({ ...prev, matchDateUtc: e.target.value }))} />
                <select style={inputStyle} value={newMatch.status} onChange={(e) => setNewMatch((prev) => ({ ...prev, status: e.target.value as MatchRow["status"] }))}>
                  {MATCH_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <input style={inputStyle} placeholder="Venue name" value={newMatch.venueName} onChange={(e) => setNewMatch((prev) => ({ ...prev, venueName: e.target.value }))} />
                <button
                  style={smallBtn("primary", submittingAction === "create-match")}
                  disabled={submittingAction === "create-match"}
                  onClick={() => void runAction("create-match", async () => {
                    await superAdminFetch("/matches", {
                      method: "POST",
                      body: JSON.stringify({
                        leagueId: newMatch.leagueId || null,
                        homeTeamName: newMatch.homeTeamName,
                        awayTeamName: newMatch.awayTeamName,
                        matchDateUtc: new Date(newMatch.matchDateUtc).toISOString(),
                        status: newMatch.status,
                        venueName: newMatch.venueName || null,
                      }),
                    });
                    setNewMatch({
                      leagueId: "",
                      homeTeamName: "",
                      awayTeamName: "",
                      matchDateUtc: "",
                      status: "SCHEDULED",
                      venueName: "",
                    });
                    await Promise.all([loadMatches(), loadLookups(), loadOverview()]);
                  })}
                >
                  Create
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Matches ({matchesCount})</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={matchesSearch} onChange={(e) => setMatchesSearch(e.target.value)} placeholder="Search matches" style={{ ...inputStyle, minWidth: 220 }} />
                  <button style={smallBtn("outline", matchesLoading)} onClick={() => void loadMatches()} disabled={matchesLoading}>Search</button>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>League</th>
                      <th style={thStyle}>Home</th>
                      <th style={thStyle}>Away</th>
                      <th style={thStyle}>Kickoff</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Venue</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((row) => {
                      const draft = matchDrafts[row.id] ?? {
                        leagueId: row.leagueId || "",
                        homeTeamName: row.homeTeamName,
                        awayTeamName: row.awayTeamName,
                        matchDateUtc: toDatetimeLocal(row.matchDateUtc),
                        status: row.status,
                        venueName: row.venueName || "",
                      };
                      return (
                        <tr key={row.id}>
                          <td style={tdStyle}>
                            <select style={inputStyle} value={String(draft.leagueId || "")} onChange={(e) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, leagueId: e.target.value } }))}>
                              <option value="">No league</option>
                              {lookupLeagues.map((league) => (
                                <option key={league.id} value={league.id}>{league.shortName || league.name}</option>
                              ))}
                            </select>
                          </td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.homeTeamName ?? "")} onChange={(e) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, homeTeamName: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.awayTeamName ?? "")} onChange={(e) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, awayTeamName: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} type="datetime-local" value={String(draft.matchDateUtc ?? "")} onChange={(e) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, matchDateUtc: e.target.value } }))} /></td>
                          <td style={tdStyle}>
                            <select style={inputStyle} value={String(draft.status ?? "SCHEDULED")} onChange={(e) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, status: e.target.value as MatchRow["status"] } }))}>
                              {MATCH_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.venueName ?? "")} onChange={(e) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, venueName: e.target.value } }))} /></td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={smallBtn("primary", submittingAction === `save-match-${row.id}`)}
                                disabled={submittingAction === `save-match-${row.id}`}
                                onClick={() => void runAction(`save-match-${row.id}`, async () => {
                                  await superAdminFetch(`/matches/${row.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      leagueId: draft.leagueId || null,
                                      homeTeamName: draft.homeTeamName,
                                      awayTeamName: draft.awayTeamName,
                                      matchDateUtc: draft.matchDateUtc ? new Date(String(draft.matchDateUtc)).toISOString() : undefined,
                                      status: draft.status,
                                      venueName: draft.venueName || null,
                                    }),
                                  });
                                  await Promise.all([loadMatches(), loadOverview()]);
                                })}
                              >
                                Save
                              </button>
                              <button
                                style={smallBtn("danger", submittingAction === `delete-match-${row.id}`)}
                                disabled={submittingAction === `delete-match-${row.id}`}
                                onClick={() => void runAction(`delete-match-${row.id}`, async () => {
                                  await superAdminFetch(`/matches/${row.id}`, { method: "DELETE" });
                                  await Promise.all([loadMatches(), loadOverview()]);
                                })}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}
