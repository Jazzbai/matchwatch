import { jevPrompt, jevSchema, parseJevReviews, reviewWindow, type JevCandidate } from './jev';
const base = 'https://api.twelvelabs.io/v1.3';
export class TwelveLabsError extends Error {
  constructor(message: string, public status: number, public code?: string, public retryAfter?: string) { super(message); }
}
export function validVideoId(id: string) { return /^[a-f0-9]{24}$/.test(id); }
type Resource = { _id?: string; status?: string; error?: { message?: string } };
type SearchMatch = { video_id?: string; start?: number; end?: number; confidence?: string; rank?: number };
export class TwelveLabsClient {
  constructor(private key: string, private index: string, private transport: typeof fetch = fetch) {}
  private async request<T>(path: string, init?: RequestInit, timeoutMs = 120000): Promise<T> {
    const headers = new Headers(init?.headers); headers.set('x-api-key', this.key);
    let response: Response;
    try { response = await this.transport(`${base}${path}`, { ...init, headers, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' }); }
    catch { throw new TwelveLabsError('TwelveLabs could not be reached. Check your connection and try again.', 502); }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const fallback = response.status === 401 ? 'Your TwelveLabs API key is invalid or expired.' : response.status === 429 ? 'TwelveLabs rate limit reached. Wait before trying again.' : `TwelveLabs request failed (${response.status}).`;
      throw new TwelveLabsError(typeof data?.message === 'string' ? data.message.slice(0, 500) : fallback, response.status, typeof data?.code === 'string' ? data.code : undefined, response.headers.get('retry-after') || undefined);
    }
    if (!data || typeof data !== 'object') throw new TwelveLabsError('TwelveLabs returned an unreadable response.', 502);
    return data as T;
  }
  async upload(file: File) {
    const body = new FormData(); body.set('method', 'direct'); body.set('file', file); body.set('enable_hls', 'false');
    const asset = await this.request<Resource>('/assets', { method: 'POST', body }, 240000);
    if (!asset._id || !validVideoId(asset._id)) throw new TwelveLabsError('TwelveLabs did not return a valid asset ID.', 502);
    return asset._id;
  }
  asset(id: string) { return this.request<Resource>(`/assets/${id}`); }
  async indexAsset(id: string) {
    const asset = await this.asset(id);
    if (asset.status !== 'ready') throw new TwelveLabsError(asset.status === 'failed' ? asset.error?.message || 'Video processing failed.' : 'Wait for video processing to finish before indexing.', 409);
    const indexed = await this.request<Resource>(`/indexes/${this.index}/indexed-assets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asset_id: id }) });
    if (!indexed._id || !validVideoId(indexed._id)) throw new TwelveLabsError('TwelveLabs did not return a valid indexed asset ID.', 502);
    return indexed._id;
  }
  indexedAsset(id: string) { return this.request<Resource>(`/indexes/${this.index}/indexed-assets/${id}`); }
  async review(id: string, candidates: JevCandidate[], duration: number) {
    const window = reviewWindow(candidates, duration);
    const data = await this.request<{ task_id?: string }>('/analyze/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      model_name: 'pegasus1.6', video: { type: 'asset_id', asset_id: id },
      prompt: jevPrompt(candidates), temperature: 0.1, max_tokens: 16384,
      start_time: window.start, end_time: window.end,
      response_format: { type: 'json_schema', json_schema: jevSchema },
    }) });
    if (!data.task_id || !validVideoId(data.task_id)) throw new TwelveLabsError('TwelveLabs did not return a valid Jev task ID.', 502);
    return data.task_id;
  }
  async reviewStatus(id: string) {
    const task = await this.request<{ status?: string; error?: { message?: string }; result?: { data?: string; finish_reason?: string } }>(`/analyze/tasks/${id}`);
    if (task.status !== 'ready') return { status: task.status, error: task.error?.message };
    if (task.error || task.result?.finish_reason === 'length' || typeof task.result?.data !== 'string') throw new TwelveLabsError('Jev returned an incomplete analysis. Your candidates are unchanged.', 502);
    try { return { status: task.status, reviews: parseJevReviews(JSON.parse(task.result.data)) }; }
    catch { throw new TwelveLabsError('Jev returned invalid review data. Your candidates are unchanged.', 502); }
  }
  async search(id: string, query: string) {
    const body = new FormData(); body.set('index_id', this.index); body.set('query_text', query); body.append('search_options', 'visual'); body.set('group_by', 'clip'); body.set('page_limit', '10'); body.set('filter', JSON.stringify({ id: [id] }));
    const data = await this.request<{ data?: SearchMatch[] }>('/search', { method: 'POST', body });
    if (!Array.isArray(data.data)) throw new TwelveLabsError('TwelveLabs returned an invalid search result.', 502);
    return data.data.filter(item => item && item.video_id === id && Number.isFinite(item.start) && Number.isFinite(item.end) && item.start! >= 0 && item.end! > item.start!);
  }
}
