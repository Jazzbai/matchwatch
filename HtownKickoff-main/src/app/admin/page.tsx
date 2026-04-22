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
import { GooglePlacePicker } from "../../components/GooglePlacePicker";
import { PaginationControls } from "../../components/PaginationControls";
import { useAuth } from "../../lib/auth-context";
import { api, uploadApi, type GooglePlaceDetailsResponse, type GooglePlaceSnapshot } from "../../lib/api";
import { useData } from "../../lib/data-provider";
import {
  DIETARY_TAGS,
  DRINK_TAGS,
  EVENT_WATCH_PARTY_TYPES,
  VENUE_FEATURE_TAGS,
} from "../../lib/tags";
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
    approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
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
  descriptionSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
  shortDescription?: string | null;
  shortDescriptionSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
  amenities?: string[];
  phone?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  country?: string | null;
  postalCode?: string | null;
  lat?: string | null;
  lng?: string | null;
  timezone?: string | null;
  website?: string | null;
  googleMapsUrl?: string | null;
  ratingOverride?: string | null;
  reviewCountOverride?: number | null;
  priceRange?: "BUDGET" | "MID" | "UPSCALE" | "LUXURY" | null;
  priceRangeSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
  coverImageUrl?: string | null;
  resolvedCoverImageUrl?: string | null;
  coverImageS3Key?: string | null;
  galleryImageUrls?: string[];
  resolvedGalleryImageUrls?: string[];
  galleryS3Keys?: string[];
  imageSource?: "manual" | "google" | "none";
  coverImageAttributions?: Array<{
    displayName: string;
    uri?: string | null;
    photoUri?: string | null;
  }>;
  galleryImageAttributions?: Array<Array<{
    displayName: string;
    uri?: string | null;
    photoUri?: string | null;
  }>>;
  promotedVenueEventId?: string | null;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  approvalNotes?: string | null;
  googlePlaceId?: string | null;
  menuSourceState?: "google" | "manual" | "none";
  googleDefaults?: GooglePlaceSnapshot | null;
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
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  approvalNotes?: string | null;
  googlePlaceId?: string | null;
  menuSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
};

type ClaimRecord = {
  id: string;
  venueId: string;
  venueName: string;
  venueSlug: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes?: string | null;
  adminNotes?: string | null;
  verificationDocuments?: string[];
  reviewedAt?: string | null;
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

function getGoogleImagePreviewState(snapshot?: GooglePlaceSnapshot | null) {
  const suggested = Array.isArray(snapshot?.googleSuggestedImages)
    ? snapshot.googleSuggestedImages.filter((photo) => photo.previewUrl)
    : [];
  const selectedCover = suggested.find((photo) => photo.isSelectedCover);
  const selectedGallery = suggested.filter((photo) => photo.isSelectedGallery);
  const coverPreviewUrl = normalizeImageUrl(
    selectedCover?.previewUrl || selectedGallery[0]?.previewUrl || suggested[0]?.previewUrl || "",
  );
  const galleryPreviewUrls = selectedGallery
    .map((photo) => normalizeImageUrl(photo.previewUrl))
    .filter(Boolean)
    .slice(0, MAX_GALLERY_IMAGES);

  return {
    coverPreviewUrl,
    galleryPreviewUrls,
  };
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
    headers: {
      "Content-Type": file.type,
      ...(presigned.data.uploadHeaders || {}),
    },
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

function applyGoogleDefaultsToVenueForm(snapshot: GooglePlaceSnapshot) {
  return {
    googlePlaceId: snapshot.placeId,
    name: snapshot.displayName || "",
    addressLine1: snapshot.addressLine1 || snapshot.formattedAddress || "",
    city: snapshot.city || "",
    country: snapshot.country || "",
    stateProvince: snapshot.stateProvince || "",
    postalCode: snapshot.postalCode || "",
    lat: snapshot.lat == null ? "" : String(snapshot.lat),
    lng: snapshot.lng == null ? "" : String(snapshot.lng),
    timezone: snapshot.timezone || "America/Chicago",
    phone: snapshot.phone || "",
    website: snapshot.website || "",
    googleMapsUrl: snapshot.googleMapsUrl || "",
  };
}

export default function AdminPage() {
  const VENUES_PER_PAGE = 20;
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const { refetch } = useData();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [ownedVenues, setOwnedVenues] = React.useState<OwnedVenue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = React.useState("");
  const [venueSearch, setVenueSearch] = React.useState("");
  const [venuePage, setVenuePage] = React.useState(1);
  const [showCreateVenueForm, setShowCreateVenueForm] = React.useState(false);

  const [overview, setOverview] = React.useState<DashboardOverview | null>(null);
  const [claims, setClaims] = React.useState<ClaimRecord[]>([]);
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
  const [venueShortDescription, setVenueShortDescription] = React.useState("");
  const [venueAmenities, setVenueAmenities] = React.useState<string[]>([]);
  const [venuePhone, setVenuePhone] = React.useState("");
  const [venueAddressLine1, setVenueAddressLine1] = React.useState("");
  const [venueCity, setVenueCity] = React.useState("");
  const [venueStateProvince, setVenueStateProvince] = React.useState("");
  const [venueCountry, setVenueCountry] = React.useState("");
  const [venuePostalCode, setVenuePostalCode] = React.useState("");
  const [venueLat, setVenueLat] = React.useState("");
  const [venueLng, setVenueLng] = React.useState("");
  const [venueTimezone, setVenueTimezone] = React.useState("America/Chicago");
  const [venueWebsite, setVenueWebsite] = React.useState("");
  const [venueGoogleMapsUrl, setVenueGoogleMapsUrl] = React.useState("");
  const [venueGooglePlaceId, setVenueGooglePlaceId] = React.useState("");
  const [venueApprovalStatus, setVenueApprovalStatus] = React.useState<"PENDING" | "APPROVED" | "REJECTED" | null>(null);
  const [venueApprovalNotes, setVenueApprovalNotes] = React.useState<string | null>(null);
  const [descriptionSource, setDescriptionSource] = React.useState<"NONE" | "GOOGLE" | "MANUAL" | null>(null);
  const [shortDescriptionSource, setShortDescriptionSource] = React.useState<"NONE" | "GOOGLE" | "MANUAL" | null>(null);
  const [priceRangeSource, setPriceRangeSource] = React.useState<"NONE" | "GOOGLE" | "MANUAL" | null>(null);
  const [menuSourceState, setMenuSourceState] = React.useState<"google" | "manual" | "none">("none");
  const [googleDefaults, setGoogleDefaults] = React.useState<GooglePlaceSnapshot | null>(null);
  const [linkingGooglePlace, setLinkingGooglePlace] = React.useState(false);
  const [refreshingGoogleData, setRefreshingGoogleData] = React.useState(false);
  const [revertingGoogleData, setRevertingGoogleData] = React.useState(false);
  const [coverImageUrl, setCoverImageUrl] = React.useState("");
  const [resolvedCoverImageUrl, setResolvedCoverImageUrl] = React.useState("");
  const [coverImageS3Key, setCoverImageS3Key] = React.useState("");
  const [galleryItems, setGalleryItems] = React.useState<GalleryItem[]>([]);
  const [resolvedGalleryImageUrls, setResolvedGalleryImageUrls] = React.useState<string[]>([]);
  const [googleImageActionKey, setGoogleImageActionKey] = React.useState<string | null>(null);
  const [promotedEventId, setPromotedEventId] = React.useState<string | null>(null);
  const coverInputRef = React.useRef<HTMLInputElement | null>(null);
  const galleryInputRef = React.useRef<HTMLInputElement | null>(null);
  const [deleteVenueEmailConfirm, setDeleteVenueEmailConfirm] = React.useState("");
  // ─── AI Call Agent Qualification state ───────────────────────────────
  type AiQualStatus = "NOT_STARTED" | "IN_REVIEW" | "QUALIFIED" | "NEEDS_REVIEW" | "NOT_QUALIFIED";
  type AiReservationMode = "NONE" | "ANSWER_ONLY" | "COLLECT_REQUEST" | "FULL_INTAKE" | "TRANSFER_TO_STAFF";
  type AiGoLive = "READY_NOW" | "READY_IN_7_DAYS" | "READY_IN_14_DAYS" | "NOT_READY";

  const [aiQualStatus, setAiQualStatus] = React.useState<AiQualStatus>("NOT_STARTED");
  const [aiQualifiedFor, setAiQualifiedFor] = React.useState<string[]>([]);
  const [aiReservationMode, setAiReservationMode] = React.useState<AiReservationMode>("NONE");
  const [aiEscalationName, setAiEscalationName] = React.useState("");
  const [aiEscalationPhone, setAiEscalationPhone] = React.useState("");
  const [aiEscalationEmail, setAiEscalationEmail] = React.useState("");
  const [aiLanguages, setAiLanguages] = React.useState<string[]>([]);
  const [aiLanguageInput, setAiLanguageInput] = React.useState("");
  const [aiGoLive, setAiGoLive] = React.useState<AiGoLive>("NOT_READY");
  const [aiNotes, setAiNotes] = React.useState("");
  const [aiQuestionnaireLink, setAiQuestionnaireLink] = React.useState("");
  const [savingAiQual, setSavingAiQual] = React.useState(false);
  // questionnaire answers
  const [aiIsActive, setAiIsActive] = React.useState<boolean | null>(null);
  const [aiReceivesCalls, setAiReceivesCalls] = React.useState<boolean | null>(null);
  const [aiAcceptsReservations, setAiAcceptsReservations] = React.useState<"yes" | "no" | "groups" | null>(null);
  const [aiHoursReady, setAiHoursReady] = React.useState<boolean | null>(null);
  const [aiHasEscalation, setAiHasEscalation] = React.useState<boolean | null>(null);
  const [aiWantsMultilingual, setAiWantsMultilingual] = React.useState<boolean | null>(null);

  const AI_USE_CASES = [
    { value: "reservations", label: "Reservations" },
    { value: "watch_party_questions", label: "Watch party questions" },
    { value: "private_events", label: "Private events" },
    { value: "general_faq", label: "General FAQs" },
    { value: "directions_hours", label: "Directions / hours" },
    { value: "lead_capture", label: "Lead capture" },
  ];

  function computeAiQualStatus(): AiQualStatus {
    if (aiIsActive === null || aiReceivesCalls === null || aiQualifiedFor.length === 0) {
      return "NOT_STARTED";
    }
    if (!aiIsActive || !aiReceivesCalls || aiQualifiedFor.length === 0) {
      return "NOT_QUALIFIED";
    }
    if (aiGoLive === "NOT_READY" || !aiHasEscalation || !aiHoursReady) {
      return "NEEDS_REVIEW";
    }
    if (!aiEscalationPhone.trim() && !aiEscalationEmail.trim()) {
      return "NEEDS_REVIEW";
    }
    return "QUALIFIED";
  }

  const saveAiQualification = async () => {
    if (!selectedVenueId) { setError("Select a venue first."); return; }
    const computedStatus = computeAiQualStatus();
    setSavingAiQual(true);
    setError(null);
    try {
      await api.put(dashboardPath("/dashboard/venue"), {
        aiCallAgentQualificationStatus: computedStatus,
        aiCallAgentQualifiedFor: aiQualifiedFor,
        aiCallAgentReservationMode: aiReservationMode,
        aiCallAgentEscalationContactName: aiEscalationName.trim() || undefined,
        aiCallAgentEscalationContactPhone: aiEscalationPhone.trim() || undefined,
        aiCallAgentEscalationContactEmail: aiEscalationEmail.trim() || undefined,
        aiCallAgentLanguages: aiLanguages,
        aiCallAgentGoLiveReadiness: aiGoLive,
        aiCallAgentNotes: aiNotes.trim() || undefined,
        aiCallAgentQuestionnaireLink: aiQuestionnaireLink.trim() || undefined,
      });
      setAiQualStatus(computedStatus);
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save AI qualification");
    } finally {
      setSavingAiQual(false);
    }
  };

  function toggleAiUseCase(value: string) {
    setAiQualifiedFor((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function addAiLanguage() {
    const lang = aiLanguageInput.trim();
    if (lang && !aiLanguages.includes(lang)) {
      setAiLanguages((prev) => [...prev, lang]);
    }
    setAiLanguageInput("");
  }

  const [newOwnedVenue, setNewOwnedVenue] = React.useState({
    googlePlaceId: "",
    name: "",
    addressLine1: "",
    city: "Houston",
    stateProvince: "",
    country: "US",
    postalCode: "",
    lat: "29.7604",
    lng: "-95.3698",
    timezone: "America/Chicago",
    phone: "",
    website: "",
    googleMapsUrl: "",
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

  const filteredOwnedVenues = React.useMemo(() => {
    const keyword = venueSearch.trim().toLowerCase();
    return ownedVenues.filter((venue) => {
      if (!keyword) return true;
      return venue.name.toLowerCase().includes(keyword);
    });
  }, [ownedVenues, venueSearch]);

  const totalVenuePages = Math.max(1, Math.ceil(filteredOwnedVenues.length / VENUES_PER_PAGE));

  const pagedOwnedVenues = React.useMemo(() => {
    const start = (venuePage - 1) * VENUES_PER_PAGE;
    return filteredOwnedVenues.slice(start, start + VENUES_PER_PAGE);
  }, [filteredOwnedVenues, venuePage, VENUES_PER_PAGE]);

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
      const claimsRes = await api.get<ClaimRecord[]>("/dashboard/claims");
      setClaims(claimsRes.data || []);
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
        setVenueShortDescription("");
        setVenueAmenities([]);
        setVenuePhone("");
        setVenueAddressLine1("");
        setVenueCity("");
        setVenueStateProvince("");
        setVenueCountry("");
        setVenuePostalCode("");
        setVenueLat("");
        setVenueLng("");
        setVenueTimezone("America/Chicago");
        setVenueWebsite("");
        setVenueGoogleMapsUrl("");
        setVenueGooglePlaceId("");
        setVenueApprovalStatus(null);
        setVenueApprovalNotes(null);
        setMenuSourceState("none");
        setGoogleDefaults(null);
        setCoverImageUrl("");
        setResolvedCoverImageUrl("");
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
      setVenueShortDescription(profile.shortDescription || "");
      setVenueAmenities(Array.isArray(profile.amenities) ? profile.amenities : []);
      setVenuePhone(profile.phone || "");
      setVenueAddressLine1(profile.addressLine1 || "");
      setVenueCity(profile.city || "");
      setVenueStateProvince(profile.stateProvince || "");
      setVenueCountry(profile.country || "");
      setVenuePostalCode(profile.postalCode || "");
      setVenueLat(profile.lat || "");
      setVenueLng(profile.lng || "");
      setVenueTimezone(profile.timezone || "America/Chicago");
      setVenueWebsite(profile.website || "");
      setVenueGoogleMapsUrl(profile.googleMapsUrl || "");
      setVenueGooglePlaceId(profile.googlePlaceId || "");
      setVenueApprovalStatus(profile.approvalStatus || null);
      setVenueApprovalNotes(profile.approvalNotes || null);
      setDescriptionSource(profile.descriptionSource || null);
      setShortDescriptionSource(profile.shortDescriptionSource || null);
      setPriceRangeSource(profile.priceRangeSource || null);
      setMenuSourceState(profile.menuSourceState || "none");
      setGoogleDefaults(profile.googleDefaults || null);
      setCoverImageUrl(normalizeImageUrl(profile.coverImageUrl));
      setResolvedCoverImageUrl(normalizeImageUrl(profile.resolvedCoverImageUrl));
      setCoverImageS3Key(profile.coverImageS3Key || "");
      setGalleryItems(parseGalleryItems(profile.galleryImageUrls, profile.galleryS3Keys));
      setResolvedGalleryImageUrls(
        Array.isArray(profile.resolvedGalleryImageUrls)
          ? profile.resolvedGalleryImageUrls.map((url) => normalizeImageUrl(url)).filter(Boolean).slice(0, MAX_GALLERY_IMAGES)
          : [],
      );
      setPromotedEventId(typeof profile.promotedVenueEventId === "string" ? profile.promotedVenueEventId : null);
      // AI Call Agent Qualification
      setAiQualStatus((profile as any).aiCallAgentQualificationStatus || "NOT_STARTED");
      setAiQualifiedFor((profile as any).aiCallAgentQualifiedFor || []);
      setAiReservationMode((profile as any).aiCallAgentReservationMode || "NONE");
      setAiEscalationName((profile as any).aiCallAgentEscalationContactName || "");
      setAiEscalationPhone((profile as any).aiCallAgentEscalationContactPhone || "");
      setAiEscalationEmail((profile as any).aiCallAgentEscalationContactEmail || "");
      setAiLanguages((profile as any).aiCallAgentLanguages || []);
      setAiGoLive((profile as any).aiCallAgentGoLiveReadiness || "NOT_READY");
      setAiNotes((profile as any).aiCallAgentNotes || "");
      setAiQuestionnaireLink((profile as any).aiCallAgentQuestionnaireLink || "");
      const existingStatus: string = (profile as any).aiCallAgentQualificationStatus || "NOT_STARTED";
      if (existingStatus !== "NOT_STARTED") {
        setAiIsActive(true);
        setAiReceivesCalls(true);
        setAiHoursReady(existingStatus === "QUALIFIED");
        setAiHasEscalation(!!(profile as any).aiCallAgentEscalationContactPhone || !!(profile as any).aiCallAgentEscalationContactEmail);
      }

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
    setVenuePage(1);
  }, [venueSearch]);

  React.useEffect(() => {
    if (venuePage > totalVenuePages) {
      setVenuePage(totalVenuePages);
    }
  }, [totalVenuePages, venuePage]);

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

  const applyOwnerVenueGoogleDefaults = React.useCallback(async (details: GooglePlaceDetailsResponse) => {
    const defaults = applyGoogleDefaultsToVenueForm(details.defaults);
    const imagePreviews = getGoogleImagePreviewState(details.defaults);
    setVenueGooglePlaceId(defaults.googlePlaceId);
    setVenueName(defaults.name);
    setVenueAddressLine1(defaults.addressLine1);
    setVenueCity(defaults.city);
    setVenueStateProvince(defaults.stateProvince);
    setVenueCountry(defaults.country);
    setVenuePostalCode(defaults.postalCode);
    setVenueLat(defaults.lat);
    setVenueLng(defaults.lng);
    setVenueTimezone(defaults.timezone);
    setVenuePhone(defaults.phone);
    setVenueWebsite(defaults.website);
    setVenueGoogleMapsUrl(defaults.googleMapsUrl);
    setGoogleDefaults(details.defaults);
    setResolvedCoverImageUrl(imagePreviews.coverPreviewUrl);
    setResolvedGalleryImageUrls(imagePreviews.galleryPreviewUrls);
    if (!selectedVenueId || !details.googlePlaceId?.trim()) {
      return;
    }

    setLinkingGooglePlace(true);
    setError(null);
    try {
      await api.put(dashboardPath("/dashboard/venue"), {
        googlePlaceId: details.googlePlaceId.trim(),
      });
      await Promise.all([loadDashboard(), refetch()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to link Google Business profile");
    } finally {
      setLinkingGooglePlace(false);
    }
  }, [dashboardPath, loadDashboard, refetch, selectedVenueId]);

  const applyNewVenueGoogleDefaults = React.useCallback((details: GooglePlaceDetailsResponse) => {
    const defaults = applyGoogleDefaultsToVenueForm(details.defaults);
    setNewOwnedVenue((prev) => ({
      ...prev,
      ...defaults,
    }));
  }, []);

  const toggleVenueAmenity = React.useCallback((tag: string) => {
    setVenueAmenities((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  }, []);

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
        googlePlaceId: venueGooglePlaceId || undefined,
        name: venueName.trim(),
        description: venueDescription.trim() || undefined,
        shortDescription: venueShortDescription.trim() || undefined,
        addressLine1: venueAddressLine1.trim() || undefined,
        city: venueCity.trim() || undefined,
        stateProvince: venueStateProvince.trim() || undefined,
        country: venueCountry.trim() || undefined,
        postalCode: venuePostalCode.trim() || undefined,
        lat: venueLat ? Number(venueLat) : undefined,
        lng: venueLng ? Number(venueLng) : undefined,
        timezone: venueTimezone.trim() || undefined,
        phone: venuePhone.trim() || undefined,
        website: venueWebsite.trim() || undefined,
        googleMapsUrl: venueGoogleMapsUrl.trim() || undefined,
        amenities: venueAmenities,
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

  const refreshVenueGoogleData = async () => {
    if (!selectedVenueId) return;
    setRefreshingGoogleData(true);
    setError(null);
    try {
      await api.post(dashboardPath("/dashboard/venue/google/refresh"));
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to refresh Google defaults");
    } finally {
      setRefreshingGoogleData(false);
    }
  };

  const revertVenueToGoogleDefaults = async () => {
    if (!selectedVenueId) return;
    setRevertingGoogleData(true);
    setError(null);
    try {
      await api.post(dashboardPath("/dashboard/venue/google/revert"), {
        includeMenu: true,
      });
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to revert venue to Google defaults");
    } finally {
      setRevertingGoogleData(false);
    }
  };

  const updateGoogleImageSelection = async (
    action: "cover" | "gallery" | "revert",
    photoName?: string,
  ) => {
    if (!selectedVenueId) return;
    const actionKey = `${action}:${photoName || "default"}`;
    setGoogleImageActionKey(actionKey);
    setError(null);
    try {
      await api.post(dashboardPath("/dashboard/venue/google/images"), {
        action,
        photoName,
      });
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update Google image selection");
    } finally {
      setGoogleImageActionKey(null);
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
        googlePlaceId: newOwnedVenue.googlePlaceId || undefined,
        name: newOwnedVenue.name.trim(),
        addressLine1: newOwnedVenue.addressLine1.trim(),
        city: newOwnedVenue.city.trim(),
        stateProvince: newOwnedVenue.stateProvince.trim() || undefined,
        country: newOwnedVenue.country.trim(),
        postalCode: newOwnedVenue.postalCode.trim() || undefined,
        lat,
        lng,
        timezone: newOwnedVenue.timezone.trim() || "America/Chicago",
        phone: newOwnedVenue.phone.trim() || undefined,
        website: newOwnedVenue.website.trim() || undefined,
        googleMapsUrl: newOwnedVenue.googleMapsUrl.trim() || undefined,
        description: newOwnedVenue.description.trim() || undefined,
      });

      setShowCreateVenueForm(false);
      setNewOwnedVenue({
        googlePlaceId: "",
        name: "",
        addressLine1: "",
        city: "Houston",
        stateProvince: "",
        country: "US",
        postalCode: "",
        lat: "29.7604",
        lng: "-95.3698",
        timezone: "America/Chicago",
        phone: "",
        website: "",
        googleMapsUrl: "",
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

  const googleSuggestedImages = googleDefaults?.googleSuggestedImages || [];
  const googleMenuCategories = googleDefaults?.menu?.categories || [];
  const googleReviews = googleDefaults?.googleReviews || [];
  const effectiveCoverPreview = coverImageUrl || resolvedCoverImageUrl;
  const effectiveGalleryItems = galleryItems.length > 0
    ? galleryItems.map((item) => ({ ...item, source: "manual" as const }))
    : resolvedGalleryImageUrls.map((url) => ({ url, key: "", source: "google" as const }));

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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 12, minWidth: 360, maxWidth: 520, width: "100%" }}>
              <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "flex-end" }}>
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
              <div style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--card)", padding: 12, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                    Edit Venue
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {filteredOwnedVenues.length} result{filteredOwnedVenues.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div style={{ position: "relative" }}>
                  <Search style={{ position: "absolute", left: 12, top: 12, width: 16, height: 16, color: "var(--muted-foreground)", pointerEvents: "none" }} />
                  <input
                    value={venueSearch}
                    onChange={(event) => setVenueSearch(event.target.value)}
                    placeholder="Search venue name"
                    style={{ ...inputStyle, paddingLeft: 36 }}
                  />
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {pagedOwnedVenues.length === 0 ? (
                    <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px dashed var(--border)", color: "var(--muted-foreground)", fontSize: 13 }}>
                      No venues match that search.
                    </div>
                  ) : (
                    pagedOwnedVenues.map((venue) => {
                      const isActive = venue.id === selectedVenueId;
                      return (
                        <button
                          key={venue.id}
                          type="button"
                          onClick={() => setSelectedVenueId(venue.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: 10,
                            border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                            backgroundColor: isActive ? "color-mix(in oklch, var(--primary) 12%, var(--card))" : "var(--secondary)",
                            color: "var(--foreground)",
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: "inherit",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{venue.name}</div>
                            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                              {venue.city}{venue.country ? `, ${venue.country}` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            {venue.approvalStatus ? <span style={badgeStyle}>{venue.approvalStatus}</span> : null}
                            {isActive ? <Check style={{ width: 16, height: 16, color: "var(--primary)" }} /> : null}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <PaginationControls
                  currentPage={venuePage}
                  totalPages={totalVenuePages}
                  onPageChange={setVenuePage}
                />
              </div>
              {showCreateVenueForm && (
                <div style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--card)", padding: 12, display: "grid", gap: 8 }}>
                  <GooglePlacePicker
                    initialPlaceId={newOwnedVenue.googlePlaceId}
                    onPlaceResolved={applyNewVenueGoogleDefaults}
                  />
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
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
                      value={newOwnedVenue.stateProvince}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, stateProvince: event.target.value }))}
                      placeholder="State / Province"
                      style={inputStyle}
                    />
                    <input
                      value={newOwnedVenue.postalCode}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, postalCode: event.target.value }))}
                      placeholder="Postal code"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 120px 1fr 1fr", gap: 8 }}>
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
                    <input
                      value={newOwnedVenue.website}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, website: event.target.value }))}
                      placeholder="Website"
                      style={inputStyle}
                    />
                    <input
                      value={newOwnedVenue.googleMapsUrl}
                      onChange={(event) => setNewOwnedVenue((prev) => ({ ...prev, googleMapsUrl: event.target.value }))}
                      placeholder="Google Maps URL"
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

          {(user.businessApprovalStatus && user.businessApprovalStatus !== "APPROVED") || venueApprovalStatus || claims.length > 0 ? (
            <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
              {user.businessApprovalStatus && user.businessApprovalStatus !== "APPROVED" ? (
                <div style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)", backgroundColor: "rgba(245,158,11,0.08)" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--foreground)" }}>Business approval: {user.businessApprovalStatus}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>
                    {user.businessApprovalNotes || "Your business profile is pending admin review. Public activation and event publishing stay blocked until approval."}
                  </div>
                </div>
              ) : null}

              {selectedVenueId && venueApprovalStatus && venueApprovalStatus !== "APPROVED" ? (
                <div style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)", backgroundColor: "rgba(245,158,11,0.08)" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--foreground)" }}>Venue approval: {venueApprovalStatus}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>
                    {venueApprovalNotes || "This venue is waiting for admin approval before it appears publicly or can host match events."}
                  </div>
                </div>
              ) : null}

              {claims.length > 0 ? (
                <div style={{ ...cardStyle, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--foreground)", marginBottom: 10 }}>Venue claims</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {claims.slice(0, 5).map((claim) => (
                      <div key={claim.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, backgroundColor: "var(--secondary)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{claim.venueName}</div>
                          <span style={badgeStyle}>{claim.status}</span>
                        </div>
                        {claim.notes ? <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)" }}>{claim.notes}</div> : null}
                        {claim.adminNotes ? <div style={{ marginTop: 6, fontSize: 12, color: "var(--foreground)" }}>Admin note: {claim.adminNotes}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

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
                <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Venue approval</div>
                      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>{venueApprovalStatus || "UNKNOWN"}</div>
                      {venueApprovalNotes ? <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)" }}>{venueApprovalNotes}</div> : null}
                    </div>
                    <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Menu source</div>
                      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>{menuSourceState.toUpperCase()}</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)" }}>
                        {googleMenuCategories.length || googleDefaults?.menu?.sourceUrl ? "Google menu is available for revert." : "No Google menu snapshot stored."}
                      </div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>About source</div>
                      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>{(descriptionSource || shortDescriptionSource || "NONE").toUpperCase()}</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)" }}>
                        {googleDefaults?.editorialSummary ? "Google editorial summary is stored." : "Fallback Google summary will be generated on refresh."}
                      </div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Google price</div>
                      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>{googleDefaults?.priceLevel || "Unavailable"}</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)" }}>
                        Price source: {(priceRangeSource || "NONE").toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <GooglePlacePicker
                    initialPlaceId={venueGooglePlaceId}
                    disabled={linkingGooglePlace}
                    onPlaceResolved={applyOwnerVenueGoogleDefaults}
                  />

                  {linkingGooglePlace ? (
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                      Linking Google Business profile and storing photo suggestions...
                    </div>
                  ) : null}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button style={btnOutline(refreshingGoogleData || !venueGooglePlaceId)} disabled={refreshingGoogleData || !venueGooglePlaceId} onClick={() => void refreshVenueGoogleData()}>
                      {refreshingGoogleData ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Re-syncing</> : "Re-sync Google Data"}
                    </button>
                    <button style={btnOutline(revertingGoogleData || !googleDefaults)} disabled={revertingGoogleData || !googleDefaults} onClick={() => void revertVenueToGoogleDefaults()}>
                      {revertingGoogleData ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Reverting</> : "Revert to Google Defaults"}
                    </button>
                    <button
                      style={btnOutline(googleImageActionKey === "revert:default" || !googleSuggestedImages.length)}
                      disabled={googleImageActionKey === "revert:default" || !googleSuggestedImages.length}
                      onClick={() => void updateGoogleImageSelection("revert")}
                    >
                      {googleImageActionKey === "revert:default" ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Resetting</> : "Revert Suggested Images"}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 20, padding: 16, borderRadius: 14, border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
                    <div style={{ borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--card)", padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--foreground)" }}>Google About Default</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                        {googleDefaults?.editorialSummary || "No editorial summary in the Google snapshot yet. Re-sync will fall back to deterministic venue copy."}
                      </div>
                    </div>
                    <div style={{ borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--card)", padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--foreground)" }}>Google Menu Snapshot</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                        {googleDefaults?.menu?.sourceUrl ? (
                          <>
                            Status: {googleDefaults.menu.scrapeStatus || "PENDING"}<br />
                            Categories: {googleMenuCategories.length}<br />
                            {googleDefaults.menu.error ? `Last error: ${googleDefaults.menu.error}` : "Menu import is ready to use when manual menu is not active."}
                          </>
                        ) : "No Google-linked menu URL stored yet."}
                      </div>
                    </div>
                    <div style={{ borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--card)", padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--foreground)" }}>Google Reviews Snapshot</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                        {googleReviews.length ? `${googleReviews.length} Google reviews stored. Average rating uses the Google refresh values shown on the public page.` : "No Google reviews stored yet."}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--foreground)" }}>Google Suggested Images</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)", maxWidth: 720 }}>
                        Manual cover and gallery uploads always override these Google defaults. Use the controls below to pick the best Google cover and gallery fallback set without downloading images into storage.
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                      {googleSuggestedImages.length ? `${googleSuggestedImages.length} Google photos available` : "No Google photos stored for this venue yet"}
                    </div>
                  </div>

                  {googleSuggestedImages.length ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                      {googleSuggestedImages.map((photo) => {
                        const actionKeyPrefix = photo.name;
                        const dimensionLabel = photo.widthPx && photo.heightPx ? `${photo.widthPx}×${photo.heightPx}` : "Unknown size";
                        return (
                          <div key={photo.name} style={{ borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--card)", overflow: "hidden" }}>
                            <img src={photo.previewUrl} alt={`${venueName || "Venue"} Google suggestion`} style={{ width: "100%", height: 148, objectFit: "cover" }} loading="lazy" />
                            <div style={{ padding: 12, display: "grid", gap: 10 }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {photo.isSelectedCover && <span style={badgeStyle}>Selected Cover</span>}
                                {photo.isSelectedGallery && <span style={badgeStyle}>In Gallery</span>}
                                <span style={badgeStyle}>{dimensionLabel}</span>
                              </div>
                              {photo.authorAttributions?.length ? (
                                <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                                  Photo credit: {photo.authorAttributions.map((author) => author.displayName).join(", ")}
                                </div>
                              ) : null}
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                <button
                                  style={btnOutline(googleImageActionKey === `cover:${actionKeyPrefix}` || photo.isSelectedCover)}
                                  disabled={googleImageActionKey === `cover:${actionKeyPrefix}` || photo.isSelectedCover}
                                  onClick={() => void updateGoogleImageSelection("cover", photo.name)}
                                >
                                  {googleImageActionKey === `cover:${actionKeyPrefix}` ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving</> : "Use as Cover"}
                                </button>
                                <button
                                  style={btnOutline(googleImageActionKey === `gallery:${actionKeyPrefix}` || photo.isSelectedGallery)}
                                  disabled={googleImageActionKey === `gallery:${actionKeyPrefix}` || photo.isSelectedGallery}
                                  onClick={() => void updateGoogleImageSelection("gallery", photo.name)}
                                >
                                  {googleImageActionKey === `gallery:${actionKeyPrefix}` ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving</> : "Add to Gallery"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ borderRadius: 12, border: "1px dashed var(--border)", padding: 16, fontSize: 12, color: "var(--muted-foreground)" }}>
                      Link a Google Business profile above to fetch and score photo suggestions automatically. Use re-sync only if you want to refresh Google photos later.
                    </div>
                  )}
                </div>

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
                  <div>
                    <label style={labelStyle}>Website</label>
                    <input value={venueWebsite} onChange={(e) => setVenueWebsite(e.target.value)} placeholder="https://example.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Google Maps URL</label>
                    <input value={venueGoogleMapsUrl} onChange={(e) => setVenueGoogleMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>Address line 1</label>
                    <input value={venueAddressLine1} onChange={(e) => setVenueAddressLine1(e.target.value)} placeholder="Street address" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input value={venueCity} onChange={(e) => setVenueCity(e.target.value)} placeholder="City" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>State / Province</label>
                    <input value={venueStateProvince} onChange={(e) => setVenueStateProvince(e.target.value)} placeholder="State / Province" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Country</label>
                    <input value={venueCountry} onChange={(e) => setVenueCountry(e.target.value)} placeholder="Country" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Postal code</label>
                    <input value={venuePostalCode} onChange={(e) => setVenuePostalCode(e.target.value)} placeholder="Postal code" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Timezone</label>
                    <input value={venueTimezone} onChange={(e) => setVenueTimezone(e.target.value)} placeholder="Timezone" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Latitude</label>
                    <input value={venueLat} onChange={(e) => setVenueLat(e.target.value)} placeholder="Latitude" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Longitude</label>
                    <input value={venueLng} onChange={(e) => setVenueLng(e.target.value)} placeholder="Longitude" style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Short description</label>
                  <div style={{ marginBottom: 6, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    Keep this to one tight sentence. Focus on what makes the venue worth booking for match day: crowd, screen setup, signature food, patio, or neighborhood draw.
                  </div>
                  <textarea value={venueShortDescription} onChange={(e) => setVenueShortDescription(e.target.value)} placeholder="Example: Energetic sports bar with giant projector screens, patio seating, and game-day drink specials in Midtown." style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Description</label>
                  <div style={{ marginBottom: 6, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    Write 3 to 5 concrete sentences. Cover the atmosphere, screen and sound setup, seating style, food and drink strengths, parking or reservation details, and what makes your venue different on match days.
                  </div>
                  <textarea value={venueDescription} onChange={(e) => setVenueDescription(e.target.value)} placeholder="Example: MatchWatch guests come here for a loud, high-energy soccer crowd, two projector walls, and guaranteed sound for major fixtures. We serve craft beer, wings, tacos, and late-night snacks, with patio overflow seating for big tournaments. Free parking is available behind the building, and larger groups should reserve early for derby and finals nights." style={{ ...inputStyle, minHeight: 120, resize: "vertical" }} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Amenities & watch-party features</label>
                  <div style={{ marginBottom: 10, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    Select the features guests care about most before booking: screen size, sound, drinks, parking, patio, accessibility, Wi-Fi, and special service options. These show up as public venue badges.
                  </div>

                  <div style={{ display: "grid", gap: 14 }}>
                    <div>
                      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>Drinks & service</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                        {DRINK_TAGS.map((tag) => (
                          <label key={tag} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", cursor: "pointer" }}>
                            <input type="checkbox" checked={venueAmenities.includes(tag)} onChange={() => toggleVenueAmenity(tag)} style={{ width: 16, height: 16, marginTop: 2, accentColor: "var(--primary)" }} />
                            <span style={{ fontSize: 13, color: "var(--foreground)" }}>{tag}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>Venue features</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                        {VENUE_FEATURE_TAGS.map((tag) => (
                          <label key={tag} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", cursor: "pointer" }}>
                            <input type="checkbox" checked={venueAmenities.includes(tag)} onChange={() => toggleVenueAmenity(tag)} style={{ width: 16, height: 16, marginTop: 2, accentColor: "var(--primary)" }} />
                            <span style={{ fontSize: 13, color: "var(--foreground)" }}>{tag}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>Dietary & guest needs</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                        {DIETARY_TAGS.map((tag) => (
                          <label key={tag} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", cursor: "pointer" }}>
                            <input type="checkbox" checked={venueAmenities.includes(tag)} onChange={() => toggleVenueAmenity(tag)} style={{ width: 16, height: 16, marginTop: 2, accentColor: "var(--primary)" }} />
                            <span style={{ fontSize: 13, color: "var(--foreground)" }}>{tag}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
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
                    {!coverImageUrl && resolvedCoverImageUrl ? (
                      <div style={{ marginBottom: 8, fontSize: 12, color: "var(--muted-foreground)" }}>
                        Google-selected cover is shown here until you upload a manual replacement.
                      </div>
                    ) : null}
                    <div style={{ borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--secondary)", overflow: "hidden" }}>
                      {effectiveCoverPreview ? (
                        <img src={effectiveCoverPreview} alt="Venue cover" style={{ width: "100%", height: 192, objectFit: "cover" }} />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 192, fontSize: 13, color: "var(--muted-foreground)" }}>No cover image uploaded</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <label style={labelStyle}>Gallery images ({effectiveGalleryItems.length}/{MAX_GALLERY_IMAGES})</label>
                      <button style={btnOutline(uploadingGallery || galleryItems.length >= MAX_GALLERY_IMAGES)} disabled={uploadingGallery || galleryItems.length >= MAX_GALLERY_IMAGES} onClick={() => galleryInputRef.current?.click()}>
                        {uploadingGallery ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Uploading</> : <><ImagePlus size={14} /> Add Images</>}
                      </button>
                    </div>
                    {galleryItems.length === 0 && resolvedGalleryImageUrls.length > 0 ? (
                      <div style={{ marginBottom: 8, fontSize: 12, color: "var(--muted-foreground)" }}>
                        Google-selected gallery images are shown here until you upload manual replacements.
                      </div>
                    ) : null}
                    <input ref={galleryInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) void onUploadGallery(files); e.currentTarget.value = ""; }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {effectiveGalleryItems.map((item, idx) => (
                        <div key={`${item.url}-${idx}`} style={{ position: "relative", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
                          <img src={item.url} alt={`Gallery ${idx + 1}`} style={{ width: "100%", height: 96, objectFit: "cover" }} />
                          {item.source === "manual" ? (
                            <button
                              style={{ position: "absolute", top: 4, right: 4, width: 28, height: 28, borderRadius: 6, border: "none", backgroundColor: "rgba(239,68,68,0.9)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                              onClick={() => setGalleryItems((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 size={12} />
                            </button>
                          ) : null}
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, MAX_GALLERY_IMAGES - effectiveGalleryItems.length) }).map((_, idx) => (
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

                {/* ─── AI Call Agent Qualification ─────────────────────────── */}
                <div style={{ marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 28 }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 18 }}>🤖</span>
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>AI Call Agent Qualification</h4>
                        {/* Status badge */}
                        {aiQualStatus === "QUALIFIED" && (
                          <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>QUALIFIED</span>
                        )}
                        {aiQualStatus === "NEEDS_REVIEW" && (
                          <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "rgba(234,179,8,0.15)", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)" }}>NEEDS REVIEW</span>
                        )}
                        {aiQualStatus === "NOT_QUALIFIED" && (
                          <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>NOT QUALIFIED</span>
                        )}
                        {aiQualStatus === "IN_REVIEW" && (
                          <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>IN REVIEW</span>
                        )}
                        {aiQualStatus === "NOT_STARTED" && (
                          <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "rgba(148,163,184,0.1)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>NOT STARTED</span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                        Complete this questionnaire to determine if your venue is a good fit for an AI call agent to handle reservations, watch-party questions, and FAQs.
                      </p>
                    </div>
                    {aiQuestionnaireLink && (
                      <a href={aiQuestionnaireLink} target="_blank" rel="noopener noreferrer" style={{ ...btnOutline(), textDecoration: "none", fontSize: 12 }}>
                        Open questionnaire →
                      </a>
                    )}
                  </div>

                  {/* Q1: Is venue active? */}
                  <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}>
                    <label style={{ ...labelStyle, marginBottom: 10 }}>1. Is this venue currently open and actively serving customers?</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[{ v: true, label: "Yes" }, { v: false, label: "No" }].map(({ v, label }) => (
                        <button key={label} type="button"
                          style={{ padding: "6px 18px", borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid", transition: "all .14s",
                            background: aiIsActive === v ? "var(--primary)" : "transparent",
                            color: aiIsActive === v ? "var(--primary-foreground)" : "var(--muted-foreground)",
                            borderColor: aiIsActive === v ? "var(--primary)" : "var(--border)" }}
                          onClick={() => setAiIsActive(v)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Q2: Receives calls? */}
                  <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}>
                    <label style={{ ...labelStyle, marginBottom: 10 }}>2. Does this venue receive customer phone calls regularly?</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[{ v: true, label: "Yes" }, { v: false, label: "No" }].map(({ v, label }) => (
                        <button key={label} type="button"
                          style={{ padding: "6px 18px", borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid", transition: "all .14s",
                            background: aiReceivesCalls === v ? "var(--primary)" : "transparent",
                            color: aiReceivesCalls === v ? "var(--primary-foreground)" : "var(--muted-foreground)",
                            borderColor: aiReceivesCalls === v ? "var(--primary)" : "var(--border)" }}
                          onClick={() => setAiReceivesCalls(v)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Q3: Use cases */}
                  <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}>
                    <label style={{ ...labelStyle, marginBottom: 10 }}>3. What types of calls should the AI handle? (select all that apply)</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {AI_USE_CASES.map(({ value, label }) => {
                        const checked = aiQualifiedFor.includes(value);
                        return (
                          <button key={value} type="button"
                            style={{ padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", transition: "all .14s",
                              background: checked ? "rgba(var(--primary-rgb,34,197,94),0.15)" : "transparent",
                              color: checked ? "var(--primary)" : "var(--muted-foreground)",
                              borderColor: checked ? "var(--primary)" : "var(--border)" }}
                            onClick={() => toggleAiUseCase(value)}>
                            {checked ? "✓ " : ""}{label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Q4: Accept reservations? */}
                  <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}>
                    <label style={{ ...labelStyle, marginBottom: 10 }}>4. Does the venue currently accept reservations?</label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {[{ v: "yes" as const, label: "Yes" }, { v: "no" as const, label: "No" }, { v: "groups" as const, label: "Only for large groups" }].map(({ v, label }) => (
                        <button key={v} type="button"
                          style={{ padding: "6px 16px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", transition: "all .14s",
                            background: aiAcceptsReservations === v ? "var(--primary)" : "transparent",
                            color: aiAcceptsReservations === v ? "var(--primary-foreground)" : "var(--muted-foreground)",
                            borderColor: aiAcceptsReservations === v ? "var(--primary)" : "var(--border)" }}
                          onClick={() => setAiAcceptsReservations(v)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Q5: Reservation handling mode */}
                  <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}>
                    <label style={{ ...labelStyle, marginBottom: 10 }}>5. Reservation Handling Mode — how should the AI handle reservation calls?</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { v: "NONE" as const, label: "Do not handle reservations" },
                        { v: "ANSWER_ONLY" as const, label: "Answer reservation questions only" },
                        { v: "COLLECT_REQUEST" as const, label: "Collect reservation request and notify staff" },
                        { v: "FULL_INTAKE" as const, label: "Full reservation intake" },
                        { v: "TRANSFER_TO_STAFF" as const, label: "Transfer reservation calls to staff" },
                      ].map(({ v, label }) => (
                        <label key={v} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "var(--foreground)" }}>
                          <input type="radio" name="aiReservationMode" value={v} checked={aiReservationMode === v} onChange={() => setAiReservationMode(v)}
                            style={{ accentColor: "var(--primary)", width: 15, height: 15 }} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Q6: Hours/policies ready? */}
                  <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}>
                    <label style={{ ...labelStyle, marginBottom: 10 }}>6. Are business hours, policies, and event details ready for the AI?</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[{ v: true, label: "Yes" }, { v: false, label: "No" }].map(({ v, label }) => (
                        <button key={label} type="button"
                          style={{ padding: "6px 18px", borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid", transition: "all .14s",
                            background: aiHoursReady === v ? "var(--primary)" : "transparent",
                            color: aiHoursReady === v ? "var(--primary-foreground)" : "var(--muted-foreground)",
                            borderColor: aiHoursReady === v ? "var(--primary)" : "var(--border)" }}
                          onClick={() => setAiHoursReady(v)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Q7: Escalation contact? */}
                  <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}>
                    <label style={{ ...labelStyle, marginBottom: 10 }}>7. Is there a human escalation contact for urgent or missed-call cases?</label>
                    <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                      {[{ v: true, label: "Yes" }, { v: false, label: "No" }].map(({ v, label }) => (
                        <button key={label} type="button"
                          style={{ padding: "6px 18px", borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid", transition: "all .14s",
                            background: aiHasEscalation === v ? "var(--primary)" : "transparent",
                            color: aiHasEscalation === v ? "var(--primary-foreground)" : "var(--muted-foreground)",
                            borderColor: aiHasEscalation === v ? "var(--primary)" : "var(--border)" }}
                          onClick={() => setAiHasEscalation(v)}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {aiHasEscalation && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                        <div>
                          <label style={labelStyle}>Contact name</label>
                          <input value={aiEscalationName} onChange={(e) => setAiEscalationName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Contact phone</label>
                          <input value={aiEscalationPhone} onChange={(e) => setAiEscalationPhone(e.target.value)} placeholder="+1 (713) 000-0000" style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Contact email</label>
                          <input type="email" value={aiEscalationEmail} onChange={(e) => setAiEscalationEmail(e.target.value)} placeholder="manager@venue.com" style={inputStyle} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Q8: Multilingual? */}
                  <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}>
                    <label style={{ ...labelStyle, marginBottom: 10 }}>8. Does the venue want multilingual support?</label>
                    <div style={{ display: "flex", gap: 10, marginBottom: aiWantsMultilingual ? 12 : 0 }}>
                      {[{ v: true, label: "Yes" }, { v: false, label: "No" }].map(({ v, label }) => (
                        <button key={label} type="button"
                          style={{ padding: "6px 18px", borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid", transition: "all .14s",
                            background: aiWantsMultilingual === v ? "var(--primary)" : "transparent",
                            color: aiWantsMultilingual === v ? "var(--primary-foreground)" : "var(--muted-foreground)",
                            borderColor: aiWantsMultilingual === v ? "var(--primary)" : "var(--border)" }}
                          onClick={() => setAiWantsMultilingual(v)}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {aiWantsMultilingual && (
                      <div>
                        <label style={labelStyle}>Languages (press Enter to add)</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <input value={aiLanguageInput} onChange={(e) => setAiLanguageInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAiLanguage(); } }}
                            placeholder="e.g. Spanish, Arabic, French" style={{ ...inputStyle, flex: 1 }} />
                          <button type="button" style={btnOutline()} onClick={addAiLanguage}>Add</button>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {aiLanguages.map((lang) => (
                            <span key={lang} style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, background: "rgba(var(--primary-rgb,34,197,94),0.1)", color: "var(--primary)", border: "1px solid rgba(var(--primary-rgb,34,197,94),0.25)", display: "flex", alignItems: "center", gap: 6 }}>
                              {lang}
                              <button type="button" onClick={() => setAiLanguages((prev) => prev.filter((l) => l !== lang))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}>×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Q9: Go-live readiness */}
                  <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}>
                    <label style={{ ...labelStyle, marginBottom: 10 }}>9. Is the venue ready to go live with an AI call agent?</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {[
                        { v: "READY_NOW" as const, label: "Ready now" },
                        { v: "READY_IN_7_DAYS" as const, label: "Ready in 7 days" },
                        { v: "READY_IN_14_DAYS" as const, label: "Ready in 14 days" },
                        { v: "NOT_READY" as const, label: "Not ready" },
                      ].map(({ v, label }) => (
                        <button key={v} type="button"
                          style={{ padding: "6px 16px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", transition: "all .14s",
                            background: aiGoLive === v ? "var(--primary)" : "transparent",
                            color: aiGoLive === v ? "var(--primary-foreground)" : "var(--muted-foreground)",
                            borderColor: aiGoLive === v ? "var(--primary)" : "var(--border)" }}
                          onClick={() => setAiGoLive(v)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Additional notes + questionnaire link */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 20 }}>
                    <div>
                      <label style={labelStyle}>Internal notes (optional)</label>
                      <textarea value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} rows={3} placeholder="Any additional context for setup…" style={{ ...inputStyle, height: "auto", resize: "vertical" }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Questionnaire link (optional)</label>
                      <input value={aiQuestionnaireLink} onChange={(e) => setAiQuestionnaireLink(e.target.value)} placeholder="https://…" style={inputStyle} />
                    </div>
                  </div>

                  {/* Computed status preview */}
                  {aiIsActive !== null && aiReceivesCalls !== null && aiQualifiedFor.length > 0 && (
                    <div style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 16, background: "var(--card)", fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: "var(--foreground)" }}>Computed status: </span>
                      {(() => {
                        const s = computeAiQualStatus();
                        const color = s === "QUALIFIED" ? "#22c55e" : s === "NEEDS_REVIEW" ? "#eab308" : s === "NOT_QUALIFIED" ? "#ef4444" : "var(--muted-foreground)";
                        return <span style={{ color, fontWeight: 700 }}>{s.replace(/_/g, " ")}</span>;
                      })()}
                      {aiQualifiedFor.length > 0 && (
                        <span style={{ color: "var(--muted-foreground)", marginLeft: 8 }}>
                          · {aiQualifiedFor.map((v) => AI_USE_CASES.find((c) => c.value === v)?.label || v).join(", ")}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button style={btnPrimary(savingAiQual)} disabled={savingAiQual} onClick={() => void saveAiQualification()}>
                      {savingAiQual ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving</> : <><Save size={14} /> Save Qualification</>}
                    </button>
                    <button
                      style={{
                        ...btnOutline(),
                        opacity: (aiQualStatus === "QUALIFIED" || aiQualStatus === "NEEDS_REVIEW") ? 1 : 0.4,
                        cursor: (aiQualStatus === "QUALIFIED" || aiQualStatus === "NEEDS_REVIEW") ? "pointer" : "not-allowed",
                      }}
                      disabled={aiQualStatus !== "QUALIFIED" && aiQualStatus !== "NEEDS_REVIEW"}
                      onClick={() => window.open("https://foreva.ai/", "_blank")}
                    >
                      Continue to Agent Setup →
                    </button>
                    {aiQualStatus === "NEEDS_REVIEW" && (
                      <span style={{ fontSize: 12, color: "#eab308" }}>⚠ Some information is missing — review before launching.</span>
                    )}
                    {aiQualStatus === "NOT_QUALIFIED" && (
                      <span style={{ fontSize: 12, color: "#ef4444" }}>✗ Venue does not qualify yet — answer all questions to proceed.</span>
                    )}
                  </div>
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
