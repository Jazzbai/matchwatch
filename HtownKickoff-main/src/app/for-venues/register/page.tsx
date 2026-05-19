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
  const [voiceAgent, setVoiceAgent] = React.useState(true);
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
              },
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

  const inputCls =
    "h-11 rounded-lg border-[var(--border)] bg-[var(--secondary)] px-4 text-sm text-[var(--foreground)] shadow-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]";
  const labelCls =
    "text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]";

  const previewSports = SPORTS.filter((s) => selectedSports.includes(s.id));
  const previewPriceSymbol = PRICE_OPTIONS.find((p) => p.value === venueForm.priceRange)?.symbol || "$$";

  return (
    <AppShell>
      <div
        className="venue-register-page"
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "8px 20px 80px",
          ["--primary" as string]: "oklch(0.72 0.19 28)",
          ["--primary-foreground" as string]: "oklch(0.99 0 0)",
        }}
      >

        <nav className="venue-register-crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/for-venues">For venues</Link>
          <span>/</span>
          <b>Register your venue</b>
        </nav>

        {/* ── HERO ── */}
        <div style={{ marginBottom: 44 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 14px", borderRadius: 999, marginBottom: 18,
            background: "color-mix(in oklch, var(--primary) 12%, transparent)",
            border: "1px solid color-mix(in oklch, var(--primary) 30%, transparent)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              For sports bars, pubs and restaurants
            </span>
          </div>

          <h1 style={{
            fontFamily: "var(--font-display), sans-serif",
            fontWeight: 900,
            fontSize: "clamp(30px, 5vw, 54px)",
            lineHeight: 1.06,
            letterSpacing: "-0.03em",
            color: "var(--foreground)",
            marginBottom: 14,
          }}>
            Pack your bar.<br />
            <span style={{ color: "var(--primary)" }}>Every match night.</span>
          </h1>

          <p style={{ fontSize: 16, color: "var(--muted-foreground)", lineHeight: 1.65, maxWidth: 500, marginBottom: 28 }}>
            List your venue on MatchWatch and get discovered by fans planning where to watch the next match. Free to list, with an optional AI receptionist for high-demand nights.
          </p>

          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-end" }}>
            {[
              { value: "+38%", label: "avg cover lift on match nights" },
              { value: "$0", label: "listing cost, forever" },
              { value: "2,400+", label: "venues onboard" },
            ].map((stat) => (
              <div key={stat.value} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontFamily: "var(--font-display), monospace",
                  fontWeight: 900, fontSize: 30,
                  color: "var(--primary)", letterSpacing: "-0.02em", lineHeight: 1,
                }}>{stat.value}</span>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)", maxWidth: 110, lineHeight: 1.35 }}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── STEP INDICATOR ── */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 40, overflowX: "auto", paddingBottom: 2 }}>
          {STEPS.map((step, i) => {
            const done = i < activeStep;
            const current = i === activeStep;
            return (
              <React.Fragment key={step}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "7px 14px", borderRadius: 999, flexShrink: 0,
                  background: current ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "transparent",
                  border: current ? "1px solid color-mix(in oklch, var(--primary) 30%, transparent)" : "1px solid transparent",
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, flexShrink: 0,
                    background: done || current ? "var(--primary)" : "var(--secondary)",
                    color: done || current ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  }}>
                    {done ? <Check size={12} /> : i + 1}
                  </div>
                  <span style={{
                    fontSize: 13, whiteSpace: "nowrap",
                    fontWeight: current ? 700 : 500,
                    color: current ? "var(--foreground)" : "var(--muted-foreground)",
                  }}>
                    {step}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    flex: 1, height: 1, minWidth: 12, maxWidth: 56,
                    background: i < activeStep ? "var(--primary)" : "var(--border)",
                    transition: "background 0.3s",
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── ALERTS ── */}
        {formError && (
          <Alert variant="destructive" className="mb-6">
            <CircleAlert className="h-4 w-4" />
            <AlertTitle>Couldn&apos;t submit</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        {successMessage && (
          <Alert className="mb-6 border-emerald-400/40 bg-emerald-500/10 text-emerald-700">
            <BadgeCheck className="h-4 w-4" />
            <AlertTitle>Submitted for review</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* ── 2-COL LAYOUT ── */}
        <div className="grid lg:grid-cols-[1fr_356px]" style={{ gap: 28, alignItems: "start" }}>

          {/* ── FORM COLUMN ── */}
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20 }}>

            {/* STEP 1: Owner account */}
            <SectionCard num="01" title="Owner account" subtitle="Your login credentials for the venue dashboard">
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label htmlFor="owner-name" className={labelCls}>Full name</label>
                  <Input id="owner-name" className={inputCls} placeholder="Jane Smith" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <label htmlFor="owner-email" className={labelCls}>Email address</label>
                  <Input id="owner-email" type="email" className={inputCls} placeholder="jane@myvenue.com" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <label htmlFor="owner-password" className={labelCls}>Password</label>
                  <Input id="owner-password" type="password" className={inputCls} placeholder="Min. 8 characters" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required />
                </div>
              </div>
            </SectionCard>

            {/* STEP 2: Find venue */}
            <SectionCard num="02" title="Find your venue" subtitle="We pull address, phone & ratings from Google automatically">
              <GooglePlacePicker
                buttonClassName="h-10 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--secondary)] inline-flex items-center gap-2"
                inputClassName={inputCls}
                initialPlaceId={venueForm.googlePlaceId}
                variant="archive"
                onPlaceResolved={handlePlaceResolved}
              />
              {googleDefaults && (
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", marginTop: 16 }}>
                  {[
                    { label: "Google rating", value: googleDefaults.rating ?? "—" },
                    { label: "Reviews", value: googleDefaults.reviewCount ?? 0 },
                    { label: "Menu", value: googleDefaults.menu?.categories?.length || googleDefaults.menu?.sourceUrl ? "Available" : "N/A" },
                  ].map((item) => (
                    <div key={item.label} style={{ background: "var(--secondary)", borderRadius: 12, padding: "10px 14px" }}>
                      <div className={labelCls} style={{ marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)" }}>{String(item.value)}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Existing venue alert */}
            {existingVenue && (
              <Alert className="border-amber-400/30 bg-amber-500/10 text-amber-700">
                <CircleAlert className="h-4 w-4" />
                <AlertTitle>This venue is already on MatchWatch</AlertTitle>
                <AlertDescription>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span>{existingVenue.name} · {existingVenue.city}</span>
                    <Link href={`/venues/${existingVenue.slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, textDecoration: "underline" }}>
                      View venue <ExternalLink style={{ width: 12, height: 12 }} />
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* STEP 3: Venue details */}
            {googleDefaults && (
              <SectionCard
                num="03"
                title={claimMode ? "Claim this venue" : "Venue details"}
                subtitle={claimMode ? "Submit proof of ownership for admin review" : "Review and edit the prefilled details from Google"}
                actions={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {existingVenue && (
                      <>
                        <TabBtn active={claimMode} onClick={() => setClaimMode(true)}>Claim venue</TabBtn>
                        <TabBtn active={!claimMode} onClick={() => setClaimMode(false)}>Add new</TabBtn>
                      </>
                    )}
                    {!claimMode && (
                      <button type="button" onClick={resetToGoogleDefaults} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                        <RefreshCcw style={{ width: 12, height: 12 }} /> Reset
                      </button>
                    )}
                  </div>
                }
              >
                {claimMode ? (
                  <div style={{ display: "grid", gap: 16 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <label htmlFor="claim-notes" className={labelCls}>Why are you claiming this venue?</label>
                      <Textarea id="claim-notes" className="rounded-lg border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-sm text-[var(--foreground)] shadow-none" value={claimNotes} onChange={(e) => setClaimNotes(e.target.value)} placeholder="Explain your relationship to the venue and what proof you can provide." rows={4} />
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <label htmlFor="claim-docs" className={labelCls}>Verification document URLs (one per line)</label>
                      <Textarea id="claim-docs" className="rounded-lg border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-sm text-[var(--foreground)] shadow-none" value={claimDocs} onChange={(e) => setClaimDocs(e.target.value)} placeholder="https://example.com/document.pdf" rows={3} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 16 }}>
                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label htmlFor="venue-name" className={labelCls}>Venue name</label>
                        <Input id="venue-name" className={inputCls} value={venueForm.name} onChange={set("name")} required />
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label htmlFor="venue-phone" className={labelCls}>Phone number</label>
                        <Input id="venue-phone" className={inputCls} value={venueForm.phone} onChange={set("phone")} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <label htmlFor="venue-address" className={labelCls}>Street address</label>
                      <Input id="venue-address" className={inputCls} value={venueForm.address} onChange={set("address")} required />
                    </div>
                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label htmlFor="venue-city" className={labelCls}>City</label>
                        <Input id="venue-city" className={inputCls} value={venueForm.city} onChange={set("city")} required />
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label htmlFor="venue-state" className={labelCls}>State / Province</label>
                        <Input id="venue-state" className={inputCls} value={venueForm.stateProvince} onChange={set("stateProvince")} />
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label htmlFor="venue-country" className={labelCls}>Country</label>
                        <Input id="venue-country" className={inputCls} value={venueForm.country} onChange={set("country")} required />
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label htmlFor="venue-postal" className={labelCls}>Postal code</label>
                        <Input id="venue-postal" className={inputCls} value={venueForm.postalCode} onChange={set("postalCode")} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label htmlFor="venue-website" className={labelCls}>Website</label>
                        <Input id="venue-website" className={inputCls} placeholder="https://" value={venueForm.website} onChange={set("website")} />
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label htmlFor="venue-capacity" className={labelCls}>Seating capacity</label>
                        <Input id="venue-capacity" type="number" className={inputCls} placeholder="e.g. 80" value={venueForm.capacity} onChange={set("capacity")} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div className={labelCls}>Price range</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {PRICE_OPTIONS.map((opt) => (
                          <button key={opt.value} type="button" onClick={() => setVenueForm((prev) => ({ ...prev, priceRange: opt.value }))} style={{ padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: venueForm.priceRange === opt.value ? "var(--primary)" : "var(--secondary)", color: venueForm.priceRange === opt.value ? "var(--primary-foreground)" : "var(--foreground)", transition: "all 0.15s" }}>
                            {opt.symbol} · {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <label htmlFor="venue-short" className={labelCls}>Tagline <span style={{ color: "var(--muted-foreground)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(shown on venue cards)</span></label>
                      <Textarea id="venue-short" className="rounded-lg border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-sm text-[var(--foreground)] shadow-none" rows={2} placeholder="e.g. Houston's loudest soccer bar with 12 screens and cold craft beer" value={venueForm.shortDescription} onChange={set("shortDescription")} />
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <label htmlFor="venue-description" className={labelCls}>Full description <span style={{ color: "var(--muted-foreground)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                      <Textarea id="venue-description" className="rounded-lg border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-sm text-[var(--foreground)] shadow-none" rows={4} placeholder="Tell fans about your venue's atmosphere, screens, food & drinks, specials..." value={venueForm.description} onChange={set("description")} />
                    </div>
                  </div>
                )}
              </SectionCard>
            )}

            {/* STEP 4: Sports & Vibe */}
            <SectionCard num="04" title="Sports & vibe" subtitle="What do your fans watch? What's the atmosphere like?">
              <div style={{ display: "grid", gap: 24 }}>

                {/* Sports tiles */}
                <div>
                  <div className={labelCls} style={{ marginBottom: 12 }}>Sports you show</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
                    {SPORTS.map((sport) => {
                      const sel = selectedSports.includes(sport.id);
                      return (
                        <button
                          key={sport.id}
                          type="button"
                          onClick={() => toggleSport(sport.id)}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            gap: 8, padding: "16px 8px", borderRadius: 12, cursor: "pointer",
                            border: `1px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                            background: sel ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "var(--secondary)",
                            transition: "all 0.15s", position: "relative",
                          }}
                        >
                          {sel && (
                            <div style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Check size={10} color="var(--primary-foreground)" />
                            </div>
                          )}
                          <span style={{ fontSize: 26 }}>{sport.emoji}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: sel ? "var(--foreground)" : "var(--muted-foreground)" }}>{sport.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amenities chips */}
                <div>
                  <div className={labelCls} style={{ marginBottom: 12 }}>Amenities & features</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {AMENITIES_LIST.map((amenity) => {
                      const sel = selectedAmenities.includes(amenity.id);
                      return (
                        <button key={amenity.id} type="button" onClick={() => toggleAmenity(amenity.id)} style={{ padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${sel ? "var(--primary)" : "var(--border)"}`, background: sel ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "var(--secondary)", color: sel ? "var(--foreground)" : "var(--muted-foreground)", transition: "all 0.15s" }}>
                          {sel && "✓ "}{amenity.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Vibe chips */}
                <div>
                  <div className={labelCls} style={{ marginBottom: 12 }}>Vibe tags</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {VIBES.map((vibe) => {
                      const sel = selectedVibes.includes(vibe);
                      return (
                        <button key={vibe} type="button" onClick={() => toggleVibe(vibe)} style={{ padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${sel ? "var(--primary)" : "var(--border)"}`, background: sel ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "var(--secondary)", color: sel ? "var(--foreground)" : "var(--muted-foreground)", transition: "all 0.15s" }}>
                          {sel && "✓ "}{vibe}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard num="05" title="AI voice agent" subtitle="Optional. Handles reservation calls, questions, and overflow on big match nights.">
              <div className="venue-register-ai">
                <div>
                  <div className="venue-register-ai__tag">Powered by MatchWatch Voice</div>
                  <h3>Never miss a reservation. In any language. 24/7.</h3>
                  <p>
                    The AI receptionist answers in your venue&apos;s voice, books tables,
                    checks the match schedule, captures caller history, and escalates
                    anything it cannot handle to your team.
                  </p>
                  <div className="venue-register-ai__stats">
                    <span><b>32+</b> languages</span>
                    <span><b>CRM</b> included</span>
                    <span><b>24/7</b> pickup</span>
                  </div>
                </div>
                <div className="venue-register-ai__options">
                  {[
                    { active: !voiceAgent, title: "No agent", price: "Free", text: "Get listed and add the agent later from your dashboard." },
                    { active: voiceAgent, title: "Voice agent + CRM", price: "$199/mo", text: "Unlimited calls, reservations, no-show notes, and guest profiles." },
                  ].map((option) => (
                    <button
                      key={option.title}
                      type="button"
                      className={option.active ? "is-active" : ""}
                      onClick={() => setVoiceAgent(option.title !== "No agent")}
                    >
                      <span>
                        <b>{option.title}</b>
                        <em>{option.price}</em>
                      </span>
                      <small>{option.text}</small>
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* SUBMIT ROW */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 4, flexWrap: "wrap" }}>
              {recaptchaEnabled && (
                <p style={{ fontSize: 11, color: "var(--muted-foreground)", order: 3, flexBasis: "100%" }}>
                  Protected by Google reCAPTCHA.
                </p>
              )}
              <Link href="/for-venues" style={{ textDecoration: "none", padding: "10px 24px", borderRadius: 999, fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)", border: "1px solid var(--border)", background: "transparent" }}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "12px 36px", borderRadius: 999, fontSize: 14, fontWeight: 700, border: "none",
                  cursor: isSubmitting ? "not-allowed" : "pointer", minWidth: 210,
                  background: "var(--primary)", color: "var(--primary-foreground)",
                  opacity: isSubmitting ? 0.7 : 1, transition: "all 0.15s",
                }}
              >
                {isSubmitting ? "Submitting…" : claimMode ? "Submit claim" : "Submit for approval →"}
              </button>
            </div>

          </form>

          {/* ── SIDEBAR COLUMN ── */}
          <div style={{ position: "sticky", top: 108, display: "grid", gap: 16 }}>

            {/* Live preview card */}
            <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", overflow: "hidden" }}>
              <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Live Preview</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: "color-mix(in oklch, var(--primary) 10%, transparent)", border: "1px solid color-mix(in oklch, var(--primary) 25%, transparent)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)" }}>LIVE</span>
                </div>
              </div>

              <div style={{ height: 130, background: "linear-gradient(135deg, color-mix(in oklch, var(--primary) 20%, var(--secondary)) 0%, var(--secondary) 100%)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <span style={{ fontSize: 44 }}>{previewSports[0]?.emoji || "🏆"}</span>
                {previewSports.length > 1 && (
                  <span style={{ position: "absolute", bottom: 10, left: 12, fontSize: 18 }}>
                    {previewSports.slice(1, 4).map(s => s.emoji).join(" ")}
                  </span>
                )}
                {googleDefaults?.rating && (
                  <div style={{ position: "absolute", bottom: 10, right: 12, background: "rgba(0,0,0,0.65)", borderRadius: 12, padding: "3px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 12 }}>⭐</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{googleDefaults.rating}</span>
                  </div>
                )}
              </div>

              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 2 }}>
                      {venueForm.name || "Your Venue Name"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--muted-foreground)", fontSize: 12 }}>
                      <MapPin size={11} />
                      {venueForm.city || "Your City"}
                    </div>
                  </div>
                  <div style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "color-mix(in oklch, var(--primary) 12%, transparent)", color: "var(--primary)", border: "1px solid color-mix(in oklch, var(--primary) 30%, transparent)", flexShrink: 0 }}>
                    {previewPriceSymbol}
                  </div>
                </div>

                {venueForm.shortDescription ? (
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, marginBottom: 10 }}>
                    {venueForm.shortDescription.slice(0, 90)}{venueForm.shortDescription.length > 90 ? "…" : ""}
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: "color-mix(in oklch, var(--muted-foreground) 40%, transparent)", lineHeight: 1.5, marginBottom: 10, fontStyle: "italic" }}>
                    Add a tagline to see it here…
                  </p>
                )}

                {selectedAmenities.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {selectedAmenities.slice(0, 4).map((id) => {
                      const a = AMENITIES_LIST.find((x) => x.id === id);
                      return a ? (
                        <span key={id} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                          {a.label}
                        </span>
                      ) : null;
                    })}
                    {selectedAmenities.length > 4 && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                        +{selectedAmenities.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* What you get */}
            <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", padding: "18px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", marginBottom: 13 }}>What you get</div>
              {[
                { emoji: "🎯", text: "Listed on the #1 watch party platform" },
                { emoji: "📅", text: "Automatic match calendar sync" },
                { emoji: "🔔", text: "Real-time fan booking alerts" },
                { emoji: "📊", text: "Booking analytics dashboard" },
                { emoji: "💸", text: "100% free — no commission ever" },
              ].map((item) => (
                <div key={item.text} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{item.emoji}</span>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.45 }}>{item.text}</span>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div style={{ borderRadius: 12, border: "1px solid color-mix(in oklch, var(--primary) 20%, var(--border))", background: "color-mix(in oklch, var(--primary) 5%, var(--card))", padding: "18px 20px" }}>
              <div style={{ fontSize: 16, marginBottom: 10 }}>⭐⭐⭐⭐⭐</div>
              <p style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.65, marginBottom: 12, fontStyle: "italic" }}>
                &ldquo;We went from empty tables on match days to fully booked every Champions League night. MatchWatch changed our business.&rdquo;
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>🍺</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>Marco T.</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>The Fox & Hound · Austin, TX</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Sign in link */}
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <Link href="/login" style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
            Already have an account? Sign in →
          </Link>
        </div>

      </div>
    </AppShell>
  );
}

/* ── Helper sub-components ── */

function SectionCard({
  num, title, subtitle, actions, children,
}: {
  num: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: "color-mix(in oklch, var(--primary) 15%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "var(--primary)", flexShrink: 0 }}>
            {num}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>{subtitle}</div>
          </div>
        </div>
        {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
      </div>
      <div style={{ padding: "18px 22px 22px" }}>{children}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: active ? "var(--primary)" : "var(--secondary)", color: active ? "var(--primary-foreground)" : "var(--foreground)" }}>
      {children}
    </button>
  );
}
