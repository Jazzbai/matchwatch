'use client';
import { ChevronDown, CircleCheck, Download, FileJson, Film, LoaderCircle, Play, ShieldAlert } from 'lucide-react';
import type { JobView } from '../../../lib/highlights/client';
import type { KeyMomentsOutput } from '../../../lib/highlights/output';
import { factorKeys } from '../../../lib/highlights/types';
import styles from '../HighlightStudio.module.css';
import { clock, factorLabels, scoreName, twoDecimals } from './format';

type Moment = KeyMomentsOutput['selected_moments'][number];
type Props = {
  view: JobView & { output: KeyMomentsOutput };
  presetName: string;
  renderReady: boolean;
  rendering: boolean;
  videoUrl: string;
  onSeek: (seconds: number) => void;
  onRender: () => void;
  onDownload: () => void;
};
const sourceLabels: Record<string, string> = {
  official_stats: 'Official stats', x_measured: 'X measured', video_model: 'Video AI', video_search: 'Commentary', audience_profile: 'Your audience', heuristic: 'Event type',
};

/** Diagram steps 8–10: every moment ranked, the automatic selection, and the output. */
export default function Results({ view, presetName, renderReady, rendering, videoUrl, onSeek, onRender, onDownload }: Props) {
  const { output, social } = view;
  const byRank = [...output.selected_moments].sort((a, b) => a.rank - b.rank);
  const onHold = output.publication !== 'ready';
  const sources = new Set(output.selected_moments.flatMap(moment => moment.evidence.map(item => item.source)));
  const evidence = ['Video', sources.has('official_stats') && 'official stats', sources.has('x_measured') && 'X reactions'].filter(Boolean).join(' + ');
  const averageConfidence = byRank.length ? byRank.reduce((sum, moment) => sum + moment.confidence, 0) / byRank.length : 0;

  return <section className={styles.results} aria-label="Highlight results">
    <div className={styles.scoringHeader}>
      <div><p className={styles.eyebrow}>SELECTED AUTOMATICALLY</p><h2>The moments that made the cut</h2><p>{presetName} priority · {byRank.length} of {output.ranking.length} ranked moments · {clock(output.total_duration_seconds)} of {clock(output.target_duration_seconds)}</p></div>
      <div className={styles.badges}>
        <span className={styles.evidenceBadge}>{evidence}</span>
        <span className={styles.evidenceBadge} data-tone={onHold ? 'warning' : undefined}>Rights: {output.rights_status.replace('_', ' ')}</span>
      </div>
    </div>
    {social && social.status !== 'available' && social.status !== 'not_requested' && <p className={styles.notice}>X reactions were not used: {social.reason}</p>}

    <div className={styles.stats}>
      <div><strong>{output.ranking.length}</strong><span>Moments ranked</span></div>
      <div><strong>{byRank.length}</strong><span>Top moments selected</span></div>
      <div><strong>{clock(output.total_duration_seconds)}</strong><span>Highlight length</span></div>
      <div><strong>{Math.round(averageConfidence * 100)}%</strong><span>Evidence coverage</span></div>
    </div>

    {!byRank.length && <p className={styles.notice}>No verified moment fits the selection rules. Try a longer highlight, other moment types or another video.</p>}
    <div className={styles.insightCards}>{byRank.map(moment => <MomentCard key={moment.event_id} moment={moment} onSeek={onSeek} />)}</div>

    <section className={styles.card} aria-label="Rank all moments">
      <div className={styles.heading}><span>08</span><div><h2>Every moment, ranked by viral score</h2><p>S sports importance · T social trend · E emotional intensity · C controversy & surprise · A audience relevance · Q quality & diversity</p></div></div>
      <div className={styles.tableScroll}><table className={styles.rankingTable}>
        <thead><tr><th>#</th><th>Event</th><th>Time</th>{factorKeys.map(key => <th key={key} title={factorLabels[key].name}>{factorLabels[key].symbol}</th>)}<th>Viral score</th><th>Status</th></tr></thead>
        <tbody>{output.ranking.map(row => <tr key={row.event_id} data-selected={row.selected}>
          <td className={styles.number}>{row.rank}</td>
          <td><button type="button" className={styles.momentButton} onClick={() => onSeek(row.start_time_seconds)}><Play size={11} /> {row.label}</button></td>
          <td className={styles.number}>{row.match_time ?? clock(row.start_time_seconds)}</td>
          {factorKeys.map(key => {
            const value = row.scores[scoreName[key]];
            return <td key={key} className={`${styles.number} ${value === null ? styles.missing : ''}`}>{twoDecimals(value)}</td>;
          })}
          <td className={`${styles.number} ${styles.viral}`}>{row.viral_score === null ? '—' : (row.viral_score / 100).toFixed(2)}</td>
          <td>{row.selected ? <span className={styles.selectedTag}>Selected</span> : <small>{row.skip_reason}</small>}</td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section className={`${styles.card} ${styles.output}`} aria-label="Key moments output">
      <div className={styles.heading}><span>10</span><div><h2>Key moments for highlight generation</h2><p>Timestamps, event types, viral scores and reasons in one file.</p></div>{!onHold && <span className={styles.readyBadge}>Ready</span>}</div>
      {onHold && <p className={styles.notice}><ShieldAlert size={14} /> Publication is on hold: {output.rights_reason} The key moments are still available for review.</p>}
      <div className={styles.pipelineActions}>
        <button type="button" className={styles.secondary} onClick={onDownload}><FileJson size={15} /> Download key moments</button>
        {!onHold && !!byRank.length && <button type="button" className={styles.primary} disabled={!renderReady || rendering} onClick={onRender}>
          {rendering ? <LoaderCircle size={16} className={styles.spinner} /> : <Film size={16} />}{rendering ? 'Creating your highlight…' : videoUrl ? 'Create it again' : 'Create highlight video'}
        </button>}
      </div>
      {videoUrl && <>
        <video controls src={videoUrl} />
        <div className={styles.pipelineActions}><a className={styles.primary} href={videoUrl} download="matchwatch-highlight.mp4"><Download size={16} /> Download highlight</a></div>
        <p className={styles.actionHint}>720p MP4 · original audio · {byRank.length} moments in match order</p>
      </>}
    </section>
  </section>;
}

function MomentCard({ moment, onSeek }: { moment: Moment; onSeek: (seconds: number) => void }) {
  return <article className={styles.insightCard}>
    <div className={styles.insightTitle}>
      <div><span className={styles.momentRank}>#{moment.rank}</span><strong>{moment.label}</strong><small>{moment.match_time ? `${moment.match_time} · ` : ''}{clock(moment.start_time_seconds)}–{clock(moment.end_time_seconds)}{moment.team ? ` · ${moment.team}` : ''}</small></div>
      <div className={styles.scoreBadge}><strong>{moment.viral_score === null ? '—' : (moment.viral_score / 100).toFixed(2)}</strong><span>viral score</span></div>
    </div>
    <p className={styles.selectionReason}>{moment.reason}</p>
    <button type="button" className={styles.momentButton} onClick={() => onSeek(moment.start_time_seconds)}><span className={styles.momentPlay}><Play size={12} /></span> Watch this moment</button>
    <details className={styles.scoreDetails}>
      <summary>What went into this score? <ChevronDown size={14} /></summary>
      <div className={styles.scoreBars}>{factorKeys.map(key => {
        const value = moment.scores[scoreName[key]];
        return <div key={key}>
          <div><span>{factorLabels[key].symbol} · {factorLabels[key].name}</span><strong>{value === null ? 'Not available' : value.toFixed(2)}</strong></div>
          <div className={styles.scoreTrack} aria-hidden="true"><span style={{ width: `${(value ?? 0) * 100}%` }} /></div>
        </div>;
      })}</div>
      <ul className={styles.evidenceList}>{moment.evidence.map((item, index) => <li key={index}><b>{sourceLabels[item.source] ?? item.source}</b>{item.note}</li>)}</ul>
      <p className={styles.hint}><CircleCheck size={11} /> {Math.round(moment.confidence * 100)}% of the scoring weight is backed by evidence{moment.missing_signals.length ? `; missing: ${moment.missing_signals.join(', ').replaceAll('_', ' ')}` : ''}. Missing signals are left out and the remaining weights are renormalized.</p>
    </details>
  </article>;
}
