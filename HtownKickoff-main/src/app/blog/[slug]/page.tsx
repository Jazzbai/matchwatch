"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { AppShell } from "../../../components/AppShell";
import { blogApi, type BlogComment, type BlogPostDetail } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { isAuthenticated } = useAuth();
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

  React.useEffect(() => {
    void load();
  }, [load]);

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
    <AppShell>
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 64px", display: "grid", gap: 20 }}>
        <Link href="/blog" style={{ textDecoration: "none", color: "var(--primary)", fontWeight: 800, fontSize: 13 }}>Back to Blog</Link>

        {loading ? (
          <div style={{ color: "var(--muted-foreground)" }}>Loading article...</div>
        ) : !post ? (
          <div style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 16, padding: 24, color: "var(--muted-foreground)" }}>Blog post not found.</div>
        ) : (
          <>
            {post.featuredImageUrl ? (
              <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid var(--border)" }}>
                <img src={post.featuredImageUrl} alt={post.title} style={{ width: "100%", maxHeight: 420, objectFit: "cover" }} />
              </div>
            ) : null}

            <header style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {post.categories.map((category) => (
                  <span key={category.id} style={{ borderRadius: 999, border: "1px solid var(--border)", padding: "7px 12px", fontSize: 12, fontWeight: 800, color: "var(--primary)", background: "color-mix(in oklch, var(--primary) 8%, transparent)" }}>{category.name}</span>
                ))}
              </div>
              <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.05, color: "var(--foreground)", fontWeight: 900 }}>{post.title}</h1>
              {post.excerpt ? <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: "var(--muted-foreground)" }}>{post.excerpt}</p> : null}
            </header>

            {error && <div style={{ border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#ef4444", borderRadius: 12, padding: 12 }}>{error}</div>}
            {message && <div style={{ border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.08)", color: "#16a34a", borderRadius: 12, padding: 12 }}>{message}</div>}

            <article
              style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 20, padding: "28px 24px", color: "var(--foreground)", lineHeight: 1.75 }}
              dangerouslySetInnerHTML={{ __html: post.contentHtml || "" }}
            />

            <section style={{ display: "grid", gap: 14 }}>
              <h2 style={{ margin: 0, fontSize: 24, color: "var(--foreground)", fontWeight: 900 }}>Comments</h2>
              <div style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
                <textarea
                  style={{ width: "100%", minHeight: 120, borderRadius: 12, border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)", padding: 12, fontFamily: "inherit", resize: "vertical" }}
                  placeholder={isAuthenticated ? "Write a comment" : "Log in to leave a comment"}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  disabled={!isAuthenticated}
                />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{isAuthenticated ? "New comments are moderated before appearing publicly." : "You must be logged in to comment."}</div>
                  <button style={{ borderRadius: 12, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", padding: "10px 16px", fontWeight: 800, cursor: isAuthenticated ? "pointer" : "not-allowed", opacity: isAuthenticated ? 1 : 0.5 }} disabled={!isAuthenticated || submitting} onClick={() => void submitComment()}>
                    {submitting ? "Submitting..." : "Submit Comment"}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {comments.length === 0 ? (
                  <div style={{ color: "var(--muted-foreground)" }}>No approved comments yet.</div>
                ) : comments.map((comment) => (
                  <div key={comment.id} style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
                    <div style={{ fontWeight: 800, color: "var(--foreground)" }}>{comment.userName}</div>
                    <div style={{ color: "var(--foreground)", lineHeight: 1.7 }}>{comment.content}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </AppShell>
  );
}
