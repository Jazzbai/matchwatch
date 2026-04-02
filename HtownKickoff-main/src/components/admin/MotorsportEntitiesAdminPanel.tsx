"use client";

import * as React from "react";
import { api, ApiClientError } from "../../lib/api";

type League = { id: string; name: string };
type SourceValue = "NONE" | "GOOGLE" | "MANUAL" | null | undefined;

type DriverRow = {
  id: string;
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
  shortDescriptionSource?: SourceValue;
  descriptionSource?: SourceValue;
  primaryImageSource?: SourceValue;
  heroImageSource?: SourceValue;
  websiteSource?: SourceValue;
  enrichmentStatus?: "NEVER_SYNCED" | "SYNCED" | "ERROR";
  enrichedAt?: string | null;
  enrichmentError?: string | null;
  isActive: boolean;
};
type EntrantRow = {
  id: string;
  leagueId?: string | null;
  leagueName?: string | null;
  name: string;
  slug: string;
  shortName?: string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  website?: string | null;
  aliases?: string[] | null;
  shortDescription?: string | null;
  description?: string | null;
  shortDescriptionSource?: SourceValue;
  descriptionSource?: SourceValue;
  primaryImageSource?: SourceValue;
  heroImageSource?: SourceValue;
  websiteSource?: SourceValue;
  enrichmentStatus?: "NEVER_SYNCED" | "SYNCED" | "ERROR";
  enrichedAt?: string | null;
  enrichmentError?: string | null;
  isActive: boolean;
};
type ManufacturerRow = {
  id: string;
  leagueId?: string | null;
  leagueName?: string | null;
  name: string;
  slug: string;
  shortName?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  website?: string | null;
  aliases?: string[] | null;
  shortDescription?: string | null;
  description?: string | null;
  shortDescriptionSource?: SourceValue;
  descriptionSource?: SourceValue;
  primaryImageSource?: SourceValue;
  heroImageSource?: SourceValue;
  websiteSource?: SourceValue;
  enrichmentStatus?: "NEVER_SYNCED" | "SYNCED" | "ERROR";
  enrichedAt?: string | null;
  enrichmentError?: string | null;
  isActive: boolean;
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

function formatEnrichmentStatus(value?: "NEVER_SYNCED" | "SYNCED" | "ERROR") {
  if (!value || value === "NEVER_SYNCED") return "Never synced";
  if (value === "SYNCED") return "Synced";
  return "Error";
}

function sourceLabel(value?: SourceValue) {
  if (value === "MANUAL") return { label: "Manual", color: "#2563eb" };
  if (value === "GOOGLE") return { label: "Google", color: "#16a34a" };
  return { label: "None", color: "var(--muted-foreground)" };
}

function SourceBadge({ value }: { value?: SourceValue }) {
  const source = sourceLabel(value);
  return <span style={{ ...sourceBadgeStyle, color: source.color }}>{source.label}</span>;
}

export function MotorsportEntitiesAdminPanel() {
  const [mode, setMode] = React.useState<"drivers" | "entrants" | "manufacturers">("drivers");
  const [drivers, setDrivers] = React.useState<DriverRow[]>([]);
  const [entrants, setEntrants] = React.useState<EntrantRow[]>([]);
  const [manufacturers, setManufacturers] = React.useState<ManufacturerRow[]>([]);
  const [leagues, setLeagues] = React.useState<League[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const emptyDraft = React.useMemo(() => ({
    leagueId: "",
    name: "",
    shortName: "",
    nationality: "",
    countryCode: "",
    headshotUrl: "",
    heroImageUrl: "",
    brandColor: "",
    logoUrl: "",
    website: "",
    aliases: "",
    shortDescription: "",
    description: "",
    externalId: "",
    isActive: true,
  }), []);
  const [draft, setDraft] = React.useState(emptyDraft);

  const currentRows = mode === "drivers" ? drivers : mode === "entrants" ? entrants : manufacturers;

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [driversRes, entrantsRes, manufacturersRes, leaguesRes] = await Promise.all([
        api.get<DriverRow[]>("/super-admin/drivers", { page: 1, limit: 100, search }),
        api.get<EntrantRow[]>("/super-admin/entrants", { page: 1, limit: 100, search }),
        api.get<ManufacturerRow[]>("/super-admin/manufacturers", { page: 1, limit: 100, search }),
        api.get<League[]>("/super-admin/leagues", { page: 1, limit: 200 }),
      ]);
      setDrivers(driversRes.data || []);
      setEntrants(entrantsRes.data || []);
      setManufacturers(manufacturersRes.data || []);
      setLeagues((leaguesRes.data || []).map((item: any) => ({ id: item.id, name: item.name })));
    } catch (err) {
      setError(formatError(err, "Failed to load motorsport entities."));
    }
  }, [search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const row = currentRows.find((item) => item.id === selectedId) as any;
    if (!row) return;
    setDraft({
      leagueId: row.leagueId || "",
      name: row.name || "",
      shortName: row.shortName || "",
      nationality: row.nationality || "",
      countryCode: row.countryCode || "",
      headshotUrl: row.headshotUrl || "",
      heroImageUrl: row.heroImageUrl || "",
      brandColor: row.brandColor || "",
      logoUrl: row.logoUrl || "",
      website: row.website || "",
      aliases: (row.aliases || []).join(", "),
      shortDescription: row.shortDescription || "",
      description: row.description || "",
      externalId: "",
      isActive: row.isActive,
    });
  }, [currentRows, selectedId]);

  async function save() {
    setError(null);
    setMessage(null);
    try {
      if (mode === "drivers") {
        const payload = {
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
        if (selectedId) await api.patch(`/super-admin/drivers/${selectedId}`, payload);
        else await api.post("/super-admin/drivers", payload);
      } else if (mode === "entrants") {
        const payload = {
          leagueId: draft.leagueId || null,
          name: draft.name,
          shortName: draft.shortName || null,
          brandColor: draft.brandColor || null,
          logoUrl: draft.logoUrl || null,
          heroImageUrl: draft.heroImageUrl || null,
          website: draft.website || null,
          aliases: draft.aliases.split(",").map((item) => item.trim()).filter(Boolean),
          shortDescription: draft.shortDescription || null,
          description: draft.description || null,
          externalId: draft.externalId || null,
          isActive: draft.isActive,
        };
        if (selectedId) await api.patch(`/super-admin/entrants/${selectedId}`, payload);
        else await api.post("/super-admin/entrants", payload);
      } else {
        const payload = {
          leagueId: draft.leagueId || null,
          name: draft.name,
          shortName: draft.shortName || null,
          logoUrl: draft.logoUrl || null,
          heroImageUrl: draft.heroImageUrl || null,
          website: draft.website || null,
          aliases: draft.aliases.split(",").map((item) => item.trim()).filter(Boolean),
          shortDescription: draft.shortDescription || null,
          description: draft.description || null,
          externalId: draft.externalId || null,
          isActive: draft.isActive,
        };
        if (selectedId) await api.patch(`/super-admin/manufacturers/${selectedId}`, payload);
        else await api.post("/super-admin/manufacturers", payload);
      }
      setMessage(`${mode === "drivers" ? "Driver" : mode === "entrants" ? "Motorsport team" : "Manufacturer"} saved.`);
      await load();
    } catch (err) {
      setError(formatError(err, "Failed to save entity."));
    }
  }

  async function refreshEnrichment() {
    if (!selectedId) return;
    setError(null);
    setMessage(null);
    try {
      const kind = mode === "drivers" ? "driver" : mode === "entrants" ? "entrant" : "manufacturer";
      await api.post(`/super-admin/enrichment/${kind}/${selectedId}/refresh`);
      setMessage("Enrichment refreshed.");
      await load();
    } catch (err) {
      setError(formatError(err, "Failed to refresh enrichment."));
    }
  }

  async function revertToDefaults() {
    if (!selectedId) return;
    setError(null);
    setMessage(null);
    try {
      const kind = mode === "drivers" ? "driver" : mode === "entrants" ? "entrant" : "manufacturer";
      await api.post(`/super-admin/enrichment/${kind}/${selectedId}/revert`);
      setMessage("Entity reverted to enrichment defaults.");
      await load();
    } catch (err) {
      setError(formatError(err, "Failed to revert enrichment defaults."));
    }
  }

  const selectedRow = (currentRows.find((item: any) => item.id === selectedId) as any) || null;

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Motorsport</div>
          <h2 className="font-display text-h2" style={{ margin: 0, color: "var(--foreground)" }}>Drivers, Teams, Manufacturers</h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["drivers", "Drivers"],
            ["entrants", "Motorsport Teams"],
            ["manufacturers", "Manufacturers"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => { setMode(id as typeof mode); setSelectedId(null); setDraft(emptyDraft); }} style={btnStyle(mode === id ? "primary" : "outline")}>{label}</button>
          ))}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" style={{ ...inputStyle, width: 180 }} />
          <button style={btnStyle()} onClick={() => void load()}>Refresh</button>
        </div>
      </div>
      {message ? <div style={{ color: "#16a34a", fontSize: 13 }}>{message}</div> : null}
      {error ? <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 16 }}>
        <div className="card-flat" style={{ padding: 14, display: "grid", gap: 10 }}>
          {currentRows.map((row: any) => (
            <button key={row.id} onClick={() => setSelectedId(row.id)} style={{ ...btnStyle(selectedId === row.id ? "primary" : "outline"), textAlign: "left" }}>
              <div>{row.name}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{row.leagueName || row.slug}</div>
              <div style={{ fontSize: 10, opacity: 0.75 }}>{sourceLabel(row.shortDescriptionSource).label} copy | {formatEnrichmentStatus(row.enrichmentStatus)}</div>
            </button>
          ))}
        </div>
        <div className="card-flat" style={{ padding: 16, display: "grid", gap: 12 }}>
          {(mode === "entrants" || mode === "manufacturers") ? (
            <select value={draft.leagueId} onChange={(e) => setDraft((prev) => ({ ...prev, leagueId: e.target.value }))} style={inputStyle}>
              <option value="">League</option>
              {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
            </select>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" style={inputStyle} />
            <input value={draft.shortName} onChange={(e) => setDraft((prev) => ({ ...prev, shortName: e.target.value }))} placeholder="Short name" style={inputStyle} />
            {mode === "drivers" ? (
              <>
                <input value={draft.nationality} onChange={(e) => setDraft((prev) => ({ ...prev, nationality: e.target.value }))} placeholder="Nationality" style={inputStyle} />
                <input value={draft.countryCode} onChange={(e) => setDraft((prev) => ({ ...prev, countryCode: e.target.value }))} placeholder="Country code" style={inputStyle} />
                <input value={draft.headshotUrl} onChange={(e) => setDraft((prev) => ({ ...prev, headshotUrl: e.target.value }))} placeholder="Headshot URL" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              </>
            ) : (
              <>
                {mode === "entrants" ? <input value={draft.brandColor} onChange={(e) => setDraft((prev) => ({ ...prev, brandColor: e.target.value }))} placeholder="Brand color" style={inputStyle} /> : null}
                <input value={draft.logoUrl} onChange={(e) => setDraft((prev) => ({ ...prev, logoUrl: e.target.value }))} placeholder="Logo URL" style={mode === "entrants" ? inputStyle : { ...inputStyle, gridColumn: "1 / -1" }} />
              </>
            )}
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
                Enrichment: {formatEnrichmentStatus(selectedRow.enrichmentStatus)}
                {selectedRow.enrichedAt ? ` | ${new Date(selectedRow.enrichedAt).toLocaleString()}` : ""}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{mode === "drivers" ? "Headshot" : "Logo"}</span><SourceBadge value={selectedRow.primaryImageSource} /></div>
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
            <button style={btnStyle("primary")} onClick={() => void save()}>Save</button>
            <button style={btnStyle()} onClick={() => void refreshEnrichment()} disabled={!selectedId}>Refresh Enrichment</button>
            <button style={btnStyle()} onClick={() => void revertToDefaults()} disabled={!selectedId}>Revert to Defaults</button>
            <button style={btnStyle()} onClick={() => { setSelectedId(null); setDraft(emptyDraft); }}>Clear</button>
          </div>
        </div>
      </div>
    </section>
  );
}
