"use client";

import React from "react";

type MatchVideoProps = {
  videoId?: string | null;
  embedUrl?: string | null;
  thumbnailUrl?: string | null;
  title?: string | null;
  /** Visual style: "thumb" = standalone card thumbnail, "badge" = small pill button. */
  variant?: "thumb" | "badge";
};

function resolveEmbed(videoId?: string | null, embedUrl?: string | null) {
  if (embedUrl) return embedUrl.includes("autoplay") ? embedUrl : `${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1`;
  if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  return null;
}

function resolveThumb(videoId?: string | null, thumbnailUrl?: string | null) {
  if (thumbnailUrl) return thumbnailUrl;
  if (videoId) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return null;
}

/**
 * Match recap video. Renders nothing unless a video is available. Click opens a
 * fixed-overlay lightbox with the YouTube embed. Theme-token styled.
 */
export function MatchVideo({ videoId, embedUrl, thumbnailUrl, title, variant = "thumb" }: MatchVideoProps) {
  const [open, setOpen] = React.useState(false);
  const embed = resolveEmbed(videoId, embedUrl);
  const thumb = resolveThumb(videoId, thumbnailUrl);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  if (!embed) return null;

  const PlayGlyph = (
    <span
      aria-hidden
      style={{
        display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: "50%",
        background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.5)", color: "#fff",
        backdropFilter: "blur(4px)",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
    </span>
  );

  return (
    <>
      {variant === "thumb" ? (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          aria-label={`Play recap${title ? `: ${title}` : ""}`}
          style={{
            position: "relative", display: "block", width: "100%", aspectRatio: "16 / 9",
            borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)",
            background: thumb ? `#000 url(${thumb}) center/cover no-repeat` : "var(--secondary)",
            cursor: "pointer", padding: 0,
          }}
        >
          <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.18)" }}>{PlayGlyph}</span>
          <span style={{ position: "absolute", left: 8, bottom: 8, fontFamily: "var(--font-mono), monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "rgba(0,0,0,0.55)", padding: "3px 6px", borderRadius: 999 }}>
            ▶ Recap
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          aria-label={`Play recap${title ? `: ${title}` : ""}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999,
            border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)",
            fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          Recap
        </button>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.85)", display: "grid", placeItems: "center", padding: 20 }}
          role="dialog"
          aria-modal="true"
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "min(960px, 100%)", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "#000" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close video"
              style={{ position: "absolute", top: 8, right: 8, zIndex: 2, width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
            >
              ✕
            </button>
            <iframe
              src={embed}
              title={title || "Match recap"}
              style={{ width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </>
  );
}
