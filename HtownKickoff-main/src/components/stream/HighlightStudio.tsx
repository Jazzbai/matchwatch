'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- These links leave the isolated /app service for the existing main site. */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Film, Scissors, Sparkles, Upload, Download, Trash2 } from 'lucide-react';
import { eventScore, planHighlights, type HighlightEvent } from '../../lib/highlight-plan';
import styles from './HighlightStudio.module.css';
import { getAccessToken } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { reviewInput, reviewWindow, validateJevReviews } from '../../lib/jev';
import { highlightResponse } from '../../lib/highlight-request';

const endpoint = `${process.env.NEXT_PUBLIC_APP_BASE_PATH || ''}/api/stream/highlights`;
function authorization(): HeadersInit { const token = getAccessToken(); return token ? { Authorization: `Bearer ${token}` } : {}; }
async function request(form: FormData, signal?: AbortSignal) {
  return highlightResponse(await fetch(endpoint, { method: 'POST', body: form, signal, headers: authorization() }));
}

type Event = HighlightEvent & { providerConfidence?: string };
const clock = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
const defaults = { Soccer: 'Goal scored\nShot on target\nFoul or penalty\nCrowd celebration', Basketball: 'Dunk\nThree-point shot\nAssist or block\nCrowd celebration' };
const steps = ['Input video', 'Detect events', 'Jev review', 'Score & rank', 'Refine clips', 'Select highlights', 'Assemble', 'Export MP4'];
export default function HighlightStudio() {
  const { isAuthenticated } = useAuth();
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState(''), [duration, setDuration] = useState(0);
  const [sport, setSport] = useState<'Soccer' | 'Basketball'>('Basketball'), [queries, setQueries] = useState(defaults.Basketball);
  const [events, setEvents] = useState<Event[]>([]), [excluded, setExcluded] = useState<string[]>([]);
  const [assetTicket, setAssetTicket] = useState('');
  const [target, setTarget] = useState(60), [before, setBefore] = useState(5), [after, setAfter] = useState(10);
  const [label, setLabel] = useState('Dunk'), [start, setStart] = useState(0), [end, setEnd] = useState(10);
  const [autoStart, setAutoStart] = useState(true), [autoExport, setAutoExport] = useState(true);
  const pendingUpload = useRef(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState(''), [output, setOutput] = useState('');
  const [config, setConfig] = useState<{ detectionReady: boolean; exportReady: boolean; requiresLogin?: boolean } | null>(null);
  const player = useRef<HTMLVideoElement>(null), controller = useRef<AbortController | null>(null);
  useEffect(() => { fetch(endpoint).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setConfig(data); }).catch(e => setError(e.message)); return () => controller.current?.abort(); }, []);
  useEffect(() => { if (!file) return; const source = URL.createObjectURL(file); setUrl(source); return () => URL.revokeObjectURL(source); }, [file]);
  useEffect(() => () => { if (output) URL.revokeObjectURL(output); }, [output]);
  const plan = planHighlights(events.filter(e => !excluded.includes(e.id)), duration, target, before, after).slice(0, 20);
  const total = plan.reduce((sum, clip) => sum + clip.clipEnd - clip.clipStart, 0);
  function resetOutput() { setOutput(''); }
  function choose(video: File | undefined) {
    if (!video) return;
    if (video.size > 200 * 1024 * 1024) { setError('Choose a video smaller than 200 MB.'); return; }
    controller.current?.abort(); pendingUpload.current = true; setBusy(''); setFile(video); setDuration(0); setEvents([]); setExcluded([]); setAssetTicket(''); setError(''); setMessage('Video selected. Reading video details before processing…'); resetOutput();
  }
  const detect = useCallback(async () => {
    if (!file) return;
    pendingUpload.current = false;
    const abort = new AbortController(); controller.current = abort; setBusy('Uploading video to TwelveLabs…'); setError(''); resetOutput();
    try {
      const upload = new FormData(); upload.set('action', 'upload'); upload.set('video', file);
      const { assetId } = await (await request(upload, abort.signal)).json();
      if (!assetId) throw new Error('TwelveLabs did not return an uploaded asset.');
      setAssetTicket('');
      async function waitUntilReady(parameter: string, id: string, stage: string) {
        for (let i = 0; i < 180; i++) {
          const response = await highlightResponse(await fetch(`${endpoint}?${parameter}=${encodeURIComponent(id)}`, { signal: abort.signal, cache: 'no-store', headers: authorization() })); const resource = await response.json();
          if (!response.ok || resource.error) throw new Error(resource.error || `${stage} failed.`);
          if (resource.status === 'ready') return;
          if (['failed', 'canceled'].includes(resource.status)) throw new Error(`${stage} failed. Try an H.264 MP4 with a clear video track.`);
          setBusy(`${stage} · ${resource.status || 'processing'}…`);
          await new Promise<void>((resolve, reject) => { const cancel = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }; const timer = setTimeout(() => { abort.signal.removeEventListener('abort', cancel); resolve(); }, 5000); abort.signal.addEventListener('abort', cancel, { once: true }); });
        }
        throw new Error(`${stage} took longer than 15 minutes. Try a shorter video.`);
      }
      await waitUntilReady('assetId', assetId, 'Processing uploaded video');
      setAssetTicket(assetId);
      setBusy('Adding video to your search index…');
      const index = new FormData(); index.set('action', 'index'); index.set('assetId', assetId);
      const { indexedAssetId: videoId } = await (await request(index, abort.signal)).json();
      if (!videoId) throw new Error('TwelveLabs did not return an indexed asset.');
      await waitUntilReady('indexedAssetId', videoId, 'Indexing video');
      setBusy('Finding candidate events…');
      const search = new FormData(); search.set('action', 'search'); search.set('videoId', videoId); search.set('queries', queries);
      const data = await (await request(search, abort.signal)).json(); setEvents(data.events); setExcluded([]);
      if (!data.events.length) { setMessage('No matching moments were found. Change the search descriptions or mark a play manually below. No reel was generated.'); return; }
      const selected = planHighlights(data.events, duration, target, before, after).slice(0, 20);
      setMessage(`${data.events.length} candidate events found. Review the selected clips; Jev review is optional.`);
      if (autoExport && config?.exportReady && selected.length) {
        setBusy('Creating your highlight MP4…');
        const form = new FormData(); form.set('action', 'export'); form.set('video', file);
        form.set('clips', JSON.stringify(selected.map(c => ({ start: c.clipStart, end: c.clipEnd }))));
        const response = await request(form, abort.signal);
        setOutput(URL.createObjectURL(await response.blob()));
        setMessage(`Your highlight MP4 is ready from ${selected.length} selected clips. Preview and download it below. Jev review has not been run.`);
      } else if (!selected.length) setMessage('Moments were found, but no complete clip fits the target length. Increase the target or shorten the clip padding.');
    } catch (e) { if (!abort.signal.aborted) setError((e as Error).message); }
    finally { if (!abort.signal.aborted) setBusy(''); }
  }, [file, queries, duration, target, before, after, autoExport, config?.exportReady]);
  useEffect(() => {
    if (!pendingUpload.current || !autoStart || !file || !duration || !config?.detectionReady || (config.requiresLogin && !isAuthenticated)) return;
    pendingUpload.current = false;
    void detect();
  }, [autoStart, file, duration, config, isAuthenticated, detect]);
  async function reviewWithJev() {
    const abort = new AbortController(); controller.current = abort;
    setError(''); resetOutput();
    try {
      const candidates = reviewInput(events.filter(e => !excluded.includes(e.id)), duration);
      reviewWindow(candidates, duration);
      setBusy('Jev is reviewing the match evidence…');
      const form = new FormData(); form.set('action', 'review'); form.set('assetId', assetTicket); form.set('duration', String(duration)); form.set('candidates', JSON.stringify(candidates));
      const { reviewId } = await (await request(form, abort.signal)).json();
      if (!reviewId) throw new Error('Jev did not return a review task.');
      for (let i = 0; i < 180; i++) {
        const response = await fetch(`${endpoint}?reviewId=${encodeURIComponent(reviewId)}`, { signal: abort.signal, cache: 'no-store', headers: authorization() });
        const data = await response.json();
        if (!response.ok || data.error || ['failed', 'canceled'].includes(data.status)) throw new Error(data.error || 'Jev review failed. Existing candidates are unchanged.');
        if (data.status === 'ready') {
          const reviews = validateJevReviews(data.reviews, candidates, duration);
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
    if (!file || !plan.length) return;
    setBusy('Extracting clips and assembling your MP4…'); setError('');
    const abort = new AbortController(); controller.current = abort;
    try { const form = new FormData(); form.set('action', 'export'); form.set('video', file); form.set('clips', JSON.stringify(plan.map(c => ({ start: c.clipStart, end: c.clipEnd })))); const response = await request(form, abort.signal); setOutput(URL.createObjectURL(await response.blob())); setMessage('Your highlight video is ready.'); }
    catch (e) { if (!abort.signal.aborted) setError((e as Error).message); }
    finally { if (!abort.signal.aborted) setBusy(''); }
  }
  function update(id: string, changes: Partial<Event>) { setEvents(current => current.map(e => e.id === id ? { ...e, ...changes, reviewOverride: e.jev ? true : e.reviewOverride } : e)); resetOutput(); }
  return <main className={styles.app}>
    <header className={styles.nav}><Link href="/stream" className={styles.brand}>MATCHWATCH <span>HIGHLIGHTS</span></Link><nav><a href="/">MatchWatch home</a><a href="/matches">Match schedule</a></nav><span className={styles.local}>HIGHLIGHT STUDIO</span></header>
    <div className={styles.shell}>
      <div className={styles.hero}><div><p className={styles.eyebrow}><Sparkles size={14} /> THE MOMENTS THAT MAKE THE MATCH.</p><h1>Full game.<br /><em>Just the highlights.</em></h1><p>Find the big plays, shape the story, and turn your match into a shareable highlight reel.</p></div><div className={styles.heroIcon}><Scissors size={64} /><span>FROM KICKOFF TO THE FINAL CUT</span></div></div>
      <ol className={styles.steps}>{steps.map((step, i) => <li key={step}><span>{i + 1}</span>{step}</li>)}</ol>
      {error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={styles.notice} role="status">{message}</p>}
      {config?.requiresLogin && !isAuthenticated && <p className={styles.notice}><a href="/login?next=%2Fapp">Sign in to MatchWatch</a> to detect events and export your highlights. You can preview footage and mark moments first.</p>}
      {busy && <div className={styles.notice} role="status">{busy} <button onClick={() => { controller.current?.abort(); setBusy(''); setMessage('Operation canceled.'); }}>Cancel</button></div>}
      <div className={styles.columns}>
        <section className={styles.card}><div className={styles.heading}><span>01</span><h2>Your source footage</h2><Film size={20} /></div>
          <label className={styles.upload}><Upload size={28} /><strong>{file ? file.name : 'Choose your match video'}</strong><span>MP4 / video file · up to 200 MB</span><input type="file" accept="video/*,.mp4" onChange={e => choose(e.target.files?.[0])} disabled={!!busy} /></label>
          {url && <video ref={player} src={url} controls preload="metadata" onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d)) setDuration(d); else setError('Use a finite video recording for this prototype.'); }} onError={() => setError('This browser cannot play the selected video. Try an MP4 encoded with H.264.')} />}
          <div className={styles.row}><label>Sport<select value={sport} disabled={!!busy} onChange={e => { const value = e.target.value as typeof sport; setSport(value); setQueries(defaults[value]); setLabel(value === 'Soccer' ? 'Goal' : 'Dunk'); }}><option>Soccer</option><option>Basketball</option></select></label><label>Target length<select value={target} disabled={!!busy} onChange={e => { setTarget(Number(e.target.value)); resetOutput(); }}>{[30, 60, 90, 120, 180, 300].map(v => <option key={v} value={v}>{v} seconds</option>)}</select></label></div>
          <label>Moments to find <small>One query per line · up to eight</small><textarea rows={4} value={queries} disabled={!!busy} onChange={e => setQueries(e.target.value)} /></label>
          <label><span><input type="checkbox" style={{ width: 'auto', marginRight: 8 }} checked={autoStart} disabled={!!busy} onChange={e => setAutoStart(e.target.checked)} />Start processing when I choose a video</span></label>
          <label><span><input type="checkbox" style={{ width: 'auto', marginRight: 8 }} checked={autoExport} disabled={!!busy} onChange={e => setAutoExport(e.target.checked)} />Generate the MP4 after detection (skip optional Jev review)</span></label>
          <button className={styles.primary} disabled={!file || !duration || !!busy || !config?.detectionReady || (!!config?.requiresLogin && !isAuthenticated)} onClick={() => void detect()}><Sparkles size={16} /> {autoExport ? 'Find moments & create highlight' : 'Detect events with TwelveLabs'} <ArrowRight size={16} /></button>
          <p className={styles.hint}>{!config ? 'Checking detection availability…' : config.detectionReady ? 'Detection sends this video to TwelveLabs for indexing and visual search.' : 'AI detection is not configured on this server yet. You can add events manually below.'}</p>
        </section>
        <section className={styles.card}><div className={styles.heading}><span>02</span><h2>Build your highlight</h2><Scissors size={20} /></div>
          <div className={styles.stats}><div><strong>{events.length}</strong><span>CANDIDATES</span></div><div><strong>{plan.length}</strong><span>SELECTED CLIPS</span></div><div><strong>{clock(total)}</strong><span>OF {clock(target)} TARGET</span></div></div>
          <h3>Refine the cut</h3><div className={styles.row}><label>Before event (sec)<input type="number" min="0" max="30" value={before} disabled={!!busy} onChange={e => { setBefore(Math.max(0, Math.min(30, Number(e.target.value)))); resetOutput(); }} /></label><label>After event (sec)<input type="number" min="0" max="30" value={after} disabled={!!busy} onChange={e => { setAfter(Math.max(0, Math.min(30, Number(e.target.value)))); resetOutput(); }} /></label></div>
          <p className={styles.hint}>Best scores first, with different event types and no overlapping clips. Jev recommendations are separate from selection: reviewed cuts must fit whole inside the target. The final sequence follows match time.</p>
          <div className={styles.timeline}>{plan.length ? plan.map(c => <button key={c.id} style={{ flex: c.clipEnd - c.clipStart }} title={`${c.label}: ${clock(c.clipStart)}–${clock(c.clipEnd)}`} onClick={() => { if (player.current) { player.current.currentTime = c.clipStart; void player.current.play(); } }}>{c.label}</button>) : <span>Your selected moments will appear here</span>}</div>
          <ol className={styles.sequence}>{plan.map(c => <li key={c.id}><Check size={14} /><strong>{c.label}</strong><span>{clock(c.clipStart)}–{clock(c.clipEnd)}</span></li>)}</ol>
          <button className={styles.primary} disabled={!plan.length || !!busy || !config?.exportReady || (!!config?.requiresLogin && !isAuthenticated)} onClick={exportVideo}><Film size={16} /> Generate highlight MP4</button>
          <p className={styles.hint}>{!config ? 'Checking export availability…' : config.exportReady ? '720p MP4 · original audio · chronological cuts' : 'Video export is not configured on this server yet.'}</p>
          {output && <div className={styles.output}><video controls src={output} /><a href={output} download="matchwatch-highlights.mp4" className={styles.primary}><Download size={16} /> Download highlight</a></div>}
        </section>
      </div>
      <section className={styles.card}><div className={styles.heading}><span>03</span><h2>Candidate events</h2><span className={styles.count}>{events.length}</span></div><p className={styles.hint}>Review time ranges and set the scoring signals from 0 to 1. Score = 40% importance + 20% context + 15% audio + 15% reaction + 10% team preference. These are editable review inputs; audio and reactions are not automatically measured.</p>
        <button className={styles.secondary} disabled={!assetTicket || !events.some(e => !excluded.includes(e.id)) || !!busy || (!!config?.requiresLogin && !isAuthenticated)} onClick={reviewWithJev}><Sparkles size={16} /> Review checked moments with Jev</button>
        <p className={styles.hint}>Jev uses TwelveLabs Pegasus 1.6 to review the uploaded video. Check up to 20 candidates. Analysis covers the span between them, including gaps, and adds TwelveLabs usage. Estimates use 50% importance, 30% excitement, and 20% watchability, renormalized over known signals. Uncertain moments and duplicates need your override. Cancel stops waiting; the provider task may continue.</p>
        <form className={styles.manual} onSubmit={e => { e.preventDefault(); if (!label.trim() || start < 0 || end <= start || end > duration) { setError('Enter a label and a valid start/end range within the video.'); return; } setEvents(current => [...current, { id: crypto.randomUUID(), label: label.trim(), start, end, confidence: 0, importance: 0.8, context: 0.5, audio: 0, reaction: 0, preference: 0.5 }]); setError(''); resetOutput(); }}>
          <label>Event label<input value={label} maxLength={200} required disabled={!!busy} onChange={e => setLabel(e.target.value)} /></label><label>Start (seconds)<input type="number" min="0" max={duration} step="0.1" value={start} required disabled={!!busy} onChange={e => setStart(Number(e.target.value))} /></label><label>End (seconds)<input type="number" min="0" max={duration} step="0.1" value={end} required disabled={!!busy} onChange={e => setEnd(Number(e.target.value))} /></label><button type="button" className={styles.secondary} disabled={!duration || !!busy} onClick={() => { const time = player.current?.currentTime || 0; setStart(Math.floor(time)); setEnd(Math.min(duration, Math.floor(time) + 5)); }}>Use playhead</button><button className={styles.secondary} disabled={!duration || !!busy}>Add event</button>
        </form>
        {!events.length ? <div className={styles.empty}><Film size={30} /><h3>Every great reel starts with a moment.</h3><p>Upload a video, then detect events or mark your first play.</p></div> : <div className={styles.eventList}>{[...events].sort((a, b) => eventScore(b) - eventScore(a)).map(event => <article key={event.id} className={styles.event}>
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
      </section><footer className={styles.footer}>MATCHWATCH HIGHLIGHT STUDIO <span>Recorded video input · optional effects and live ingestion are not included</span></footer>
    </div>
  </main>;
}
