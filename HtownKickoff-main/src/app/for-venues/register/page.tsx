"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Building2, CircleAlert, ExternalLink, RefreshCcw } from "lucide-react";
import { AppShell } from "../../../components/AppShell";
import { GooglePlacePicker } from "../../../components/GooglePlacePicker";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { useAuth } from "../../../lib/auth-context";
import type { ExistingVenueMatch, GooglePlaceDetailsResponse, GooglePlaceSnapshot } from "../../../lib/api";
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
  const recaptchaEnabled = isRecaptchaEnabled();

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

  const fieldClassName = "h-11 rounded-xl border-[var(--border)] bg-[var(--secondary)] px-4 text-sm text-[var(--foreground)] shadow-none";
  const textareaClassName = "rounded-xl border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-sm text-[var(--foreground)] shadow-none";
  const fieldLabelClassName = "text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]";
  const sectionEyebrowClassName = "text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]";
  const sectionTitleClassName = "text-xl font-semibold text-[var(--foreground)]";
  const sectionBodyClassName = "text-sm leading-6 text-[var(--muted-foreground)]";
  const secondaryButtonClassName = "h-10 min-w-[110px] shrink-0 justify-center rounded-xl border-[var(--border)] bg-[var(--secondary)] px-5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--secondary)]";
  const primaryButtonClassName = "h-10 min-w-[170px] shrink-0 justify-center rounded-xl px-6 text-sm font-bold";

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
                amenities: [],
                vibes: [],
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

  return (
    <AppShell>
      <main className="w-full py-10 sm:py-12">
        <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 20px" }}>
          <div>
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--primary)]">
              <Building2 className="h-3.5 w-3.5" />
              Onboarding
            </div>
            <h1 className="font-display text-4xl font-black tracking-[-0.02em] text-[var(--foreground)] md:text-5xl">Register Your Business Venue</h1>
            <p className="mt-4 max-w-[700px] text-[15px] leading-8 text-[var(--muted-foreground)]">
              Search the venue from Google, review the defaults, adjust the editable business details, and submit for admin approval.
            </p>
            <div className="mt-5">
              <Link href="/login" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                Back to login
              </Link>
            </div>
          </div>
        </section>

        <section style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 20px" }}>
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-7 lg:p-8">
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

            <form onSubmit={handleSubmit} className="grid gap-0 sm:px-1">
              <section className="grid gap-4 border-b border-[var(--border)] pb-6">
                <div className="grid gap-1">
                  <div className={sectionEyebrowClassName}>Owner account</div>
                  <h2 className={sectionTitleClassName}>Business owner login</h2>
                  <p className={sectionBodyClassName}>This account stays pending until admin approves the business profile.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <label htmlFor="owner-name" className={fieldLabelClassName}>Owner name</label>
                    <Input id="owner-name" className={fieldClassName} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="owner-email" className={fieldLabelClassName}>Email</label>
                    <Input id="owner-email" type="email" className={fieldClassName} value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="owner-password" className={fieldLabelClassName}>Password</label>
                    <Input id="owner-password" type="password" className={fieldClassName} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required />
                  </div>
                </div>
              </section>

              <GooglePlacePicker
                className="border-b border-[var(--border)] py-6"
                buttonClassName={secondaryButtonClassName}
                inputClassName={fieldClassName}
                initialPlaceId={venueForm.googlePlaceId}
                variant="archive"
                onPlaceResolved={handlePlaceResolved}
              />

              {existingVenue ? (
                <Alert className="my-6 border-amber-400/30 bg-amber-500/10 text-amber-700">
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

              <section className="grid gap-5 py-6">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                  <div className="grid gap-1">
                    <div className={sectionEyebrowClassName}>{claimMode ? "Claim request" : "Venue profile"}</div>
                    <h2 className={sectionTitleClassName}>{claimMode ? "Claim this existing venue" : "Venue defaults and editable profile"}</h2>
                    <p className={sectionBodyClassName}>
                      {claimMode
                        ? "This venue is already on MatchWatch. Submit proof and admin will review the claim."
                        : "Ratings and review counts come from Google. Contact and location fields are preloaded and can be adjusted."}
                    </p>
                  </div>
                  {googleDefaults ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={secondaryButtonClassName}
                      onClick={resetToGoogleDefaults}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Revert to Google defaults
                    </Button>
                  ) : null}
                </div>
                {googleDefaults ? (
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
                      <div className={fieldLabelClassName}>Google rating</div>
                      <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{googleDefaults.rating ?? "N/A"}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
                      <div className={fieldLabelClassName}>Google reviews</div>
                      <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{googleDefaults.reviewCount ?? 0}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
                      <div className={fieldLabelClassName}>Menu</div>
                      <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                        {googleDefaults.menu?.categories?.length || googleDefaults.menu?.sourceUrl ? "Imported from Google" : "Not available from Google"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
                      <div className={fieldLabelClassName}>Google Place ID</div>
                      <div className="mt-1 break-all text-xs font-medium text-[var(--foreground)]">{googleDefaults.placeId}</div>
                    </div>
                  </div>
                ) : null}

                {existingVenue ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant={claimMode ? "default" : "outline"}
                      className={claimMode ? primaryButtonClassName : secondaryButtonClassName}
                      onClick={() => setClaimMode(true)}
                    >
                      Claim this venue
                    </Button>
                    <Button
                      type="button"
                      variant={!claimMode ? "default" : "outline"}
                      className={!claimMode ? primaryButtonClassName : secondaryButtonClassName}
                      onClick={() => setClaimMode(false)}
                    >
                      Submit as new venue
                    </Button>
                  </div>
                ) : null}

                {claimMode ? (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <label htmlFor="claim-notes" className={fieldLabelClassName}>Claim notes</label>
                      <Textarea
                        id="claim-notes"
                        className={textareaClassName}
                        value={claimNotes}
                        onChange={(e) => setClaimNotes(e.target.value)}
                        placeholder="Explain your relationship to the venue and what proof you can provide."
                        rows={5}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="claim-docs" className={fieldLabelClassName}>Verification document URLs</label>
                      <Textarea
                        id="claim-docs"
                        className={textareaClassName}
                        value={claimDocs}
                        onChange={(e) => setClaimDocs(e.target.value)}
                        placeholder="One URL per line"
                        rows={4}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <label htmlFor="venue-name" className={fieldLabelClassName}>Venue name</label>
                      <Input id="venue-name" className={fieldClassName} value={venueForm.name} onChange={(e) => setVenueForm((prev) => ({ ...prev, name: e.target.value }))} required />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="venue-phone" className={fieldLabelClassName}>Phone</label>
                      <Input id="venue-phone" className={fieldClassName} value={venueForm.phone} onChange={(e) => setVenueForm((prev) => ({ ...prev, phone: e.target.value }))} />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <label htmlFor="venue-address" className={fieldLabelClassName}>Address</label>
                      <Input id="venue-address" className={fieldClassName} value={venueForm.address} onChange={(e) => setVenueForm((prev) => ({ ...prev, address: e.target.value }))} required />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="venue-city" className={fieldLabelClassName}>City</label>
                      <Input id="venue-city" className={fieldClassName} value={venueForm.city} onChange={(e) => setVenueForm((prev) => ({ ...prev, city: e.target.value }))} required />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="venue-state" className={fieldLabelClassName}>State / province</label>
                      <Input id="venue-state" className={fieldClassName} value={venueForm.stateProvince} onChange={(e) => setVenueForm((prev) => ({ ...prev, stateProvince: e.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="venue-country" className={fieldLabelClassName}>Country</label>
                      <Input id="venue-country" className={fieldClassName} value={venueForm.country} onChange={(e) => setVenueForm((prev) => ({ ...prev, country: e.target.value }))} required />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="venue-postal" className={fieldLabelClassName}>Postal code</label>
                      <Input id="venue-postal" className={fieldClassName} value={venueForm.postalCode} onChange={(e) => setVenueForm((prev) => ({ ...prev, postalCode: e.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="venue-lat" className={fieldLabelClassName}>Latitude</label>
                      <Input id="venue-lat" className={fieldClassName} value={venueForm.lat} onChange={(e) => setVenueForm((prev) => ({ ...prev, lat: e.target.value }))} required />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="venue-lng" className={fieldLabelClassName}>Longitude</label>
                      <Input id="venue-lng" className={fieldClassName} value={venueForm.lng} onChange={(e) => setVenueForm((prev) => ({ ...prev, lng: e.target.value }))} required />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="venue-timezone" className={fieldLabelClassName}>Timezone</label>
                      <Input id="venue-timezone" className={fieldClassName} value={venueForm.timezone} onChange={(e) => setVenueForm((prev) => ({ ...prev, timezone: e.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="venue-capacity" className={fieldLabelClassName}>Capacity</label>
                      <Input id="venue-capacity" type="number" className={fieldClassName} value={venueForm.capacity} onChange={(e) => setVenueForm((prev) => ({ ...prev, capacity: e.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="venue-website" className={fieldLabelClassName}>Website</label>
                      <Input id="venue-website" className={fieldClassName} value={venueForm.website} onChange={(e) => setVenueForm((prev) => ({ ...prev, website: e.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="venue-maps" className={fieldLabelClassName}>Google Maps URL</label>
                      <Input id="venue-maps" className={fieldClassName} value={venueForm.googleMapsUrl} onChange={(e) => setVenueForm((prev) => ({ ...prev, googleMapsUrl: e.target.value }))} />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <label htmlFor="venue-short" className={fieldLabelClassName}>Short description</label>
                      <Textarea id="venue-short" className={textareaClassName} rows={2} value={venueForm.shortDescription} onChange={(e) => setVenueForm((prev) => ({ ...prev, shortDescription: e.target.value }))} />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <label htmlFor="venue-description" className={fieldLabelClassName}>Business description</label>
                      <Textarea id="venue-description" className={textareaClassName} rows={5} value={venueForm.description} onChange={(e) => setVenueForm((prev) => ({ ...prev, description: e.target.value }))} />
                    </div>
                  </div>
                )}
              </section>

              <div className="flex flex-col items-center gap-3 border-t border-[var(--border)] pt-6 text-center sm:flex-row sm:flex-wrap sm:justify-between">
                {recaptchaEnabled ? (
                  <p className="text-xs text-[var(--muted-foreground)] sm:order-3 sm:basis-full sm:text-left">
                    Protected by Google reCAPTCHA.
                  </p>
                ) : null}
                <Button type="button" variant="outline" className={secondaryButtonClassName} asChild>
                  <Link href="/for-venues">Cancel</Link>
                </Button>
                <Button type="submit" className={primaryButtonClassName} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : claimMode ? "Submit claim" : "Submit for approval"}
                </Button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
