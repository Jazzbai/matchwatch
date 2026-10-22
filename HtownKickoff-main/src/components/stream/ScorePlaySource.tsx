'use client';
import { useEffect, useRef, useState } from 'react';
import { highlightFetch } from '../../lib/highlight-session';
import { highlightResponse } from '../../lib/highlight-request';
import type { ScorePlayFilters } from '../../lib/scoreplay-filters';
import styles from './HighlightStudio.module.css';
const endpoint = `${process.env.NEXT_PUBLIC_APP_BASE_PATH || ''}/api/stream/scoreplay`;
type Media = { id: string; name: string; duration?: number; date?: number; match?: string };
type Option = { id: string; name: string };
type Catalog = { leagues: Option[]; seasons: Option[]; matches: Option[]; warning?: string };
export type ScorePlayVideo = { ticket: string; name: string; url: string; duration: number; bytes: number };
export default function ScorePlaySource({ disabled, onChoose }: { disabled: boolean; onChoose: (source: ScorePlayVideo) => void }) {
  const [query, setQuery] = useState(''), [media, setMedia] = useState<Media[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [filters, setFilters] = useState<ScorePlayFilters>({}), [catalog, setCatalog] = useState<Catalog>({ leagues: [], seasons: [], matches: [] });
  const [opened, setOpened] = useState(false), [page, setPage] = useState(1), [pages, setPages] = useState(1), [count, setCount] = useState(0);
  const [dirty, setDirty] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function change(key: keyof ScorePlayFilters, value: string) { setFilters(current => ({ ...current, [key]: value })); setDirty(true); }
  async function run(id?: string, nextPage = 1, reset = false) {
    const abort = new AbortController(); controller.current = abort; setBusy(true); setError('');
    const selected = reset ? {} : filters;
    try {
      if (id) {
        const response = await highlightResponse(await highlightFetch(`${endpoint}?mode=source&mediaId=${encodeURIComponent(id)}`, { method: 'POST', signal: abort.signal }));
        onChoose(await response.json()); return;
      }
      const params = new URLSearchParams({ q: reset ? '' : query, page: String(nextPage) });
      for (const [key, value] of Object.entries(selected)) if (value) params.set(key, value);
      if (!opened || reset) {
        const options = await highlightResponse(await highlightFetch(`${endpoint}?action=filters`, { signal: abort.signal }));
        setCatalog(await options.json());
      }
      const response = await highlightResponse(await highlightFetch(`${endpoint}?${params}`, { signal: abort.signal }));
      const data = await response.json(); setMedia(data.media); setPage(data.page); setPages(data.totalPages); setCount(data.count); setOpened(true); setDirty(false);
      if (reset) { setFilters({}); setQuery(''); }
    } catch (e) { if (!abort.signal.aborted) setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function chooseLeague(value: string) {
    setCatalog(current => ({ ...current, matches: [] }));
    setFilters(current => ({ ...current, leagueId: value, matchId: '' })); setDirty(true);
    const abort = new AbortController(); controller.current = abort; setBusy(true); setError('');
    try {
      const response = await highlightResponse(await highlightFetch(`${endpoint}?action=filters&leagueId=${encodeURIComponent(value)}`, { signal: abort.signal }));
      setCatalog(await response.json());
    } catch (e) { if (!abort.signal.aborted) setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section style={{ marginBottom: 20 }} aria-label="ScorePlay library">
    <h3>Use your ScorePlay library</h3>
    <p className={styles.hint}>Connect with your saved account key, filter the library, then choose a game. No local video upload is needed.</p>
    <button type="button" className={styles.primary} disabled={disabled || busy} onClick={() => void run()}>Open ScorePlay library</button>
    {opened && <form onSubmit={e => { e.preventDefault(); void run(); }}>
      <div className={styles.row}>
        <label>League / competition<select value={filters.leagueId || ''} disabled={disabled || busy} onChange={e => void chooseLeague(e.target.value)}><option value="">All leagues / collections</option>{catalog.leagues.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <label>Season<select value={filters.seasonId || ''} disabled={disabled || busy || !catalog.seasons.length} onChange={e => { change('seasonId', e.target.value); change('matchId', ''); }}><option value="">{catalog.seasons.length ? 'All seasons' : 'No named seasons in this library'}</option>{catalog.seasons.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      </div>
      <div className={styles.row}>
        <label>Match / collection<select value={filters.matchId || ''} disabled={disabled || busy || !filters.leagueId} onChange={e => change('matchId', e.target.value)}><option value="">{filters.leagueId ? 'All matches in this league' : 'Choose a league first'}</option>{catalog.matches.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <label>Media year<input type="number" min="1970" max="2100" placeholder="All years" value={filters.year || ''} disabled={disabled || busy} onChange={e => change('year', e.target.value)} /></label>
      </div>
      <div className={styles.row}>
        <label>From date<input type="date" value={filters.from || ''} disabled={disabled || busy} onChange={e => change('from', e.target.value)} /></label>
        <label>Through date<input type="date" value={filters.to || ''} disabled={disabled || busy} onChange={e => change('to', e.target.value)} /></label>
      </div>
      <div className={styles.row}>
        <label>Video filename<input value={query} maxLength={120} disabled={disabled || busy} onChange={e => { setQuery(e.target.value); setDirty(true); }} placeholder="Search within the selected filters" /></label>
        <label>Sort uploads<select value={filters.order || 'newest'} disabled={disabled || busy} onChange={e => change('order', e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      </div>
      <p className={styles.hint}>Year and date filters use ScorePlay’s media date in UTC. Named seasons use ScorePlay’s season associations. {catalog.warning}</p>
      <button className={styles.secondary} disabled={disabled || busy}>Search library</button>{' '}
      <button type="button" className={styles.secondary} disabled={disabled || busy} onClick={() => void run(undefined, 1, true)}>Clear filters</button>
    </form>}
    {busy && <p role="status">Loading ScorePlay… <button type="button" onClick={() => controller.current?.abort()}>Cancel</button></p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {opened && <p role="status">{dirty ? 'Filters changed. Search to refresh these results.' : `${count} matching videos${count ? ` · page ${page} of ${pages}` : ''}`}</p>}
    {opened && !media.length && !busy && <p>No videos match these filters. Adjust the year, date range or match selection.</p>}
    {media.map(item => <div key={item.id} style={{ marginTop: 12 }}><button type="button" className={styles.secondary} disabled={disabled || busy || dirty} onClick={() => void run(item.id)}>Use {item.name}</button><p className={styles.hint}>{item.match}{item.date ? ` · ${new Date(item.date * 1000).toISOString().slice(0, 10)}` : ''}{Number.isFinite(item.duration) && item.duration! > 0 ? ` · ${Math.round(item.duration!)} seconds` : ''}</p></div>)}
    {opened && pages > 1 && <div className={styles.row}><button type="button" className={styles.secondary} disabled={disabled || busy || dirty || page <= 1} onClick={() => void run(undefined, page - 1)}>Previous</button><button type="button" className={styles.secondary} disabled={disabled || busy || dirty || page >= pages || page >= 100} onClick={() => void run(undefined, page + 1)}>Next</button></div>}
    <p className={styles.hint}>Hackathon production requires the existing TwelveLabs mapping. External import and export remain disabled by default.</p>
  </section>;
}
