'use client';
import { useMemo, useState } from 'react';
import { defaultSignalWeights, fuseEvents, fusedScore, parseAnchors, parsePosts, parseStats, signalKeys, statsVideoTime, type ClockAnchor, type MatchStat, type SignalKey, type SocialPost } from '../../lib/event-fusion';
import { eventScore, type HighlightEvent } from '../../lib/highlight-plan';
import { optimizeHighlights } from '../../lib/highlight-optimizer';
import styles from './HighlightStudio.module.css';
const labels: Record<SignalKey, string> = { sports: 'Sports importance', social: 'Social trend (sample)', emotion: 'Emotional intensity', controversy: 'Controversy / surprise', audience: 'Audience relevance', quality: 'Watchability / quality' };
const symbols: Record<SignalKey, string> = { sports: 'S', social: 'T', emotion: 'E', controversy: 'C', audience: 'A', quality: 'Q' };
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
type Props = { events: HighlightEvent[]; excluded: string[]; duration: number; target: number; before: number; after: number; disabled: boolean; onApply: (events: HighlightEvent[]) => void };
export default function EventFusionStudio({ events, excluded, duration, target, before, after, disabled, onApply }: Props) {
  const [matchId, setMatchId] = useState(''), [stats, setStats] = useState<MatchStat[]>([]), [posts, setPosts] = useState<SocialPost[]>([]);
  const [anchors, setAnchors] = useState<ClockAnchor[]>([]), [period, setPeriod] = useState('Q1'), [matchClock, setMatchClock] = useState(720), [videoClock, setVideoClock] = useState(0), [periodLength, setPeriodLength] = useState(720), [direction, setDirection] = useState<'up' | 'down'>('down');
  const [videoUtc, setVideoUtc] = useState(''), [delay, setDelay] = useState(15), [tolerance, setTolerance] = useState(10), [weights, setWeights] = useState({ ...defaultSignalWeights }), [error, setError] = useState('');
  async function read(file: File | undefined, type: 'stats' | 'posts') {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Use a JSON snapshot smaller than 1 MB.');
      const value = JSON.parse(await file.text());
      if (type === 'stats') setStats(parseStats(value)); else setPosts(parsePosts(value));
      setError('');
    } catch (e) { setError((e as Error).message); }
  }
  const preview = useMemo(() => {
    if (!matchId.trim()) return { events: [] as HighlightEvent[], error: '' };
    try {
      return { events: fuseEvents(events, { matchId: matchId.trim(), stats, posts, anchors, videoUtc, reactionDelay: delay, tolerance }, weights), error: '' };
    } catch (e) { return { events: [] as HighlightEvent[], error: (e as Error).message }; }
  }, [events, matchId, stats, posts, anchors, videoUtc, delay, tolerance, weights]);
  const selected = optimizeHighlights(preview.events.filter(event => !excluded.includes(event.id)), duration, target, before, after);
  const selectedIds = new Set(selected.map(event => event.id));
  const alignedStats = stats.filter(stat => stat.matchId === matchId.trim() && statsVideoTime(stat, anchors) !== null).length;
  const matchedPosts = new Set(preview.events.flatMap(event => event.viral?.postIds || [])).size;
  const weightTotal = signalKeys.reduce((sum, key) => sum + weights[key], 0);
  return <section className={styles.card} aria-label="Event fusion and ranking">
    <h2>Match data, fan reactions & event fusion</h2>
    <p>Combine reviewed video moments with aligned match events and observed fan engagement, then approve a revised highlight proposal.</p>
    <p className={styles.hint}>Video source: recorded footage through the existing studio. HLS/live ingestion is not connected.</p>
    <div className={styles.row}>
      <div><h3>Match statistics</h3><p className={styles.hint}>{stats.length ? `${stats.length} imported events · snapshot, not a live feed` : 'Statistics API not connected. Import a JSON snapshot to test the workflow.'}</p><input type="file" accept=".json,application/json" disabled={disabled || !duration} aria-label="Import match statistics JSON" onChange={e => void read(e.target.files?.[0], 'stats')} />{stats.length > 0 && <button type="button" className={styles.secondary} disabled={disabled} onClick={() => setStats([])}>Clear statistics</button>}</div>
      <div><h3>Social reactions / X</h3><p className={styles.hint}>{posts.length ? `${posts.length} imported posts · snapshot, not a live feed` : 'Social API not connected. Imported posts can provide sample engagement.'}</p><input type="file" accept=".json,application/json" disabled={disabled || !duration} aria-label="Import social reactions JSON" onChange={e => void read(e.target.files?.[0], 'posts')} />{posts.length > 0 && <button type="button" className={styles.secondary} disabled={disabled} onClick={() => setPosts([])}>Clear reactions</button>}</div>
    </div>
    <label>Match ID shared by both feeds<input value={matchId} maxLength={100} disabled={disabled} onChange={e => setMatchId(e.target.value)} placeholder="Exact provider match ID" /></label>
    <details><summary>JSON snapshot formats</summary><p className={styles.hint}>These are format examples, not loaded match data. Match eventType must match the candidate label (ignoring case and punctuation). Optional importance, controversy and audience scores are editorial inputs from 0 to 1; missing values remain unknown.</p><pre style={{ overflowX: 'auto' }}>{JSON.stringify([{ id: 'event-id', matchId: 'your-match-id', period: 'Q1', clockSeconds: 600, eventType: 'Dunk' }], null, 2)}</pre><pre style={{ overflowX: 'auto' }}>{JSON.stringify([{ id: 'post-id', matchId: 'your-match-id', postedAt: '2026-10-22T18:00:00Z', likes: 10, replies: 2, reposts: 1 }], null, 2)}</pre></details>
    <h3>Time alignment</h3>
    <p className={styles.hint}>Add one clock anchor for each period. Basketball clocks count down; soccer usually counts up. Period breaks need separate anchors. Events without a matching period anchor stay unaligned.</p>
    <div className={styles.row}><label>Period<input value={period} maxLength={40} disabled={disabled} onChange={e => setPeriod(e.target.value)} /></label><label>Clock direction<select value={direction} disabled={disabled} onChange={e => setDirection(e.target.value as 'up' | 'down')}><option value="down">Countdown</option><option value="up">Count up</option></select></label></div>
    <div className={styles.row}><label>Match clock at anchor (seconds)<input type="number" min="0" max="14400" value={matchClock} disabled={disabled} onChange={e => setMatchClock(Number(e.target.value))} /></label><label>Video time at anchor (seconds)<input type="number" min="0" max={duration || 14400} value={videoClock} disabled={disabled} onChange={e => setVideoClock(Number(e.target.value))} /></label></div>
    <label>Period span after anchor (seconds)<input type="number" min="1" max="7200" value={periodLength} disabled={disabled} onChange={e => setPeriodLength(Number(e.target.value))} /></label>
    <button type="button" className={styles.secondary} disabled={disabled || !duration} onClick={() => { try { setAnchors(parseAnchors([...anchors.filter(anchor => anchor.period !== period), { period, clockSeconds: matchClock, videoSeconds: videoClock, direction, duration: periodLength }])); setError(''); } catch (e) { setError((e as Error).message); } }}>Save period anchor</button>
    {anchors.map(anchor => <p key={anchor.period}>{anchor.period}: match {clock(anchor.clockSeconds)} = video {clock(anchor.videoSeconds)} <button type="button" disabled={disabled} onClick={() => setAnchors(current => current.filter(item => item.period !== anchor.period))}>Remove</button></p>)}
    <div className={styles.row}><label>UTC timestamp of video second zero<input value={videoUtc} maxLength={60} disabled={disabled} placeholder="YYYY-MM-DDTHH:mm:ssZ" onChange={e => setVideoUtc(e.target.value)} /></label><label>Social reaction delay (seconds)<input type="number" min="0" max="600" value={delay} disabled={disabled} onChange={e => setDelay(Number(e.target.value))} /></label></div>
    <label>Alignment tolerance (seconds)<input type="number" min="0" max="60" value={tolerance} disabled={disabled} onChange={e => setTolerance(Number(e.target.value))} /></label>
    <p className={styles.hint}>Social alignment assumes a continuous recording at the UTC anchor. It needs recalibration for edited broadcasts. No sentiment, controversy or audience score is inferred from timing alone.</p>
    <p>{alignedStats} same-match statistics aligned to a period · {matchedPosts} distinct posts associated with candidate windows · {events.filter(event => event.jev).length} video reviews available</p>
    <h3>Viral potential analysis</h3>
    <h4>Six-factor score weights</h4>
    <div className={styles.row}>{signalKeys.map(key => <label key={key}>{labels[key]}<input type="number" min="0" max="1" step="0.05" value={weights[key]} disabled={disabled} onChange={e => setWeights(current => ({ ...current, [key]: Math.max(0, Math.min(1, Number(e.target.value))) }))} /></label>)}</div>
    <p className={styles.hint}>Scores use a weighted average of known factors. Sports, emotion and quality default to Jev importance, excitement and watchability. Evidence coverage shows the fraction of weight supported by data. Social trend means relative engagement in the imported sample; sentiment is not analyzed. Event variety is shown for producer review. These estimates are not calibrated probabilities.</p>
    {(error || preview.error) && <p role="alert" className={styles.error}>{error || preview.error}</p>}
    <h3>Rank all moments</h3>
    {!matchId && <p>Set a match ID to preview the combined ranking. You can rank video evidence alone while APIs are pending.</p>}
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}><thead><tr><th>Moment</th><th>Video time</th>{signalKeys.map(key => <th key={key} title={labels[key]}>{symbols[key]}</th>)}<th>Score</th><th>Evidence coverage</th><th>Proposal</th></tr></thead><tbody>{[...preview.events].sort((a, b) => eventScore(b) - eventScore(a)).map(event => {
      const result = fusedScore(event.viral!);
      const reason = excluded.includes(event.id) ? 'Unchecked by producer' : event.jev?.needs_review && !event.reviewOverride ? 'Needs review' : event.jev?.duplicate_of && !event.reviewOverride ? 'Duplicate' : !event.reviewOverride && event.jev && !event.jev.recommend_include ? 'AI recommends skip' : 'Outside best combination / budget';
      return <tr key={event.id}><td>{event.label}</td><td>{clock(event.start)}</td>{signalKeys.map(key => <td key={key}>{event.viral!.values[key]?.toFixed(2) ?? '—'}</td>)}<td>{event.reviewOverride ? 'Manual override' : result.score?.toFixed(2) ?? 'Unknown'}</td><td>{Math.round(result.coverage * 100)}%</td><td>{selectedIds.has(event.id) ? 'Selected' : reason}</td></tr>;
    })}</tbody></table></div>
    <p>{selected.length} proposed clips · {clock(selected.reduce((sum, clip) => sum + clip.clipEnd - clip.clipStart, 0))} of {clock(target)} · {new Set(selected.map(clip => clip.label)).size} event labels</p>
    <details><summary>Evidence and reasons</summary>{preview.events.map(event => <p key={event.id}><strong>{event.label}</strong><br />Statistics: {event.viral!.statsIds.join(', ') || 'None aligned'} · Posts: {event.viral!.postIds.join(', ') || 'None aligned'}<br />{event.viral!.reasons.join(' ')}</p>)}</details>
    <button type="button" className={styles.primary} disabled={disabled || !preview.events.some(event => fusedScore(event.viral!).score !== null) || !!preview.error || weightTotal <= 0} onClick={() => onApply(preview.events)}>Approve scores & update highlight proposal</button>
    <p className={styles.hint}>Approval updates the existing selector; uncertain or duplicate AI moments remain excluded unless you explicitly override them. Generating or publishing a video is a separate action.</p>
  </section>;
}
