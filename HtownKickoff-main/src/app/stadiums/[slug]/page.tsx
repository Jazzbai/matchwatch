"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { api } from "../../../lib/api";

type StadiumDetail = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  imageUrl?: string | null;
  heroImageUrl?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  country?: string | null;
  postalCode?: string | null;
  capacity?: number | null;
  openedYear?: number | null;
  surface?: string | null;
  canonicalSlug?: string;
  canonicalPath?: string;
  teams: Array<{ id: string; slug: string; name: string; shortName?: string | null; crestUrl?: string | null; isPrimary?: boolean }>;
  upcomingMatches: Array<{ id: string; homeTeamName?: string | null; awayTeamName?: string | null; matchDateUtc: string }>;
  recentMatches: Array<{ id: string; homeTeamName?: string | null; awayTeamName?: string | null; homeScore?: number | null; awayScore?: number | null; matchDateUtc: string }>;
};

export default function StadiumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [stadium, setStadium] = React.useState<StadiumDetail | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await api.get<StadiumDetail>(`/stadiums/${slug}`);
        if (!cancelled) setStadium(response.data || null);
      } catch {
        if (!cancelled) setStadium(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  React.useEffect(() => {
    if (stadium?.canonicalSlug && stadium.canonicalSlug !== slug && stadium.canonicalPath) {
      router.replace(stadium.canonicalPath);
    }
  }, [router, slug, stadium?.canonicalPath, stadium?.canonicalSlug]);

  if (!stadium) {
    return <AppShell><section style={{ padding: "64px 20px", textAlign: "center", color: "var(--muted-foreground)" }}>Stadium not found.</section></AppShell>;
  }

  const locationBits = [stadium.addressLine1, stadium.city, stadium.stateProvince, stadium.country, stadium.postalCode].filter(Boolean);

  return (
    <AppShell>
      <section
        style={{
          padding: "56px 20px 32px",
          background: stadium.heroImageUrl
            ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.72)), url(${stadium.heroImageUrl}) center / cover`
            : "linear-gradient(135deg, color-mix(in oklch, var(--primary) 18%, transparent), var(--background))",
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 12, color: stadium.heroImageUrl ? "rgba(255,255,255,0.72)" : "var(--primary)" }}>Stadium</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            {stadium.imageUrl ? <img src={stadium.imageUrl} alt="" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 18, background: "rgba(255,255,255,0.92)" }} /> : null}
            <div>
              <h1 className="font-display text-display" style={{ color: stadium.heroImageUrl ? "#fff" : "var(--foreground)", margin: 0 }}>{stadium.name}</h1>
              <p style={{ margin: "10px 0 0", maxWidth: 760, color: stadium.heroImageUrl ? "rgba(255,255,255,0.86)" : "var(--muted-foreground)", lineHeight: 1.7 }}>
                {stadium.shortDescription || stadium.description || "Upcoming fixtures, linked clubs, and venue details for this stadium."}
              </p>
              {locationBits.length > 0 ? <div style={{ marginTop: 12, color: stadium.heroImageUrl ? "rgba(255,255,255,0.82)" : "var(--muted-foreground)" }}>{locationBits.join(", ")}</div> : null}
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "24px 20px 48px", maxWidth: 1180, margin: "0 auto", display: "grid", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {stadium.capacity ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Capacity</div><div style={{ marginTop: 8, color: "var(--foreground)", fontWeight: 800 }}>{stadium.capacity.toLocaleString()}</div></div> : null}
          {stadium.openedYear ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Opened</div><div style={{ marginTop: 8, color: "var(--foreground)", fontWeight: 800 }}>{stadium.openedYear}</div></div> : null}
          {stadium.surface ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Surface</div><div style={{ marginTop: 8, color: "var(--foreground)", fontWeight: 800 }}>{stadium.surface}</div></div> : null}
          {stadium.website ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Website</div><a href={stadium.website} target="_blank" rel="noreferrer" style={{ marginTop: 8, display: "inline-block", color: "var(--primary)", fontWeight: 800, textDecoration: "none" }}>{stadium.website.replace(/^https?:\/\//, "")}</a></div> : null}
        </div>

        {stadium.description ? (
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>About</h2>
            <p style={{ margin: 0, color: "var(--muted-foreground)", lineHeight: 1.8 }}>{stadium.description}</p>
          </div>
        ) : null}

        {stadium.teams.length > 0 ? (
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Linked Teams</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {stadium.teams.map((team) => (
                <Link key={team.id} href={`/teams/${team.slug}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 14, padding: 14, background: "var(--secondary)", display: "flex", gap: 12, alignItems: "center" }}>
                  {team.crestUrl ? <img src={team.crestUrl} alt="" style={{ width: 42, height: 42, objectFit: "contain", borderRadius: 10, background: "rgba(255,255,255,0.92)", padding: 6 }} /> : null}
                  <div>
                    <div style={{ fontWeight: 800, color: "var(--foreground)" }}>{team.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{team.isPrimary ? "Primary home team" : "Linked team"}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Upcoming Fixtures</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {stadium.upcomingMatches.length === 0 ? <p style={{ margin: 0, color: "var(--muted-foreground)" }}>No upcoming fixtures at this stadium.</p> : stadium.upcomingMatches.map((match) => (
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
              {stadium.recentMatches.length === 0 ? <p style={{ margin: 0, color: "var(--muted-foreground)" }}>No recent matches at this stadium.</p> : stadium.recentMatches.map((match) => (
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
      </section>
    </AppShell>
  );
}
