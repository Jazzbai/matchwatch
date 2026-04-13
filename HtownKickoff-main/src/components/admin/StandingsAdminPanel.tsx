"use client";

import * as React from "react";
import { api, ApiClientError } from "../../lib/api";

type League = { id: string; name: string };
type StandingsPayload = {
  rows: Array<{ rank: number; points: number; played: number; wins: number; draws: number; losses: number; team?: { name?: string | null } | null }>;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--secondary)",
  color: "var(--foreground)",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
};

const btnStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--secondary)",
  color: "var(--foreground)",
  padding: "9px 12px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

function formatError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

export function StandingsAdminPanel() {
  const [leagues, setLeagues] = React.useState<League[]>([]);
  const [leagueId, setLeagueId] = React.useState("");
  const [data, setData] = React.useState<StandingsPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadLeagues() {
      try {
        const response = await api.get<League[]>("/super-admin/leagues", { page: 1, limit: 200 });
        const rows = (response.data || []).map((item: any) => ({ id: item.id, name: item.name }));
        setLeagues(rows);
        if (!leagueId && rows[0]) setLeagueId(rows[0].id);
      } catch (err) {
        setError(formatError(err, "Failed to load leagues."));
      }
    }
    void loadLeagues();
  }, [leagueId]);

  async function load(refresh = false) {
    if (!leagueId) return;
    setError(null);
    try {
      const response = refresh
        ? await api.post<any>(`/super-admin/standings/${leagueId}/refresh`)
        : await api.get<StandingsPayload>(`/super-admin/standings/${leagueId}`);
      setData(response.data.snapshot ? response.data : response.data);
    } catch (err) {
      setError(formatError(err, "Failed to load standings."));
    }
  }

  const rows = data && "rows" in data ? data.rows : (data as any)?.rows || [];

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Standings</div>
        <h2 className="font-display text-h2" style={{ margin: 0, color: "var(--foreground)" }}>League Tables</h2>
      </div>
      {error ? <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)} style={{ ...inputStyle, width: 280 }}>
          <option value="">Select league</option>
          {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
        </select>
        <button style={btnStyle} onClick={() => void load(false)}>Load</button>
        <button style={btnStyle} onClick={() => void load(true)}>Refresh Snapshot</button>
      </div>
      <div className="card-flat" style={{ padding: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 12 }}>
              <th style={{ padding: "10px 8px" }}>#</th>
              <th style={{ padding: "10px 8px" }}>Team</th>
              <th style={{ padding: "10px 8px" }}>P</th>
              <th style={{ padding: "10px 8px" }}>W</th>
              <th style={{ padding: "10px 8px" }}>D</th>
              <th style={{ padding: "10px 8px" }}>L</th>
              <th style={{ padding: "10px 8px" }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any) => (
              <tr key={row.rank} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 8px" }}>{row.rank}</td>
                <td style={{ padding: "12px 8px" }}>{row.team?.name || "-"}</td>
                <td style={{ padding: "12px 8px" }}>{row.played}</td>
                <td style={{ padding: "12px 8px" }}>{row.wins}</td>
                <td style={{ padding: "12px 8px" }}>{row.draws}</td>
                <td style={{ padding: "12px 8px" }}>{row.losses}</td>
                <td style={{ padding: "12px 8px" }}>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
