'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, MessageCircle, Sparkles, Check, LoaderCircle } from 'lucide-react';
import { fuseEvents, fusedScore, parsePosts, signalKeys, type SignalKey, type SocialPost, type FusionInputs, type SignalWeights } from '../../lib/event-fusion';
import { eventScore, type HighlightEvent } from '../../lib/highlight-plan';
import { optimizeHighlights } from '../../lib/highlight-optimizer';
import { highlightFetch } from '../../lib/highlight-session';
import { highlightResponse } from '../../lib/highlight-request';
import styles from './HighlightStudio.module.css';
const labels: Record<SignalKey, string> = { sports: 'The play', social: 'Fan engagement', emotion: 'Emotion', controversy: 'Surprise', audience: 'Audience fit' };
const localTime = (value: string) => { const d = new Date(value); return Number.isFinite(d.getTime()) ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19) : ''; };
const utcTime = (value: string) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : '';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const emptyPosts: SocialPost[] = [];
const emptyEvidence: Pick<FusionInputs, 'stats' | 'anchors' | 'audience'> = { stats: [], anchors: [] };
type Props = { weights: SignalWeights; priorityName: string; sourceReady: boolean; onSocialBusy?: (busy: boolean) => void; evidence?: Pick<FusionInputs, 'stats' | 'anchors' | 'audience'>; events: HighlightEvent[]; excluded: string[]; duration: number; target: number; before: number; after: number; disabled: boolean; onApply: (events: HighlightEvent[]) => void; onContext: (input: FusionInputs) => void };
export default function EventFusionStudio({ weights, priorityName, sourceReady, onSocialBusy, events, excluded, duration, target, before, after, disabled, onApply, onContext, evidence = emptyEvidence }: Props) {
  const [xEnabled, setXEnabled] = useState(false);
  const xController = useRef<AbortController | null>(null);
  const [loadedScope, setLoadedScope] = useState('');
  const [matchId, setMatchId] = useState(''), [posts, setPosts] = useState<SocialPost[]>([]);
  const [xQuery, setXQuery] = useState(''), [xStart, setXStart] = useState(''), [xEnd, setXEnd] = useState(''), [xBusy, setXBusy] = useState(false), [socialSource, setSocialSource] = useState('');
  const [videoUtc, setVideoUtc] = useState(''), [delay, setDelay] = useState(15), [tolerance, setTolerance] = useState(10), [error, setError] = useState('');
  const searchStart = xStart || videoUtc;
  const automaticEnd = videoUtc && Number.isFinite(Date.parse(videoUtc)) ? new Date(Date.parse(videoUtc) + Math.min(21600, duration + delay + tolerance) * 1000).toISOString() : '';
  const searchEnd = xEnd || automaticEnd;
  const searchQuery = xQuery.trim() || matchId.trim();
  const scope = JSON.stringify([matchId.trim(), searchQuery, searchStart, searchEnd]);
  const settingsChanged = !!loadedScope && loadedScope !== scope;
  const activePosts = xEnabled && !settingsChanged ? posts : emptyPosts;
  useEffect(() => onSocialBusy?.(xBusy), [xBusy, onSocialBusy]);
  useEffect(() => () => xController.current?.abort(), []);
  function toggleX(enabled: boolean) {
    setXEnabled(enabled); setError('');
    if (!enabled) { xController.current?.abort(); setXBusy(false); }
  }
  async function searchX() {
    if (!xEnabled || disabled || xBusy) return;
    xController.current?.abort();
    const abort = new AbortController(); xController.current = abort;
    setXBusy(true); setError('');
    try {
      const response = await highlightResponse(await highlightFetch((process.env.NEXT_PUBLIC_APP_BASE_PATH || '') + '/api/stream/social', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: searchQuery, matchId, start: searchStart, end: searchEnd }), signal: abort.signal }));
      const data = await response.json();
      if (abort.signal.aborted) return;
      setPosts(parsePosts(data.posts)); setLoadedScope(scope);
      setSocialSource(data.truncated ? 'Limited to the first 100 matching posts' : 'Search complete');
    } catch (e) { if (!abort.signal.aborted) setError((e as Error).message); }
    finally { if (xController.current === abort) setXBusy(false); }
  }
  const { stats, anchors, audience } = evidence;
  const context = useMemo(() => ({ matchId: matchId.trim() || 'video-only', stats, posts: activePosts, anchors, videoUtc, reactionDelay: delay, tolerance, audience }), [matchId, stats, activePosts, anchors, videoUtc, delay, tolerance, audience]);
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
  return <section className={`${styles.card} ${styles.insightsArea}`} aria-label="Highlight insights" hidden={!sourceReady && !events.length}>
    <div className={styles.socialOption}>
      <div className={styles.socialOptionHeader}><span className={styles.optionalIcon}><MessageCircle size={21} /></span><div><h2>Add fan reactions from X</h2><p>Optional. Your highlight works without it.</p></div><label className={styles.switchLabel}><input type="checkbox" role="switch" aria-label="Include X fan reactions" checked={xEnabled} disabled={disabled} onChange={e => toggleX(e.target.checked)} /><span className={styles.switchTrack} /><strong>{xEnabled ? 'On' : 'Off'}</strong></label></div>
      {xEnabled && <div className={styles.socialOptionBody}>
        <p className={styles.hint}>Choose the game and recording start time. We’ll use its duration to set the search window. Nothing is fetched until you choose “Load reactions”.</p>
        <div className={styles.row}><label>Game or teams<input value={matchId} maxLength={100} disabled={disabled || xBusy} onChange={e => setMatchId(e.target.value)} placeholder="e.g. Knicks vs 76ers" /></label><label>Recording starts at<input type="datetime-local" step="1" value={localTime(videoUtc)} disabled={disabled || xBusy} onChange={e => setVideoUtc(utcTime(e.target.value))} /></label></div>
        <p className={styles.hint}>Use the original game recording’s start time in your local timezone. Reactions may not align with edited or shortened videos.</p>
        <details className={styles.advanced}><summary>Refine the search <ChevronDown size={15} /></summary><div className={styles.detailsBody}>
          <label>Custom words or hashtags<input value={xQuery} maxLength={512} disabled={disabled || xBusy} onChange={e => setXQuery(e.target.value)} placeholder="Leave blank to use the game name" /></label>
          <div className={styles.row}><label>Search from<input type="datetime-local" value={localTime(xStart)} disabled={disabled || xBusy} onChange={e => setXStart(utcTime(e.target.value))} /><small>Leave blank to start with the recording.</small></label><label>Search until<input type="datetime-local" value={localTime(xEnd)} disabled={disabled || xBusy} onChange={e => setXEnd(utcTime(e.target.value))} /><small>Leave blank to use the video’s length.</small></label></div>
          <div className={styles.row}><label>Reaction delay (seconds)<input type="number" min="0" max="600" value={delay} disabled={disabled || xBusy} onChange={e => setDelay(Number(e.target.value))} /></label><label>Timing allowance (seconds)<input type="number" min="0" max="60" value={tolerance} disabled={disabled || xBusy} onChange={e => setTolerance(Number(e.target.value))} /></label></div>
          <p className={styles.hint}>Search windows can cover up to six hours. Availability depends on your X API access.</p>
        </div></details>
        <div className={styles.socialActions}><button type="button" className={styles.secondary} disabled={disabled || xBusy || !matchId.trim() || !searchQuery || !searchStart || !searchEnd || !videoUtc} onClick={() => void searchX()}>{xBusy ? <LoaderCircle size={16} className={styles.spinner} /> : <MessageCircle size={16} />}{xBusy ? 'Loading reactions…' : 'Load reactions'}</button><span>{xBusy ? 'Checking X for this game' : !videoUtc || !matchId.trim() ? 'Add the game and start time to continue.' : settingsChanged ? 'Search details changed. Reload reactions to apply them.' : 'You can leave this off and use video evidence alone.'}</span></div>
        {socialSource && !settingsChanged && <p role="status" className={styles.reactionStatus}>{posts.length ? <><Check size={15} />{posts.length} posts loaded · {matchedPosts} matched to candidate moments. {socialSource}</> : 'No posts matched this search. Your video-only highlight still works.'}</p>}
        {error && <div className={styles.error} role="alert"><strong>Fan reactions aren’t available right now</strong><p>{error}</p><p>You can switch X off and continue with your video.</p></div>}
      </div>}
    </div>
    {preview.error && <p role="alert" className={styles.error}>{preview.error}</p>}
    {events.some(event => event.jev) && <section className={styles.scoringPanel} aria-label="Highlight scoring">
      <div className={styles.scoringHeader}><div><p className={styles.eyebrow}>THE MOMENTS THAT MADE THE CUT</p><h2>Why these plays stand out</h2><p>{priorityName} priority, using the evidence available.</p></div><span className={styles.evidenceBadge}>{activePosts.length && matchedPosts ? 'Video + X reactions' : 'Video-based scoring'}</span></div>
      {!selected.length && <div className={styles.empty}><Sparkles size={25} /><h3>No verified moments selected yet</h3><p>Uncertain and repeated moments stay out of the automatic cut.</p></div>}
      <div className={styles.insightCards}>{[...selected].sort((a,b) => eventScore(b)-eventScore(a) || a.start-b.start).map((event,index) => {
        const result=fusedScore(event.viral!),known=signalKeys.filter(key=>event.viral!.values[key]!==null).length;
        return <article className={styles.insightCard} key={event.id}>
          <div className={styles.insightTitle}><div><span className={styles.momentRank}>#{index+1}</span><strong>{event.label}</strong><small>{clock(event.clipStart)}–{clock(event.clipEnd)}</small></div><div className={styles.scoreBadge}><strong>{result.score === null ? '—' : Math.round(result.score*100)}</strong><span>/ 100</span></div></div>
          <p className={styles.selectionReason}>{event.jev?.reason || 'Manually marked moment.'}</p>
          <details className={styles.scoreDetails}><summary>What went into this score? <ChevronDown size={14} /></summary><div className={styles.scoreBars}>{signalKeys.map(key=>{
            const value=event.viral!.values[key];
            return <div key={key}><div><span>{labels[key]}</span><strong>{value === null ? 'Not available' : `${Math.round(value*100)}/100`}</strong></div><div className={styles.scoreTrack} aria-hidden="true"><span style={{width:`${value === null ? 0 : value*100}%`}} /></div></div>;
          })}</div><p className={styles.hint}>{known} of 5 signals available. Missing signals are left out and the remaining weights adjust.</p></details>
        </article>;
      })}</div>
      <p className={styles.scoringNote}>Scores estimate a moment’s potential; they do not guarantee reach. Only verified, non-overlapping moments enter the automatic cut.</p>
      <details className={styles.advanced}><summary>See all reviewed moments <ChevronDown size={15} /></summary><div className={styles.detailsBody}><div className={styles.reviewedList}>{[...preview.events].filter(event=>event.jev).sort((a,b)=>eventScore(b)-eventScore(a)).map(event=>{
        const result=fusedScore(event.viral!);
        const reason=selectedIds.has(event.id)?'Selected':event.jev?.needs_review?'Not verified':event.jev?.duplicate_of?'Repeated moment':excluded.includes(event.id)?'Excluded':!event.jev?.recommend_include?'AI recommends skipping':'Outside the best combination';
        return <div key={event.id}><div><strong>{event.label}</strong><small>{clock(event.start)} · {reason}</small></div><span>{result.score === null ? 'Unavailable' : `${Math.round(result.score*100)}/100`}</span></div>;
      })}</div></div></details>
    </section>}
  </section>;
}
