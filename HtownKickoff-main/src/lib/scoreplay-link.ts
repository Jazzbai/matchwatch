/** Extract only a media ID. Provider requests still use the fixed server-side API. */
export function scorePlayMediaId(value: string): string | null {
  const input = value.trim();
  const isId = (id: string) => /^[1-9][0-9]{0,15}$/.test(id);
  if (isId(input)) return input;
  if (input.length > 2048) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.scoreplay.io') || url.username || url.password || url.port) return null;
    const id = url.pathname.match(/^\/media\/media-details\/([1-9][0-9]{0,15})\/?$/)?.[1];
    return id ?? null;
  } catch { return null; }
}
