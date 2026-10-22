'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { defaultSignalWeights, fuseEvents, fusedScore, parsePosts, signalKeys, type SignalKey, type SocialPost, type FusionInputs } from '../../lib/event-fusion';
import { eventScore, type HighlightEvent } from '../../lib/highlight-plan';
import { optimizeHighlights } from '../../lib/highlight-optimizer';
import { highlightFetch } from '../../lib/highlight-session';
import { highlightResponse } from '../../lib/highlight-request';
import styles from './HighlightStudio.module.css';
const labels: Record<SignalKey, string> = { sports: 'The play', social: 'Fan engagement', emotion: 'Emotion', controversy: 'Surprise', audience: 'Audience fit' };
const localTime = (value: string) => { const d = new Date(value); return Number.isFinite(d.getTime()) ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''; };
const utcTime = (value: string) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : '';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const emptyEvidence: Pick<FusionInputs, 'stats' | 'anchors' | 'audience'> = { stats: [], anchors: [] };
type Props = { evidence?: Pick<FusionInputs, 'stats' | 'anchors' | 'audience'>; events: HighlightEvent[]; excluded: string[]; duration: number; target: number; before: number; after: number; disabled: boolean; onApply: (events: HighlightEvent[]) => void; onContext: (input: FusionInputs) => void };
export default function EventFusionStudio({ events, excluded, duration, target, before, after, disabled, onApply, onContext, evidence = emptyEvidence }: Props) {
  const [matchId, setMatchId] = useState(''), [posts, setPosts] = useState<SocialPost[]>([]);
  const [xQuery, setXQuery] = useState(''), [xStart, setXStart] = useState(''), [xEnd, setXEnd] = useState(''), [xBusy, setXBusy] = useState(false), [socialSource, setSocialSource] = useState('');
  async function searchX() {
    setXBusy(true); setError('');
    try {
      const response = await highlightResponse(await highlightFetch(`${process.env.NEXT_PUBLIC_APP_BASE_PATH || ''}/api/stream/social`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: xQuery, matchId, start: xStart, end: xEnd }) }));
      const data = await response.json();
      setPosts(parsePosts(data.posts));
      setSocialSource(`X search sample${data.truncated ? ' (more results exist; limited to 100 posts)' : ''}`);
    } catch (e) { setError((e as Error).message); }
    finally { setXBusy(false); }
  }
  const [videoUtc, setVideoUtc] = useState(''), [delay, setDelay] = useState(15), [tolerance, setTolerance] = useState(10), [error, setError] = useState('');
  const weights = defaultSignalWeights;
  const { stats, anchors, audience } = evidence;
  const context = useMemo(() => ({ matchId: matchId.trim() || 'video-only', stats, posts, anchors, videoUtc, reactionDelay: delay, tolerance, audience }), [matchId, stats, posts, anchors, videoUtc, delay, tolerance, audience]);
  useEffect(() => onContext(context), [context, onContext]);
  const preview = useMemo(() => {
    try {
      return { events: fuseEvents(events, context, weights), error: '' };
    } catch (e) { return { events: [] as HighlightEvent[], error: (e as Error).message }; }
  }, [events, context, weights]);
  useEffect(() => {
    if (!disabled && !preview.error && preview.events.length && JSON.stringify(preview.events) !== JSON.stringify(events)) onApply(preview.events);
  }, [disabled, preview, events, onApply]);
  const selected = optimizeHighlights(preview.events.filter(event => !excluded.includes(event.id)), duration, target, before, after);
  const selectedIds = new Set(selected.map(event => event.id));
  const matchedPosts = new Set(preview.events.flatMap(event => event.viral?.postIds || [])).size;
  return <section className={styles.card} aria-label="Event fusion and ranking">
    <h2>A little context. A stronger highlight.</h2>
    <p className={styles.hint}>Your video is enough to get started. Add fan reactions when you want more context behind the selection.</p>
    <div className={styles.contextPanel}>
      <div className={styles.heading}><div><h3>Fan reactions from X</h3><p>See which moments got people talking.</p></div><span className={styles.readyBadge}>Optional</span></div>
      <div className={styles.row}><label>Game name or reference<input value={matchId} maxLength={100} disabled={disabled || xBusy} onChange={e => { setMatchId(e.target.value); setPosts([]); setSocialSource(''); }} placeholder="e.g. Knicks vs 76ers" /></label><label>Search words or hashtags<input value={xQuery} maxLength={512} disabled={disabled || xBusy} onChange={e => setXQuery(e.target.value)} placeholder="Knicks 76ers" /></label></div>
      <div className={styles.row}><label>From<input type="datetime-local" value={localTime(xStart)} disabled={disabled || xBusy} onChange={e => setXStart(utcTime(e.target.value))} /></label><label>Until<input type="datetime-local" value={localTime(xEnd)} disabled={disabled || xBusy} onChange={e => setXEnd(utcTime(e.target.value))} /></label></div>
      <p className={styles.hint}>Use the game’s time range, up to six hours. Times are shown in your local timezone.</p>
      <label>When did the recording start?<input type="datetime-local" value={localTime(videoUtc)} disabled={disabled || xBusy} onChange={e => setVideoUtc(utcTime(e.target.value))} /><small>This matches reactions to moments in a continuous recording. Reactions may not align with edited or shortened recordings.</small></label>
      <button type="button" className={styles.secondary} disabled={disabled || xBusy || !matchId.trim() || !xQuery.trim() || !xStart || !xEnd} onClick={() => void searchX()}>{xBusy ? 'Looking for reactions…' : 'Load fan reactions'}</button>
      {socialSource && <p role="status" className={styles.notice}>{posts.length ? `${posts.length} posts loaded. ${videoUtc ? 'Matching reactions to your video moments.' : 'Add the recording start time to match them to your video.'}` : 'No reactions found in that time range. Try different search words or dates.'}</p>}
    </div>
    {(error || preview.error) && <p role="alert" className={styles.error}>{error || preview.error}</p>}
    {!!events.length && <div className={styles.contextPanel}><h3>Why these moments stand out</h3><p className={styles.hint}>We consider the play, fan engagement, emotion, surprise and audience fit. Scores are estimates based on the evidence available.</p>
      {!selected.length && <p className={styles.hint}>There aren’t any verified moments selected yet. Your analysis results will appear here.</p>}
      <div className={styles.insightCards}>{selected.map(event => { const result = fusedScore(event.viral!); return <article className={styles.insightCard} key={event.id}><div className={styles.insightTitle}><strong>{event.label}</strong><span>{clock(event.clipStart)}–{clock(event.clipEnd)}</span></div><div className={styles.signalPills}>{signalKeys.map(key => <span key={key}>{labels[key]}<b>{event.viral!.values[key] === null ? 'Not available' : `${Math.round(event.viral!.values[key]! * 100)}/100`}</b></span>)}</div><p className={styles.hint}>{event.jev?.reason || 'Manually marked moment.'}</p><details><summary>See score details</summary><p className={styles.hint}>Overall estimate: {result.score === null ? 'Not available' : `${Math.round(result.score * 100)}/100`} · Evidence coverage: {Math.round(result.coverage * 100)}%</p><p className={styles.hint}>{event.viral!.reasons.join(' ')}</p></details></article>; })}</div>
    </div>}
    {posts.length > 0 && <details className={styles.advanced}><summary>Adjust reaction timing <ChevronDown size={15} /></summary><div className={styles.detailsBody}><p className={styles.hint}>Fans may react a few seconds after a play. Adjust this if reactions appear too early or too late.</p><div className={styles.row}><label>Reaction delay (seconds)<input type="number" min="0" max="600" value={delay} disabled={disabled} onChange={e => setDelay(Number(e.target.value))} /></label><label>Timing allowance (seconds)<input type="number" min="0" max="60" value={tolerance} disabled={disabled} onChange={e => setTolerance(Number(e.target.value))} /></label></div><p className={styles.hint}>{matchedPosts} reactions matched to moments. Timing alone does not verify a social claim.</p></div></details>}
    {!!events.length && <details className={styles.advanced}><summary>All scores & selection details <ChevronDown size={15} /></summary><div className={styles.detailsBody}><p className={styles.hint}>Scoring weights: sporting importance 30%, fan engagement 30%, emotion 20%, surprise 15%, audience fit 5%. Missing evidence is excluded and the remaining weights adjust proportionally.</p>
      <div style={{ overflowX:'auto' }}><table style={{ width:'100%', textAlign:'left' }}><thead><tr><th>Moment</th><th>Time</th>{signalKeys.map(key => <th key={key}>{labels[key]}</th>)}<th>Score</th><th>Selection</th></tr></thead><tbody>{[...preview.events].sort((a,b) => eventScore(b)-eventScore(a)).map(event => { const result=fusedScore(event.viral!); return <tr key={event.id}><td>{event.label}</td><td>{clock(event.start)}</td>{signalKeys.map(key => <td key={key}>{event.viral!.values[key]?.toFixed(2) ?? 'Unknown'}</td>)}<td>{result.score?.toFixed(2) ?? 'Unknown'}</td><td>{selectedIds.has(event.id) ? 'Selected' : 'Not selected'}</td></tr>; })}</tbody></table></div>
    </div></details>}
  </section>;
}
