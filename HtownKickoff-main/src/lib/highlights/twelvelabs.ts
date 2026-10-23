// Minimal TwelveLabs v1.3 client: assets, indexing, Marengo search and Pegasus analysis.
// Requests are never retried automatically, so uploads and paid analyses are not duplicated.

const API = 'https://api.twelvelabs.io/v1.3';

export class TwelveLabsError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export const isProviderId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'canceled' | string;
export type Asset = { _id: string; status?: ProcessingStatus; duration?: number; filename?: string; hls?: { manifest_url?: string; status?: string }; error?: { message?: string } };
export type IndexedAsset = {
  _id: string;
  asset_id?: string;
  status?: ProcessingStatus;
  system_metadata?: { duration?: number; filename?: string; width?: number; height?: number };
  user_metadata?: Record<string, unknown>;
  hls?: { video_url?: string; thumbnail_urls?: string[] };
};
export type SearchMatch = { start: number; end: number; rank: number; transcription?: string };
export type AnalysisWindow = { start: number; end: number };
export type AnalysisResult = { status: ProcessingStatus; data?: unknown; error?: string };

export class TwelveLabsClient {
  constructor(private key: string, readonly indexId: string, private transport: typeof fetch = fetch) {}

  private async request<T>(path: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('x-api-key', this.key);
    const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    let response: Response;
    try {
      response = await this.transport(`${API}${path}`, { ...init, headers, signal, cache: 'no-store' });
    } catch {
      throw new TwelveLabsError('TwelveLabs could not be reached. Check the connection and try again.', 502);
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const fallback = response.status === 401 ? 'The TwelveLabs API key is invalid or expired.'
        : response.status === 429 ? 'TwelveLabs rate limit reached. Wait a moment and retry.'
        : `TwelveLabs request failed (${response.status}).`;
      throw new TwelveLabsError(typeof data?.message === 'string' ? data.message.slice(0, 300) : fallback, response.status, data?.code);
    }
    if (!data || typeof data !== 'object') throw new TwelveLabsError('TwelveLabs returned an unreadable response.', 502);
    return data as T;
  }

  /** Direct upload (≤ 200 MB). HLS is enabled so the same asset can be previewed and cut. */
  async uploadAsset(file: File, signal?: AbortSignal) {
    const body = new FormData();
    body.set('method', 'direct');
    body.set('file', file);
    body.set('enable_hls', 'true');
    const asset = await this.request<Asset>('/assets', { method: 'POST', body, signal }, 300_000);
    if (!isProviderId(asset._id)) throw new TwelveLabsError('TwelveLabs did not return a valid asset ID.', 502);
    return asset._id;
  }

  asset(id: string) {
    return this.request<Asset>(`/assets/${id}`);
  }

  async indexAsset(assetId: string) {
    const indexed = await this.request<IndexedAsset>(`/indexes/${this.indexId}/indexed-assets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asset_id: assetId }),
    });
    if (!isProviderId(indexed._id)) throw new TwelveLabsError('TwelveLabs did not return a valid indexed asset ID.', 502);
    return indexed._id;
  }

  indexedAsset(id: string) {
    return this.request<IndexedAsset>(`/indexes/${this.indexId}/indexed-assets/${id}`);
  }

  async listIndexedAssets() {
    const items: IndexedAsset[] = [];
    for (let page = 1; page <= 40; page++) {
      const data = await this.request<{ data?: IndexedAsset[]; page_info?: { total_page?: number } }>(`/indexes/${this.indexId}/indexed-assets?page=${page}&page_limit=50`);
      items.push(...(data.data || []).filter(item => isProviderId(item._id)));
      if (page >= (data.page_info?.total_page ?? 1)) break;
    }
    return items;
  }

  /** Marengo visual + audio search restricted to one indexed video. */
  async search(indexedAssetId: string, query: string, limit = 10): Promise<SearchMatch[]> {
    const body = new FormData();
    body.set('index_id', this.indexId);
    body.set('query_text', query);
    body.append('search_options', 'visual');
    body.append('search_options', 'audio');
    body.set('group_by', 'clip');
    body.set('page_limit', String(limit));
    body.set('filter', JSON.stringify({ id: [indexedAssetId] }));
    const data = await this.request<{ data?: (Partial<SearchMatch> & { video_id?: string })[] }>('/search', { method: 'POST', body });
    if (!Array.isArray(data.data)) throw new TwelveLabsError('TwelveLabs returned an invalid search result.', 502);
    return data.data
      .filter(item => item.video_id === indexedAssetId && Number.isFinite(item.start) && Number.isFinite(item.end) && item.end! > item.start!)
      .map((item, index) => ({ start: item.start!, end: item.end!, rank: item.rank ?? index + 1, ...(item.transcription ? { transcription: item.transcription } : {}) }));
  }

  /** Asynchronous Pegasus analysis of one window, returning schema-shaped JSON. */
  async createAnalysis(assetId: string, prompt: string, schema: object, window: AnalysisWindow, idempotencyKey: string) {
    const data = await this.request<{ task_id?: string }>('/analyze/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        model_name: 'pegasus1.6', video: { type: 'asset_id', asset_id: assetId }, prompt,
        temperature: 0.1, max_tokens: 8192, start_time: window.start, end_time: window.end,
        response_format: { type: 'json_schema', json_schema: schema },
      }),
    });
    if (!isProviderId(data.task_id)) throw new TwelveLabsError('TwelveLabs did not return a valid analysis task.', 502);
    return data.task_id;
  }

  async analysis(taskId: string): Promise<AnalysisResult> {
    const task = await this.request<{ status?: string; error?: { message?: string }; result?: { data?: string; finish_reason?: string } }>(`/analyze/tasks/${taskId}`);
    if (task.status !== 'ready') return { status: task.status || 'processing', error: task.error?.message };
    if (task.result?.finish_reason === 'length' || typeof task.result?.data !== 'string') return { status: 'failed', error: 'The video analysis was incomplete.' };
    try {
      return { status: 'ready', data: JSON.parse(task.result.data) };
    } catch {
      return { status: 'failed', error: 'The video analysis returned invalid JSON.' };
    }
  }
}

export function twelveLabsFromEnv() {
  const key = process.env.TWELVELABS_API_KEY, index = process.env.TWELVELABS_INDEX_ID;
  if (!key || !isProviderId(index)) throw new TwelveLabsError('Set TWELVELABS_API_KEY and TWELVELABS_INDEX_ID on the server.', 503);
  return new TwelveLabsClient(key, index);
}
