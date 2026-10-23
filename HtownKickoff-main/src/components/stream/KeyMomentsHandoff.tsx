'use client';
import { useEffect, useState } from 'react';
import { Download, ArrowDownWideNarrow, CircleCheck, FileJson, RefreshCw } from 'lucide-react';
import type { KeyMomentsHandoff as Handoff } from '../../lib/rundown-handoff';
import type { PipelineJob } from '../../lib/pipeline-types';
import { highlightFetch } from '../../lib/highlight-session';
import { highlightResponse } from '../../lib/highlight-request';
import styles from './HighlightStudio.module.css';

const endpoint = `${process.env.NEXT_PUBLIC_APP_BASE_PATH || ''}/api/stream/pipeline`;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const stages = [{ step: 8, label: 'Rank all moments', Icon: ArrowDownWideNarrow }, { step: 9, label: 'Select top moments', Icon: CircleCheck }, { step: 10, label: 'Output key moments', Icon: FileJson }];
export default function KeyMomentsHandoff({ job }: { job: PipelineJob }) {
  const [data, setData] = useState<Handoff | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [working, setWorking] = useState(true);
  const revision = job.steps[6].revision;
  useEffect(() => {
    const abort = new AbortController();
    setData(null); setError(''); setWorking(true);
    void (async () => {
      try {
        const response = await highlightResponse(await highlightFetch(`${endpoint}?jobId=${encodeURIComponent(job.id)}&step=7&format=key-moments`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]), cache: 'no-store' }));
        const next = await response.json();
        if (!abort.signal.aborted) setData(next);
      } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not open the key moments. Retry the connection.'); }
      finally { if (!abort.signal.aborted) setWorking(false); }
    })();
    return () => abort.abort();
  }, [job.id, revision, retry]);
  function download() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `matchwatch-${job.id}-key-moments.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className={styles.handoffCard} aria-label="Flowchart steps 8 to 10">
    <div className={styles.heading}><FileJson size={22} /><div><h3>Your highlight decisions</h3><p>Every moment ranked. The strongest combination selected. A handoff for your team.</p></div></div>
    <ol className={styles.handoffProgress} aria-live="polite">{stages.map(({ step, label, Icon }) => <li key={step} data-state={working ? 'working' : error ? 'error' : 'ready'}><Icon size={17} /><div><strong>{step} · {label}</strong><small>{working ? 'Opening saved results…' : error ? 'Could not load' : 'Ready'}</small></div></li>)}</ol>
    {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" className={styles.secondary} onClick={() => setRetry(value => value + 1)}><RefreshCw size={14} /> Retry handoff</button></div>}
    {data && <>
      <div className={styles.selectionReady}><CircleCheck size={19} /><h3>{data.selected.length} selected · {clock(data.total_duration_seconds)} of {clock(data.target_duration_seconds)}</h3><p>{data.selection.distinct_event_types} types of moments. All selected clips keep their reviewed boundaries.</p></div>
      <ol className={styles.handoffSelected} aria-label="Selected key moments">{data.selected.map(moment => <li key={moment.event_id}><span>{moment.order}</span><div><strong>{moment.event_type}</strong><small>{clock(moment.start_seconds)}–{clock(moment.end_seconds)} · Source recording</small><p>{moment.explanation}</p></div><b>{Math.round((moment.viral_score ?? 0) * 100)}<small>estimated score</small></b></li>)}</ol>
      <details className={styles.advanced}><summary>All {data.ranking.length} ranked moments and skipped reasons</summary><div className={styles.handoffRanking}>{data.ranking.map(moment => <div key={moment.event_id}><span>#{moment.rank}</span><div><strong>{moment.event_type} · {moment.viral_score === null ? 'Score unavailable' : `${Math.round(moment.viral_score * 100)}/100`}</strong><small>{clock(moment.start_seconds)}–{clock(moment.end_seconds)} · {moment.selected ? 'Selected' : moment.skip_reason}</small></div></div>)}</div></details>
      <div className={styles.pipelineActions}><button type="button" className={styles.primary} onClick={download}><Download size={15} /> Download key moments</button></div>
      <p className={styles.hint}>{data.rundown.compatible ? 'Includes ScorePlay source IDs and timecodes in Rundown’s moment format.' : data.rundown.reason} Scores estimate editorial potential. Rights review and final rendering remain pending.</p>
    </>}
  </section>;
}
