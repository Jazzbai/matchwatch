import React from "react";
import Link from "next/link";
import { CheckCircle, Users, Monitor, Music, MapPin, ExternalLink } from "lucide-react";
import type { CityVenue } from "../types";
import { buildVenueRegisterUrl } from "../types";

interface Props {
  venues: CityVenue[];
  citySlug: string;
  cityName: string;
}

function FeatureChip({ label }: { label: string }) {
  return <span className="cc-chip">{label}</span>;
}

function VenueCard({ venue, citySlug }: { venue: CityVenue; citySlug: string }) {
  return (
    <div className="cc-vc">
      <div className="cc-vc-top">
        <div>
          <div className="cc-vc-name">{venue.name}</div>
          {venue.neighborhood && (
            <div className="cc-vc-addr" style={{ marginTop: 2 }}>
              <MapPin size={10} style={{ display: "inline", marginRight: 3 }} />
              {venue.neighborhood}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className="cc-vc-type">{venue.type}</span>
          {venue.watchPartyReady && (
            <span className="cc-wp-badge">
              <CheckCircle size={10} />
              Watch Party Ready
            </span>
          )}
        </div>
      </div>

      <div className="cc-vc-addr">{venue.address}</div>

      <div className="cc-vc-feats">
        {venue.capacity && (
          <FeatureChip label={`👥 ${venue.capacity} cap`} />
        )}
        {venue.screens && (
          <FeatureChip label={`📺 ${venue.screens}`} />
        )}
        {venue.indoorOutdoor && (
          <FeatureChip label={venue.indoorOutdoor} />
        )}
        {venue.djAvailable && <FeatureChip label="🎵 DJ" />}
        {venue.foodAndDrink && <FeatureChip label="🍺 Food & Drink" />}
        {venue.videoRecapAvailable && <FeatureChip label="🎥 Video Recap" />}
        {venue.digitalPackageAvailable && <FeatureChip label="📱 Digital" />}
      </div>

      <div className="cc-vc-btns">
        <Link
          href={`/venues/${venue.slug}`}
          className="cc-btn-g cc-btn-sm"
        >
          <ExternalLink size={12} />
          View Venue
        </Link>
        <Link
          href={buildVenueRegisterUrl({
            citySlug,
            venueSlug: venue.slug,
            type: "claim",
          })}
          className="cc-btn-p cc-btn-sm"
        >
          Claim / Register
        </Link>
      </div>
    </div>
  );
}

export function CityVenueGrid({ venues, citySlug, cityName }: Props) {
  return (
    <section className="cc-section" id="venues">
      <div className="cc-wrap">
        <div className="cc-sh">
          <div>
            <h2 className="cc-st">{cityName} Watch Party Venues</h2>
            <p className="cc-ss">
              Explore restaurants, bars, hotels, and event spaces already located in{" "}
              {cityName} and ready to host soccer fans.
            </p>
          </div>
          <Link
            href={buildVenueRegisterUrl({ citySlug })}
            className="cc-link-sm"
          >
            + List Your Venue
          </Link>
        </div>

        {venues.length > 0 ? (
          <div className="cc-vg">
            {venues.map((v) => (
              <VenueCard key={v.id} venue={v} citySlug={citySlug} />
            ))}
          </div>
        ) : (
          <div className="cc-empty">
            <div className="cc-empty-icon">🏟️</div>
            <div className="cc-empty-title">No venues listed yet</div>
            <p className="cc-empty-body">
              Be the first venue in {cityName} to get listed on MatchWatch.
            </p>
            <Link
              href={buildVenueRegisterUrl({ citySlug })}
              className="cc-btn-p"
            >
              Register Your Venue
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
