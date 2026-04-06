"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { api } from "../../../lib/api";

type LeagueDetail = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  website?: string | null;
  country?: string | null;
  canonicalSlug?: string;
  canonicalPath?: string;
  sport?: { id: string; name: string; slug: string } | null;
  teams: Array<{ id: string; name: string; slug: string; shortName?: string | null; crestUrl?: string | null }>;
  standings: {
    rows: Array<{ rank: number; points: number; played: number; wins: number; draws: number; losses: number; goalDifference: number; team?: { id: string; name: string; slug: string; crestUrl?: string | null } | null }>;
  };
  fixtures: Array<{ id: string; homeTeamName?: string | null; awayTeamName?: string | null; matchDateUtc: string }>;
  results: Array<{ id: string; homeTeamName?: string | null; awayTeamName?: string | null; homeScore?: number | null; awayScore?: number | null; matchDateUtc: string }>;
};

function TeamStandingsLink({ team }: { team: NonNullable<LeagueDetail["standings"]["rows"][number]["team"]> }) {
  return (
    <Link
      href={`/teams/${team.slug}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        color: "var(--foreground)",
        textDecoration: "none",
        fontWeight: 700,
      }}
    >
      {team.crestUrl ? (
        <img
          src={team.crestUrl}
          alt=""
          style={{
            width: 24,
            height: 24,
            objectFit: "contain",
            borderRadius: 8,
            background: "rgba(255,255,255,0.92)",
            padding: 3,
            flexShrink: 0,
          }}
        />
      ) : null}
      <span>{team.name}</span>
    </Link>
  );
}

export default function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [league, setLeague] = React.useState<LeagueDetail | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await api.get<LeagueDetail>(`/leagues/${slug}`);
        if (!cancelled) setLeague(response.data || null);
      } catch {
        if (!cancelled) setLeague(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  React.useEffect(() => {
    if (league?.canonicalSlug && league.canonicalSlug !== slug && league.canonicalPath) {
      router.replace(league.canonicalPath);
    }
  }, [league?.canonicalPath, league?.canonicalSlug, router, slug]);

  if (!league) {
    return <AppShell><section style={{ padding: "64px 20px", textAlign: "center", color: "var(--muted-foreground)" }}>League not found.</section></AppShell>;
  }

  return (
    <AppShell>
      <section style={{ padding: "56px 20px 32px", background: league.heroImageUrl ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.72)), url(${league.heroImageUrl}) center / cover` : "linear-gradient(135deg, color-mix(in oklch, var(--primary) 16%, transparent), var(--background))" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 12, color: league.heroImageUrl ? "rgba(255,255,255,0.72)" : "var(--primary)" }}>{league.sport?.name || "League"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            {league.logoUrl ? (
              <a
                href={league.canonicalPath || `/leagues/${league.slug}`}
                style={{ display: "inline-flex", borderRadius: 16 }}
                aria-label={`${league.name} page`}
              >
                <img src={league.logoUrl} alt="" style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 16, background: "rgba(255,255,255,0.92)", padding: 10 }} />
              </a>
            ) : null}
            <div>
              <h1 className="font-display text-display" style={{ color: league.heroImageUrl ? "#fff" : "var(--foreground)", margin: 0 }}>{league.name}</h1>
              <p style={{ margin: "10px 0 0", maxWidth: 760, color: league.heroImageUrl ? "rgba(255,255,255,0.86)" : "var(--muted-foreground)", lineHeight: 1.7 }}>
                {league.shortDescription || league.description || "League fixtures, standings, and recent results."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "24px 20px 48px", maxWidth: 1180, margin: "0 auto", display: "grid", gap: 20 }}>
        {(league.country || league.website || league.teams.length > 0) ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {league.country ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Country</div><div style={{ marginTop: 8, color: "var(--foreground)", fontWeight: 800 }}>{league.country}</div></div> : null}
            {league.website ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Website</div><a href={league.website} target="_blank" rel="noreferrer" style={{ marginTop: 8, display: "inline-block", color: "var(--primary)", fontWeight: 800, textDecoration: "none" }}>{league.website.replace(/^https?:\/\//, "")}</a></div> : null}
            <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Teams</div><div style={{ marginTop: 8, color: "var(--foreground)", fontWeight: 800 }}>{league.teams.length}</div></div>
          </div>
        ) : null}

        {league.description ? (
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ margin: "0 0 12px", color: "var(--foreground)" }}>About</h2>
            <p style={{ margin: 0, color: "var(--muted-foreground)", lineHeight: 1.8 }}>{league.description}</p>
          </div>
        ) : null}

        <div className="card-flat" style={{ padding: 20 }}>
          <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Standings</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 12 }}>
                  <th style={{ padding: "10px 8px" }}>#</th>
                  <th style={{ padding: "10px 8px" }}>Team</th>
                  <th style={{ padding: "10px 8px" }}>P</th>
                  <th style={{ padding: "10px 8px" }}>W</th>
                  <th style={{ padding: "10px 8px" }}>D</th>
                  <th style={{ padding: "10px 8px" }}>L</th>
                  <th style={{ padding: "10px 8px" }}>GD</th>
                  <th style={{ padding: "10px 8px" }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {league.standings.rows.map((row) => (
                  <tr key={row.team?.id || row.rank} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 8px", fontWeight: 700 }}>{row.rank}</td>
                    <td style={{ padding: "12px 8px" }}>
                      {row.team ? <TeamStandingsLink team={row.team} /> : "-"}
                    </td>
                    <td style={{ padding: "12px 8px" }}>{row.played}</td>
                    <td style={{ padding: "12px 8px" }}>{row.wins}</td>
                    <td style={{ padding: "12px 8px" }}>{row.draws}</td>
                    <td style={{ padding: "12px 8px" }}>{row.losses}</td>
                    <td style={{ padding: "12px 8px" }}>{row.goalDifference}</td>
                    <td style={{ padding: "12px 8px", fontWeight: 800 }}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Upcoming Fixtures</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {league.fixtures.map((match) => (
                <Link key={match.id} href={`/matches/${match.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--secondary)" }}>
                  <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{match.homeTeamName} vs {match.awayTeamName}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{new Date(match.matchDateUtc).toLocaleString()}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Recent Results</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {league.results.map((match) => (
                <Link key={match.id} href={`/matches/${match.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--secondary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{match.homeTeamName} vs {match.awayTeamName}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{new Date(match.matchDateUtc).toLocaleDateString()}</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--foreground)" }}>{match.homeScore} - {match.awayScore}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {league.teams.length > 0 ? (
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Teams</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {league.teams.slice(0, 12).map((team) => (
                <Link key={team.id} href={`/teams/${team.slug}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--secondary)", display: "flex", gap: 12, alignItems: "center" }}>
                  {team.crestUrl ? <img src={team.crestUrl} alt="" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 10, background: "rgba(255,255,255,0.9)", padding: 6 }} /> : null}
                  <div>
                    <div style={{ fontWeight: 800, color: "var(--foreground)" }}>{team.name}</div>
                    {team.shortName ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{team.shortName}</div> : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
