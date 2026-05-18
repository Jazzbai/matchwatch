export type WorldCupCity = {
  slug: string;
  name: string;
  state?: string;
  stadiumName: string;
  matchCount: number;
  heroTitle: string;
  heroSubtitle: string;
  cityDescription: string;
  lat: number;
  lng: number;
  zoom?: number;
};

export type CityMatch = {
  id: string;
  citySlug: string;
  stage: string;
  teamA: string;
  teamB: string;
  date: string;
  time: string;
  stadiumName: string;
  flagA?: string;
  flagB?: string;
  tbd?: boolean;
};

export type CityVenue = {
  id: string;
  citySlug: string;
  name: string;
  slug: string;
  type: string;
  address: string;
  neighborhood?: string;
  lat: number;
  lng: number;
  capacity?: number;
  screens?: string;
  foodAndDrink?: boolean;
  indoorOutdoor?: string;
  djAvailable?: boolean;
  videoRecapAvailable?: boolean;
  digitalPackageAvailable?: boolean;
  watchPartyReady?: boolean;
};

export type VenueSolutionPackage = {
  id: string;
  title: string;
  slug: string;
  description: string;
  included: string[];
  ctaLabel: string;
  highlight?: boolean;
};

export type VendorSolution = {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon: string;
};

export function buildVenueRegisterUrl({
  citySlug,
  packageSlug,
  serviceSlug,
  venueSlug,
  type,
}: {
  citySlug: string;
  packageSlug?: string;
  serviceSlug?: string;
  venueSlug?: string;
  type?: string;
}): string {
  const params = new URLSearchParams();
  params.set("city", citySlug);
  if (packageSlug) params.set("package", packageSlug);
  if (serviceSlug) params.set("service", serviceSlug);
  if (venueSlug) params.set("venue", venueSlug);
  if (type) params.set("type", type);
  return `/for-venues/register?${params.toString()}`;
}
