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
