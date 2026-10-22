/** Parse proxy and API failures without hiding them behind a JSON parse error. */
export async function highlightResponse(response: Response): Promise<Response> {
  if (response.ok) return response;
  const data = await response.json().catch(() => null);
  const fallback = response.status === 401 ? 'Sign in to MatchWatch, then retry processing this video.'
    : response.status === 413 ? 'The server rejected this upload as too large. Choose a smaller video.'
    : [502, 503, 504].includes(response.status) ? 'Video processing is temporarily unavailable. Retry this video shortly.'
    : `Video request failed (${response.status}). Retry or choose a shorter MP4.`;
  throw new Error(typeof data?.error === 'string' ? data.error : fallback);
}

/** Report browser-to-server progress separately from provider processing. */
export function uploadHighlight(url: string, body: FormData, headers: HeadersInit,
  signal: AbortSignal, progress: (sent: number, total: number) => void): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => signal.removeEventListener('abort', abort);
    xhr.open('POST', url); xhr.timeout = 300000;
    new Headers(headers).forEach((value, name) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = event => { if (!signal.aborted && event.lengthComputable) progress(event.loaded, event.total); };
    xhr.onload = () => { cleanup(); resolve(new Response(xhr.responseText, { status: xhr.status, headers: { 'Content-Type': xhr.getResponseHeader('Content-Type') || 'application/json' } })); };
    xhr.onerror = () => { cleanup(); reject(new Error('The video upload lost its connection. Check your network and retry.')); };
    xhr.ontimeout = () => { cleanup(); reject(new Error('Upload took longer than five minutes. Try a shorter or smaller MP4.')); };
    xhr.onabort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    xhr.send(body);
  }).then(highlightResponse);
}
