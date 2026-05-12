"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { useAuth } from "../../../lib/auth-context";
import { blogApi, type BlogComment, type BlogPostDetail } from "../../../lib/api";
import { FloatingNav } from "../../../components/AppShell";

const BP_VARS = `
:root {
  --bp-bg:#0a0b0d; --bp-bg-1:#101217; --bp-bg-2:#14171d;
  --bp-line:#23272f; --bp-line-2:#2f3540;
  --bp-fg:#f1ece4; --bp-fg-dim:#a8a59d; --bp-fg-mute:#6c6a64;
  --bp-accent:oklch(0.72 0.19 28); --bp-accent-ink:#0a0b0d;
}
`;

const BP_CSS = `
body { background: var(--bp-bg) !important; color: var(--bp-fg) !important; }
.bp-wrap { min-height: 100vh; background: radial-gradient(1200px 600px at 20% -10%, rgba(255,120,60,0.08), transparent 60%), var(--bp-bg); }
/* topbar */
.bp-topbar { position: sticky; top: 0; z-index: 20; display: flex; justify-content: center; padding: 10px 16px; }
.bp-topbar-inner { display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 920px; padding: 10px 20px; border-radius: 999px; background: color-mix(in srgb, #0a0b0d 75%, transparent); backdrop-filter: blur(16px); border: 1px solid rgba(35,39,47,0.8); box-shadow: 0 2px 20px rgba(0,0,0,0.25); }
.bp-brand { display: flex; flex-direction: column; align-items: flex-start; text-decoration: none; color: var(--bp-fg); }
.bp-brand-name { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 18px; letter-spacing: -0.02em; line-height: 1.1; }
.bp-brand-name em { font-style: normal; color: var(--bp-accent); }
.bp-brand-tag { font-family: monospace; font-size: 9px; letter-spacing: 0.22em; color: var(--bp-accent); font-weight: 700; text-transform: uppercase; margin-top: 1px; opacity: 0.8; }
.bp-nav { display: flex; align-items: center; gap: 2px; }
.bp-nav a { padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--bp-fg-dim); transition: all .18s; text-decoration: none; }
.bp-nav a:hover { background: rgba(255,255,255,0.07); color: var(--bp-fg); }
.bp-mobile-nav { display: none; }
.bp-mobile-nav a { padding: 7px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--bp-fg-dim); text-decoration: none; transition: all .18s; white-space: nowrap; }
.bp-mobile-nav a:hover { background: rgba(255,255,255,0.07); color: var(--bp-fg); }
.bp-top-right { display: flex; gap: 8px; align-items: center; }
.bp-btn-pill { display: inline-flex; align-items: center; padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 700; text-decoration: none; background: var(--bp-accent); color: var(--bp-accent-ink); transition: all .18s; }
.bp-btn-pill:hover { opacity: 0.88; transform: translateY(-1px); }
.bp-btn-pill.ghost { background: rgba(255,255,255,0.07); color: var(--bp-fg); }
/* content */
.bp-content { max-width: 780px; margin: 0 auto; padding: 32px 24px 80px; display: grid; gap: 24px; }
.bp-back { font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--bp-accent); text-decoration: none; font-weight: 700; }
.bp-back:hover { opacity: 0.75; }
.bp-hero-img { width: 100%; max-height: 420px; object-fit: cover; border: 1px solid var(--bp-line); }
.bp-cats { display: flex; gap: 6px; flex-wrap: wrap; }
.bp-cat { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--bp-accent); border: 1px solid rgba(255,120,60,0.3); padding: 4px 10px; }
.bp-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 42px; line-height: 1.05; letter-spacing: -0.02em; margin: 0; color: var(--bp-fg); }
.bp-excerpt { font-size: 17px; color: var(--bp-fg-dim); line-height: 1.65; margin: 0; }
.bp-article { border: 1px solid var(--bp-line); background: var(--bp-bg-1); padding: 32px 28px; color: var(--bp-fg); line-height: 1.8; font-size: 16px; }
.bp-article h2 { font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 700; margin: 28px 0 12px; color: var(--bp-fg); }
.bp-article h3 { font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 600; margin: 22px 0 10px; color: var(--bp-fg); }
.bp-article p { margin: 0 0 16px; }
.bp-article ul, .bp-article ol { margin: 0 0 16px; padding-left: 24px; }
.bp-article li { margin-bottom: 6px; }
.bp-article strong { color: var(--bp-fg); font-weight: 700; }
.bp-article a { color: var(--bp-accent); text-decoration: underline; }
.bp-comments-title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; margin: 0; color: var(--bp-fg); }
.bp-comment-box { border: 1px solid var(--bp-line); background: var(--bp-bg-1); padding: 16px; display: grid; gap: 12px; }
.bp-comment-box textarea { width: 100%; min-height: 120px; border: 1px solid var(--bp-line-2); background: var(--bp-bg-2); color: var(--bp-fg); padding: 12px; font-family: inherit; font-size: 14px; resize: vertical; box-sizing: border-box; outline: none; }
.bp-comment-box textarea:focus { border-color: var(--bp-accent); }
.bp-comment-submit { border: none; background: var(--bp-accent); color: var(--bp-accent-ink); padding: 10px 20px; font-weight: 700; font-size: 13px; cursor: pointer; transition: opacity .15s; }
.bp-comment-submit:disabled { opacity: 0.45; cursor: not-allowed; }
.bp-comment-hint { font-size: 12px; color: var(--bp-fg-mute); }
.bp-comment-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.bp-comment-card { border: 1px solid var(--bp-line); background: var(--bp-bg-1); padding: 16px; display: grid; gap: 6px; }
.bp-comment-author { font-weight: 700; color: var(--bp-fg); font-size: 14px; }
.bp-comment-body { color: var(--bp-fg-dim); line-height: 1.65; font-size: 14px; }
.bp-empty { font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--bp-fg-mute); }
.bp-error { border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.06); color: #ef4444; padding: 12px 16px; font-size: 13px; }
.bp-success { border: 1px solid rgba(34,197,94,0.25); background: rgba(34,197,94,0.06); color: #4ade80; padding: 12px 16px; font-size: 13px; }
.bp-loading { color: var(--bp-fg-mute); font-family: 'JetBrains Mono', monospace; font-size: 13px; letter-spacing: 0.06em; }
@media (max-width: 900px) { .bp-nav { display: none; } .bp-mobile-nav { display: flex; align-items: center; gap: 4px; } }
@media (max-width: 600px) { .bp-content { padding: 20px 16px 60px; } .bp-title { font-size: 28px; } .bp-article { padding: 20px 16px; } }
`;

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const { user, isAuthenticated } = useAuth();
    const [post, setPost] = React.useState<BlogPostDetail | null>(null);
    const [comments, setComments] = React.useState<BlogComment[]>([]);
    const [commentBody, setCommentBody] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [message, setMessage] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const detail = await blogApi.getPost(slug);
            setPost(detail.data);
            const list = await blogApi.listComments(detail.data.id);
            setComments(list.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load blog post");
        } finally {
            setLoading(false);
        }
    }, [slug]);

    React.useEffect(() => { void load(); }, [load]);

    const submitComment = async () => {
        if (!post || !commentBody.trim()) return;
        setSubmitting(true);
        setError(null);
        setMessage(null);
        try {
            await blogApi.createComment(post.id, commentBody.trim());
            setCommentBody("");
            setMessage("Comment submitted for moderation.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit comment");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bp-wrap">
            <style dangerouslySetInnerHTML={{ __html: BP_VARS + BP_CSS }} />
            <FloatingNav />

            <header className="bp-topbar">
                <div className="bp-topbar-inner">
                    <Link href="/" className="bp-brand">
                        <img className="bp-brand-logo" src="/logo.svg" alt="MatchWatch" />
                    </Link>
                    <nav className="bp-nav">
                        <Link href="/">Home</Link>
                        <Link href="/matches">Matches</Link>
                        <Link href="/world-cup">World Cup</Link>
                        <Link href="/venues">Venues</Link>
                        {user && <Link href="/dashboard">My bookings</Link>}
                    </nav>
                    <nav className="bp-mobile-nav">
                        <Link href="/">Home</Link>
                        <Link href="/matches">Matches</Link>
                        <Link href="/venues">Venues</Link>
                        {user && <Link href="/dashboard">Bookings</Link>}
                    </nav>
                    <div className="bp-top-right">
                        {user
                            ? <Link href="/dashboard" className="bp-btn-pill ghost">{user.name?.split(" ")[0]}</Link>
                            : <Link href="/login" className="bp-btn-pill">Log in</Link>
                        }
                    </div>
                </div>
            </header>

            <div className="bp-content">
                <Link href="/blog" className="bp-back">← Back to Blog</Link>

                {loading ? (
                    <div className="bp-loading">Loading article...</div>
                ) : error && !post ? (
                    <div className="bp-error">{error}</div>
                ) : !post ? (
                    <div className="bp-empty">Blog post not found.</div>
                ) : (
                    <>
                        {post.featuredImageUrl && (
                            <img src={post.featuredImageUrl} alt={post.title} className="bp-hero-img" />
                        )}

                        <header style={{ display: "grid", gap: 12 }}>
                            {post.categories.length > 0 && (
                                <div className="bp-cats">
                                    {post.categories.map(c => (
                                        <span key={c.id} className="bp-cat">{c.name}</span>
                                    ))}
                                </div>
                            )}
                            <h1 className="bp-title">{post.title}</h1>
                            {post.excerpt && <p className="bp-excerpt">{post.excerpt}</p>}
                        </header>

                        {error && <div className="bp-error">{error}</div>}
                        {message && <div className="bp-success">{message}</div>}

                        <article
                            className="bp-article"
                            dangerouslySetInnerHTML={{ __html: post.contentHtml || "" }}
                        />

                        <section style={{ display: "grid", gap: 16 }}>
                            <h2 className="bp-comments-title">Comments</h2>

                            <div className="bp-comment-box">
                                <textarea
                                    placeholder={isAuthenticated ? "Write a comment…" : "Log in to leave a comment"}
                                    value={commentBody}
                                    onChange={e => setCommentBody(e.target.value)}
                                    disabled={!isAuthenticated}
                                />
                                <div className="bp-comment-actions">
                                    <span className="bp-comment-hint">
                                        {isAuthenticated
                                            ? "New comments are moderated before appearing publicly."
                                            : "You must be logged in to comment."}
                                    </span>
                                    <button
                                        className="bp-comment-submit"
                                        disabled={!isAuthenticated || submitting}
                                        onClick={() => void submitComment()}
                                    >
                                        {submitting ? "Submitting…" : "Submit Comment"}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: "grid", gap: 10 }}>
                                {comments.length === 0 ? (
                                    <div className="bp-empty">No approved comments yet.</div>
                                ) : comments.map(c => (
                                    <div key={c.id} className="bp-comment-card">
                                        <div className="bp-comment-author">{c.userName}</div>
                                        <div className="bp-comment-body">{c.content}</div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
