import React from "react";
import Link from "next/link";
import { Zap, Star } from "lucide-react";
import { buildVenueRegisterUrl } from "../types";

interface Props {
  citySlug: string;
  cityName: string;
}

export function CitySponsorCTA({ citySlug, cityName }: Props) {
  return (
    <section className="cc-scta">
      <div className="cc-scta-inner">
        <div className="cc-scta-badge">
          <Zap size={11} />
          Sponsorship Opportunity
        </div>
        <h2 className="cc-scta-title">
          Own the {cityName} World Cup Watch Party Page
        </h2>
        <p className="cc-scta-body">
          Get your brand, venue, or business featured in front of fans searching for{" "}
          {cityName} World Cup watch parties, venues, and events.
        </p>
        <div className="cc-fcta-btns">
          <Link
            href={buildVenueRegisterUrl({ citySlug, type: "sponsor" })}
            className="cc-btn-p"
          >
            <Zap size={15} />
            Sponsor This City
          </Link>
          <Link
            href={buildVenueRegisterUrl({ citySlug, type: "featured-venue" })}
            className="cc-btn-g"
          >
            <Star size={15} />
            Become Featured Venue
          </Link>
        </div>
      </div>
    </section>
  );
}
