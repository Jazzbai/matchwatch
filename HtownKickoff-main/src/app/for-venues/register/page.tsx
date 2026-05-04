"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CircleAlert,
  ExternalLink,
  RefreshCcw,
  MapPin,
  Check,
} from "lucide-react";
import { AppShell } from "../../../components/AppShell";
import { GooglePlacePicker } from "../../../components/GooglePlacePicker";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { useAuth } from "../../../lib/auth-context";
import type {
  ExistingVenueMatch,
  GooglePlaceDetailsResponse,
  GooglePlaceSnapshot,
} from "../../../lib/api";
import { executeRecaptcha, isRecaptchaEnabled } from "../../../lib/recaptcha";

type PriceRange = "BUDGET" | "MID" | "UPSCALE" | "LUXURY";

type VenueFormState = {
  googlePlaceId: string;
  name: string;
  address: string;
  city: string;
  stateProvince: string;
  country: string;
  postalCode: string;
  lat: string;
  lng: string;
  timezone: string;
  phone: string;
  website: string;
  googleMapsUrl: string;
  description: string;
  shortDescription: string;
  capacity: string;
  priceRange: PriceRange;
};

const SPORTS = [
  { id: "SOCCER", label: "Soccer", emoji: "⚽" },
  { id: "BASKETBALL", label: "NBA", emoji: "🏀" },
  { id: "AMERICAN_FOOTBALL", label: "NFL", emoji: "🏈" },
  { id: "BASEBALL", label: "MLB", emoji: "⚾" },
  { id: "F1", label: "F1", emoji: "🏎️" },
  { id: "RUGBY", label: "Rugby", emoji: "🏉" },
  { id: "TENNIS", label: "Tennis", emoji: "🎾" },
  { id: "CRICKET", label: "Cricket", emoji: "🏏" },
];

const VIBES = [
  "Family Friendly",
  "Sports Bar",
  "Rooftop",
  "Outdoor Patio",
  "VIP Section",
  "Late Night",
  "Craft Beer",
  "Full Kitchen",
  "Live Music",
  "College Crowd",
  "Happy Hour",
  "Game Nights",
];

const AMENITIES_LIST = [
  { id: "TV", label: "Multiple TVs" },
  { id: "PROJECTOR", label: "Big Screen / Projector" },
  { id: "SOUND_SYSTEM", label: "Sound System" },
  { id: "HOOKAH", label: "Hookah / Shisha" },
  { id: "OUTDOOR", label: "Outdoor Seating" },
  { id: "VIP", label: "VIP Section" },
  { id: "WIFI", label: "WiFi" },
  { id: "PARKING", label: "Parking" },
  { id: "SMOKE_FREE", label: "Smoke Free" },
  { id: "ALCOHOLIC", label: "Bar Service" },
];

const PRICE_OPTIONS: { value: PriceRange; label: string; symbol: string }[] = [
  { value: "BUDGET", label: "Budget", symbol: "$" },
  { value: "MID", label: "Mid-range", symbol: "$$" },
  { value: "UPSCALE", label: "Upscale", symbol: "$$$" },
  { value: "LUXURY", label: "Luxury", symbol: "$$$$" },
];

const STEPS = ["Account", "Venue", "Sports & Vibe", "Go Live"];

function mapGoogleDefaultsToVenue(snapshot: GooglePlaceSnapshot): VenueFormState {
  return {
    googlePlaceId: snapshot.placeId,
    name: snapshot.displayName || "",
    address: snapshot.addressLine1 || snapshot.formattedAddress || "",
    city: snapshot.city || "",
    stateProvince: snapshot.stateProvince || "",
    country: snapshot.country || "",
    postalCode: snapshot.postalCode || "",
    lat: snapshot.lat == null ? "" : String(snapshot.lat),
    lng: snapshot.lng == null ? "" : String(snapshot.lng),
    timezone: snapshot.timezone || "America/Chicago",
    phone: snapshot.phone || "",
    website: snapshot.website || "",
    googleMapsUrl: snapshot.googleMapsUrl || "",
    description: "",
    shortDescription: "",
    capacity: "",
    priceRange: "MID",
  };
}

const EMPTY_FORM: VenueFormState = {
  googlePlaceId: "",
  name: "",
  address: "",
  city: "",
  stateProvince: "",
  country: "",
  postalCode: "",
  lat: "",
  lng: "",
  timezone: "America/Chicago",
  phone: "",
  website: "",
  googleMapsUrl: "",
  description: "",
  shortDescription: "",
  capacity: "",
  priceRange: "MID",
};

export default function VenueRegisterPage() {
  const router = useRouter();
  const { registerVenue, login } = useAuth();
  const recaptchaEnabled = isRecaptchaEnabled();

  const [ownerName, setOwnerName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [ownerPassword, setOwnerPassword] = React.useState("");
  const [venueForm, setVenueForm] = React.useState<VenueFormState>(EMPTY_FORM);
  const [googleDefaults, setGoogleDefaults] = React.useState<GooglePlaceSnapshot | null>(null);
  const [existingVenue, setExistingVenue] = React.useState<ExistingVenueMatch | null>(null);
  const [claimMode, setClaimMode] = React.useState(false);
  const [claimNotes, setClaimNotes] = React.useState("");
  const [claimDocs, setClaimDocs] = React.useState("");
  const [selectedSports, setSelectedSports] = React.useState<string[]>(["SOCCER"]);
  const [selectedVibes, setSelectedVibes] = React.useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const activeStep = React.useMemo(() => {
    if (googleDefaults && selectedSports.length > 0) return 3;
    if (googleDefaults) return 2;
    if (ownerName || ownerEmail || ownerPassword) return 1;
    return 0;
  }, [ownerName, ownerEmail, ownerPassword, googleDefaults, selectedSports]);

  const handlePlaceResolved = React.useCallback((details: GooglePlaceDetailsResponse) => {
    setGoogleDefaults(details.defaults);
    setVenueForm((prev) => ({ ...prev, ...mapGoogleDefaultsToVenue(details.defaults) }));
    setExistingVenue(details.existingVenue || null);
    setClaimMode(Boolean(details.existingVenue));
    setFormError(null);
  }, []);

  const resetToGoogleDefaults = React.useCallback(() => {
    if (!googleDefaults) return;
    setVenueForm((prev) => ({ ...prev, ...mapGoogleDefaultsToVenue(googleDefaults) }));
  }, [googleDefaults]);

  const parsedClaimDocs = React.useMemo(
    () => claimDocs.split("\n").map((v) => v.trim()).filter(Boolean),
    [claimDocs],
  );

  const set = (field: keyof VenueFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setVenueForm((prev) => ({ ...prev, [field]: e.target.value }));

  const toggleSport = (id: string) =>
    setSelectedSports((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const toggleVibe = (v: string) =>
    setSelectedVibes((prev) =>
      prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v]
    );

  const toggleAmenity = (id: string) =>
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    if (!googleDefaults) {
      setFormError("Search and select your venue from Google first.");
      return;
    }
    if (!ownerName.trim() || !ownerEmail.trim() || !ownerPassword) {
      setFormError("Owner name, email, and password are required.");
      return;
    }
    if (!claimMode && (!venueForm.name.trim() || !venueForm.address.trim() || !venueForm.city.trim() || !venueForm.country.trim())) {
      setFormError("Venue name, address, city, and country are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const normalizedEmail = ownerEmail.trim().toLowerCase();
      const registerCaptchaToken = await executeRecaptcha("register_venue");
      const response = await registerVenue({
        email: normalizedEmail,
        password: ownerPassword,
        name: ownerName.trim(),
        captchaToken: registerCaptchaToken,
        ...(claimMode && existingVenue
          ? {
              claimVenueId: existingVenue.id,
              claimNotes: claimNotes.trim() || undefined,
              claimVerificationDocuments: parsedClaimDocs,
            }
          : {
              venue: {
                googlePlaceId: venueForm.googlePlaceId,
                name: venueForm.name.trim(),
                address: venueForm.address.trim(),
                city: venueForm.city.trim(),
                country: venueForm.country.trim(),
                lat: Number(venueForm.lat),
                lng: Number(venueForm.lng),
                timezone: venueForm.timezone.trim() || "America/Chicago",
                phone: venueForm.phone.trim() || undefined,
                description: venueForm.description.trim() || undefined,
                shortDescription: venueForm.shortDescription.trim() || undefined,
                priceRange: venueForm.priceRange,
                capacity: venueForm.capacity ? Number(venueForm.capacity) : undefined,
                amenities: selectedAmenities,
                vibes: selectedVibes,
                cuisineTags: [],
              }),
          }),
      });
      setSuccessMessage(response.message);
      const loginCaptchaToken = await executeRecaptcha("login");
      await login(normalizedEmail, ownerPassword, loginCaptchaToken);
      router.push("/admin");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Venue registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };