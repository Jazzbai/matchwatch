"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { AppShell } from "../../components/AppShell";
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

type OwnedVenue = {
  id: string;
  name: string;
  slug: string;
  city: string;
  country: string;
  isVerified: boolean;
  isFeatured: boolean;
  createdAt: string;
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
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const { refetch } = useData();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [ownedVenues, setOwnedVenues] = React.useState<OwnedVenue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = React.useState("");
  const [showCreateVenueForm, setShowCreateVenueForm] = React.useState(false);

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
  const [deletingVenue, setDeletingVenue] = React.useState(false);
  const [creatingMenuCategory, setCreatingMenuCategory] = React.useState(false);
  const [creatingMenuItem, setCreatingMenuItem] = React.useState(false);
  const [creatingVenue, setCreatingVenue] = React.useState(false);

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
  const [deleteVenueEmailConfirm, setDeleteVenueEmailConfirm] = React.useState("");
  const [newOwnedVenue, setNewOwnedVenue] = React.useState({
    name: "",
    addressLine1: "",
    city: "Houston",
    country: "US",
    lat: "29.7604",
    lng: "-95.3698",
    timezone: "America/Chicago",
    phone: "",
    description: "",
  });

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

  const dashboardPath = React.useCallback((path: string, venueIdOverride?: string) => {
    const venueId = venueIdOverride || selectedVenueId;
    if (!venueId) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}venueId=${encodeURIComponent(venueId)}`;
  }, [selectedVenueId]);

  const loadOwnedVenues = React.useCallback(async () => {
    const response = await api.get<OwnedVenue[]>("/dashboard/venues");
    const rows = response.data || [];
    setOwnedVenues(rows);

    setSelectedVenueId((prev) => {
      if (prev && rows.some((venue) => venue.id === prev)) {
        return prev;
      }
      return rows[0]?.id || "";
    });

    return rows;
  }, []);

  const loadDashboard = React.useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const venueRows = await loadOwnedVenues();
      const effectiveVenueId = selectedVenueId && venueRows.some((venue) => venue.id === selectedVenueId)
        ? selectedVenueId
        : (venueRows[0]?.id || "");

      if (effectiveVenueId && effectiveVenueId !== selectedVenueId) {
        setSelectedVenueId(effectiveVenueId);
      }

      if (!effectiveVenueId) {
        setOverview(null);
        setEvents([]);
        setBookingsByEvent([]);
        setCustomEvents([]);
        setMenu([]);
        setUpcomingMatches([]);
        setPromotedEventId(null);
        setVenueName("");
        setVenueDescription("");
        setVenuePhone("");
        setCoverImageUrl("");
        setCoverImageS3Key("");
        setGalleryItems([]);
        setLoading(false);
        return;
      }

      const [
        overviewRes,
        eventsRes,
        bookingsByEventRes,
        venueRes,
        upcomingMatchesRes,
        customEventsRes,
        menuRes,
      ] = await Promise.all([
        api.get<DashboardOverview>(dashboardPath("/dashboard", effectiveVenueId)),
        api.get<OwnerEvent[]>(dashboardPath("/dashboard/events", effectiveVenueId)),
        api.get<GroupedBookingEvent[]>(dashboardPath("/dashboard/bookings/events", effectiveVenueId)),
        api.get<VenueProfile>(dashboardPath("/dashboard/venue", effectiveVenueId)),
        api.get<Record<string, UpcomingMatch[]>>("/matches/upcoming"),
        api.get<CustomEvent[]>(dashboardPath("/dashboard/custom-events", effectiveVenueId)),
        api.get<MenuCategory[]>(dashboardPath("/dashboard/menu", effectiveVenueId)),
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
  }, [dashboardPath, isAuthenticated, loadOwnedVenues, selectedVenueId]);

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
    if (!selectedVenueId) {
      setError("Select a business venue first.");
      return;
    }

    setCreatingEvent(true);
    setError(null);
    try {
      await api.post(dashboardPath("/dashboard/events"), {
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
    if (!selectedVenueId) {
      setError("Select a business venue first.");
      return;
    }

    setUpdatingPromotion(true);
    setError(null);
    try {
      await api.put<{ promotedVenueEventId: string | null }>(dashboardPath("/dashboard/venue/promotion"), {
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
    if (!selectedVenueId) {
      setError("Select a business venue first.");
      return;
    }

    if (!customTitle.trim() || !customStartsAt || !customEndsAt || customTags.length === 0) {
      setError("Fill title, start/end time, and at least one event type.");
      return;
    }

    setCreatingEvent(true);
    setError(null);
    try {
      await api.post(dashboardPath("/dashboard/custom-events"), {
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
    if (!selectedVenueId) {
      setError("Select a business venue first.");
      return;
    }

    setError(null);
    try {
      await api.delete(dashboardPath(`/dashboard/custom-events/${customEventId}`));
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
    if (!selectedVenueId) {
      setError("Select a business venue first.");
      return;
    }

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
      await api.put(dashboardPath(`/dashboard/bookings/${bookingId}`), { status });
      await Promise.all([loadDashboard(), refetch()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update booking");
    } finally {
      setUpdatingBooking(false);
      setBookingAction(null);
    }
  };

  const createMenuCategory = async () => {
    if (!selectedVenueId) {
      setError("Select a business venue first.");
      return;
    }
    if (!newCategoryName.trim()) return;

    setCreatingMenuCategory(true);
    setError(null);
    try {
      await api.post(dashboardPath("/dashboard/menu/categories"), {
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
    if (!selectedVenueId) {
      setError("Select a business venue first.");
      return;
    }
    if (!newMenuItemCategoryId || !newMenuItemName.trim() || !newMenuItemPrice.trim()) return;

    setCreatingMenuItem(true);
    setError(null);
    try {
      await api.post(dashboardPath("/dashboard/menu/items"), {
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
    if (!selectedVenueId) {
      setError("Select a business venue first.");
      return;
    }

    setSavingSettings(true);
    setError(null);
    try {
      await api.put(dashboardPath("/dashboard/venue"), {
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

  const deleteOwnedVenue = async () => {
    if (!selectedVenueId) {
      setError("Select a business venue first.");
      return;
    }

    const accountEmail = (user?.email || "").trim().toLowerCase();
    const typedEmail = deleteVenueEmailConfirm.trim().toLowerCase();
    if (!accountEmail || typedEmail !== accountEmail) {
      setError("To delete this venue, retype your exact account email.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this venue? This will remove it from public pages and disable all active events.",
    );
    if (!confirmed) return;

    setDeletingVenue(true);
    setError(null);
    try {
      const response = await api.delete<{ message: string; remainingVenues: number; demotedToUser: boolean }>(`/dashboard/venues/${selectedVenueId}`);
      const remainingVenues = Number(response.data?.remainingVenues || 0);

      setDeleteVenueEmailConfirm("");
      await loadOwnedVenues();

      if (remainingVenues === 0) {
        await logout();
        router.replace("/for-venues");
        return;
      }

      await Promise.all([loadDashboard(), refetch()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete venue");
    } finally {
      setDeletingVenue(false);
    }
  };

  const createOwnedVenue = async () => {
    if (!newOwnedVenue.name.trim() || !newOwnedVenue.addressLine1.trim() || !newOwnedVenue.city.trim() || !newOwnedVenue.country.trim()) {
      setError("Name, address, city, and country are required to create a venue.");
      return;
    }

    const lat = Number(newOwnedVenue.lat);
    const lng = Number(newOwnedVenue.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Latitude and longitude must be valid numbers.");
      return;
    }

    setCreatingVenue(true);
    setError(null);
    try {
      const response = await api.post<{ id: string; name: string; slug: string; city: string; country: string }>("/dashboard/venues", {
        name: newOwnedVenue.name.trim(),
        addressLine1: newOwnedVenue.addressLine1.trim(),
        city: newOwnedVenue.city.trim(),
        country: newOwnedVenue.country.trim(),
        lat,
        lng,
        timezone: newOwnedVenue.timezone.trim() || "America/Chicago",
        phone: newOwnedVenue.phone.trim() || undefined,
        description: newOwnedVenue.description.trim() || undefined,
      });

      setShowCreateVenueForm(false);
      setNewOwnedVenue({
        name: "",
        addressLine1: "",
        city: "Houston",
        country: "US",
        lat: "29.7604",
        lng: "-95.3698",
        timezone: "America/Chicago",
        phone: "",
        description: "",
      });

      await loadOwnedVenues();
      if (response.data?.id) {
        setSelectedVenueId(response.data.id);
      }
      await Promise.all([loadDashboard(), refetch()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create venue");
    } finally {
      setCreatingVenue(false);
    }
  };

  if (loading) {
    return (
        <AppShell>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, padding: "40px 24px", color: "var(--muted-foreground)" }}>
            <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
            <span>Loading business dashboard...</span>
          </div>
        </AppShell>
    );
  }

  if (!isAuthenticated || !user) {
    return (
        <AppShell>
          <div style={{ maxWidth: 540, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
            <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 28, fontWeight: 900, color: "var(--foreground)", marginBottom: 8 }}>Login Required</h1>
            <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 24 }}>
              Sign in with a business account to access the dashboard.
            </p>
            <Link href="/login" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 10, backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Go to Login</Link>
          </div>
        </AppShell>
    );
  }

  const isBusy =
    creatingEvent || updatingBooking || updatingPromotion || savingSettings || uploadingCover || uploadingGallery || deletingVenue || creatingVenue;

  /* ── Inline style helpers ── */
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)",
    backgroundColor: "var(--secondary)", color: "var(--foreground)", fontSize: 14,
    fontFamily: "inherit", outline: "none",
  };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 };
  const cardStyle: React.CSSProperties = { backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" };
  const cardHeaderStyle: React.CSSProperties = { padding: "20px 24px", borderBottom: "1px solid var(--border)" };
  const cardContentStyle: React.CSSProperties = { padding: 24 };
  const btnPrimary = (disabled?: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10,
    backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700,
    fontSize: 13, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
    opacity: disabled ? 0.5 : 1, transition: "all 0.2s",
  });
  const btnOutline = (disabled?: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10,
    backgroundColor: "transparent", color: "var(--foreground)", fontWeight: 700,
    fontSize: 13, border: "1px solid var(--border)", cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", opacity: disabled ? 0.5 : 1, transition: "all 0.2s",
  });
  const btnDestructive = (disabled?: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700,
    fontSize: 13, border: "1px solid rgba(239,68,68,0.2)", cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", opacity: disabled ? 0.5 : 1, transition: "all 0.2s",
  });
  const badgeStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 99,
    fontSize: 11, fontWeight: 700, backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)",
    border: "1px solid var(--border)",
  };
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10,
    fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer", border: "none", fontFamily: "inherit",
    transition: "all 0.2s",
    backgroundColor: active ? "var(--background)" : "transparent",
    color: active ? "var(--foreground)" : "var(--muted-foreground)",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
    outline: active ? "1px solid var(--border)" : "none",
  });
  const eventRowStyle: React.CSSProperties = {
    padding: 16, borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", marginBottom: 12,
  };

  const TABS_LIST = [
    { id: "overview", label: "Overview" },
    { id: "events", label: "Events" },
    { id: "bookings", label: "Reservations" },
    { id: "menu", label: "Menu" },
    { id: "settings", label: "Venue Settings" },
  ];

  return (
      <AppShell>
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", width: "100%" }}>
          {/* Header */}
          <div style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 8, backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Business Dashboard
              </div>
              <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 28, fontWeight: 900, color: "var(--foreground)", margin: 0 }}>
                {overview?.venue?.name || "Venue"}
              </h1>
              <p style={{ marginTop: 4, fontSize: 13, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin style={{ width: 14, height: 14 }} />
                {overview?.venue?.city || "City unavailable"}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, minWidth: 280 }}>
              <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "flex-end" }}>
                <select
                  value={selectedVenueId}
                  onChange={(event) => setSelectedVenueId(event.target.value)}
                  style={{ ...inputStyle, maxWidth: 320 }}
                >
                  {ownedVenues.length === 0 && <option value="">No venues yet</option>}
                  {ownedVenues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} ({venue.city})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCreateVenueForm((prev) => !prev)}
                  style={btnOutline(isBusy)}
                  disabled={isBusy}
                >
                  <Plus size={14} />
                  {showCreateVenueForm ? "Close" : "New Venue"}
                </button>
                <button onClick={() => void loadDashboard()} disabled={isBusy} style={btnOutline(isBusy)}>
                  Refresh
                </button>
              </div>
              {showCreateVenueForm && (
                <div style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--card)", padding: 12, display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input
                      value={newOwnedVenue.name}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Venue name"
                      style={inputStyle}
                    />
                    <input
                      value={newOwnedVenue.addressLine1}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, addressLine1: event.target.value }))}
                      placeholder="Street address"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 120px", gap: 8 }}>
                    <input
                      value={newOwnedVenue.city}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, city: event.target.value }))}
                      placeholder="City"
                      style={inputStyle}
                    />
                    <input
                      value={newOwnedVenue.country}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, country: event.target.value }))}
                      placeholder="Country"
                      style={inputStyle}
                    />
                    <input
                      value={newOwnedVenue.lat}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, lat: event.target.value }))}
                      placeholder="Lat"
                      style={inputStyle}
                    />
                    <input
                      value={newOwnedVenue.lng}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, lng: event.target.value }))}
                      placeholder="Lng"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
                    <input
                      value={newOwnedVenue.timezone}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, timezone: event.target.value }))}
                      placeholder="Timezone"
                      style={inputStyle}
                    />
                    <input
                      value={newOwnedVenue.phone}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, phone: event.target.value }))}
                      placeholder="Phone (optional)"
                      style={inputStyle}
                    />
                    <input
                      value={newOwnedVenue.description}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Short description (optional)"
                      style={inputStyle}
                    />
                    <button
                      onClick={() => void createOwnedVenue()}
                      disabled={creatingVenue}
                      style={btnPrimary(creatingVenue)}
                    >
                      {creatingVenue ? "Creating..." : "Create"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <CircleAlert style={{ width: 16, height: 16, color: "#ef4444", marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#ef4444", marginBottom: 2 }}>Action blocked</div>
                <div style={{ fontSize: 13, color: "#ef4444" }}>{error}</div>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div style={{ display: "inline-flex", padding: 4, backgroundColor: "var(--secondary)", borderRadius: 12, border: "1px solid var(--border)", maxWidth: "100%", overflowX: "auto", marginBottom: 24 }}>
            {TABS_LIST.map((t) => (
              <button key={t.id} style={tabBtnStyle(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ═══ TAB: Overview ═══ */}
          {activeTab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {[
                { label: "Total bookings", value: overview?.stats.totalBookings || 0 },
                { label: "Last 30 days", value: overview?.stats.recentBookings || 0 },
                { label: "Followers", value: overview?.stats.followers || 0 },
                { label: "Average rating", value: overview?.stats.averageRating || "0.00" },
              ].map((stat) => (
                <div key={stat.label} style={{ ...cardStyle, padding: 20 }}>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>{stat.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "var(--font-display), sans-serif", color: "var(--foreground)" }}>{stat.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ TAB: Events ═══ */}
          {activeTab === "events" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Create event card */}
              <div style={cardStyle}>
                <div style={{ ...cardHeaderStyle, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Event publishing</h3>
                    <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Create a match event or a custom watch-party campaign.</p>
                  </div>
                  <button style={btnPrimary()} onClick={() => setShowCreateModal(true)}>
                    <Plus size={16} /> Create Event
                  </button>
                </div>
              </div>

              {/* Match events */}
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>Match events</h3>
                </div>
                <div style={cardContentStyle}>
                  {events.length ? events.map((event) => (
                    <div key={event.id} style={eventRowStyle}>
                      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                          {event.match.homeTeamName} vs {event.match.awayTeamName}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={badgeStyle}>
                            {event.confirmedBookingsCount}{event.bookingLimit ? ` / ${event.bookingLimit}` : ""} booked
                          </span>
                          {promotedEventId === event.id && (
                            <span style={{ ...badgeStyle, backgroundColor: "color-mix(in oklch, var(--primary) 10%, transparent)", color: "var(--primary)", border: "1px solid color-mix(in oklch, var(--primary) 20%, transparent)" }}>
                              <Trophy size={12} /> Promoted
                            </span>
                          )}
                        </div>
                      </div>
                      <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
                        <CalendarDays size={14} />
                        {formatDateTime(event.match.matchDateUtc)}
                        {event.match.stage ? ` · ${event.match.stage}` : ""}
                      </p>
                      {event.specialNotes && <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)" }}>{event.specialNotes}</p>}
                      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <button
                          style={promotedEventId === event.id ? btnPrimary(updatingPromotion) : btnOutline(updatingPromotion)}
                          disabled={updatingPromotion}
                          onClick={() => void updateVenuePromotion(promotedEventId === event.id ? null : event.id)}
                        >
                          <Trophy size={14} />
                          {promotedEventId === event.id ? "Use Closest Instead" : "Promote on Venue Page"}
                        </button>
                        {promotedEventId === event.id && (
                          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>This match is pinned as your venue banner.</span>
                        )}
                      </div>
                    </div>
                  )) : (
                    <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No match events created yet.</p>
                  )}
                </div>
              </div>

              {/* Custom events */}
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Custom events</h3>
                  <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Visible on your venue page and automatically removed after end time.</p>
                </div>
                <div style={cardContentStyle}>
                  {customEvents.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No custom events yet.</p>
                  ) : customEvents.map((event) => (
                    <div key={event.id} style={eventRowStyle}>
                      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{event.title}</span>
                        <button style={btnDestructive()} onClick={() => void deleteCustomEvent(event.id)}>
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                      <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>
                        {formatDateTime(event.startsAt)} - {formatDateTime(event.endsAt)}
                      </p>
                      {event.description && <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)" }}>{event.description}</p>}
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {event.eventTypeTags.map((tag) => (
                          <span key={tag} style={{ padding: "4px 10px", borderRadius: 99, border: "1px solid var(--border)", fontSize: 11, color: "var(--muted-foreground)" }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: Reservations ═══ */}
          {activeTab === "bookings" && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Event reservations</h3>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Click an event to view guest reservations and contact email. Capacity progress is shown for each event.</p>
              </div>
              <div style={cardContentStyle}>
                {bookingsByEvent.length ? bookingsByEvent.map((event) => {
                  const expanded = expandedEventId === event.id;
                  const occupancy = event.occupancyPercent ?? 0;
                  return (
                    <div key={event.id} style={eventRowStyle}>
                      <button type="button" style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "inherit" }} onClick={() => setExpandedEventId(expanded ? null : event.id)}>
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                            {event.match.homeTeamName} vs {event.match.awayTeamName}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={badgeStyle}>{event.bookings.length} reservations</span>
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                        <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock4 size={14} /> {formatDateTime(event.match.matchDateUtc)}
                        </p>
                        <div style={{ marginTop: 12 }}>
                          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted-foreground)" }}>
                            <span>Capacity {event.confirmedBookingsCount}{event.bookingLimit ? ` / ${event.bookingLimit}` : ""}</span>
                            <span>{event.bookingLimit ? `${Math.max(event.spotsRemaining || 0, 0)} spots left` : "No limit"}</span>
                          </div>
                          <div style={{ height: 8, width: "100%", borderRadius: 99, backgroundColor: "var(--card)", overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 99, backgroundColor: "var(--primary)", transition: "width 0.3s", width: `${event.bookingLimit ? Math.min(Math.max(occupancy, 0), 100) : 35}%` }} />
                          </div>
                        </div>
                      </button>

                      {expanded && (
                        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                          {event.bookings.length === 0 ? (
                            <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No reservations yet for this event.</p>
                          ) : event.bookings.map((booking) => {
                            const isPending = booking.status === "PENDING";
                            const isConfirmed = booking.status === "CONFIRMED";
                            const isCancelled = booking.status === "CANCELLED_BY_VENUE" || booking.status === "CANCELLED_BY_USER" || booking.status === "NO_SHOW";
                            const canConfirm = isPending;
                            const canCancel = isPending || isConfirmed;
                            const isConfirming = updatingBooking && bookingAction?.bookingId === booking.id && bookingAction?.action === "CONFIRMED";
                            const isCancelling = updatingBooking && bookingAction?.bookingId === booking.id && bookingAction?.action === "CANCELLED_BY_VENUE";

                            return (
                              <div key={booking.id} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--card)", marginBottom: 8 }}>
                                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                  <div>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{booking.user.name}</p>
                                    <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Contact: {booking.user.email}</p>
                                  </div>
                                  <span style={badgeStyle}>{booking.status}</span>
                                </div>
                                <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>
                                  Ref {booking.bookingReference} · Party size {booking.partySize} · {formatDateTime(booking.createdAt)}
                                </p>
                                {booking.specialRequests && <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>{booking.specialRequests}</p>}
                                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                  <button style={btnOutline(updatingBooking || !canConfirm)} disabled={updatingBooking || !canConfirm} onClick={() => void updateBookingStatus(booking.id, "CONFIRMED", booking.status)}>
                                    {isConfirming ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Confirming</> : isConfirmed ? "Confirmed" : "Confirm"}
                                  </button>
                                  <button style={btnDestructive(updatingBooking || !canCancel || isCancelled)} disabled={updatingBooking || !canCancel || isCancelled} onClick={() => void updateBookingStatus(booking.id, "CANCELLED_BY_VENUE", booking.status)}>
                                    {isCancelling ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Cancelling</> : isCancelled ? "Cancelled" : "Cancel"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No events with bookings yet.</p>
                )}
              </div>
            </div>
          )}

          {/* ═══ TAB: Menu ═══ */}
          {activeTab === "menu" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Add category */}
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Menu categories</h3>
                  <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Create sections like Appetizers, Main Course, Drinks, and Desserts.</p>
                </div>
                <div style={cardContentStyle}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>Category name</label>
                      <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="e.g. Matchday Platters" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Description (optional)</label>
                      <input value={newCategoryDescription} onChange={(e) => setNewCategoryDescription(e.target.value)} placeholder="Shared plates for large groups" style={inputStyle} />
                    </div>
                  </div>
                  <button style={btnPrimary(creatingMenuCategory || !newCategoryName.trim())} disabled={creatingMenuCategory || !newCategoryName.trim()} onClick={() => void createMenuCategory()}>
                    {creatingMenuCategory ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />} Add Category
                  </button>
                </div>
              </div>

              {/* Add item */}
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Menu items</h3>
                  <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Add food and drink items to categories.</p>
                </div>
                <div style={cardContentStyle}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>Category</label>
                      <select value={newMenuItemCategoryId} onChange={(e) => setNewMenuItemCategoryId(e.target.value)} style={inputStyle}>
                        {menu.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Item name</label>
                      <input value={newMenuItemName} onChange={(e) => setNewMenuItemName(e.target.value)} placeholder="Loaded Nachos" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Price</label>
                      <input type="number" min={0} step="0.01" value={newMenuItemPrice} onChange={(e) => setNewMenuItemPrice(e.target.value)} placeholder="14.99" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Description (optional)</label>
                      <input value={newMenuItemDescription} onChange={(e) => setNewMenuItemDescription(e.target.value)} placeholder="Feeds 2-3 guests" style={inputStyle} />
                    </div>
                  </div>
                  <button style={btnPrimary(creatingMenuItem || !newMenuItemName.trim() || !newMenuItemPrice.trim() || !newMenuItemCategoryId)} disabled={creatingMenuItem || !newMenuItemName.trim() || !newMenuItemPrice.trim() || !newMenuItemCategoryId} onClick={() => void createMenuItem()}>
                    {creatingMenuItem ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />} Add Menu Item
                  </button>

                  <div style={{ marginTop: 24 }}>
                    {menu.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No menu categories yet.</p>
                    ) : menu.map((category) => (
                      <div key={category.id} style={{ ...eventRowStyle, marginBottom: 12 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{category.name}</h4>
                        {category.description && <p style={{ marginTop: 2, fontSize: 12, color: "var(--muted-foreground)" }}>{category.description}</p>}
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                          {category.items.length === 0 ? (
                            <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No items yet.</p>
                          ) : category.items.map((item) => (
                            <div key={item.id} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{item.name}</span>
                                <span style={badgeStyle}>${Number(item.price).toFixed(2)}</span>
                              </div>
                              {item.description && <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>{item.description}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: Settings ═══ */}
          {activeTab === "settings" && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>Venue profile</h3>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Update your public venue info and media shown on listing and venue pages.</p>
              </div>
              <div style={cardContentStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>Venue name</label>
                    <input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Venue name" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <div style={{ position: "relative" }}>
                      <Phone style={{ position: "absolute", left: 12, top: 12, width: 16, height: 16, color: "var(--muted-foreground)", pointerEvents: "none" }} />
                      <input value={venuePhone} onChange={(e) => setVenuePhone(e.target.value)} placeholder="+1 000 000 0000" style={{ ...inputStyle, paddingLeft: 36 }} />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Description</label>
                  <textarea value={venueDescription} onChange={(e) => setVenueDescription(e.target.value)} placeholder="Describe your venue atmosphere, food, and watch-party setup." style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} />
                </div>

                {/* Cover + Gallery */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginBottom: 20 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <label style={labelStyle}>Cover image</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {coverImageUrl && (
                          <button style={btnDestructive()} onClick={() => { setCoverImageUrl(""); setCoverImageS3Key(""); }}>
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                        <button style={btnOutline(uploadingCover)} disabled={uploadingCover} onClick={() => coverInputRef.current?.click()}>
                          {uploadingCover ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Uploading</> : <><Camera size={14} /> Upload Cover</>}
                        </button>
                      </div>
                    </div>
                    <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) void onUploadCover(file); e.currentTarget.value = ""; }} />
                    <div style={{ borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", overflow: "hidden" }}>
                      {coverImageUrl ? (
                        <img src={coverImageUrl} alt="Venue cover" style={{ width: "100%", height: 192, objectFit: "cover" }} />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 192, fontSize: 13, color: "var(--muted-foreground)" }}>No cover image uploaded</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <label style={labelStyle}>Gallery images ({galleryItems.length}/{MAX_GALLERY_IMAGES})</label>
                      <button style={btnOutline(uploadingGallery || galleryItems.length >= MAX_GALLERY_IMAGES)} disabled={uploadingGallery || galleryItems.length >= MAX_GALLERY_IMAGES} onClick={() => galleryInputRef.current?.click()}>
                        {uploadingGallery ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Uploading</> : <><ImagePlus size={14} /> Add Images</>}
                      </button>
                    </div>
                    <input ref={galleryInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) void onUploadGallery(files); e.currentTarget.value = ""; }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {galleryItems.map((item, idx) => (
                        <div key={`${item.url}-${idx}`} style={{ position: "relative", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
                          <img src={item.url} alt={`Gallery ${idx + 1}`} style={{ width: "100%", height: 96, objectFit: "cover" }} />
                          <button
                            style={{ position: "absolute", top: 4, right: 4, width: 28, height: 28, borderRadius: 6, border: "none", backgroundColor: "rgba(239,68,68,0.9)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onClick={() => setGalleryItems((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, MAX_GALLERY_IMAGES - galleryItems.length) }).map((_, idx) => (
                        <div key={`empty-${idx}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 96, borderRadius: 10, border: "1px dashed var(--border)", fontSize: 12, color: "var(--muted-foreground)" }}>
                          Empty slot
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button style={btnPrimary(savingSettings)} disabled={savingSettings} onClick={() => void saveVenueSettings()}>
                    {savingSettings ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving</> : <><Save size={14} /> Save Venue Settings</>}
                  </button>
                </div>

                <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>
                    Danger zone
                  </h4>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12, lineHeight: 1.5 }}>
                    This action removes your venue from public pages and disables all active events. To confirm, retype your account email.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, alignItems: "end" }}>
                    <div>
                      <label style={labelStyle}>Confirm email</label>
                      <input
                        value={deleteVenueEmailConfirm}
                        onChange={(e) => setDeleteVenueEmailConfirm(e.target.value)}
                        placeholder={user?.email || "you@example.com"}
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        style={btnDestructive(deletingVenue || !deleteVenueEmailConfirm.trim())}
                        disabled={deletingVenue || !deleteVenueEmailConfirm.trim()}
                        onClick={() => void deleteOwnedVenue()}
                      >
                        {deletingVenue ? (
                          <>
                            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            Delete Venue
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ═══ Create Event Modal ═══ */}
        {showCreateModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.7)", padding: 16 }}>
            <div style={{ width: "100%", maxWidth: 720, borderRadius: 16, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", padding: 24, maxHeight: "85vh", overflowY: "auto" }}>
              <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", marginBottom: 4 }}>Event Wizard</p>
                  <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 22, fontWeight: 900, color: "var(--foreground)" }}>Create Venue Event</h2>
                </div>
                <button style={btnOutline()} onClick={() => setShowCreateModal(false)}>Close</button>
              </div>

              {/* Mode toggle */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                <button style={createMode === "match" ? btnPrimary() : btnOutline()} onClick={() => setCreateMode("match")}>
                  <Ticket size={14} /> Match Event
                </button>
                <button style={createMode === "custom" ? btnPrimary() : btnOutline()} onClick={() => setCreateMode("custom")}>
                  <Sparkles size={14} /> Custom Event
                </button>
              </div>

              {createMode === "match" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>1. Which match are you hosting?</label>
                    {selectedNewEventMatch ? (
                      <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{selectedNewEventMatch.homeTeamName} vs {selectedNewEventMatch.awayTeamName}</p>
                        <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>{formatDateTime(selectedNewEventMatch.matchDateUtc)} · {getLeagueLabel(selectedNewEventMatch)}</p>
                      </div>
                    ) : (
                      <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--card)", fontSize: 13, color: "var(--muted-foreground)" }}>
                        No upcoming matches available to publish yet.
                      </div>
                    )}
                    <button style={{ ...btnOutline(upcomingMatches.length === 0), marginTop: 8 }} disabled={upcomingMatches.length === 0} onClick={() => setShowMatchPicker(true)}>
                      <Ticket size={14} /> Browse Upcoming Matches by League
                    </button>
                    {availableMatches.length === 0 && upcomingMatches.length > 0 && (
                      <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)" }}>You already host events for all currently upcoming matches.</p>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>2. Capacity limit (optional)</label>
                      <input type="number" min={1} value={newEventLimit} onChange={(e) => setNewEventLimit(e.target.value)} placeholder="Example: 120" style={inputStyle} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                      <input type="checkbox" checked={newEventRequiresApproval} onChange={(e) => setNewEventRequiresApproval(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", cursor: "pointer" }}>Require booking approval</label>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>3. Special notes for guests</label>
                    <textarea value={newEventNotes} onChange={(e) => setNewEventNotes(e.target.value)} placeholder="Doors open early, valet policy, table minimum, etc." style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />
                  </div>

                  <button style={btnPrimary(creatingEvent || !newEventMatchId)} disabled={creatingEvent || !newEventMatchId} onClick={() => void createMatchEvent()}>
                    {creatingEvent ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />} Publish Match Event
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>1. Event title</label>
                      <input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Saturday Fight Night" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>2. Cover image (optional)</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button style={btnOutline()} onClick={() => customImageInputRef.current?.click()}>
                          <ImagePlus size={14} /> Upload
                        </button>
                        {customImageUrl && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Image ready</span>}
                      </div>
                      <input ref={customImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadCustomEventImage(file); e.currentTarget.value = ""; }} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>3. What is happening at this event?</label>
                    <textarea value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} placeholder="Describe the vibe, offers, music, and what guests should expect." style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>4. Start time</label>
                      <input type="datetime-local" value={customStartsAt} onChange={(e) => setCustomStartsAt(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>5. End time</label>
                      <input type="datetime-local" value={customEndsAt} onChange={(e) => setCustomEndsAt(e.target.value)} style={inputStyle} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>6. Event type tags</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 192, overflowY: "auto", borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", padding: 12 }}>
                      {EVENT_WATCH_PARTY_TYPES.map((tag) => {
                        const selected = customTags.includes(tag);
                        return (
                          <button
                            key={tag} type="button"
                            style={{
                              padding: "4px 12px", borderRadius: 99, fontSize: 12, fontFamily: "inherit",
                              border: selected ? "1px solid var(--primary)" : "1px solid var(--border)",
                              backgroundColor: selected ? "color-mix(in oklch, var(--primary) 15%, transparent)" : "transparent",
                              color: selected ? "var(--primary)" : "var(--muted-foreground)",
                              cursor: "pointer",
                            }}
                            onClick={() => setCustomTags((prev) => selected ? prev.filter((v) => v !== tag) : [...prev, tag])}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>7. Booking notes for guests</label>
                    <textarea value={customBookingNotes} onChange={(e) => setCustomBookingNotes(e.target.value)} placeholder="How to reserve, expected arrival window, minimum spend, etc." style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />
                  </div>

                  <button style={btnPrimary(creatingEvent)} disabled={creatingEvent} onClick={() => void createCustomEvent()}>
                    {creatingEvent ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />} Publish Custom Event
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ Match Picker Modal ═══ */}
        {showCreateModal && createMode === "match" && showMatchPicker && (
          <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.75)", padding: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", maxHeight: "85vh", width: "100%", maxWidth: 960, borderRadius: 16, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", padding: 24 }}>
              <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", marginBottom: 4 }}>Upcoming Matches</p>
                  <h3 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 20, fontWeight: 900, color: "var(--foreground)" }}>Choose Match to Publish</h3>
                </div>
                <button style={btnOutline()} onClick={() => setShowMatchPicker(false)}>Close</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>League</label>
                  <select value={matchPickerLeague} onChange={(e) => setMatchPickerLeague(e.target.value)} style={inputStyle}>
                    <option value="all">All leagues</option>
                    {matchPickerLeagueOptions.map((league) => (
                      <option key={league.id} value={league.id}>{league.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Search match</label>
                  <div style={{ position: "relative" }}>
                    <Search style={{ position: "absolute", left: 12, top: 12, width: 16, height: 16, color: "var(--muted-foreground)", pointerEvents: "none" }} />
                    <input value={matchPickerSearch} onChange={(e) => setMatchPickerSearch(e.target.value)} placeholder="Team or league" style={{ ...inputStyle, paddingLeft: 36 }} />
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", padding: 16 }}>
                {matchPickerGroupedRows.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No matches found for this filter.</p>
                ) : matchPickerGroupedRows.map((group) => (
                  <section key={group.leagueId} style={{ marginBottom: 20 }}>
                    <div style={{ position: "sticky", top: 0, zIndex: 10, borderRadius: 8, backgroundColor: "var(--card)", padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", marginBottom: 8 }}>
                      {group.leagueLabel}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {group.matches.map((match) => {
                        const alreadyHosted = events.some((event) => event.matchId === match.id);
                        const isSelected = newEventMatchId === match.id;
                        return (
                          <div key={match.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {match.homeTeamName} vs {match.awayTeamName}
                              </p>
                              <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>{formatDateTime(match.matchDateUtc)}</p>
                            </div>
                            {alreadyHosted ? (
                              <span style={badgeStyle}>Already hosted</span>
                            ) : (
                              <button
                                style={isSelected ? btnPrimary() : btnOutline()}
                                onClick={() => { setNewEventMatchId(match.id); setShowMatchPicker(false); }}
                              >
                                {isSelected ? <Check size={14} /> : <Ticket size={14} />}
                                {isSelected ? "Selected" : "Select"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}
      </AppShell>
    
  );
}
