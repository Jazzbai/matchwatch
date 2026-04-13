"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { api } from "../../../lib/api";

type TeamDetail = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  crestUrl?: string | null;
  heroImageUrl?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  website?: string | null;
  country?: string | null;
  primaryStadium?: {
    id: string;
    slug: string;
    name: string;
    shortName?: string | null;
    city?: string | null;
    country?: string | null;
    imageUrl?: string | null;
  } | null;
  secondaryStadiums: Array<{
    id: string;
    slug: string;
    name: string;
    shortName?: string | null;
    city?: string | null;
    country?: string | null;
    imageUrl?: string | null;
  }>;
  players: Array<{
    id: string;
    slug: string;
    name: string;
    shortName?: string | null;
    headshotUrl?: string | null;
    nationality?: string | null;
    shirtNumber?: string | null;
    position?: string | null;
    isCaptain?: boolean;
    sortOrder?: number | null;
  }>;
  canonicalSlug?: string;
  canonicalPath?: string;
  league?: { id: string; name: string; slug: string; shortName?: string | null; logoUrl?: string | null } | null;
  standingsRow?: {
    rank: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    goalDifference: number;
    form?: string | null;
  } | null;
  fanPlaces: Array<{
    id: string;
    slug: string;
    name: string;
    city?: string | null;
    country?: string | null;
    shortDescription?: string | null;
    coverImageUrl?: string | null;
  }>;
  recentMatches: Array<{ id: string; homeTeamName?: string | null; awayTeamName?: string | null; homeScore?: number | null; awayScore?: number | null; matchDateUtc: string; status: string }>;
  upcomingMatches: Array<{ id: string; homeTeamName?: string | null; awayTeamName?: string | null; matchDateUtc: string; status: string }>;
};

export default function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();
  const [team, setTeam] = React.useState<TeamDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await api.get<TeamDetail>(`/teams/${teamId}`);
        if (!cancelled) setTeam(response.data || null);
      } catch {
        if (!cancelled) setTeam(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  React.useEffect(() => {
    if (team?.canonicalSlug && team.canonicalSlug !== teamId && team.canonicalPath) {
      router.replace(team.canonicalPath);
    }
  }, [router, team?.canonicalPath, team?.canonicalSlug, teamId]);

  if (loading) {
    return <AppShell><section style={{ padding: "64px 20px", textAlign: "center", color: "var(--muted-foreground)" }}>Loading team...</section></AppShell>;
  }

  if (!team) {
    return <AppShell><section style={{ padding: "64px 20px", textAlign: "center", color: "var(--muted-foreground)" }}>Team not found.</section></AppShell>;
  }

  return (
    <AppShell>
      <section
        style={{
          padding: "56px 20px 32px",
          background: team.heroImageUrl
            ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.7)), url(${team.heroImageUrl}) center / cover`
            : "linear-gradient(135deg, color-mix(in oklch, var(--primary) 18%, transparent), var(--background))",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 12, color: team.heroImageUrl ? "rgba(255,255,255,0.72)" : "var(--primary)" }}>Team</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            {team.crestUrl ? <img src={team.crestUrl} alt="" style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 16, background: "rgba(255,255,255,0.9)", padding: 10 }} /> : null}
            <div>
              <h1 className="font-display text-display" style={{ color: team.heroImageUrl ? "#fff" : "var(--foreground)", margin: 0 }}>{team.name}</h1>
              <p style={{ margin: "10px 0 0", maxWidth: 720, color: team.heroImageUrl ? "rgba(255,255,255,0.86)" : "var(--muted-foreground)", lineHeight: 1.7 }}>
                {team.shortDescription || team.description || "Profile and recent form for this team."}
              </p>
              {team.league ? (
                <Link href={`/leagues/${team.league.slug}`} style={{ display: "inline-flex", marginTop: 14, color: team.heroImageUrl ? "#fff" : "var(--primary)", fontWeight: 700, textDecoration: "none" }}>
                  {team.league.name}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "24px 20px 48px", maxWidth: 1120, margin: "0 auto", display: "grid", gap: 20 }}>
        {(team.country || team.website || team.league || team.primaryStadium) ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {team.country ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Country</div><div style={{ marginTop: 8, color: "var(--foreground)", fontWeight: 800 }}>{team.country}</div></div> : null}
            {team.website ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Website</div><a href={team.website} target="_blank" rel="noreferrer" style={{ marginTop: 8, display: "inline-block", color: "var(--primary)", fontWeight: 800, textDecoration: "none" }}>{team.website.replace(/^https?:\/\//, "")}</a></div> : null}
            {team.league ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>League</div><Link href={`/leagues/${team.league.slug}`} style={{ marginTop: 8, display: "inline-block", color: "var(--primary)", fontWeight: 800, textDecoration: "none" }}>{team.league.name}</Link></div> : null}
            {team.primaryStadium ? (
              <div className="card-flat" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Home Stadium</div>
                <Link href={`/stadiums/${team.primaryStadium.slug}`} style={{ marginTop: 8, display: "inline-block", color: "var(--primary)", fontWeight: 800, textDecoration: "none" }}>
                  {team.primaryStadium.name}
                </Link>
                {(team.primaryStadium.city || team.primaryStadium.country) ? (
                  <div style={{ marginTop: 6, color: "var(--muted-foreground)", fontSize: 12 }}>
                    {[team.primaryStadium.city, team.primaryStadium.country].filter(Boolean).join(", ")}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {(team.primaryStadium || team.secondaryStadiums.length > 0) ? (
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ color: "var(--foreground)", margin: "0 0 14px" }}>Stadiums</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {[team.primaryStadium, ...team.secondaryStadiums].filter(Boolean).map((stadium, index) => {
                if (!stadium) return null;
                const isPrimary = index === 0 && team.primaryStadium?.id === stadium.id;
                return (
                  <Link
                    key={stadium.id}
                    href={`/stadiums/${stadium.slug}`}
                    style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 14, padding: 14, background: "var(--secondary)", display: "grid", gap: 10 }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      {stadium.imageUrl ? <img src={stadium.imageUrl} alt="" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 12 }} /> : null}
                      <div>
                        <div style={{ fontWeight: 800, color: "var(--foreground)" }}>{stadium.name}</div>
                        {(stadium.city || stadium.country) ? <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{[stadium.city, stadium.country].filter(Boolean).join(", ")}</div> : null}
                      </div>
                    </div>
                    {isPrimary ? <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Primary home stadium</div> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        {team.standingsRow ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {[
              { label: "Rank", value: team.standingsRow.rank },
              { label: "Played", value: team.standingsRow.played },
              { label: "Points", value: team.standingsRow.points },
              { label: "Form", value: team.standingsRow.form || "-" },
            ].map((item) => (
              <div key={item.label} className="card-flat" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-foreground)", marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "var(--foreground)" }}>{item.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {team.description ? (
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ color: "var(--foreground)", margin: "0 0 10px" }}>About</h2>
            <p style={{ margin: 0, lineHeight: 1.8, color: "var(--muted-foreground)" }}>{team.description}</p>
          </div>
        ) : null}

        {team.fanPlaces.length > 0 ? (
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ color: "var(--foreground)", margin: "0 0 14px" }}>Fan Places</h2>
            <div className="fanPlacesRail">
              {team.fanPlaces.map((venue) => (
                <Link key={venue.id} href={`/venues/${venue.slug}`} className="fanPlaceCard">
                  <div className="fanPlaceImageWrap">
                    {venue.coverImageUrl ? (
                      <img src={venue.coverImageUrl} alt={venue.name} className="fanPlaceImage" />
                    ) : (
                      <div className="fanPlaceImagePlaceholder">{venue.name.slice(0, 1)}</div>
                    )}
                  </div>
                  <div className="fanPlaceBody">
                    <div className="fanPlaceTitle">{venue.name}</div>
                    {(venue.city || venue.country) ? (
                      <div className="fanPlaceMeta">{[venue.city, venue.country].filter(Boolean).join(", ")}</div>
                    ) : null}
                    {venue.shortDescription ? <p className="fanPlaceDescription">{venue.shortDescription}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {team.players.length > 0 ? (
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ color: "var(--foreground)", margin: "0 0 14px" }}>Players</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {team.players.map((player) => (
                <Link
                  key={player.id}
                  href={`/players/${player.slug}`}
                  style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 14, padding: 14, background: "var(--secondary)", display: "grid", gap: 10 }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {player.headshotUrl ? <img src={player.headshotUrl} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 14 }} /> : null}
                    <div>
                      <div style={{ fontWeight: 800, color: "var(--foreground)" }}>
                        {player.name} {player.isCaptain ? <span style={{ color: "var(--primary)" }}>(C)</span> : null}
                      </div>
                      {player.position ? <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{player.position}</div> : null}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
                    <span>{player.nationality || "Player"}</span>
                    <span>{player.shirtNumber ? `#${player.shirtNumber}` : ""}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ color: "var(--foreground)", margin: "0 0 14px" }}>Upcoming Fixtures</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {team.upcomingMatches.length === 0 ? <p style={{ margin: 0, color: "var(--muted-foreground)" }}>No upcoming fixtures.</p> : team.upcomingMatches.map((match) => (
                <Link key={match.id} href={`/matches/${match.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--secondary)" }}>
                  <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{match.homeTeamName} vs {match.awayTeamName}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{new Date(match.matchDateUtc).toLocaleString()}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ color: "var(--foreground)", margin: "0 0 14px" }}>Recent Results</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {team.recentMatches.length === 0 ? <p style={{ margin: 0, color: "var(--muted-foreground)" }}>No recent results.</p> : team.recentMatches.map((match) => (
                <Link key={match.id} href={`/matches/${match.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--secondary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{match.homeTeamName} vs {match.awayTeamName}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{new Date(match.matchDateUtc).toLocaleDateString()}</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--foreground)" }}>
                      {match.homeScore} - {match.awayScore}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
      <style jsx>{`
        .fanPlacesRail {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }
        .fanPlaceCard {
          display: grid;
          gap: 12px;
          text-decoration: none;
          color: inherit;
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          background: var(--secondary);
          min-width: 0;
        }
        .fanPlaceImageWrap {
          width: 100%;
          height: 152px;
          background: color-mix(in oklch, var(--primary) 12%, var(--secondary));
        }
        .fanPlaceImage {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .fanPlaceImagePlaceholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
          font-weight: 900;
          color: var(--primary);
        }
        .fanPlaceBody {
          display: grid;
          gap: 6px;
          padding: 0 14px 14px;
        }
        .fanPlaceTitle {
          font-size: 18px;
          font-weight: 800;
          color: var(--foreground);
        }
        .fanPlaceMeta {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
        }
        .fanPlaceDescription {
          margin: 0;
          color: var(--muted-foreground);
          line-height: 1.6;
          font-size: 14px;
        }
        @media (max-width: 720px) {
          .fanPlacesRail {
            display: flex;
            overflow-x: auto;
            gap: 12px;
            padding-bottom: 4px;
            scroll-snap-type: x proximity;
          }
          .fanPlaceCard {
            flex: 0 0 84vw;
            max-width: 320px;
            scroll-snap-align: start;
          }
        }
      `}</style>
    </AppShell>
  );
}
