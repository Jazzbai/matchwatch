import React from "react";
import Link from "next/link";
import { MapPin, ArrowDown, Shield, Map } from "lucide-react";
import type { WorldCupCity, CityMatch } from "../types";

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
            World Cup 2026 · {city.name}{city.state ? `, ${city.state}` : ""}
          </div>

          <h1 className="cc-h1">{city.heroTitle}</h1>
          <p className="cc-sub">{city.heroSubtitle}</p>

          <div className="cc-btns">
            <a href="#venues" className="cc-btn-p">
              <MapPin size={15} />
              Find {city.name} Watch Party Venues
            </a>
            {(city.slug === "seattle" || city.slug === "houston" || city.slug === "dallas" || city.slug === "new-york") && (
              <Link href={`/world-cup/${city.slug}/fan-festival`} className="cc-btn-g" style={{ textDecoration: "none" }}>
                <Shield size={14} /> Official Fan Festival™
              </Link>
            )}
            {city.slug === "seattle" && (
              <Link href="/world-cup/seattle/fan-zones" className="cc-btn-g" style={{ textDecoration: "none" }}>
                <Map size={14} /> 9 Community Fan Zones
              </Link>
            )}
          </div>
          <a href="#for-business" className="cc-hero-biz-link">
            <ArrowDown size={12} />
            Own a venue or planning a corporate event?
          </a>

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
          <img src="/world-cup-emblem.png" alt="World Cup 2026" />
        </figure>
      </div>
    </section>
  );
}
