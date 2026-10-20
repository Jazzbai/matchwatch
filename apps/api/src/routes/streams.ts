import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { broadcasts, streamVideos, streamFavorites } from '../db/stream-schema';
import { authMiddleware } from '../middleware';
import { apiResponse, apiError } from '../lib/utils';
import { newStreamKey, streamKeyHash, secureEqual, playbackTicket, youtubeId } from '../lib/stream-security';
import { videoStorageReady, videoUpload, verifyVideoUpload, videoPlayback, removeVideo, archiveVideo } from '../lib/stream-storage';

const routes = new Hono();
const uuid = z.string().uuid();
const title = z.string().trim().min(1).max(180);
const sport = z.enum(['Soccer', 'Basketball', 'Baseball', 'Football', 'Other']);
const fields = { id: broadcasts.id, title: broadcasts.title, sport: broadcasts.sport, description: broadcasts.description, ended: broadcasts.ended, createdAt: broadcasts.createdAt };
const configured = () => Boolean(process.env.MEDIAMTX_RTMP_URL && process.env.MEDIAMTX_HLS_URL && process.env.MEDIAMTX_API_URL && process.env.MEDIAMTX_SERVICE_PASSWORD);
const mediaPath = (id: string) => `broadcasts/${id}`;
function mediaAuth() { return { Authorization: `Basic ${Buffer.from(`matchwatch-server:${process.env.MEDIAMTX_SERVICE_PASSWORD || ''}`).toString('base64')}` }; }
async function mediaFetch(url: string, method = 'GET', timeout = 10000) {
  return fetch(url, { method, headers: mediaAuth(), signal: AbortSignal.timeout(timeout) });
}
async function pathStatus(id: string) {
  const response = await mediaFetch(`${process.env.MEDIAMTX_API_URL}/v3/paths/get/${mediaPath(id)}`);
  if (response.status === 404) return { ready: false, source: null };
  if (!response.ok) throw new Error('MEDIA_UNAVAILABLE');
  return response.json() as Promise<{ ready: boolean; source: { type: string; id: string } | null }>;
}
function playerUrl(id: string) { return `${process.env.MEDIAMTX_HLS_URL?.replace(/\/$/, '')}/${mediaPath(id)}`; }

// Called by MediaMTX. This only validates credentials; it never changes stream state.
routes.post('/media-auth', async c => {
  const parsed = z.object({ action: z.string(), path: z.string().default(''), user: z.string().default(''), password: z.string().max(256).default('') }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.body(null, 401);
  const input = parsed.data;
  const servicePassword = process.env.MEDIAMTX_SERVICE_PASSWORD;
  if (servicePassword && input.user === 'matchwatch-server' && secureEqual(input.password, servicePassword) && ['api', 'read', 'playback'].includes(input.action)) return c.body(null, 204);
  const id = /^broadcasts\/([a-f0-9-]{36})$/.exec(input.path)?.[1];
  if (!id || !uuid.safeParse(id).success || !['publish', 'read'].includes(input.action)) return c.body(null, 401);
  const [broadcast] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
  if (!broadcast || broadcast.ended) return c.body(null, 401);
  if (input.action === 'read') return c.body(null, 204);
  return c.body(null, input.user === id && secureEqual(streamKeyHash(input.password), broadcast.keyHash) ? 204 : 401);
});

routes.get('/watch/:id', async c => {
  if (!uuid.safeParse(c.req.param('id')).success) return c.json(apiError('NOT_FOUND', 'Broadcast not found'), 404);
  const [item] = await db.select(fields).from(broadcasts).where(eq(broadcasts.id, c.req.param('id'))).limit(1);
  if (!item) return c.json(apiError('NOT_FOUND', 'Broadcast not found'), 404);
  if (!configured()) return c.json(apiResponse({ ...item, live: false, playerUrl: null, unavailable: true }));
  try { const status = item.ended ? { ready: false } : await pathStatus(item.id); return c.json(apiResponse({ ...item, live: status.ready, playerUrl: status.ready ? playerUrl(item.id) : null })); }
  catch { return c.json(apiResponse({ ...item, live: false, playerUrl: null, unavailable: true })); }
});

// Short-lived owner-generated links allow native video playback without exposing service credentials.
routes.get('/recording-playback', async c => {
  const parsed = z.object({ id: uuid, start: z.string().datetime({ offset: true }), duration: z.coerce.number().positive().max(86400), expires: z.coerce.number().int(), ticket: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(c.req.query());
  const secret = process.env.MEDIAMTX_SERVICE_PASSWORD;
  if (!parsed.success || !secret || !process.env.MEDIAMTX_PLAYBACK_URL) return c.body(null, 403);
  const p = parsed.data; const payload = `${p.id}|${p.start}|${p.duration}|${p.expires}`;
  if (p.expires < Date.now() || p.expires > Date.now() + 3600000 || !secureEqual(p.ticket, playbackTicket(payload, secret))) return c.body(null, 403);
  const query = new URLSearchParams({ path: mediaPath(p.id), start: p.start, duration: String(p.duration), format: 'mp4' });
  const response = await mediaFetch(`${process.env.MEDIAMTX_PLAYBACK_URL}/get?${query}`, 'GET', 600000);
  if (!response.ok || !response.body) return c.json(apiError('NOT_FOUND', 'Recording is no longer available'), 404);
  c.header('Content-Type', 'video/mp4'); c.header('Cache-Control', 'private, no-store');
  return c.body(response.body);
});

routes.use('*', authMiddleware);
routes.get('/mine', async c => {
  c.header('Cache-Control', 'private, no-store');
  const owner = c.get('user').id;
  const [items, videos, favorites] = await Promise.all([
    db.select(fields).from(broadcasts).where(eq(broadcasts.ownerId, owner)).orderBy(desc(broadcasts.createdAt)),
    db.select({ id: streamVideos.id, title: streamVideos.title, sport: streamVideos.sport, fileSize: streamVideos.fileSize, createdAt: streamVideos.createdAt }).from(streamVideos).where(and(eq(streamVideos.ownerId, owner), eq(streamVideos.ready, true))).orderBy(desc(streamVideos.createdAt)),
    db.select({ id: streamFavorites.id, videoId: streamFavorites.videoId, title: streamFavorites.title, sport: streamFavorites.sport }).from(streamFavorites).where(eq(streamFavorites.ownerId, owner)).orderBy(desc(streamFavorites.createdAt)),
  ]);
  let livePaths: Set<string> | null = null;
  if (configured() && items.some(b => !b.ended)) {
    try {
      const r = await mediaFetch(`${process.env.MEDIAMTX_API_URL}/v3/paths/list?itemsPerPage=1000`);
      if (r.ok) { const data = await r.json() as { items: { name: string; ready: boolean }[] }; livePaths = new Set(data.items.filter(p => p.ready).map(p => p.name)); }
    } catch { /* Unknown status must not be displayed as live. */ }
  }
  return c.json(apiResponse({ broadcasts: items.map(b => ({ ...b, live: b.ended ? false : livePaths ? livePaths.has(mediaPath(b.id)) : null })), videos, favorites, liveConfigured: configured(), storageConfigured: videoStorageReady(), recordingsConfigured: Boolean(process.env.MEDIAMTX_PLAYBACK_URL && process.env.MEDIAMTX_SERVICE_PASSWORD) }));
});
routes.post('/broadcasts', async c => {
  if (!configured()) return c.json(apiError('NOT_CONFIGURED', 'Live streaming is awaiting server configuration'), 503);
  const parsed = z.object({ title, sport, description: z.string().trim().max(2000).default(''), rightsConfirmed: z.literal(true) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Enter a title, sport, and confirm permission to broadcast'), 400);
  const key = newStreamKey();
  const [item] = await db.insert(broadcasts).values({ ownerId: c.get('user').id, title: parsed.data.title, sport: parsed.data.sport, description: parsed.data.description, keyHash: streamKeyHash(key) }).returning(fields);
  const url = `${process.env.MEDIAMTX_RTMP_URL?.replace(/\/$/, '')}/${mediaPath(item.id)}?user=${item.id}&pass=${key}`;
  c.header('Cache-Control', 'no-store');
  return c.json(apiResponse({ ...item, publishUrl: url }), 201);
});
routes.post('/broadcasts/:id/credentials', async c => {
  const id = c.req.param('id'); if (!uuid.safeParse(id).success) return c.json(apiError('NOT_FOUND', 'Broadcast not found'), 404);
  if (!configured()) return c.json(apiError('NOT_CONFIGURED', 'Live streaming is awaiting server configuration'), 503);
  const key = newStreamKey();
  const [item] = await db.update(broadcasts).set({ keyHash: streamKeyHash(key) }).where(and(eq(broadcasts.id, id), eq(broadcasts.ownerId, c.get('user').id), eq(broadcasts.ended, false))).returning(fields);
  if (!item) return c.json(apiError('NOT_FOUND', 'Active broadcast not found'), 404);
  c.header('Cache-Control', 'no-store');
  return c.json(apiResponse({ publishUrl: `${process.env.MEDIAMTX_RTMP_URL?.replace(/\/$/, '')}/${mediaPath(id)}?user=${id}&pass=${key}` }));
});
routes.post('/broadcasts/:id/end', async c => {
  const id = c.req.param('id'); if (!uuid.safeParse(id).success) return c.json(apiError('NOT_FOUND', 'Broadcast not found'), 404);
  const own = and(eq(broadcasts.id, id), eq(broadcasts.ownerId, c.get('user').id));
  const [item] = await db.select().from(broadcasts).where(own).limit(1);
  if (!item) return c.json(apiError('NOT_FOUND', 'Broadcast not found'), 404);
  // Revoke new publishers first. Repeated end requests can retry kicking an existing connection.
  await db.update(broadcasts).set({ ended: true }).where(own);
  try {
    const status = await pathStatus(id);
    if (status.source) {
      if (status.source.type !== 'rtmpConn') throw new Error('UNEXPECTED_PROTOCOL');
      const r = await mediaFetch(`${process.env.MEDIAMTX_API_URL}/v3/rtmpconns/kick/${encodeURIComponent(status.source.id)}`, 'POST');
      if (!r.ok && r.status !== 404) throw new Error('KICK_FAILED');
    }
  } catch { return c.json(apiError('MEDIA_UNAVAILABLE', 'Publishing access revoked. Could not confirm disconnection; stop the camera and retry.'), 503); }
  return c.json(apiResponse({ ended: true }));
});
routes.get('/broadcasts/:id/recordings', async c => {
  const id = c.req.param('id'); if (!uuid.safeParse(id).success) return c.json(apiError('NOT_FOUND', 'Broadcast not found'), 404);
  const [item] = await db.select().from(broadcasts).where(and(eq(broadcasts.id, id), eq(broadcasts.ownerId, c.get('user').id))).limit(1);
  if (!item) return c.json(apiError('NOT_FOUND', 'Broadcast not found'), 404);
  const secret = process.env.MEDIAMTX_SERVICE_PASSWORD;
  if (!process.env.MEDIAMTX_PLAYBACK_URL || !secret) return c.json(apiError('NOT_CONFIGURED', 'Recording playback is awaiting server configuration'), 503);
  try {
    const r = await mediaFetch(`${process.env.MEDIAMTX_PLAYBACK_URL}/list?${new URLSearchParams({ path: mediaPath(id) })}`);
    if (r.status === 404) return c.json(apiResponse([]));
    if (!r.ok) throw new Error('RECORDINGS_UNAVAILABLE');
    const data = z.array(z.object({ start: z.string().datetime({ offset: true }), duration: z.number().positive().max(86400) })).parse(await r.json());
    const expires = Date.now() + 1800000;
    c.header('Cache-Control', 'private, no-store');
    return c.json(apiResponse(data.map(p => ({ ...p, url: `/api/v1/streams/recording-playback?${new URLSearchParams({ id, start: p.start, duration: String(p.duration), expires: String(expires), ticket: playbackTicket(`${id}|${p.start}|${p.duration}|${expires}`, secret) })}` }))));
  } catch { return c.json(apiError('MEDIA_UNAVAILABLE', 'Recording library could not be reached'), 503); }
});
routes.post('/videos/upload', async c => {
  if (!videoStorageReady()) return c.json(apiError('NOT_CONFIGURED', 'Video storage is awaiting configuration'), 503);
  const parsed = z.object({ title, sport, contentType: z.enum(['video/mp4', 'video/webm', 'video/quicktime']), fileSize: z.number().int().positive().max(2 * 1024 ** 3) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Choose an MP4, WebM, or MOV video up to 2 GB'), 400);
  const owner = c.get('user').id; const key = `recordings/${owner}/${newStreamKey()}`;
  const uploadUrl = await videoUpload(key, parsed.data.contentType, owner, parsed.data.fileSize);
  const [item] = await db.insert(streamVideos).values({ ...parsed.data, ownerId: owner, objectKey: key }).returning({ id: streamVideos.id });
  return c.json(apiResponse({ id: item.id, uploadUrl, headers: { 'Content-Type': parsed.data.contentType, 'x-amz-meta-owner': owner } }));
});
routes.post('/broadcasts/:id/archive', async c => {
  const id = c.req.param('id'); if (!uuid.safeParse(id).success) return c.json(apiError('NOT_FOUND', 'Broadcast not found'), 404);
  const [item] = await db.select().from(broadcasts).where(and(eq(broadcasts.id, id), eq(broadcasts.ownerId, c.get('user').id))).limit(1);
  if (!item) return c.json(apiError('NOT_FOUND', 'Broadcast not found'), 404);
  if (!videoStorageReady() || !process.env.MEDIAMTX_PLAYBACK_URL) return c.json(apiError('NOT_CONFIGURED', 'Recording archive storage is awaiting configuration'), 503);
  const parsed = z.object({ start: z.string().datetime({ offset: true }), duration: z.number().positive().max(3600) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(apiError('VALIDATION_ERROR', 'Choose a recording segment up to one hour'), 400);
  const query = new URLSearchParams({ path: mediaPath(id), start: parsed.data.start, duration: String(parsed.data.duration), format: 'mp4' });
  const key = `recordings/${item.ownerId}/${newStreamKey()}`;
  try {
    const source = await mediaFetch(`${process.env.MEDIAMTX_PLAYBACK_URL}/get?${query}`, 'GET', 600000);
    if (!source.ok || !source.body) return c.json(apiError('NOT_FOUND', 'Recording segment is no longer available'), 404);
    const bytes = await archiveVideo(key, source.body, item.ownerId);
    try { await db.insert(streamVideos).values({ ownerId: item.ownerId, title: `${item.title} · ${parsed.data.start}`, sport: item.sport, objectKey: key, contentType: 'video/mp4', fileSize: bytes, ready: true }); }
    catch (error) { await removeVideo(key).catch(() => {}); throw error; }
    return c.json(apiResponse({ saved: true }));
  } catch { return c.json(apiError('ARCHIVE_FAILED', 'Could not save the segment. Maximum archive size is 2 GB; retry with a shorter segment.'), 503); }
});
routes.post('/videos/:id/complete', async c => {
  const id = c.req.param('id'); if (!uuid.safeParse(id).success) return c.json(apiError('NOT_FOUND', 'Video not found'), 404);
  const own = and(eq(streamVideos.id, id), eq(streamVideos.ownerId, c.get('user').id));
  const [item] = await db.select().from(streamVideos).where(own).limit(1);
  if (!item) return c.json(apiError('NOT_FOUND', 'Video not found'), 404);
  try { if (!await verifyVideoUpload(item.objectKey, item.contentType, item.fileSize, item.ownerId)) throw new Error('INVALID_UPLOAD'); }
  catch { return c.json(apiError('INVALID_UPLOAD', 'Upload is missing or does not match the selected file'), 400); }
  await db.update(streamVideos).set({ ready: true }).where(own);
  return c.json(apiResponse({ ready: true }));
});
routes.get('/videos/:id/play', async c => {
  const id = c.req.param('id'); if (!uuid.safeParse(id).success) return c.json(apiError('NOT_FOUND', 'Video not found'), 404);
  const [item] = await db.select().from(streamVideos).where(and(eq(streamVideos.id, id), eq(streamVideos.ownerId, c.get('user').id), eq(streamVideos.ready, true))).limit(1);
  if (!item) return c.json(apiError('NOT_FOUND', 'Video not found'), 404);
  c.header('Cache-Control', 'private, no-store'); return c.json(apiResponse({ url: await videoPlayback(item.objectKey) }));
});
routes.delete('/videos/:id', async c => {
  const id = c.req.param('id'); if (!uuid.safeParse(id).success) return c.json(apiError('NOT_FOUND', 'Video not found'), 404);
  const own = and(eq(streamVideos.id, id), eq(streamVideos.ownerId, c.get('user').id));
  const [item] = await db.select().from(streamVideos).where(own).limit(1);
  if (!item) return c.json(apiError('NOT_FOUND', 'Video not found'), 404);
  await removeVideo(item.objectKey); await db.delete(streamVideos).where(own);
  return c.json(apiResponse({ deleted: true }));
});
routes.post('/favorites', async c => {
  const parsed = z.object({ videoId: z.string().max(2048), title, sport }).safeParse(await c.req.json().catch(() => null));
  const id = parsed.success ? youtubeId(parsed.data.videoId) : null;
  if (!parsed.success || !id) return c.json(apiError('VALIDATION_ERROR', 'Enter a valid YouTube link and title'), 400);
  await db.insert(streamFavorites).values({ ownerId: c.get('user').id, videoId: id, title: parsed.data.title, sport: parsed.data.sport }).onConflictDoNothing();
  return c.json(apiResponse({ saved: true }));
});
routes.delete('/favorites/:id', async c => {
  const id = c.req.param('id'); if (!uuid.safeParse(id).success) return c.json(apiError('NOT_FOUND', 'Favorite not found'), 404);
  const removed = await db.delete(streamFavorites).where(and(eq(streamFavorites.id, id), eq(streamFavorites.ownerId, c.get('user').id))).returning({ id: streamFavorites.id });
  return removed.length ? c.json(apiResponse({ deleted: true })) : c.json(apiError('NOT_FOUND', 'Favorite not found'), 404);
});
export default routes;
