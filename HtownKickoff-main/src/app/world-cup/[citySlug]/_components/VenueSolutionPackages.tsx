import React from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import type { VenueSolutionPackage } from "../types";
import { buildVenueRegisterUrl } from "../types";

interface Props {
  packages: VenueSolutionPackage[];
  citySlug: string;
  cityName: string;
}

export function VenueSolutionPackages({ packages, citySlug, cityName }: Props) {
  return (
    <section className="cc-section" id="packages">
      <div className="cc-wrap">
        <div className="cc-sh">
          <div>
            <h2 className="cc-st">Watch Party Solution Packages for {cityName} Venues</h2>
            <p className="cc-ss">
              Help your venue become match-day ready with digital visibility, entertainment,
              media, and AI-powered customer communication.
            </p>
          </div>
        </div>

        <div className="cc-pkg-grid">
          {packages.map((pkg) => (
            <div key={pkg.id} className={`cc-pkg${pkg.highlight ? " featured" : ""}`}>
              {pkg.highlight && (
                <div className="cc-pkg-badge">
                  <Star size={11} />
                  Most Popular
                </div>
              )}
              <div className="cc-pkg-head">
                <div className="cc-pkg-name">{pkg.title}</div>
                <div className="cc-pkg-desc">{pkg.description}</div>
              </div>

              <ul className="cc-pkg-inc">
                {pkg.included.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <div className="cc-pkg-cta">
                <Link
                  href={buildVenueRegisterUrl({
                    citySlug,
                    packageSlug: pkg.slug,
                  })}
                  className={pkg.highlight ? "cc-btn-p cc-btn-full" : "cc-btn-g cc-btn-full"}
                >
                  {pkg.ctaLabel}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
