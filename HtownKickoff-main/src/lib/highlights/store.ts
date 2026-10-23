import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipelineSteps, type Job } from './types';

// File-backed job storage: one private folder per account and job, atomic JSON
// writes, and a lock file so two requests never advance the same job at once.

export class PipelineError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const STALE_MS = 20 * 60_000;
const isJobId = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
const isFileName = (name: string) => /^(job|input|understanding|step-(10|[1-9]))\.json$/.test(name);

export class JobStore {
  constructor(private root = join(process.env.HIGHLIGHTS_DATA_DIR || join(process.cwd(), '.data', 'highlight-pipeline'), 'trend-aware-v1')) {}

  private ownerFolder(owner: string) {
    return join(resolve(this.root), createHash('sha256').update(owner).digest('hex'));
  }

  private folder(owner: string, id: string) {
    if (!isJobId(id)) throw new PipelineError('Invalid job ID.');
    return join(this.ownerFolder(owner), id);
  }

  async create(owner: string, title: string, input: unknown): Promise<Job> {
    const now = new Date().toISOString();
    const job: Job = {
      id: randomUUID(), title, createdAt: now, updatedAt: now,
      steps: pipelineSteps.map((name, index) => ({ step: index + 1, name, state: 'pending', message: 'Waiting.', updatedAt: now })),
    };
    await this.write(owner, job.id, 'input.json', input);
    await this.save(owner, job);
    return job;
  }

  async read<T>(owner: string, id: string, name: string): Promise<T> {
    if (!isFileName(name)) throw new PipelineError('Invalid output name.');
    try {
      return JSON.parse(await readFile(join(this.folder(owner, id), name), 'utf8')) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new PipelineError('This job or its output is not available.', 404);
      throw error;
    }
  }

  async readOptional<T>(owner: string, id: string, name: string): Promise<T | null> {
    try { return await this.read<T>(owner, id, name); }
    catch (error) { if (error instanceof PipelineError && error.status === 404) return null; throw error; }
  }

  async write(owner: string, id: string, name: string, data: unknown) {
    if (!isFileName(name)) throw new PipelineError('Invalid output name.');
    const folder = this.folder(owner, id), temp = join(folder, `${name}.${randomUUID()}.tmp`);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const file = await open(temp, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(data, null, 2));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temp, join(folder, name));
  }

  async job(owner: string, id: string) {
    const job = await this.read<Job>(owner, id, 'job.json');
    if (!Array.isArray(job.steps) || job.steps.length !== 10) throw new PipelineError('This saved job uses an older pipeline. Start a new analysis.', 409);
    // A closed tab or crashed process must never leave a step spinning forever.
    for (const step of job.steps) {
      if (step.state === 'working' && Date.now() - Date.parse(step.updatedAt) > STALE_MS) {
        step.state = 'error';
        step.message = 'This step stopped responding. Resume to continue from its saved progress.';
      }
    }
    return job;
  }

  save(owner: string, job: Job) {
    job.updatedAt = new Date().toISOString();
    return this.write(owner, job.id, 'job.json', job);
  }

  async list(owner: string) {
    const entries = await readdir(this.ownerFolder(owner)).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    const jobs = await Promise.all(entries.filter(isJobId).map(id => this.job(owner, id).catch(() => null)));
    return jobs.filter((job): job is Job => !!job).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  }

  async locked<T>(owner: string, id: string, action: () => Promise<T>): Promise<T> {
    await this.job(owner, id);
    const path = join(this.folder(owner, id), '.lock');
    let lock;
    try {
      lock = await open(path, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (Date.now() - (await stat(path)).mtimeMs > STALE_MS) {
        await rm(path, { force: true });
        return this.locked(owner, id, action);
      }
      throw new PipelineError('This job is already being processed. Wait a moment and retry.', 409);
    }
    try {
      return await action();
    } finally {
      await lock.close();
      await rm(path, { force: true });
    }
  }
}
