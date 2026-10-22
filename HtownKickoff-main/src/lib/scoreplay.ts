import { filterId, scorePlayDateRange, type ScorePlayFilters } from './scoreplay-filters';
export class ScorePlayError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export const scorePlayLimit = 200 * 1024 * 1024;
export function requireScorePlayExternalProcessing() {
  if (process.env.SCOREPLAY_ALLOW_EXTERNAL_PROCESSING !== 'true') throw new ScorePlayError('Hackathon content must stay on ScorePlay. Connect the organizer-provided TwelveLabs mapping before processing; external import and export are disabled.', 403);
}
export function scorePlayAllowed(owner: string) {
  return process.env.NODE_ENV === 'development' && owner === 'local' ||
    (process.env.SCOREPLAY_ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean).includes(owner);
}
type Media = { ID: number; name: string; type: string; duration?: number; date?: number; event?: { name?: string } };
type Collection = { ID: number; name: string; date?: number; parent_id?: number };
type Format = { id: string; file_name: string; size: number; mime_type: string; file_url?: string; is_scoreplay: boolean; status?: string };
export function scorePlayDownloadUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  // Only provider-managed storage, never arbitrary/local storage or redirects.
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
    !['.scoreplay.io', '.amazonaws.com', '.cloudfront.net'].some(suffix => host.endsWith(suffix))) {
    throw new ScorePlayError('This file uses unsupported storage. Download it from ScorePlay and choose the local file instead.', 400);
  }
  return url.href;
}
export function selectScorePlayFormat(data: { items?: Record<string, Format[]> }, limit = scorePlayLimit) {
  const formats = Object.values(data.items || {}).flat().filter(f => f && f.is_scoreplay === true &&
    f.size > 0 && f.size <= limit && f.mime_type === 'video/mp4' && f.file_url && (!f.status || ['ready', 'active'].includes(f.status)));
  // Keep the best available MP4 within the existing prototype upload limit.
  formats.sort((a, b) => b.size - a.size);
  if (!formats.length) throw new ScorePlayError(`No ready downloadable MP4 under ${Math.round(limit / 1048576)} MB. Choose another ScorePlay video or create a smaller MP4 version.`, 400);
  return { ...formats[0], file_url: scorePlayDownloadUrl(formats[0].file_url!) };
}
export class ScorePlayClient {
  constructor(private key: string, private transport: typeof fetch = fetch) {}
  private async request(path: string, init: RequestInit = {}) {
    let response: Response;
    try { response = await this.transport(`https://media.scoreplay.io/v1${path}`, { ...init, headers: { 'X-ScorePlay-Api-Key': this.key, 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) }); }
    catch { throw new ScorePlayError('ScorePlay is temporarily unreachable. Try again shortly.'); }
    if (!response.ok) throw new ScorePlayError(response.status === 401 || response.status === 403 ? 'ScorePlay rejected access. Check the server key and its media download permissions.' : response.status === 404 ? 'This ScorePlay video is unavailable to the configured account.' : 'ScorePlay could not complete the request.', response.status === 429 ? 429 : 502);
    return response.json();
  }
  private async collections(parentId = 0, seasonId?: number) {
    const items: Collection[] = [];
    for (let page = 1; page <= 3; page++) {
      const data = await this.request('/event/search', { method: 'POST', body: JSON.stringify({ parent_id: parentId, page, per_page: 100, skip_preload: true, ...(seasonId ? { season_id: seasonId } : {}) }) });
      if (!Array.isArray(data)) throw new ScorePlayError('ScorePlay returned an unexpected collection list.');
      items.push(...(data as Collection[]).filter(x => Number.isSafeInteger(x.ID) && x.ID > 0 && typeof x.name === 'string'));
      if (items.length > 200) throw new ScorePlayError('This library has many collections. Search by a more specific filename.', 400);
      if (data.length < 100) return items;
    }
    throw new ScorePlayError('This library has many collections. Search by a more specific filename.', 400);
  }
  private async descendants(parentId: number) {
    const found: Collection[] = [], visited = new Set([parentId]);
    let parents = [parentId];
    for (let depth = 0; depth < 5 && parents.length; depth++) {
      const next: number[] = [];
      for (const parent of parents) for (const child of await this.collections(parent)) {
        if (visited.has(child.ID)) continue;
        visited.add(child.ID); found.push(child); next.push(child.ID);
        if (found.length > 200) throw new ScorePlayError('This league has many collections. Narrow the selection to one match.', 400);
      }
      parents = next;
    }
    if (parents.length) throw new ScorePlayError('This collection hierarchy is too deep. Choose a more specific match.', 400);
    return found;
  }
  async filterOptions(league?: string) {
    const leagueId = filterId(league);
    const [leagues, seasonResult, matches] = await Promise.all([
      this.collections(),
      this.request('/seasons?page=1&limit=100').then(d => ({ items: d.items, warning: '' })).catch(() => ({ items: [], warning: 'Season options are unavailable. You can still filter by media year or date.' })),
      leagueId ? this.descendants(leagueId) : Promise.resolve([]),
    ]);
    const option = (x: Collection) => ({ id: String(x.ID), name: x.name });
    return { leagues: leagues.map(option), matches: matches.map(option),
      seasons: Array.isArray(seasonResult.items) ? seasonResult.items.filter((x: { id: number; name: string }) => Number.isSafeInteger(x.id) && typeof x.name === 'string').map((x: { id: number; name: string }) => ({ id: String(x.id), name: x.name })) : [],
      warning: seasonResult.warning };
  }
  async search(query: string, filters: ScorePlayFilters = {}, page = 1) {
    return (await this.searchPage(query, filters, page)).media;
  }
  async searchPage(query: string, filters: ScorePlayFilters = {}, page = 1) {
    if (query.length > 120) throw new ScorePlayError('Use a search of 120 characters or fewer.', 400);
    if (!Number.isInteger(page) || page < 1 || page > 100) throw new ScorePlayError('Choose a valid results page.', 400);
    const leagueId = filterId(filters.leagueId), matchId = filterId(filters.matchId), seasonId = filterId(filters.seasonId);
    const dates = scorePlayDateRange(filters);
    if (filters.order && !['oldest', 'newest'].includes(filters.order)) throw new ScorePlayError('Choose a valid sort order.', 400);
    let eventIds: number[] | undefined;
    let seasonTags: number[] = [];
    if (leagueId) eventIds = [leagueId, ...(await this.descendants(leagueId)).map(x => x.ID)];
    if (matchId) {
      if (eventIds && !eventIds.includes(matchId)) throw new ScorePlayError('This match is outside the selected league. Choose the match again.', 400);
      eventIds = [matchId, ...(await this.descendants(matchId)).map(x => x.ID)];
    }
    if (seasonId) {
      const season = await this.request(`/seasons/${seasonId}`);
      if (typeof season.name !== 'string' || season.name.length > 60) throw new ScorePlayError('This season is unavailable. Choose it again.', 400);
      const lookup = await this.request(`/tag/search?query=${encodeURIComponent(season.name)}`);
      const name = season.name.trim().toLowerCase();
      seasonTags = (lookup.tags || []).filter((tag: { ID: number; type: string; name: string; label?: string }) => tag.type === 'season' && Number.isSafeInteger(tag.ID) && (tag.name?.trim().toLowerCase() === name || tag.label?.trim().toLowerCase() === name)).map((tag: { ID: number }) => tag.ID);
      if (!seasonTags.length) {
      const data = await this.request('/event/search', { method: 'POST', body: JSON.stringify({ season_id: seasonId, page: 1, per_page: 200, skip_preload: true }) });
      if (!Array.isArray(data)) throw new ScorePlayError('ScorePlay returned an unexpected season collection list.');
      const seasonEvents = data.map((x: Collection) => x.ID).filter(Number.isSafeInteger);
      eventIds = eventIds ? eventIds.filter(id => seasonEvents.includes(id)) : seasonEvents;
      }
    }
    if (eventIds && !eventIds.length) return { media: [], page, totalPages: 0, count: 0 };
    const body = { media_type: 'video', ...(query.trim() ? { name: query.trim() } : {}), ...(eventIds ? { event_ids: eventIds } : {}), ...(seasonTags.length ? { any_tag_options: seasonTags } : {}), ...dates,
      ...(filters.order ? { order_by: 'upload_date', order_type: filters.order === 'oldest' ? 'asc' : 'desc' } : {}) };
    const data = await this.request(`/media/search?page=${page}&per_page=12`, { method: 'POST', body: JSON.stringify(body) });
    if (!Array.isArray(data.media)) throw new ScorePlayError('ScorePlay returned an unexpected media list.');
    const media = data.media.filter((m: Media) => Number.isSafeInteger(m.ID) && m.ID > 0 && m.type === 'video' && typeof m.name === 'string').map((m: Media) => ({ id: String(m.ID), name: m.name, duration: m.duration, ...(Number.isFinite(m.date) && m.date! > 0 ? { date: m.date } : {}), ...(m.event?.name ? { match: m.event.name } : {}) }));
    return { media, page, totalPages: typeof data.total_pages === 'number' ? data.total_pages : page, count: typeof data.count === 'number' ? data.count : media.length };
  }
  async source(id: string) {
    if (!/^[1-9][0-9]{0,15}$/.test(id)) throw new ScorePlayError('Choose a valid ScorePlay media ID.', 400);
    const media = await this.request(`/media/${id}`);
    if (media.type !== 'video') throw new ScorePlayError('Choose a video from ScorePlay.', 400);
    if (Number(media.duration) > 14400) throw new ScorePlayError('Choose a recording up to four hours long.', 400);
    const format = selectScorePlayFormat(await this.request(`/media/${id}/formats/download?hide_non_favorites=true`), 4 * 1024 ** 3);
    return { url: format.file_url, name: media.name as string, duration: Number(media.duration) || 0, bytes: format.size };
  }
  async download(id: string, signal: AbortSignal) {
    if (!/^[1-9][0-9]{0,15}$/.test(id)) throw new ScorePlayError('Choose a valid ScorePlay media ID.', 400);
    const media = await this.request(`/media/${id}`);
    if (media.type !== 'video') throw new ScorePlayError('Choose a video from ScorePlay.', 400);
    const format = selectScorePlayFormat(await this.request(`/media/${id}/formats/download?hide_non_favorites=true`));
    let response: Response;
    try { response = await this.transport(format.file_url, { headers: { Range: `bytes=0-${format.size - 1}` }, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]), cache: 'no-store' }); }
    catch { throw new ScorePlayError('Could not download this ScorePlay file. Retry or choose a local MP4.'); }
    if (!response.ok || !response.body) throw new ScorePlayError('The ScorePlay download is unavailable. Try another video.');
    if (Number(response.headers.get('content-length')) > scorePlayLimit) { await response.body.cancel(); throw new ScorePlayError('Choose a video smaller than 200 MB.', 413); }
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > scorePlayLimit) { await reader.cancel(); throw new ScorePlayError('Choose a video smaller than 200 MB.', 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (size !== format.size) throw new ScorePlayError('The ScorePlay video download was incomplete. Retry this video.');
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { bytes, name: format.file_name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 150) || `scoreplay-${id}.mp4` };
  }
}
