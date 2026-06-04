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
          Get listed free, or grab a MatchPoint Creator Package — signage,
          reservation tools, social content, and premium video starting at $149.
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
            href="/for-venues#matchpoint"
            className="cc-btn-g"
          >
            <Package size={15} />
            See packages ($149 – $2,899)
          </Link>
        </div>
      </div>
    </section>
  );
}
