"use client";

import * as React from "react";
import { api, ApiClientError } from "../../lib/api";

type StaticPage = {
  slug: string;
  title: string;
  excerpt?: string | null;
  contentHtml?: string | null;
  status: "DRAFT" | "PUBLISHED";
  seoTitle?: string | null;
  seoDescription?: string | null;
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

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 120,
  resize: "vertical",
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

export function StaticPagesAdminPanel() {
  const [pages, setPages] = React.useState<StaticPage[]>([]);
  const [draft, setDraft] = React.useState<StaticPage>({
    slug: "about",
    title: "",
    excerpt: "",
    contentHtml: "",
    status: "DRAFT",
    seoTitle: "",
    seoDescription: "",
  });
  const [selectedSlug, setSelectedSlug] = React.useState<string>("about");
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const response = await api.get<StaticPage[]>("/super-admin/pages");
      const rows = response.data || [];
      setPages(rows);
      const current = rows.find((item) => item.slug === selectedSlug) || rows[0];
      if (current) {
        setSelectedSlug(current.slug);
        setDraft(current);
      }
    } catch (err) {
      setError(formatError(err, "Failed to load pages."));
    }
  }, [selectedSlug]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function openPage(slug: string) {
    try {
      const response = await api.get<StaticPage>(`/super-admin/pages/${slug}`);
      setSelectedSlug(slug);
      setDraft(response.data);
    } catch (err) {
      setError(formatError(err, "Failed to load page."));
    }
  }

  async function save() {
    setError(null);
    setMessage(null);
    try {
      if (pages.some((item) => item.slug === draft.slug)) {
        await api.patch(`/super-admin/pages/${draft.slug}`, draft);
        setMessage("Page updated.");
      } else {
        await api.post("/super-admin/pages", draft);
        setMessage("Page created.");
      }
      await load();
    } catch (err) {
      setError(formatError(err, "Failed to save page."));
    }
  }

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>CMS</div>
        <h2 className="font-display text-h2" style={{ margin: 0, color: "var(--foreground)" }}>Static Pages</h2>
      </div>
      {message ? <div style={{ color: "#16a34a", fontSize: 13 }}>{message}</div> : null}
      {error ? <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: 16 }}>
        <div className="card-flat" style={{ padding: 14, display: "grid", gap: 10 }}>
          {pages.map((page) => (
            <button key={page.slug} onClick={() => void openPage(page.slug)} style={btnStyle(page.slug === selectedSlug ? "primary" : "outline")}>
              {page.slug} · {page.status}
            </button>
          ))}
        </div>
        <div className="card-flat" style={{ padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <input value={draft.slug} onChange={(e) => setDraft((prev) => ({ ...prev, slug: e.target.value }))} placeholder="Slug" style={inputStyle} />
            <select value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as "DRAFT" | "PUBLISHED" }))} style={inputStyle}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
            <input value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="Title" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
            <input value={draft.excerpt || ""} onChange={(e) => setDraft((prev) => ({ ...prev, excerpt: e.target.value }))} placeholder="Excerpt" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
            <input value={draft.seoTitle || ""} onChange={(e) => setDraft((prev) => ({ ...prev, seoTitle: e.target.value }))} placeholder="SEO title" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
            <input value={draft.seoDescription || ""} onChange={(e) => setDraft((prev) => ({ ...prev, seoDescription: e.target.value }))} placeholder="SEO description" style={{ ...inputStyle, gridColumn: "1 / -1" }} />
          </div>
          <textarea value={draft.contentHtml || ""} onChange={(e) => setDraft((prev) => ({ ...prev, contentHtml: e.target.value }))} placeholder="HTML content" style={{ ...textareaStyle, minHeight: 320 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnStyle("primary")} onClick={() => void save()}>Save Page</button>
            <button style={btnStyle()} onClick={() => void load()}>Reload</button>
          </div>
        </div>
      </div>
    </section>
  );
}
