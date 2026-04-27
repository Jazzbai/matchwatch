"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { blogApi, type BlogCategory, type BlogPostSummary } from "../../lib/api";

const BL_VARS = `
:root {
  --bl-bg:#0a0b0d; --bl-bg-1:#101217; --bl-bg-2:#14171d;
  --bl-line:#23272f; --bl-line-2:#2f3540;
  --bl-fg:#f1ece4; --bl-fg-dim:#a8a59d; --bl-fg-mute:#6c6a64;
  --bl-accent:oklch(0.72 0.19 28); --bl-accent-ink:#0a0b0d;
}
`;

const BL_CSS = `
body { background: var(--bl-bg) !important; color: var(--bl-fg) !important; }
.bl-wrap { min-height: 100vh; background: radial-gradient(1200px 600px at 20% -10%, rgba(255,120,60,0.08), transparent 60%), var(--bl-bg); }
/* topbar */
.bl-topbar { position: sticky; top: 0; z-index: 20; display: flex; justify-content: center; padding: 10px 16px; }
.bl-topbar-inner { display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 920px; padding: 10px 20px; border-radius: 999px; background: color-mix(in srgb, #0a0b0d 75%, transparent); backdrop-filter: blur(16px); border: 1px solid rgba(35,39,47,0.8); box-shadow: 0 2px 20px rgba(0,0,0,0.25); }
.bl-brand { display: flex; flex-direction: column; align-items: flex-start; text-decoration: none; color: var(--bl-fg); }
.bl-brand-name { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 18px; letter-spacing: -0.02em; line-height: 1.1; }
.bl-brand-name em { font-style: normal; color: var(--bl-accent); }
.bl-brand-tag { font-family: monospace; font-size: 9px; letter-spacing: 0.22em; color: var(--bl-accent); font-weight: 700; text-transform: uppercase; margin-top: 1px; opacity: 0.8; }
.bl-nav { display: flex; align-items: center; gap: 2px; }
.bl-nav a { padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--bl-fg-dim); transition: all .18s; text-decoration: none; }
.bl-nav a.active, .bl-nav a:hover { background: rgba(255,255,255,0.07); color: var(--bl-fg); }
.bl-mobile-nav { display: none; }
.bl-mobile-nav a { padding: 7px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--bl-fg-dim); text-decoration: none; transition: all .18s; white-space: nowrap; }
.bl-mobile-nav a:hover { background: rgba(255,255,255,0.07); color: var(--bl-fg); }
.bl-top-right { display: flex; gap: 8px; align-items: center; }
.bl-btn-pill { display: inline-flex; align-items: center; padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 700; text-decoration: none; background: var(--bl-accent); color: var(--bl-accent-ink); transition: all .18s; }
.bl-btn-pill:hover { opacity: 0.88; transform: translateY(-1px); }
.bl-btn-pill.ghost { background: rgba(255,255,255,0.07); color: var(--bl-fg); }
/* hero */
.bl-band { padding: 40px 32px 32px; border-bottom: 1px solid var(--bl-line); position: relative; overflow: hidden; }
.bl-band::after { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 48px 48px; pointer-events: none; }
.bl-kicker { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.16em; color: var(--bl-accent); text-transform: uppercase; margin-bottom: 10px; }
.bl-h1 { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 48px; line-height: 0.95; letter-spacing: -0.025em; margin: 0 0 12px; }
.bl-h1 em { font-style: normal; color: var(--bl-accent); }
.bl-sub { font-size: 15px; color: var(--bl-fg-dim); line-height: 1.6; max-width: 560px; margin: 0; }
/* search + filters */
.bl-toolbar { padding: 20px 32px; border-bottom: 1px solid var(--bl-line); display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.bl-search { display: flex; align-items: center; gap: 0; background: var(--bl-bg-2); border: 1px solid var(--bl-line-2); flex: 1; min-width: 220px; }
.bl-search input { flex: 1; background: transparent; border: 0; color: var(--bl-fg); font-family: 'Space Grotesk', sans-serif; font-size: 14px; padding: 10px 14px; outline: 0; }
.bl-search input::placeholder { color: var(--bl-fg-mute); }
.bl-search button { padding: 10px 16px; background: var(--bl-accent); color: var(--bl-accent-ink); border: 0; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
.bl-cats { display: flex; gap: 6px; flex-wrap: wrap; }
.bl-cat { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; padding: 7px 12px; border: 1px solid var(--bl-line); color: var(--bl-fg-dim); cursor: pointer; background: none; transition: all .14s; }
.bl-cat:hover { color: var(--bl-fg); border-color: var(--bl-line-2); }
.bl-cat.on { background: var(--bl-fg); color: var(--bl-bg); border-color: var(--bl-fg); }
/* grid */
.bl-main { max-width: 1160px; margin: 0 auto; padding: 32px 32px 80px; }
.bl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.bl-card { border: 1px solid var(--bl-line); background: var(--bl-bg-1); display: grid; text-decoration: none; color: inherit; transition: border-color .14s; }
.bl-card:hover { border-color: var(--bl-line-2); }
.bl-card-img { aspect-ratio: 16/9; background: linear-gradient(135deg, #2a1d14, #0d0f14); overflow: hidden; position: relative; }
.bl-card-img img { width: 100%; height: 100%; object-fit: cover; }
.bl-card-img .glyph { position: absolute; inset: 0; display: grid; place-items: center; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 48px; color: rgba(255,255,255,0.08); }
.bl-card-body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 8px; }
.bl-card-cats { display: flex; gap: 6px; flex-wrap: wrap; }
.bl-card-cat { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--bl-accent); }
.bl-card-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; line-height: 1.2; color: var(--bl-fg); }
.bl-card-excerpt { font-size: 13px; color: var(--bl-fg-dim); line-height: 1.55; }
/* empty / error */
.bl-empty { border: 1px dashed var(--bl-line); padding: 60px 32px; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--bl-fg-mute); }
.bl-error { border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.06); color: #ef4444; padding: 12px 16px; font-size: 13px; }
/* responsive */
@media (max-width: 900px) { .bl-nav { display: none; } .bl-mobile-nav { display: flex; align-items: center; gap: 4px; } .bl-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .bl-grid { grid-template-columns: 1fr; } .bl-band { padding: 28px 16px 24px; } .bl-main { padding: 20px 16px 60px; } .bl-toolbar { padding: 16px; } .bl-h1 { font-size: 32px; } }
`;

export default function BlogIndexPage() {
    const { user } = useAuth();
    const pathname = usePathname();

    const [categories, setCategories] = React.useState<BlogCategory[]>([]);
    const [posts, setPosts] = React.useState<BlogPostSummary[]>([]);
    const [query, setQuery] = React.useState("");
    const [inputValue, setInputValue] = React.useState("");
    const [activeCategory, setActiveCategory] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const load = React.useCallback(async (q: string, cat: string) => {
        setLoading(true);
        setError(null);
        try {
            const [cats, list] = await Promise.all([
                blogApi.listCategories(),
                blogApi.listPosts({ q: q || undefined, category: cat || undefined, page: 1, limit: 24 }),
            ]);
            setCategories(cats.data ?? []);
            setPosts(list.data ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load blog posts");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { void load("", ""); }, [load]);

    const search = () => { setQuery(inputValue); void load(inputValue, activeCategory); };

    const selectCat = (slug: string) => {
        setActiveCategory(slug);
        void load(query, slug);
    };

    return (
        <div className="bl-wrap">
            <style dangerouslySetInnerHTML={{ __html: BL_VARS + BL_CSS }} />

            <header className="bl-topbar">
                <div className="bl-topbar-inner">
                    <Link href="/" className="bl-brand">
                        <div className="bl-brand-name">match<em>watch</em></div>
                        <div className="bl-brand-tag">Watchparty Hub</div>
                    </Link>
                    <nav className="bl-nav">
                        <Link href="/">Home</Link>
                        <Link href="/matches">Matches</Link>
                        <Link href="/world-cup">World Cup</Link>
                        <Link href="/venues">Venues</Link>
                        <Link href="/blog" className="active">Blog</Link>
                        {user && <Link href="/dashboard">My bookings</Link>}
                    </nav>
                    <nav className="bl-mobile-nav">
                        <Link href="/">Home</Link>
                        <Link href="/matches">Matches</Link>
                        <Link href="/venues">Venues</Link>
                        {user && <Link href="/dashboard">Bookings</Link>}
                    </nav>
                    <div className="bl-top-right">
                        {user
                            ? <Link href="/dashboard" className="bl-btn-pill ghost">{user.name?.split(" ")[0]}</Link>
                            : <Link href="/login" className="bl-btn-pill">Log in</Link>
                        }
                    </div>
                </div>
            </header>

            <section className="bl-band">
                <div style={{ position: "relative", zIndex: 1, maxWidth: 1160, margin: "0 auto" }}>
                    <div className="bl-kicker">Stories · Editorial · Fan guides</div>
                    <h1 className="bl-h1">Match<em>watch</em> Blog</h1>
                    <p className="bl-sub">Venue features, travel notes, fan guides, event coverage and match previews from the Matchwatch team.</p>
                </div>
            </section>

            <div className="bl-toolbar">
                <div className="bl-search">
                    <input
                        placeholder="Search posts…"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") search(); }}
                    />
                    <button onClick={search}>Search</button>
                </div>
                <div className="bl-cats">
                    <button className={`bl-cat${!activeCategory ? " on" : ""}`} onClick={() => selectCat("")}>All</button>
                    {categories.map(c => (
                        <button
                            key={c.id}
                            className={`bl-cat${activeCategory === c.slug ? " on" : ""}`}
                            onClick={() => selectCat(c.slug)}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bl-main">
                {error && <div className="bl-error">{error}</div>}

                {loading ? (
                    <div className="bl-grid">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bl-card" style={{ opacity: 0.35, pointerEvents: "none" }}>
                                <div className="bl-card-img" />
                                <div className="bl-card-body">
                                    <div style={{ height: 10, width: "40%", background: "var(--bl-line-2)" }} />
                                    <div style={{ height: 18, width: "80%", background: "var(--bl-line-2)" }} />
                                    <div style={{ height: 12, width: "60%", background: "var(--bl-line-2)" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : posts.length === 0 ? (
                    <div className="bl-empty">
                        {error ? "Could not load posts" : "No posts yet — check back soon"}
                    </div>
                ) : (
                    <div className="bl-grid">
                        {posts.map(post => (
                            <Link key={post.id} href={`/blog/${post.slug}`} className="bl-card">
                                <div className="bl-card-img">
                                    {post.featuredImageUrl
                                        ? <img src={post.featuredImageUrl} alt={post.title} />
                                        : <div className="glyph">{post.title.slice(0, 2).toUpperCase()}</div>
                                    }
                                </div>
                                <div className="bl-card-body">
                                    {post.categories.length > 0 && (
                                        <div className="bl-card-cats">
                                            {post.categories.map(c => (
                                                <span key={c.id} className="bl-card-cat">{c.name}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="bl-card-title">{post.title}</div>
                                    {post.excerpt && <div className="bl-card-excerpt">{post.excerpt}</div>}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
