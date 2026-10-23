import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipelineSteps, type Artifact, type PipelineInput, type PipelineJob, type StepNumber } from './pipeline-types';

export class PipelineError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const validId = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
export class PipelineStore {
  constructor(private root = process.env.HIGHLIGHTS_DATA_DIR || join(process.cwd(), '.data', 'highlight-pipeline')) {}
  private folder(owner: string, id: string) {
    if (!validId(id)) throw new PipelineError('Invalid pipeline job ID.');
    return join(resolve(this.root), createHash('sha256').update(owner).digest('hex'), id);
  }
  private async read<T>(owner: string, id: string, name: string): Promise<T> {
    try { return JSON.parse(await readFile(join(this.folder(owner, id), name), 'utf8')) as T; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new PipelineError('This job or its required output is unavailable. Run the previous step first.', 404); throw error; }
  }
  async write(owner: string, id: string, name: string, data: unknown) {
    if (!/^(job|input|checkpoint-[1-7]|step-[1-7])\.json$/.test(name)) throw new PipelineError('Invalid artifact name.');
    const folder = this.folder(owner, id), temp = join(folder, `${name}.${randomUUID()}.tmp`);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const file = await open(temp, 'wx', 0o600);
    try {
      try { await file.writeFile(JSON.stringify(data, null, 2)); await file.sync(); } finally { await file.close(); }
      await rename(temp, join(folder, name));
    } finally { await rm(temp, { force: true }); }
  }
  async create(owner: string, input: PipelineInput) {
    const id = randomUUID(), now = new Date().toISOString();
    const job: PipelineJob = { id, title: input.title, createdAt: now, updatedAt: now, steps: pipelineSteps.map((name, index) => ({ step: index + 1 as StepNumber, name, state: 'pending', revision: 0, message: index ? 'Waiting for the previous step.' : 'Ready to connect the source.', updatedAt: now })) };
    await this.write(owner, id, 'input.json', input); await this.save(owner, job); return job;
  }
  input(owner: string, id: string) { return this.read<PipelineInput>(owner, id, 'input.json'); }
  async job(owner: string, id: string) {
    const job = await this.read<PipelineJob>(owner, id, 'job.json');
    // A closed tab or crashed process must never leave an unbounded spinner.
    for (const step of job.steps) if (step.state === 'working' && Date.now() - Date.parse(step.updatedAt) > 20 * 60000) {
      step.state = 'error'; step.message = 'This step stopped responding. Retry to resume its saved checkpoint.';
    }
    return job;
  }
  save(owner: string, job: PipelineJob) { job.updatedAt = new Date().toISOString(); return this.write(owner, job.id, 'job.json', job); }
  artifact<T>(owner: string, id: string, step: StepNumber) { return this.read<Artifact<T>>(owner, id, `step-${step}.json`); }
  async checkpoint<T>(owner: string, id: string, step: StepNumber): Promise<T | null> {
    try { return await this.read<T>(owner, id, `checkpoint-${step}.json`); } catch (e) { if (e instanceof PipelineError && e.status === 404) return null; throw e; }
  }
  async invalidate(owner: string, job: PipelineJob, step: StepNumber) {
    for (const item of job.steps.filter(item => item.step > step)) {
      item.state = item.revision ? 'stale' : 'pending'; item.message = 'Run this step again after its updated input is ready.';
      await rm(join(this.folder(owner, job.id), `checkpoint-${item.step}.json`), { force: true });
    }
  }
  async locked<T>(owner: string, id: string, action: () => Promise<T>): Promise<T> {
    await this.job(owner, id);
    const path = join(this.folder(owner, id), '.lock');
    let file;
    try { file = await open(path, 'wx', 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const age = Date.now() - (await stat(path)).mtimeMs;
      if (age > 20 * 60000) { await rm(path, { force: true }); return this.locked(owner, id, action); }
      throw new PipelineError('This job is already processing a step. Wait for it to finish.', 409);
    }
    try { return await action(); } finally { await file.close(); await rm(path, { force: true }); }
  }
  async list(owner: string) {
    const folder = join(resolve(this.root), createHash('sha256').update(owner).digest('hex'));
    const entries = await readdir(folder).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return []; throw e; });
    const results = await Promise.all(entries.filter(validId).slice(-100).map(id => this.job(owner, id).catch(() => null)));
    return results.filter((job): job is PipelineJob => !!job).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
