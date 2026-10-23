import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ScorePlayClient, ScorePlayError, type ScorePlayMedia } from './scoreplay';
import { TwelveLabsClient, isProviderId as validVideoId, type IndexedAsset as IndexedVideo } from './highlights/twelvelabs';

export type MediaMapping = { twelvelabsVideoId: string; assetId: string; matchedBy: 'metadata' | 'filename'; metadataKey?: string; duration: number; previewUrl?: string };
export type MappingReport = { indexId: string; indexName: string; indexCount: number; checkedAt: string; scoreplayCount: number; mappedCount: number; unmappedCount: number; mappings: Record<string, MediaMapping>; unmapped: { mediaId: string; filename: string; reason: string }[] };
type CachedIndex = { version: 2; indexId: string; indexName: string; count: number; metadataKey: string; checkedAt: number; entries: IndexedVideo[] };
const normalize = (name: string) => name.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/\.[a-z0-9]{2,5}$/, '').replace(/[^a-z0-9]+/g, '');
function metadataValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(metadataValues);
  return typeof value === 'string' || typeof value === 'number' && Number.isSafeInteger(value) ? [String(value)] : [];
}
function choose(entries: IndexedVideo[], duration?: number) {
  if (entries.length === 1) return entries[0];
  if (!duration || !Number.isFinite(duration)) return undefined;
  const ranked = entries.filter(e => Number.isFinite(e.system_metadata?.duration)).map(entry => ({ entry, difference: Math.abs(entry.system_metadata!.duration! - duration) })).sort((a, b) => a.difference - b.difference);
  return ranked.length && ranked[0].difference <= Math.max(2, duration * .02) && (!ranked[1] || ranked[1].difference - ranked[0].difference > .001) ? ranked[0].entry : undefined;
}
export function mapScorePlayVideos(videos: ScorePlayMedia[], entries: IndexedVideo[], metadataKey = '') {
  const ids = new Set(videos.map(v => String(v.ID))), mappings: Record<string, MediaMapping> = {}, unmapped: MappingReport['unmapped'] = [];
  const metadata = new Map<string, { entry: IndexedVideo; key: string }[]>();
  const claimed = new Map<string, string>();
  for (const entry of entries) {
    // Organizer custom IDs may be stored on the asset or its index entry.
    // Keep both sources so conflicting IDs cannot be silently overwritten.
    const pairs: [string, unknown][] = [
      ...(metadataKey ? [[metadataKey, entry.user_metadata?.[metadataKey]] as [string, unknown]] : Object.entries(entry.user_metadata || {})),
      ...(metadataKey ? [[`asset.user_metadata.${metadataKey}`, entry.asset_user_metadata?.[metadataKey]] as [string, unknown]] : Object.entries(entry.asset_user_metadata || {}).map(([key, value]): [string, unknown] => [`asset.user_metadata.${key}`, value])),
    ];
    const matching = pairs.flatMap(([key, value]) => metadataValues(value).filter(id => ids.has(id)).map(id => ({ key, id })));
    if (new Set(matching.map(m => m.id)).size > 1) { claimed.set(entry._id, 'ambiguous'); continue; }
    for (const { key, id } of matching.slice(0, 1)) { claimed.set(entry._id, id); metadata.set(id, [...metadata.get(id) || [], { entry, key }]); }
  }
  for (const video of videos) {
    const id = String(video.ID), byId = metadata.get(id) || [];
    const candidates = byId.length ? byId.map(x => x.entry) : entries.filter(entry => (!claimed.has(entry._id) || claimed.get(entry._id) === id) && entry.system_metadata?.filename && normalize(entry.system_metadata.filename) === normalize(video.name));
    const ready = candidates.filter(entry => entry.status === 'ready' && validVideoId(entry.asset_id || ''));
    const entry = choose(ready, video.duration);
    if (!entry) { unmapped.push({ mediaId: id, filename: video.name, reason: !candidates.length ? 'No metadata ID or normalized filename match.' : !ready.length ? 'The matching indexed video is not ready or has no reusable asset_id.' : 'Multiple matches have indistinguishable filenames/durations. An explicit metadata ID is required.' }); continue; }
    mappings[id] = { twelvelabsVideoId: entry._id, assetId: entry.asset_id!, matchedBy: byId.length ? 'metadata' : 'filename', ...(byId.length ? { metadataKey: byId.find(item => item.entry._id === entry._id)!.key } : {}), duration: entry.system_metadata?.duration || video.duration || 0, ...(entry.hls?.video_url ? { previewUrl: entry.hls.video_url } : {}) };
  }
  return { mappings, unmapped };
}
export class ScorePlayMappingService {
  private memory?: CachedIndex;
  private pending?: Promise<CachedIndex>;
  private report?: MappingReport;
  private exampleLogged = false;
  constructor(private labs: TwelveLabsClient, private scoreplay: ScorePlayClient, private indexId: string, private cacheRoot = process.env.HIGHLIGHTS_DATA_DIR || join(process.cwd(), '.data', 'highlight-pipeline'), private namespace = 'default') {}
  private cachePath() { return join(this.cacheRoot, `scoreplay-index-${createHash('sha256').update(`${this.namespace}|${this.indexId}`).digest('hex').slice(0, 24)}.json`); }
  private async index(force = false): Promise<CachedIndex> {
    if (this.pending) return this.pending;
    const metadataKey = process.env.TWELVELABS_SCOREPLAY_ID_KEY || '';
    // Check provider count at least once per minute. Refresh bypasses this cache.
    if (!force && this.memory && this.memory.metadataKey === metadataKey && Date.now() - this.memory.checkedAt < 60000) return this.memory;
    this.pending = (async () => {
      const info = await this.labs.indexInfo();
      let old = this.memory;
      if (!old && !force) { try { const saved = JSON.parse(await readFile(this.cachePath(), 'utf8')); if (saved.version === 2 && saved.indexId === this.indexId && Array.isArray(saved.entries)) old = saved; } catch { /* Rebuild missing/corrupt cache from the providers. */ } }
      if (!force && old && Number.isFinite(info.video_count) && old.count === info.video_count && old.metadataKey === metadataKey) { old.checkedAt = Date.now(); return this.memory = old; }
      const list = await this.labs.listIndexedAssets(), entries: IndexedVideo[] = new Array(list.length); let next = 0;
      const assets = new Map<string, ReturnType<TwelveLabsClient['asset']>>();
      await Promise.all(Array.from({ length: Math.min(6, list.length) }, async () => {
        while (next < list.length) {
          const position = next++, summary = list[position], detail = await this.labs.indexedAsset(summary._id);
          const assetId = detail.asset_id || summary.asset_id;
          if (assetId && validVideoId(assetId) && !assets.has(assetId)) assets.set(assetId, this.labs.asset(assetId));
          const asset = assetId ? await assets.get(assetId) : undefined;
          entries[position] = { ...summary, ...detail, _id: summary._id, asset_user_metadata: asset?.user_metadata };
        }
      }));
      const cache: CachedIndex = { version: 2, indexId: this.indexId, indexName: info.index_name, count: info.video_count ?? entries.length, metadataKey, checkedAt: Date.now(), entries };
      await mkdir(this.cacheRoot, { recursive: true, mode: 0o700 }); const path = this.cachePath(), temp = `${path}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(cache), { mode: 0o600 }); await rename(temp, path);
      this.report = undefined;
      return this.memory = cache;
    })();
    try { return await this.pending; } finally { this.pending = undefined; }
  }
  async diagnostics(force = false): Promise<MappingReport> {
    const index = await this.index(force), videos = await this.scoreplay.allVideos();
    const { mappings, unmapped } = mapScorePlayVideos(videos, index.entries, index.metadataKey);
    if (!this.exampleLogged) {
      const example = Object.entries(mappings).find(([, mapping]) => mapping.matchedBy === 'metadata');
      if (example) { console.info(JSON.stringify({ component: 'scoreplay-mapping', index_id: this.indexId, metadata_key: example[1].metadataKey, scoreplay_media_id: example[0], twelvelabs_video_id: example[1].twelvelabsVideoId })); this.exampleLogged = true; }
    }
    const report = { indexId: this.indexId, indexName: index.indexName, indexCount: index.count, checkedAt: new Date().toISOString(), scoreplayCount: videos.length, mappedCount: Object.keys(mappings).length, unmappedCount: unmapped.length, mappings, unmapped };
    const path = this.cachePath().replace(/\.json$/, '-mapping.json'), temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(report), { mode: 0o600 }); await rename(temp, path);
    return this.report = report;
  }
  async resolve(video: ScorePlayMedia): Promise<MediaMapping> {
    const index = await this.index();
    const report = this.report && this.report.indexCount === index.count && Date.now() - Date.parse(this.report.checkedAt) < 60000 ? this.report : await this.diagnostics();
    const mapping = report.mappings[String(video.ID)];
    if (!mapping) {
      const reason = report.unmapped.find(item => item.mediaId === String(video.ID))?.reason || 'No indexed match.';
      throw new ScorePlayError(`"${video.name}" has no match in the connected TwelveLabs index "${index.indexName}" (${index.count} videos). ${reason} Connect the organizers' shared hackathon index with an authorized team key, then choose "Refresh AI mapping".`, 409);
    }
    return mapping;
  }
}
let singleton: { signature: string; service: ScorePlayMappingService } | undefined;
export function scorePlayMapping() {
  const key = process.env.TWELVELABS_API_KEY, index = process.env.TWELVELABS_INDEX_ID, scoreKey = process.env.SCOREPLAY_API_KEY;
  if (!key || !validVideoId(index || '') || !scoreKey) throw new ScorePlayError('Configure the team TwelveLabs key, shared index ID and ScorePlay key on the server.', 503);
  const signature = createHash('sha256').update(`${key}|${index}|${scoreKey}`).digest('hex');
  if (singleton?.signature !== signature) singleton = { signature, service: new ScorePlayMappingService(new TwelveLabsClient(key, index!), new ScorePlayClient(scoreKey), index!, undefined, signature) };
  return singleton.service;
}
