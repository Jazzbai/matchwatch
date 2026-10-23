'use client';
import { Check, Download, LoaderCircle, Pause, Play, Workflow } from 'lucide-react';
import { pipelineSteps, type Job } from '../../../lib/highlights/types';
import styles from '../HighlightStudio.module.css';

const stateLabels = { pending: 'Waiting', working: 'Working', ready: 'Done', error: 'Error' } as const;
const base = process.env.NEXT_PUBLIC_APP_BASE_PATH || '';

type Props = { job: Job | null; running: boolean; onPause: () => void; onResume: () => void };

/** The ten steps of the trend-aware highlight diagram, as they run. */
export default function PipelineProgress({ job, running, onPause, onResume }: Props) {
  const failed = job?.steps.some(step => step.state === 'error');
  const finished = job?.steps.every(step => step.state === 'ready');
  return <section className={styles.card} aria-label="Highlight engine progress">
    <div className={styles.heading}><Workflow size={21} /><div><h2>Highlight engine</h2><p>{job ? job.title : 'Ten steps from match video to key moments.'}</p></div>{finished && <span className={styles.readyBadge}>Complete</span>}</div>
    <ol className={styles.pipelineSteps} aria-live="polite">
      {pipelineSteps.map((name, index) => {
        const step = job?.steps[index], state = step?.state ?? 'pending';
        return <li key={name} data-state={state}>
          <span className={styles.pipelineNumber}>{state === 'ready' ? <Check size={12} /> : state === 'working' ? <LoaderCircle size={12} className={styles.spinner} /> : index + 1}</span>
          <div>
            <strong>{name}</strong>
            {step && state !== 'pending' && <small>{step.message}</small>}
            {job && state === 'ready' && <small><a href={`${base}/api/stream/pipeline?jobId=${job.id}&step=${index + 1}`}><Download size={10} /> JSON</a></small>}
          </div>
          <span className={styles.pipelineState}>{stateLabels[state]}</span>
        </li>;
      })}
    </ol>
    {job && !finished && <div className={styles.pipelineActions}>
      {running
        ? <button type="button" className={styles.secondary} onClick={onPause}><Pause size={14} /> Pause</button>
        : <button type="button" className={styles.secondary} onClick={onResume}><Play size={14} /> {failed ? 'Retry from the failed step' : 'Resume'}</button>}
    </div>}
  </section>;
}
