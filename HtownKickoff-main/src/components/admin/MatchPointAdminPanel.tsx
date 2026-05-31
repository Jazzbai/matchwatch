"use client";

import * as React from "react";
import { api, ApiClientError } from "../../lib/api";

type Settings = {
  prizeName: string;
  prizeDescription: string | null;
  prizeImageUrl: string | null;
  heroSubtitle: string | null;
  isActive: boolean;
  updatedAt?: string | null;
};

type SponsorInquiry = {
  id: string;
  company: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  tier: string;
  message: string | null;
  status: string;
  createdAt: string;
};

const STATUSES = ["new", "contacted", "closed", "archived"] as const;

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 14,
  background: "var(--card)",
  padding: 20,
  marginBottom: 18,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono), monospace",
  fontSize: 10,
  fontWeight: 800,
  color: "var(--muted-foreground)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--secondary)",
  color: "var(--foreground)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  padding: "11px 18px",
  borderRadius: 10,
  background: "var(--primary)",
  color: "var(--primary-foreground)",
  fontWeight: 800,
  fontSize: 13,
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnOutline: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 9,
  background: "transparent",
  color: "var(--foreground)",
  fontWeight: 700,
  fontSize: 12,
  border: "1px solid var(--border)",
  cursor: "pointer",
  fontFamily: "inherit",
};

function formatError(err: unknown, fallback: string) {
  if (err instanceof ApiClientError) return err.message || fallback;
  return err instanceof Error ? err.message : fallback;
}

export function MatchPointAdminPanel() {
  // Settings
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [loadingSettings, setLoadingSettings] = React.useState(true);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [settingsError, setSettingsError] = React.useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = React.useState<string | null>(null);

  // Inquiries
  const [inquiries, setInquiries] = React.useState<SponsorInquiry[]>([]);
  const [loadingInquiries, setLoadingInquiries] = React.useState(true);
  const [inquiriesError, setInquiriesError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [updatingInquiry, setUpdatingInquiry] = React.useState<string | null>(null);

  const loadSettings = React.useCallback(async () => {
    setLoadingSettings(true);
    setSettingsError(null);
    try {
      const res = await api.get<Settings>("/super-admin/match-point/settings");
      setSettings(res.data);
    } catch (err) {
      setSettingsError(formatError(err, "Failed to load settings"));
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  const loadInquiries = React.useCallback(async () => {
    setLoadingInquiries(true);
    setInquiriesError(null);
    try {
      const q = statusFilter !== "all" ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await api.get<SponsorInquiry[]>(`/super-admin/sponsor-inquiries${q}`);
      setInquiries(res.data || []);
    } catch (err) {
      setInquiriesError(formatError(err, "Failed to load inquiries"));
    } finally {
      setLoadingInquiries(false);
    }
  }, [statusFilter]);

  React.useEffect(() => { void loadSettings(); }, [loadSettings]);
  React.useEffect(() => { void loadInquiries(); }, [loadInquiries]);

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      const res = await api.patch<Settings>("/super-admin/match-point/settings", {
        prizeName: settings.prizeName,
        prizeDescription: settings.prizeDescription,
        prizeImageUrl: settings.prizeImageUrl,
        heroSubtitle: settings.heroSubtitle,
        isActive: settings.isActive,
      });
      setSettings(res.data);
      setSettingsNotice("Saved.");
      setTimeout(() => setSettingsNotice(null), 2500);
    } catch (err) {
      setSettingsError(formatError(err, "Failed to save"));
    } finally {
      setSavingSettings(false);
    }
  }

  async function updateInquiryStatus(id: string, status: string) {
    setUpdatingInquiry(id);
    try {
      await api.patch(`/super-admin/sponsor-inquiries/${id}`, { status });
      setInquiries((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
    } catch (err) {
      setInquiriesError(formatError(err, "Failed to update inquiry"));
    } finally {
      setUpdatingInquiry(null);
    }
  }

  function updateField<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div>
      {/* ── Settings ──────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Match Point — Settings</h3>
          {settings?.updatedAt && (
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Last updated {new Date(settings.updatedAt).toLocaleString()}
            </span>
          )}
        </div>

        {loadingSettings && !settings ? (
          <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Loading…</p>
        ) : settings ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={labelStyle} htmlFor="mp-prize-name">Prize name</label>
              <input
                id="mp-prize-name"
                style={inputStyle}
                value={settings.prizeName || ""}
                onChange={(e) => updateField("prizeName", e.target.value)}
                placeholder="Mercedes-Benz C300"
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="mp-prize-desc">Prize description</label>
              <textarea
                id="mp-prize-desc"
                style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                value={settings.prizeDescription || ""}
                onChange={(e) => updateField("prizeDescription", e.target.value || null)}
                placeholder="Top point earners across the tournament enter a grand-prize sweepstakes…"
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="mp-prize-img">Prize image URL</label>
              <input
                id="mp-prize-img"
                style={inputStyle}
                type="url"
                value={settings.prizeImageUrl || ""}
                onChange={(e) => updateField("prizeImageUrl", e.target.value || null)}
                placeholder="https://… (or /match-point/prize.jpg)"
              />
              {settings.prizeImageUrl && (
                <div style={{ marginTop: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.prizeImageUrl}
                    alt="Prize preview"
                    style={{ maxWidth: 220, maxHeight: 140, borderRadius: 8, border: "1px solid var(--border)" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle} htmlFor="mp-hero-sub">Hero subtitle (landing page)</label>
              <textarea
                id="mp-hero-sub"
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                value={settings.heroSubtitle || ""}
                onChange={(e) => updateField("heroSubtitle", e.target.value || null)}
                placeholder="Scan the QR at a host venue…"
              />
            </div>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={settings.isActive}
                  onChange={(e) => updateField("isActive", e.target.checked)}
                />
                Campaign active (public Match Point pages visible)
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
              <button type="button" style={btnPrimary} onClick={() => void saveSettings()} disabled={savingSettings}>
                {savingSettings ? "Saving…" : "Save settings"}
              </button>
              <button type="button" style={btnOutline} onClick={() => void loadSettings()} disabled={savingSettings}>
                Reset
              </button>
              {settingsError && <span style={{ color: "#ef4444", fontSize: 13 }}>{settingsError}</span>}
              {settingsNotice && <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 700 }}>{settingsNotice}</span>}
            </div>
          </div>
        ) : (
          <p style={{ color: "#ef4444", fontSize: 13 }}>{settingsError || "No settings found."}</p>
        )}
      </div>

      {/* ── Sponsor Inquiries ─────────────────── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Sponsor Inquiries</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }} htmlFor="mp-inq-filter">Filter</label>
            <select
              id="mp-inq-filter"
              style={{ ...inputStyle, width: "auto", padding: "6px 10px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            <button type="button" style={btnOutline} onClick={() => void loadInquiries()}>↻ Refresh</button>
          </div>
        </div>

        {inquiriesError && <p style={{ color: "#ef4444", fontSize: 13 }}>{inquiriesError}</p>}

        {loadingInquiries ? (
          <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Loading…</p>
        ) : inquiries.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>No inquiries{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <th style={{ padding: "8px 6px" }}>Received</th>
                  <th style={{ padding: "8px 6px" }}>Company</th>
                  <th style={{ padding: "8px 6px" }}>Contact</th>
                  <th style={{ padding: "8px 6px" }}>Tier</th>
                  <th style={{ padding: "8px 6px" }}>Message</th>
                  <th style={{ padding: "8px 6px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 6px", whiteSpace: "nowrap", fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--muted-foreground)" }}>
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 6px", fontWeight: 700 }}>
                      {row.company}
                      {row.website && (
                        <div style={{ fontSize: 11, fontWeight: 400 }}>
                          <a href={row.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>{row.website}</a>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 6px" }}>
                      {row.contactName && <div style={{ fontWeight: 700 }}>{row.contactName}</div>}
                      <div><a href={`mailto:${row.email}`} style={{ color: "var(--foreground)" }}>{row.email}</a></div>
                      {row.phone && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{row.phone}</div>}
                    </td>
                    <td style={{ padding: "10px 6px", textTransform: "capitalize" }}>{row.tier}</td>
                    <td style={{ padding: "10px 6px", maxWidth: 280, whiteSpace: "pre-wrap" }}>{row.message || "—"}</td>
                    <td style={{ padding: "10px 6px" }}>
                      <select
                        value={row.status}
                        style={{ ...inputStyle, padding: "6px 8px", width: "auto" }}
                        disabled={updatingInquiry === row.id}
                        onChange={(e) => void updateInquiryStatus(row.id, e.target.value)}
                      >
                        {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
