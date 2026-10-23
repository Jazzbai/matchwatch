import type { IndexedAsset, TwelveLabsClient } from './twelvelabs';

// Diagram step 1: ScorePlay media assets that are already analyzed by TwelveLabs.
// The organizer's index stores each video's ScorePlay IDs in its metadata.

export type LibraryVideo = {
  indexedAssetId: string;
  assetId: string;
  name: string;
  duration: number;
  thumbnail: string | null;
  playbackUrl: string | null;
  scoreplay: { mediaId: string; eventId?: string } | null;
  orientation: 'landscape' | 'portrait';
};

const CACHE_MS = 60_000;
let cache: { indexId: string; at: number; videos: LibraryVideo[] } | null = null;

export async function listLibrary(labs: TwelveLabsClient, refresh = false): Promise<LibraryVideo[]> {
  if (!refresh && cache?.indexId === labs.indexId && Date.now() - cache.at < CACHE_MS) return cache.videos;
  const summaries = await labs.listIndexedAssets(), full: IndexedAsset[] = new Array(summaries.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, summaries.length) }, async () => {
    while (next < summaries.length) {
      const position = next++, item = await labs.indexedAsset(summaries[position]._id);
      const asset = item.asset_id ? await labs.asset(item.asset_id) : null;
      full[position] = { ...item, asset_user_metadata: asset?.user_metadata };
    }
  }));
  const videos = full.map(toLibraryVideo)
    .filter((video): video is LibraryVideo => !!video)
    .sort((a, b) => b.duration - a.duration);
  cache = { indexId: labs.indexId, at: Date.now(), videos };
  return videos;
}

export function toLibraryVideo(item: IndexedAsset): LibraryVideo | null {
  const duration = item.system_metadata?.duration;
  if (item.status !== 'ready' || !item.asset_id || !duration) return null;
  const metadata = { ...item.asset_user_metadata, ...item.user_metadata };
  const mediaId = metadata.scoreplay_id ?? metadata.scoreplay_media_id;
  const { width = 16, height = 9 } = item.system_metadata || {};
  return {
    indexedAssetId: item._id,
    assetId: item.asset_id,
    name: (item.system_metadata?.filename || 'Untitled video').replace(/\.(mp4|mov|m4v)$/i, ''),
    duration,
    thumbnail: item.hls?.thumbnail_urls?.[0] ?? null,
    playbackUrl: item.hls?.video_url ?? null,
    scoreplay: mediaId ? { mediaId: String(mediaId), ...(metadata.scoreplay_event_id ? { eventId: String(metadata.scoreplay_event_id) } : {}) } : null,
    orientation: height > width ? 'portrait' : 'landscape',
  };
}
