import React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { CityMatch } from "../types";
import { buildVenueRegisterUrl } from "../types";

interface Props {
  matches: CityMatch[];
  citySlug: string;
  stadiumName: string;
  matchCount: number;
  cityName: string;
}

function Flag({ code }: { code: string }) {
  return (
    <img
      src={`https://flagcdn.com/24x18/${code}.png`}
      width={24}
      height={18}
      alt={code}
      style={{ objectFit: "cover", borderRadius: 2, flexShrink: 0 }}
    />
  );
}

export function CityMatchSchedule({
  matches,
  citySlug,
  stadiumName,
  matchCount,
  cityName,
}: Props) {
  return (
    <section className="cc-section" id="schedule">
      <div className="cc-wrap">
        <div className="cc-sh">
          <div>
            <h2 className="cc-st">{cityName} Match Schedule</h2>
            <p className="cc-ss">
              {stadiumName} · {matchCount} World Cup Matches
            </p>
          </div>
          <Link href="/matches" className="cc-link-sm">
            All Matches →
          </Link>
        </div>

        <div className="cc-match-grid">
          {matches.map((match) => (
            <div key={match.id} className="cc-match-card">
              <div className="cc-match-head">
                <span className="cc-stage">{match.stage}</span>
                <div className="cc-match-dt">
                  <div>{match.date}</div>
                  <div>{match.time}</div>
                </div>
              </div>

              <div className="cc-match-body">
                <div className="cc-match-team">
                  {match.flagA && !match.tbd && <Flag code={match.flagA} />}
                  {match.tbd ? (
                    <span className="cc-match-tbd">TBD</span>
                  ) : (
                    <span className="cc-match-tname">{match.teamA}</span>
                  )}
                </div>
                <div className="cc-match-vs">VS</div>
                <div className="cc-match-team">
                  {match.flagB && !match.tbd && <Flag code={match.flagB} />}
                  {match.tbd ? (
                    <span className="cc-match-tbd">TBD</span>
                  ) : (
                    <span className="cc-match-tname">{match.teamB}</span>
                  )}
                </div>
              </div>

              <div className="cc-match-stadium">📍 {match.stadiumName}</div>

              <Link
                href={buildVenueRegisterUrl({ citySlug, type: "watch-party" })}
                className="cc-btn-p cc-btn-sm cc-btn-full"
              >
                <Search size={12} />
                Find Watch Parties
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
