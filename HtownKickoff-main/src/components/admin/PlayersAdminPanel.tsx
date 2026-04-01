"use client";

import * as React from "react";
import { api, ApiClientError } from "../../lib/api";

type PlayerRow = {
  id: string;
  sportId?: string | null;
  sportName?: string | null;
  leagueId?: string | null;
  leagueName?: string | null;
  name: string;
  slug: string;
  shortName?: string | null;
  nationality?: string | null;
  countryCode?: string | null;
  headshotUrl?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  isActive: boolean;
};

type Lookup = { id: string; name: string };

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

const btnStyle = (kind: "primary" | "outline" = "outline"): React.CSSProperties => ({
  borderRadius: 10,
  border: kind === "primary" ? "none" : "1px solid var(--border)",
  background: kind === "primary" ? "var(--primary)" : "var(--secondary)",
  color: kind === "primary" ? "var(--primary-foreground)" : "var(--foreground)",
  padding: "9px 12px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
});

function formatError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

export function PlayersAdminPanel() {
  const [players, setPlayers] = React.useState<PlayerRow[]>([]);
  const [sports, setSports] = React.useState<Lookup[]>([]);
  const [leagues, setLeagues] = React.useState<Lookup[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState({
    sportId: "",
    leagueId: "",
    name: "",
    shortName: "",
    nationality: "",
    countryCode: "",
    headshotUrl: "",
    externalId: "",
    isActive: true,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [playersRes, sportsRes, leaguesRes] = await Promise.all([
        api.get<PlayerRow[]>("/super-admin/players", { page: 1, limit: 100, search }),
        api.get<Lookup[]>("/super-admin/sports", { page: 1, limit: 200 }),
        api.get<Array<Lookup & { sportName?: string | null }>>("/super-admin/leagues", { page: 1, limit: 200 }),
      ]);
      setPlayers(playersRes.data || []);
      setSports((sportsRes.data || []).map((item: any) => ({ id: item.id, name: item.name })));
      setLeagues((leaguesRes.data || []).map((item: any) => ({ id: item.id, name: item.name })));
    } catch (err) {
      setError(formatError(err, "Failed to load players."));
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const row = players.find((item) => item.id === selectedId);
    if (!row) return;
    setDraft({
      sportId: row.sportId || "",
      leagueId: row.leagueId || "",
      name: row.name || "",
      shortName: row.shortName || "",
      nationality: row.nationality || "",
      countryCode: row.countryCode || "",
      headshotUrl: row.headshotUrl || "",
      externalId: "",
      isActive: row.isActive,
    });
  }, [players, selectedId]);

  async function save() {
    setError(null);
    setMessage(null);
    try {
      const payload = {
        sportId: draft.sportId || null,
        leagueId: draft.leagueId || null,
        name: draft.name,
        shortName: draft.shortName || null,
        nationality: draft.nationality || null,
        countryCode: draft.countryCode || null,
        headshotUrl: draft.headshotUrl || null,
        externalId: draft.externalId || null,
        isActive: draft.isActive,
      };
      if (selectedId) {
        await api.patch(`/super-admin/players/${selectedId}`, payload);
        setMessage("Player updated.");
      } else {
        await api.post("/super-admin/players", payload);
        setMessage("Player created.");
      }
      await load();
      if (!selectedId) {
        setDraft({ sportId: "", leagueId: "", name: "", shortName: "", nationality: "", countryCode: "", headshotUrl: "", externalId: "", isActive: true });
      }
    } catch (err) {
      setError(formatError(err, "Failed to save player."));
    }
  }

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Players</div>
          <h2 className="font-display text-h2" style={{ margin: 0, color: "var(--foreground)" }}>Player Directory</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players" style={{ ...inputStyle, width: 220 }} />
          <button style={btnStyle()} onClick={() => void load()} disabled={loading}>Refresh</button>
          <button style={btnStyle("primary")} onClick={() => { setSelectedId(null); setDraft({ sportId: "", leagueId: "", name: "", shortName: "", nationality: "", countryCode: "", headshotUrl: "", externalId: "", isActive: true }); }}>New Player</button>
        </div>
      </div>
      {message ? <div style={{ color: "#16a34a", fontSize: 13 }}>{message}</div> : null}
      {error ? <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) minmax(0, 1fr)", gap: 16 }}>
        <div className="card-flat" style={{ padding: 14, display: "grid", gap: 10 }}>
          {(players || []).map((row) => (
            <button key={row.id} onClick={() => setSelectedId(row.id)} style={{ ...btnStyle(selectedId === row.id ? "primary" : "outline"), textAlign: "left" }}>
              <div>{row.name}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{row.leagueName || row.sportName || row.slug}</div>
            </button>
          ))}
        </div>
        <div className="card-flat" style={{ padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <select value={draft.sportId} onChange={(e) => setDraft((prev) => ({ ...prev, sportId: e.target.value }))} style={inputStyle}>
              <option value="">Sport</option>
              {sports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={draft.leagueId} onChange={(e) => setDraft((prev) => ({ ...prev, leagueId: e.target.value }))} style={inputStyle}>
              <option value="">League</option>
              {leagues.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" style={inputStyle} />
            <input value={draft.shortName} onChange={(e) => setDraft((prev) => ({ ...prev, shortName: e.target.value }))} placeholder="Short name" style={inputStyle} />
            <input value={draft.nationality} onChange={(e) => setDraft((prev) => ({ ...prev, nationality: e.target.value }))} placeholder="Nationality" style={inputStyle} />
            <input value={draft.countryCode} onChange={(e) => setDraft((prev) => ({ ...prev, countryCode: e.target.value }))} placeholder="Country code" style={inputStyle} />
            <input value={draft.headshotUrl} onChange={(e) => setDraft((prev) => ({ ...prev, headshotUrl: e.target.value }))} placeholder="Headshot URL" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
            <input value={draft.externalId} onChange={(e) => setDraft((prev) => ({ ...prev, externalId: e.target.value }))} placeholder="External ID" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--foreground)", fontSize: 14 }}>
            <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((prev) => ({ ...prev, isActive: e.target.checked }))} />
            Active
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnStyle("primary")} onClick={() => void save()}>Save Player</button>
            {selectedId ? <button style={btnStyle()} onClick={() => setSelectedId(null)}>Clear</button> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
