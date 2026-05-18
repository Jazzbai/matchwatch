import React from "react";
import Link from "next/link";
import { MapPin, Building2, Package } from "lucide-react";
import type { WorldCupCity, CityMatch } from "../types";
import { buildVenueRegisterUrl } from "../types";

interface Props {
  city: WorldCupCity;
  matches: CityMatch[];
}

export function CityHero({ city, matches }: Props) {
  const sorted = [...matches].filter((m) => !m.tbd).sort((a, b) => a.date.localeCompare(b.date));
  const firstMatch = sorted[0];
  const lastMatch = sorted[sorted.length - 1];

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
            {firstMatch && (
              <div>
                <div className="cc-sv" style={{ fontSize: "1.3rem" }}>
                  <span>{firstMatch.date}</span>
                </div>
                <div className="cc-sl">First Kickoff</div>
              </div>
            )}
            {lastMatch && lastMatch.date !== firstMatch?.date && (
              <div>
                <div className="cc-sv" style={{ fontSize: "1.3rem" }}>
                  <span>{lastMatch.date}</span>
                </div>
                <div className="cc-sl">Last Match</div>
              </div>
            )}
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
