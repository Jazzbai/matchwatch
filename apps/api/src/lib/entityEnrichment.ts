import { nanoid } from 'nanoid';
import { logger } from './logger';

export type EntityKind = 'league' | 'team' | 'player' | 'driver' | 'entrant' | 'manufacturer' | 'stadium';
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
  teamName?: string | null;
  role?: string | null;
  city?: string | null;
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
  const teamContext = uniqueStrings([record.teamName]).join(' ');
  const roleContext = record.role?.trim() || '';
  const descriptor = (() => {
    if (kind === 'league') return record.sportName ? `${record.sportName} competition` : 'sports competition';
    if (kind === 'team') return record.sportName ? `${record.sportName} team` : 'sports team';
    if (kind === 'player') return roleContext || (record.sportName ? `${record.sportName} player` : 'athlete');
    if (kind === 'driver') return 'racing driver';
    if (kind === 'entrant') return 'motorsport team';
    if (kind === 'manufacturer') return 'motorsport manufacturer';
    if (kind === 'stadium') return 'sports stadium';
    return 'sports entity';
  })();

  const shortSentence = (() => {
    switch (kind) {
      case 'league':
        return `${record.name} is a ${location ? `${location} ` : ''}${descriptor}${record.sportName ? ` featuring ${record.sportName.toLowerCase()} fixtures, results, and standings` : ''}.`;
      case 'team':
        return `${record.name} is a ${location ? `${location} ` : ''}${descriptor}${record.leagueName ? ` competing in the ${record.leagueName}` : competitionContext ? ` active in ${competitionContext}` : ''}.`;
      case 'player':
        return `${record.name} is ${/^[aeiou]/i.test(descriptor) ? 'an' : 'a'} ${descriptor}${teamContext ? ` for ${teamContext}` : ''}${record.leagueName ? ` in the ${record.leagueName}` : competitionContext ? ` active in ${competitionContext}` : ''}${location ? ` from ${location}` : ''}.`;
      case 'driver':
        return `${record.name} is a ${descriptor}${competitionContext ? ` competing in ${competitionContext}` : ''}${location ? ` from ${location}` : ''}.`;
      case 'entrant':
        return `${record.name} is a ${descriptor}${competitionContext ? ` active in ${competitionContext}` : ''}.`;
      case 'manufacturer':
        return `${record.name} is a ${descriptor}${competitionContext ? ` associated with ${competitionContext}` : ''}.`;
      case 'stadium':
        return `${record.name} is a ${descriptor}${record.city ? ` in ${record.city}` : ''}${location ? `, ${location}` : ''}.`;
      default:
        return `${record.name} is a ${descriptor}.`;
    }
  })();

  const long = (() => {
    const scope = kind === 'league' ? 'competition' : 'entity';
    const supportingContext = uniqueStrings([
      competitionContext || null,
      teamContext || null,
      roleContext || null,
      location || null,
      record.shortName || null,
    ]).join(' | ');
    if (kind === 'league') {
      return `${shortSentence} MatchWatch tracks fixtures, results, standings, notable teams, and watchparty context for this ${scope}${supportingContext ? `, with catalog metadata seeded from ${supportingContext}` : ''}.`;
    }
    if (kind === 'team') {
      return `${shortSentence} MatchWatch tracks roster context, fixtures, results, standings, and venue information for this ${scope}${supportingContext ? `, with catalog metadata seeded from ${supportingContext}` : ''}.`;
    }
    if (kind === 'player') {
      return `${shortSentence} MatchWatch tracks appearances, upcoming matches, team context, and profile metadata for this ${scope}${supportingContext ? `, with catalog metadata seeded from ${supportingContext}` : ''}.`;
    }
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

function scoreImageUrl(kind: EntityKind, purpose: 'primary' | 'hero', url: string) {
  const normalized = url.toLowerCase();
  let score = 0;

  if (/^https?:\/\//i.test(url)) score += 10;
  if (normalized.includes('wikimedia') || normalized.includes('wikipedia')) score += purpose === 'primary' ? 18 : 4;
  if (normalized.includes('logo')) score += purpose === 'primary' ? 16 : -2;
  if (normalized.includes('headshot') || normalized.includes('portrait')) score += kind === 'player' || kind === 'driver' ? 16 : -2;
  if (normalized.includes('hero') || normalized.includes('team-photo') || normalized.includes('action')) score += purpose === 'hero' ? 12 : 2;
  if (normalized.includes('upload') || normalized.includes('thumb')) score -= 4;
  if (normalized.endsWith('.svg')) score += purpose === 'primary' ? 12 : -4;
  if (normalized.endsWith('.png')) score += purpose === 'primary' ? 6 : 2;
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg') || normalized.endsWith('.webp')) score += purpose === 'hero' ? 6 : 2;

  return score;
}

function rankImageUrls(kind: EntityKind, purpose: 'primary' | 'hero', urls: string[]) {
  return uniqueStrings(urls)
    .map((url) => ({ url, score: scoreImageUrl(kind, purpose, url) }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.url);
}

function buildQuery(kind: EntityKind, record: EntityBaseRecord) {
  return uniqueStrings([
    record.name,
    record.shortName,
    record.leagueName,
    record.teamName,
    record.role,
    record.sportName,
    record.city,
    record.country,
    record.nationality,
    kind === 'team'
      ? 'team'
      : kind === 'player'
        ? 'player'
        : kind === 'driver'
          ? 'driver'
          : kind === 'league'
            ? 'league'
            : kind === 'stadium'
              ? 'stadium arena'
              : 'motorsport team',
  ]).join(' ');
}

function buildPrimaryImageQuery(kind: EntityKind, record: EntityBaseRecord) {
  const base = uniqueStrings([
    record.name,
    record.shortName,
    record.leagueName,
    record.sportName,
    record.city,
    record.country,
    record.nationality,
  ]).join(' ');

  if (kind === 'player' || kind === 'driver') return `${base} headshot portrait`;
  if (kind === 'team' || kind === 'league' || kind === 'entrant' || kind === 'manufacturer') return `${base} logo`;
  if (kind === 'stadium') return `${base} exterior photo`;
  return `${base} image`;
}

function buildHeroImageQuery(kind: EntityKind, record: EntityBaseRecord) {
  const base = uniqueStrings([
    record.name,
    record.shortName,
    record.leagueName,
    record.sportName,
    record.city,
    record.country,
    record.nationality,
  ]).join(' ');

  if (kind === 'player' || kind === 'driver') return `${base} action photo`;
  if (kind === 'team' || kind === 'entrant' || kind === 'manufacturer') return `${base} team photo`;
  if (kind === 'league') return `${base} trophy competition`;
  if (kind === 'stadium') return `${base} interior aerial`;
  return `${base} hero image`;
}

export async function buildEntityEnrichment(kind: EntityKind, record: EntityBaseRecord): Promise<EntityEnrichmentResult> {
  const query = buildQuery(kind, record);
  const primaryImageQuery = buildPrimaryImageQuery(kind, record);
  const heroImageQuery = buildHeroImageQuery(kind, record);
  const provider = resolveProvider();
  let webResults: SearchItem[] = [];
  let primaryImageUrls: string[] = [];
  let heroImageUrls: string[] = [];

  if (provider === 'serpapi') {
    const [webResultSet, primaryImageResultSet, heroImageResultSet] = await Promise.all([
      fetchSerpApiSearch(query, 'web'),
      fetchSerpApiSearch(primaryImageQuery, 'image'),
      fetchSerpApiSearch(heroImageQuery, 'image'),
    ]);
    webResults = webResultSet.webResults;
    primaryImageUrls = primaryImageResultSet.imageUrls;
    heroImageUrls = heroImageResultSet.imageUrls;
  } else if (provider === 'google-legacy') {
    const [legacyWebResults, primaryImageResults, heroImageResults] = await Promise.all([
      fetchCustomSearchLegacy(query, 'web'),
      fetchCustomSearchLegacy(primaryImageQuery, 'image'),
      fetchCustomSearchLegacy(heroImageQuery, 'image'),
    ]);
    webResults = legacyWebResults;
    primaryImageUrls = extractImageUrls(primaryImageResults);
    heroImageUrls = extractImageUrls(heroImageResults);
  }

  primaryImageUrls = rankImageUrls(kind, 'primary', primaryImageUrls).slice(0, 6);
  heroImageUrls = rankImageUrls(kind, 'hero', heroImageUrls).slice(0, 6);
  const imageUrls = uniqueStrings([...primaryImageUrls, ...heroImageUrls]).slice(0, 6);

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
    : (primaryImageUrls[0] || imageUrls[0] || record.primaryImageUrl || null);
  const heroImageUrl = record.heroImageSource === 'MANUAL'
    ? undefined
    : (heroImageUrls[0] || primaryImageUrls[1] || primaryImageUrls[0] || imageUrls[0] || record.heroImageUrl || record.primaryImageUrl || null);
  const nextWebsite = record.websiteSource === 'MANUAL'
    ? undefined
    : (website || record.website || null);

  const aliases = uniqueStrings([
    record.shortName,
    webResults[0]?.title,
    webResults[1]?.title,
  ]).filter((value) => value.toLowerCase() !== record.name.toLowerCase()).slice(0, 5);

  const result = {
    snapshot: {
      query,
      primaryImageQuery,
      heroImageQuery,
      provider,
      fetchedAt: new Date().toISOString(),
      providerSeed: {
        name: record.name,
        shortName: record.shortName || null,
        sportName: record.sportName || null,
        leagueName: record.leagueName || null,
        teamName: record.teamName || null,
        role: record.role || null,
        country: record.country || record.nationality || null,
      },
      webResults: webResults.map((item) => ({ title: item.title || null, snippet: item.snippet || null, link: item.link || null })),
      imageUrls,
      primaryImageUrls,
      heroImageUrls,
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

  logger.info({
    entityKind: kind,
    entityId: record.id,
    provider,
    query,
    primaryImageQuery,
    heroImageQuery,
    primaryCandidateCount: primaryImageUrls.length,
    heroCandidateCount: heroImageUrls.length,
    selectedPrimaryImageUrl: result.updates.primaryImageUrl || null,
    selectedHeroImageUrl: result.updates.heroImageUrl || null,
    skippedManualFields: {
      shortDescription: record.shortDescriptionSource === 'MANUAL',
      description: record.descriptionSource === 'MANUAL',
      primaryImage: record.primaryImageSource === 'MANUAL',
      heroImage: record.heroImageSource === 'MANUAL',
      website: record.websiteSource === 'MANUAL',
    },
  }, 'Entity enrichment computed');

  return result;
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
