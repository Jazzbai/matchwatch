import { spawn } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ffmpegPath from 'ffmpeg-static';
import { PipelineError } from './store';

// FFmpeg execution and safe capture of an organizer's live HLS window.

/** Runs FFmpeg and resolves with the tail of its log once the process has exited. */
export function runFfmpeg(args: string[], timeoutMs = 240_000, signal?: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) return reject(new PipelineError('Media processing was canceled.', 409));
    const child = spawn(process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg', args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let outcome: 'timeout' | 'canceled' | null = null, diagnostics = '';
    // Keep only the tail of FFmpeg's log; signed URLs are redacted before it is logged.
    child.stderr?.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-4000); });
    const abort = () => { outcome = 'canceled'; child.kill('SIGKILL'); };
    const timer = setTimeout(() => { outcome = 'timeout'; child.kill('SIGKILL'); }, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    child.on('error', () => { cleanup(); reject(new PipelineError('FFmpeg is not available on this server.', 503)); });
    // Resolve only after exit so callers can safely delete the working folder.
    child.on('close', code => {
      cleanup();
      if (code === 0 && !outcome) return resolve(diagnostics);
      console.error(JSON.stringify({ component: 'ffmpeg', code, outcome, log: diagnostics.replace(/https?:\/\/\S+/g, '<url>').trim().split('\n').slice(-3) }));
      reject(new PipelineError(outcome === 'canceled' ? 'Media processing was canceled.' : outcome === 'timeout' ? 'Media processing timed out.' : 'FFmpeg could not read this video.', 502));
    });
  });
}

/** Duration in seconds of a local media file, read by remuxing it to nowhere. */
export async function mediaDuration(path: string, signal?: AbortSignal) {
  const log = await runFfmpeg(['-nostdin', '-hide_banner', '-i', path, '-map', '0', '-c', 'copy', '-f', 'null', '-'], 30_000, signal);
  const times = [...log.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const last = times.at(-1);
  return last ? Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]) : 0;
}

export function publicIPv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  const reserved = a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0);
  return !reserved;
}

/** HTTPS download from an allow-listed host, pinned to its checked public address. */
export async function downloadTo(url: string, destination: string, limitBytes: number, hosts: string[], signal?: AbortSignal) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.port || target.username || target.password || !hosts.includes(target.hostname.toLowerCase())) {
    throw new PipelineError('This media host is not allowed. Add its exact hostname to HLS_ALLOWED_HOSTS.');
  }
  const addresses = await lookup(target.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(item => !publicIPv4(item.address))) throw new PipelineError('Media must be served from public HTTPS storage.');
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    const request = httpsRequest(target, { signal, family: 4, lookup: (_host, _options, callback) => callback(null, addresses[0].address, 4) }, resolve);
    request.setTimeout(20_000, () => request.destroy(new Error('Media timed out.')));
    request.on('error', () => reject(new PipelineError('The media download failed or timed out.', 502)));
    request.end();
  });
  if (response.statusCode !== 200 || Number(response.headers['content-length']) > limitBytes) {
    response.destroy();
    throw new PipelineError('The media is unavailable, redirected or too large.', 502);
  }
  let bytes = 0;
  const timer = setTimeout(() => response.destroy(new Error('Download timed out.')), 180_000);
  const counter = new Transform({
    transform(chunk, _encoding, done) {
      bytes += chunk.length;
      done(bytes > limitBytes ? new PipelineError('The media exceeds the processing limit.', 413) : null, chunk);
    },
  });
  try {
    await pipeline(response, counter, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  } catch {
    throw new PipelineError('The media could not be downloaded within the size and time limits.', 502);
  } finally {
    clearTimeout(timer);
  }
  return bytes;
}

export type HlsSegment = { url: string; seconds: number; sequence: number; utc: string | null; map: string | null; discontinuity: boolean };

export function parseHls(text: string, base: string): { variant?: string; segments: HlsSegment[] } {
  if (!text.startsWith('#EXTM3U')) throw new PipelineError('The live source did not return an HLS playlist.');
  if (/#EXT-X-(KEY|SESSION-KEY):/.test(text) || /#EXT-X-BYTERANGE:/.test(text) || /#EXT-X-MAP:[^\n]*BYTERANGE/.test(text)) {
    throw new PipelineError('Encrypted or byte-range HLS needs an organizer-provided clear stream.');
  }
  const segments: HlsSegment[] = [];
  let seconds = 0, utc: number | null = null, sequence = 0, isVariant = false, map: string | null = null, discontinuity = false;
  for (const line of text.split(/\r?\n/).map(item => item.trim())) {
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) sequence = Number(line.split(':')[1]);
    else if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
      const date = Date.parse(line.slice('#EXT-X-PROGRAM-DATE-TIME:'.length));
      utc = Number.isFinite(date) ? date : null;
    } else if (line.startsWith('#EXT-X-STREAM-INF:')) isVariant = true;
    else if (line.startsWith('#EXT-X-MAP:')) {
      const path = line.match(/URI="([^"]+)"/)?.[1];
      if (!path) throw new PipelineError('Invalid HLS initialization segment.');
      map = new URL(path, base).href;
    } else if (line === '#EXT-X-DISCONTINUITY') discontinuity = true;
    else if (line.startsWith('#EXTINF:')) seconds = Number(line.slice('#EXTINF:'.length).split(',')[0]);
    else if (line && !line.startsWith('#')) {
      if (isVariant) return { variant: new URL(line, base).href, segments: [] };
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 120 || !Number.isSafeInteger(sequence) || sequence < 0) throw new PipelineError('Invalid HLS segment duration or sequence.');
      segments.push({ url: new URL(line, base).href, seconds, sequence: sequence++, utc: utc === null ? null : new Date(utc).toISOString(), map, discontinuity });
      if (utc !== null) utc += seconds * 1000;
      seconds = 0;
      discontinuity = false;
    }
  }
  if (!segments.length || segments.length > 20_000) throw new PipelineError('No usable segments are available in this HLS window.');
  return { segments };
}

/** Captures the most recent `seconds` of a live playlist into a local MP4. */
export async function captureHls(url: string, seconds: number, folder: string, signal?: AbortSignal, download = downloadTo) {
  const hosts = (process.env.HLS_ALLOWED_HOSTS || '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
  if (!hosts.length) throw new PipelineError('Set HLS_ALLOWED_HOSTS to the organizer stream and segment hostnames.', 503);
  let playlist = url, parsed: ReturnType<typeof parseHls> | undefined;
  for (let depth = 0; depth < 3; depth++) {
    const path = join(folder, `manifest-${depth}.m3u8`);
    await download(playlist, path, 1024 * 1024, hosts, signal);
    parsed = parseHls(await readFile(path, 'utf8'), playlist);
    if (!parsed.variant) break;
    playlist = parsed.variant;
  }
  if (!parsed || parsed.variant) throw new PipelineError('HLS variant nesting is too deep.');

  const selected: HlsSegment[] = [];
  let duration = 0;
  for (const segment of [...parsed.segments].reverse()) {
    if (duration + segment.seconds > seconds) break;
    selected.unshift(segment);
    duration += segment.seconds;
  }
  if (duration < 4 || selected.length > 120) throw new PipelineError('Wait for at least four seconds of live footage, then retry.');

  let bytes = 0;
  const maps = new Map<string, string>();
  const lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-TARGETDURATION:120', '#EXT-X-MEDIA-SEQUENCE:0'];
  for (const [index, segment] of selected.entries()) {
    if (segment.discontinuity) lines.push('#EXT-X-DISCONTINUITY');
    if (segment.map) {
      if (!maps.has(segment.map)) {
        const name = `init-${maps.size}.mp4`;
        bytes += await download(segment.map, join(folder, name), 16 * 1024 * 1024, hosts, signal);
        maps.set(segment.map, name);
      }
      lines.push(`#EXT-X-MAP:URI="${maps.get(segment.map)}"`);
    }
    const name = `segment-${index}.bin`;
    bytes += await download(segment.url, join(folder, name), 32 * 1024 * 1024, hosts, signal);
    if (bytes > 200 * 1024 * 1024) throw new PipelineError('The live window exceeds 200 MB. Capture a shorter window.', 413);
    lines.push(`#EXTINF:${segment.seconds},`, name);
  }
  lines.push('#EXT-X-ENDLIST');
  const manifest = join(folder, 'capture.m3u8'), output = join(folder, 'capture.mp4');
  await writeFile(manifest, lines.join('\n'), { mode: 0o600 });
  await runFfmpeg(['-nostdin', '-y', '-protocol_whitelist', 'file,pipe,crypto', '-allowed_extensions', 'ALL', '-i', manifest, '-t', String(duration), '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-movflags', '+faststart', output], 90_000, signal);
  return { path: output, duration, programDateTime: selected[0].utc ?? undefined };
}
