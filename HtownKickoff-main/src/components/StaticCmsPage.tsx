"use client";

import * as React from "react";
import { AppShell } from "./AppShell";
import { api } from "../lib/api";

type StaticPageRecord = {
  slug: string;
  title: string;
  excerpt?: string | null;
  contentHtml?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  publishedAt?: string | null;
};

export function StaticCmsPage({
  slug,
  label,
  fallbackTitle,
  fallbackExcerpt,
  fallbackHtml,
}: {
  slug: string;
  label: string;
  fallbackTitle: string;
  fallbackExcerpt?: string;
  fallbackHtml: string;
}) {
  const [page, setPage] = React.useState<StaticPageRecord | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await api.get<StaticPageRecord>(`/pages/${slug}`);
        if (!cancelled) setPage(response.data || null);
      } catch {
        if (!cancelled) setPage(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const title = page?.title || fallbackTitle;
  const excerpt = page?.excerpt || fallbackExcerpt || "";
  const contentHtml = page?.contentHtml || fallbackHtml;

  return (
    <AppShell>
      <section style={{ padding: "48px 20px", maxWidth: "760px", margin: "0 auto" }}>
        <div className="section-label" style={{ marginBottom: "8px" }}>{label}</div>
        <h1 className="font-display text-display animate-fade-up" style={{ color: "var(--foreground)", marginBottom: "16px" }}>
          {title}
        </h1>
        {excerpt ? (
          <p className="text-body animate-fade-up stagger-1" style={{ color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: "24px" }}>
            {excerpt}
          </p>
        ) : null}
        <div
          className="card-flat animate-fade-up stagger-2"
          style={{ padding: "24px", color: "var(--muted-foreground)", lineHeight: 1.8 }}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
        {page?.publishedAt ? (
          <div className="text-xs" style={{ color: "var(--muted-foreground)", marginTop: "12px" }}>
            Last updated: {new Date(page.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
