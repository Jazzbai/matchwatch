import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CITIES,
  CITY_MATCHES,
  VENUE_SOLUTION_PACKAGES,
  VENDOR_SOLUTIONS,
} from "./data";
import { WorldCupCityClient } from "./_components/WorldCupCityClient";

interface Props {
  params: Promise<{ citySlug: string }>;
}

export async function generateStaticParams() {
  return CITIES.map((c) => ({ citySlug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug } = await params;
  const city = CITIES.find((c) => c.slug === citySlug);
  if (!city) return {};
  return {
    title: `${city.name} World Cup 2026 Watch Parties`,
    description: city.heroSubtitle,
  };
}

export default async function WorldCupCityPage({ params }: Props) {
  const { citySlug } = await params;

  const city = CITIES.find((c) => c.slug === citySlug);
  if (!city) notFound();

  const matches = CITY_MATCHES.filter((m) => m.citySlug === city.slug);

  const KEEP_VENDORS = new Set(["dj-entertainment", "photography-video", "digital-marketing", "ai-receptionist", "qr-campaigns"]);
  const vendors = VENDOR_SOLUTIONS.filter((v) => KEEP_VENDORS.has(v.slug));

  return (
    <WorldCupCityClient
      city={city}
      matches={matches}
      packages={VENUE_SOLUTION_PACKAGES}
      vendors={vendors}
    />
  );
}
