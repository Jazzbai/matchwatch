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
  heroImageUrl?: string | null;
  website?: string | null;
  aliases?: string[] | null;
  shortDescription?: string | null;
  description?: string | null;
  shortDescriptionSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
  descriptionSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
  primaryImageSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
  heroImageSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
  websiteSource?: "NONE" | "GOOGLE" | "MANUAL" | null;
  enrichedAt?: string | null;
  enrichmentStatus?: "NEVER_SYNCED" | "SYNCED" | "ERROR";
  enrichmentError?: string | null;
  enrichmentSnapshot?: Record<string, unknown> | null;
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

const sourceBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  border: "1px solid var(--border)",
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 700,
  background: "var(--secondary)",
};

function formatError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

function sourceLabel(value?: "NONE" | "GOOGLE" | "MANUAL" | null) {
  if (value === "MANUAL") return { label: "Manual", color: "#2563eb" };
  if (value === "GOOGLE") return { label: "Google", color: "#16a34a" };
  return { label: "None", color: "var(--muted-foreground)" };
}

function SourceBadge({ value }: { value?: "NONE" | "GOOGLE" | "MANUAL" | null }) {
  const source = sourceLabel(value);
  return <span style={{ ...sourceBadgeStyle, color: source.color }}>{source.label}</span>;
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
  const emptyDraft = React.useMemo(() => ({
    sportId: "",
    leagueId: "",
    name: "",
    shortName: "",
    nationality: "",
    countryCode: "",
    headshotUrl: "",
    heroImageUrl: "",
    website: "",
    aliases: "",
    shortDescription: "",
    description: "",
    externalId: "",
    isActive: true,
  }), []);
  const [draft, setDraft] = React.useState(emptyDraft);

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
      heroImageUrl: row.heroImageUrl || "",
      website: row.website || "",
      aliases: (row.aliases || []).join(", "),
      shortDescription: row.shortDescription || "",
      description: row.description || "",
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
        heroImageUrl: draft.heroImageUrl || null,
        website: draft.website || null,
        aliases: draft.aliases.split(",").map((item) => item.trim()).filter(Boolean),
        shortDescription: draft.shortDescription || null,
        description: draft.description || null,
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
      if (!selectedId) setDraft(emptyDraft);
    } catch (err) {
      setError(formatError(err, "Failed to save player."));
    }
  }

  async function refreshEnrichment() {
    if (!selectedId) return;
    setError(null);
    setMessage(null);
    try {
      await api.post(`/super-admin/enrichment/player/${selectedId}/refresh`);
      setMessage("Player enrichment refreshed.");
      await load();
    } catch (err) {
      setError(formatError(err, "Failed to refresh player enrichment."));
    }
  }

  async function revertToDefaults() {
    if (!selectedId) return;
    setError(null);
    setMessage(null);
    try {
      await api.post(`/super-admin/enrichment/player/${selectedId}/revert`);
      setMessage("Player reverted to enrichment defaults.");
      await load();
    } catch (err) {
      setError(formatError(err, "Failed to revert player defaults."));
    }
  }

  const selectedRow = players.find((item) => item.id === selectedId) || null;

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
          <button style={btnStyle("primary")} onClick={() => { setSelectedId(null); setDraft(emptyDraft); }}>New Player</button>
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
              <div style={{ fontSize: 10, opacity: 0.75 }}>{sourceLabel(row.shortDescriptionSource).label} copy | {row.enrichmentStatus || "NEVER_SYNCED"}</div>
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
            <input value={draft.heroImageUrl} onChange={(e) => setDraft((prev) => ({ ...prev, heroImageUrl: e.target.value }))} placeholder="Hero image URL" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
            <input value={draft.website} onChange={(e) => setDraft((prev) => ({ ...prev, website: e.target.value }))} placeholder="Website" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
            <input value={draft.aliases} onChange={(e) => setDraft((prev) => ({ ...prev, aliases: e.target.value }))} placeholder="Aliases (comma separated)" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
            <input value={draft.externalId} onChange={(e) => setDraft((prev) => ({ ...prev, externalId: e.target.value }))} placeholder="External ID" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
            <textarea value={draft.shortDescription} onChange={(e) => setDraft((prev) => ({ ...prev, shortDescription: e.target.value }))} placeholder="Short description" style={{ ...inputStyle, gridColumn: "1 / -1", minHeight: 80, resize: "vertical" }} />
            <textarea value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" style={{ ...inputStyle, gridColumn: "1 / -1", minHeight: 140, resize: "vertical" }} />
          </div>
          {selectedId && selectedRow ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Enrichment: {selectedRow.enrichmentStatus || "NEVER_SYNCED"}
                {selectedRow.enrichedAt ? ` | ${new Date(selectedRow.enrichedAt).toLocaleString()}` : ""}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Headshot</span><SourceBadge value={selectedRow.primaryImageSource} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Hero</span><SourceBadge value={selectedRow.heroImageSource} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Website</span><SourceBadge value={selectedRow.websiteSource} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Excerpt</span><SourceBadge value={selectedRow.shortDescriptionSource} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>About</span><SourceBadge value={selectedRow.descriptionSource} /></div>
              </div>
              {selectedRow.enrichmentError ? <div style={{ color: "#ef4444", fontSize: 12 }}>{selectedRow.enrichmentError}</div> : null}
            </div>
          ) : null}
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--foreground)", fontSize: 14 }}>
            <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((prev) => ({ ...prev, isActive: e.target.checked }))} />
            Active
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btnStyle("primary")} onClick={() => void save()}>Save Player</button>
            <button style={btnStyle()} onClick={() => void refreshEnrichment()} disabled={!selectedId}>Refresh Enrichment</button>
            <button style={btnStyle()} onClick={() => void revertToDefaults()} disabled={!selectedId}>Revert to Defaults</button>
            {selectedId ? <button style={btnStyle()} onClick={() => setSelectedId(null)}>Clear</button> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
