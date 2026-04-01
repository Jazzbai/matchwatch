"use client";

import * as React from "react";
import { api, ApiClientError } from "../../lib/api";

type League = { id: string; name: string };
type DriverRow = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  nationality?: string | null;
  countryCode?: string | null;
  headshotUrl?: string | null;
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

function formatError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
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
  const [draft, setDraft] = React.useState({
    leagueId: "",
    name: "",
    shortName: "",
    nationality: "",
    countryCode: "",
    headshotUrl: "",
    brandColor: "",
    logoUrl: "",
    externalId: "",
    isActive: true,
  });

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
      brandColor: row.brandColor || "",
      logoUrl: row.logoUrl || "",
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
            <button key={id} onClick={() => { setMode(id as typeof mode); setSelectedId(null); }} style={btnStyle(mode === id ? "primary" : "outline")}>{label}</button>
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
            <button key={row.id} onClick={() => setSelectedId(row.id)} style={btnStyle(selectedId === row.id ? "primary" : "outline")}>
              <div>{row.name}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{row.leagueName || row.slug}</div>
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
            <input value={draft.externalId} onChange={(e) => setDraft((prev) => ({ ...prev, externalId: e.target.value }))} placeholder="External ID" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--foreground)", fontSize: 14 }}>
            <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((prev) => ({ ...prev, isActive: e.target.checked }))} />
            Active
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btnStyle("primary")} onClick={() => void save()}>Save</button>
            <button style={btnStyle()} onClick={() => void refreshEnrichment()} disabled={!selectedId}>Refresh Enrichment</button>
            <button style={btnStyle()} onClick={() => { setSelectedId(null); setDraft({ leagueId: "", name: "", shortName: "", nationality: "", countryCode: "", headshotUrl: "", brandColor: "", logoUrl: "", externalId: "", isActive: true }); }}>Clear</button>
          </div>
        </div>
      </div>
    </section>
  );
}
