"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Armchair,
  BadgeCheck,
  Building2,
  CircleAlert,
  LocateFixed,
  MapPin,
  Phone,
} from "lucide-react";
import { ThemeProvider, AppShell } from "../../../components/AppShell";
import { useAuth } from "../../../lib/auth-context";
import { LocationPickerMap } from "../../../components/LocationPickerMap";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Separator } from "../../../components/ui/separator";
import { Textarea } from "../../../components/ui/textarea";
import { cn } from "../../../lib/utils";
import {
  CUISINE_TAGS,
  DIETARY_TAGS,
  DRINK_TAGS,
  VENUE_FEATURE_TAGS,
  VIBE_TAGS,
} from "../../../lib/tags";

export default function VenueRegisterPage() {
  const router = useRouter();
  const { registerVenue, login } = useAuth();

  const [ownerName, setOwnerName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [ownerPassword, setOwnerPassword] = React.useState("");

  const [venueName, setVenueName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("Houston");
  const [country, setCountry] = React.useState("US");
  const [lat, setLat] = React.useState(29.7604);
  const [lng, setLng] = React.useState(-95.3698);
  const [locationPicked, setLocationPicked] = React.useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [capacity, setCapacity] = React.useState("");
  const [amenities, setAmenities] = React.useState<string[]>([
    "Massive Projector Screen",
    "Free Wi-Fi",
    "Full Bar Service",
  ]);
  const [cuisines, setCuisines] = React.useState<string[]>(["Tex-Mex"]);
  const [priceRange, setPriceRange] = React.useState<"BUDGET" | "MID" | "UPSCALE" | "LUXURY">("MID");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const toggleAmenity = (value: string) => {
    setAmenities((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const toggleCuisine = (value: string) => {
    setCuisines((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const resolveAddressFromCoords = async (selectedLat: number, selectedLng: number) => {
    setIsResolvingAddress(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${selectedLat}&lon=${selectedLng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      const addr = data?.address || {};
      if (!address && typeof data?.display_name === "string") {
        setAddress(data.display_name);
      }
      if (typeof addr?.city === "string") setCity(addr.city);
      else if (typeof addr?.town === "string") setCity(addr.town);
      else if (typeof addr?.village === "string") setCity(addr.village);
      if (typeof addr?.country_code === "string") {
        setCountry(addr.country_code.toUpperCase());
      }
    } catch {
      // User can still type address manually.
    } finally {
      setIsResolvingAddress(false);
    }
  };

  const handleMapSelect = (selectedLat: number, selectedLng: number) => {
    setLat(selectedLat);
    setLng(selectedLng);
    setLocationPicked(true);
    void resolveAddressFromCoords(selectedLat, selectedLng);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!locationPicked) {
      setFormError("Select your venue location on the map before submitting.");
      return;
    }
    if (!address.trim() || !city.trim() || !country.trim()) {
      setFormError("Complete address, city, and country after selecting map location.");
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedEmail = ownerEmail.trim().toLowerCase();
      await registerVenue({
        email: normalizedEmail,
        password: ownerPassword,
        name: ownerName.trim(),
        venue: {
          name: venueName.trim(),
          address: address.trim(),
          city: city.trim(),
          country: country.trim().toUpperCase(),
          lat,
          lng,
          timezone: "America/Chicago",
          phone: phone || undefined,
          description: description || undefined,
          amenities,
          cuisineTags: cuisines,
          priceRange,
          capacity: capacity ? Number(capacity) : undefined,
        },
      });

      await login(normalizedEmail, ownerPassword);
      router.push("/admin");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Venue registration failed";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemeProvider>
      <AppShell>
        <main className="mx-auto w-full max-w-5xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <Badge variant="secondary" className="mb-2 gap-1">
                <Building2 className="h-3.5 w-3.5" />
                Venue onboarding
              </Badge>
              <h1 className="font-display text-3xl text-[var(--text-primary)]">Register Your Venue</h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Create your owner account, place your venue on the map, and publish your profile.
              </p>
            </div>
            <Link href="/login" className="text-sm text-[var(--accent-primary)]">
              Back to login
            </Link>
          </div>

          {formError && (
            <Alert variant="destructive" className="mb-4">
              <CircleAlert className="mb-2 h-4 w-4" />
              <AlertTitle>Registration blocked</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Owner account</CardTitle>
                <CardDescription>This account will manage events, bookings, and venue content.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="owner-name">Owner name</Label>
                  <Input id="owner-name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="owner-email">Email</Label>
                  <Input id="owner-email" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="owner-password">Password</Label>
                  <Input
                    id="owner-password"
                    type="password"
                    placeholder="At least 10 characters"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Venue details</CardTitle>
                <CardDescription>Set your location and profile details used on the public venue page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="venue-name">Venue name</Label>
                    <Input id="venue-name" value={venueName} onChange={(e) => setVenueName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-phone">Phone</Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                      <Input id="venue-phone" className="pl-9" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Location on map</Label>
                  <div className="rounded-lg border border-[var(--border)] p-2">
                    <LocationPickerMap lat={lat} lng={lng} onSelect={handleMapSelect} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{lat.toFixed(6)}, {lng.toFixed(6)}</span>
                    {isResolvingAddress && (
                      <>
                        <Separator orientation="vertical" className="h-3" />
                        <LocateFixed className="h-3.5 w-3.5" />
                        <span>Resolving address</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      disabled={!locationPicked}
                      placeholder={locationPicked ? "Street address" : "Select map location first"}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity</Label>
                    <div className="relative">
                      <Armchair className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                      <Input
                        id="capacity"
                        type="number"
                        className="pl-9"
                        value={capacity}
                        onChange={(e) => setCapacity(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} disabled={!locationPicked} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country code</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value.toUpperCase())}
                      disabled={!locationPicked}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price-range">Price range</Label>
                    <Select value={priceRange} onValueChange={(value) => setPriceRange(value as typeof priceRange)}>
                      <SelectTrigger id="price-range">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BUDGET">$ Budget</SelectItem>
                        <SelectItem value="MID">$$ Mid</SelectItem>
                        <SelectItem value="UPSCALE">$$$ Upscale</SelectItem>
                        <SelectItem value="LUXURY">$$$$ Luxury</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe atmosphere, specialties, and watch-party setup."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Amenities and cuisine</CardTitle>
                <CardDescription>Select tags to improve venue discovery and matching.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Venue tags</Label>
                  {[
                    { title: "Dietary options", values: DIETARY_TAGS },
                    { title: "Drink options", values: DRINK_TAGS },
                    { title: "Amenities & features", values: VENUE_FEATURE_TAGS },
                    { title: "Vibe & audience", values: VIBE_TAGS },
                  ].map((group) => (
                    <div key={group.title} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{group.title}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.values.map((value) => {
                          const selected = amenities.includes(value);
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => toggleAmenity(value)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                                selected
                                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary-dim)] text-[var(--accent-primary)]"
                                  : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50",
                              )}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Cuisine tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {CUISINE_TAGS.map((value) => {
                      const selected = cuisines.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => toggleCuisine(value)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                            selected
                              ? "border-[var(--accent-primary)] bg-[var(--accent-primary-dim)] text-[var(--accent-primary)]"
                              : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50",
                          )}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link href="/login">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating venue account..." : "Create Venue Account"}
              </Button>
            </div>
          </form>
        </main>
      </AppShell>
    </ThemeProvider>
  );
}
