import { jevPrompt, jevSchemaFor, parseJevReviews, recoverJevReviews, reviewInput, reviewWindow, type JevCandidate } from './jev';
const base = 'https://api.twelvelabs.io/v1.3';
export class TwelveLabsError extends Error {
  constructor(message: string, public status: number, public code?: string, public retryAfter?: string) { super(message); }
}
export function validVideoId(id: string) { return /^[a-f0-9]{24}$/.test(id); }
export type IndexedVideo = { _id: string; asset_id?: string; status?: string; user_metadata?: Record<string, unknown>; system_metadata?: { filename?: string; duration?: number }; hls?: { video_url?: string } };
type Resource = Partial<IndexedVideo> & { error?: { message?: string } };
type SearchMatch = { video_id?: string; start?: number; end?: number; confidence?: string; rank?: number };
export class TwelveLabsClient {
  constructor(private key: string, private index: string, private transport: typeof fetch = fetch) {}
  private async request<T>(path: string, init?: RequestInit, timeoutMs = 120000): Promise<T> {
    const headers = new Headers(init?.headers); headers.set('x-api-key', this.key);
    let response: Response;
    try { response = await this.transport(`${base}${path}`, { ...init, headers, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs), cache: 'no-store' }); }
    catch { throw new TwelveLabsError('TwelveLabs could not be reached. Check your connection and try again.', 502); }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const fallback = response.status === 401 ? 'Your TwelveLabs API key is invalid or expired.' : response.status === 429 ? 'TwelveLabs rate limit reached. Wait before trying again.' : `TwelveLabs request failed (${response.status}).`;
      throw new TwelveLabsError(typeof data?.message === 'string' ? data.message.slice(0, 500) : fallback, response.status, typeof data?.code === 'string' ? data.code : undefined, response.headers.get('retry-after') || undefined);
    }
    if (!data || typeof data !== 'object') throw new TwelveLabsError('TwelveLabs returned an unreadable response.', 502);
    return data as T;
  }
  async upload(file: File, signal?: AbortSignal) {
    const body = new FormData(); body.set('method', 'direct'); body.set('file', file); body.set('enable_hls', 'false');
    const asset = await this.request<Resource>('/assets', { method: 'POST', body, signal }, 240000);
    if (!asset._id || !validVideoId(asset._id)) throw new TwelveLabsError('TwelveLabs did not return a valid asset ID.', 502);
    return asset._id;
  }
  asset(id: string) { return this.request<Resource>(`/assets/${id}`); }
  async importUrl(url: string) {
    const body = new FormData(); body.set('method', 'url'); body.set('url', url); body.set('enable_hls', 'false');
    const asset = await this.request<Resource>('/assets', { method: 'POST', body });
    if (!asset._id || !validVideoId(asset._id)) throw new TwelveLabsError('TwelveLabs did not return a valid imported asset ID.', 502);
    return asset._id;
  }
  async indexAsset(id: string) {
    const asset = await this.asset(id);
    if (asset.status !== 'ready') throw new TwelveLabsError(asset.status === 'failed' ? asset.error?.message || 'Video processing failed.' : 'Wait for video processing to finish before indexing.', 409);
    const indexed = await this.request<Resource>(`/indexes/${this.index}/indexed-assets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asset_id: id }) });
    if (!indexed._id || !validVideoId(indexed._id)) throw new TwelveLabsError('TwelveLabs did not return a valid indexed asset ID.', 502);
    return indexed._id;
  }
  indexedAsset(id: string) { return this.request<Resource>(`/indexes/${this.index}/indexed-assets/${id}`); }
  indexInfo() { return this.request<{ _id: string; index_name: string; video_count?: number }>(`/indexes/${this.index}`, undefined, 20000); }
  async listIndexedAssets() {
    const result: IndexedVideo[] = [];
    for (let page = 1; page <= 1000; page++) {
      const data = await this.request<{ data: IndexedVideo[]; page_info?: { total_page?: number; total_results?: number } }>(`/indexes/${this.index}/indexed-assets?page=${page}&page_limit=50`, undefined, 20000);
      if (!Array.isArray(data.data) || data.data.some(item => !validVideoId(item?._id))) throw new TwelveLabsError('TwelveLabs returned an invalid index listing.', 502);
      result.push(...data.data);
      if (data.page_info?.total_page ? page >= data.page_info.total_page : data.data.length < 50) return result;
    }
    throw new TwelveLabsError('The index is too large to map in one request. No partial mapping was saved.', 503);
  }
  async review(id: string, candidates: JevCandidate[], duration: number, idempotencyKey?: string) {
    const window = reviewWindow(candidates, duration);
    const data = await this.request<{ task_id?: string }>('/analyze/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, body: JSON.stringify({
      model_name: 'pegasus1.6', video: { type: 'asset_id', asset_id: id },
      prompt: jevPrompt(candidates), temperature: 0.1, max_tokens: 16384,
      start_time: window.start, end_time: window.end,
      response_format: { type: 'json_schema', json_schema: jevSchemaFor(candidates) },
    }) });
    if (!data.task_id || !validVideoId(data.task_id)) throw new TwelveLabsError('TwelveLabs did not return a valid Jev task ID.', 502);
    return data.task_id;
  }
  async reviewStatus(id: string) {
    const task = await this.request<{ status?: string; error?: { message?: string }; result?: { data?: string; finish_reason?: string }; request_params?: { prompt?: string; start_time?: number; end_time?: number } }>(`/analyze/tasks/${id}`);
    if (task.status !== 'ready') return { status: task.status, error: task.error?.message };
    if (task.error || task.result?.finish_reason === 'length' || typeof task.result?.data !== 'string') throw new TwelveLabsError('Jev returned an incomplete analysis. Your candidates are unchanged.', 502);
    try {
      const parsed = parseJevReviews(JSON.parse(task.result.data)), params = task.request_params;
      const marker = '\nCandidate data: ', position = params?.prompt?.lastIndexOf(marker) ?? -1;
      if (position >= 0 && params?.prompt && typeof params.end_time === 'number' && typeof params.start_time === 'number') {
        const candidates = reviewInput(JSON.parse(params.prompt.slice(position + marker.length)), params.end_time);
        const window = reviewWindow(candidates, params.end_time);
        if (Math.abs(window.start - params.start_time) > 1e-6 || Math.abs(window.end - params.end_time) > 1e-6) throw new Error('Analysis window does not match its candidates.');
        const reviews = recoverJevReviews(parsed, candidates, params.end_time);
        return { status: task.status, reviews };
      }
      return { status: task.status, reviews: parsed };
    }
    catch { throw new TwelveLabsError('Jev returned invalid review data. Your candidates are unchanged.', 502); }
  }
  async search(id: string, query: string) {
    const body = new FormData(); body.set('index_id', this.index); body.set('query_text', query); body.append('search_options', 'visual'); body.set('group_by', 'clip'); body.set('page_limit', '10'); body.set('filter', JSON.stringify({ id: [id] }));
    const data = await this.request<{ data?: SearchMatch[] }>('/search', { method: 'POST', body });
    if (!Array.isArray(data.data)) throw new TwelveLabsError('TwelveLabs returned an invalid search result.', 502);
    return data.data.filter(item => item && item.video_id === id && Number.isFinite(item.start) && Number.isFinite(item.end) && item.start! >= 0 && item.end! > item.start!);
  }
}
