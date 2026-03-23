"use client";

import * as React from "react";
import { AppShell } from "../../components/AppShell";
import { BlogAdminPanel } from "../../components/admin/BlogAdminPanel";

type TabId = "overview" | "users" | "venues" | "attributes" | "teams" | "events" | "customEvents" | "sports" | "leagues" | "imports" | "matches" | "motorsportEntries" | "blog";

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
  eventFormat?: MatchEventFormat | null;
  eventTitle?: string | null;
  eventSubtitle?: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  matchDateUtc: string;
  status: string;
  leagueId: string | null;
};
type LookupLeague = { id: string; sportId: string | null; name: string; shortName: string | null; externalId?: string | null };
type LookupSport = { id: string; name: string; slug: string; shortName: string | null };
type LookupTeam = { id: string; leagueId?: string | null; name: string; shortName?: string | null; crestUrl?: string | null };
type LookupStadium = { id: string; name: string; city?: string | null; country?: string | null };
type LookupOwner = { id: string; email: string; name: string; role: UserRow["role"] };
type VenueAttributeType = "AMENITY" | "VIBE" | "CUISINE";
type LookupAttribute = {
  id: string;
  type: VenueAttributeType;
  label: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "VENUE_OWNER" | "BUSINESS" | "ADMIN" | "SUPER_ADMIN";
  isActive: boolean;
  isSuspended: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  avatarUrl?: string | null;
};

type SportRow = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type AdminLeagueRow = {
  id: string;
  sportId: string;
  sportName?: string | null;
  sportSlug?: string | null;
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  externalId?: string | null;
  country?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CsvImportResult = {
  dryRun: boolean;
  rowsRead: number;
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

type VenueRow = {
  id: string;
  ownerId: string;
  ownerEmail?: string | null;
  ownerName?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  addressLine2?: string | null;
  city: string;
  country: string;
  addressLine1: string;
  stateProvince?: string | null;
  postalCode?: string | null;
  lat: number;
  lng: number;
  timezone: string;
  coverImageUrl?: string | null;
  coverImageS3Key?: string | null;
  galleryImageUrls?: string[];
  galleryS3Keys?: string[] | null;
  website?: string | null;
  instagramHandle?: string | null;
  googleMapsUrl?: string | null;
  capacity?: number | null;
  amenities: string[];
  vibes: string[];
  cuisineTags: string[];
  priceRange?: "BUDGET" | "MID" | "UPSCALE" | "LUXURY" | null;
  ratingOverride?: string | null;
  reviewCountOverride?: number | null;
  isActive: boolean;
  isVerified: boolean;
  isFeatured: boolean;
  phone?: string | null;
  createdAt: string;
  updatedAt?: string;
};

type VenuePriceRange = "BUDGET" | "MID" | "UPSCALE" | "LUXURY";

type VenueEditorDraft = {
  ownerId?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  shortDescription?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  stateProvince?: string | null;
  country?: string;
  postalCode?: string | null;
  lat?: string | number;
  lng?: string | number;
  timezone?: string;
  coverImageUrl?: string | null;
  coverImageS3Key?: string | null;
  galleryImageUrls?: string[];
  galleryS3Keys?: string[];
  phone?: string | null;
  website?: string | null;
  instagramHandle?: string | null;
  googleMapsUrl?: string | null;
  capacity?: string | number | null;
  amenities?: string[];
  vibes?: string[];
  cuisineTags?: string[];
  priceRange?: VenuePriceRange | null;
  ratingOverride?: string | number | null;
  reviewCountOverride?: string | number | null;
  isVerified?: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
};

type MatchEventFormat = "HEAD_TO_HEAD" | "SINGLE_EVENT";

type NewVenueForm = {
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  country: string;
  postalCode: string;
  lat: string;
  lng: string;
  timezone: string;
  phone: string;
  coverImageUrl: string;
  coverImageS3Key: string;
  galleryImageUrls: string[];
  galleryS3Keys: string[];
  website: string;
  instagramHandle: string;
  googleMapsUrl: string;
  capacity: string;
  priceRange: VenuePriceRange;
  amenities: string[];
  vibes: string[];
  cuisineTags: string[];
  ratingOverride: string;
  reviewCountOverride: string;
  isVerified: boolean;
  isActive: boolean;
  isFeatured: boolean;
};

type VenueAttributeRow = {
  id: string;
  type: VenueAttributeType;
  label: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type TeamAdminRow = {
  id: string;
  leagueId?: string | null;
  leagueName?: string | null;
  name: string;
  shortName?: string | null;
  crestUrl?: string | null;
  externalId?: string | null;
  isActive: boolean;
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
  isFeatured: boolean;
  eventFormat?: MatchEventFormat;
  eventTitle?: string | null;
  eventSubtitle?: string | null;
  leagueId?: string | null;
  leagueName?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  stadiumId?: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeTeamCrestUrl?: string | null;
  awayTeamCrestUrl?: string | null;
  matchDateUtc: string;
  status: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED" | "CANCELLED" | "SUSPENDED";
  stage?: string | null;
  venueName?: string | null;
  createdAt: string;
};

type MotorsportEntryStatus = "ENTERED" | "ACTIVE" | "FINISHED" | "DNF" | "DNS" | "DSQ" | "WITHDRAWN";

type MotorsportEntryRow = {
  id: string;
  matchId: string;
  matchLabel?: string | null;
  matchSubtitle?: string | null;
  externalId?: string | null;
  carNumber?: string | null;
  displayName?: string | null;
  gridPosition?: number | null;
  startPosition?: number | null;
  finishPosition?: number | null;
  status: MotorsportEntryStatus;
  points?: string | number | null;
  metadata?: Record<string, unknown> | null;
  driverId?: string | null;
  driverName?: string | null;
  driverShortName?: string | null;
  driverNationality?: string | null;
  driverCountryCode?: string | null;
  driverHeadshotUrl?: string | null;
  entrantId?: string | null;
  entrantName?: string | null;
  entrantShortName?: string | null;
  entrantBrandColor?: string | null;
  entrantLogoUrl?: string | null;
  manufacturerId?: string | null;
  manufacturerName?: string | null;
  manufacturerShortName?: string | null;
  manufacturerLogoUrl?: string | null;
};

type MotorsportEntryDraft = Omit<Partial<MotorsportEntryRow>, "gridPosition" | "startPosition" | "finishPosition" | "points"> & {
  gridPosition?: string | number | null;
  startPosition?: string | number | null;
  finishPosition?: string | number | null;
  points?: string | number | null;
};

type ListResponse<T> = {
  rows: T[];
  meta?: ApiListMeta;
};

type SearchPickerOption = {
  id: string;
  label: string;
  subtitle?: string | null;
};

type SearchPickerProps = {
  placeholder: string;
  value: string;
  selectedId?: string | null;
  onInputChange: (nextValue: string) => void;
  onSelect: (option: SearchPickerOption) => void;
  onCreate: (query: string, extra: Record<string, string>) => Promise<void>;
  search: (query: string) => Promise<SearchPickerOption[]>;
  searchKey?: string;
  initialOptions?: SearchPickerOption[];
  createHint: string;
  createFields?: Array<{ key: string; label: string; placeholder: string }>;
  excludeIds?: string[];
};

function SearchPicker({
  placeholder,
  value,
  selectedId,
  onInputChange,
  onSelect,
  onCreate,
  search,
  searchKey,
  initialOptions = [],
  createHint,
  createFields = [],
  excludeIds = [],
}: SearchPickerProps) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchPickerOption[]>(initialOptions);
  const [createFieldsState, setCreateFieldsState] = React.useState<Record<string, string>>({});
  const [creating, setCreating] = React.useState(false);
  const searchRef = React.useRef(search);

  React.useEffect(() => {
    searchRef.current = search;
  }, [search]);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const rows = await searchRef.current(value.trim());
        if (!active) return;
        setResults(rows);
      } finally {
        if (active) setLoading(false);
      }
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [open, searchKey, value]);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  React.useEffect(() => {
    setResults(initialOptions);
  }, [initialOptions]);

  const normalizedQuery = value.trim().toLowerCase();
  const filteredResults = results.filter((option) => !excludeIds.includes(option.id));
  const exactMatch = filteredResults.some((option) => option.label.trim().toLowerCase() === normalizedQuery);
  const canCreate = normalizedQuery.length >= 2 && !exactMatch;

  return (
    <div ref={wrapperRef} style={{ position: "relative", minWidth: 0 }}>
      <input
        style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)", padding: "8px 10px", fontSize: 13 }}
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onInputChange(event.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30, borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", boxShadow: "0 18px 42px rgba(15, 23, 42, 0.18)", padding: 8, display: "grid", gap: 6, maxHeight: 280, overflowY: "auto" }}>
          {loading && (
            <div style={{ padding: "6px 8px", fontSize: 12, color: "var(--muted-foreground)" }}>
              Searching...
            </div>
          )}
          {!loading && filteredResults.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(option);
                setOpen(false);
              }}
              style={{
                textAlign: "left",
                borderRadius: 8,
                border: option.id === selectedId ? "1px solid color-mix(in oklch, var(--primary) 60%, var(--border))" : "1px solid transparent",
                background: option.id === selectedId ? "color-mix(in oklch, var(--primary) 9%, var(--card))" : "transparent",
                color: "var(--foreground)",
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>{option.label}</div>
              {option.subtitle && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{option.subtitle}</div>}
            </button>
          ))}
          {!loading && filteredResults.length === 0 && (
            <div style={{ padding: "6px 8px", fontSize: 12, color: "var(--muted-foreground)" }}>
              No matches found.
            </div>
          )}
          {canCreate && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                {createHint}
              </div>
              {createFields.map((field) => (
                <input
                  key={field.key}
                  style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)", padding: "8px 10px", fontSize: 12 }}
                  placeholder={field.placeholder}
                  value={createFieldsState[field.key] || ""}
                  onMouseDown={(event) => event.preventDefault()}
                  onChange={(event) => setCreateFieldsState((prev) => ({ ...prev, [field.key]: event.target.value }))}
                />
              ))}
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                disabled={creating}
                onClick={async () => {
                  setCreating(true);
                  try {
                    await onCreate(value.trim(), createFieldsState);
                    setCreateFieldsState({});
                    setOpen(false);
                  } finally {
                    setCreating(false);
                  }
                }}
                style={{
                  borderRadius: 8,
                  border: "none",
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: creating ? "not-allowed" : "pointer",
                  opacity: creating ? 0.65 : 1,
                }}
              >
                {creating ? "Creating..." : `Create "${value.trim()}"`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
    const error = new Error(formatApiErrorMessage(payload, "Request failed")) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return payload.data as T;
}

function formatApiErrorMessage(payload: any, fallback: string): string {
  const message = typeof payload?.error?.message === "string" ? payload.error.message.trim() : "";
  const details = Array.isArray(payload?.error?.details) ? payload.error.details : [];

  if (details.length > 0) {
    const detailMessage = details
      .slice(0, 3)
      .map((issue: any) => {
        const path = Array.isArray(issue?.path) && issue.path.length > 0
          ? issue.path.join(".")
          : "field";
        const issueMessage = typeof issue?.message === "string" ? issue.message : "Invalid value";
        return `${path}: ${issueMessage}`;
      })
      .join(" | ");

    if (!message || ["Invalid input", "Invalid query", "Invalid credentials payload"].includes(message)) {
      return detailMessage;
    }

    return `${message}: ${detailMessage}`;
  }

  return message || fallback;
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

function dedupeById<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function getMultiSelectValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function teamToOption(team: LookupTeam, leagueLabelById?: Map<string, string>): SearchPickerOption {
  const leagueLabel = team.leagueId ? leagueLabelById?.get(team.leagueId) : undefined;
  return {
    id: team.id,
    label: team.name,
    subtitle: [team.shortName, leagueLabel].filter(Boolean).join(" • "),
  };
}

function isNationalCompetitionLabel(value?: string | null) {
  const label = String(value || "").trim().toLowerCase();
  if (!label) return false;
  return label.includes("world cup")
    || label.startsWith("wc")
    || label.includes("global finals")
    || label.includes("uefa po")
    || label.includes("play-off")
    || label.includes("friendlies")
    || label === "intl";
}

function stadiumToOption(stadium: LookupStadium): SearchPickerOption {
  return {
    id: stadium.id,
    label: stadium.name,
    subtitle: [stadium.city, stadium.country].filter(Boolean).join(", "),
  };
}

function formatLookupMatchLabel(match: LookupMatch) {
  if (match.eventFormat === "SINGLE_EVENT") {
    return match.eventTitle?.trim() || "Untitled event";
  }
  return [match.homeTeamName, match.awayTeamName].filter(Boolean).join(" vs ") || "Unnamed match";
}

function formatLookupMatchSubtitle(match: LookupMatch) {
  const kickoff = formatDateTime(match.matchDateUtc);
  const secondary = match.eventFormat === "SINGLE_EVENT" ? match.eventSubtitle : match.status;
  return [secondary, kickoff].filter(Boolean).join(" • ");
}

function parseOptionalNumber(value: string | number | null | undefined) {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

const MOTORSPORT_ENTRY_STATUSES: MotorsportEntryStatus[] = [
  "ENTERED",
  "ACTIVE",
  "FINISHED",
  "DNF",
  "DNS",
  "DSQ",
  "WITHDRAWN",
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
  const [lookupSports, setLookupSports] = React.useState<LookupSport[]>([]);
  const [lookupTeams, setLookupTeams] = React.useState<LookupTeam[]>([]);
  const [lookupStadiums, setLookupStadiums] = React.useState<LookupStadium[]>([]);
  const [lookupOwners, setLookupOwners] = React.useState<LookupOwner[]>([]);
  const [lookupAttributes, setLookupAttributes] = React.useState<LookupAttribute[]>([]);
  const motorsportLookupMatches = React.useMemo(
    () => lookupMatches.filter((match) => match.eventFormat === "SINGLE_EVENT"),
    [lookupMatches],
  );

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
  const [venueDrafts, setVenueDrafts] = React.useState<Record<string, VenueEditorDraft>>({});
  const [newVenue, setNewVenue] = React.useState<NewVenueForm>({
    ownerId: "",
    name: "",
    slug: "",
    description: "",
    shortDescription: "",
    addressLine1: "",
    addressLine2: "",
    city: "Houston",
    stateProvince: "Texas",
    country: "US",
    postalCode: "",
    lat: "29.7604",
    lng: "-95.3698",
    timezone: "America/Chicago",
    phone: "",
    coverImageUrl: "",
    coverImageS3Key: "",
    galleryImageUrls: [] as string[],
    galleryS3Keys: [] as string[],
    website: "",
    instagramHandle: "",
    googleMapsUrl: "",
    capacity: "",
    priceRange: "MID" as const,
    amenities: [] as string[],
    vibes: [] as string[],
    cuisineTags: [] as string[],
    ratingOverride: "",
    reviewCountOverride: "",
    isVerified: false,
    isActive: true,
    isFeatured: false,
  });

  const [attributesRows, setAttributesRows] = React.useState<VenueAttributeRow[]>([]);
  const [attributesLoading, setAttributesLoading] = React.useState(false);
  const [attributesSearch, setAttributesSearch] = React.useState("");
  const [attributeTypeFilter, setAttributeTypeFilter] = React.useState<VenueAttributeType | "ALL">("ALL");
  const [attributeDrafts, setAttributeDrafts] = React.useState<Record<string, Partial<VenueAttributeRow>>>({});
  const [newAttribute, setNewAttribute] = React.useState({
    type: "AMENITY" as VenueAttributeType,
    label: "",
    slug: "",
    sortOrder: "0",
    isActive: true,
  });

  const [teamsRows, setTeamsRows] = React.useState<TeamAdminRow[]>([]);
  const [teamsMeta, setTeamsMeta] = React.useState<ApiListMeta | null>(null);
  const [teamsSearch, setTeamsSearch] = React.useState("");
  const [teamsLoading, setTeamsLoading] = React.useState(false);
  const [teamDrafts, setTeamDrafts] = React.useState<Record<string, Partial<TeamAdminRow>>>({});
  const [newAdminTeam, setNewAdminTeam] = React.useState({
    leagueId: "",
    name: "",
    shortName: "",
    crestUrl: "",
    externalId: "",
    isActive: true,
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
    eventFormat: "HEAD_TO_HEAD" as MatchEventFormat,
    isFeatured: false,
    eventTitle: "",
    eventSubtitle: "",
    leagueId: "",
    homeTeamId: "",
    awayTeamId: "",
    stadiumId: "",
    homeTeamName: "",
    awayTeamName: "",
    matchDateUtc: "",
    status: "SCHEDULED" as MatchRow["status"],
    venueName: "",
  });
  const [motorsportEntries, setMotorsportEntries] = React.useState<MotorsportEntryRow[]>([]);
  const [motorsportEntriesMeta, setMotorsportEntriesMeta] = React.useState<ApiListMeta | null>(null);
  const [motorsportEntriesSearch, setMotorsportEntriesSearch] = React.useState("");
  const [motorsportEntriesLoading, setMotorsportEntriesLoading] = React.useState(false);
  const [motorsportEntriesMatchId, setMotorsportEntriesMatchId] = React.useState("");
  const [motorsportEntryDrafts, setMotorsportEntryDrafts] = React.useState<Record<string, MotorsportEntryDraft>>({});
  const [newMotorsportEntry, setNewMotorsportEntry] = React.useState({
    matchId: "",
    carNumber: "",
    driverName: "",
    driverShortName: "",
    driverNationality: "",
    driverCountryCode: "",
    entrantName: "",
    entrantShortName: "",
    entrantBrandColor: "",
    manufacturerName: "",
    manufacturerShortName: "",
    displayName: "",
    gridPosition: "",
    startPosition: "",
    finishPosition: "",
    status: "ENTERED" as MotorsportEntryStatus,
    points: "",
  });

  const [sportsRows, setSportsRows] = React.useState<SportRow[]>([]);
  const [sportsMeta, setSportsMeta] = React.useState<ApiListMeta | null>(null);
  const [sportsSearch, setSportsSearch] = React.useState("");
  const [sportsLoading, setSportsLoading] = React.useState(false);
  const [sportDrafts, setSportDrafts] = React.useState<Record<string, Partial<SportRow>>>({});
  const [newSport, setNewSport] = React.useState({
    name: "",
    slug: "",
    shortName: "",
    sortOrder: "0",
    isActive: true,
  });

  const [adminLeagues, setAdminLeagues] = React.useState<AdminLeagueRow[]>([]);
  const [adminLeaguesMeta, setAdminLeaguesMeta] = React.useState<ApiListMeta | null>(null);
  const [adminLeaguesSearch, setAdminLeaguesSearch] = React.useState("");
  const [adminLeaguesLoading, setAdminLeaguesLoading] = React.useState(false);
  const [leagueDrafts, setLeagueDrafts] = React.useState<Record<string, Partial<AdminLeagueRow>>>({});
  const [newLeague, setNewLeague] = React.useState({
    sportId: "",
    name: "",
    shortName: "",
    logoUrl: "",
    externalId: "",
    country: "",
    sortOrder: "0",
    isActive: true,
  });

  const [csvImportText, setCsvImportText] = React.useState("");
  const [csvImportDryRun, setCsvImportDryRun] = React.useState(true);
  const [csvImportResult, setCsvImportResult] = React.useState<CsvImportResult | null>(null);
  const [csvImporting, setCsvImporting] = React.useState(false);

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
        sports: LookupSport[];
        teams: LookupTeam[];
        stadiums: LookupStadium[];
        owners: LookupOwner[];
        attributes: LookupAttribute[];
      }>("/lookups");
      setLookupVenues(data.venues || []);
      setLookupMatches(data.matches || []);
      setLookupLeagues(data.leagues || []);
      setLookupSports(data.sports || []);
      setLookupTeams(data.teams || []);
      setLookupStadiums(data.stadiums || []);
      setLookupOwners(data.owners || []);
      setLookupAttributes(data.attributes || []);
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
      if (!response.ok || !payload?.success) throw new Error(formatApiErrorMessage(payload, "Failed to load users"));
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
      if (!response.ok || !payload?.success) throw new Error(formatApiErrorMessage(payload, "Failed to load venues"));
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
      if (!response.ok || !payload?.success) throw new Error(formatApiErrorMessage(payload, "Failed to load events"));
      setEvents(payload.data || []);
      setEventsMeta(payload.meta || null);
    } finally {
      setEventsLoading(false);
    }
  }, [eventsSearch]);

  const loadAttributes = React.useCallback(async () => {
    setAttributesLoading(true);
    try {
      const params = new URLSearchParams();
      if (attributesSearch.trim()) params.set("search", attributesSearch.trim());
      if (attributeTypeFilter !== "ALL") params.set("type", attributeTypeFilter);
      params.set("includeInactive", "true");
      const rows = await superAdminFetch<VenueAttributeRow[]>(`/attributes?${params.toString()}`);
      setAttributesRows(rows || []);
    } finally {
      setAttributesLoading(false);
    }
  }, [attributeTypeFilter, attributesSearch]);

  const loadTeamsAdmin = React.useCallback(async () => {
    setTeamsLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "50",
        includeInactive: "true",
      });
      if (teamsSearch.trim()) params.set("search", teamsSearch.trim());
      const response = await fetch(`/api/v1/super-admin/teams?${params.toString()}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(formatApiErrorMessage(payload, "Failed to load teams"));
      setTeamsRows(payload.data || []);
      setTeamsMeta(payload.meta || null);
    } finally {
      setTeamsLoading(false);
    }
  }, [teamsSearch]);

  const loadCustomEvents = React.useCallback(async () => {
    setCustomEventsLoading(true);
    try {
      const response = await fetch(`/api/v1/super-admin/custom-events?page=1&limit=100&search=${encodeURIComponent(customEventsSearch.trim())}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(formatApiErrorMessage(payload, "Failed to load custom events"));
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
      if (!response.ok || !payload?.success) throw new Error(formatApiErrorMessage(payload, "Failed to load matches"));
      setMatches(payload.data || []);
      setMatchesMeta(payload.meta || null);
    } finally {
      setMatchesLoading(false);
    }
  }, [matchesSearch]);

  const loadMotorsportEntries = React.useCallback(async () => {
    setMotorsportEntriesLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "150",
      });
      if (motorsportEntriesSearch.trim()) params.set("search", motorsportEntriesSearch.trim());
      if (motorsportEntriesMatchId) params.set("matchId", motorsportEntriesMatchId);
      const response = await fetch(`/api/v1/super-admin/motorsport-entries?${params.toString()}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(formatApiErrorMessage(payload, "Failed to load motorsport entries"));
      setMotorsportEntries(payload.data || []);
      setMotorsportEntriesMeta(payload.meta || null);
    } finally {
      setMotorsportEntriesLoading(false);
    }
  }, [motorsportEntriesMatchId, motorsportEntriesSearch]);

  const loadSportsAdmin = React.useCallback(async () => {
    setSportsLoading(true);
    try {
      const response = await fetch(`/api/v1/super-admin/sports?page=1&limit=120&search=${encodeURIComponent(sportsSearch.trim())}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(formatApiErrorMessage(payload, "Failed to load sports"));
      setSportsRows(payload.data || []);
      setSportsMeta(payload.meta || null);
    } finally {
      setSportsLoading(false);
    }
  }, [sportsSearch]);

  const loadLeaguesAdmin = React.useCallback(async () => {
    setAdminLeaguesLoading(true);
    try {
      const response = await fetch(`/api/v1/super-admin/leagues?page=1&limit=150&search=${encodeURIComponent(adminLeaguesSearch.trim())}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(formatApiErrorMessage(payload, "Failed to load leagues"));
      setAdminLeagues(payload.data || []);
      setAdminLeaguesMeta(payload.meta || null);
    } finally {
      setAdminLeaguesLoading(false);
    }
  }, [adminLeaguesSearch]);

  const mergeLookupTeams = React.useCallback((rows: LookupTeam[]) => {
    setLookupTeams((prev) => dedupeById([...rows, ...prev]));
  }, []);

  const mergeLookupStadiums = React.useCallback((rows: LookupStadium[]) => {
    setLookupStadiums((prev) => dedupeById([...rows, ...prev]));
  }, []);

  const searchTeams = React.useCallback(async (query: string, leagueId?: string) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (leagueId) params.set("leagueId", leagueId);
    params.set("limit", "12");
    const rows = await superAdminFetch<LookupTeam[]>(`/teams?${params.toString()}`);
    mergeLookupTeams(rows);
    return rows;
  }, [mergeLookupTeams]);

  const searchStadiums = React.useCallback(async (query: string) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    params.set("limit", "12");
    const rows = await superAdminFetch<LookupStadium[]>(`/stadiums?${params.toString()}`);
    mergeLookupStadiums(rows);
    return rows;
  }, [mergeLookupStadiums]);

  const createTeam = React.useCallback(async (payload: { name: string; shortName?: string; crestUrl?: string; leagueId?: string | null }) => {
    const team = await superAdminFetch<LookupTeam>("/teams", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    mergeLookupTeams([team]);
    return team;
  }, [mergeLookupTeams]);

  const createStadium = React.useCallback(async (payload: { name: string; city?: string; country?: string }) => {
    const stadium = await superAdminFetch<LookupStadium>("/stadiums", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    mergeLookupStadiums([stadium]);
    return stadium;
  }, [mergeLookupStadiums]);

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
    if (tab === "attributes") {
      await Promise.all([loadAttributes(), loadLookups()]);
      return;
    }
    if (tab === "teams") {
      await Promise.all([loadTeamsAdmin(), loadLookups()]);
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
    if (tab === "sports") {
      await loadSportsAdmin();
      return;
    }
    if (tab === "leagues") {
      await Promise.all([loadLeaguesAdmin(), loadLookups()]);
      return;
    }
    if (tab === "imports") {
      await loadLookups();
      return;
    }
    if (tab === "motorsportEntries") {
      await Promise.all([loadMotorsportEntries(), loadLookups()]);
      return;
    }
    if (tab === "blog") {
      return;
    }
    await Promise.all([loadMatches(), loadLookups()]);
  }, [loadAttributes, loadCustomEvents, loadEvents, loadLeaguesAdmin, loadLookups, loadMatches, loadMotorsportEntries, loadOverview, loadSportsAdmin, loadTeamsAdmin, loadUsers, loadVenues]);

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

  React.useEffect(() => {
    if (newLeague.sportId || lookupSports.length === 0) return;
    setNewLeague((prev) => ({ ...prev, sportId: lookupSports[0].id }));
  }, [lookupSports, newLeague.sportId]);

  React.useEffect(() => {
    if (motorsportLookupMatches.length === 0) return;
    if (!newMotorsportEntry.matchId) {
      setNewMotorsportEntry((prev) => ({ ...prev, matchId: motorsportLookupMatches[0].id }));
    }
    if (!motorsportEntriesMatchId) {
      setMotorsportEntriesMatchId(motorsportLookupMatches[0].id);
    }
  }, [motorsportEntriesMatchId, motorsportLookupMatches, newMotorsportEntry.matchId]);

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
      setAttributesRows([]);
      setTeamsRows([]);
      setSportsRows([]);
      setAdminLeagues([]);
      setCsvImportResult(null);
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

  const handleCsvImport = async () => {
    if (!csvImportText.trim()) {
      setError("CSV content is required.");
      return;
    }

    setError(null);
    setCsvImporting(true);
    try {
      const result = await superAdminFetch<CsvImportResult>("/matches/import", {
        method: "POST",
        body: JSON.stringify({
          csv: csvImportText,
          dryRun: csvImportDryRun,
        }),
      });
      setCsvImportResult(result);
      await Promise.all([loadMatches(), loadOverview(), loadLookups()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV import failed");
    } finally {
      setCsvImporting(false);
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
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
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
  const attributesCount = attributesRows.length;
  const teamsCount = teamsMeta?.total ?? teamsRows.length;
  const sportsCount = sportsMeta?.total ?? sportsRows.length;
  const leaguesCount = adminLeaguesMeta?.total ?? adminLeagues.length;
  const matchesCount = matchesMeta?.total ?? matches.length;
  const motorsportEntriesCount = motorsportEntriesMeta?.total ?? motorsportEntries.length;
  const leagueById = new Map(
    lookupLeagues.map((league) => [league.id, league]),
  );
  const leagueLabelById = new Map(
    lookupLeagues.map((league) => [league.id, league.shortName || league.name]),
  );
  const ownerLabelById = new Map(
    lookupOwners.map((owner) => [owner.id, `${owner.name} (${owner.email})`]),
  );
  const attributeOptionsByType = new Map<VenueAttributeType, LookupAttribute[]>(
    (["AMENITY", "VIBE", "CUISINE"] as VenueAttributeType[]).map((type) => [
      type,
      lookupAttributes.filter((item) => item.type === type).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    ]),
  );
  const isNationalLeagueId = (leagueId?: string | null) => {
    if (!leagueId) return false;
    const league = leagueById.get(leagueId);
    return isNationalCompetitionLabel(league?.externalId)
      || isNationalCompetitionLabel(league?.shortName)
      || isNationalCompetitionLabel(league?.name);
  };

  const isNationalTeamLookup = (team: LookupTeam) => {
    if (!team.leagueId) return false;
    return isNationalLeagueId(team.leagueId);
  };

  const teamMatchesLeagueSport = (team: LookupTeam, leagueId?: string | null) => {
    if (!leagueId) return true;
    if (!team.leagueId) return false;
    const targetLeague = leagueById.get(leagueId);
    const teamLeague = leagueById.get(team.leagueId);
    if (!targetLeague?.sportId || !teamLeague?.sportId) return false;
    return targetLeague.sportId === teamLeague.sportId;
  };

  const isCustomLeagueId = (leagueId?: string | null) => {
    if (!leagueId) return false;
    const league = leagueById.get(leagueId);
    return !league?.externalId;
  };

  const isSingleEventLeagueId = (leagueId?: string | null) => {
    if (!leagueId) return false;
    const league = leagueById.get(leagueId);
    return Boolean(league?.sportId && lookupSports.some((sport) => sport.id === league.sportId && sport.slug === "motorsport"));
  };

  const buildTeamPickerOptions = (leagueId?: string | null) => {
    let source = lookupTeams;
    if (leagueId) {
      source = isNationalLeagueId(leagueId)
        ? lookupTeams.filter((team) => isNationalTeamLookup(team))
        : isCustomLeagueId(leagueId)
          ? lookupTeams.filter((team) => teamMatchesLeagueSport(team, leagueId))
          : lookupTeams.filter((team) => team.leagueId === leagueId);
    }
    return source.slice(0, 12).map((team) => teamToOption(team, leagueLabelById));
  };

  const searchTeamsForLeague = async (query: string, leagueId?: string | null) => {
    const scopedLeagueId = leagueId && !isNationalLeagueId(leagueId) && !isCustomLeagueId(leagueId) ? leagueId : undefined;
    const rows = await searchTeams(query, scopedLeagueId || undefined);
    return leagueId && isNationalLeagueId(leagueId)
      ? rows.filter((team) => isNationalTeamLookup(team))
      : leagueId && isCustomLeagueId(leagueId)
        ? rows.filter((team) => teamMatchesLeagueSport(team, leagueId))
      : rows;
  };

  const defaultStadiumOptions = lookupStadiums.slice(0, 12).map(stadiumToOption);

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: 88,
    resize: "vertical",
  };

  const multiSelectStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: 120,
    padding: 8,
  };

  const toCsvList = (values?: string[] | null) => (values || []).join(", ");
  const parseCsvList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
  const ensureAttributeValues = (type: VenueAttributeType, values: string[] = []) => {
    const options = [...(attributeOptionsByType.get(type) || [])];
    for (const value of values) {
      if (!options.some((option) => option.slug === value)) {
        options.push({ id: `legacy-${type}-${value}`, type, label: value, slug: value, sortOrder: 9999, isActive: false });
      }
    }
    return options.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  };

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
            ["attributes", "Attributes"],
            ["teams", "Teams"],
            ["events", "Match Events"],
            ["customEvents", "Custom Events"],
            ["sports", "Sports"],
            ["leagues", "Leagues"],
            ["imports", "CSV Import"],
            ["matches", "Matches"],
            ["motorsportEntries", "Motorsport Entries"],
            ["blog", "Blog"],
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
                  <option value="BUSINESS">BUSINESS</option>
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
                              <option value="BUSINESS">BUSINESS</option>
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
                <select style={inputStyle} value={newVenue.ownerId} onChange={(e) => setNewVenue((prev) => ({ ...prev, ownerId: e.target.value }))}>
                  <option value="">Owner</option>
                  {lookupOwners.map((owner) => (
                    <option key={owner.id} value={owner.id}>{owner.name} ({owner.email})</option>
                  ))}
                </select>
                <input style={inputStyle} placeholder="Venue name" value={newVenue.name} onChange={(e) => setNewVenue((prev) => ({ ...prev, name: e.target.value }))} />
                <input style={inputStyle} placeholder="Slug (optional)" value={newVenue.slug} onChange={(e) => setNewVenue((prev) => ({ ...prev, slug: e.target.value }))} />
                <input style={inputStyle} placeholder="Short description" value={newVenue.shortDescription} onChange={(e) => setNewVenue((prev) => ({ ...prev, shortDescription: e.target.value }))} />
                <input style={inputStyle} placeholder="Address" value={newVenue.addressLine1} onChange={(e) => setNewVenue((prev) => ({ ...prev, addressLine1: e.target.value }))} />
                <input style={inputStyle} placeholder="Address line 2" value={newVenue.addressLine2} onChange={(e) => setNewVenue((prev) => ({ ...prev, addressLine2: e.target.value }))} />
                <input style={inputStyle} placeholder="City" value={newVenue.city} onChange={(e) => setNewVenue((prev) => ({ ...prev, city: e.target.value }))} />
                <input style={inputStyle} placeholder="State / Province" value={newVenue.stateProvince} onChange={(e) => setNewVenue((prev) => ({ ...prev, stateProvince: e.target.value }))} />
                <input style={inputStyle} placeholder="Country" value={newVenue.country} onChange={(e) => setNewVenue((prev) => ({ ...prev, country: e.target.value }))} />
                <input style={inputStyle} placeholder="Postal code" value={newVenue.postalCode} onChange={(e) => setNewVenue((prev) => ({ ...prev, postalCode: e.target.value }))} />
                <input style={inputStyle} placeholder="Lat" value={newVenue.lat} onChange={(e) => setNewVenue((prev) => ({ ...prev, lat: e.target.value }))} />
                <input style={inputStyle} placeholder="Lng" value={newVenue.lng} onChange={(e) => setNewVenue((prev) => ({ ...prev, lng: e.target.value }))} />
                <input style={inputStyle} placeholder="Timezone" value={newVenue.timezone} onChange={(e) => setNewVenue((prev) => ({ ...prev, timezone: e.target.value }))} />
                <input style={inputStyle} placeholder="Phone" value={newVenue.phone} onChange={(e) => setNewVenue((prev) => ({ ...prev, phone: e.target.value }))} />
                <input style={inputStyle} placeholder="Website" value={newVenue.website} onChange={(e) => setNewVenue((prev) => ({ ...prev, website: e.target.value }))} />
                <input style={inputStyle} placeholder="Instagram handle" value={newVenue.instagramHandle} onChange={(e) => setNewVenue((prev) => ({ ...prev, instagramHandle: e.target.value }))} />
                <input style={inputStyle} placeholder="Google Maps URL" value={newVenue.googleMapsUrl} onChange={(e) => setNewVenue((prev) => ({ ...prev, googleMapsUrl: e.target.value }))} />
                <input style={inputStyle} placeholder="Cover image URL" value={newVenue.coverImageUrl} onChange={(e) => setNewVenue((prev) => ({ ...prev, coverImageUrl: e.target.value }))} />
                <input style={inputStyle} placeholder="Cover image S3 key" value={newVenue.coverImageS3Key} onChange={(e) => setNewVenue((prev) => ({ ...prev, coverImageS3Key: e.target.value }))} />
                <input style={inputStyle} placeholder="Gallery URLs (comma separated)" value={toCsvList(newVenue.galleryImageUrls)} onChange={(e) => setNewVenue((prev) => ({ ...prev, galleryImageUrls: parseCsvList(e.target.value) }))} />
                <input style={inputStyle} placeholder="Gallery S3 keys (comma separated)" value={toCsvList(newVenue.galleryS3Keys)} onChange={(e) => setNewVenue((prev) => ({ ...prev, galleryS3Keys: parseCsvList(e.target.value) }))} />
                <input style={inputStyle} placeholder="Capacity" value={newVenue.capacity} onChange={(e) => setNewVenue((prev) => ({ ...prev, capacity: e.target.value }))} />
                <input style={inputStyle} type="number" min="0" max="5" step="0.1" placeholder="Displayed rating override" value={newVenue.ratingOverride} onChange={(e) => setNewVenue((prev) => ({ ...prev, ratingOverride: e.target.value }))} />
                <input style={inputStyle} type="number" min="0" step="1" placeholder="Displayed review count override" value={newVenue.reviewCountOverride} onChange={(e) => setNewVenue((prev) => ({ ...prev, reviewCountOverride: e.target.value }))} />
                <select style={inputStyle} value={newVenue.priceRange} onChange={(e) => setNewVenue((prev) => ({ ...prev, priceRange: e.target.value as "BUDGET" | "MID" | "UPSCALE" | "LUXURY" }))}>
                  <option value="BUDGET">BUDGET</option>
                  <option value="MID">MID</option>
                  <option value="UPSCALE">UPSCALE</option>
                  <option value="LUXURY">LUXURY</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={newVenue.isVerified} onChange={(e) => setNewVenue((prev) => ({ ...prev, isVerified: e.target.checked }))} />
                  Verified
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={newVenue.isActive} onChange={(e) => setNewVenue((prev) => ({ ...prev, isActive: e.target.checked }))} />
                  Active
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={newVenue.isFeatured} onChange={(e) => setNewVenue((prev) => ({ ...prev, isFeatured: e.target.checked }))} />
                  Featured
                </label>
                <textarea style={{ ...textareaStyle, gridColumn: "1 / -1" }} placeholder="Description" value={newVenue.description} onChange={(e) => setNewVenue((prev) => ({ ...prev, description: e.target.value }))} />
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Amenities</span>
                  <select multiple style={multiSelectStyle} value={newVenue.amenities} onChange={(e) => {
                    const amenities = getMultiSelectValues(e.currentTarget);
                    setNewVenue((prev) => ({ ...prev, amenities }));
                  }}>
                    {ensureAttributeValues("AMENITY", newVenue.amenities).map((item) => (
                      <option key={item.slug} value={item.slug}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Vibes</span>
                  <select multiple style={multiSelectStyle} value={newVenue.vibes} onChange={(e) => {
                    const vibes = getMultiSelectValues(e.currentTarget);
                    setNewVenue((prev) => ({ ...prev, vibes }));
                  }}>
                    {ensureAttributeValues("VIBE", newVenue.vibes).map((item) => (
                      <option key={item.slug} value={item.slug}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Cuisine</span>
                  <select multiple style={multiSelectStyle} value={newVenue.cuisineTags} onChange={(e) => {
                    const cuisineTags = getMultiSelectValues(e.currentTarget);
                    setNewVenue((prev) => ({ ...prev, cuisineTags }));
                  }}>
                    {ensureAttributeValues("CUISINE", newVenue.cuisineTags).map((item) => (
                      <option key={item.slug} value={item.slug}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  style={smallBtn("primary", submittingAction === "create-venue")}
                  disabled={submittingAction === "create-venue"}
                  onClick={() => void runAction("create-venue", async () => {
                    await superAdminFetch("/venues", {
                      method: "POST",
                      body: JSON.stringify({
                        ...newVenue,
                        ownerId: newVenue.ownerId || undefined,
                        slug: newVenue.slug || undefined,
                        description: newVenue.description || undefined,
                        shortDescription: newVenue.shortDescription || undefined,
                        addressLine2: newVenue.addressLine2 || undefined,
                        stateProvince: newVenue.stateProvince || undefined,
                        postalCode: newVenue.postalCode || undefined,
                        phone: newVenue.phone || undefined,
                        website: newVenue.website || undefined,
                        instagramHandle: newVenue.instagramHandle || undefined,
                        googleMapsUrl: newVenue.googleMapsUrl || undefined,
                        coverImageUrl: newVenue.coverImageUrl || undefined,
                        coverImageS3Key: newVenue.coverImageS3Key || undefined,
                        lat: Number(newVenue.lat),
                        lng: Number(newVenue.lng),
                        capacity: newVenue.capacity ? Number(newVenue.capacity) : undefined,
                        ratingOverride: newVenue.ratingOverride ? Number(newVenue.ratingOverride) : undefined,
                        reviewCountOverride: newVenue.reviewCountOverride ? Number(newVenue.reviewCountOverride) : undefined,
                      }),
                    });
                    setNewVenue({
                      ownerId: "",
                      name: "",
                      slug: "",
                      description: "",
                      shortDescription: "",
                      addressLine1: "",
                      addressLine2: "",
                      city: "Houston",
                      stateProvince: "Texas",
                      country: "US",
                      postalCode: "",
                      lat: "29.7604",
                      lng: "-95.3698",
                      timezone: "America/Chicago",
                      phone: "",
                      coverImageUrl: "",
                      coverImageS3Key: "",
                      galleryImageUrls: [],
                      galleryS3Keys: [],
                      website: "",
                      instagramHandle: "",
                      googleMapsUrl: "",
                      capacity: "",
                      priceRange: "MID",
                      amenities: [],
                      vibes: [],
                      cuisineTags: [],
                      ratingOverride: "",
                      reviewCountOverride: "",
                      isVerified: false,
                      isActive: true,
                      isFeatured: false,
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
              <div style={{ padding: 14, display: "grid", gap: 12 }}>
                {venues.map((row) => {
                  const draft = venueDrafts[row.id] ?? {
                    ownerId: row.ownerId,
                    name: row.name,
                    slug: row.slug,
                    description: row.description || "",
                    shortDescription: row.shortDescription || "",
                    addressLine1: row.addressLine1,
                    addressLine2: row.addressLine2 || "",
                    city: row.city,
                    stateProvince: row.stateProvince || "",
                    country: row.country,
                    postalCode: row.postalCode || "",
                    lat: String(row.lat),
                    lng: String(row.lng),
                    timezone: row.timezone,
                    phone: row.phone || "",
                    website: row.website || "",
                    instagramHandle: row.instagramHandle || "",
                    googleMapsUrl: row.googleMapsUrl || "",
                    coverImageUrl: row.coverImageUrl || "",
                    coverImageS3Key: row.coverImageS3Key || "",
                    galleryImageUrls: row.galleryImageUrls || [],
                    galleryS3Keys: row.galleryS3Keys || [],
                    capacity: row.capacity == null ? "" : String(row.capacity),
                    priceRange: row.priceRange || "MID",
                    ratingOverride: row.ratingOverride ?? "",
                    reviewCountOverride: row.reviewCountOverride ?? "",
                    amenities: row.amenities || [],
                    vibes: row.vibes || [],
                    cuisineTags: row.cuisineTags || [],
                    isVerified: row.isVerified,
                    isActive: row.isActive,
                    isFeatured: row.isFeatured,
                  };
                  return (
                    <div key={row.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 800, color: "var(--foreground)" }}>{row.name}</div>
                          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                            {row.id} • {ownerLabelById.get(row.ownerId) || row.ownerEmail || row.ownerId} • Created {formatDateTime(row.createdAt)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            style={smallBtn("primary", submittingAction === `save-venue-${row.id}`)}
                            disabled={submittingAction === `save-venue-${row.id}`}
                            onClick={() => void runAction(`save-venue-${row.id}`, async () => {
                              await superAdminFetch(`/venues/${row.id}`, {
                                method: "PATCH",
                                body: JSON.stringify({
                                  ownerId: draft.ownerId,
                                  name: draft.name,
                                  slug: draft.slug,
                                  description: draft.description || null,
                                  shortDescription: draft.shortDescription || null,
                                  addressLine1: draft.addressLine1,
                                  addressLine2: draft.addressLine2 || null,
                                  city: draft.city,
                                  stateProvince: draft.stateProvince || null,
                                  country: draft.country,
                                  postalCode: draft.postalCode || null,
                                  lat: draft.lat ? Number(draft.lat) : undefined,
                                  lng: draft.lng ? Number(draft.lng) : undefined,
                                  timezone: draft.timezone,
                                  phone: draft.phone || null,
                                  website: draft.website || null,
                                  instagramHandle: draft.instagramHandle || null,
                                  googleMapsUrl: draft.googleMapsUrl || null,
                                  coverImageUrl: draft.coverImageUrl || null,
                                  coverImageS3Key: draft.coverImageS3Key || null,
                                  galleryImageUrls: Array.isArray(draft.galleryImageUrls) ? draft.galleryImageUrls : [],
                                  galleryS3Keys: Array.isArray(draft.galleryS3Keys) ? draft.galleryS3Keys : [],
                                  capacity: draft.capacity ? Number(draft.capacity) : null,
                                  priceRange: draft.priceRange,
                                  ratingOverride: draft.ratingOverride === "" || draft.ratingOverride == null ? null : Number(draft.ratingOverride),
                                  reviewCountOverride: draft.reviewCountOverride === "" || draft.reviewCountOverride == null ? null : Number(draft.reviewCountOverride),
                                  amenities: Array.isArray(draft.amenities) ? draft.amenities : [],
                                  vibes: Array.isArray(draft.vibes) ? draft.vibes : [],
                                  cuisineTags: Array.isArray(draft.cuisineTags) ? draft.cuisineTags : [],
                                  isVerified: draft.isVerified,
                                  isActive: draft.isActive,
                                  isFeatured: draft.isFeatured,
                                }),
                              });
                              await Promise.all([loadVenues(), loadLookups(), loadOverview()]);
                            })}
                          >
                            Save
                          </button>
                          <button
                            style={smallBtn("danger", submittingAction === `archive-venue-${row.id}`)}
                            disabled={submittingAction === `archive-venue-${row.id}`}
                            onClick={() => void runAction(`archive-venue-${row.id}`, async () => {
                              await superAdminFetch(`/venues/${row.id}`, { method: "DELETE" });
                              await Promise.all([loadVenues(), loadLookups(), loadOverview()]);
                            })}
                          >
                            Archive
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <select style={inputStyle} value={String(draft.ownerId ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, ownerId: e.target.value } }))}>
                          <option value="">Owner</option>
                          {lookupOwners.map((owner) => (
                            <option key={owner.id} value={owner.id}>{owner.name} ({owner.email})</option>
                          ))}
                        </select>
                        <input style={inputStyle} value={String(draft.name ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, name: e.target.value } }))} placeholder="Venue name" />
                        <input style={inputStyle} value={String(draft.slug ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, slug: e.target.value } }))} placeholder="Slug" />
                        <input style={inputStyle} value={String(draft.shortDescription ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, shortDescription: e.target.value } }))} placeholder="Short description" />
                        <input style={inputStyle} value={String(draft.addressLine1 ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, addressLine1: e.target.value } }))} placeholder="Address line 1" />
                        <input style={inputStyle} value={String(draft.addressLine2 ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, addressLine2: e.target.value } }))} placeholder="Address line 2" />
                        <input style={inputStyle} value={String(draft.city ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, city: e.target.value } }))} placeholder="City" />
                        <input style={inputStyle} value={String(draft.stateProvince ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, stateProvince: e.target.value } }))} placeholder="State / Province" />
                        <input style={inputStyle} value={String(draft.country ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, country: e.target.value } }))} placeholder="Country" />
                        <input style={inputStyle} value={String(draft.postalCode ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, postalCode: e.target.value } }))} placeholder="Postal code" />
                        <input style={inputStyle} value={String(draft.lat ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, lat: e.target.value } }))} placeholder="Lat" />
                        <input style={inputStyle} value={String(draft.lng ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, lng: e.target.value } }))} placeholder="Lng" />
                        <input style={inputStyle} value={String(draft.timezone ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, timezone: e.target.value } }))} placeholder="Timezone" />
                        <input style={inputStyle} value={String(draft.phone ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, phone: e.target.value } }))} placeholder="Phone" />
                        <input style={inputStyle} value={String(draft.website ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, website: e.target.value } }))} placeholder="Website" />
                        <input style={inputStyle} value={String(draft.instagramHandle ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, instagramHandle: e.target.value } }))} placeholder="Instagram handle" />
                        <input style={inputStyle} value={String(draft.googleMapsUrl ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, googleMapsUrl: e.target.value } }))} placeholder="Google Maps URL" />
                        <input style={inputStyle} value={String(draft.coverImageUrl ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, coverImageUrl: e.target.value } }))} placeholder="Cover image URL" />
                        <input style={inputStyle} value={String(draft.coverImageS3Key ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, coverImageS3Key: e.target.value } }))} placeholder="Cover image S3 key" />
                        <input style={inputStyle} value={toCsvList(Array.isArray(draft.galleryImageUrls) ? draft.galleryImageUrls : [])} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, galleryImageUrls: parseCsvList(e.target.value) } }))} placeholder="Gallery URLs" />
                        <input style={inputStyle} value={toCsvList(Array.isArray(draft.galleryS3Keys) ? draft.galleryS3Keys : [])} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, galleryS3Keys: parseCsvList(e.target.value) } }))} placeholder="Gallery S3 keys" />
                        <input style={inputStyle} value={String(draft.capacity ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, capacity: e.target.value } }))} placeholder="Capacity" />
                        <input style={inputStyle} type="number" min="0" max="5" step="0.1" value={String(draft.ratingOverride ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, ratingOverride: e.target.value } }))} placeholder="Displayed rating override" />
                        <input style={inputStyle} type="number" min="0" step="1" value={String(draft.reviewCountOverride ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, reviewCountOverride: e.target.value } }))} placeholder="Displayed review count override" />
                        <select style={inputStyle} value={String(draft.priceRange ?? "MID")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, priceRange: e.target.value as VenueRow["priceRange"] } }))}>
                          <option value="BUDGET">BUDGET</option>
                          <option value="MID">MID</option>
                          <option value="UPSCALE">UPSCALE</option>
                          <option value="LUXURY">LUXURY</option>
                        </select>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <input type="checkbox" checked={Boolean(draft.isVerified)} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isVerified: e.target.checked } }))} />
                          Verified
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <input type="checkbox" checked={Boolean(draft.isActive)} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isActive: e.target.checked } }))} />
                          Active
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <input type="checkbox" checked={Boolean(draft.isFeatured)} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isFeatured: e.target.checked } }))} />
                          Featured
                        </label>
                        <textarea style={{ ...textareaStyle, gridColumn: "1 / -1" }} value={String(draft.description ?? "")} onChange={(e) => setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, description: e.target.value } }))} placeholder="Description" />
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Amenities</span>
                          <select multiple style={multiSelectStyle} value={Array.isArray(draft.amenities) ? draft.amenities : []} onChange={(e) => {
                            const amenities = getMultiSelectValues(e.currentTarget);
                            setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, amenities } }));
                          }}>
                            {ensureAttributeValues("AMENITY", Array.isArray(draft.amenities) ? draft.amenities : []).map((item) => (
                              <option key={item.slug} value={item.slug}>{item.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Vibes</span>
                          <select multiple style={multiSelectStyle} value={Array.isArray(draft.vibes) ? draft.vibes : []} onChange={(e) => {
                            const vibes = getMultiSelectValues(e.currentTarget);
                            setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, vibes } }));
                          }}>
                            {ensureAttributeValues("VIBE", Array.isArray(draft.vibes) ? draft.vibes : []).map((item) => (
                              <option key={item.slug} value={item.slug}>{item.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Cuisine</span>
                          <select multiple style={multiSelectStyle} value={Array.isArray(draft.cuisineTags) ? draft.cuisineTags : []} onChange={(e) => {
                            const cuisineTags = getMultiSelectValues(e.currentTarget);
                            setVenueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, cuisineTags } }));
                          }}>
                            {ensureAttributeValues("CUISINE", Array.isArray(draft.cuisineTags) ? draft.cuisineTags : []).map((item) => (
                              <option key={item.slug} value={item.slug}>{item.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {activeTab === "attributes" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Create Attribute</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "1.1fr 1.5fr 1.3fr 0.8fr 0.8fr auto" }}>
                <select style={inputStyle} value={newAttribute.type} onChange={(e) => setNewAttribute((prev) => ({ ...prev, type: e.target.value as VenueAttributeType }))}>
                  <option value="AMENITY">AMENITY</option>
                  <option value="VIBE">VIBE</option>
                  <option value="CUISINE">CUISINE</option>
                </select>
                <input style={inputStyle} placeholder="Label" value={newAttribute.label} onChange={(e) => setNewAttribute((prev) => ({ ...prev, label: e.target.value }))} />
                <input style={inputStyle} placeholder="Slug (optional)" value={newAttribute.slug} onChange={(e) => setNewAttribute((prev) => ({ ...prev, slug: e.target.value }))} />
                <input style={inputStyle} placeholder="Sort" value={newAttribute.sortOrder} onChange={(e) => setNewAttribute((prev) => ({ ...prev, sortOrder: e.target.value }))} />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={newAttribute.isActive} onChange={(e) => setNewAttribute((prev) => ({ ...prev, isActive: e.target.checked }))} />
                  Active
                </label>
                <button
                  style={smallBtn("primary", submittingAction === "create-attribute")}
                  disabled={submittingAction === "create-attribute"}
                  onClick={() => void runAction("create-attribute", async () => {
                    await superAdminFetch("/attributes", {
                      method: "POST",
                      body: JSON.stringify({
                        type: newAttribute.type,
                        label: newAttribute.label,
                        slug: newAttribute.slug || undefined,
                        sortOrder: Number(newAttribute.sortOrder || "0"),
                        isActive: newAttribute.isActive,
                      }),
                    });
                    setNewAttribute({ type: "AMENITY", label: "", slug: "", sortOrder: "0", isActive: true });
                    await Promise.all([loadAttributes(), loadLookups()]);
                  })}
                >
                  Create
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Attributes ({attributesCount})</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <select style={inputStyle} value={attributeTypeFilter} onChange={(e) => setAttributeTypeFilter(e.target.value as VenueAttributeType | "ALL")}>
                    <option value="ALL">All types</option>
                    <option value="AMENITY">Amenities</option>
                    <option value="VIBE">Vibes</option>
                    <option value="CUISINE">Cuisine</option>
                  </select>
                  <input value={attributesSearch} onChange={(e) => setAttributesSearch(e.target.value)} placeholder="Search attributes" style={{ ...inputStyle, minWidth: 220 }} />
                  <button style={smallBtn("outline", attributesLoading)} onClick={() => void loadAttributes()} disabled={attributesLoading}>Search</button>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Label</th>
                      <th style={thStyle}>Slug</th>
                      <th style={thStyle}>Sort</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Updated</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attributesRows.map((row) => {
                      const draft = attributeDrafts[row.id] ?? {
                        label: row.label,
                        slug: row.slug,
                        sortOrder: row.sortOrder,
                        isActive: row.isActive,
                      };
                      return (
                        <tr key={row.id}>
                          <td style={tdStyle}>{row.type}</td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.label ?? "")} onChange={(e) => setAttributeDrafts((prev) => ({ ...prev, [row.id]: { ...draft, label: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.slug ?? "")} onChange={(e) => setAttributeDrafts((prev) => ({ ...prev, [row.id]: { ...draft, slug: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.sortOrder ?? 0)} onChange={(e) => setAttributeDrafts((prev) => ({ ...prev, [row.id]: { ...draft, sortOrder: Number(e.target.value || "0") } }))} /></td>
                          <td style={tdStyle}><input type="checkbox" checked={Boolean(draft.isActive)} onChange={(e) => setAttributeDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isActive: e.target.checked } }))} /></td>
                          <td style={tdStyle}>{formatDateTime(row.updatedAt)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={smallBtn("primary", submittingAction === `save-attribute-${row.id}`)}
                                disabled={submittingAction === `save-attribute-${row.id}`}
                                onClick={() => void runAction(`save-attribute-${row.id}`, async () => {
                                  await superAdminFetch(`/attributes/${row.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      label: draft.label,
                                      slug: draft.slug,
                                      sortOrder: draft.sortOrder,
                                      isActive: draft.isActive,
                                    }),
                                  });
                                  await Promise.all([loadAttributes(), loadLookups()]);
                                })}
                              >
                                Save
                              </button>
                              <button
                                style={smallBtn("danger", submittingAction === `archive-attribute-${row.id}`)}
                                disabled={submittingAction === `archive-attribute-${row.id}`}
                                onClick={() => void runAction(`archive-attribute-${row.id}`, async () => {
                                  await superAdminFetch(`/attributes/${row.id}`, { method: "DELETE" });
                                  await Promise.all([loadAttributes(), loadLookups()]);
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

        {activeTab === "teams" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Create Team</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "1.3fr 1.6fr 1.2fr 2fr 1.2fr 0.8fr auto" }}>
                <select style={inputStyle} value={newAdminTeam.leagueId} onChange={(e) => setNewAdminTeam((prev) => ({ ...prev, leagueId: e.target.value }))}>
                  <option value="">No league</option>
                  {lookupLeagues.map((league) => (
                    <option key={league.id} value={league.id}>{league.shortName || league.name}</option>
                  ))}
                </select>
                <input style={inputStyle} placeholder="Team name" value={newAdminTeam.name} onChange={(e) => setNewAdminTeam((prev) => ({ ...prev, name: e.target.value }))} />
                <input style={inputStyle} placeholder="Short name" value={newAdminTeam.shortName} onChange={(e) => setNewAdminTeam((prev) => ({ ...prev, shortName: e.target.value }))} />
                <input style={inputStyle} placeholder="Crest URL" value={newAdminTeam.crestUrl} onChange={(e) => setNewAdminTeam((prev) => ({ ...prev, crestUrl: e.target.value }))} />
                <input style={inputStyle} placeholder="External ID" value={newAdminTeam.externalId} onChange={(e) => setNewAdminTeam((prev) => ({ ...prev, externalId: e.target.value }))} />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={newAdminTeam.isActive} onChange={(e) => setNewAdminTeam((prev) => ({ ...prev, isActive: e.target.checked }))} />
                  Active
                </label>
                <button
                  style={smallBtn("primary", submittingAction === "create-admin-team")}
                  disabled={submittingAction === "create-admin-team"}
                  onClick={() => void runAction("create-admin-team", async () => {
                    await superAdminFetch("/teams", {
                      method: "POST",
                      body: JSON.stringify({
                        leagueId: newAdminTeam.leagueId || null,
                        name: newAdminTeam.name,
                        shortName: newAdminTeam.shortName || null,
                        crestUrl: newAdminTeam.crestUrl || null,
                        externalId: newAdminTeam.externalId || null,
                        isActive: newAdminTeam.isActive,
                      }),
                    });
                    setNewAdminTeam({ leagueId: "", name: "", shortName: "", crestUrl: "", externalId: "", isActive: true });
                    await Promise.all([loadTeamsAdmin(), loadLookups()]);
                  })}
                >
                  Create
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Teams ({teamsCount})</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={teamsSearch} onChange={(e) => setTeamsSearch(e.target.value)} placeholder="Search teams" style={{ ...inputStyle, minWidth: 220 }} />
                  <button style={smallBtn("outline", teamsLoading)} onClick={() => void loadTeamsAdmin()} disabled={teamsLoading}>Search</button>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>League</th>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Short</th>
                      <th style={thStyle}>Crest URL</th>
                      <th style={thStyle}>External</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Created</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamsRows.map((row) => {
                      const draft = teamDrafts[row.id] ?? {
                        leagueId: row.leagueId || "",
                        name: row.name,
                        shortName: row.shortName || "",
                        crestUrl: row.crestUrl || "",
                        externalId: row.externalId || "",
                        isActive: row.isActive,
                      };
                      return (
                        <tr key={row.id}>
                          <td style={tdStyle}>{row.id}</td>
                          <td style={tdStyle}>
                            <select style={inputStyle} value={String(draft.leagueId ?? "")} onChange={(e) => setTeamDrafts((prev) => ({ ...prev, [row.id]: { ...draft, leagueId: e.target.value } }))}>
                              <option value="">No league</option>
                              {lookupLeagues.map((league) => (
                                <option key={league.id} value={league.id}>{league.shortName || league.name}</option>
                              ))}
                            </select>
                          </td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.name ?? "")} onChange={(e) => setTeamDrafts((prev) => ({ ...prev, [row.id]: { ...draft, name: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.shortName ?? "")} onChange={(e) => setTeamDrafts((prev) => ({ ...prev, [row.id]: { ...draft, shortName: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.crestUrl ?? "")} onChange={(e) => setTeamDrafts((prev) => ({ ...prev, [row.id]: { ...draft, crestUrl: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.externalId ?? "")} onChange={(e) => setTeamDrafts((prev) => ({ ...prev, [row.id]: { ...draft, externalId: e.target.value } }))} /></td>
                          <td style={tdStyle}><input type="checkbox" checked={Boolean(draft.isActive)} onChange={(e) => setTeamDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isActive: e.target.checked } }))} /></td>
                          <td style={tdStyle}>{formatDateTime(row.createdAt)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={smallBtn("primary", submittingAction === `save-team-${row.id}`)}
                                disabled={submittingAction === `save-team-${row.id}`}
                                onClick={() => void runAction(`save-team-${row.id}`, async () => {
                                  await superAdminFetch(`/teams/${row.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      leagueId: draft.leagueId || null,
                                      name: draft.name,
                                      shortName: draft.shortName || null,
                                      crestUrl: draft.crestUrl || null,
                                      externalId: draft.externalId || null,
                                      isActive: draft.isActive,
                                    }),
                                  });
                                  await Promise.all([loadTeamsAdmin(), loadLookups()]);
                                })}
                              >
                                Save
                              </button>
                              <button
                                style={smallBtn("danger", submittingAction === `archive-team-${row.id}`)}
                                disabled={submittingAction === `archive-team-${row.id}`}
                                onClick={() => void runAction(`archive-team-${row.id}`, async () => {
                                  await superAdminFetch(`/teams/${row.id}`, { method: "DELETE" });
                                  await Promise.all([loadTeamsAdmin(), loadLookups()]);
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
                      {formatLookupMatchLabel(match)} - {formatDateTime(match.matchDateUtc)}
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

        {activeTab === "sports" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Create Sport</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "2fr 1.5fr 1fr 1fr auto" }}>
                <input
                  style={inputStyle}
                  placeholder="Name (e.g. Soccer)"
                  value={newSport.name}
                  onChange={(e) => setNewSport((prev) => ({ ...prev, name: e.target.value }))}
                />
                <input
                  style={inputStyle}
                  placeholder="Slug (e.g. soccer)"
                  value={newSport.slug}
                  onChange={(e) => setNewSport((prev) => ({ ...prev, slug: e.target.value }))}
                />
                <input
                  style={inputStyle}
                  placeholder="Short name"
                  value={newSport.shortName}
                  onChange={(e) => setNewSport((prev) => ({ ...prev, shortName: e.target.value }))}
                />
                <input
                  style={inputStyle}
                  type="number"
                  placeholder="Sort order"
                  value={newSport.sortOrder}
                  onChange={(e) => setNewSport((prev) => ({ ...prev, sortOrder: e.target.value }))}
                />
                <button
                  style={smallBtn("primary", submittingAction === "create-sport")}
                  disabled={submittingAction === "create-sport"}
                  onClick={() => void runAction("create-sport", async () => {
                    await superAdminFetch("/sports", {
                      method: "POST",
                      body: JSON.stringify({
                        name: newSport.name,
                        slug: newSport.slug,
                        shortName: newSport.shortName || undefined,
                        sortOrder: Number(newSport.sortOrder || 0),
                        isActive: newSport.isActive,
                      }),
                    });
                    setNewSport({ name: "", slug: "", shortName: "", sortOrder: "0", isActive: true });
                    await Promise.all([loadSportsAdmin(), loadLookups()]);
                  })}
                >
                  Create
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Sports ({sportsCount})</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={sportsSearch} onChange={(e) => setSportsSearch(e.target.value)} placeholder="Search sports" style={{ ...inputStyle, minWidth: 220 }} />
                  <button style={smallBtn("outline", sportsLoading)} onClick={() => void loadSportsAdmin()} disabled={sportsLoading}>Search</button>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Slug</th>
                      <th style={thStyle}>Short</th>
                      <th style={thStyle}>Sort</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sportsRows.map((row) => {
                      const draft = sportDrafts[row.id] ?? {
                        name: row.name,
                        slug: row.slug,
                        shortName: row.shortName || "",
                        sortOrder: row.sortOrder,
                        isActive: row.isActive,
                      };
                      return (
                        <tr key={row.id}>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.name ?? "")} onChange={(e) => setSportDrafts((prev) => ({ ...prev, [row.id]: { ...draft, name: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.slug ?? "")} onChange={(e) => setSportDrafts((prev) => ({ ...prev, [row.id]: { ...draft, slug: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.shortName ?? "")} onChange={(e) => setSportDrafts((prev) => ({ ...prev, [row.id]: { ...draft, shortName: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} type="number" value={String(draft.sortOrder ?? 0)} onChange={(e) => setSportDrafts((prev) => ({ ...prev, [row.id]: { ...draft, sortOrder: Number(e.target.value || 0) } }))} /></td>
                          <td style={tdStyle}><input type="checkbox" checked={Boolean(draft.isActive)} onChange={(e) => setSportDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isActive: e.target.checked } }))} /></td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={smallBtn("primary", submittingAction === `save-sport-${row.id}`)}
                                disabled={submittingAction === `save-sport-${row.id}`}
                                onClick={() => void runAction(`save-sport-${row.id}`, async () => {
                                  await superAdminFetch(`/sports/${row.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      name: draft.name,
                                      slug: draft.slug,
                                      shortName: draft.shortName || null,
                                      sortOrder: Number(draft.sortOrder || 0),
                                      isActive: draft.isActive,
                                    }),
                                  });
                                  await Promise.all([loadSportsAdmin(), loadLookups()]);
                                })}
                              >
                                Save
                              </button>
                              <button
                                style={smallBtn("danger", submittingAction === `archive-sport-${row.id}`)}
                                disabled={submittingAction === `archive-sport-${row.id}`}
                                onClick={() => void runAction(`archive-sport-${row.id}`, async () => {
                                  await superAdminFetch(`/sports/${row.id}`, { method: "DELETE" });
                                  await Promise.all([loadSportsAdmin(), loadLookups(), loadLeaguesAdmin()]);
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

        {activeTab === "leagues" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Create League</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1.2fr 1fr auto" }}>
                <select style={inputStyle} value={newLeague.sportId} onChange={(e) => setNewLeague((prev) => ({ ...prev, sportId: e.target.value }))}>
                  <option value="">Sport</option>
                  {lookupSports.map((sport) => (
                    <option key={sport.id} value={sport.id}>{sport.name}</option>
                  ))}
                </select>
                <input style={inputStyle} placeholder="League name" value={newLeague.name} onChange={(e) => setNewLeague((prev) => ({ ...prev, name: e.target.value }))} />
                <input style={inputStyle} placeholder="Short name" value={newLeague.shortName} onChange={(e) => setNewLeague((prev) => ({ ...prev, shortName: e.target.value }))} />
                <input style={inputStyle} placeholder="External ID" value={newLeague.externalId} onChange={(e) => setNewLeague((prev) => ({ ...prev, externalId: e.target.value }))} />
                <input style={inputStyle} placeholder="Country" value={newLeague.country} onChange={(e) => setNewLeague((prev) => ({ ...prev, country: e.target.value }))} />
                <input style={inputStyle} type="number" placeholder="Sort" value={newLeague.sortOrder} onChange={(e) => setNewLeague((prev) => ({ ...prev, sortOrder: e.target.value }))} />
                <button
                  style={smallBtn("primary", submittingAction === "create-league")}
                  disabled={submittingAction === "create-league"}
                  onClick={() => void runAction("create-league", async () => {
                    await superAdminFetch("/leagues", {
                      method: "POST",
                      body: JSON.stringify({
                        sportId: newLeague.sportId,
                        name: newLeague.name,
                        shortName: newLeague.shortName || undefined,
                        logoUrl: newLeague.logoUrl || undefined,
                        externalId: newLeague.externalId || undefined,
                        country: newLeague.country || undefined,
                        sortOrder: Number(newLeague.sortOrder || 0),
                        isActive: newLeague.isActive,
                      }),
                    });
                    setNewLeague({
                      sportId: lookupSports[0]?.id || "",
                      name: "",
                      shortName: "",
                      logoUrl: "",
                      externalId: "",
                      country: "",
                      sortOrder: "0",
                      isActive: true,
                    });
                    await Promise.all([loadLeaguesAdmin(), loadLookups(), loadMatches()]);
                  })}
                >
                  Create
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Leagues ({leaguesCount})</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={adminLeaguesSearch} onChange={(e) => setAdminLeaguesSearch(e.target.value)} placeholder="Search leagues" style={{ ...inputStyle, minWidth: 220 }} />
                  <button style={smallBtn("outline", adminLeaguesLoading)} onClick={() => void loadLeaguesAdmin()} disabled={adminLeaguesLoading}>Search</button>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Sport</th>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Short</th>
                      <th style={thStyle}>External ID</th>
                      <th style={thStyle}>Country</th>
                      <th style={thStyle}>Sort</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminLeagues.map((row) => {
                      const draft = leagueDrafts[row.id] ?? {
                        sportId: row.sportId,
                        name: row.name,
                        shortName: row.shortName || "",
                        externalId: row.externalId || "",
                        country: row.country || "",
                        sortOrder: row.sortOrder,
                        isActive: row.isActive,
                      };
                      return (
                        <tr key={row.id}>
                          <td style={tdStyle}>
                            <select style={inputStyle} value={String(draft.sportId || "")} onChange={(e) => setLeagueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, sportId: e.target.value } }))}>
                              <option value="">Sport</option>
                              {lookupSports.map((sport) => (
                                <option key={sport.id} value={sport.id}>{sport.name}</option>
                              ))}
                            </select>
                          </td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.name ?? "")} onChange={(e) => setLeagueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, name: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.shortName ?? "")} onChange={(e) => setLeagueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, shortName: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.externalId ?? "")} onChange={(e) => setLeagueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, externalId: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.country ?? "")} onChange={(e) => setLeagueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, country: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} type="number" value={String(draft.sortOrder ?? 0)} onChange={(e) => setLeagueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, sortOrder: Number(e.target.value || 0) } }))} /></td>
                          <td style={tdStyle}><input type="checkbox" checked={Boolean(draft.isActive)} onChange={(e) => setLeagueDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isActive: e.target.checked } }))} /></td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={smallBtn("primary", submittingAction === `save-league-${row.id}`)}
                                disabled={submittingAction === `save-league-${row.id}`}
                                onClick={() => void runAction(`save-league-${row.id}`, async () => {
                                  await superAdminFetch(`/leagues/${row.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      sportId: draft.sportId,
                                      name: draft.name,
                                      shortName: draft.shortName || null,
                                      externalId: draft.externalId || null,
                                      country: draft.country || null,
                                      sortOrder: Number(draft.sortOrder || 0),
                                      isActive: draft.isActive,
                                    }),
                                  });
                                  await Promise.all([loadLeaguesAdmin(), loadLookups(), loadMatches()]);
                                })}
                              >
                                Save
                              </button>
                              <button
                                style={smallBtn("danger", submittingAction === `archive-league-${row.id}`)}
                                disabled={submittingAction === `archive-league-${row.id}`}
                                onClick={() => void runAction(`archive-league-${row.id}`, async () => {
                                  await superAdminFetch(`/leagues/${row.id}`, { method: "DELETE" });
                                  await Promise.all([loadLeaguesAdmin(), loadLookups(), loadMatches()]);
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

        {activeTab === "imports" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>CSV Match Import</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10 }}>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>
                  Required headers: <code>homeTeamName</code>, <code>awayTeamName</code>, <code>matchDateUtc</code>, plus <code>leagueId</code> or <code>leagueName</code>.
                  Optional headers: <code>status</code>, <code>stage</code>, <code>venueName</code>, <code>externalMatchId</code>.
                </p>
                <textarea
                  style={{ ...inputStyle, minHeight: 220, resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
                  placeholder={"homeTeamName,awayTeamName,matchDateUtc,leagueName,status,stage,venueName,externalMatchId\nTeam A,Team B,2026-04-01T18:30:00.000Z,MLS,SCHEDULED,Regular Season,Shell Energy Stadium,MW-1234"}
                  value={csvImportText}
                  onChange={(e) => setCsvImportText(e.target.value)}
                />
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
                  <input type="checkbox" checked={csvImportDryRun} onChange={(e) => setCsvImportDryRun(e.target.checked)} />
                  Dry run only (validate without writing rows)
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={smallBtn("primary", csvImporting)} disabled={csvImporting} onClick={() => void handleCsvImport()}>
                    {csvImporting ? "Running..." : "Run Import"}
                  </button>
                  <button style={smallBtn("outline")} onClick={() => setCsvImportText("")}>Clear</button>
                </div>
              </div>
            </div>

            {csvImportResult && (
              <div style={cardStyle}>
                <div style={sectionHeadStyle}>
                  <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Import Result</h2>
                </div>
                <div style={{ padding: 14, display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}><strong>{csvImportResult.rowsRead}</strong><div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Rows read</div></div>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}><strong>{csvImportResult.imported}</strong><div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Inserted</div></div>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}><strong>{csvImportResult.updated}</strong><div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Updated</div></div>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}><strong>{csvImportResult.failed}</strong><div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Failed</div></div>
                  </div>
                  {csvImportResult.errors.length > 0 && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10, maxHeight: 260, overflow: "auto" }}>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#ef4444" }}>Row-level errors</p>
                      {csvImportResult.errors.slice(0, 50).map((row) => (
                        <div key={`${row.row}-${row.message}`} style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4 }}>
                          Row {row.row}: {row.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "matches" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...cardStyle, overflow: "visible", position: "relative", zIndex: 20 }}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Create Match</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <select
                  style={inputStyle}
                  value={newMatch.eventFormat}
                  onChange={(e) => setNewMatch((prev) => ({
                    ...prev,
                    eventFormat: e.target.value as MatchEventFormat,
                    ...(e.target.value === "SINGLE_EVENT"
                      ? { homeTeamId: "", awayTeamId: "", homeTeamName: "", awayTeamName: "" }
                      : {}),
                  }))}
                >
                  <option value="HEAD_TO_HEAD">Head to Head</option>
                  <option value="SINGLE_EVENT">Single Event</option>
                </select>
                <select
                  style={inputStyle}
                  value={newMatch.leagueId}
                  onChange={(e) => {
                    const nextLeagueId = e.target.value;
                    setNewMatch((prev) => ({
                      ...prev,
                      leagueId: nextLeagueId,
                      eventFormat: isSingleEventLeagueId(nextLeagueId) ? "SINGLE_EVENT" : prev.eventFormat,
                    }));
                  }}
                >
                  <option value="">League</option>
                  {lookupLeagues.map((league) => (
                    <option key={league.id} value={league.id}>{league.shortName || league.name}</option>
                  ))}
                </select>
                {newMatch.eventFormat === "HEAD_TO_HEAD" ? (
                  <>
                    <SearchPicker
                      placeholder="Home team"
                      value={newMatch.homeTeamName}
                      selectedId={newMatch.homeTeamId || null}
                      searchKey={newMatch.leagueId || "no-league"}
                      initialOptions={buildTeamPickerOptions(newMatch.leagueId)}
                      excludeIds={newMatch.awayTeamId ? [newMatch.awayTeamId] : []}
                      createHint="Create team"
                      createFields={[
                        { key: "shortName", label: "Short name", placeholder: "Short name (optional)" },
                        { key: "crestUrl", label: "Crest URL", placeholder: "Crest URL (optional)" },
                      ]}
                      onInputChange={(nextValue) => setNewMatch((prev) => ({ ...prev, homeTeamId: "", homeTeamName: nextValue }))}
                      onSelect={(option) => setNewMatch((prev) => ({ ...prev, homeTeamId: option.id, homeTeamName: option.label }))}
                      onCreate={async (query, extra) => {
                        const team = await createTeam({
                          name: query,
                          shortName: extra.shortName?.trim() || undefined,
                          crestUrl: extra.crestUrl?.trim() || undefined,
                          leagueId: newMatch.leagueId || null,
                        });
                        setNewMatch((prev) => ({ ...prev, homeTeamId: team.id, homeTeamName: team.name }));
                      }}
                      search={async (query) => {
                        const rows = await searchTeamsForLeague(query, newMatch.leagueId || undefined);
                        return rows.filter((team) => team.id !== newMatch.awayTeamId).map((team) => teamToOption(team, leagueLabelById));
                      }}
                    />
                    <SearchPicker
                      placeholder="Away team"
                      value={newMatch.awayTeamName}
                      selectedId={newMatch.awayTeamId || null}
                      searchKey={newMatch.leagueId || "no-league"}
                      initialOptions={buildTeamPickerOptions(newMatch.leagueId)}
                      excludeIds={newMatch.homeTeamId ? [newMatch.homeTeamId] : []}
                      createHint="Create team"
                      createFields={[
                        { key: "shortName", label: "Short name", placeholder: "Short name (optional)" },
                        { key: "crestUrl", label: "Crest URL", placeholder: "Crest URL (optional)" },
                      ]}
                      onInputChange={(nextValue) => setNewMatch((prev) => ({ ...prev, awayTeamId: "", awayTeamName: nextValue }))}
                      onSelect={(option) => setNewMatch((prev) => ({ ...prev, awayTeamId: option.id, awayTeamName: option.label }))}
                      onCreate={async (query, extra) => {
                        const team = await createTeam({
                          name: query,
                          shortName: extra.shortName?.trim() || undefined,
                          crestUrl: extra.crestUrl?.trim() || undefined,
                          leagueId: newMatch.leagueId || null,
                        });
                        setNewMatch((prev) => ({ ...prev, awayTeamId: team.id, awayTeamName: team.name }));
                      }}
                      search={async (query) => {
                        const rows = await searchTeamsForLeague(query, newMatch.leagueId || undefined);
                        return rows.filter((team) => team.id !== newMatch.homeTeamId).map((team) => teamToOption(team, leagueLabelById));
                      }}
                    />
                  </>
                ) : (
                  <>
                    <input style={inputStyle} value={newMatch.eventTitle} onChange={(e) => setNewMatch((prev) => ({ ...prev, eventTitle: e.target.value }))} placeholder="Event title" />
                    <input style={inputStyle} value={newMatch.eventSubtitle} onChange={(e) => setNewMatch((prev) => ({ ...prev, eventSubtitle: e.target.value }))} placeholder="Event subtitle" />
                  </>
                )}
                <SearchPicker
                  placeholder="Stadium"
                  value={newMatch.venueName}
                  selectedId={newMatch.stadiumId || null}
                  searchKey="stadiums"
                  initialOptions={defaultStadiumOptions}
                  createHint="Create stadium"
                  createFields={[
                    { key: "city", label: "City", placeholder: "City (optional)" },
                    { key: "country", label: "Country", placeholder: "Country (optional)" },
                  ]}
                  onInputChange={(nextValue) => setNewMatch((prev) => ({ ...prev, stadiumId: "", venueName: nextValue }))}
                  onSelect={(option) => setNewMatch((prev) => ({ ...prev, stadiumId: option.id, venueName: option.label }))}
                  onCreate={async (query, extra) => {
                    const stadium = await createStadium({
                      name: query,
                      city: extra.city?.trim() || undefined,
                      country: extra.country?.trim() || undefined,
                    });
                    setNewMatch((prev) => ({ ...prev, stadiumId: stadium.id, venueName: stadium.name }));
                  }}
                  search={async (query) => (await searchStadiums(query)).map(stadiumToOption)}
                />
                <input style={inputStyle} type="datetime-local" value={newMatch.matchDateUtc} onChange={(e) => setNewMatch((prev) => ({ ...prev, matchDateUtc: e.target.value }))} />
                <select style={inputStyle} value={newMatch.status} onChange={(e) => setNewMatch((prev) => ({ ...prev, status: e.target.value as MatchRow["status"] }))}>
                  {MATCH_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px", fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                  <input
                    type="checkbox"
                    checked={newMatch.isFeatured}
                    onChange={(e) => setNewMatch((prev) => ({ ...prev, isFeatured: e.target.checked }))}
                  />
                  Featured match
                </label>
                <button
                  style={smallBtn("primary", submittingAction === "create-match")}
                  disabled={submittingAction === "create-match"}
                  onClick={() => void runAction("create-match", async () => {
                    await superAdminFetch("/matches", {
                      method: "POST",
                      body: JSON.stringify({
                        eventFormat: newMatch.eventFormat,
                        eventTitle: newMatch.eventFormat === "SINGLE_EVENT" ? newMatch.eventTitle || null : null,
                        eventSubtitle: newMatch.eventFormat === "SINGLE_EVENT" ? newMatch.eventSubtitle || null : null,
                        leagueId: newMatch.leagueId || null,
                        homeTeamId: newMatch.eventFormat === "HEAD_TO_HEAD" ? newMatch.homeTeamId || null : null,
                        awayTeamId: newMatch.eventFormat === "HEAD_TO_HEAD" ? newMatch.awayTeamId || null : null,
                        stadiumId: newMatch.stadiumId || null,
                        homeTeamName: newMatch.eventFormat === "HEAD_TO_HEAD" ? newMatch.homeTeamName : null,
                        awayTeamName: newMatch.eventFormat === "HEAD_TO_HEAD" ? newMatch.awayTeamName : null,
                        matchDateUtc: new Date(newMatch.matchDateUtc).toISOString(),
                        status: newMatch.status,
                        isFeatured: newMatch.isFeatured,
                        venueName: newMatch.venueName || null,
                      }),
                    });
                    setNewMatch({
                      eventFormat: "HEAD_TO_HEAD",
                      isFeatured: false,
                      eventTitle: "",
                      eventSubtitle: "",
                      leagueId: "",
                      homeTeamId: "",
                      awayTeamId: "",
                      stadiumId: "",
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
                      <th style={thStyle}>Format</th>
                      <th style={thStyle}>Home</th>
                      <th style={thStyle}>Away</th>
                      <th style={thStyle}>Kickoff</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Featured</th>
                      <th style={thStyle}>Venue</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((row) => {
                      const draft = matchDrafts[row.id] ?? {
                        eventFormat: row.eventFormat || "HEAD_TO_HEAD",
                        eventTitle: row.eventTitle || "",
                        eventSubtitle: row.eventSubtitle || "",
                        leagueId: row.leagueId || "",
                        homeTeamId: row.homeTeamId || "",
                        awayTeamId: row.awayTeamId || "",
                        stadiumId: row.stadiumId || "",
                        homeTeamName: row.homeTeamName,
                        awayTeamName: row.awayTeamName,
                        matchDateUtc: toDatetimeLocal(row.matchDateUtc),
                        status: row.status,
                        isFeatured: row.isFeatured,
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
                          <td style={tdStyle}>
                            <div style={{ display: "grid", gap: 6 }}>
                              <select
                                style={inputStyle}
                                value={String(draft.eventFormat || "HEAD_TO_HEAD")}
                                onChange={(e) => setMatchDrafts((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    ...draft,
                                    eventFormat: e.target.value as MatchEventFormat,
                                    ...(e.target.value === "SINGLE_EVENT"
                                      ? { homeTeamId: "", awayTeamId: "", homeTeamName: "", awayTeamName: "" }
                                      : {}),
                                  },
                                }))}
                              >
                                <option value="HEAD_TO_HEAD">Head to Head</option>
                                <option value="SINGLE_EVENT">Single Event</option>
                              </select>
                              {draft.eventFormat === "SINGLE_EVENT" && (
                                <>
                                  <input style={inputStyle} value={String(draft.eventTitle ?? "")} onChange={(e) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, eventTitle: e.target.value } }))} placeholder="Title" />
                                  <input style={inputStyle} value={String(draft.eventSubtitle ?? "")} onChange={(e) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, eventSubtitle: e.target.value } }))} placeholder="Subtitle" />
                                </>
                              )}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            {draft.eventFormat === "HEAD_TO_HEAD" ? (
                              <SearchPicker
                                placeholder="Home team"
                                value={String(draft.homeTeamName ?? "")}
                                selectedId={String(draft.homeTeamId ?? "") || null}
                                searchKey={String(draft.leagueId || "") || "no-league"}
                                initialOptions={buildTeamPickerOptions(String(draft.leagueId || "") || undefined)}
                                excludeIds={draft.awayTeamId ? [String(draft.awayTeamId)] : []}
                                createHint="Create team"
                                createFields={[
                                  { key: "shortName", label: "Short name", placeholder: "Short name (optional)" },
                                  { key: "crestUrl", label: "Crest URL", placeholder: "Crest URL (optional)" },
                                ]}
                                onInputChange={(nextValue) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, homeTeamId: "", homeTeamName: nextValue } }))}
                                onSelect={(option) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, homeTeamId: option.id, homeTeamName: option.label } }))}
                                onCreate={async (query, extra) => {
                                  const team = await createTeam({
                                    name: query,
                                    shortName: extra.shortName?.trim() || undefined,
                                    crestUrl: extra.crestUrl?.trim() || undefined,
                                    leagueId: String(draft.leagueId || "") || null,
                                  });
                                  setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, homeTeamId: team.id, homeTeamName: team.name } }));
                                }}
                                search={async (query) => {
                                  const rows = await searchTeamsForLeague(query, String(draft.leagueId || "") || undefined);
                                  return rows.filter((team) => team.id !== draft.awayTeamId).map((team) => teamToOption(team, leagueLabelById));
                                }}
                              />
                            ) : (
                              <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Single event</div>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {draft.eventFormat === "HEAD_TO_HEAD" ? (
                              <SearchPicker
                                placeholder="Away team"
                                value={String(draft.awayTeamName ?? "")}
                                selectedId={String(draft.awayTeamId ?? "") || null}
                                searchKey={String(draft.leagueId || "") || "no-league"}
                                initialOptions={buildTeamPickerOptions(String(draft.leagueId || "") || undefined)}
                                excludeIds={draft.homeTeamId ? [String(draft.homeTeamId)] : []}
                                createHint="Create team"
                                createFields={[
                                  { key: "shortName", label: "Short name", placeholder: "Short name (optional)" },
                                  { key: "crestUrl", label: "Crest URL", placeholder: "Crest URL (optional)" },
                                ]}
                                onInputChange={(nextValue) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, awayTeamId: "", awayTeamName: nextValue } }))}
                                onSelect={(option) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, awayTeamId: option.id, awayTeamName: option.label } }))}
                                onCreate={async (query, extra) => {
                                  const team = await createTeam({
                                    name: query,
                                    shortName: extra.shortName?.trim() || undefined,
                                    crestUrl: extra.crestUrl?.trim() || undefined,
                                    leagueId: String(draft.leagueId || "") || null,
                                  });
                                  setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, awayTeamId: team.id, awayTeamName: team.name } }));
                                }}
                                search={async (query) => {
                                  const rows = await searchTeamsForLeague(query, String(draft.leagueId || "") || undefined);
                                  return rows.filter((team) => team.id !== draft.homeTeamId).map((team) => teamToOption(team, leagueLabelById));
                                }}
                              />
                            ) : (
                              <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{String(draft.eventSubtitle ?? "") || "No subtitle"}</div>
                            )}
                          </td>
                          <td style={tdStyle}><input style={inputStyle} type="datetime-local" value={String(draft.matchDateUtc ?? "")} onChange={(e) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, matchDateUtc: e.target.value } }))} /></td>
                          <td style={tdStyle}>
                            <select style={inputStyle} value={String(draft.status ?? "SCHEDULED")} onChange={(e) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, status: e.target.value as MatchRow["status"] } }))}>
                              {MATCH_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </td>
                          <td style={tdStyle}>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
                              <input
                                type="checkbox"
                                checked={Boolean(draft.isFeatured)}
                                onChange={(e) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, isFeatured: e.target.checked } }))}
                              />
                              Featured
                            </label>
                          </td>
                          <td style={tdStyle}>
                            <SearchPicker
                              placeholder="Stadium"
                              value={String(draft.venueName ?? "")}
                              selectedId={String(draft.stadiumId ?? "") || null}
                              searchKey="stadiums"
                              initialOptions={defaultStadiumOptions}
                              createHint="Create stadium"
                              createFields={[
                                { key: "city", label: "City", placeholder: "City (optional)" },
                                { key: "country", label: "Country", placeholder: "Country (optional)" },
                              ]}
                              onInputChange={(nextValue) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, stadiumId: "", venueName: nextValue } }))}
                              onSelect={(option) => setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, stadiumId: option.id, venueName: option.label } }))}
                              onCreate={async (query, extra) => {
                                const stadium = await createStadium({
                                  name: query,
                                  city: extra.city?.trim() || undefined,
                                  country: extra.country?.trim() || undefined,
                                });
                                setMatchDrafts((prev) => ({ ...prev, [row.id]: { ...draft, stadiumId: stadium.id, venueName: stadium.name } }));
                              }}
                              search={async (query) => (await searchStadiums(query)).map(stadiumToOption)}
                            />
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={smallBtn("primary", submittingAction === `save-match-${row.id}`)}
                                disabled={submittingAction === `save-match-${row.id}`}
                                onClick={() => void runAction(`save-match-${row.id}`, async () => {
                                  await superAdminFetch(`/matches/${row.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      eventFormat: draft.eventFormat || "HEAD_TO_HEAD",
                                      eventTitle: draft.eventFormat === "SINGLE_EVENT" ? draft.eventTitle || null : null,
                                      eventSubtitle: draft.eventFormat === "SINGLE_EVENT" ? draft.eventSubtitle || null : null,
                                      leagueId: draft.leagueId || null,
                                      homeTeamId: draft.eventFormat === "HEAD_TO_HEAD" ? draft.homeTeamId || null : null,
                                      awayTeamId: draft.eventFormat === "HEAD_TO_HEAD" ? draft.awayTeamId || null : null,
                                      stadiumId: draft.stadiumId || null,
                                      homeTeamName: draft.eventFormat === "HEAD_TO_HEAD" ? draft.homeTeamName : null,
                                      awayTeamName: draft.eventFormat === "HEAD_TO_HEAD" ? draft.awayTeamName : null,
                                      matchDateUtc: draft.matchDateUtc ? new Date(String(draft.matchDateUtc)).toISOString() : undefined,
                                      status: draft.status,
                                      isFeatured: Boolean(draft.isFeatured),
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

        {activeTab === "motorsportEntries" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...cardStyle, overflow: "visible", position: "relative", zIndex: 20 }}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Create Motorsport Entry</h2>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <select style={inputStyle} value={newMotorsportEntry.matchId} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, matchId: e.target.value }))}>
                  <option value="">Motorsport event</option>
                  {motorsportLookupMatches.map((match) => (
                    <option key={match.id} value={match.id}>{formatLookupMatchLabel(match)}</option>
                  ))}
                </select>
                <input style={inputStyle} value={newMotorsportEntry.carNumber} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, carNumber: e.target.value }))} placeholder="Car number" />
                <input style={inputStyle} value={newMotorsportEntry.driverName} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, driverName: e.target.value }))} placeholder="Driver name" />
                <input style={inputStyle} value={newMotorsportEntry.driverShortName} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, driverShortName: e.target.value }))} placeholder="Driver short name" />
                <input style={inputStyle} value={newMotorsportEntry.driverNationality} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, driverNationality: e.target.value }))} placeholder="Nationality" />
                <input style={inputStyle} value={newMotorsportEntry.driverCountryCode} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, driverCountryCode: e.target.value.toUpperCase() }))} placeholder="Country code" />
                <input style={inputStyle} value={newMotorsportEntry.entrantName} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, entrantName: e.target.value }))} placeholder="Entrant / team" />
                <input style={inputStyle} value={newMotorsportEntry.entrantShortName} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, entrantShortName: e.target.value }))} placeholder="Team short name" />
                <input style={inputStyle} value={newMotorsportEntry.entrantBrandColor} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, entrantBrandColor: e.target.value }))} placeholder="Brand color" />
                <input style={inputStyle} value={newMotorsportEntry.manufacturerName} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, manufacturerName: e.target.value }))} placeholder="Manufacturer" />
                <input style={inputStyle} value={newMotorsportEntry.manufacturerShortName} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, manufacturerShortName: e.target.value }))} placeholder="Manufacturer short name" />
                <input style={inputStyle} value={newMotorsportEntry.displayName} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, displayName: e.target.value }))} placeholder="Display name (optional)" />
                <input style={inputStyle} value={newMotorsportEntry.gridPosition} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, gridPosition: e.target.value }))} placeholder="Grid" />
                <input style={inputStyle} value={newMotorsportEntry.startPosition} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, startPosition: e.target.value }))} placeholder="Start" />
                <input style={inputStyle} value={newMotorsportEntry.finishPosition} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, finishPosition: e.target.value }))} placeholder="Finish" />
                <select style={inputStyle} value={newMotorsportEntry.status} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, status: e.target.value as MotorsportEntryStatus }))}>
                  {MOTORSPORT_ENTRY_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <input style={inputStyle} value={newMotorsportEntry.points} onChange={(e) => setNewMotorsportEntry((prev) => ({ ...prev, points: e.target.value }))} placeholder="Points" />
                <button
                  style={smallBtn("primary", submittingAction === "create-motorsport-entry")}
                  disabled={submittingAction === "create-motorsport-entry"}
                  onClick={() => void runAction("create-motorsport-entry", async () => {
                    await superAdminFetch("/motorsport-entries", {
                      method: "POST",
                      body: JSON.stringify({
                        matchId: newMotorsportEntry.matchId,
                        carNumber: newMotorsportEntry.carNumber || undefined,
                        driverName: newMotorsportEntry.driverName || undefined,
                        driverShortName: newMotorsportEntry.driverShortName || undefined,
                        driverNationality: newMotorsportEntry.driverNationality || undefined,
                        driverCountryCode: newMotorsportEntry.driverCountryCode || undefined,
                        entrantName: newMotorsportEntry.entrantName || undefined,
                        entrantShortName: newMotorsportEntry.entrantShortName || undefined,
                        entrantBrandColor: newMotorsportEntry.entrantBrandColor || undefined,
                        manufacturerName: newMotorsportEntry.manufacturerName || undefined,
                        manufacturerShortName: newMotorsportEntry.manufacturerShortName || undefined,
                        displayName: newMotorsportEntry.displayName || undefined,
                        gridPosition: parseOptionalNumber(newMotorsportEntry.gridPosition),
                        startPosition: parseOptionalNumber(newMotorsportEntry.startPosition),
                        finishPosition: parseOptionalNumber(newMotorsportEntry.finishPosition),
                        status: newMotorsportEntry.status,
                        points: parseOptionalNumber(newMotorsportEntry.points),
                      }),
                    });
                    setNewMotorsportEntry({
                      matchId: newMotorsportEntry.matchId,
                      carNumber: "",
                      driverName: "",
                      driverShortName: "",
                      driverNationality: "",
                      driverCountryCode: "",
                      entrantName: "",
                      entrantShortName: "",
                      entrantBrandColor: "",
                      manufacturerName: "",
                      manufacturerShortName: "",
                      displayName: "",
                      gridPosition: "",
                      startPosition: "",
                      finishPosition: "",
                      status: "ENTERED",
                      points: "",
                    });
                    setMotorsportEntriesMatchId((prev) => prev || newMotorsportEntry.matchId);
                    await Promise.all([loadMotorsportEntries(), loadLookups()]);
                  })}
                >
                  Create
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionHeadStyle}>
                <h2 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Motorsport Entries ({motorsportEntriesCount})</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select style={{ ...inputStyle, minWidth: 240 }} value={motorsportEntriesMatchId} onChange={(e) => setMotorsportEntriesMatchId(e.target.value)}>
                    <option value="">All motorsport events</option>
                    {motorsportLookupMatches.map((match) => (
                      <option key={match.id} value={match.id}>{formatLookupMatchLabel(match)}</option>
                    ))}
                  </select>
                  <input value={motorsportEntriesSearch} onChange={(e) => setMotorsportEntriesSearch(e.target.value)} placeholder="Search entries" style={{ ...inputStyle, minWidth: 220 }} />
                  <button style={smallBtn("outline", motorsportEntriesLoading)} onClick={() => void loadMotorsportEntries()} disabled={motorsportEntriesLoading}>Search</button>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Event</th>
                      <th style={thStyle}>Car</th>
                      <th style={thStyle}>Driver</th>
                      <th style={thStyle}>Entrant</th>
                      <th style={thStyle}>Manufacturer</th>
                      <th style={thStyle}>Grid</th>
                      <th style={thStyle}>Start</th>
                      <th style={thStyle}>Finish</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Points</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {motorsportEntries.map((row) => {
                      const draft = motorsportEntryDrafts[row.id] ?? {
                        matchId: row.matchId,
                        carNumber: row.carNumber || "",
                        displayName: row.displayName || "",
                        driverName: row.driverName || "",
                        driverShortName: row.driverShortName || "",
                        driverNationality: row.driverNationality || "",
                        driverCountryCode: row.driverCountryCode || "",
                        entrantName: row.entrantName || "",
                        entrantShortName: row.entrantShortName || "",
                        entrantBrandColor: row.entrantBrandColor || "",
                        manufacturerName: row.manufacturerName || "",
                        manufacturerShortName: row.manufacturerShortName || "",
                        gridPosition: row.gridPosition ?? "",
                        startPosition: row.startPosition ?? "",
                        finishPosition: row.finishPosition ?? "",
                        status: row.status,
                        points: row.points ?? "",
                      };
                      return (
                        <tr key={row.id}>
                          <td style={tdStyle}>
                            <select style={{ ...inputStyle, minWidth: 220 }} value={String(draft.matchId ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, matchId: e.target.value } }))}>
                              <option value="">Motorsport event</option>
                              {motorsportLookupMatches.map((match) => (
                                <option key={match.id} value={match.id}>{formatLookupMatchLabel(match)}</option>
                              ))}
                            </select>
                            <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted-foreground)" }}>
                              {row.matchSubtitle || formatLookupMatchSubtitle(lookupMatches.find((match) => match.id === (draft.matchId || row.matchId)) || {
                                id: row.matchId,
                                eventFormat: "SINGLE_EVENT",
                                eventTitle: row.matchLabel || "",
                                eventSubtitle: row.matchSubtitle || "",
                                homeTeamName: null,
                                awayTeamName: null,
                                matchDateUtc: "",
                                status: "",
                                leagueId: null,
                              })}
                            </div>
                          </td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.carNumber ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, carNumber: e.target.value } }))} /></td>
                          <td style={tdStyle}>
                            <div style={{ display: "grid", gap: 6 }}>
                              <input style={inputStyle} value={String(draft.driverName ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, driverName: e.target.value } }))} />
                              <input style={inputStyle} value={String(draft.driverShortName ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, driverShortName: e.target.value } }))} placeholder="Short" />
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "grid", gap: 6 }}>
                              <input style={inputStyle} value={String(draft.entrantName ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, entrantName: e.target.value } }))} />
                              <input style={inputStyle} value={String(draft.entrantShortName ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, entrantShortName: e.target.value } }))} placeholder="Short" />
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "grid", gap: 6 }}>
                              <input style={inputStyle} value={String(draft.manufacturerName ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, manufacturerName: e.target.value } }))} />
                              <input style={inputStyle} value={String(draft.manufacturerShortName ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, manufacturerShortName: e.target.value } }))} placeholder="Short" />
                            </div>
                          </td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.gridPosition ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, gridPosition: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.startPosition ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, startPosition: e.target.value } }))} /></td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.finishPosition ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, finishPosition: e.target.value } }))} /></td>
                          <td style={tdStyle}>
                            <select style={inputStyle} value={String(draft.status ?? "ENTERED")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, status: e.target.value as MotorsportEntryStatus } }))}>
                              {MOTORSPORT_ENTRY_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </td>
                          <td style={tdStyle}><input style={inputStyle} value={String(draft.points ?? "")} onChange={(e) => setMotorsportEntryDrafts((prev) => ({ ...prev, [row.id]: { ...draft, points: e.target.value } }))} /></td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                style={smallBtn("primary", submittingAction === `save-entry-${row.id}`)}
                                disabled={submittingAction === `save-entry-${row.id}`}
                                onClick={() => void runAction(`save-entry-${row.id}`, async () => {
                                  await superAdminFetch(`/motorsport-entries/${row.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      matchId: draft.matchId || row.matchId,
                                      carNumber: draft.carNumber || null,
                                      displayName: draft.displayName || null,
                                      driverName: draft.driverName || undefined,
                                      driverShortName: draft.driverShortName || null,
                                      driverNationality: draft.driverNationality || null,
                                      driverCountryCode: draft.driverCountryCode || null,
                                      entrantName: draft.entrantName || undefined,
                                      entrantShortName: draft.entrantShortName || null,
                                      entrantBrandColor: draft.entrantBrandColor || null,
                                      manufacturerName: draft.manufacturerName || undefined,
                                      manufacturerShortName: draft.manufacturerShortName || null,
                                      gridPosition: parseOptionalNumber(draft.gridPosition as string | number | null | undefined),
                                      startPosition: parseOptionalNumber(draft.startPosition as string | number | null | undefined),
                                      finishPosition: parseOptionalNumber(draft.finishPosition as string | number | null | undefined),
                                      status: draft.status,
                                      points: parseOptionalNumber(draft.points as string | number | null | undefined),
                                    }),
                                  });
                                  await loadMotorsportEntries();
                                })}
                              >
                                Save
                              </button>
                              <button
                                style={smallBtn("danger", submittingAction === `delete-entry-${row.id}`)}
                                disabled={submittingAction === `delete-entry-${row.id}`}
                                onClick={() => void runAction(`delete-entry-${row.id}`, async () => {
                                  await superAdminFetch(`/motorsport-entries/${row.id}`, { method: "DELETE" });
                                  await loadMotorsportEntries();
                                })}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {motorsportEntries.length === 0 && !motorsportEntriesLoading && (
                      <tr>
                        <td style={{ ...tdStyle, textAlign: "center", color: "var(--muted-foreground)" }} colSpan={11}>
                          No motorsport entries found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "blog" && (
          <section style={{ display: "grid", gap: 14 }}>
            <BlogAdminPanel />
          </section>
        )}
      </main>
    </AppShell>
  );
}

