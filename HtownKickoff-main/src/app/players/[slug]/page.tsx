"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { AppShell } from "../../../components/AppShell";
import { api } from "../../../lib/api";

type PlayerDetail = {
  id: string;
  name: string;
  shortName?: string | null;
  headshotUrl?: string | null;
  heroImageUrl?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  nationality?: string | null;
  sport?: { id: string; name: string; slug: string } | null;
  league?: { id: string; name: string; slug: string } | null;
  matches: Array<{ match: { id: string; matchDateUtc: string; status: string; eventTitle?: string | null; eventSubtitle?: string | null } }>;
};

export default function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [player, setPlayer] = React.useState<PlayerDetail | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await api.get<PlayerDetail>(`/players/${slug}`);
        if (!cancelled) setPlayer(response.data || null);
      } catch {
        if (!cancelled) setPlayer(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!player) {
    return <AppShell><section style={{ padding: "64px 20px", textAlign: "center", color: "var(--muted-foreground)" }}>Player not found.</section></AppShell>;
  }

  return (
    <AppShell>
      <section style={{ padding: "56px 20px 32px", background: player.heroImageUrl ? `linear-gradient(rgba(0,0,0,0.58), rgba(0,0,0,0.72)), url(${player.heroImageUrl}) center / cover` : "linear-gradient(135deg, color-mix(in oklch, var(--primary) 16%, transparent), var(--background))" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          {player.headshotUrl ? <img src={player.headshotUrl} alt="" style={{ width: 112, height: 112, objectFit: "cover", borderRadius: 24, border: "3px solid rgba(255,255,255,0.3)" }} /> : null}
          <div>
            <div className="section-label" style={{ marginBottom: 12, color: player.heroImageUrl ? "rgba(255,255,255,0.72)" : "var(--primary)" }}>{player.sport?.name || "Player"}</div>
            <h1 className="font-display text-display" style={{ color: player.heroImageUrl ? "#fff" : "var(--foreground)", margin: 0 }}>{player.name}</h1>
            <p style={{ margin: "10px 0 0", color: player.heroImageUrl ? "rgba(255,255,255,0.86)" : "var(--muted-foreground)", lineHeight: 1.7, maxWidth: 720 }}>
              {player.shortDescription || player.description || "Player profile, schedule, and recent results."}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
              {player.league ? <Link href={`/leagues/${player.league.slug}`} style={{ color: player.heroImageUrl ? "#fff" : "var(--primary)", fontWeight: 700, textDecoration: "none" }}>{player.league.name}</Link> : null}
              {player.nationality ? <span style={{ color: player.heroImageUrl ? "rgba(255,255,255,0.8)" : "var(--muted-foreground)" }}>{player.nationality}</span> : null}
            </div>
          </div>
        </div>
      </section>
      <section style={{ padding: "24px 20px 48px", maxWidth: 1040, margin: "0 auto", display: "grid", gap: 20 }}>
        {player.description ? <div className="card-flat" style={{ padding: 20 }}><h2 className="font-display text-h3" style={{ margin: "0 0 12px", color: "var(--foreground)" }}>About</h2><p style={{ margin: 0, color: "var(--muted-foreground)", lineHeight: 1.8 }}>{player.description}</p></div> : null}
        <div className="card-flat" style={{ padding: 20 }}>
          <h2 className="font-display text-h3" style={{ margin: "0 0 14px", color: "var(--foreground)" }}>Recent and Upcoming Matches</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {player.matches.length === 0 ? <p style={{ margin: 0, color: "var(--muted-foreground)" }}>No matches available.</p> : player.matches.map(({ match }) => (
              <Link key={match.id} href={`/matches/${match.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--secondary)" }}>
                <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{match.eventTitle || "Match"}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{new Date(match.matchDateUtc).toLocaleString()} · {match.status}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
