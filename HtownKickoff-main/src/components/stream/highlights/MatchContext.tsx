'use client';
import { ChevronDown, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { eventCatalog } from '../../../lib/highlights/catalog';
import type { ClockAnchor, EventType, MatchEvent, MatchInput, Sport } from '../../../lib/highlights/types';
import styles from '../HighlightStudio.module.css';

export type EventRow = { id: string; period: 1 | 2; minute: string; type: EventType; team: string; player: string };
export type MatchForm = {
  title: string;
  homeTeam: string;
  awayTeam: string;
  recordingStart: string;
  reactionDelaySeconds: number;
  events: EventRow[];
  kickoffs: Record<1 | 2, string>;
  socialEnabled: boolean;
  socialQuery: string;
  rightsDeclared: boolean;
};
export const emptyMatchForm: MatchForm = {
  title: '', homeTeam: '', awayTeam: '', recordingStart: '', reactionDelaySeconds: 20,
  events: [], kickoffs: { 1: '', 2: '' }, socialEnabled: false, socialQuery: '', rightsDeclared: false,
};

const seconds = (value: string) => {
  const match = value.trim().match(/^(\d{1,3}):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/** Converts the form into the API's match input (steps 2 and 3 of the diagram). */
export function toMatchInput(form: MatchForm, fallbackTitle: string): Omit<MatchInput, 'matchId'> {
  const anchors: ClockAnchor[] = ([1, 2] as const).flatMap(period => {
    const videoSeconds = seconds(form.kickoffs[period]);
    return videoSeconds === null ? [] : [{ period, videoSeconds }];
  });
  const events: MatchEvent[] = form.events.flatMap(row => {
    const [minute, stoppage] = row.minute.split('+').map(part => Number(part.trim()));
    if (!Number.isFinite(minute) || minute < 0) return [];
    return [{
      id: row.id, period: row.period, minute, type: row.type,
      ...(Number.isFinite(stoppage) && stoppage > 0 ? { stoppage } : {}),
      ...(row.team.trim() ? { team: row.team.trim() } : {}),
      ...(row.player.trim() ? { player: row.player.trim() } : {}),
    }];
  });
  const start = form.recordingStart ? new Date(form.recordingStart) : null;
  return {
    title: form.title.trim() || fallbackTitle,
    homeTeam: form.homeTeam.trim() || undefined,
    awayTeam: form.awayTeam.trim() || undefined,
    videoStartUtc: start && Number.isFinite(start.getTime()) ? start.toISOString() : undefined,
    reactionDelaySeconds: form.reactionDelaySeconds,
    events, anchors,
    social: { enabled: form.socialEnabled, query: form.socialQuery.trim() || undefined },
    rightsDeclared: form.rightsDeclared,
  };
}

type Props = { form: MatchForm; onChange: (form: MatchForm) => void; sport: Sport; disabled: boolean; socialReady: boolean; isUpload: boolean };

/** Diagram steps 2 and 3: optional official match events and X fan reactions. */
export default function MatchContext({ form, onChange, sport, disabled, socialReady, isUpload }: Props) {
  const set = (changes: Partial<MatchForm>) => onChange({ ...form, ...changes });
  const setRow = (id: string, changes: Partial<EventRow>) => set({ events: form.events.map(row => (row.id === id ? { ...row, ...changes } : row)) });
  const addRow = () => set({ events: [...form.events, { id: `event-${Date.now()}`, period: 1, minute: '', type: sport === 'Soccer' ? 'goal' : 'dunk', team: '', player: '' }] });
  return <section className={styles.card} id="match">
    <div className={styles.heading}><span>02</span><div><h2>Match context</h2><p>Optional. Official events and fan reactions make the ranking trend-aware.</p></div></div>
    <div className={styles.row}>
      <label>Match name<input value={form.title} maxLength={200} disabled={disabled} onChange={event => set({ title: event.target.value })} placeholder="Manchester United vs Spurs" /></label>
    </div>
    <div className={styles.row}>
      <label>Home team<input value={form.homeTeam} maxLength={80} disabled={disabled} onChange={event => set({ homeTeam: event.target.value })} placeholder="Manchester United" /></label>
      <label>Away team<input value={form.awayTeam} maxLength={80} disabled={disabled} onChange={event => set({ awayTeam: event.target.value })} placeholder="Tottenham Hotspur" /></label>
    </div>

    <details className={styles.advanced}>
      <summary><span>Official match statistics<small>{form.events.length ? `${form.events.length} events` : 'Goals, cards, substitutions with match time'}</small></span><ChevronDown size={15} /></summary>
      <div className={styles.detailsBody}>
        <p className={styles.hint}>Video time and match time differ. Enter when each half kicks off in the video (mm:ss) so official events can be aligned to the footage.</p>
        <div className={styles.row}>
          <label>1st half kickoff in video<input value={form.kickoffs[1]} disabled={disabled} placeholder="e.g. 2:15" onChange={event => set({ kickoffs: { ...form.kickoffs, 1: event.target.value } })} /></label>
          <label>2nd half kickoff in video<input value={form.kickoffs[2]} disabled={disabled} placeholder="e.g. 63:40" onChange={event => set({ kickoffs: { ...form.kickoffs, 2: event.target.value } })} /></label>
        </div>
        {!!form.events.length && <table className={styles.eventsTable}>
          <thead><tr><th>Half</th><th>Time</th><th>Event</th><th>Team</th><th>Player</th><th /></tr></thead>
          <tbody>{form.events.map(row => <tr key={row.id}>
            <td><select value={row.period} disabled={disabled} onChange={event => setRow(row.id, { period: Number(event.target.value) as 1 | 2 })} aria-label="Half"><option value={1}>1st</option><option value={2}>2nd</option></select></td>
            <td><input value={row.minute} disabled={disabled} onChange={event => setRow(row.id, { minute: event.target.value })} placeholder="65 or 90+4" aria-label="Match minute" /></td>
            <td><select value={row.type} disabled={disabled} onChange={event => setRow(row.id, { type: event.target.value as EventType })} aria-label="Event type">{Object.entries(eventCatalog).map(([type, item]) => <option key={type} value={type}>{item.label}</option>)}</select></td>
            <td><input value={row.team} maxLength={80} disabled={disabled} onChange={event => setRow(row.id, { team: event.target.value })} placeholder="TOT" aria-label="Team" /></td>
            <td><input value={row.player} maxLength={80} disabled={disabled} onChange={event => setRow(row.id, { player: event.target.value })} placeholder="Solanke" aria-label="Player" /></td>
            <td><button type="button" className={styles.iconButton} disabled={disabled} onClick={() => set({ events: form.events.filter(item => item.id !== row.id) })} aria-label="Remove event"><Trash2 size={14} /></button></td>
          </tr>)}</tbody>
        </table>}
        <button type="button" className={styles.secondary} disabled={disabled || form.events.length >= 40} onClick={addRow}><Plus size={15} /> Add official event</button>
      </div>
    </details>

    <div className={styles.socialOption}>
      <div className={styles.socialOptionHeader}>
        <span className={styles.optionalIcon}><MessageCircle size={19} /></span>
        <div><h3>Fan reactions from X</h3><p>{socialReady ? 'Measures post spikes and engagement around each moment.' : 'X access is not configured on this server; scoring continues without it.'}</p></div>
        <label className={styles.switchLabel}>
          <input type="checkbox" role="switch" aria-label="Include X fan reactions" checked={form.socialEnabled} disabled={disabled} onChange={event => set({ socialEnabled: event.target.checked })} />
          <span className={styles.switchTrack} /><strong>{form.socialEnabled ? 'On' : 'Off'}</strong>
        </label>
      </div>
      {form.socialEnabled && <div className={styles.socialOptionBody}>
        <div className={styles.row}>
          <label>Recording starts at<input type="datetime-local" step="1" value={form.recordingStart} disabled={disabled} onChange={event => set({ recordingStart: event.target.value })} /><small>Your local time when video second 0 aired.</small></label>
          <label>Reaction delay (seconds)<input type="number" min={0} max={600} value={form.reactionDelaySeconds} disabled={disabled} onChange={event => set({ reactionDelaySeconds: Math.max(0, Math.min(600, Number(event.target.value))) })} /><small>Typical lag before fans post.</small></label>
        </div>
        <label>Search words or hashtags<input value={form.socialQuery} maxLength={512} disabled={disabled} onChange={event => set({ socialQuery: event.target.value })} placeholder="Leave blank to search the team names" /></label>
        <p className={styles.hint}>X recent search covers about the last seven days. Missing X data is reported, never invented.</p>
      </div>}
    </div>

    {isUpload && <div className={styles.row}><label className={styles.checkLabel}>
      <input type="checkbox" checked={form.rightsDeclared} disabled={disabled} onChange={event => set({ rightsDeclared: event.target.checked })} />
      I own or am licensed to use this footage (required to create the highlight video).
    </label></div>}
  </section>;
}
