"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { api } from "../../../lib/api";

type EntryRow = {
  match: { id: string; eventTitle?: string | null; matchDateUtc: string; status: string };
  league?: { name?: string | null; slug?: string | null } | null;
  entrant?: { name?: string | null; slug?: string | null } | null;
  manufacturer?: { name?: string | null } | null;
  entry: { finishPosition?: number | null; gridPosition?: number | null; points?: string | number | null };
};

type DriverDetail = {
  id: string;
  name: string;
  shortName?: string | null;
  headshotUrl?: string | null;
  heroImageUrl?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  nationality?: string | null;
  website?: string | null;
  canonicalSlug?: string;
  canonicalPath?: string;
  currentContext?: {
    league?: { name?: string | null; slug?: string | null } | null;
    entrant?: { name?: string | null; slug?: string | null } | null;
    manufacturer?: { name?: string | null } | null;
    nextEvent?: { id: string; eventTitle?: string | null; matchDateUtc: string; status: string } | null;
  } | null;
  entries: EntryRow[];
  recentEntries?: EntryRow[];
  upcomingEntries?: EntryRow[];
};

export default function DriverPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
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

  React.useEffect(() => {
    if (driver?.canonicalSlug && driver.canonicalSlug !== slug && driver.canonicalPath) {
      router.replace(driver.canonicalPath);
    }
  }, [driver?.canonicalPath, driver?.canonicalSlug, router, slug]);

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
        {(driver.nationality || driver.website || driver.currentContext?.entrant || driver.currentContext?.manufacturer) ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {driver.nationality ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Nationality</div><div style={{ marginTop: 8, color: "var(--foreground)", fontWeight: 800 }}>{driver.nationality}</div></div> : null}
            {driver.website ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Website</div><a href={driver.website} target="_blank" rel="noreferrer" style={{ marginTop: 8, display: "inline-block", color: "var(--primary)", fontWeight: 800, textDecoration: "none" }}>{driver.website.replace(/^https?:\/\//, "")}</a></div> : null}
            {driver.currentContext?.entrant?.slug ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Current Team</div><Link href={`/motorsport/teams/${driver.currentContext.entrant.slug}`} style={{ marginTop: 8, display: "inline-block", color: "var(--primary)", fontWeight: 800, textDecoration: "none" }}>{driver.currentContext.entrant.name}</Link></div> : null}
            {driver.currentContext?.manufacturer?.name ? <div className="card-flat" style={{ padding: 16 }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Manufacturer</div><div style={{ marginTop: 8, color: "var(--foreground)", fontWeight: 800 }}>{driver.currentContext.manufacturer.name}</div></div> : null}
          </div>
        ) : null}

        {driver.description ? <div className="card-flat" style={{ padding: 20 }}><h2 className="font-display text-h3" style={{ margin: "0 0 12px", color: "var(--foreground)" }}>About</h2><p style={{ margin: 0, color: "var(--muted-foreground)", lineHeight: 1.8 }}>{driver.description}</p></div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Upcoming Events</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {!driver.upcomingEntries || driver.upcomingEntries.length === 0 ? <p style={{ margin: 0, color: "var(--muted-foreground)" }}>No upcoming events.</p> : driver.upcomingEntries.map((row) => (
                <Link key={row.match.id} href={`/matches/${row.match.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--secondary)" }}>
                  <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{row.match.eventTitle || "Event"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{new Date(row.match.matchDateUtc).toLocaleString()} · {row.entrant?.name || "Entry TBD"}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="card-flat" style={{ padding: 20 }}>
            <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Recent Results</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {!driver.recentEntries || driver.recentEntries.length === 0 ? <p style={{ margin: 0, color: "var(--muted-foreground)" }}>No recent results.</p> : driver.recentEntries.map((row) => (
                <Link key={row.match.id} href={`/matches/${row.match.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--secondary)" }}>
                  <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{row.match.eventTitle || "Event"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>Finish {row.entry.finishPosition ?? "-"} · Grid {row.entry.gridPosition ?? "-"} · {new Date(row.match.matchDateUtc).toLocaleDateString()}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

