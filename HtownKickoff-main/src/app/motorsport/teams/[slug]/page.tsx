"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../../components/AppShell";
import { api } from "../../../../lib/api";

type EntryRow = {
  match: { id: string; eventTitle?: string | null; matchDateUtc: string };
  driver?: { id?: string; name?: string | null; slug?: string | null } | null;
  manufacturer?: { id?: string; name?: string | null } | null;
  entry: { finishPosition?: number | null; gridPosition?: number | null; points?: string | number | null };
};

type MotorsportTeamDetail = {
  id: string;
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  website?: string | null;
  canonicalSlug?: string;
  canonicalPath?: string;
  league?: { name?: string | null; slug?: string | null } | null;
  entries: EntryRow[];
  recentEntries?: EntryRow[];
  upcomingEntries?: EntryRow[];
  currentDrivers?: Array<{ id?: string; name?: string | null; slug?: string | null }>;
  manufacturerSummary?: Array<{ id?: string; name?: string | null }>;
};

export default function MotorsportTeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [team, setTeam] = React.useState<MotorsportTeamDetail | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await api.get<MotorsportTeamDetail>(`/motorsport/teams/${slug}`);
        if (!cancelled) setTeam(response.data || null);
      } catch {
        if (!cancelled) setTeam(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  React.useEffect(() => {
    if (team?.canonicalSlug && team.canonicalSlug !== slug && team.canonicalPath) {
      router.replace(team.canonicalPath);
    }
  }, [router, slug, team?.canonicalPath, team?.canonicalSlug]);

  if (!team) {
    return <AppShell><section style={{ padding: "64px 20px", textAlign: "center", color: "var(--muted-foreground)" }}>Motorsport team not found.</section></AppShell>;
  }

  return (
    <AppShell>
      <section style={{ padding: "56px 20px 32px", background: team.heroImageUrl ? `linear-gradient(rgba(0,0,0,0.58), rgba(0,0,0,0.72)), url(${team.heroImageUrl}) center / cover` : "linear-gradient(135deg, color-mix(in oklch, var(--primary) 16%, transparent), var(--background))" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          {team.logoUrl ? <img src={team.logoUrl} alt="" style={{ width: 112, height: 112, objectFit: "contain", borderRadius: 24, background: "rgba(255,255,255,0.92)", padding: 12 }} /> : null}
          <div>
            <div className="section-label" style={{ marginBottom: 12, color: team.heroImageUrl ? "rgba(255,255,255,0.72)" : "var(--primary)" }}>Motorsport Team</div>
            <h1 className="font-display text-display" style={{ color: team.heroImageUrl ? "#fff" : "var(--foreground)", margin: 0 }}>{team.name}</h1>
            <p style={{ margin: "10px 0 0", color: team.heroImageUrl ? "rgba(255,255,255,0.86)" : "var(--muted-foreground)", lineHeight: 1.7, maxWidth: 720 }}>
              {team.shortDescription || team.description || "Motorsport team profile and recent race entries."}
            </p>
          </div>
        </div>
      </section>
      <section style={{ padding: "24px 20px 48px", maxWidth: 1080, margin: "0 auto", display: "grid", gap: 20 }}>
        {(team.website || team.league || (team.currentDrivers?.length || 0) > 0 || (team.manufacturerSummary?.length || 0) > 0) ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {team.website ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Website</div><a href={team.website} target="_blank" rel="noreferrer" style={{ marginTop: 8, display: "inline-block", color: "var(--primary)", fontWeight: 800, textDecoration: "none" }}>{team.website.replace(/^https?:\/\//, "")}</a></div> : null}
            {team.league?.name ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Championship</div><div style={{ marginTop: 8, color: "var(--foreground)", fontWeight: 800 }}>{team.league.name}</div></div> : null}
            {(team.currentDrivers?.length || 0) > 0 ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Current Drivers</div><div style={{ marginTop: 8, color: "var(--foreground)", fontWeight: 800 }}>{team.currentDrivers?.map((driver) => driver.name).filter(Boolean).join(", ")}</div></div> : null}
            {(team.manufacturerSummary?.length || 0) > 0 ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Manufacturers</div><div style={{ marginTop: 8, color: "var(--foreground)", fontWeight: 800 }}>{team.manufacturerSummary?.map((manufacturer) => manufacturer.name).filter(Boolean).join(", ")}</div></div> : null}
          </div>
        ) : null}

        {team.description ? <div className="card-flat" style={{ padding: 20 }}><h2 className="font-display text-h3" style={{ margin: "0 0 12px", color: "var(--foreground)" }}>About</h2><p style={{ margin: 0, color: "var(--muted-foreground)", lineHeight: 1.8 }}>{team.description}</p></div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Next Race</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {!team.upcomingEntries || team.upcomingEntries.length === 0 ? <p style={{ margin: 0, color: "var(--muted-foreground)" }}>No upcoming race entries.</p> : team.upcomingEntries.slice(0, 1).map((row) => (
                <Link key={row.match.id} href={`/matches/${row.match.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--secondary)" }}>
                  <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{row.match.eventTitle || "Event"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{new Date(row.match.matchDateUtc).toLocaleString()}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Recent Entries</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {!team.recentEntries || team.recentEntries.length === 0 ? <p style={{ margin: 0, color: "var(--muted-foreground)" }}>No entries available.</p> : team.recentEntries.map((row) => (
                <Link key={row.match.id} href={`/matches/${row.match.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--secondary)" }}>
                  <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{row.match.eventTitle || "Event"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{new Date(row.match.matchDateUtc).toLocaleDateString()} · {row.driver?.slug ? row.driver.name : "Driver TBD"} · Finish {row.entry.finishPosition ?? "-"}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

