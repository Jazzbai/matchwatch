"use client";

import * as React from "react";
import { api, ApiClientError } from "../../lib/api";
import { uploadSuperAdminImage } from "../../lib/superAdminUploads";

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
type RecommendationItem = {
  id: string;
  name: string;
  shortName?: string | null;
  leagueId?: string | null;
  leagueLabel?: string | null;
  sourceType: "catalog" | "provider" | "existing-db" | "external";
  confidence: "high" | "medium" | "low";
  website?: string | null;
  aliases?: string[];
  alreadyExists?: { id: string; slug?: string | null; name: string } | null;
};
type RecommendationPreview = {
  recommendation: RecommendationItem;
  prefill: {
    name: string;
    shortName?: string;
    website?: string;
    aliases?: string[];
    externalId?: string;
    imageCandidates?: string[];
    nationality?: string;
    countryCode?: string;
    shortDescription?: string;
    description?: string;
  };
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

function sourceLabel(value?: "NONE" | "GOOGLE" | "MANUAL" | null) {
  if (value === "MANUAL") return { label: "Manual", color: "#2563eb" };
  if (value === "GOOGLE") return { label: "Auto", color: "#16a34a" };
  return { label: "None", color: "var(--muted-foreground)" };
}

function recommendationSourceLabel(value: RecommendationItem["sourceType"]) {
  if (value === "catalog") return "Catalog";
  if (value === "existing-db") return "Existing";
  if (value === "provider") return "Provider";
  return "External";
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
  const [recommendations, setRecommendations] = React.useState<RecommendationItem[]>([]);
  const [recommendationLoading, setRecommendationLoading] = React.useState(false);
  const [recommendationError, setRecommendationError] = React.useState<string | null>(null);
  const [uploadingHeadshot, setUploadingHeadshot] = React.useState(false);
  const [uploadingHero, setUploadingHero] = React.useState(false);
  const headshotInputRef = React.useRef<HTMLInputElement | null>(null);
  const heroInputRef = React.useRef<HTMLInputElement | null>(null);
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

  React.useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      setRecommendationError(null);
      if (selectedId) {
        setRecommendations([]);
        return;
      }
      if (!draft.leagueId) {
        setRecommendations([]);
        return;
      }

      try {
        setRecommendationLoading(true);
        const response = await api.get<RecommendationItem[]>("/super-admin/recommendations", {
          entityType: "player",
          leagueId: draft.leagueId || undefined,
          q: draft.name || undefined,
        });
        if (!cancelled) setRecommendations(response.data || []);
      } catch (err) {
        if (!cancelled) {
          setRecommendations([]);
          setRecommendationError(formatError(err, "Recommendations unavailable. Manual entry is still available."));
        }
      } finally {
        if (!cancelled) setRecommendationLoading(false);
      }
    }

    void loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [draft.leagueId, draft.name, selectedId]);

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

  async function applyRecommendation(recommendation: RecommendationItem) {
    setError(null);
    setMessage(null);
    setRecommendationError(null);
    try {
      const response = await api.post<RecommendationPreview>("/super-admin/recommendations/preview", {
        entityType: "player",
        leagueId: draft.leagueId || undefined,
        q: draft.name || undefined,
        recommendationId: recommendation.id,
      });
      const preview = response.data;
      if (!preview) return;

      if (preview.recommendation.alreadyExists?.id) {
        setSelectedId(preview.recommendation.alreadyExists.id);
        setMessage(`${preview.recommendation.name} already exists. Opened the existing record instead of creating a duplicate.`);
        return;
      }

      setDraft((prev) => ({
        ...prev,
        name: preview.prefill.name || prev.name,
        shortName: preview.prefill.shortName || prev.shortName,
        website: preview.prefill.website || prev.website,
        aliases: preview.prefill.aliases?.join(", ") || prev.aliases,
        externalId: preview.prefill.externalId || prev.externalId,
        nationality: preview.prefill.nationality || prev.nationality,
        countryCode: preview.prefill.countryCode || prev.countryCode,
        shortDescription: preview.prefill.shortDescription || prev.shortDescription,
        description: preview.prefill.description || prev.description,
        headshotUrl: preview.prefill.imageCandidates?.[0] || prev.headshotUrl,
        heroImageUrl: preview.prefill.imageCandidates?.[1] || prev.heroImageUrl,
      }));
      setMessage(`Applied ${recommendationSourceLabel(preview.recommendation.sourceType).toLowerCase()} recommendation for ${preview.recommendation.name}. Review the fields, then save explicitly.`);
    } catch (err) {
      setRecommendationError(formatError(err, "Failed to preview recommendation. Manual entry is still available."));
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

  async function uploadImage(kind: "headshot" | "hero", file: File) {
    setError(null);
    setMessage(null);
    const setUploading = kind === "headshot" ? setUploadingHeadshot : setUploadingHero;
    const field = kind === "headshot" ? "headshotUrl" : "heroImageUrl";
    try {
      setUploading(true);
      const uploaded = await uploadSuperAdminImage(file, kind === "headshot" ? "entity_primary" : "entity_hero");
      setDraft((prev) => ({ ...prev, [field]: uploaded.url }));
      setMessage(kind === "headshot" ? "Headshot uploaded." : "Hero image uploaded.");
    } catch (err) {
      setError(formatError(err, "Image upload failed."));
    } finally {
      setUploading(false);
    }
  }

  const selectedRow = players.find((item) => item.id === selectedId) || null;

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Players</div>
          <h2 className="font-display text-h2" style={{ margin: 0, color: "var(--foreground)" }}>Player Directory</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
            Autofill uses saved player, sport, and league context. When an external enrichment provider is configured it uses provider results; otherwise it generates fallback copy. Manual uploads and edits override autofill.
          </p>
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
            <div style={{ display: "grid", gap: 8 }}>
              <input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" style={inputStyle} />
              {!selectedId ? (
                <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                      {draft.leagueId ? "Recommendations for the selected league." : "Select a league to load recommended player names."}
                    </div>
                    {recommendationLoading ? <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Loading…</div> : null}
                  </div>
                  {recommendationError ? <div style={{ color: "#f59e0b", fontSize: 12 }}>{recommendationError}</div> : null}
                  {draft.leagueId && !recommendationLoading && recommendations.length === 0 && !recommendationError ? (
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No verified suggestions. Manual entry is still available.</div>
                  ) : null}
                  {recommendations.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void applyRecommendation(item)}
                      style={{ ...btnStyle("outline"), textAlign: "left", display: "grid", gap: 4 }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span>{item.name}</span>
                        <span style={{ fontSize: 11, opacity: 0.8 }}>{recommendationSourceLabel(item.sourceType)} | {item.confidence}</span>
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.75 }}>
                        {item.leagueLabel || "League recommendation"}
                        {item.alreadyExists ? ` | already exists as ${item.alreadyExists.name}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <input value={draft.shortName} onChange={(e) => setDraft((prev) => ({ ...prev, shortName: e.target.value }))} placeholder="Short name" style={inputStyle} />
            <input value={draft.nationality} onChange={(e) => setDraft((prev) => ({ ...prev, nationality: e.target.value }))} placeholder="Nationality" style={inputStyle} />
            <input value={draft.countryCode} onChange={(e) => setDraft((prev) => ({ ...prev, countryCode: e.target.value }))} placeholder="Country code" style={inputStyle} />
            <div style={{ gridColumn: "1 / -1", display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input value={draft.headshotUrl} onChange={(e) => setDraft((prev) => ({ ...prev, headshotUrl: e.target.value }))} placeholder="Headshot URL" style={{ ...inputStyle, flex: 1, minWidth: 240 }} />
                <button type="button" style={btnStyle()} disabled={uploadingHeadshot} onClick={() => headshotInputRef.current?.click()}>
                  {uploadingHeadshot ? "Uploading..." : "Upload Headshot"}
                </button>
                <input
                  ref={headshotInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage("headshot", file);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
              {draft.headshotUrl ? <img src={draft.headshotUrl} alt="Headshot preview" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)" }} /> : null}
            </div>
            <div style={{ gridColumn: "1 / -1", display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input value={draft.heroImageUrl} onChange={(e) => setDraft((prev) => ({ ...prev, heroImageUrl: e.target.value }))} placeholder="Hero image URL" style={{ ...inputStyle, flex: 1, minWidth: 240 }} />
                <button type="button" style={btnStyle()} disabled={uploadingHero} onClick={() => heroInputRef.current?.click()}>
                  {uploadingHero ? "Uploading..." : "Upload Hero"}
                </button>
                <input
                  ref={heroInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage("hero", file);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
              {draft.heroImageUrl ? <img src={draft.heroImageUrl} alt="Hero preview" style={{ width: "100%", maxWidth: 280, height: 140, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)" }} /> : null}
            </div>
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
            {selectedId && selectedRow ? (
              <a href={`/players/${selectedRow.slug}`} target="_blank" rel="noreferrer" style={{ ...btnStyle(), textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                Open Page
              </a>
            ) : null}
            <button style={btnStyle()} onClick={() => void refreshEnrichment()} disabled={!selectedId}>Autofill From Search</button>
            <button style={btnStyle()} onClick={() => void revertToDefaults()} disabled={!selectedId}>Revert to Defaults</button>
            {selectedId ? <button style={btnStyle()} onClick={() => setSelectedId(null)}>Clear</button> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
