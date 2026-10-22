export class ScorePlayError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export const scorePlayLimit = 200 * 1024 * 1024;
export function scorePlayAllowed(owner: string) {
  return process.env.NODE_ENV === 'development' && owner === 'local' ||
    (process.env.SCOREPLAY_ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean).includes(owner);
}
type Media = { ID: number; name: string; type: string; duration?: number };
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
export function selectScorePlayFormat(data: { items?: Record<string, Format[]> }) {
  const formats = Object.values(data.items || {}).flat().filter(f => f && f.is_scoreplay === true &&
    f.size > 0 && f.size <= scorePlayLimit && f.mime_type === 'video/mp4' && f.file_url && (!f.status || ['ready', 'active'].includes(f.status)));
  // Keep the best available MP4 within the existing prototype upload limit.
  formats.sort((a, b) => b.size - a.size);
  if (!formats.length) throw new ScorePlayError('No ready downloadable MP4 under 200 MB. Create a shorter MP4 in ScorePlay or upload a local excerpt.', 400);
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
  async search(query: string) {
    if (query.length > 120) throw new ScorePlayError('Use a search of 120 characters or fewer.', 400);
    const data = await this.request('/media/search?page=1&per_page=12', { method: 'POST', body: JSON.stringify({ media_type: 'video', ...(query.trim() ? { name: query.trim() } : {}) }) });
    if (!Array.isArray(data.media)) throw new ScorePlayError('ScorePlay returned an unexpected media list.');
    return data.media.filter((m: Media) => Number.isSafeInteger(m.ID) && m.ID > 0 && m.type === 'video' && typeof m.name === 'string').map((m: Media) => ({ id: String(m.ID), name: m.name, duration: m.duration }));
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
