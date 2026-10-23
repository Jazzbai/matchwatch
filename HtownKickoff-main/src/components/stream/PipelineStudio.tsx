'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle, Play, RotateCcw, Workflow } from 'lucide-react';
import { highlightFetch } from '../../lib/highlight-session';
import { highlightResponse } from '../../lib/highlight-request';
import { pipelineSteps, type PipelineInput, type PipelineJob, type StepNumber } from '../../lib/pipeline-types';
import type { FusionInputs } from '../../lib/event-fusion';
import type { HighlightPriority } from '../../lib/highlight-preferences';
import type { ScorePlayVideo } from './ScorePlaySource';
import styles from './HighlightStudio.module.css';
import KeyMomentsHandoff from './KeyMomentsHandoff';

const endpoint = `${process.env.NEXT_PUBLIC_APP_BASE_PATH || ''}/api/stream/pipeline`;
type Props = { file: File | null; scorePlay: ScorePlayVideo | null; duration: number; sport: 'Soccer' | 'Basketball'; target: number; queries: string; before: number; after: number; scoringPriority: HighlightPriority; getEvidence: () => FusionInputs; disabled: boolean };
const labels = { pending: 'Waiting', working: 'Working', ready: 'Ready', error: 'Error', stale: 'Needs rerun' };
export default function PipelineStudio(props: Props) {
  const [job, setJob] = useState<PipelineJob | null>(null), [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [paused, setPaused] = useState(false);
  const [live, setLive] = useState(false), [hlsUrl, setHlsUrl] = useState(''), [capture, setCapture] = useState(60), [match, setMatch] = useState('');
  const control = useRef<AbortController | null>(null);
  useEffect(() => () => control.current?.abort(), []);
  async function request(init: RequestInit) {
    const response = await highlightResponse(await highlightFetch(endpoint, { ...init, signal: AbortSignal.any([control.current?.signal || new AbortController().signal, AbortSignal.timeout(300000)]) }));
    return response.json();
  }
  async function advance(current: PipelineJob, only?: StepNumber, rerun = false) {
    let next = current;
    for (const state of next.steps) {
      if (only && state.step !== only || !only && state.state === 'ready') continue;
      let first = true;
      do {
        const form = state.step === 1 && props.file ? new FormData() : null;
        if (form) { form.set('jobId', next.id); form.set('video', props.file!); }
        const data = await request(form ? { method: 'POST', body: form } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: next.id, step: state.step, rerun: first && rerun }) });
        next = data.job; setJob(next); first = false;
        const result = next.steps[state.step - 1];
        if (result.state === 'error') throw new Error(result.message);
        if (result.state !== 'working') break;
        await new Promise<void>((resolve, reject) => {
          const signal = control.current!.signal;
          const cancel = () => { clearTimeout(timer); reject(new DOMException('Paused', 'AbortError')); };
          const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 3000);
          signal.addEventListener('abort', cancel, { once: true });
          if (signal.aborted) cancel();
        });
      } while (!control.current?.signal.aborted);
    }
  }
  async function perform(action: () => Promise<void>) {
    control.current?.abort(); const abort = new AbortController(); control.current = abort; setBusy(true); setPaused(false); setError('');
    try { await action(); } catch (e) { if (abort.signal.aborted) setPaused(true); else setError((e as Error).message); }
    finally { if (control.current === abort) setBusy(false); }
  }
  async function start() {
    await perform(async () => {
      setJob(null);
      const evidence = props.getEvidence(), name = live ? 'Live organizer feed' : props.scorePlay?.name || props.file?.name || '';
      const title = match.trim() || name;
      const input: PipelineInput = { matchId: match.trim() || crypto.randomUUID(), title, sport: props.sport, duration: live ? 0 : props.duration, target: props.target, queries: props.queries.split(/\r?\n/).map(q => q.trim()).filter(Boolean), before: props.before, after: props.after, scoringPriority: props.scoringPriority,
        source: live ? { kind: 'hls', name, hlsUrl: hlsUrl.trim() || undefined, captureSeconds: capture } : props.scorePlay ? { kind: 'scoreplay', name, mediaId: props.scorePlay.mediaId } : { kind: 'upload', name }, fusion: { ...evidence, matchId: match.trim() || evidence.matchId } };
      // Keep imported evidence tied to its existing match; the title is free-form.
      input.matchId = evidence.matchId !== 'video-only' ? evidence.matchId : input.matchId; input.fusion.matchId = input.matchId;
      const form = new FormData(); form.set('input', JSON.stringify(input)); if (!live && props.file) form.set('video', props.file);
      const { job: created } = await request({ method: 'POST', body: form }); setJob(created);
      localStorage.setItem('matchwatch-pipeline-job', created.id);
      if (created.steps[0].state === 'error') throw new Error(created.steps[0].message);
      await advance(created);
    });
  }
  async function loadJobs() { await perform(async () => { const data = await request({ method: 'GET' }); setJobs(data.jobs); }); }
  async function download(step: StepNumber) {
    await perform(async () => {
      const response = await highlightResponse(await highlightFetch(`${endpoint}?jobId=${job!.id}&step=${step}`, { signal: control.current!.signal }));
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a'); link.href = url; link.download = `matchwatch-${job!.id}-step-${step}${step === 7 ? '-DRAFT' : ''}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  return <section className={styles.pipelineCard} aria-label="Seven-step editor pipeline">
    <div className={styles.heading}><Workflow size={23} /><div><h2>Build a story for your editor</h2><p>Save each step, then hand the selected moments to your team.</p></div></div>
    <p className={styles.hint}>Uses your sport, length, moment descriptions, padding and scoring preferences above. Your existing MP4 creator remains available.</p>
    <div className={styles.row}><label>Match name or reference<input value={match} maxLength={100} disabled={busy} onChange={e => setMatch(e.target.value)} placeholder="Tottenham vs Man United, or Spurs playoff game" /></label><label className={styles.checkLabel}><input type="checkbox" checked={live} disabled={busy} onChange={e => setLive(e.target.checked)} /> Use the organizer’s live HLS feed</label></div>
    {live && <div className={styles.row}><label>Live feed URL<input type="url" value={hlsUrl} maxLength={4096} disabled={busy} onChange={e => setHlsUrl(e.target.value)} placeholder="Use the server’s feed, or enter an HTTPS .m3u8 URL" /><small>Feed credentials stay on the server when HIGHLIGHTS_HLS_URL is configured.</small></label><label>Available live window<select value={capture} disabled={busy} onChange={e => setCapture(Number(e.target.value))}>{[30,60,90,120].map(n => <option key={n} value={n}>Up to {n} seconds</option>)}</select><small>Captures the current playlist, rather than waiting for future footage.</small></label></div>}
    <div className={styles.pipelineActions}><button type="button" className={styles.primary} disabled={props.disabled || busy || !live && (!props.file && !props.scorePlay || !props.duration)} onClick={() => void start()}>{busy ? <LoaderCircle size={17} className={styles.spinner} /> : <Play size={17} />} Build editor story</button><button type="button" className={styles.secondary} disabled={busy || props.disabled} onClick={() => void loadJobs()}>Open saved jobs</button>{busy && <button type="button" className={styles.secondary} onClick={() => control.current?.abort()}>Pause</button>}</div>
    {!!jobs.length && <label>Saved jobs<select value={job?.id || ''} disabled={busy} onChange={e => { setJob(jobs.find(job => job.id === e.target.value) || null); setError(''); }}><option value="">Choose a saved job</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title} · {new Date(job.createdAt).toLocaleString()}</option>)}</select></label>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {paused && <p className={styles.notice}>Paused. Saved outputs and provider tasks are kept; resume to continue.</p>}
    <ol className={styles.pipelineSteps} aria-label="Pipeline progress" aria-live="polite">{pipelineSteps.map((name, index) => {
      const step = job?.steps[index], state = step?.state || (busy && !job && index === 0 ? 'working' : 'pending'), eligible = !!job && (index === 0 || job.steps[index - 1].state === 'ready');
      return <li key={name} data-state={state}><span className={styles.pipelineNumber}>{index + 1}</span><div><strong>{name}</strong><small>{step?.message || (index ? 'Waiting for the previous step.' : 'Choose a source, then build your story.')}</small></div><span className={styles.pipelineState}>{labels[state]}</span>{job && <div className={styles.pipelineActions}><button className={styles.textButton} disabled={busy || !eligible} onClick={() => void perform(() => advance(job, index + 1 as StepNumber, state === 'ready'))}><RotateCcw size={13} />{state === 'ready' ? 'Rerun' : 'Run'}</button>{state === 'ready' && <button className={styles.textButton} disabled={busy} onClick={() => void download(index + 1 as StepNumber)}><Download size={13} />{index === 6 ? 'Draft JSON' : 'JSON'}</button>}</div>}</li>;
    })}</ol>
    {job && !busy && job.steps.some(step => step.state !== 'ready') && <button className={styles.secondary} onClick={() => void perform(() => advance(job))}>Resume saved pipeline</button>}
    {job && !busy && job.steps.every(step => step.state === 'ready') && <KeyMomentsHandoff key={`${job.id}-${job.steps[6].revision}`} job={job} />}
    <p className={styles.hint}>The chart’s steps 8–10 show ranking, automatic selection and the final key moments handoff below. The saved story draft remains available separately. Editing, rights review and rendering follow the handoff.</p>
  </section>;
}
