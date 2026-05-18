import React from "react";
import Link from "next/link";
import { MapPin, Building2, Package } from "lucide-react";
import type { WorldCupCity } from "../types";
import { buildVenueRegisterUrl } from "../types";

interface Props {
  city: WorldCupCity;
}

export function CityHero({ city }: Props) {
  return (
    <section className="cc-hero">
      <div className="cc-hero-inner">
        <div className="cc-hero-text">
          <div className="cc-kicker">
            <span className="bd" />
            FIFA World Cup 2026 · {city.name}{city.state ? `, ${city.state}` : ""}
          </div>

          <h1 className="cc-h1">{city.heroTitle}</h1>
          <p className="cc-sub">{city.heroSubtitle}</p>

          <div className="cc-btns">
            <a href="#venues" className="cc-btn-p">
              <MapPin size={15} />
              Find {city.name} Venues
            </a>
            <Link
              href={buildVenueRegisterUrl({ citySlug: city.slug })}
              className="cc-btn-g"
            >
              <Building2 size={15} />
              Register Your Venue
            </Link>
            <a href="#packages" className="cc-btn-g">
              <Package size={15} />
              Build Watch Party Package
            </a>
          </div>

          <div className="cc-stats">
            <div>
              <div className="cc-sv"><span>{city.matchCount}</span></div>
              <div className="cc-sl">WC Matches</div>
            </div>
            <div>
              <div className="cc-sv"><span>1</span></div>
              <div className="cc-sl">Stadium</div>
            </div>
            <div>
              <div className="cc-sv">Jun <span>11</span></div>
              <div className="cc-sl">First Kickoff</div>
            </div>
            <div>
              <div className="cc-sv">Jul <span>19</span></div>
              <div className="cc-sl">The Final</div>
            </div>
          </div>
        </div>

        <figure className="cc-hero-emblem">
          <img
            src="/world-cup-emblem.png"
            alt="FIFA World Cup 2026 Official Emblem"
          />
        </figure>
      </div>
    </section>
  );
}
