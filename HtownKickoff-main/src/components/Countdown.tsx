"use client";

import React from "react";

/**
 * Live countdown to a target date. Renders day/hour/min/sec unit boxes using the
 * global theme tokens (works in light + dark). Mount-gated so SSR and the first
 * client render match (no hydration mismatch); shows nothing until mounted.
 */
export function Countdown({
  target,
  label,
  accent = "var(--primary)",
}: {
  target: string | Date;
  label?: string;
  accent?: string;
}) {
  const targetMs = React.useMemo(() => new Date(target).getTime(), [target]);
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = now === null ? 0 : Math.max(0, targetMs - now);
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const units: Array<{ v: number; l: string }> = [
    { v: days, l: "Days" },
    { v: hrs, l: "Hrs" },
    { v: mins, l: "Min" },
    { v: secs, l: "Sec" },
  ];

  // Reserve layout space before mount to avoid a flash, but don't render
  // server/client-divergent numbers.
  const ready = now !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {label && (
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
          {label}
        </span>
      )}
      <div style={{ display: "flex", gap: 8 }} aria-label={label || "Countdown"}>
        {units.map((u, i) => (
          <div
            key={u.l}
            style={{
              minWidth: 58,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "color-mix(in srgb, var(--card) 80%, transparent)",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: "var(--font-space), 'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 26, lineHeight: 1, color: i === 0 ? accent : "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
              {ready ? String(u.v).padStart(2, "0") : "--"}
            </div>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", marginTop: 4 }}>
              {u.l}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
