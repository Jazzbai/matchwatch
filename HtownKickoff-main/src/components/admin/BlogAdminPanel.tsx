"use client";

import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { ImagePlus, Link2, Plus, RefreshCcw } from "lucide-react";
import { api } from "../../lib/api";

type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
};

type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  featuredImageUrl?: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt?: string | null;
  categories: Array<{ id: string; name: string; slug: string }>;
};

type BlogPostDetail = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  featuredImageUrl?: string | null;
  featuredImageS3Key?: string | null;
  contentJson?: unknown;
  contentHtml?: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt?: string | null;
  categoryIds: string[];
};

type BlogComment = {
  id: string;
  postId: string;
  postTitle: string;
  userName: string;
  content: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
};

type CategoryDraft = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

type PostDraft = {
  title: string;
  slug: string;
  excerpt: string;
  featuredImageUrl: string;
  featuredImageS3Key: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string;
  categoryIds: string[];
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
  minHeight: 96,
  resize: "vertical",
};

const btnStyle = (kind: "primary" | "outline" | "danger" = "outline"): React.CSSProperties => ({
  borderRadius: 10,
  border: kind === "primary" ? "none" : kind === "danger" ? "1px solid rgba(239,68,68,0.35)" : "1px solid var(--border)",
  background: kind === "primary" ? "var(--primary)" : kind === "danger" ? "rgba(239,68,68,0.08)" : "var(--secondary)",
  color: kind === "primary" ? "var(--primary-foreground)" : kind === "danger" ? "#ef4444" : "var(--foreground)",
  padding: "9px 12px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
});

function toDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function uploadImage(file: File) {
  const presigned = await api.post<{
    uploadUrl: string;
    publicUrl: string;
    key: string;
  }>("/super-admin/uploads/presigned-url", {
    filename: file.name,
    contentType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
    purpose: "post",
    fileSize: file.size,
  });

  const uploadRes = await fetch(presigned.data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error("Image upload failed. Check S3 configuration.");
  }

  return {
    url: presigned.data.publicUrl,
    key: presigned.data.key,
  };
}

export function BlogAdminPanel() {
  const [categories, setCategories] = React.useState<BlogCategory[]>([]);
  const [posts, setPosts] = React.useState<BlogPostSummary[]>([]);
  const [comments, setComments] = React.useState<BlogComment[]>([]);
  const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);
  const [categoryDrafts, setCategoryDrafts] = React.useState<Record<string, CategoryDraft>>({});
  const [newCategory, setNewCategory] = React.useState<CategoryDraft>({ name: "", slug: "", description: "", sortOrder: "0", isActive: true });
  const [postDraft, setPostDraft] = React.useState<PostDraft>({
    title: "",
    slug: "",
    excerpt: "",
    featuredImageUrl: "",
    featuredImageS3Key: "",
    status: "DRAFT",
    publishedAt: "",
    categoryIds: [],
  });
  const [commentsFilter, setCommentsFilter] = React.useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [postsSearch, setPostsSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const featuredUploadRef = React.useRef<HTMLInputElement | null>(null);
  const inlineUploadRef = React.useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false, autolink: true, defaultProtocol: "https" }), Image.configure({ allowBase64: false })],
    content: "",
    editorProps: {
      attributes: {
        style: "min-height:320px;padding:16px;color:var(--foreground);outline:none;",
      },
    },
  });

  const loadCategories = React.useCallback(async () => {
    const response = await api.get<BlogCategory[]>("/super-admin/blog/categories");
    setCategories(response.data || []);
  }, []);

  const loadPosts = React.useCallback(async () => {
    const response = await api.get<BlogPostSummary[]>("/super-admin/blog/posts", { search: postsSearch, page: 1, limit: 100 });
    setPosts(response.data || []);
  }, [postsSearch]);

  const loadComments = React.useCallback(async () => {
    const response = await api.get<BlogComment[]>("/super-admin/blog/comments", commentsFilter === "ALL" ? undefined : { status: commentsFilter });
    setComments(response.data || []);
  }, [commentsFilter]);

  const loadPostDetail = React.useCallback(async (postId: string | null) => {
    if (!postId) {
      setPostDraft({ title: "", slug: "", excerpt: "", featuredImageUrl: "", featuredImageS3Key: "", status: "DRAFT", publishedAt: "", categoryIds: [] });
      editor?.commands.setContent("", { emitUpdate: false });
      return;
    }

    const response = await api.get<BlogPostDetail>(`/super-admin/blog/posts/${postId}`);
    const row = response.data;
    setPostDraft({
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt || "",
      featuredImageUrl: row.featuredImageUrl || "",
      featuredImageS3Key: row.featuredImageS3Key || "",
      status: row.status,
      publishedAt: toDatetimeLocal(row.publishedAt),
      categoryIds: row.categoryIds || [],
    });
    if (editor) editor.commands.setContent((row.contentJson as object) || row.contentHtml || "", { emitUpdate: false });
  }, [editor]);

  const reloadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadCategories(), loadPosts(), loadComments()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load blog admin data");
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadComments, loadPosts]);

  React.useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  React.useEffect(() => {
    if (!selectedPostId) return;
    void loadPostDetail(selectedPostId);
  }, [selectedPostId, loadPostDetail]);

  const beginNewPost = React.useCallback(() => {
    setSelectedPostId(null);
    setPostDraft({ title: "", slug: "", excerpt: "", featuredImageUrl: "", featuredImageS3Key: "", status: "DRAFT", publishedAt: "", categoryIds: [] });
    editor?.commands.setContent("", { emitUpdate: false });
  }, [editor]);

  const saveCategory = async (categoryId?: string) => {
    const draft = categoryId ? categoryDrafts[categoryId] : newCategory;
    if (!draft?.name.trim()) return;
    setSaving(categoryId ? `category-${categoryId}` : "category-new");
    setError(null);
    setMessage(null);
    try {
      if (categoryId) {
        await api.patch(`/super-admin/blog/categories/${categoryId}`, { name: draft.name, slug: draft.slug || undefined, description: draft.description || null, sortOrder: Number(draft.sortOrder || 0), isActive: draft.isActive });
      } else {
        await api.post("/super-admin/blog/categories", { name: draft.name, slug: draft.slug || undefined, description: draft.description || null, sortOrder: Number(draft.sortOrder || 0), isActive: draft.isActive });
        setNewCategory({ name: "", slug: "", description: "", sortOrder: "0", isActive: true });
      }
      await loadCategories();
      setMessage("Category saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setSaving(null);
    }
  };

  const savePost = async () => {
    if (!editor) return;
    if (!postDraft.title.trim()) {
      setError("Post title is required");
      return;
    }
    setSaving(selectedPostId ? `post-${selectedPostId}` : "post-new");
    setError(null);
    setMessage(null);
    try {
      const payload = {
        title: postDraft.title,
        slug: postDraft.slug || toSlug(postDraft.title),
        excerpt: postDraft.excerpt || null,
        featuredImageUrl: postDraft.featuredImageUrl || null,
        featuredImageS3Key: postDraft.featuredImageS3Key || null,
        contentJson: editor.getJSON(),
        renderedHtml: editor.getHTML(),
        status: postDraft.status,
        publishedAt: postDraft.publishedAt ? new Date(postDraft.publishedAt).toISOString() : null,
        categoryIds: postDraft.categoryIds,
      };
      if (selectedPostId) {
        await api.patch(`/super-admin/blog/posts/${selectedPostId}`, payload);
        await loadPostDetail(selectedPostId);
      } else {
        const created = await api.post<{ id: string }>("/super-admin/blog/posts", payload);
        setSelectedPostId(created.data.id);
      }
      await loadPosts();
      setMessage("Post saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post");
    } finally {
      setSaving(null);
    }
  };

  const handleFeaturedUpload = async (file: File | null) => {
    if (!file) return;
    setSaving("featured-upload");
    setError(null);
    try {
      const uploaded = await uploadImage(file);
      setPostDraft((prev) => ({ ...prev, featuredImageUrl: uploaded.url, featuredImageS3Key: uploaded.key }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Featured image upload failed");
    } finally {
      setSaving(null);
    }
  };

  const handleInlineUpload = async (file: File | null) => {
    if (!file || !editor) return;
    setSaving("inline-upload");
    setError(null);
    try {
      const uploaded = await uploadImage(file);
      editor.chain().focus().setImage({ src: uploaded.url, alt: file.name }).run();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inline image upload failed");
    } finally {
      setSaving(null);
    }
  };

  const updateCommentStatus = async (commentId: string, status: BlogComment["status"]) => {
    setSaving(`comment-${commentId}`);
    setError(null);
    try {
      await api.patch(`/super-admin/blog/comments/${commentId}`, { status });
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update comment");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error && <div style={{ border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#ef4444", borderRadius: 12, padding: 12, fontSize: 13 }}>{error}</div>}
      {message && <div style={{ border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.08)", color: "#16a34a", borderRadius: 12, padding: 12, fontSize: 13 }}>{message}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: "var(--foreground)", fontWeight: 800 }}>Blog CMS</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>Manage categories, posts, featured images, and comment moderation.</p>
        </div>
        <button style={btnStyle("outline")} onClick={() => void reloadAll()} disabled={loading}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RefreshCcw size={14} /> Refresh</span>
        </button>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 16, background: "var(--card)", padding: 16, display: "grid", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Categories</h3>
            <input style={inputStyle} placeholder="Category name" value={newCategory.name} onChange={(e) => setNewCategory((prev) => ({ ...prev, name: e.target.value, slug: prev.slug || toSlug(e.target.value) }))} />
            <input style={inputStyle} placeholder="Slug" value={newCategory.slug} onChange={(e) => setNewCategory((prev) => ({ ...prev, slug: e.target.value }))} />
            <textarea style={textareaStyle} placeholder="Description" value={newCategory.description} onChange={(e) => setNewCategory((prev) => ({ ...prev, description: e.target.value }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
              <input style={inputStyle} type="number" placeholder="Sort order" value={newCategory.sortOrder} onChange={(e) => setNewCategory((prev) => ({ ...prev, sortOrder: e.target.value }))} />
              <button style={btnStyle("primary")} onClick={() => void saveCategory()} disabled={saving === "category-new"}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Add</span></button>
            </div>

            <div style={{ display: "grid", gap: 10, maxHeight: 360, overflow: "auto" }}>
              {categories.map((category) => {
                const draft = categoryDrafts[category.id] || { name: category.name, slug: category.slug, description: category.description || "", sortOrder: String(category.sortOrder ?? 0), isActive: category.isActive };
                return (
                  <div key={category.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10, display: "grid", gap: 8 }}>
                    <input style={inputStyle} value={draft.name} onChange={(e) => setCategoryDrafts((prev) => ({ ...prev, [category.id]: { ...draft, name: e.target.value } }))} />
                    <input style={inputStyle} value={draft.slug} onChange={(e) => setCategoryDrafts((prev) => ({ ...prev, [category.id]: { ...draft, slug: e.target.value } }))} />
                    <textarea style={{ ...textareaStyle, minHeight: 72 }} value={draft.description} onChange={(e) => setCategoryDrafts((prev) => ({ ...prev, [category.id]: { ...draft, description: e.target.value } }))} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
                      <input style={inputStyle} type="number" value={draft.sortOrder} onChange={(e) => setCategoryDrafts((prev) => ({ ...prev, [category.id]: { ...draft, sortOrder: e.target.value } }))} />
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted-foreground)" }}><input type="checkbox" checked={draft.isActive} onChange={(e) => setCategoryDrafts((prev) => ({ ...prev, [category.id]: { ...draft, isActive: e.target.checked } }))} />Active</label>
                      <button style={btnStyle("outline")} onClick={() => void saveCategory(category.id)} disabled={saving === `category-${category.id}`}>Save</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 16, background: "var(--card)", padding: 16, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Posts</h3>
              <button style={btnStyle("primary")} onClick={beginNewPost}>New Post</button>
            </div>
            <input style={inputStyle} placeholder="Search posts" value={postsSearch} onChange={(e) => setPostsSearch(e.target.value)} />
            <button style={btnStyle("outline")} onClick={() => void loadPosts()}>Search</button>
            <div style={{ display: "grid", gap: 10, maxHeight: 420, overflow: "auto" }}>
              {posts.map((post) => (
                <button key={post.id} onClick={() => setSelectedPostId(post.id)} style={{ textAlign: "left", borderRadius: 12, border: selectedPostId === post.id ? "1px solid var(--primary)" : "1px solid var(--border)", background: selectedPostId === post.id ? "color-mix(in oklch, var(--primary) 8%, var(--card))" : "var(--card)", padding: 12, cursor: "pointer", display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{post.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{post.status} · {post.categories.map((category) => category.name).join(", ") || "No categories"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{formatDate(post.publishedAt)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 16, background: "var(--card)", padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>{selectedPostId ? "Edit Post" : "Create Post"}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={btnStyle("outline")} onClick={() => featuredUploadRef.current?.click()} disabled={saving === "featured-upload"}>Featured Image</button>
                <button style={btnStyle("primary")} onClick={() => void savePost()} disabled={!editor || Boolean(saving)}>Save Post</button>
              </div>
            </div>

            <input ref={featuredUploadRef} type="file" accept="image/*" hidden onChange={(e) => void handleFeaturedUpload(e.target.files?.[0] || null)} />
            <input ref={inlineUploadRef} type="file" accept="image/*" hidden onChange={(e) => void handleInlineUpload(e.target.files?.[0] || null)} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              <input style={inputStyle} placeholder="Title" value={postDraft.title} onChange={(e) => setPostDraft((prev) => ({ ...prev, title: e.target.value, slug: prev.slug || toSlug(e.target.value) }))} />
              <input style={inputStyle} placeholder="Slug" value={postDraft.slug} onChange={(e) => setPostDraft((prev) => ({ ...prev, slug: e.target.value }))} />
              <select style={inputStyle} value={postDraft.status} onChange={(e) => setPostDraft((prev) => ({ ...prev, status: e.target.value as PostDraft["status"] }))}><option value="DRAFT">DRAFT</option><option value="PUBLISHED">PUBLISHED</option></select>
              <input style={inputStyle} type="datetime-local" value={postDraft.publishedAt} onChange={(e) => setPostDraft((prev) => ({ ...prev, publishedAt: e.target.value }))} />
            </div>

            <textarea style={textareaStyle} placeholder="Excerpt" value={postDraft.excerpt} onChange={(e) => setPostDraft((prev) => ({ ...prev, excerpt: e.target.value }))} />

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}>
              <input style={inputStyle} placeholder="Featured image URL" value={postDraft.featuredImageUrl} onChange={(e) => setPostDraft((prev) => ({ ...prev, featuredImageUrl: e.target.value }))} />
              {postDraft.featuredImageUrl ? <img src={postDraft.featuredImageUrl} alt="Featured" style={{ width: 96, height: 64, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} /> : <div style={{ width: 96, height: 64, borderRadius: 10, border: "1px dashed var(--border)" }} />}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Categories</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {categories.map((category) => {
                  const selected = postDraft.categoryIds.includes(category.id);
                  return (
                    <button key={category.id} onClick={() => setPostDraft((prev) => ({ ...prev, categoryIds: selected ? prev.categoryIds.filter((id) => id !== category.id) : [...prev.categoryIds, category.id] }))} style={{ borderRadius: 999, border: selected ? "1px solid var(--primary)" : "1px solid var(--border)", background: selected ? "color-mix(in oklch, var(--primary) 10%, transparent)" : "transparent", color: selected ? "var(--primary)" : "var(--muted-foreground)", padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12, borderBottom: "1px solid var(--border)", background: "var(--secondary)" }}>
                <button style={btnStyle("outline")} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
                <button style={btnStyle("outline")} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
                <button style={btnStyle("outline")} onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</button>
                <button style={btnStyle("outline")} onClick={() => editor?.chain().focus().toggleItalic().run()}>Italic</button>
                <button style={btnStyle("outline")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>Bullet</button>
                <button style={btnStyle("outline")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>Ordered</button>
                <button style={btnStyle("outline")} onClick={() => { const href = window.prompt("Enter link URL"); if (!href) return; editor?.chain().focus().extendMarkRange("link").setLink({ href }).run(); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Link2 size={14} /> Link</span></button>
                <button style={btnStyle("outline")} onClick={() => inlineUploadRef.current?.click()}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ImagePlus size={14} /> Image</span></button>
              </div>
              <EditorContent editor={editor} style={{ background: "var(--card)" }} />
            </div>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 16, background: "var(--card)", padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 15, color: "var(--foreground)", fontWeight: 800 }}>Comments Moderation</h3>
              <select style={{ ...inputStyle, width: 180 }} value={commentsFilter} onChange={(e) => setCommentsFilter(e.target.value as typeof commentsFilter)}><option value="ALL">All</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
            </div>
            <div style={{ display: "grid", gap: 10, maxHeight: 380, overflow: "auto" }}>
              {comments.map((comment) => (
                <div key={comment.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--foreground)" }}>{comment.postTitle}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{comment.userName} · {formatDate(comment.createdAt)}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: comment.status === "APPROVED" ? "#16a34a" : comment.status === "REJECTED" ? "#ef4444" : "#f59e0b" }}>{comment.status}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.6 }}>{comment.content}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={btnStyle("primary")} onClick={() => void updateCommentStatus(comment.id, "APPROVED")} disabled={saving === `comment-${comment.id}`}>Approve</button>
                    <button style={btnStyle("danger")} onClick={() => void updateCommentStatus(comment.id, "REJECTED")} disabled={saving === `comment-${comment.id}`}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
﻿
