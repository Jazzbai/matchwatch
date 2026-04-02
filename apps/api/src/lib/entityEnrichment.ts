import { nanoid } from 'nanoid';

export type EntityKind = 'league' | 'team' | 'player' | 'driver' | 'entrant' | 'manufacturer';
type EntityFieldSource = 'NONE' | 'GOOGLE' | 'MANUAL';
type EnrichmentProvider = 'generated' | 'serpapi' | 'google-legacy';

type SearchItem = {
  title?: string;
  snippet?: string;
  link?: string;
  image?: { thumbnailLink?: string; contextLink?: string };
  pagemap?: Record<string, unknown>;
};

type SerpApiOrganicResult = {
  title?: string;
  snippet?: string;
  link?: string;
  source?: string;
};

type SerpApiImageResult = {
  title?: string;
  link?: string;
  original?: string;
  thumbnail?: string;
  source?: string;
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
  shortDescriptionSource?: EntityFieldSource | null;
  descriptionSource?: EntityFieldSource | null;
  primaryImageSource?: EntityFieldSource | null;
  heroImageSource?: EntityFieldSource | null;
  websiteSource?: EntityFieldSource | null;
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
  const location = uniqueStrings([record.country, record.nationality]).join(', ');
  const competitionContext = uniqueStrings([record.leagueName, record.sportName]).join(' ');
  const descriptor = (() => {
    if (kind === 'league') return record.sportName ? `${record.sportName} competition` : 'sports competition';
    if (kind === 'team') return record.sportName ? `${record.sportName} team` : 'sports team';
    if (kind === 'player') return record.sportName ? `${record.sportName} player` : 'athlete';
    if (kind === 'driver') return 'racing driver';
    if (kind === 'entrant') return 'motorsport team';
    if (kind === 'manufacturer') return 'motorsport manufacturer';
    return 'sports entity';
  })();

  const shortSentence = (() => {
    switch (kind) {
      case 'league':
        return `${record.name} is a ${descriptor}${location ? ` based in ${location}` : ''}.`;
      case 'team':
        return `${record.name} is a ${descriptor}${competitionContext ? ` competing in ${competitionContext}` : ''}${location ? ` and associated with ${location}` : ''}.`;
      case 'player':
        return `${record.name} is a ${descriptor}${competitionContext ? ` active in ${competitionContext}` : ''}${location ? ` from ${location}` : ''}.`;
      case 'driver':
        return `${record.name} is a ${descriptor}${competitionContext ? ` competing in ${competitionContext}` : ''}${location ? ` from ${location}` : ''}.`;
      case 'entrant':
        return `${record.name} is a ${descriptor}${competitionContext ? ` active in ${competitionContext}` : ''}.`;
      case 'manufacturer':
        return `${record.name} is a ${descriptor}${competitionContext ? ` associated with ${competitionContext}` : ''}.`;
      default:
        return `${record.name} is a ${descriptor}.`;
    }
  })();

  const long = (() => {
    const scope = kind === 'league' ? 'competition' : 'entity';
    const supportingContext = uniqueStrings([
      competitionContext || null,
      location || null,
      record.shortName || null,
    ]).join(' | ');
    return `${shortSentence} MatchWatch tracks schedules, results, standings, rankings, and watchparty context for this ${scope}${supportingContext ? `, with catalog metadata seeded from ${supportingContext}` : ''}.`;
  })();

  return {
    shortDescription: compact(shortSentence, 140),
    description: compact(long, 420),
  };
}

function resolveProvider(): EnrichmentProvider {
  const preferred = process.env.ENTITY_ENRICHMENT_PROVIDER?.trim().toLowerCase();
  if (preferred === 'serpapi' && process.env.SERPAPI_API_KEY?.trim()) return 'serpapi';
  if ((preferred === 'google' || preferred === 'google-legacy') && process.env.GOOGLE_SEARCH_API_KEY?.trim() && process.env.GOOGLE_SEARCH_ENGINE_ID?.trim()) {
    return 'google-legacy';
  }
  if (preferred === 'generated') return 'generated';
  if (process.env.SERPAPI_API_KEY?.trim()) return 'serpapi';
  return 'generated';
}

async function fetchCustomSearchLegacy(query: string, mode: 'web' | 'image') {
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

async function fetchSerpApiSearch(query: string, mode: 'web' | 'image') {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return { webResults: [] as SearchItem[], imageUrls: [] as string[] };

  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    api_key: apiKey,
    num: '5',
    no_cache: 'true',
    output: 'json',
  });

  if (process.env.SERPAPI_LOCATION?.trim()) params.set('location', process.env.SERPAPI_LOCATION.trim());
  if (mode === 'image') params.set('tbm', 'isch');

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!response.ok) return { webResults: [] as SearchItem[], imageUrls: [] as string[] };

  const payload = await response.json() as {
    error?: string;
    organic_results?: SerpApiOrganicResult[];
    images_results?: SerpApiImageResult[];
  };

  if (payload.error) return { webResults: [] as SearchItem[], imageUrls: [] as string[] };

  if (mode === 'image') {
    const imageUrls = uniqueStrings((payload.images_results || []).flatMap((item) => [
      item.original,
      item.thumbnail,
      item.link,
      item.source,
    ])).filter((value) => /^https?:\/\//i.test(value)).slice(0, 6);
    return { webResults: [] as SearchItem[], imageUrls };
  }

  const webResults = (payload.organic_results || []).slice(0, 5).map((item) => ({
    title: item.title,
    snippet: item.snippet,
    link: item.link,
  }));
  return { webResults, imageUrls: [] as string[] };
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
  const provider = resolveProvider();
  let webResults: SearchItem[] = [];
  let imageUrls: string[] = [];

  if (provider === 'serpapi') {
    const [webResultSet, imageResultSet] = await Promise.all([
      fetchSerpApiSearch(query, 'web'),
      fetchSerpApiSearch(query, 'image'),
    ]);
    webResults = webResultSet.webResults;
    imageUrls = imageResultSet.imageUrls;
  } else if (provider === 'google-legacy') {
    const [legacyWebResults, imageResults] = await Promise.all([
      fetchCustomSearchLegacy(query, 'web'),
      fetchCustomSearchLegacy(query, 'image'),
    ]);
    webResults = legacyWebResults;
    imageUrls = extractImageUrls(imageResults);
  }

  const snippet = extractSnippet(webResults);
  const website = extractWebsite(webResults);
  const fallback = deterministicDescription(kind, record);
  const autoSource = 'GOOGLE' as const;

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
      provider,
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
      usedGeneratedFallback: provider === 'generated' || !snippet,
      requestId: nanoid(10),
    },
    updates: {
      ...(shortDescription ? { shortDescription, shortDescriptionSource: autoSource } : {}),
      ...(description ? { description, descriptionSource: autoSource } : {}),
      ...(primaryImageUrl ? { primaryImageUrl, primaryImageSource: autoSource } : {}),
      ...(heroImageUrl ? { heroImageUrl, heroImageSource: autoSource } : {}),
      ...(nextWebsite ? { website: nextWebsite, websiteSource: autoSource } : {}),
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
