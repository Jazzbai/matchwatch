'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- These links leave the isolated /app service for the main site. */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, LoaderCircle, Play, Sparkles } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { scoringPresets } from '../../lib/highlights/catalog';
import {
  advanceJob, createJob, downloadJson, fetchJob, fetchStatus, renderJob, rescoreJob,
  type JobView, type ServiceStatus, type SourceChoice,
} from '../../lib/highlights/client';
import type { KeyMomentsOutput } from '../../lib/highlights/output';
import type { Job } from '../../lib/highlights/types';
import MatchContext, { emptyMatchForm, toMatchInput, type MatchForm } from './highlights/MatchContext';
import PipelineProgress from './highlights/PipelineProgress';
import PreferencesCard, { defaultPreferenceForm, toPreferences, type PreferenceForm } from './highlights/PreferencesCard';
import Results from './highlights/Results';
import SourcePicker from './highlights/SourcePicker';
import VideoPlayer, { type VideoPlayerHandle } from './highlights/VideoPlayer';
import styles from './HighlightStudio.module.css';

const phases = ['Choose a match video', 'Find & rank moments', 'Key moments & video'];
const POLL_MS = 3000;
const LAST_JOB_KEY = 'matchwatch-highlight-job';

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Paused', 'AbortError')); }, { once: true });
});
const sourceKey = (choice: SourceChoice | null) => !choice ? '' : choice.kind === 'library' ? choice.video.ticket.split('.')[0] : choice.kind === 'upload' ? `${choice.file.name}:${choice.file.size}` : `hls:${choice.url}`;
const storage = {
  get: () => { try { return localStorage.getItem(LAST_JOB_KEY); } catch { return null; } },
  set: (id: string) => { try { localStorage.setItem(LAST_JOB_KEY, id); } catch { /* Private mode: nothing to restore later. */ } },
};

export default function HighlightStudio() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<ServiceStatus | null>(null), [statusError, setStatusError] = useState('');
  const [choice, setChoice] = useState<SourceChoice | null>(null), [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [matchForm, setMatchForm] = useState<MatchForm>(emptyMatchForm);
  const [preferences, setPreferences] = useState<PreferenceForm>(() => defaultPreferenceForm());
  const [job, setJob] = useState<Job | null>(null), [view, setView] = useState<JobView | null>(null);
  const [analysisKey, setAnalysisKey] = useState('');
  const [running, setRunning] = useState(false), [progress, setProgress] = useState('');
  const [rendering, setRendering] = useState(false), [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const player = useRef<VideoPlayerHandle>(null);

  const signedOut = !!status?.requiresLogin && !isAuthenticated;
  const finished = !!job && job.steps.every(step => step.state === 'ready');
  const currentKey = JSON.stringify([sourceKey(choice), matchForm, preferences.sport, preferences.types]);
  const canRescore = finished && analysisKey === currentKey;

  useEffect(() => {
    const abort = new AbortController();
    fetchStatus(abort.signal).then(setStatus).catch(() => { if (!abort.signal.aborted) setStatusError('Could not reach the highlight service. Refresh to retry.'); });
    return () => { abort.abort(); controller.current?.abort(); };
  }, []);
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => {
    if (choice?.kind !== 'upload') { setPreviewUrl(choice?.kind === 'library' ? choice.video.playbackUrl : null); return; }
    const url = URL.createObjectURL(choice.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [choice]);

  /** Advances the job until every step is done, polling while TwelveLabs works. */
  const follow = useCallback(async (jobId: string, abort: AbortController) => {
    for (;;) {
      const next = await advanceJob(jobId, abort.signal);
      setJob(next);
      const failed = next.steps.find(step => step.state === 'error');
      if (failed) throw new Error(`Step ${failed.step} · ${failed.name}: ${failed.message}`);
      if (next.steps.every(step => step.state === 'ready')) {
        setView(await fetchJob(jobId, abort.signal));
        return;
      }
      setProgress(next.steps.find(step => step.state !== 'ready')?.message || 'Working…');
      await wait(POLL_MS, abort.signal);
    }
  }, []);

  const execute = useCallback(async (work: (abort: AbortController) => Promise<void>) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setError('');
    try { await work(abort); }
    catch (failure) { if (!abort.signal.aborted) setError((failure as Error).message); }
    finally { if (controller.current === abort) { setRunning(false); setProgress(''); } }
  }, []);

  // Reopen the most recent analysis after a reload.
  useEffect(() => {
    if (!status || signedOut) return;
    const last = storage.get();
    if (!last) return;
    fetchJob(last).then(restored => {
      setJob(restored.job);
      if (restored.output) setView(restored);
    }).catch(() => { /* The saved job may have been removed; start fresh. */ });
  }, [status, signedOut]);

  async function start() {
    if (!choice) return;
    setVideoUrl('');
    if (canRescore && job) {
      await execute(async () => {
        setProgress('Re-scoring the saved analysis with your new preferences…');
        setJob(await rescoreJob(job.id, toPreferences(preferences)));
        setView(await fetchJob(job.id));
      });
      return;
    }
    setView(null);
    setJob(null);
    await execute(async abort => {
      setProgress(choice.kind === 'upload' ? 'Uploading your video · 0%' : 'Starting the analysis…');
      const fallbackTitle = choice.kind === 'library' ? choice.video.name : choice.kind === 'upload' ? choice.file.name : 'Live feed';
      const created = await createJob(choice, toMatchInput(matchForm, fallbackTitle), toPreferences(preferences), abort.signal,
        percent => setProgress(percent < 100 ? `Uploading your video · ${percent}%` : 'Sending your video to TwelveLabs…'));
      setJob(created);
      setAnalysisKey(currentKey);
      storage.set(created.id);
      await follow(created.id, abort);
    });
  }

  async function createVideo() {
    if (!job) return;
    setRendering(true);
    setError('');
    try { setVideoUrl(await renderJob(job.id)); }
    catch (failure) { setError((failure as Error).message); }
    finally { setRendering(false); }
  }

  const activePhase = view?.output ? 2 : job || running ? 1 : 0;
  const presetName = scoringPresets.find(item => item.id === preferences.preset)!.name;
  const playbackUrl = previewUrl ?? view?.source?.playbackUrl ?? null;
  const hint = statusError || (!status ? 'Connecting to the highlight service…'
    : signedOut ? 'Sign in above to start.'
    : !status.analysisReady ? 'Video analysis is not configured on this server (TwelveLabs).'
    : !choice ? 'Choose a match video to get started.'
    : !preferences.types.length ? 'Choose at least one moment type in customization.'
    : canRescore ? 'Your analysis is saved. Updating only re-ranks it, with no new video processing.'
    : 'We’ll analyze the video, rank every moment and select the best automatically.');

  return <main className={styles.app}>
    <header className={styles.nav}>
      <Link href="/stream" className={styles.brand}><span className={styles.brandMark}><Play size={17} fill="currentColor" /></span>MATCHWATCH <span className={styles.brandProduct}>Studio</span></Link>
      <nav><a href="/">Back to MatchWatch <ArrowRight size={14} /></a></nav>
      <span className={styles.local}><span /> Trend-aware highlights</span>
    </header>
    <div className={styles.shell}>
      <div className={styles.hero}>
        <div><p className={styles.eyebrow}>YOUR GAME. THE MOMENTS FANS TALK ABOUT.</p><h1>Big moments.<br /><em>Ranked by what fans feel.</em></h1><p>We combine the match video, official events and fan reactions on X<br />to find, rank and select the moments most likely to go viral.</p></div>
        <div className={styles.heroNote}><Sparkles size={22} /><div><strong>No editor required.</strong><p>Every score shows its evidence. Viral potential is an estimate, not a guarantee of views.</p></div></div>
      </div>

      <ol className={styles.steps} aria-label="Your highlight progress">{phases.map((phase, index) =>
        <li key={phase} className={index === activePhase ? styles.stepActive : index < activePhase ? styles.stepDone : ''} aria-current={index === activePhase ? 'step' : undefined}>
          <span>{index < activePhase ? <Check size={16} /> : index + 1}</span><strong>{phase}</strong>{index < 2 && <ChevronDown size={14} />}
        </li>)}
      </ol>

      {error && <div className={styles.error} role="alert"><strong>We couldn’t complete that step</strong><p>{error}</p><button type="button" className={styles.textButton} onClick={() => setError('')}>Dismiss</button></div>}
      {signedOut && <div className={styles.signIn}><div><strong>{authLoading ? 'Checking your account…' : 'Sign in to create highlights'}</strong><p>Browse the options, then sign in when you’re ready to start.</p></div><a className={styles.secondary} href="/login?next=%2Fapp">Sign in <ArrowRight size={16} /></a></div>}
      {running && <div className={styles.processing} role="status"><LoaderCircle size={24} className={styles.spinner} /><div><strong>{job?.steps[3].state === 'working' ? 'Watching the match with TwelveLabs' : 'Working on your highlight'}</strong><p>{progress}</p></div></div>}

      <div className={styles.columns}>
        <div className={styles.setup}>
          <SourcePicker choice={choice} onChoose={next => { setChoice(next); setVideoUrl(''); }} disabled={running} canBrowse={!!status?.analysisReady && !signedOut} />
          <VideoPlayer ref={player} src={playbackUrl} onError={setError} />
          <MatchContext form={matchForm} onChange={setMatchForm} sport={preferences.sport} disabled={running} socialReady={!!status?.socialReady} isUpload={choice?.kind === 'upload'} />
          <PreferencesCard form={preferences} onChange={setPreferences} disabled={running}>
            <button type="button" className={styles.primary} disabled={!choice || running || signedOut || !status?.analysisReady || !preferences.types.length} onClick={() => void start()}>
              {running ? <LoaderCircle size={18} className={styles.spinner} /> : <Sparkles size={18} />}
              {running ? 'Finding the best moments…' : canRescore ? 'Update the ranking' : 'Find the best moments'}
              {!running && <ArrowRight size={18} />}
            </button>
            <p className={styles.actionHint}>{hint}</p>
          </PreferencesCard>
        </div>
        <aside className={styles.sideColumn}>
          <PipelineProgress job={job} running={running}
            onPause={() => controller.current?.abort()}
            onResume={() => { if (job) void execute(abort => follow(job.id, abort)); }} />
          <p className={styles.sidebarNote}><Sparkles size={15} /> Missing data is never invented: unavailable signals are left out and the remaining weights are renormalized.</p>
        </aside>
      </div>

      {view?.output && <Results view={view as JobView & { output: KeyMomentsOutput }} presetName={presetName} renderReady={!!status?.renderReady}
        rendering={rendering} videoUrl={videoUrl} onSeek={seconds => player.current?.seek(seconds)} onRender={() => void createVideo()}
        onDownload={() => downloadJson(view.output, `matchwatch-${view.job.id}-key-moments.json`)} />}

      <footer className={styles.footer}>MATCHWATCH HIGHLIGHT STUDIO <span>Video understanding by TwelveLabs · trend signals from X · your rules.</span></footer>
    </div>
  </main>;
}
