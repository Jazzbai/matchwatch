import { nanoid } from 'nanoid';

export type EntityKind = 'league' | 'team' | 'player' | 'driver' | 'entrant' | 'manufacturer';

type SearchItem = {
  title?: string;
  snippet?: string;
  link?: string;
  image?: { thumbnailLink?: string; contextLink?: string };
  pagemap?: Record<string, unknown>;
};

export type EntityBaseRecord = {
  id: string;
  name: string;
  shortName?: string | null;
  sportName?: string | null;
  leagueName?: string | null;
  country?: string | null;
  nationality?: string | null;
  website?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  primaryImageUrl?: string | null;
  heroImageUrl?: string | null;
  shortDescriptionSource?: 'NONE' | 'GOOGLE' | 'MANUAL' | null;
  descriptionSource?: 'NONE' | 'GOOGLE' | 'MANUAL' | null;
  primaryImageSource?: 'NONE' | 'GOOGLE' | 'MANUAL' | null;
  heroImageSource?: 'NONE' | 'GOOGLE' | 'MANUAL' | null;
  websiteSource?: 'NONE' | 'GOOGLE' | 'MANUAL' | null;
};

export type EntityEnrichmentResult = {
  snapshot: Record<string, unknown>;
  updates: {
    shortDescription?: string;
    description?: string;
    website?: string | null;
    heroImageUrl?: string | null;
    primaryImageUrl?: string | null;
    aliases?: string[];
    shortDescriptionSource?: 'GOOGLE';
    descriptionSource?: 'GOOGLE';
    primaryImageSource?: 'GOOGLE';
    heroImageSource?: 'GOOGLE';
    websiteSource?: 'GOOGLE';
  };
};

function compact(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function ensureSentence(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (value || '').trim()).filter(Boolean)));
}

function deterministicDescription(kind: EntityKind, record: EntityBaseRecord) {
  const descriptor = (() => {
    switch (kind) {
      case 'league': return record.sportName ? `${record.sportName} competition` : 'sports competition';
      case 'team': return record.sportName ? `${record.sportName} team` : 'sports team';
      case 'player': return record.sportName ? `${record.sportName} player` : 'athlete';
      case 'driver': return 'racing driver';
      case 'entrant': return 'motorsport team';
      case 'manufacturer': return 'motorsport manufacturer';
      default: return 'sports entity';
    }
  })();
  const context = uniqueStrings([record.leagueName, record.country || record.nationality]).join(' in ');
  const sentence = `${record.name} is a ${descriptor}${context ? ` competing in ${context}` : ''}.`;
  const long = `${sentence} MatchWatch tracks schedules, results, standings, and watchparty context for this ${kind === 'league' ? 'competition' : 'entity'}.`;
  return {
    shortDescription: compact(sentence, 140),
    description: compact(long, 420),
  };
}

async function fetchCustomSearch(query: string, mode: 'web' | 'image') {
  const key = process.env.GOOGLE_SEARCH_API_KEY?.trim();
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID?.trim();
  if (!key || !cx) return [] as SearchItem[];

  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    num: '5',
  });
  if (mode === 'image') params.set('searchType', 'image');

  const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
  if (!response.ok) return [] as SearchItem[];
  const payload = await response.json() as { items?: SearchItem[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

function extractImageUrls(items: SearchItem[]) {
  const links = items.flatMap((item) => [
    item.link,
    item.image?.thumbnailLink,
    item.image?.contextLink,
  ]);
  return uniqueStrings(links).filter((value) => /^https?:\/\//i.test(value)).slice(0, 6);
}

function extractWebsite(items: SearchItem[]) {
  const candidate = items.find((item) => typeof item.link === 'string' && /^https?:\/\//i.test(item.link || ''));
  return candidate?.link || null;
}

function extractSnippet(items: SearchItem[]) {
  const snippet = items.find((item) => item.snippet?.trim())?.snippet?.trim();
  return snippet || null;
}

function buildQuery(kind: EntityKind, record: EntityBaseRecord) {
  return uniqueStrings([
    record.name,
    record.shortName,
    record.leagueName,
    record.sportName,
    record.country,
    record.nationality,
    kind === 'team' ? 'team' : kind === 'player' ? 'player' : kind === 'driver' ? 'driver' : kind === 'league' ? 'league' : 'motorsport team',
  ]).join(' ');
}

export async function buildEntityEnrichment(kind: EntityKind, record: EntityBaseRecord): Promise<EntityEnrichmentResult> {
  const query = buildQuery(kind, record);
  const [webResults, imageResults] = await Promise.all([
    fetchCustomSearch(query, 'web'),
    fetchCustomSearch(query, 'image'),
  ]);

  const snippet = extractSnippet(webResults);
  const website = extractWebsite(webResults);
  const imageUrls = extractImageUrls(imageResults);
  const fallback = deterministicDescription(kind, record);

  const shortDescription = record.shortDescriptionSource === 'MANUAL'
    ? undefined
    : compact(snippet || fallback.shortDescription, 140);
  const description = record.descriptionSource === 'MANUAL'
    ? undefined
    : compact(ensureSentence(snippet || fallback.description), 420);
  const primaryImageUrl = record.primaryImageSource === 'MANUAL'
    ? undefined
    : (imageUrls[0] || record.primaryImageUrl || null);
  const heroImageUrl = record.heroImageSource === 'MANUAL'
    ? undefined
    : (imageUrls[1] || imageUrls[0] || record.heroImageUrl || record.primaryImageUrl || null);
  const nextWebsite = record.websiteSource === 'MANUAL'
    ? undefined
    : (website || record.website || null);

  const aliases = uniqueStrings([
    record.shortName,
    webResults[0]?.title,
    webResults[1]?.title,
  ]).filter((value) => value.toLowerCase() !== record.name.toLowerCase()).slice(0, 5);

  return {
    snapshot: {
      query,
      fetchedAt: new Date().toISOString(),
      providerSeed: {
        name: record.name,
        shortName: record.shortName || null,
        sportName: record.sportName || null,
        leagueName: record.leagueName || null,
        country: record.country || record.nationality || null,
      },
      webResults: webResults.map((item) => ({ title: item.title || null, snippet: item.snippet || null, link: item.link || null })),
      imageUrls,
      requestId: nanoid(10),
    },
    updates: {
      ...(shortDescription ? { shortDescription, shortDescriptionSource: 'GOOGLE' as const } : {}),
      ...(description ? { description, descriptionSource: 'GOOGLE' as const } : {}),
      ...(primaryImageUrl ? { primaryImageUrl, primaryImageSource: 'GOOGLE' as const } : {}),
      ...(heroImageUrl ? { heroImageUrl, heroImageSource: 'GOOGLE' as const } : {}),
      ...(nextWebsite ? { website: nextWebsite, websiteSource: 'GOOGLE' as const } : {}),
      ...(aliases.length > 0 ? { aliases } : {}),
    },
  };
}

export function resolveEntityPresentation(kind: EntityKind, record: EntityBaseRecord) {
  const fallback = deterministicDescription(kind, record);
  return {
    shortDescription: record.shortDescription || fallback.shortDescription,
    description: record.description || fallback.description,
    heroImageUrl: record.heroImageUrl || record.primaryImageUrl || null,
    primaryImageUrl: record.primaryImageUrl || null,
  };
}
