import React from "react";
import Link from "next/link";
import {
  Music,
  Camera,
  Monitor,
  Volume2,
  Palette,
  Shield,
  UtensilsCrossed,
  Megaphone,
  Bot,
  QrCode,
  type LucideProps,
} from "lucide-react";
import type { VendorSolution } from "../types";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Music,
  Camera,
  Monitor,
  Volume2,
  Palette,
  Shield,
  UtensilsCrossed,
  Megaphone,
  Bot,
  QrCode,
};

interface Props {
  vendors: VendorSolution[];
  citySlug: string;
  cityName: string;
}

export function VendorSolutionGrid({ vendors, citySlug, cityName }: Props) {
  return (
    <section className="cc-section">
      <div className="cc-wrap">
        <div className="cc-sh">
          <div>
            <h2 className="cc-st">{cityName} Event Vendors & Watch Party Support</h2>
            <p className="cc-ss">
              Connect with local vendors and service providers to build the perfect
              World Cup watch party experience.
            </p>
          </div>
        </div>

        <div className="cc-vs-grid">
          {vendors.map((vendor) => {
            const Icon = ICON_MAP[vendor.icon];
            return (
              <div key={vendor.id} className="cc-vs">
                <div className="cc-vs-icon">
                  {Icon && <Icon size={20} />}
                </div>
                <div className="cc-vs-name">{vendor.title}</div>
                <div className="cc-vs-desc">{vendor.description}</div>
                <Link
                  href={`/services?service=${vendor.slug}&city=${citySlug}`}
                  className="cc-btn-p cc-btn-sm"
                >
                  Request Service
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
