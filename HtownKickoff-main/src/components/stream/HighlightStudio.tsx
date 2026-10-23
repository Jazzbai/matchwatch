'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- These links leave the isolated /app service for the existing main site. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Film, Scissors, Sparkles, Upload, Download, Trash2, Play, ChevronDown, LoaderCircle, Settings2, Library, CircleCheck } from 'lucide-react';
import { eventScore, type HighlightEvent } from '../../lib/highlight-plan';
import styles from './HighlightStudio.module.css';
import ScorePlaySource, { type ScorePlayVideo } from './ScorePlaySource';
import RollingScoreboard from './RollingScoreboard';
import EventFusionStudio from './EventFusionStudio';
import PipelineStudio from './PipelineStudio';
import { highlightPriorities, priorityWeights, type HighlightPriority } from '../../lib/highlight-preferences';
import { fuseEvents, type FusionInputs } from '../../lib/event-fusion';
import { applyReviewedChunk, candidateChunks, emptyRollingState } from '../../lib/rolling-highlights';
import { highlightAuthorization, highlightFetch } from '../../lib/highlight-session';
import { useAuth } from '../../lib/auth-context';
import { reviewInput, reviewWindow, validateJevReviews } from '../../lib/jev';
import { highlightResponse, uploadHighlight } from '../../lib/highlight-request';
import { optimizeHighlights, reviewShortlist } from '../../lib/highlight-optimizer';

const endpoint = `${process.env.NEXT_PUBLIC_APP_BASE_PATH || ''}/api/stream/highlights`;
async function request(form: FormData, signal?: AbortSignal) {
  return highlightResponse(await highlightFetch(endpoint, { method: 'POST', body: form, signal }));
}
async function compareWithJev(asset: string, events: Event[], duration: number, signal: AbortSignal, status: (text: string) => void): Promise<Event[]> {
  const candidates = reviewInput(events, duration);
  if (candidates.length > 1 && Math.max(...candidates.map(c => c.end)) - Math.min(...candidates.map(c => c.start)) > 7100) {
    const ordered = [...events].sort((a, b) => a.start - b.start);
    const middle = ordered.findIndex((event, index) => index > 0 && event.end - ordered[0].start > 7100);
    return [...await compareWithJev(asset, ordered.slice(0, middle), duration, signal, status), ...await compareWithJev(asset, ordered.slice(middle), duration, signal, status)];
  }
  reviewWindow(candidates, duration);
  status(`Jev is comparing ${candidates.length} moments against the video evidence…`);
  const form = new FormData(); form.set('action', 'review'); form.set('assetId', asset); form.set('duration', String(duration)); form.set('candidates', JSON.stringify(candidates));
  const { reviewId } = await (await request(form, signal)).json();
  if (!reviewId) throw new Error('Jev did not return a review task.');
  for (let i = 0; i < 180; i++) {
    const response = await highlightResponse(await highlightFetch(`${endpoint}?reviewId=${encodeURIComponent(reviewId)}`, { signal, cache: 'no-store' }));
    const data = await response.json();
    if (data.error || ['failed', 'canceled'].includes(data.status)) throw new Error(data.error || 'AI comparison failed. No automatic reel was created; inspect the candidates or turn AI comparison off.');
    if (data.status === 'ready') {
      const reviews = validateJevReviews(data.reviews, candidates, duration);
      return events.map(event => ({ ...event, viral: undefined, jev: reviews.find(r => r.candidate_id === event.id), reviewOverride: false }));
    }
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 5000);
      signal.addEventListener('abort', cancel, { once: true });
    });
  }
  throw new Error('AI comparison exceeded 15 minutes. Inspect the candidates or try a shorter recording.');
}

type Event = HighlightEvent & { providerConfidence?: string };
const clock = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
const defaults = { Soccer: 'Goal scored\nShot on target\nFoul or penalty\nCrowd celebration', Basketball: 'Dunk\nThree-point shot\nAssist or block\nCrowd celebration' };
const steps = ['Choose a video', 'Create your highlight', 'Preview & download'];
export default function HighlightStudio() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState(''), [duration, setDuration] = useState(0);
  const [scorePlay, setScorePlay] = useState<ScorePlayVideo | null>(null);
  const [rolling, setRolling] = useState(emptyRollingState);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [sport, setSport] = useState<'Soccer' | 'Basketball'>('Basketball'), [queries, setQueries] = useState(defaults.Basketball);
  const [scoringPriority, setScoringPriority] = useState<HighlightPriority>('balanced');
  const scoringWeights = useMemo(() => priorityWeights(scoringPriority), [scoringPriority]);
  const momentQueries = queries.split(/\r?\n/).map(query => query.trim()).filter(Boolean);
  const validMoments = momentQueries.length > 0 && momentQueries.length <= 8;
  const [events, setEvents] = useState<Event[]>([]), [excluded, setExcluded] = useState<string[]>([]);
  const [assetTicket, setAssetTicket] = useState('');
  const [target, setTarget] = useState(60), [before, setBefore] = useState(5), [after, setAfter] = useState(10);
  const [label, setLabel] = useState('Dunk'), [start, setStart] = useState(0), [end, setEnd] = useState(10);
  const [autoStart, setAutoStart] = useState(false), [autoExport, setAutoExport] = useState(true);
  const fusionContext = useRef<FusionInputs>({ matchId: 'video-only', stats: [], posts: [], anchors: [], videoUtc: '', reactionDelay: 15, tolerance: 10 });
  const [autoCompare, setAutoCompare] = useState(true), [compress, setCompress] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [sourceMode, setSourceMode] = useState<'library' | 'upload'>('library');
  const [dragging, setDragging] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  const pendingUpload = useRef(false);
  const sourceResource = useRef({ asset: '', indexed: '', indexedReady: false, analysisDuration: 0 });
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState(''), [output, setOutput] = useState('');
  const [config, setConfig] = useState<{ detectionReady: boolean; exportReady: boolean; requiresLogin?: boolean } | null>(null);
  const [configError, setConfigError] = useState('');
  const player = useRef<HTMLVideoElement>(null), controller = useRef<AbortController | null>(null);
  const checkAvailability = useCallback(async () => {
    setConfigError('');
    try { const response = await fetch(endpoint, { signal: AbortSignal.timeout(12000), cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Video analysis is unavailable.'); setConfig(data); }
    catch { setConfigError('Could not check video analysis. Retry the connection.'); }
  }, []);
  useEffect(() => { void checkAvailability(); return () => controller.current?.abort(); }, [checkAvailability]);
  useEffect(() => { if (!file) return; const source = URL.createObjectURL(file); setUrl(source); return () => URL.revokeObjectURL(source); }, [file]);
  useEffect(() => () => { if (output) URL.revokeObjectURL(output); }, [output]);
  const plan = optimizeHighlights(events.filter(e => !excluded.includes(e.id)), duration, target, before, after);
  const total = plan.reduce((sum, clip) => sum + clip.clipEnd - clip.clipStart, 0);
  function resetOutput() { setOutput(''); }
  function choose(video: File | undefined) {
    if (!video) return;
    if (video.size > 200 * 1024 * 1024) { setError('Choose a video smaller than 200 MB.'); return; }
    setSourceMode('upload');
    setScorePlay(null);
    setSourceRevision(current => current + 1);
    setRolling(emptyRollingState());
    sourceResource.current = { asset: '', indexed: '', indexedReady: false, analysisDuration: 0 };
    controller.current?.abort(); pendingUpload.current = true; setBusy(''); setFile(video); setDuration(0); setEvents([]); setExcluded([]); setAssetTicket(''); setError(''); setMessage('Your video is selected. Choose your preferences, then create your highlight.'); resetOutput();
  }
  function chooseScorePlay(source: ScorePlayVideo) {
    setSourceMode('library');
    setSourceRevision(current => current + 1);
    setRolling(emptyRollingState());
    controller.current?.abort(); sourceResource.current = { asset: source.assetTicket, indexed: source.indexedTicket, indexedReady: true, analysisDuration: source.duration };
    pendingUpload.current = true; setBusy(''); setFile(null); setScorePlay(source); setUrl(source.url); setDuration(source.duration);
    setEvents([]); setExcluded([]); setAssetTicket(''); setError(''); resetOutput();
    setMessage('Your ScorePlay video is selected. Choose your preferences, then create your highlight.');
  }
  const detect = useCallback(async () => {
    if (!file && !scorePlay) return;
    if (!validMoments) { setError('Choose between one and eight moment descriptions.'); return; }
    pendingUpload.current = false;
    setRolling(emptyRollingState());
    const abort = new AbortController(); controller.current = abort; setBusy('Uploading video to MatchWatch · 0%'); setError(''); setMessage(''); resetOutput();
    try {
      let assetId = sourceResource.current.asset;
      if (!assetId) {
        if (scorePlay) {
          throw new Error(`"${scorePlay.name}" has no valid connection to its existing TwelveLabs copy. Refresh the AI mapping and choose it again.`);
        } else if (file) {
        const upload = new FormData(); upload.set('action', 'upload'); upload.set('video', file); upload.set('compress', String(compress));
        const uploaded = await uploadHighlight(endpoint, upload, await highlightAuthorization(), abort.signal, (sent, size) => {
          const percent = Math.min(100, Math.floor(sent / size * 100));
          setBusy(percent === 100 ? (compress ? 'Video sent. Preparing a smaller analysis copy and sending it to TwelveLabs…' : 'Video sent to MatchWatch. Waiting for TwelveLabs to accept it…') : `Uploading video to MatchWatch · ${percent}% · ${(sent / 1048576).toFixed(1)} / ${(size / 1048576).toFixed(1)} MB`);
        });
        const uploadResult = await uploaded.json(); assetId = uploadResult.assetId;
        if (uploadResult.compression?.applied) setMessage(`Analysis copy: ${(uploadResult.compression.originalBytes / 1048576).toFixed(1)} MB → ${(uploadResult.compression.analysisBytes / 1048576).toFixed(1)} MB. The final reel uses your original video.`);
        else if (uploadResult.warning) setMessage(uploadResult.warning);
        sourceResource.current.asset = assetId;
        }
      } else setBusy('Reusing your uploaded video…');
      if (!assetId) throw new Error('TwelveLabs did not return an uploaded asset.');
      setAssetTicket('');
      async function waitUntilReady(parameter: string, id: string, stage: string) {
        for (let i = 0; i < 180; i++) {
          const response = await highlightResponse(await highlightFetch(`${endpoint}?${parameter}=${encodeURIComponent(id)}`, { signal: abort.signal, cache: 'no-store' })); const resource = await response.json();
          if (!response.ok || resource.error) throw new Error(resource.error || `${stage} failed.`);
          if (resource.status === 'ready') return resource;
          if (['failed', 'canceled'].includes(resource.status)) throw new Error(`${stage} failed. Try an H.264 MP4 with a clear video track.`);
          setBusy(`${stage} · ${resource.status || 'processing'}…`);
          await new Promise<void>((resolve, reject) => { const cancel = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }; const timer = setTimeout(() => { abort.signal.removeEventListener('abort', cancel); resolve(); }, 5000); abort.signal.addEventListener('abort', cancel, { once: true }); });
        }
        throw new Error(`${stage} took longer than 15 minutes. Try a shorter video.`);
      }
      await waitUntilReady('assetId', assetId, 'Processing uploaded video');
      setAssetTicket(assetId);
      setBusy('Adding video to your search index…');
      let videoId = sourceResource.current.indexed;
      if (!videoId) {
        const index = new FormData(); index.set('action', 'index'); index.set('assetId', assetId);
        ({ indexedAssetId: videoId } = await (await request(index, abort.signal)).json());
        sourceResource.current.indexed = videoId;
      }
      if (!videoId) throw new Error('TwelveLabs did not return an indexed asset.');
      if (!sourceResource.current.indexedReady) {
        const indexed = await waitUntilReady('indexedAssetId', videoId, 'Indexing video');
        if (Number.isFinite(indexed.duration) && indexed.duration > 0) sourceResource.current.analysisDuration = Math.min(duration, indexed.duration);
        sourceResource.current.indexedReady = true;
      }
      setBusy('Finding candidate events…');
      const search = new FormData(); search.set('action', 'search'); search.set('videoId', videoId); search.set('queries', queries);
      const data = await (await request(search, abort.signal)).json();
      const analysisDuration = sourceResource.current.analysisDuration || duration;
      data.events = data.events.map((event: Event) => ({ ...event, end: Math.min(event.end, analysisDuration) })).filter((event: Event) => event.end > event.start);
      setEvents(data.events); setExcluded([]);
      if (!data.events.length) { setMessage('No matching moments were found. Change the search descriptions or mark a play manually below. No reel was generated.'); return; }
      let compared: Event[] = data.events;
      if (autoCompare) {
        const shortlist = reviewShortlist(data.events, analysisDuration);
        if (!shortlist.length) throw new Error('No valid candidate fits this source video. Mark a moment manually.');
        compared = [];
        let rollingState = emptyRollingState();
        const chunks = candidateChunks(shortlist, analysisDuration);
        for (let index = 0; index < chunks.length; index++) {
          const chunk = chunks[index];
          const reviewed = fuseEvents(await compareWithJev(assetId, chunk.events, analysisDuration, abort.signal, text => setBusy(`Window ${index + 1}/${chunks.length} · ${text}`)), fusionContext.current, scoringWeights);
          compared.push(...reviewed);
          rollingState = applyReviewedChunk(rollingState, { ...chunk, events: reviewed }, { duration, target, before, after });
          setRolling(rollingState);
          setEvents([...compared]); setExcluded([]);
          setMessage(`Reviewed window ${index + 1}/${chunks.length}. The proposal now contains ${rollingState.selected.length} clips; ${rollingState.history.at(-1)!.removed.length} previous choices were replaced. Final production waits for all windows.`);
        }
        setEvents(data.events.map((event: Event) => compared.find(item => item.id === event.id) || event));
        setExcluded(data.events.filter((event: Event) => !compared.some(item => item.id === event.id)).map((event: Event) => event.id));
      }
      compared = fuseEvents(compared, fusionContext.current, scoringWeights);
      setEvents(fuseEvents(data.events.map((event: Event) => compared.find(item => item.id === event.id) || event), fusionContext.current, scoringWeights));
      const selected = optimizeHighlights(compared, duration, target, before, after);
      setMessage(autoCompare ? `Jev compared ${compared.length} distinct moments. The selector keeps the highest combined editorial score within ${target} seconds; weaker choices can be replaced.` : `${data.events.length} candidates found. Selection uses editable scores; AI comparison was not run.`);
      if (autoExport && !scorePlay && config?.exportReady && selected.length) {
        setBusy('Creating your highlight MP4…');
        const form = new FormData(); form.set('action', 'export'); if (file) form.set('video', file);
        form.set('clips', JSON.stringify(selected.map(c => ({ start: c.clipStart, end: c.clipEnd }))));
        const response = await request(form, abort.signal);
        setOutput(URL.createObjectURL(await response.blob()));
        setMessage(`Your highlight MP4 is ready from ${selected.length} selected clips. ${autoCompare ? 'Jev compared the evidence before selection.' : 'AI comparison was not run.'} Preview and download it below.`);
      } else if (!selected.length) setMessage('No verified complete clip fits the target. Inspect uncertain AI reviews, adjust the time budget, or override a reviewed event manually.');
      else if (scorePlay) setMessage(`${selected.length} moments are ready. Analysis reused the organizer’s indexed video. Build an editor story below for the team’s editing, compliance and final-render stages.`);
    } catch (e) { if (!abort.signal.aborted) setError((e as Error).message); }
    finally { if (!abort.signal.aborted) setBusy(''); }
  }, [file, scorePlay, queries, duration, target, before, after, autoExport, autoCompare, compress, config?.exportReady, scoringWeights, validMoments]);
  useEffect(() => {
    if (!pendingUpload.current || !autoStart || !validMoments || (!file && !scorePlay) || !duration || !config?.detectionReady || (config.requiresLogin && !isAuthenticated)) return;
    pendingUpload.current = false;
    void detect();
  }, [autoStart, file, scorePlay, duration, config, isAuthenticated, detect, validMoments]);
  async function reviewWithJev() {
    const abort = new AbortController(); controller.current = abort;
    setError(''); resetOutput();
    try {
      const analysisDuration = sourceResource.current.analysisDuration || duration;
      const candidates = reviewInput(events.filter(e => !excluded.includes(e.id)), analysisDuration);
      reviewWindow(candidates, analysisDuration);
      setBusy('Jev is reviewing the match evidence…');
      const form = new FormData(); form.set('action', 'review'); form.set('assetId', assetTicket); form.set('duration', String(analysisDuration)); form.set('candidates', JSON.stringify(candidates));
      const { reviewId } = await (await request(form, abort.signal)).json();
      if (!reviewId) throw new Error('Jev did not return a review task.');
      for (let i = 0; i < 180; i++) {
        const response = await highlightFetch(`${endpoint}?reviewId=${encodeURIComponent(reviewId)}`, { signal: abort.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || data.error || ['failed', 'canceled'].includes(data.status)) throw new Error(data.error || 'Jev review failed. Existing candidates are unchanged.');
        if (data.status === 'ready') {
          const reviews = validateJevReviews(data.reviews, candidates, analysisDuration);
          setEvents(current => current.map(event => { const jev = reviews.find(r => r.candidate_id === event.id); return jev ? { ...event, jev, reviewOverride: false } : event; }));
          setMessage(`Jev reviewed ${reviews.length} moments. Review its reasons and any uncertain events before export.`);
          return;
        }
        await new Promise<void>((resolve, reject) => { const cancel = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }; const timer = setTimeout(() => { abort.signal.removeEventListener('abort', cancel); resolve(); }, 5000); abort.signal.addEventListener('abort', cancel, { once: true }); });
      }
      throw new Error('Jev review is taking longer than 15 minutes. Existing candidates are unchanged.');
    } catch (e) { if (!abort.signal.aborted) setError((e as Error).message); }
    finally { if (!abort.signal.aborted) setBusy(''); }
  }
  async function exportVideo() {
    if ((!file && !scorePlay) || !plan.length) return;
    setBusy('Extracting clips and assembling your MP4…'); setError('');
    const abort = new AbortController(); controller.current = abort;
    try { const form = new FormData(); form.set('action', 'export'); if (scorePlay) form.set('scoreplayTicket', scorePlay.ticket); else if (file) form.set('video', file); form.set('clips', JSON.stringify(plan.map(c => ({ start: c.clipStart, end: c.clipEnd })))); const response = await request(form, abort.signal); setOutput(URL.createObjectURL(await response.blob())); setMessage('Your highlight video is ready.'); }
    catch (e) { if (!abort.signal.aborted) setError((e as Error).message); }
    finally { if (!abort.signal.aborted) setBusy(''); }
  }
  useEffect(() => { if (output) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [output]);
  const hasSource = !!file || !!scorePlay;
  const activeStep = output ? 2 : hasSource || busy ? 1 : 0;
  const processingLabel = /MP4/i.test(busy) ? 'Putting your highlight together' : /Jev|compar|review|candidate|Finding/i.test(busy) ? 'Finding your strongest moments' : 'Getting your video ready';
  function update(id: string, changes: Partial<Event>) { setEvents(current => current.map(e => e.id === id ? { ...e, ...changes, viral: undefined, reviewOverride: e.jev ? true : e.reviewOverride } : e)); resetOutput(); }
  return <main className={styles.app}>
    <header className={styles.nav}><Link href="/stream" className={styles.brand}><span className={styles.brandMark}><Play size={17} fill="currentColor" /></span>MATCHWATCH <span className={styles.brandProduct}>Studio</span></Link><nav><a href="/">Back to MatchWatch <ArrowRight size={14} /></a></nav><span className={styles.local}><span /> Highlight studio</span></header>
    <div className={styles.shell}>
      <div className={styles.hero}><div><p className={styles.eyebrow}>YOUR GAME. THE BEST PARTS.</p><h1>Big moments.<br /><em>Made easy.</em></h1><p>Turn a full match into a highlight worth watching.<br />Choose a video. We’ll find the plays that matter.</p></div><div className={styles.heroNote}><Sparkles size={22} /><div><strong>A full game. A few great moments.</strong><p>AI finds, compares and brings the best plays together.</p></div></div></div>
      <ol className={styles.steps} aria-label="Your highlight progress">{steps.map((step, i) => <li key={step} className={i === activeStep ? styles.stepActive : i < activeStep ? styles.stepDone : ''} aria-current={i === activeStep ? 'step' : undefined}><span>{i < activeStep ? <Check size={16} /> : i + 1}</span><strong>{step}</strong>{i < 2 && <ChevronDown size={14} />}</li>)}</ol>
      {error && <div className={styles.error} role="alert"><strong>We couldn’t complete that step</strong><p>{error}</p><button type="button" className={styles.textButton} onClick={() => setError('')}>Dismiss</button></div>}
      {config?.requiresLogin && !isAuthenticated && <div className={styles.signIn}><div><strong>{authLoading ? 'Checking your account…' : 'Sign in to create your highlight'}</strong><p>Browse your options, then sign in when you’re ready to start.</p></div><a className={styles.secondary} href="/login?next=%2Fapp">Sign in <ArrowRight size={16} /></a></div>}
      {busy && <div className={styles.processing} role="status"><LoaderCircle size={24} className={styles.spinner} /><div><strong>{processingLabel}</strong><p>{busy}</p><span>Longer recordings take more time. Leave this tab open while we work.</span></div><button type="button" className={styles.textButton} onClick={() => { controller.current?.abort(); setBusy(''); setMessage('Processing stopped. Your video is still selected, so you can try again.'); }}>Stop</button></div>}
      {message && !busy && !output && <p className={styles.notice} role="status">{message}</p>}
      <div className={styles.columns}>
        <div className={styles.setup}>
          <section className={styles.card} id="source"><div className={styles.heading}><span>01</span><div><h2>Choose your video</h2><p>A game from your library or a file from your device.</p></div></div>
            <div className={styles.sourceTabs} role="tablist" aria-label="Video source" onKeyDown={e => { if (busy || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); const next = e.key === 'Home' ? 'library' : e.key === 'End' ? 'upload' : sourceMode === 'library' ? 'upload' : 'library'; setSourceMode(next); document.getElementById(next + '-tab')?.focus(); }}><button type="button" id="library-tab" role="tab" tabIndex={sourceMode === 'library' ? 0 : -1} aria-selected={sourceMode === 'library'} aria-controls="library-panel" disabled={!!busy} onClick={() => setSourceMode('library')}><Library size={17} /> ScorePlay library</button><button type="button" id="upload-tab" role="tab" tabIndex={sourceMode === 'upload' ? 0 : -1} aria-selected={sourceMode === 'upload'} aria-controls="upload-panel" disabled={!!busy} onClick={() => setSourceMode('upload')}><Upload size={17} /> Upload a video</button></div>
            <div id="library-panel" role="tabpanel" aria-labelledby="library-tab" hidden={sourceMode !== 'library'}><ScorePlaySource disabled={!!busy || (!!config?.requiresLogin && !isAuthenticated)} onChoose={chooseScorePlay} /></div>
            <div id="upload-panel" role="tabpanel" aria-labelledby="upload-tab" hidden={sourceMode !== 'upload'}><label className={styles.upload + ' ' + (dragging ? styles.dragging : '')} onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) choose(e.dataTransfer.files[0]); }}><span className={styles.uploadIcon}><Upload size={25} /></span><strong>Drop your match video here</strong><span>or click to choose a file</span><small>MP4 and other video files · Up to 200 MB</small><input type="file" accept="video/*,.mp4" aria-label="Choose a video file" onChange={e => choose(e.target.files?.[0])} disabled={!!busy} /></label></div>
            {hasSource && <div className={styles.sourceSelected}><CircleCheck size={19} /><div><strong>{scorePlay?.name || file?.name}</strong><span>{scorePlay ? 'ScorePlay library' : 'Video from your device'}{duration ? ' · ' + clock(duration) : ' · Reading video details…'}</span></div></div>}
            {url && <video ref={player} src={url} controls preload="metadata" onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d)) setDuration(d); else setError('Choose a recorded video with a fixed length.'); }} onError={() => setError('We couldn’t preview this file. Try an MP4 video with H.264 encoding.')} />}
          </section>
          <section className={styles.card} id="preferences"><div className={styles.heading}><span>02</span><div><h2>Customize your highlight</h2><p>Set the sport and length. We’ll take care of the cut.</p></div></div>
            <fieldset className={styles.choiceGroup} disabled={!!busy}><legend>Which sport?</legend><div className={styles.choices}>{(['Basketball', 'Soccer'] as const).map(value => <button type="button" key={value} aria-pressed={sport === value} onClick={() => { setSport(value); setQueries(defaults[value]); setLabel(value === 'Soccer' ? 'Goal' : 'Dunk'); }}>{value}</button>)}</div></fieldset>
            <fieldset className={styles.choiceGroup} disabled={!!busy}><legend>How long should it be?</legend><div className={styles.choices}>{[30, 60, 90].map(value => <button type="button" key={value} aria-pressed={target === value} onClick={() => { setTarget(value); resetOutput(); }}>{value} sec{value === 60 && <small>Popular</small>}</button>)}</div></fieldset>
            <p className={styles.hint}>Up to five standout moments, with original audio and a natural flow.</p>
            <details className={styles.advanced} id="customization"><summary><Settings2 size={15} /><span>More customization<small>{momentQueries.length} moment types · {highlightPriorities.find(item => item.id === scoringPriority)!.name} scoring</small></span><ChevronDown size={15} /></summary><div className={styles.detailsBody}>
              <fieldset className={styles.customGroup} disabled={!!busy}><legend>Moments to include</legend><p className={styles.hint}>Choose the kinds of moments you want us to find.</p><div className={styles.momentChoices}>{defaults[sport].split('\n').map(moment => <label key={moment}><input type="checkbox" checked={momentQueries.includes(moment)} disabled={!!busy || (!momentQueries.includes(moment) && momentQueries.length >= 8)} onChange={e => { setQueries(current => { const list = current.split(/\r?\n/).map(query => query.trim()).filter(Boolean); return (e.target.checked ? [...list, moment] : list.filter(query => query !== moment)).join('\n'); }); resetOutput(); }} /><span>{moment}</span></label>)}</div><details><summary>Edit moment descriptions</summary><label>What should we look for?<small>Use your own words. One description per line, up to eight.</small><textarea rows={4} value={queries} disabled={!!busy} onChange={e => { setQueries(e.target.value); resetOutput(); }} /></label></details></fieldset>
              <fieldset className={styles.customGroup} disabled={!!busy}><legend>What should stand out?</legend><p className={styles.hint}>Choose what matters most when the AI ranks verified moments.</p><div className={styles.priorityChoices}>{highlightPriorities.map(priority => <button type="button" key={priority.id} aria-pressed={scoringPriority === priority.id} onClick={() => { setScoringPriority(priority.id); resetOutput(); }}><strong>{priority.name}</strong><small>{priority.description}</small></button>)}</div><p className={styles.hint}>Missing data is never filled in. Fan response only counts when X reactions have been loaded and matched. These priorities apply to AI-reviewed moments.</p></fieldset>
              <details className={styles.customGroup}><summary>Creation preferences <ChevronDown size={14} /></summary><div className={styles.detailsBody}>
                <label>Longer highlight<select value={target} disabled={!!busy} onChange={e => { setTarget(Number(e.target.value)); resetOutput(); }}>{[30,60,90,120,180,300].map(v => <option key={v} value={v}>{v} seconds</option>)}</select></label>
                <label className={styles.checkLabel}><input type="checkbox" checked={autoStart} disabled={!!busy} onChange={e => setAutoStart(e.target.checked)} /> Start as soon as I choose a video</label>
                <label className={styles.checkLabel}><input type="checkbox" checked={autoCompare} disabled={!!busy} onChange={e => { setAutoCompare(e.target.checked); resetOutput(); }} /> Compare moments with AI before choosing clips</label>
                <label className={styles.checkLabel}><input type="checkbox" checked={autoExport} disabled={!!busy} onChange={e => setAutoExport(e.target.checked)} /> Create the video automatically after selection</label>
                <label className={styles.checkLabel}><input type="checkbox" checked={compress} disabled={!!busy || !!scorePlay} onChange={e => setCompress(e.target.checked)} /> Use a smaller copy for analysis</label><p className={styles.hint}>Preparing a smaller copy takes extra time. The final cut uses your original footage.</p>
              </div></details>
              <button type="button" className={styles.textButton} disabled={!!busy || socialBusy} onClick={() => { setQueries(defaults[sport]); setScoringPriority('balanced'); setTarget(60); setBefore(5); setAfter(10); setAutoStart(false); setAutoCompare(true); setAutoExport(true); setCompress(false); setSourceRevision(current => current + 1); resetOutput(); }}>Reset customization to defaults</button>
            </div></details>

            <button className={styles.primary} disabled={!hasSource || !duration || !validMoments || !!busy || socialBusy || !config?.detectionReady || (!!config?.requiresLogin && !isAuthenticated)} onClick={() => void detect()}>{busy ? <LoaderCircle size={18} className={styles.spinner} /> : <Sparkles size={18} />}{busy ? 'Creating your highlight…' : output ? 'Create another cut' : 'Create my highlight'}{!busy && <ArrowRight size={18} />}</button>
            <p className={styles.actionHint}>{!validMoments ? 'Choose between one and eight moment descriptions in customization.' : socialBusy ? 'Loading optional fan reactions. You can create your highlight when this finishes.' : configError || (!config ? 'Connecting to video analysis…' : config.requiresLogin && !isAuthenticated ? 'Sign in above to start creating.' : !config.detectionReady ? 'Video analysis is temporarily unavailable.' : !hasSource ? 'Choose a video above to get started.' : !duration ? 'Reading your video details…' : 'We’ll find the best moments and create your video.')}</p>
            {configError && <button type="button" className={styles.secondary} onClick={() => void checkAvailability()}>Retry connection</button>}
          </section>
        </div>
        <aside className={styles.resultColumn} hidden={!events.length && !busy && !output}>
          <section className={styles.card} id="result" ref={resultRef}><div className={styles.heading}><span>03</span><div><h2>Your highlight</h2><p>{output ? 'Ready for its next audience.' : 'The best of your match, all in one place.'}</p></div>{output && <span className={styles.readyBadge}>Ready</span>}</div>
            {output ? <div className={styles.output}><video controls src={output} /><a href={output} download="matchwatch-highlights.mp4" className={styles.primary}><Download size={18} /> Download highlight</a><p className={styles.actionHint}>720p MP4 · Original audio</p></div> : <div className={plan.length && !busy ? styles.selectionReady : styles.resultEmpty}>{busy ? <LoaderCircle size={38} className={styles.spinner} /> : plan.length ? <CircleCheck size={30} /> : <Play size={34} />}<h3>{busy ? 'Your highlight is on its way' : plan.length ? 'Your moments are ready' : 'No clips selected yet'}</h3><p>{busy ? 'We’re finding the plays, comparing the moments and building your reel.' : plan.length ? 'Create the video below to preview and download this selection.' : 'Try a different search or review the moments below.'}</p>{busy && <div className={styles.reelPreview}><span /><span /><span /><span /><span /></div>}</div>}
            {!!events.length && <><div className={styles.stats}><div><strong>{events.length}</strong><span>Moments found</span></div><div><strong>{plan.length}</strong><span>Clips selected</span></div><div><strong>{clock(total)}</strong><span>Highlight length</span></div></div><ol className={styles.sequence}>{plan.map(c => <li key={c.id}><button type="button" className={styles.momentButton} onClick={() => { if (player.current) { player.current.currentTime = c.clipStart; void player.current.play().catch(() => {}); player.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }}><span className={styles.momentPlay}><Play size={12} /></span><span><strong>{c.label}</strong><small>{clock(c.clipStart)}–{clock(c.clipEnd)}</small></span><Check size={15} /></button></li>)}</ol></>}
            {!output && !!plan.length && !busy && !scorePlay && <><button className={styles.primary} disabled={!config?.exportReady || (!!config?.requiresLogin && !isAuthenticated)} onClick={exportVideo}><Film size={18} /> Create highlight video</button><p className={styles.actionHint}>720p MP4 · Original audio</p></>}
            {!output && !events.length && <div className={styles.reelSpecs}><span><Check size={14} /> Up to {target} seconds</span><span><Check size={14} /> Best moments selected</span><span><Check size={14} /> Ready to download</span></div>}
            <details className={styles.advanced}><summary><Scissors size={15} /> Adjust clip timing <ChevronDown size={15} /></summary><div className={styles.detailsBody}><p className={styles.hint}>These settings apply to manually marked moments. AI-reviewed moments use their recommended cuts.</p><div className={styles.row}><label>Build-up (seconds)<input type="number" min="0" max="30" value={before} disabled={!!busy} onChange={e => { setBefore(Math.max(0, Math.min(30, Number(e.target.value)))); resetOutput(); }} /></label><label>Reaction (seconds)<input type="number" min="0" max="30" value={after} disabled={!!busy} onChange={e => { setAfter(Math.max(0, Math.min(30, Number(e.target.value)))); resetOutput(); }} /></label></div></div></details>
          </section>
          <p className={styles.sidebarNote}><Sparkles size={15} /> Great plays first. Replays and overlapping moments stay out.</p>
        </aside>
      </div>
      <EventFusionStudio key={sourceRevision} sourceReady={hasSource && duration > 0} weights={scoringWeights} priorityName={highlightPriorities.find(item => item.id === scoringPriority)!.name} onSocialBusy={setSocialBusy} events={events} excluded={excluded} duration={duration} target={target} before={before} after={after} disabled={!!busy} onContext={input => { fusionContext.current = input; }} onApply={updated => { setEvents(updated); resetOutput(); setMessage('Your selection has been updated with the latest match insights.'); }} />
      <PipelineStudio file={file} scorePlay={scorePlay} duration={duration} sport={sport} target={target} queries={queries} before={before} after={after} scoringPriority={scoringPriority} getEvidence={() => fusionContext.current} disabled={!!busy || socialBusy || !validMoments || !!config?.requiresLogin && !isAuthenticated} />
      <details className={styles.optionalPanel} hidden={!hasSource && !events.length}><summary><span className={styles.optionalIcon}><Settings2 size={20} /></span><span><strong>Review & fine-tune</strong><small>Optional: see why moments were picked or adjust the selection.</small></span><ChevronDown size={18} /></summary><div className={styles.optionalBody}>
      <RollingScoreboard state={rolling} />
      <section className={styles.card}><div className={styles.heading}><span>03</span><h2>All detected moments</h2><span className={styles.count}>{events.length}</span></div><p className={styles.hint}>Your AI selection is ready to use. Adjust these moments only if you want a more personal cut.</p>
        <button className={styles.secondary} disabled={!assetTicket || !events.some(e => !excluded.includes(e.id)) || !!busy || (!!config?.requiresLogin && !isAuthenticated)} onClick={reviewWithJev}><Sparkles size={16} /> Recheck selected moments with AI</button>
        <p className={styles.hint}>An extra AI review checks the selected moments against your video again. This takes additional analysis time. Uncertain or repeated moments stay out unless you choose to include them.</p>
        <form className={styles.manual} onSubmit={e => { e.preventDefault(); if (!label.trim() || start < 0 || end <= start || end > duration) { setError('Enter a label and a valid start/end range within the video.'); return; } setEvents(current => [...current, { id: crypto.randomUUID(), label: label.trim(), start, end, confidence: 0, importance: 0.8, context: 0.5, audio: 0, reaction: 0, preference: 0.5 }]); setError(''); resetOutput(); }}>
          <label>Event label<input value={label} maxLength={200} required disabled={!!busy} onChange={e => setLabel(e.target.value)} /></label><label>Start (seconds)<input type="number" min="0" max={duration} step="0.1" value={start} required disabled={!!busy} onChange={e => setStart(Number(e.target.value))} /></label><label>End (seconds)<input type="number" min="0" max={duration} step="0.1" value={end} required disabled={!!busy} onChange={e => setEnd(Number(e.target.value))} /></label><button type="button" className={styles.secondary} disabled={!duration || !!busy} onClick={() => { const time = player.current?.currentTime || 0; setStart(Math.floor(time)); setEnd(Math.min(duration, Math.floor(time) + 5)); }}>Use playhead</button><button className={styles.secondary} disabled={!duration || !!busy}>Add event</button>
        </form>
        {!events.length ? <div className={styles.empty}><Film size={30} /><h3>Your moments will appear after analysis.</h3><p>Choose a video and create your highlight, or add a moment manually.</p></div> : <div className={styles.eventList}>{[...events].sort((a, b) => eventScore(b) - eventScore(a)).map(event => <article key={event.id} className={styles.event}>
          <div className={styles.eventTitle}><label><input type="checkbox" checked={!excluded.includes(event.id)} disabled={!!busy} onChange={e => { setExcluded(current => e.target.checked ? current.filter(id => id !== event.id) : [...current, event.id]); resetOutput(); }} /><strong>{event.label}</strong></label><span>{event.providerConfidence ? `Provider confidence: ${event.providerConfidence}` : 'Manually marked'}</span><b>Score {Math.round(eventScore(event) * 100)}</b><button aria-label={`Delete ${event.label}`} disabled={!!busy} onClick={() => { setEvents(current => current.filter(item => item.id !== event.id)); resetOutput(); }}><Trash2 size={16} /></button></div>
          {event.jev && <div className={styles.notice}>
            <strong>Jev: {event.jev.needs_review ? 'Needs review' : event.jev.duplicate_of ? 'Duplicate' : event.jev.recommend_include ? 'Recommend include' : 'Recommend skip'} · {plan.some(c => c.id === event.id) ? 'Selected in reel' : 'Not selected in reel'}</strong>
            <p>{event.jev.reason}</p>
            <p>Event: {event.jev.event} · Suggested cut {clock(event.jev.suggested_start)}–{clock(event.jev.suggested_end)} · Match context: {event.jev.match_context ?? 'Unknown'}</p>
            <p>Importance {event.jev.importance_estimate ?? 'Unknown'} · Excitement {event.jev.excitement_estimate ?? 'Unknown'} · Watchability {event.jev.watchability_estimate ?? 'Unknown'}{event.jev.duplicate_of && ` · Same event as ${events.find(e => e.id === event.jev?.duplicate_of)?.label || event.jev.duplicate_of}`}</p>
            <label><input type="checkbox" checked={!!event.reviewOverride} disabled={!!busy} onChange={e => { setEvents(current => current.map(item => item.id === event.id ? { ...item, reviewOverride: e.target.checked } : item)); resetOutput(); }} /> Override Jev with my timing and scoring inputs</label>
          </div>}
          <div className={styles.signals}><label>Start (s)<input type="number" min="0" max={duration} step="0.1" value={event.start} disabled={!!busy} onChange={e => update(event.id, { start: Number(e.target.value) })} /></label><label>End (s)<input type="number" min="0" max={duration} step="0.1" value={event.end} disabled={!!busy} onChange={e => update(event.id, { end: Number(e.target.value) })} /></label>{(['importance', 'context', 'audio', 'reaction', 'preference'] as const).map(key => <label key={key}>{key}<input type="number" min="0" max="1" step="0.1" value={event[key]} disabled={!!busy} onChange={e => update(event.id, { [key]: Math.min(1, Math.max(0, Number(e.target.value))) })} /></label>)}</div>
          {(event.end <= event.start || event.end > duration) && <p className={styles.error}>Adjust this range to fit the video. It is excluded from the plan.</p>}
        </article>)}</div>}
      </section></div></details><footer className={styles.footer}>MATCHWATCH HIGHLIGHT STUDIO <span>From the full game to your favourite moments.</span></footer>
    </div>
  </main>;
}
