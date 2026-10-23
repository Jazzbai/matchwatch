import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** All local footage, proxies, segments and rendered outputs share this one root. */
export const processingTempRoot = () => process.env.HIGHLIGHTS_TEMP_DIR || join(tmpdir(), 'matchwatch-processing');
export async function createProcessingTemp() {
  const root = processingTempRoot(); await mkdir(root, { recursive: true, mode: 0o700 });
  return mkdtemp(join(root, 'job-'));
}
export async function withProcessingTemp<T>(work: (folder: string) => Promise<T>): Promise<T> {
  const folder = await createProcessingTemp();
  try { return await work(folder); } finally { await rm(folder, { recursive: true, force: true }); }
}
