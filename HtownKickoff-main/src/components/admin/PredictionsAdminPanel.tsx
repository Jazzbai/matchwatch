"use client";

import * as React from "react";
import { api, ApiClientError } from "../../lib/api";

type Prediction = {
  homeWinProbability: number;
  drawProbability: number | null;
  awayWinProbability: number;
  confidence: number;
  generatedAt: string;
  explanationFacts: Array<{ key: string; label: string; value?: number; home?: number; away?: number }>;
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

const btnStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--secondary)",
  color: "var(--foreground)",
  padding: "9px 12px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

function formatError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

export function PredictionsAdminPanel() {
  const [matchId, setMatchId] = React.useState("");
  const [prediction, setPrediction] = React.useState<Prediction | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function load(refresh = false) {
    if (!matchId.trim()) return;
    setError(null);
    try {
      const response = refresh
        ? await api.post<Prediction>(`/super-admin/predictions/${matchId.trim()}/refresh`)
        : await api.get<Prediction>(`/super-admin/predictions/${matchId.trim()}`);
      setPrediction(response.data || null);
    } catch (err) {
      setError(formatError(err, "Failed to load prediction."));
      setPrediction(null);
    }
  }

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Predictions</div>
        <h2 className="font-display text-h2" style={{ margin: 0, color: "var(--foreground)" }}>Match Prediction Inspector</h2>
      </div>
      {error ? <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input value={matchId} onChange={(e) => setMatchId(e.target.value)} placeholder="Match ID" style={{ ...inputStyle, width: 360 }} />
        <button style={btnStyle} onClick={() => void load(false)}>Load</button>
        <button style={btnStyle} onClick={() => void load(true)}>Recompute</button>
      </div>
      <div className="card-flat" style={{ padding: 16 }}>
        {!prediction ? (
          <p style={{ margin: 0, color: "var(--muted-foreground)" }}>Enter a match ID to inspect the current prediction snapshot.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: prediction.drawProbability == null ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              <div className="card-flat" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Home Win</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{Math.round(prediction.homeWinProbability * 100)}%</div>
              </div>
              {prediction.drawProbability != null ? (
                <div className="card-flat" style={{ padding: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Draw</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{Math.round(prediction.drawProbability * 100)}%</div>
                </div>
              ) : null}
              <div className="card-flat" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Away Win</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{Math.round(prediction.awayWinProbability * 100)}%</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Confidence: {Math.round(prediction.confidence * 100)}% · Generated {new Date(prediction.generatedAt).toLocaleString()}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {prediction.explanationFacts.map((fact) => (
                <div key={fact.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                  <span style={{ color: "var(--foreground)", fontWeight: 700 }}>{fact.label}</span>
                  <span style={{ color: "var(--muted-foreground)" }}>
                    {fact.home !== undefined && fact.away !== undefined ? `${fact.home} vs ${fact.away}` : fact.value ?? "-"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
