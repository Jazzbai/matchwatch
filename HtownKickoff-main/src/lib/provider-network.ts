// Shared connection classification. Never log an exception message, URL or headers.
const transientCodes = new Set(['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']);

function codeOf(error: unknown): string | undefined {
  const value = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = value?.cause?.code ?? value?.code;
  return typeof code === 'string' ? code : undefined;
}

export function isTransientConnectionError(error: unknown) {
  const code = codeOf(error);
  return code ? transientCodes.has(code) : error instanceof TypeError && error.message === 'fetch failed';
}

export function connectionFailureCode(error: unknown, timedOut = false) {
  const code = codeOf(error);
  return code && transientCodes.has(code) ? code : timedOut ? 'TIMEOUT' : isTransientConnectionError(error) ? 'FETCH_FAILED' : 'NETWORK_ERROR';
}
