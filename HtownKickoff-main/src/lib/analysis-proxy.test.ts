import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { analysisProxyArgs } from './analysis-proxy';

test('actual FFmpeg proxy reduces a high-bitrate source and keeps its six-second timeline', async () => {
  assert.ok(ffmpeg);
  const dir = await mkdtemp(join(tmpdir(), 'analysis-proxy-test-'));
  try {
    const source = join(dir, 'source.mp4'), proxy = join(dir, 'proxy.mp4');
    const created = spawnSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-t', '6', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '0', source], { windowsHide: true, encoding: 'utf8' });
    assert.equal(created.status, 0, created.stderr);
    const converted = spawnSync(ffmpeg, analysisProxyArgs(source, proxy), { windowsHide: true, encoding: 'utf8' });
    assert.equal(converted.status, 0, converted.stderr);
    assert.ok((await stat(proxy)).size < (await stat(source)).size * 0.9);
    const inspected = spawnSync(ffmpeg, ['-i', proxy, '-f', 'null', '-'], { windowsHide: true, encoding: 'utf8' });
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.match(inspected.stderr, /Duration: 00:00:06\.00/);
    assert.match(inspected.stderr, /960x540/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
