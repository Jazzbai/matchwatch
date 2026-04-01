"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { AppShell } from "../../../../components/AppShell";
import { api } from "../../../../lib/api";

type MotorsportTeamDetail = {
  id: string;
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  league?: { name?: string | null; slug?: string | null } | null;
  entries: Array<{
    match: { id: string; eventTitle?: string | null; matchDateUtc: string };
    driver?: { name?: string | null; slug?: string | null } | null;
    manufacturer?: { name?: string | null } | null;
    entry: { finishPosition?: number | null; gridPosition?: number | null; points?: string | number | null };
  }>;
};

export default function MotorsportTeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
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
        {team.description ? <div className="card-flat" style={{ padding: 20 }}><h2 className="font-display text-h3" style={{ margin: "0 0 12px", color: "var(--foreground)" }}>About</h2><p style={{ margin: 0, color: "var(--muted-foreground)", lineHeight: 1.8 }}>{team.description}</p></div> : null}
        <div className="card-flat" style={{ padding: 20 }}>
          <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Recent Entries</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {team.entries.length === 0 ? <p style={{ margin: 0, color: "var(--muted-foreground)" }}>No entries available.</p> : team.entries.map((row) => (
              <Link key={row.match.id} href={`/matches/${row.match.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--secondary)" }}>
                <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{row.match.eventTitle || "Event"}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                  {new Date(row.match.matchDateUtc).toLocaleDateString()} · {row.driver?.slug ? <span><Link href={`/drivers/${row.driver.slug}`} style={{ color: "var(--primary)", textDecoration: "none" }}>{row.driver.name}</Link> · </span> : null}
                  Finish {row.entry.finishPosition ?? "-"} · Grid {row.entry.gridPosition ?? "-"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
