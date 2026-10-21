import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { TwelveLabsClient, TwelveLabsError, validVideoId } from '../../../../lib/twelvelabs';
import { HighlightAccessError, highlightOwner, studioEnabled, resourceTicket, resourceId, reserveOperation } from '../../../../lib/highlight-access';

export const runtime = 'nodejs';
export const maxDuration = 300;
const ffmpeg = process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg';
function client() {
  const key = process.env.TWELVELABS_API_KEY, index = process.env.TWELVELABS_INDEX_ID;
  if (!key || !index) throw new TwelveLabsError('Set TWELVELABS_API_KEY and TWELVELABS_INDEX_ID in .env.local, then restart the server.', 503);
  if (!validVideoId(index)) throw new TwelveLabsError('TWELVELABS_INDEX_ID must be a valid 24-character index ID.', 503);
  return new TwelveLabsClient(key, index);
}
function failure(error: unknown) {
  if (error instanceof HighlightAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof TwelveLabsError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: error.retryAfter ? { 'Retry-After': error.retryAfter } : undefined });
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Highlight request failed.' }, { status: 400 });
}
function run(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Video export timed out. Try fewer or shorter clips.')); }, 240000);
    child.on('error', () => { clearTimeout(timer); reject(new Error('FFmpeg is unavailable. Install FFmpeg or set FFMPEG_PATH, then restart the server.')); });
    child.on('close', code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error('FFmpeg could not process this video. Use a valid MP4 with a video track.')); });
  });
}
export async function GET(request: NextRequest) {
  const assetId = request.nextUrl.searchParams.get('assetId');
  const indexedAssetId = request.nextUrl.searchParams.get('indexedAssetId');
  try {
    if (assetId !== null || indexedAssetId !== null) {
      const owner = await highlightOwner(request);
      if (assetId !== null && indexedAssetId !== null) return NextResponse.json({ error: 'Invalid video resource.' }, { status: 400 });
      const id = resourceId(assetId ?? indexedAssetId ?? '', owner, assetId !== null ? 'asset' : 'indexed');
      const labs = client(); const data = assetId !== null ? await labs.asset(id) : await labs.indexedAsset(id);
      return NextResponse.json({ status: data.status, error: data.status === 'failed' ? data.error?.message || 'Video processing failed. Check the video format and index configuration.' : undefined }, { headers: { 'Cache-Control': 'no-store' } });
    }
    let exportReady = true; try { await run(['-version']); } catch { exportReady = false; }
    const enabled = studioEnabled() && (process.env.NODE_ENV === 'development' || (process.env.HIGHLIGHTS_SIGNING_SECRET || '').length >= 32);
    return NextResponse.json({ detectionReady: enabled && Boolean(process.env.TWELVELABS_API_KEY && validVideoId(process.env.TWELVELABS_INDEX_ID || '')), exportReady: enabled && exportReady, requiresLogin: process.env.NODE_ENV !== 'development' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length')) > 210 * 1024 * 1024) return NextResponse.json({ error: 'Use a video smaller than 200 MB for this local prototype.' }, { status: 413 });
  let directory: string | undefined;
  let release: (() => void) | undefined;
  try {
    const owner = await highlightOwner(request);
    // Authenticate and reserve upload capacity before buffering a video body.
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) throw new Error('Expected a multipart form.');
    release = reserveOperation(owner, 'request');
    const form = await request.formData();
    const action = form.get('action');
    if (!['upload', 'index', 'search', 'export'].includes(String(action))) throw new Error('Unknown highlight action.');
    release(); release = reserveOperation(owner, String(action));
    if (action === 'upload' || action === 'index' || action === 'search') {
      const labs = client();
      if (action === 'upload') {
        const file = form.get('video');
        if (!(file instanceof File) || file.size === 0 || file.size > 200 * 1024 * 1024) throw new Error('Choose a video between 1 byte and 200 MB.');
        return NextResponse.json({ assetId: resourceTicket(await labs.upload(file), owner, 'asset') });
      }
      if (action === 'index') {
        const id = resourceId(String(form.get('assetId') || ''), owner, 'asset');
        return NextResponse.json({ indexedAssetId: resourceTicket(await labs.indexAsset(id), owner, 'indexed') });
      }
      const video = resourceId(String(form.get('videoId') || ''), owner, 'indexed');
      const queries = String(form.get('queries') || '').split('\n').map(q => q.trim()).filter(Boolean);
      if (!queries.length || queries.length > 8 || queries.some(q => q.length > 200)) throw new Error('Enter up to eight queries, each under 200 characters.');
      const events = [];
      for (const query of queries) {
        for (const item of await labs.search(video, query)) {
          // Provider confidence is categorical; expose the category rather than inventing a probability.
          events.push({ id: crypto.randomUUID(), label: query, start: item.start, end: item.end, confidence: 0, providerConfidence: item.confidence || 'unreported', importance: 0.8, context: 0.5, audio: 0, reaction: 0, preference: 0.5 });
        }
      }
      return NextResponse.json({ events });
    }
    if (action !== 'export') throw new Error('Unknown highlight action.');
    const video = form.get('video');
    if (!(video instanceof File) || video.size === 0 || video.size > 200 * 1024 * 1024) throw new Error('Choose a video smaller than 200 MB.');
    const clips: { start: number; end: number }[] = JSON.parse(String(form.get('clips') || '[]'));
    if (!Array.isArray(clips) || !clips.length || clips.length > 20 || clips.some(c => !Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end <= c.start || c.end > 86400) || clips.reduce((sum, c) => sum + c.end - c.start, 0) > 300.01) throw new Error('Select 1–20 valid clips totaling at most five minutes.');
    directory = await mkdtemp(join(tmpdir(), 'matchwatch-highlights-'));
    const source = join(directory, 'source.mp4'); await writeFile(source, Buffer.from(await video.arrayBuffer()));
    const list = [];
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      // Disable network protocols and normalize every clip for reliable concatenation.
      await run(['-nostdin', '-y', '-protocol_whitelist', 'file,pipe', '-ss', String(clip.start), '-i', source, '-t', String(clip.end - clip.start), '-map', '0:v:0', '-map', '0:a:0?', '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1', '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', join(directory, `clip-${i}.mp4`)]);
      list.push(`file 'clip-${i}.mp4'`);
    }
    await writeFile(join(directory, 'clips.txt'), list.join('\n'));
    const output = join(directory, 'highlights.mp4');
    await run(['-nostdin', '-y', '-f', 'concat', '-safe', '1', '-i', join(directory, 'clips.txt'), '-c', 'copy', '-movflags', '+faststart', output]);
    return new Response(await readFile(output), { headers: { 'Content-Type': 'video/mp4', 'Content-Disposition': 'attachment; filename="matchwatch-highlights.mp4"', 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
  finally { release?.(); if (directory) await rm(directory, { recursive: true, force: true }); }
}
