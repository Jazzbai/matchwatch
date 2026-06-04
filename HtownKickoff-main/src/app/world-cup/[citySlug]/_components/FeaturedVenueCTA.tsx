import React from "react";
import Link from "next/link";
import { Building2, Package } from "lucide-react";
import { buildVenueRegisterUrl } from "../types";

interface Props {
  citySlug: string;
  cityName: string;
}

export function FeaturedVenueCTA({ citySlug, cityName }: Props) {
  return (
    <section className="cc-fcta">
      <div className="cc-fcta-inner">
        <h2 className="cc-fcta-title">
          Want Your Venue Featured on the {cityName} World Cup Page?
        </h2>
        <p className="cc-fcta-body">
          Get listed free, or go premium with the full World Cup Watch Party Package —
          landing page, reservations, 34 match-day pages, jersey parties, and content
          calendar, delivered before opening match.
        </p>
        <div className="cc-fcta-btns">
          <Link
            href={buildVenueRegisterUrl({ citySlug })}
            className="cc-btn-p"
          >
            <Building2 size={15} />
            List Your Venue (Free)
          </Link>
          <Link
            href={`/for-venues/watch-party-package?ref=${citySlug}`}
            className="cc-btn-g"
          >
            <Package size={15} />
            World Cup Package — $12,650
          </Link>
        </div>
      </div>
    </section>
  );
}
