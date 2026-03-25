"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Building2, CircleAlert, ExternalLink, RefreshCcw } from "lucide-react";
import { AppShell } from "../../../components/AppShell";
import { GooglePlacePicker } from "../../../components/GooglePlacePicker";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { useAuth } from "../../../lib/auth-context";
import type { ExistingVenueMatch, GooglePlaceDetailsResponse, GooglePlaceSnapshot } from "../../../lib/api";

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

export default function VenueRegisterPage() {
  const router = useRouter();
  const { registerVenue, login } = useAuth();

  const [ownerName, setOwnerName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [ownerPassword, setOwnerPassword] = React.useState("");
  const [venueForm, setVenueForm] = React.useState<VenueFormState>({
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
  });
  const [googleDefaults, setGoogleDefaults] = React.useState<GooglePlaceSnapshot | null>(null);
  const [existingVenue, setExistingVenue] = React.useState<ExistingVenueMatch | null>(null);
  const [claimMode, setClaimMode] = React.useState(false);
  const [claimNotes, setClaimNotes] = React.useState("");
  const [claimDocs, setClaimDocs] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const handlePlaceResolved = React.useCallback((details: GooglePlaceDetailsResponse) => {
    setGoogleDefaults(details.defaults);
    setVenueForm((prev) => ({
      ...prev,
      ...mapGoogleDefaultsToVenue(details.defaults),
    }));
    setExistingVenue(details.existingVenue || null);
    setClaimMode(Boolean(details.existingVenue));
    setFormError(null);
  }, []);

  const resetToGoogleDefaults = React.useCallback(() => {
    if (!googleDefaults) return;
    setVenueForm((prev) => ({
      ...prev,
      ...mapGoogleDefaultsToVenue(googleDefaults),
    }));
  }, [googleDefaults]);

  const parsedClaimDocs = React.useMemo(
    () =>
      claimDocs
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    [claimDocs],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!googleDefaults) {
      setFormError("Search and select the venue from Google before submitting.");
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
      const response = await registerVenue({
        email: normalizedEmail,
        password: ownerPassword,
        name: ownerName.trim(),
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
                amenities: [],
                vibes: [],
                cuisineTags: [],
              },
            }),
      });

      setSuccessMessage(response.message);
      await login(normalizedEmail, ownerPassword);
      router.push("/admin");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Venue registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <Badge variant="secondary" className="mb-2 gap-1">
              <Building2 className="h-3.5 w-3.5" />
              Venue onboarding
            </Badge>
            <h1 className="font-display text-3xl text-[var(--foreground)] md:text-4xl">Register Your Business Venue</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)] md:text-base">
              Search the venue from Google, review the defaults, adjust the editable business details, and submit for admin approval.
            </p>
          </div>
          <Link href="/login" className="text-sm text-[var(--primary)]">
            Back to login
          </Link>
        </div>

        {formError ? (
          <Alert variant="destructive" className="mb-4">
            <CircleAlert className="h-4 w-4" />
            <AlertTitle>Registration blocked</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        {successMessage ? (
          <Alert className="mb-4 border-emerald-400/40 bg-emerald-500/10 text-emerald-700">
            <BadgeCheck className="h-4 w-4" />
            <AlertTitle>Submitted</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-6">
          <Card className="border-[var(--border)]/70 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Owner account</CardTitle>
              <CardDescription>This account stays pending until admin approves the business profile.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="owner-name">Owner name</Label>
                <Input id="owner-name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-email">Email</Label>
                <Input id="owner-email" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-password">Password</Label>
                <Input id="owner-password" type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required />
              </div>
            </CardContent>
          </Card>

          <GooglePlacePicker
            initialPlaceId={venueForm.googlePlaceId}
            onPlaceResolved={handlePlaceResolved}
          />

          {existingVenue ? (
            <Alert className="border-amber-400/30 bg-amber-500/10 text-amber-700">
              <CircleAlert className="h-4 w-4" />
              <AlertTitle>This venue already exists. Own this business? Claim it now!</AlertTitle>
              <AlertDescription>
                <div className="flex flex-wrap items-center gap-2">
                  <span>{existingVenue.name} in {existingVenue.city}</span>
                  <Link href={`/venues/${existingVenue.slug}`} className="inline-flex items-center gap-1 font-semibold underline">
                    View venue
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="border-[var(--border)]/70 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{claimMode ? "Claim request" : "Venue defaults and editable profile"}</CardTitle>
                <CardDescription>
                  {claimMode
                    ? "This venue is already on MatchWatch. Submit proof and admin will review the claim."
                    : "Ratings and review counts come from Google. Contact and location fields are preloaded and can be adjusted."}
                </CardDescription>
              </div>
              {googleDefaults ? (
                <Button type="button" variant="outline" onClick={resetToGoogleDefaults}>
                  <RefreshCcw className="h-4 w-4" />
                  Revert to Google defaults
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-5">
              {googleDefaults ? (
                <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 md:grid-cols-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Google rating</div>
                    <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{googleDefaults.rating ?? "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Google reviews</div>
                    <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{googleDefaults.reviewCount ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Menu</div>
                    <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
                      {googleDefaults.menu?.sections?.length || googleDefaults.menu?.url ? "Imported from Google" : "Not available from Google"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Google Place ID</div>
                    <div className="mt-1 break-all text-xs text-[var(--foreground)]">{googleDefaults.placeId}</div>
                  </div>
                </div>
              ) : null}

              {existingVenue ? (
                <div className="flex gap-3">
                  <Button type="button" variant={claimMode ? "default" : "outline"} onClick={() => setClaimMode(true)}>
                    Claim this venue
                  </Button>
                  <Button type="button" variant={!claimMode ? "default" : "outline"} onClick={() => setClaimMode(false)}>
                    Submit as new venue
                  </Button>
                </div>
              ) : null}

              {claimMode ? (
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="claim-notes">Claim notes</Label>
                    <Textarea
                      id="claim-notes"
                      value={claimNotes}
                      onChange={(e) => setClaimNotes(e.target.value)}
                      placeholder="Explain your relationship to the venue and what proof you can provide."
                      rows={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claim-docs">Verification document URLs</Label>
                    <Textarea
                      id="claim-docs"
                      value={claimDocs}
                      onChange={(e) => setClaimDocs(e.target.value)}
                      placeholder="One URL per line"
                      rows={4}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="venue-name">Venue name</Label>
                    <Input id="venue-name" value={venueForm.name} onChange={(e) => setVenueForm((prev) => ({ ...prev, name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-phone">Phone</Label>
                    <Input id="venue-phone" value={venueForm.phone} onChange={(e) => setVenueForm((prev) => ({ ...prev, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="venue-address">Address</Label>
                    <Input id="venue-address" value={venueForm.address} onChange={(e) => setVenueForm((prev) => ({ ...prev, address: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-city">City</Label>
                    <Input id="venue-city" value={venueForm.city} onChange={(e) => setVenueForm((prev) => ({ ...prev, city: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-state">State / province</Label>
                    <Input id="venue-state" value={venueForm.stateProvince} onChange={(e) => setVenueForm((prev) => ({ ...prev, stateProvince: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-country">Country</Label>
                    <Input id="venue-country" value={venueForm.country} onChange={(e) => setVenueForm((prev) => ({ ...prev, country: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-postal">Postal code</Label>
                    <Input id="venue-postal" value={venueForm.postalCode} onChange={(e) => setVenueForm((prev) => ({ ...prev, postalCode: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-lat">Latitude</Label>
                    <Input id="venue-lat" value={venueForm.lat} onChange={(e) => setVenueForm((prev) => ({ ...prev, lat: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-lng">Longitude</Label>
                    <Input id="venue-lng" value={venueForm.lng} onChange={(e) => setVenueForm((prev) => ({ ...prev, lng: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-timezone">Timezone</Label>
                    <Input id="venue-timezone" value={venueForm.timezone} onChange={(e) => setVenueForm((prev) => ({ ...prev, timezone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-capacity">Capacity</Label>
                    <Input id="venue-capacity" type="number" value={venueForm.capacity} onChange={(e) => setVenueForm((prev) => ({ ...prev, capacity: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-website">Website</Label>
                    <Input id="venue-website" value={venueForm.website} onChange={(e) => setVenueForm((prev) => ({ ...prev, website: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-maps">Google Maps URL</Label>
                    <Input id="venue-maps" value={venueForm.googleMapsUrl} onChange={(e) => setVenueForm((prev) => ({ ...prev, googleMapsUrl: e.target.value }))} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="venue-short">Short description</Label>
                    <Textarea id="venue-short" rows={2} value={venueForm.shortDescription} onChange={(e) => setVenueForm((prev) => ({ ...prev, shortDescription: e.target.value }))} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="venue-description">Business description</Label>
                    <Textarea id="venue-description" rows={5} value={venueForm.description} onChange={(e) => setVenueForm((prev) => ({ ...prev, description: e.target.value }))} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" asChild>
              <Link href="/for-venues">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : claimMode ? "Submit claim" : "Submit for approval"}
            </Button>
          </div>
        </form>
      </main>
    </AppShell>
  );
}
