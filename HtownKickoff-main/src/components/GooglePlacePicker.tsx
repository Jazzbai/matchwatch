"use client";

import * as React from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { placesApi, type ExistingVenueMatch, type GooglePlaceDetailsResponse, type GooglePlaceSearchResult } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type GooglePlacePickerProps = {
  title?: string;
  description?: string;
  initialPlaceId?: string | null;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  onPlaceResolved: (details: GooglePlaceDetailsResponse) => void | Promise<void>;
};

export function GooglePlacePicker({
  title = "Google Place Lookup",
  description = "Search by venue name or paste a Google Places ID to load defaults.",
  initialPlaceId,
  disabled = false,
  className,
  buttonClassName,
  onPlaceResolved,
}: GooglePlacePickerProps) {
  const [query, setQuery] = React.useState("");
  const [placeId, setPlaceId] = React.useState(initialPlaceId || "");
  const [results, setResults] = React.useState<GooglePlaceSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [resolvingPlaceId, setResolvingPlaceId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = React.useState<ExistingVenueMatch | null>(null);

  React.useEffect(() => {
    setPlaceId(initialPlaceId || "");
  }, [initialPlaceId]);

  const search = React.useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await placesApi.search(query.trim());
      setResults(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google place search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const resolve = React.useCallback(async (nextPlaceId: string) => {
    if (!nextPlaceId.trim()) return;
    setResolvingPlaceId(nextPlaceId);
    setError(null);
    try {
      const res = await placesApi.details(nextPlaceId.trim());
      setPlaceId(res.data.googlePlaceId);
      setSelectedVenue(res.data.existingVenue || null);
      await onPlaceResolved(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google place lookup failed");
    } finally {
      setResolvingPlaceId(null);
    }
  }, [onPlaceResolved]);

  return (
    <div className={["rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4", className].filter(Boolean).join(" ")}>
      <div className="mb-3">
        <div className="text-sm font-semibold text-[var(--foreground)]">{title}</div>
        <div className="text-xs text-[var(--muted-foreground)]">{description}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search venue name"
            disabled={disabled || loading}
          />
          <Button
            type="button"
            variant="outline"
            className={buttonClassName}
            onClick={() => void search()}
            disabled={disabled || loading || !query.trim()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={placeId}
            onChange={(event) => setPlaceId(event.target.value)}
            placeholder="Google Places ID"
            disabled={disabled || !!resolvingPlaceId}
          />
          <Button
            type="button"
            variant="outline"
            className={buttonClassName}
            onClick={() => void resolve(placeId)}
            disabled={disabled || !!resolvingPlaceId || !placeId.trim()}
          >
            {resolvingPlaceId === placeId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      ) : null}

      {selectedVenue ? (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          Existing venue detected: <strong>{selectedVenue.name}</strong> in {selectedVenue.city}. Claim flow should be used instead of creating a duplicate.
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {results.map((result) => {
            const busy = resolvingPlaceId === result.placeId;
            return (
              <button
                key={result.placeId}
                type="button"
                onClick={() => void resolve(result.placeId)}
                disabled={disabled || !!resolvingPlaceId}
                className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-left transition hover:border-[var(--primary)]/40"
              >
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">{result.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{result.formattedAddress || result.city || "Address unavailable"}</span>
                  </div>
                  {result.existingVenue ? (
                    <div className="mt-1 text-[11px] font-medium text-amber-700">
                      Already exists on MatchWatch
                    </div>
                  ) : null}
                </div>
                <div className="flex min-w-[90px] justify-end">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" /> : <span className="text-xs font-semibold text-[var(--primary)]">Use this</span>}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
