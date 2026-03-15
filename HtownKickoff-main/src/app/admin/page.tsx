"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock4,
  ImagePlus,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Search,
  Save,
  Sparkles,
  Ticket,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { ThemeProvider, AppShell } from "../../components/AppShell";
import { useAuth } from "../../lib/auth-context";
import { api, uploadApi } from "../../lib/api";
import { useData } from "../../lib/data-provider";
import { EVENT_WATCH_PARTY_TYPES } from "../../lib/tags";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";

type DashboardOverview = {
  venue: {
    id: string;
    name: string;
    slug: string;
    city: string;
    isVerified: boolean;
  };
  stats: {
    totalBookings: number;
    recentBookings: number;
    followers: number;
    averageRating: string;
    totalReviews: number;
  };
  upcomingEvents: Array<{
    id: string;
    match: {
      id: string;
      homeTeamName: string;
      awayTeamName: string;
      matchDateUtc: string;
    };
    bookingLimit?: number | null;
    confirmedBookingsCount: number;
    spotsRemaining?: number | null;
  }>;
};

type OwnerEvent = {
  id: string;
  matchId: string;
  bookingLimit?: number | null;
  confirmedBookingsCount: number;
  specialNotes?: string | null;
  requiresApproval: boolean;
  match: {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    matchDateUtc: string;
    stage?: string | null;
  };
};

type GroupedBookingEvent = {
  id: string;
  bookingLimit?: number | null;
  confirmedBookingsCount: number;
  spotsRemaining?: number | null;
  occupancyPercent?: number | null;
  specialNotes?: string | null;
  match: {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    matchDateUtc: string;
  };
  bookings: Array<{
    id: string;
    bookingReference: string;
    partySize: number;
    status: string;
    createdAt: string;
    specialRequests?: string | null;
    user: { name: string; email: string };
  }>;
};

type UpcomingMatch = {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamCrestUrl?: string | null;
  awayTeamCrestUrl?: string | null;
  matchDateUtc: string;
  status: string;
  league?: {
    id: string;
    name: string;
    shortName?: string | null;
  } | null;
};

type VenueProfile = {
  name?: string | null;
  description?: string | null;
  phone?: string | null;
  coverImageUrl?: string | null;
  coverImageS3Key?: string | null;
  galleryImageUrls?: string[];
  galleryS3Keys?: string[];
  promotedVenueEventId?: string | null;
};

type CustomEvent = {
  id: string;
  title: string;
  description?: string | null;
  eventTypeTags: string[];
  startsAt: string;
  endsAt: string;
  imageUrl?: string | null;
  imageS3Key?: string | null;
  bookingNotes?: string | null;
};

type MenuCategory = {
  id: string;
  name: string;
  description?: string | null;
  items: Array<{
    id: string;
    name: string;
    description?: string | null;
    price: string;
    isAvailable: boolean;
    isFeatured?: boolean;
  }>;
};

type GalleryItem = {
  url: string;
  key: string;
};

const MAX_GALLERY_IMAGES = 5;
const MAX_IMAGE_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function formatDateTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getLeagueLabel(match: UpcomingMatch) {
  const shortName = match.league?.shortName?.trim();
  const name = match.league?.name?.trim();
  if (shortName) return shortName;
  if (name) return name;
  return "Other";
}

function normalizeImageUrl(url?: string | null) {
  const value = (url || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }
  return `https://${value}`;
}

function parseGalleryItems(urls?: string[] | null, keys?: string[] | null): GalleryItem[] {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const keyList = Array.isArray(keys) ? keys : [];
  return urls
    .map((url, idx) => ({
      url: normalizeImageUrl(url),
      key: keyList[idx] || "",
    }))
    .filter((item) => item.url)
    .slice(0, MAX_GALLERY_IMAGES);
}

async function uploadVenueImage(file: File, purpose: "venue_cover" | "venue_gallery" | "post") {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, WEBP, and GIF files are allowed.");
  }
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    throw new Error("Image is too large. Maximum file size is 4MB.");
  }

  const presigned = await uploadApi.createPresignedUrl({
    filename: file.name,
    contentType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
    purpose,
    fileSize: file.size,
  });

  const putRes = await fetch(presigned.data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error("Image upload failed. Check S3 configuration and try again.");
  }

  return {
    url: normalizeImageUrl(presigned.data.publicUrl),
    key: presigned.data.key,
  };
}

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

export default function AdminPage() {
  const { isAuthenticated, user } = useAuth();
  const { refetch } = useData();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");

  const [overview, setOverview] = React.useState<DashboardOverview | null>(null);
  const [events, setEvents] = React.useState<OwnerEvent[]>([]);
  const [bookingsByEvent, setBookingsByEvent] = React.useState<GroupedBookingEvent[]>([]);
  const [upcomingMatches, setUpcomingMatches] = React.useState<UpcomingMatch[]>([]);
  const [customEvents, setCustomEvents] = React.useState<CustomEvent[]>([]);
  const [menu, setMenu] = React.useState<MenuCategory[]>([]);

  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showMatchPicker, setShowMatchPicker] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<"match" | "custom">("match");
  const [expandedEventId, setExpandedEventId] = React.useState<string | null>(null);

  const [creatingEvent, setCreatingEvent] = React.useState(false);
  const [updatingBooking, setUpdatingBooking] = React.useState(false);
  const [bookingAction, setBookingAction] = React.useState<{
    bookingId: string;
    action: "CONFIRMED" | "CANCELLED_BY_VENUE";
  } | null>(null);
  const [updatingPromotion, setUpdatingPromotion] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [uploadingCover, setUploadingCover] = React.useState(false);
  const [uploadingGallery, setUploadingGallery] = React.useState(false);
  const [creatingMenuCategory, setCreatingMenuCategory] = React.useState(false);
  const [creatingMenuItem, setCreatingMenuItem] = React.useState(false);

  const [newEventMatchId, setNewEventMatchId] = React.useState("");
  const [matchPickerLeague, setMatchPickerLeague] = React.useState("all");
  const [matchPickerSearch, setMatchPickerSearch] = React.useState("");
  const [newEventLimit, setNewEventLimit] = React.useState("");
  const [newEventNotes, setNewEventNotes] = React.useState("");
  const [newEventRequiresApproval, setNewEventRequiresApproval] = React.useState(false);

  const [customTitle, setCustomTitle] = React.useState("");
  const [customDescription, setCustomDescription] = React.useState("");
  const [customStartsAt, setCustomStartsAt] = React.useState("");
  const [customEndsAt, setCustomEndsAt] = React.useState("");
  const [customTags, setCustomTags] = React.useState<string[]>([]);
  const [customBookingNotes, setCustomBookingNotes] = React.useState("");
  const [customImageUrl, setCustomImageUrl] = React.useState("");
  const [customImageS3Key, setCustomImageS3Key] = React.useState("");
  const customImageInputRef = React.useRef<HTMLInputElement | null>(null);

  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryDescription, setNewCategoryDescription] = React.useState("");
  const [newMenuItemCategoryId, setNewMenuItemCategoryId] = React.useState("");
  const [newMenuItemName, setNewMenuItemName] = React.useState("");
  const [newMenuItemDescription, setNewMenuItemDescription] = React.useState("");
  const [newMenuItemPrice, setNewMenuItemPrice] = React.useState("");

  const [venueName, setVenueName] = React.useState("");
  const [venueDescription, setVenueDescription] = React.useState("");
  const [venuePhone, setVenuePhone] = React.useState("");
  const [coverImageUrl, setCoverImageUrl] = React.useState("");
  const [coverImageS3Key, setCoverImageS3Key] = React.useState("");
  const [galleryItems, setGalleryItems] = React.useState<GalleryItem[]>([]);
  const [promotedEventId, setPromotedEventId] = React.useState<string | null>(null);
  const coverInputRef = React.useRef<HTMLInputElement | null>(null);
  const galleryInputRef = React.useRef<HTMLInputElement | null>(null);

  const availableMatches = React.useMemo(() => {
    const existing = new Set(events.map((event) => event.matchId));
    return upcomingMatches.filter((match) => !existing.has(match.id));
  }, [events, upcomingMatches]);

  const selectedNewEventMatch = React.useMemo(
    () => upcomingMatches.find((match) => match.id === newEventMatchId) || null,
    [upcomingMatches, newEventMatchId],
  );

  const matchPickerLeagueOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const match of upcomingMatches) {
      const leagueId = match.league?.id || "unknown";
      if (!seen.has(leagueId)) {
        seen.set(leagueId, getLeagueLabel(match));
      }
    }
    return Array.from(seen.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [upcomingMatches]);

  const matchPickerRows = React.useMemo(() => {
    const keyword = matchPickerSearch.trim().toLowerCase();
    return upcomingMatches
      .filter((match) => {
        if (matchPickerLeague !== "all" && (match.league?.id || "unknown") !== matchPickerLeague) {
          return false;
        }
        if (!keyword) return true;
        const haystack = [
          match.homeTeamName,
          match.awayTeamName,
          match.league?.name || "",
          match.league?.shortName || "",
        ].join(" ").toLowerCase();
        return haystack.includes(keyword);
      })
      .sort((a, b) => new Date(a.matchDateUtc).getTime() - new Date(b.matchDateUtc).getTime());
  }, [upcomingMatches, matchPickerLeague, matchPickerSearch]);

  const matchPickerGroupedRows = React.useMemo(() => {
    const grouped = new Map<string, { leagueId: string; leagueLabel: string; matches: UpcomingMatch[] }>();
    for (const match of matchPickerRows) {
      const leagueId = match.league?.id || "unknown";
      const existing = grouped.get(leagueId);
      if (existing) {
        existing.matches.push(match);
      } else {
        grouped.set(leagueId, {
          leagueId,
          leagueLabel: getLeagueLabel(match),
          matches: [match],
        });
      }
    }
    return Array.from(grouped.values()).sort((a, b) => a.leagueLabel.localeCompare(b.leagueLabel));
  }, [matchPickerRows]);

  const loadDashboard = React.useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        overviewRes,
        eventsRes,
        bookingsByEventRes,
        venueRes,
        upcomingMatchesRes,
        customEventsRes,
        menuRes,
      ] = await Promise.all([
        api.get<DashboardOverview>("/dashboard"),
        api.get<OwnerEvent[]>("/dashboard/events"),
        api.get<GroupedBookingEvent[]>("/dashboard/bookings/events"),
        api.get<VenueProfile>("/dashboard/venue"),
        api.get<Record<string, UpcomingMatch[]>>("/matches/upcoming"),
        api.get<CustomEvent[]>("/dashboard/custom-events"),
        api.get<MenuCategory[]>("/dashboard/menu"),
      ]);

      setOverview(overviewRes.data);
      setEvents(eventsRes.data || []);
      setBookingsByEvent(bookingsByEventRes.data || []);
      setCustomEvents(customEventsRes.data || []);
      setMenu(menuRes.data || []);

      const profile = venueRes.data || {};
      setVenueName(profile.name || "");
      setVenueDescription(profile.description || "");
      setVenuePhone(profile.phone || "");
      setCoverImageUrl(normalizeImageUrl(profile.coverImageUrl));
      setCoverImageS3Key(profile.coverImageS3Key || "");
      setGalleryItems(parseGalleryItems(profile.galleryImageUrls, profile.galleryS3Keys));
      setPromotedEventId(typeof profile.promotedVenueEventId === "string" ? profile.promotedVenueEventId : null);

      const groupedUpcomingMatches = upcomingMatchesRes.data || {};
      const flattened = Object.values(groupedUpcomingMatches)
        .flat()
        .sort(
          (a, b) =>
            new Date(a.matchDateUtc).getTime() - new Date(b.matchDateUtc).getTime(),
        );
      setUpcomingMatches(flattened);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  React.useEffect(() => {
    if (availableMatches.length === 0) {
      if (newEventMatchId) setNewEventMatchId("");
      return;
    }

    if (!availableMatches.some((match) => match.id === newEventMatchId)) {
      setNewEventMatchId(availableMatches[0].id);
    }
  }, [availableMatches, newEventMatchId]);

  React.useEffect(() => {
    if (!showCreateModal) {
      setShowMatchPicker(false);
      setMatchPickerLeague("all");
      setMatchPickerSearch("");
    }
  }, [showCreateModal]);

  React.useEffect(() => {
    if (createMode !== "match") {
      setShowMatchPicker(false);
    }
  }, [createMode]);

  React.useEffect(() => {
    if (newMenuItemCategoryId) return;
    if (menu.length > 0) {
      setNewMenuItemCategoryId(menu[0].id);
    }
  }, [menu, newMenuItemCategoryId]);

  const createMatchEvent = async () => {
    if (!newEventMatchId) return;

    setCreatingEvent(true);
    setError(null);
    try {
      await api.post("/dashboard/events", {
        matchId: newEventMatchId,
        bookingLimit: newEventLimit ? Number(newEventLimit) : undefined,
        specialNotes: newEventNotes || undefined,
        requiresApproval: newEventRequiresApproval,
      });
      setNewEventLimit("");
      setNewEventNotes("");
      setNewEventRequiresApproval(false);
      setShowCreateModal(false);
      await Promise.all([loadDashboard(), refetch()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create match event");
    } finally {
      setCreatingEvent(false);
    }
  };

  const updateVenuePromotion = async (venueEventId: string | null) => {
    setUpdatingPromotion(true);
    setError(null);
    try {
      await api.put<{ promotedVenueEventId: string | null }>("/dashboard/venue/promotion", {
        venueEventId,
      });
      setPromotedEventId(venueEventId);
      await Promise.all([loadDashboard(), refetch()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update promoted event");
    } finally {
      setUpdatingPromotion(false);
    }
  };

  const createCustomEvent = async () => {
    if (!customTitle.trim() || !customStartsAt || !customEndsAt || customTags.length === 0) {
      setError("Fill title, start/end time, and at least one event type.");
      return;
    }

    setCreatingEvent(true);
    setError(null);
    try {
      await api.post("/dashboard/custom-events", {
        title: customTitle.trim(),
        description: customDescription.trim() || undefined,
        startsAt: new Date(customStartsAt).toISOString(),
        endsAt: new Date(customEndsAt).toISOString(),
        eventTypeTags: customTags,
        bookingNotes: customBookingNotes.trim() || undefined,
        imageUrl: customImageUrl || undefined,
        imageS3Key: customImageS3Key || undefined,
      });

      setCustomTitle("");
      setCustomDescription("");
      setCustomStartsAt("");
      setCustomEndsAt("");
      setCustomTags([]);
      setCustomBookingNotes("");
      setCustomImageUrl("");
      setCustomImageS3Key("");
      setShowCreateModal(false);
      await Promise.all([loadDashboard(), refetch()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create custom event");
    } finally {
      setCreatingEvent(false);
    }
  };

  const uploadCustomEventImage = async (file: File) => {
    setCreatingEvent(true);
    setError(null);
    try {
      const uploaded = await uploadVenueImage(file, "post");
      setCustomImageUrl(uploaded.url);
      setCustomImageS3Key(uploaded.key);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Custom event image upload failed");
    } finally {
      setCreatingEvent(false);
    }
  };

  const deleteCustomEvent = async (customEventId: string) => {
    setError(null);
    try {
      await api.delete(`/dashboard/custom-events/${customEventId}`);
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove custom event");
    }
  };

  const updateBookingStatus = async (
    bookingId: string,
    status: "CONFIRMED" | "CANCELLED_BY_VENUE",
    currentStatus: string,
  ) => {
    if (updatingBooking) return;
    const isPending = currentStatus === "PENDING";
    const isConfirmed = currentStatus === "CONFIRMED";
    const isCancelled =
      currentStatus === "CANCELLED_BY_VENUE" ||
      currentStatus === "CANCELLED_BY_USER" ||
      currentStatus === "NO_SHOW";

    if (status === "CONFIRMED" && !isPending) return;
    if (status === "CANCELLED_BY_VENUE" && !(isPending || isConfirmed)) return;
    if (isCancelled) return;

    setUpdatingBooking(true);
    setBookingAction({ bookingId, action: status });
    setError(null);
    try {
      await api.put(`/dashboard/bookings/${bookingId}`, { status });
      await Promise.all([loadDashboard(), refetch()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update booking");
    } finally {
      setUpdatingBooking(false);
      setBookingAction(null);
    }
  };

  const createMenuCategory = async () => {
    if (!newCategoryName.trim()) return;

    setCreatingMenuCategory(true);
    setError(null);
    try {
      await api.post("/dashboard/menu/categories", {
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
      });
      setNewCategoryName("");
      setNewCategoryDescription("");
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create menu category");
    } finally {
      setCreatingMenuCategory(false);
    }
  };

  const createMenuItem = async () => {
    if (!newMenuItemCategoryId || !newMenuItemName.trim() || !newMenuItemPrice.trim()) return;

    setCreatingMenuItem(true);
    setError(null);
    try {
      await api.post("/dashboard/menu/items", {
        categoryId: newMenuItemCategoryId,
        name: newMenuItemName.trim(),
        description: newMenuItemDescription.trim() || undefined,
        price: Number(newMenuItemPrice),
      });
      setNewMenuItemName("");
      setNewMenuItemDescription("");
      setNewMenuItemPrice("");
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create menu item");
    } finally {
      setCreatingMenuItem(false);
    }
  };

  const onUploadCover = async (file: File) => {
    setUploadingCover(true);
    setError(null);
    try {
      const uploaded = await uploadVenueImage(file, "venue_cover");
      setCoverImageUrl(uploaded.url);
      setCoverImageS3Key(uploaded.key);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Cover upload failed");
    } finally {
      setUploadingCover(false);
    }
  };

  const onUploadGallery = async (files: File[]) => {
    const slots = MAX_GALLERY_IMAGES - galleryItems.length;
    if (slots <= 0) {
      setError(`Maximum ${MAX_GALLERY_IMAGES} gallery images allowed.`);
      return;
    }

    const selected = files.slice(0, slots);
    if (selected.length === 0) return;

    setUploadingGallery(true);
    setError(null);
    try {
      const uploaded: GalleryItem[] = [];
      for (const file of selected) {
        const result = await uploadVenueImage(file, "venue_gallery");
        uploaded.push(result);
      }
      setGalleryItems((prev) => [...prev, ...uploaded].slice(0, MAX_GALLERY_IMAGES));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gallery upload failed");
    } finally {
      setUploadingGallery(false);
    }
  };

  const saveVenueSettings = async () => {
    setSavingSettings(true);
    setError(null);
    try {
      await api.put("/dashboard/venue", {
        name: venueName.trim(),
        description: venueDescription.trim() || undefined,
        phone: venuePhone.trim() || undefined,
        coverImageUrl: coverImageUrl || undefined,
        coverImageS3Key: coverImageS3Key || undefined,
        galleryImageUrls: galleryItems.map((item) => item.url),
        galleryS3Keys: galleryItems.map((item) => item.key).filter(Boolean),
      });

      await Promise.all([loadDashboard(), refetch()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save venue settings");
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <ThemeProvider>
        <AppShell>
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-10 text-[var(--text-secondary)]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading venue dashboard...</span>
          </div>
        </AppShell>
      </ThemeProvider>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <ThemeProvider>
        <AppShell>
          <div className="mx-auto max-w-2xl px-4 py-12 text-center">
            <h1 className="font-display text-h1 text-[var(--text-primary)]">Login Required</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Sign in with a venue account to access the dashboard.
            </p>
            <Button asChild className="mt-4">
              <Link href="/login">Go to Login</Link>
            </Button>
          </div>
        </AppShell>
      </ThemeProvider>
    );
  }

  const isBusy =
    creatingEvent || updatingBooking || updatingPromotion || savingSettings || uploadingCover || uploadingGallery;

  return (
    <ThemeProvider>
      <AppShell>
        <main className="mx-auto w-full max-w-6xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-2">
                Venue Dashboard
              </Badge>
              <h1 className="font-display text-3xl text-[var(--text-primary)]">
                {overview?.venue?.name || "Venue"}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                {overview?.venue?.city || "City unavailable"}
              </p>
            </div>
            <Button variant="outline" onClick={() => void loadDashboard()} disabled={isBusy}>
              Refresh
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <CircleAlert className="mb-2 h-4 w-4" />
              <AlertTitle>Action blocked</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="bookings">Reservations</TabsTrigger>
              <TabsTrigger value="menu">Menu</TabsTrigger>
              <TabsTrigger value="settings">Venue Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total bookings</CardDescription>
                    <CardTitle>{overview?.stats.totalBookings || 0}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Last 30 days</CardDescription>
                    <CardTitle>{overview?.stats.recentBookings || 0}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Followers</CardDescription>
                    <CardTitle>{overview?.stats.followers || 0}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Average rating</CardDescription>
                    <CardTitle>{overview?.stats.averageRating || "0.00"}</CardTitle>
                  </CardHeader>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="events" className="pt-4 space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Event publishing</CardTitle>
                      <CardDescription>
                        Create a match event or a custom watch-party campaign.
                      </CardDescription>
                    </div>
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4" />
                      Create Event
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Match events</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {events.length ? (
                    events.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {event.match.homeTeamName} vs {event.match.awayTeamName}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {event.confirmedBookingsCount}
                              {event.bookingLimit ? ` / ${event.bookingLimit}` : ""} booked
                            </Badge>
                            {promotedEventId === event.id ? (
                              <Badge>
                                <Trophy className="h-3.5 w-3.5" />
                                Promoted
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                          {formatDateTime(event.match.matchDateUtc)}
                          {event.match.stage ? ` · ${event.match.stage}` : ""}
                        </p>
                        {event.specialNotes ? (
                          <p className="mt-2 text-xs text-[var(--text-secondary)]">{event.specialNotes}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            variant={promotedEventId === event.id ? "default" : "outline"}
                            disabled={updatingPromotion}
                            onClick={() =>
                              void updateVenuePromotion(promotedEventId === event.id ? null : event.id)
                            }
                          >
                            <Trophy className="h-4 w-4" />
                            {promotedEventId === event.id ? "Use Closest Instead" : "Promote on Venue Page"}
                          </Button>
                          {promotedEventId === event.id ? (
                            <span className="text-xs text-[var(--text-secondary)]">
                              This match is pinned as your venue banner.
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">No match events created yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custom events</CardTitle>
                  <CardDescription>
                    Visible on your venue page and automatically removed after end time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {customEvents.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">No custom events yet.</p>
                  ) : (
                    customEvents.map((event) => (
                      <div key={event.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{event.title}</p>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => void deleteCustomEvent(event.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {formatDateTime(event.startsAt)} - {formatDateTime(event.endsAt)}
                        </p>
                        {event.description ? (
                          <p className="mt-2 text-xs text-[var(--text-secondary)]">{event.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {event.eventTypeTags.map((tag) => (
                            <span key={tag} className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bookings" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Event reservations</CardTitle>
                  <CardDescription>
                    Click an event to view guest reservations and contact email. Capacity progress is shown for each event.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {bookingsByEvent.length ? (
                    bookingsByEvent.map((event) => {
                      const expanded = expandedEventId === event.id;
                      const occupancy = event.occupancyPercent ?? 0;
                      return (
                        <div key={event.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => setExpandedEventId(expanded ? null : event.id)}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-[var(--text-primary)]">
                                {event.match.homeTeamName} vs {event.match.awayTeamName}
                              </p>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{event.bookings.length} reservations</Badge>
                                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </div>
                            </div>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              <Clock4 className="mr-1 inline h-3.5 w-3.5" />
                              {formatDateTime(event.match.matchDateUtc)}
                            </p>

                            <div className="mt-3">
                              <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                                <span>
                                  Capacity {event.confirmedBookingsCount}
                                  {event.bookingLimit ? ` / ${event.bookingLimit}` : ""}
                                </span>
                                <span>
                                  {event.bookingLimit
                                    ? `${Math.max(event.spotsRemaining || 0, 0)} spots left`
                                    : "No limit"}
                                </span>
                              </div>
                              {event.bookingLimit ? (
                                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-card)]">
                                  <div
                                    className="h-full bg-[var(--accent-primary)] transition-all"
                                    style={{ width: `${Math.min(Math.max(occupancy, 0), 100)}%` }}
                                  />
                                </div>
                              ) : (
                                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-card)]">
                                  <div className="h-full w-[35%] bg-[var(--accent-secondary)]" />
                                </div>
                              )}
                            </div>
                          </button>

                          {expanded && (
                            <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
                              {event.bookings.length === 0 ? (
                                <p className="text-xs text-[var(--text-secondary)]">No reservations yet for this event.</p>
                              ) : (
                                event.bookings.map((booking) => (
                                  (() => {
                                    const isPending = booking.status === "PENDING";
                                    const isConfirmed = booking.status === "CONFIRMED";
                                    const isCancelled =
                                      booking.status === "CANCELLED_BY_VENUE" ||
                                      booking.status === "CANCELLED_BY_USER" ||
                                      booking.status === "NO_SHOW";
                                    const canConfirm = isPending;
                                    const canCancel = isPending || isConfirmed;
                                    const isConfirming =
                                      updatingBooking &&
                                      bookingAction?.bookingId === booking.id &&
                                      bookingAction?.action === "CONFIRMED";
                                    const isCancelling =
                                      updatingBooking &&
                                      bookingAction?.bookingId === booking.id &&
                                      bookingAction?.action === "CANCELLED_BY_VENUE";

                                    return (
                                      <div key={booking.id} className="rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div>
                                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                                              {booking.user.name}
                                            </p>
                                            <p className="text-xs text-[var(--text-secondary)]">
                                              Contact: {booking.user.email}
                                            </p>
                                          </div>
                                          <Badge variant="secondary">{booking.status}</Badge>
                                        </div>
                                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                          Ref {booking.bookingReference} · Party size {booking.partySize} · {formatDateTime(booking.createdAt)}
                                        </p>
                                        {booking.specialRequests ? (
                                          <p className="mt-1 text-xs text-[var(--text-secondary)]">{booking.specialRequests}</p>
                                        ) : null}
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          <Button
                                            variant="outline"
                                            disabled={updatingBooking || !canConfirm}
                                            onClick={() =>
                                              void updateBookingStatus(booking.id, "CONFIRMED", booking.status)
                                            }
                                          >
                                            {isConfirming ? (
                                              <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Confirming
                                              </>
                                            ) : isConfirmed ? (
                                              "Confirmed"
                                            ) : (
                                              "Confirm"
                                            )}
                                          </Button>
                                          <Button
                                            variant="destructive"
                                            disabled={updatingBooking || !canCancel || isCancelled}
                                            onClick={() =>
                                              void updateBookingStatus(booking.id, "CANCELLED_BY_VENUE", booking.status)
                                            }
                                          >
                                            {isCancelling ? (
                                              <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Cancelling
                                              </>
                                            ) : isCancelled ? (
                                              "Cancelled"
                                            ) : (
                                              "Cancel"
                                            )}
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })()
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">No events with bookings yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="menu" className="pt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Menu categories</CardTitle>
                  <CardDescription>Create sections like Appetizers, Main Course, Drinks, and Desserts.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="menu-category-name">Category name</Label>
                      <Input
                        id="menu-category-name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="e.g. Matchday Platters"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="menu-category-desc">Description (optional)</Label>
                      <Input
                        id="menu-category-desc"
                        value={newCategoryDescription}
                        onChange={(e) => setNewCategoryDescription(e.target.value)}
                        placeholder="Shared plates for large groups"
                      />
                    </div>
                  </div>
                  <Button onClick={() => void createMenuCategory()} disabled={creatingMenuCategory || !newCategoryName.trim()}>
                    {creatingMenuCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add Category
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Menu items</CardTitle>
                  <CardDescription>Add food and drink items to categories.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="menu-item-cat">Category</Label>
                      <select
                        id="menu-item-cat"
                        value={newMenuItemCategoryId}
                        onChange={(e) => setNewMenuItemCategoryId(e.target.value)}
                        className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
                      >
                        {menu.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="menu-item-name">Item name</Label>
                      <Input
                        id="menu-item-name"
                        value={newMenuItemName}
                        onChange={(e) => setNewMenuItemName(e.target.value)}
                        placeholder="Loaded Nachos"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="menu-item-price">Price</Label>
                      <Input
                        id="menu-item-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={newMenuItemPrice}
                        onChange={(e) => setNewMenuItemPrice(e.target.value)}
                        placeholder="14.99"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="menu-item-desc">Description (optional)</Label>
                      <Input
                        id="menu-item-desc"
                        value={newMenuItemDescription}
                        onChange={(e) => setNewMenuItemDescription(e.target.value)}
                        placeholder="Feeds 2-3 guests"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => void createMenuItem()}
                    disabled={creatingMenuItem || !newMenuItemName.trim() || !newMenuItemPrice.trim() || !newMenuItemCategoryId}
                  >
                    {creatingMenuItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add Menu Item
                  </Button>

                  <div className="space-y-3">
                    {menu.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">No menu categories yet.</p>
                    ) : (
                      menu.map((category) => (
                        <div key={category.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{category.name}</h3>
                          {category.description ? (
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">{category.description}</p>
                          ) : null}
                          <div className="mt-3 space-y-2">
                            {category.items.length === 0 ? (
                              <p className="text-xs text-[var(--text-secondary)]">No items yet.</p>
                            ) : (
                              category.items.map((item) => (
                                <div key={item.id} className="rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-[var(--text-primary)]">{item.name}</p>
                                    <Badge variant="secondary">${Number(item.price).toFixed(2)}</Badge>
                                  </div>
                                  {item.description ? (
                                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.description}</p>
                                  ) : null}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Venue profile</CardTitle>
                  <CardDescription>
                    Update your public venue info and media shown on listing and venue pages.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="venue-name">Venue name</Label>
                      <Input
                        id="venue-name"
                        value={venueName}
                        onChange={(e) => setVenueName(e.target.value)}
                        placeholder="Venue name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="venue-phone">Phone</Label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                        <Input
                          id="venue-phone"
                          className="pl-9"
                          value={venuePhone}
                          onChange={(e) => setVenuePhone(e.target.value)}
                          placeholder="+1 000 000 0000"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="venue-description">Description</Label>
                    <Textarea
                      id="venue-description"
                      value={venueDescription}
                      onChange={(e) => setVenueDescription(e.target.value)}
                      placeholder="Describe your venue atmosphere, food, and watch-party setup."
                    />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Cover image</Label>
                        <div className="flex gap-2">
                          {coverImageUrl ? (
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => {
                                setCoverImageUrl("");
                                setCoverImageS3Key("");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploadingCover}
                            onClick={() => coverInputRef.current?.click()}
                          >
                            {uploadingCover ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Uploading
                              </>
                            ) : (
                              <>
                                <Camera className="h-4 w-4" />
                                Upload Cover
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void onUploadCover(file);
                          e.currentTarget.value = "";
                        }}
                      />
                      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]">
                        {coverImageUrl ? (
                          <img
                            src={coverImageUrl}
                            alt="Venue cover"
                            className="h-48 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-48 items-center justify-center text-sm text-[var(--text-muted)]">
                            No cover image uploaded
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Gallery images ({galleryItems.length}/{MAX_GALLERY_IMAGES})</Label>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={uploadingGallery || galleryItems.length >= MAX_GALLERY_IMAGES}
                          onClick={() => galleryInputRef.current?.click()}
                        >
                          {uploadingGallery ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Uploading
                            </>
                          ) : (
                            <>
                              <ImagePlus className="h-4 w-4" />
                              Add Images
                            </>
                          )}
                        </Button>
                      </div>
                      <input
                        ref={galleryInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length) void onUploadGallery(files);
                          e.currentTarget.value = "";
                        }}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        {galleryItems.map((item, idx) => (
                          <div
                            key={`${item.url}-${idx}`}
                            className="group relative overflow-hidden rounded-lg border border-[var(--border)]"
                          >
                            <img
                              src={item.url}
                              alt={`Gallery ${idx + 1}`}
                              className="h-24 w-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-start justify-end p-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setGalleryItems((prev) =>
                                    prev.filter((_, imageIndex) => imageIndex !== idx),
                                  );
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {Array.from({
                          length: Math.max(0, MAX_GALLERY_IMAGES - galleryItems.length),
                        }).map((_, idx) => (
                          <div
                            key={`empty-${idx}`}
                            className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)]"
                          >
                            Empty slot
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => void saveVenueSettings()} disabled={savingSettings}>
                      {savingSettings ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Venue Settings
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Event Wizard</p>
                  <h2 className="font-display text-2xl text-[var(--text-primary)]">Create Venue Event</h2>
                </div>
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Close</Button>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2">
                <Button variant={createMode === "match" ? "default" : "outline"} onClick={() => setCreateMode("match")}>
                  <Ticket className="h-4 w-4" />
                  Match Event
                </Button>
                <Button variant={createMode === "custom" ? "default" : "outline"} onClick={() => setCreateMode("custom")}>
                  <Sparkles className="h-4 w-4" />
                  Custom Event
                </Button>
              </div>

              {createMode === "match" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="match-picker-trigger">1. Which match are you hosting?</Label>
                    {selectedNewEventMatch ? (
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {selectedNewEventMatch.homeTeamName} vs {selectedNewEventMatch.awayTeamName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {formatDateTime(selectedNewEventMatch.matchDateUtc)} · {getLeagueLabel(selectedNewEventMatch)}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)]">
                        No upcoming matches available to publish yet.
                      </div>
                    )}
                    <Button
                      id="match-picker-trigger"
                      type="button"
                      variant="outline"
                      onClick={() => setShowMatchPicker(true)}
                      disabled={upcomingMatches.length === 0}
                    >
                      <Ticket className="h-4 w-4" />
                      Browse Upcoming Matches by League
                    </Button>
                    {availableMatches.length === 0 && upcomingMatches.length > 0 ? (
                      <p className="text-xs text-[var(--text-secondary)]">
                        You already host events for all currently upcoming matches.
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="booking-limit">2. Capacity limit (optional)</Label>
                      <Input
                        id="booking-limit"
                        type="number"
                        min={1}
                        value={newEventLimit}
                        onChange={(e) => setNewEventLimit(e.target.value)}
                        placeholder="Example: 120"
                      />
                    </div>
                    <div className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
                      <Checkbox
                        checked={newEventRequiresApproval}
                        onCheckedChange={(checked) => setNewEventRequiresApproval(checked === true)}
                      />
                      <Label className="cursor-pointer">Require booking approval</Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-notes">3. Special notes for guests</Label>
                    <Textarea
                      id="event-notes"
                      value={newEventNotes}
                      onChange={(e) => setNewEventNotes(e.target.value)}
                      placeholder="Doors open early, valet policy, table minimum, etc."
                    />
                  </div>

                  <Button onClick={() => void createMatchEvent()} disabled={creatingEvent || !newEventMatchId}>
                    {creatingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Publish Match Event
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="custom-title">1. Event title</Label>
                      <Input
                        id="custom-title"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="Saturday Fight Night"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>2. Cover image (optional)</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => customImageInputRef.current?.click()}>
                          <ImagePlus className="h-4 w-4" />
                          Upload
                        </Button>
                        {customImageUrl ? <span className="text-xs text-[var(--text-secondary)]">Image ready</span> : null}
                      </div>
                      <input
                        ref={customImageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadCustomEventImage(file);
                          e.currentTarget.value = "";
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom-description">3. What is happening at this event?</Label>
                    <Textarea
                      id="custom-description"
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      placeholder="Describe the vibe, offers, music, and what guests should expect."
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="custom-start">4. Start time</Label>
                      <Input
                        id="custom-start"
                        type="datetime-local"
                        value={customStartsAt}
                        onChange={(e) => setCustomStartsAt(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-end">5. End time</Label>
                      <Input
                        id="custom-end"
                        type="datetime-local"
                        value={customEndsAt}
                        onChange={(e) => setCustomEndsAt(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>6. Event type tags</Label>
                    <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                      {EVENT_WATCH_PARTY_TYPES.map((tag) => {
                        const selected = customTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              setCustomTags((prev) =>
                                selected ? prev.filter((value) => value !== tag) : [...prev, tag],
                              );
                            }}
                            className={`rounded-full border px-3 py-1 text-xs ${
                              selected
                                ? "border-[var(--accent-primary)] bg-[var(--accent-primary-dim)] text-[var(--accent-primary)]"
                                : "border-[var(--border)] text-[var(--text-secondary)]"
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom-booking-notes">7. Booking notes for guests</Label>
                    <Textarea
                      id="custom-booking-notes"
                      value={customBookingNotes}
                      onChange={(e) => setCustomBookingNotes(e.target.value)}
                      placeholder="How to reserve, expected arrival window, minimum spend, etc."
                    />
                  </div>

                  <Button onClick={() => void createCustomEvent()} disabled={creatingEvent}>
                    {creatingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Publish Custom Event
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {showCreateModal && createMode === "match" && showMatchPicker && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
            <div className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Upcoming Matches</p>
                  <h3 className="font-display text-xl text-[var(--text-primary)]">Choose Match to Publish</h3>
                </div>
                <Button variant="outline" onClick={() => setShowMatchPicker(false)}>
                  Close
                </Button>
              </div>

              <div className="mb-3 grid gap-3 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="picker-league">League</Label>
                  <select
                    id="picker-league"
                    value={matchPickerLeague}
                    onChange={(e) => setMatchPickerLeague(e.target.value)}
                    className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
                  >
                    <option value="all">All leagues</option>
                    {matchPickerLeagueOptions.map((league) => (
                      <option key={league.id} value={league.id}>
                        {league.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="picker-search">Search match</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                    <Input
                      id="picker-search"
                      value={matchPickerSearch}
                      onChange={(e) => setMatchPickerSearch(e.target.value)}
                      placeholder="Team or league"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                {matchPickerGroupedRows.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No matches found for this filter.</p>
                ) : (
                  matchPickerGroupedRows.map((group) => (
                    <section key={group.leagueId} className="space-y-2">
                      <div className="sticky top-0 z-10 rounded-md bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                        {group.leagueLabel}
                      </div>
                      <div className="space-y-2">
                        {group.matches.map((match) => {
                          const alreadyHosted = events.some((event) => event.matchId === match.id);
                          const isSelected = newEventMatchId === match.id;
                          return (
                            <div
                              key={match.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                  {match.homeTeamName} vs {match.awayTeamName}
                                </p>
                                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                  {formatDateTime(match.matchDateUtc)}
                                </p>
                              </div>
                              {alreadyHosted ? (
                                <Badge variant="secondary">Already hosted</Badge>
                              ) : (
                                <Button
                                  type="button"
                                  variant={isSelected ? "default" : "outline"}
                                  onClick={() => {
                                    setNewEventMatchId(match.id);
                                    setShowMatchPicker(false);
                                  }}
                                >
                                  {isSelected ? <Check className="h-4 w-4" /> : <Ticket className="h-4 w-4" />}
                                  {isSelected ? "Selected" : "Select"}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </ThemeProvider>
  );
}
