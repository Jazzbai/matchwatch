"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { blogApi, type BlogCategory, type BlogPostSummary } from "../../lib/api";

export default function BlogIndexPage() {
  const [categories, setCategories] = React.useState<BlogCategory[]>([]);
  const [posts, setPosts] = React.useState<BlogPostSummary[]>([]);
  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadPosts = React.useCallback(async (nextQuery = query, nextCategory = activeCategory) => {
    setLoading(true);
    setError(null);
    try {
      const [cats, list] = await Promise.all([
        blogApi.listCategories(),
        blogApi.listPosts({ q: nextQuery || undefined, category: nextCategory || undefined, page: 1, limit: 24 }),
      ]);
      setCategories(cats.data || []);
      setPosts(list.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, query]);

  React.useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  return (
    <AppShell>
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 64px", display: "grid", gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)" }}>Stories</div>
          <h1 style={{ margin: "8px 0 10px", fontSize: 42, lineHeight: 1.05, color: "var(--foreground)", fontWeight: 900 }}>Blog</h1>
          <p style={{ margin: 0, maxWidth: 680, fontSize: 16, lineHeight: 1.7, color: "var(--muted-foreground)" }}>Matchwatch editorial, venue features, travel notes, fan guides, and event coverage managed directly from the backend.</p>
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1fr) auto" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <input
              style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)", padding: "12px 14px 12px 40px", fontSize: 14, fontFamily: "inherit" }}
              placeholder="Search blog posts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadPosts(e.currentTarget.value, activeCategory);
              }}
            />
          </div>
          <button style={{ borderRadius: 12, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", padding: "0 18px", fontWeight: 800, cursor: "pointer" }} onClick={() => void loadPosts()}>Search</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            onClick={() => { setActiveCategory(""); void loadPosts(query, ""); }}
            style={{ borderRadius: 999, border: !activeCategory ? "1px solid var(--primary)" : "1px solid var(--border)", background: !activeCategory ? "color-mix(in oklch, var(--primary) 10%, transparent)" : "transparent", color: !activeCategory ? "var(--primary)" : "var(--muted-foreground)", padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
          >
            All Categories
          </button>
          {categories.map((category) => {
            const selected = activeCategory === category.slug;
            return (
              <button
                key={category.id}
                onClick={() => { setActiveCategory(category.slug); void loadPosts(query, category.slug); }}
                style={{ borderRadius: 999, border: selected ? "1px solid var(--primary)" : "1px solid var(--border)", background: selected ? "color-mix(in oklch, var(--primary) 10%, transparent)" : "transparent", color: selected ? "var(--primary)" : "var(--muted-foreground)", padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
              >
                {category.name}
              </button>
            );
          })}
        </div>

        {error && <div style={{ border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#ef4444", borderRadius: 12, padding: 12 }}>{error}</div>}

        {loading ? (
          <div style={{ color: "var(--muted-foreground)" }}>Loading posts...</div>
        ) : posts.length === 0 ? (
          <div style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 16, padding: 24, color: "var(--muted-foreground)" }}>No blog posts matched the current search and filters.</div>
        ) : (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} style={{ textDecoration: "none" }}>
                <article style={{ height: "100%", border: "1px solid var(--border)", borderRadius: 18, background: "var(--card)", overflow: "hidden", display: "grid" }}>
                  <div style={{ aspectRatio: "16 / 9", background: "var(--secondary)" }}>
                    {post.featuredImageUrl ? (
                      <img src={post.featuredImageUrl} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : null}
                  </div>
                  <div style={{ padding: 18, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {post.categories.map((category) => (
                        <span key={category.id} style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--primary)" }}>{category.name}</span>
                      ))}
                    </div>
                    <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.15, color: "var(--foreground)", fontWeight: 900 }}>{post.title}</h2>
                    <p style={{ margin: 0, color: "var(--muted-foreground)", lineHeight: 1.6 }}>{post.excerpt || "Open the article to read more."}</p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
