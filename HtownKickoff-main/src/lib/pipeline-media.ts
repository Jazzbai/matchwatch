import { request as httpsRequest } from 'node:https';
import { lookup } from 'node:dns/promises';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { PipelineError } from './pipeline-store';

export function publicIPv4(address: string) {
  const p = address.split('.').map(Number);
  if (p.length !== 4 || p.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  const [a, b] = p;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && [0, 168].includes(b) || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19, 51].includes(b) || a === 203 && b === 0);
}
export async function downloadTo(url: string, destination: string, limit: number, hosts: string[], signal?: AbortSignal) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.port || target.username || target.password || !hosts.includes(target.hostname.toLowerCase())) throw new PipelineError('This media host is not allowed. Add its exact hostname to HLS_ALLOWED_HOSTS on the server.');
  const addresses = await lookup(target.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(a => !publicIPv4(a.address))) throw new PipelineError('Media must use public HTTPS storage.');
  // Pin the checked public address for the connection, including every HLS segment.
  const response = await new Promise<import('node:http').IncomingMessage>((resolve, reject) => {
    const request = httpsRequest(target, { signal, family: 4, lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, 4) }, resolve);
    request.setTimeout(20000, () => request.destroy(new Error('Media timed out.')));
    request.on('error', () => reject(new PipelineError('The media download failed or timed out.', 502))); request.end();
  });
  if (response.statusCode !== 200 || Number(response.headers['content-length']) > limit) { response.destroy(); throw new PipelineError('Media is unavailable, redirected, or exceeds the processing limit.', 502); }
  let bytes = 0;
  const timer = setTimeout(() => response.destroy(new Error('Download timed out.')), 180000);
  try {
    await pipeline(response, new Transform({ transform(chunk, _encoding, done) { bytes += chunk.length; done(bytes > limit ? new PipelineError('Media exceeds the processing limit.', 413) : null, chunk); } }), createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  } catch { throw new PipelineError('Media could not be downloaded completely within the size and time limits.', 502); }
  finally { clearTimeout(timer); }
  return bytes;
}
export function runMedia(args: string[], timeout = 240000, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new PipelineError('Media processing was canceled.', 409)); return; }
    const child = spawn(process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg', args, { windowsHide: true, stdio: 'ignore' });
    let timedOut = false, canceled = false;
    const abort = () => { canceled = true; child.kill('SIGKILL'); };
    signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
    child.on('error', () => { cleanup(); reject(new PipelineError('FFmpeg is unavailable on this server.', 503)); });
    // Wait for process exit before the caller removes its temporary folder.
    child.on('close', code => { cleanup(); if (code === 0 && !timedOut && !canceled) resolve(); else reject(new PipelineError(canceled ? 'Media processing was canceled.' : timedOut ? 'Media processing timed out.' : 'FFmpeg could not read this recording.', 502)); });
  });
}
export type HlsSegment = { url: string; seconds: number; sequence: number; utc: string | null; map: string | null; discontinuity: boolean };
export function parseHls(text: string, base: string): { variant?: string; segments: HlsSegment[] } {
  if (!text.startsWith('#EXTM3U')) throw new PipelineError('The live source did not return an HLS playlist.');
  if (/#EXT-X-(KEY|SESSION-KEY):/.test(text) || /#EXT-X-BYTERANGE:/.test(text) || /#EXT-X-MAP:[^\n]*BYTERANGE/.test(text)) throw new PipelineError('Encrypted or byte-range HLS needs an organizer-provided clear stream.');
  const lines = text.split(/\r?\n/).map(s => s.trim()), segments: HlsSegment[] = [];
  let seconds = 0, utc: number | null = null, sequence = 0, variant = false, map: string | null = null, discontinuity = false;
  for (const line of lines) {
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) sequence = Number(line.split(':')[1]);
    else if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) { const date = Date.parse(line.slice(25)); utc = Number.isFinite(date) ? date : null; }
    else if (line.startsWith('#EXT-X-STREAM-INF:')) variant = true;
    else if (line.startsWith('#EXT-X-MAP:')) { const path = line.match(/URI="([^"]+)"/)?.[1]; if (!path) throw new PipelineError('Invalid HLS initialization segment.'); map = new URL(path, base).href; }
    else if (line === '#EXT-X-DISCONTINUITY') discontinuity = true;
    else if (line.startsWith('#EXTINF:')) seconds = Number(line.slice(8).split(',')[0]);
    else if (line && !line.startsWith('#')) {
      if (variant) return { variant: new URL(line, base).href, segments: [] };
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 120 || !Number.isSafeInteger(sequence) || sequence < 0) throw new PipelineError('Invalid HLS segment duration or sequence.');
      segments.push({ url: new URL(line, base).href, seconds, sequence: sequence++, utc: utc === null ? null : new Date(utc).toISOString(), map, discontinuity });
      if (utc !== null) utc += seconds * 1000;
      seconds = 0; discontinuity = false;
    }
  }
  if (!segments.length || segments.length > 20000) throw new PipelineError('No usable segments are available in this HLS window.');
  return { segments };
}
/** Capture only the currently available live window; no arbitrary network access in FFmpeg. */
export async function captureHls(url: string, seconds: number, folder: string, signal?: AbortSignal, download = downloadTo) {
  const hosts = (process.env.HLS_ALLOWED_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!hosts.length) throw new PipelineError('Set HLS_ALLOWED_HOSTS to the organizer stream and segment hostnames.', 503);
  let playlist = url, parsed: ReturnType<typeof parseHls> | undefined;
  for (let depth = 0; depth < 3; depth++) {
    const path = join(folder, `manifest-${depth}.m3u8`); await download(playlist, path, 1024 * 1024, hosts, signal);
    parsed = parseHls(await readFile(path, 'utf8'), playlist);
    if (!parsed.variant) break; playlist = parsed.variant;
  }
  if (!parsed || parsed.variant) throw new PipelineError('HLS variant nesting is too deep.');
  const selected: HlsSegment[] = []; let duration = 0;
  for (const segment of [...parsed.segments].reverse()) { if (duration + segment.seconds > seconds) break; selected.unshift(segment); duration += segment.seconds; }
  if (duration < 4 || selected.length > 120) throw new PipelineError('Wait for at least four seconds of live footage, then retry.');
  let bytes = 0; const maps = new Map<string, string>();
  const lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-TARGETDURATION:120', '#EXT-X-MEDIA-SEQUENCE:0'];
  for (const [index, segment] of selected.entries()) {
    if (segment.discontinuity) lines.push('#EXT-X-DISCONTINUITY');
    if (segment.map) {
      if (!maps.has(segment.map)) { const name = `init-${maps.size}.mp4`; bytes += await download(segment.map, join(folder, name), 16 * 1024 * 1024, hosts, signal); maps.set(segment.map, name); }
      lines.push(`#EXT-X-MAP:URI="${maps.get(segment.map)}"`);
    }
    const name = `segment-${index}.bin`; bytes += await download(segment.url, join(folder, name), 32 * 1024 * 1024, hosts, signal);
    if (bytes > 200 * 1024 * 1024) throw new PipelineError('The live window exceeds 200 MB. Capture a shorter window.', 413);
    lines.push(`#EXTINF:${segment.seconds},`, name);
  }
  lines.push('#EXT-X-ENDLIST'); const path = join(folder, 'capture.m3u8'), output = join(folder, 'capture.mp4');
  await writeFile(path, lines.join('\n'), { mode: 0o600 });
  await runMedia(['-nostdin', '-y', '-protocol_whitelist', 'file,pipe,crypto', '-allowed_extensions', 'ALL', '-i', path, '-t', String(duration), '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-movflags', '+faststart', output], 90000, signal);
  return { path: output, duration, programDateTime: selected[0].utc || undefined, mediaSequence: selected[0].sequence };
}
