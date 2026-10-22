import type { RollingState } from '../../lib/rolling-highlights';
import styles from './HighlightStudio.module.css';
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export default function RollingScoreboard({ state }: { state: RollingState }) {
  if (!state.history.length) return null;
  const latest = state.history.at(-1)!;
  const names = (ids: string[]) => ids.map(id => state.decisions.find(d => d.id === id)?.label || id).join(', ');
  return <section className={styles.card} aria-label="Rolling comparison"><h2>Compare each review window</h2>
    <p>Each completed window competes with every earlier reviewed moment. Only verified, non-overlapping clips enter the current proposal.</p>
    <div className={styles.stats}><div><strong>{latest.considered}</strong><span>MOMENTS COMPARED</span></div><div><strong>{latest.utility.toFixed(2)}</strong><span>COMBINED EDITORIAL SCORE</span></div><div><strong>{time(latest.seconds)}</strong><span>CURRENT PROPOSAL</span></div></div>
    <p className={styles.hint}>Scores are editorial estimates, not probabilities. The same importance, excitement and watchability weights apply to every window. These are analysis snapshots; manual edits below can change the proposal.</p>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}><thead><tr><th>Window</th><th>Compared</th><th>Score change</th><th>Added</th><th>Replaced</th></tr></thead><tbody>{state.history.map((step, index) => <tr key={`${step.chunkId}-${index}`}><td>{time(step.start)}–{time(step.end)}</td><td>{step.considered}</td><td>{step.delta >= 0 ? '+' : ''}{step.delta.toFixed(2)}</td><td>{names(step.added) || 'None'}</td><td>{names(step.removed) || 'None'}</td></tr>)}</tbody></table></div>
    <details><summary>Why moments were kept or skipped</summary>{state.decisions.map(decision => <p key={decision.id}><strong>{decision.label} · {decision.score.toFixed(2)} · {decision.selected ? 'Selected' : 'Skipped'}</strong><br />{decision.reason}</p>)}</details>
  </section>;
}
