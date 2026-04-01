"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { AppShell } from "../../../components/AppShell";
import { api } from "../../../lib/api";

type DriverDetail = {
  id: string;
  name: string;
  shortName?: string | null;
  headshotUrl?: string | null;
  heroImageUrl?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  nationality?: string | null;
  entries: Array<{
    match: { id: string; eventTitle?: string | null; matchDateUtc: string; status: string };
    league?: { name?: string | null; slug?: string | null } | null;
    entrant?: { name?: string | null; slug?: string | null } | null;
    manufacturer?: { name?: string | null } | null;
    entry: { finishPosition?: number | null; gridPosition?: number | null; points?: string | number | null };
  }>;
};

export default function DriverPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [driver, setDriver] = React.useState<DriverDetail | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await api.get<DriverDetail>(`/drivers/${slug}`);
        if (!cancelled) setDriver(response.data || null);
      } catch {
        if (!cancelled) setDriver(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!driver) {
    return <AppShell><section style={{ padding: "64px 20px", textAlign: "center", color: "var(--muted-foreground)" }}>Driver not found.</section></AppShell>;
  }

  return (
    <AppShell>
      <section style={{ padding: "56px 20px 32px", background: driver.heroImageUrl ? `linear-gradient(rgba(0,0,0,0.58), rgba(0,0,0,0.72)), url(${driver.heroImageUrl}) center / cover` : "linear-gradient(135deg, color-mix(in oklch, var(--primary) 16%, transparent), var(--background))" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          {driver.headshotUrl ? <img src={driver.headshotUrl} alt="" style={{ width: 112, height: 112, objectFit: "cover", borderRadius: 24, border: "3px solid rgba(255,255,255,0.3)" }} /> : null}
          <div>
            <div className="section-label" style={{ marginBottom: 12, color: driver.heroImageUrl ? "rgba(255,255,255,0.72)" : "var(--primary)" }}>Driver</div>
            <h1 className="font-display text-display" style={{ color: driver.heroImageUrl ? "#fff" : "var(--foreground)", margin: 0 }}>{driver.name}</h1>
            <p style={{ margin: "10px 0 0", color: driver.heroImageUrl ? "rgba(255,255,255,0.86)" : "var(--muted-foreground)", lineHeight: 1.7, maxWidth: 720 }}>
              {driver.shortDescription || driver.description || "Driver profile and recent race results."}
            </p>
          </div>
        </div>
      </section>
      <section style={{ padding: "24px 20px 48px", maxWidth: 1080, margin: "0 auto", display: "grid", gap: 20 }}>
        {driver.description ? <div className="card-flat" style={{ padding: 20 }}><h2 className="font-display text-h3" style={{ margin: "0 0 12px", color: "var(--foreground)" }}>About</h2><p style={{ margin: 0, color: "var(--muted-foreground)", lineHeight: 1.8 }}>{driver.description}</p></div> : null}
        <div className="card-flat" style={{ padding: 20 }}>
          <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Recent Events</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {driver.entries.length === 0 ? <p style={{ margin: 0, color: "var(--muted-foreground)" }}>No events available.</p> : driver.entries.map((row) => (
              <Link key={row.match.id} href={`/matches/${row.match.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--secondary)" }}>
                <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{row.match.eventTitle || "Event"}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                  {new Date(row.match.matchDateUtc).toLocaleDateString()} · {row.entrant?.slug ? <span><Link href={`/motorsport/teams/${row.entrant.slug}`} style={{ color: "var(--primary)", textDecoration: "none" }}>{row.entrant.name}</Link> · </span> : null}
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
