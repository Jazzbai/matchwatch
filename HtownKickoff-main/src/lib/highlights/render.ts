import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mediaDuration, runFfmpeg } from './media';
import { PipelineError } from './store';

// Optional next step after diagram step 10: assemble the selected moments, in
// chronological order, into one 720p MP4 straight from the provider's HLS stream.

export type RenderClip = { start: number; end: number };

const MAX_TOTAL_SECONDS = 300;

export async function renderHighlight(playbackUrl: string, clips: RenderClip[], folder: string, signal?: AbortSignal) {
  if (!/^https:\/\//.test(playbackUrl)) throw new PipelineError('This video has no playable stream to render from.', 409);
  if (!clips.length || clips.length > 20 || clips.reduce((sum, clip) => sum + clip.end - clip.start, 0) > MAX_TOTAL_SECONDS + 0.01) {
    throw new PipelineError('Select 1–20 clips totaling at most five minutes.');
  }
  const list: string[] = [];
  for (const [index, clip] of clips.entries()) {
    const name = `clip-${index}.mp4`;
    // Normalize every clip so they concatenate without re-encoding.
    const args = [
      '-nostdin', '-y', '-protocol_whitelist', 'https,tls,tcp,crypto,hls,http,file',
      '-reconnect', '1', '-reconnect_on_network_error', '1', '-reconnect_delay_max', '4',
      '-ss', clip.start.toFixed(2), '-i', playbackUrl, '-t', (clip.end - clip.start).toFixed(2),
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1',
      '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2',
      join(folder, name),
    ];
    // A dropped CDN connection can end a clip early with a successful exit, so verify its length.
    const expected = clip.end - clip.start;
    await withRetries(async () => {
      await runFfmpeg(args, 180_000, signal);
      const actual = await mediaDuration(join(folder, name), signal);
      if (actual < expected - 0.5) throw new PipelineError(`Clip ${index + 1} was cut short (${actual.toFixed(1)} of ${expected.toFixed(1)} s).`, 502);
    }, signal);
    list.push(`file '${name}'`);
  }
  await writeFile(join(folder, 'clips.txt'), list.join('\n'));
  const output = join(folder, 'highlight.mp4');
  await runFfmpeg(['-nostdin', '-y', '-f', 'concat', '-safe', '1', '-i', join(folder, 'clips.txt'), '-c', 'copy', '-movflags', '+faststart', output], 60_000, signal);
  return readFile(output);
}

/** CDN connections are occasionally reset while opening the stream; retry the cut, not the job. */
async function withRetries(work: () => Promise<void>, signal?: AbortSignal, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= attempts || signal?.aborted || (error instanceof PipelineError && error.status !== 502)) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
