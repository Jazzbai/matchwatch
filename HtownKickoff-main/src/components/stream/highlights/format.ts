import type { FactorKey } from '../../../lib/highlights/types';

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Diagram step 6 signal names, with their one-letter symbols from the ranking table. */
export const factorLabels: Record<FactorKey, { name: string; symbol: string }> = {
  sports: { name: 'Sports importance', symbol: 'S' },
  social: { name: 'Social trend', symbol: 'T' },
  emotion: { name: 'Emotional intensity', symbol: 'E' },
  controversy: { name: 'Controversy & surprise', symbol: 'C' },
  audience: { name: 'Audience relevance', symbol: 'A' },
  quality: { name: 'Quality & diversity', symbol: 'Q' },
};

/** Score names used in the key-moments JSON (workflow document step 10). */
export const scoreName: Record<FactorKey, string> = {
  sports: 'sports_importance', social: 'social_trend_spike', emotion: 'emotional_intensity',
  controversy: 'controversy_surprise', audience: 'audience_relevance', quality: 'quality_diversity',
};

export const twoDecimals = (value: number | null | undefined) => (value === null || value === undefined ? '—' : value.toFixed(2));
