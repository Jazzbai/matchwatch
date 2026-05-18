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
          Register your venue to get listed, promote your watch parties, and access
          digital, media, and event support packages.
        </p>
        <div className="cc-fcta-btns">
          <Link
            href={buildVenueRegisterUrl({ citySlug })}
            className="cc-btn-p"
          >
            <Building2 size={15} />
            List Your Venue
          </Link>
          <Link
            href={buildVenueRegisterUrl({ citySlug, type: "package" })}
            className="cc-btn-g"
          >
            <Package size={15} />
            Build a Watch Party Package
          </Link>
        </div>
      </div>
    </section>
  );
}
