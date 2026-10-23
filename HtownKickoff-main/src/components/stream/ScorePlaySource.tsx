'use client';
import { useEffect, useRef, useState } from 'react';
import { Library, Search, Film, ArrowRight, ChevronDown, LoaderCircle } from 'lucide-react';
import { highlightFetch } from '../../lib/highlight-session';
import { highlightResponse } from '../../lib/highlight-request';
import type { ScorePlayFilters } from '../../lib/scoreplay-filters';
import styles from './HighlightStudio.module.css';
const endpoint = `${process.env.NEXT_PUBLIC_APP_BASE_PATH || ''}/api/stream/scoreplay`;
type Media = { id: string; name: string; duration?: number; date?: number; match?: string; aiReady?: boolean };
type Option = { id: string; name: string };
type Catalog = { leagues: Option[]; seasons: Option[]; matches: Option[]; warning?: string };
export type ScorePlayVideo = { ticket: string; mediaId: string; name: string; url: string; duration: number; bytes: number; assetTicket: string; indexedTicket: string; matchedBy: 'metadata' | 'filename'; canExport: false };
export default function ScorePlaySource({ disabled, onChoose }: { disabled: boolean; onChoose: (source: ScorePlayVideo) => void }) {
  const [query, setQuery] = useState(''), [media, setMedia] = useState<Media[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [filters, setFilters] = useState<ScorePlayFilters>({}), [catalog, setCatalog] = useState<Catalog>({ leagues: [], seasons: [], matches: [] });
  const [opened, setOpened] = useState(false), [page, setPage] = useState(1), [pages, setPages] = useState(1), [count, setCount] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [mappingStatus, setMappingStatus] = useState('');
  const [readyOnly, setReadyOnly] = useState(true);
  const [availability, setAvailability] = useState<{ indexName: string; mappedCount: number; libraryCount: number } | null>(null);
  const [errorTitle, setErrorTitle] = useState('We couldn’t load the library');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function change(key: keyof ScorePlayFilters, value: string) { setFilters(current => ({ ...current, [key]: value })); setDirty(true); }
  async function run(id?: string, nextPage = 1, reset = false, onlyReady = readyOnly) {
    const abort = new AbortController(); controller.current = abort; setBusy(true); setError('');
    const selected = reset ? {} : filters;
    try {
      if (id) {
        const selectedResponse = await highlightFetch(`${endpoint}?mode=source&mediaId=${encodeURIComponent(id)}`, { method: 'POST', signal: abort.signal });
        const problem = selectedResponse.ok ? null : await selectedResponse.clone().json().catch(() => null);
        setErrorTitle(problem?.code === 'SCOREPLAY_NOT_INDEXED' ? 'This video is not ready for AI' : 'We couldn’t open that video');
        const response = await highlightResponse(selectedResponse);
        onChoose(await response.json()); return;
      }
      setErrorTitle('We couldn’t load the library');
      const params = new URLSearchParams({ q: reset ? '' : query, page: String(nextPage), readyOnly: String(onlyReady) });
      for (const [key, value] of Object.entries(selected)) if (value) params.set(key, value);
      if (!opened || reset) {
        const options = await highlightResponse(await highlightFetch(`${endpoint}?action=filters`, { signal: abort.signal }));
        setCatalog(await options.json());
      }
      const response = await highlightResponse(await highlightFetch(`${endpoint}?${params}`, { signal: abort.signal }));
      const data = await response.json(); setMedia(data.media); setPage(data.page); setPages(data.totalPages); setCount(data.count); setOpened(true); setDirty(false);
      setAvailability(data.availability ?? null);
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
  async function refreshMapping() {
    const abort = new AbortController(); controller.current = abort; setBusy(true); setError(''); setMappingStatus('Refreshing the shared AI index mapping…');
    try { const response = await highlightResponse(await highlightFetch(`${endpoint}?action=mapping&refresh=true`, { signal: abort.signal })); const data = await response.json(); setMappingStatus(`${data.mappedCount} of ${data.scoreplayCount} videos ready for AI · Index: ${data.indexName} (${data.indexCount} videos).`); }
    catch (error) { if (!abort.signal.aborted) { setError((error as Error).message); setMappingStatus('Mapping refresh failed. Retry when the shared index is accessible.'); } }
    finally { setBusy(false); }
  }
  return <section aria-label="ScorePlay library">
    <div className={styles.choices} role="group" aria-label="AI availability">
      <button type="button" aria-pressed={readyOnly} disabled={disabled || busy} onClick={() => { setReadyOnly(true); void run(undefined, 1, false, true); }}>Ready for AI</button>
      <button type="button" aria-pressed={!readyOnly} disabled={disabled || busy} onClick={() => { setReadyOnly(false); void run(undefined, 1, false, false); }}>All ScorePlay videos</button>
    </div>
    {availability && <p className={styles.libraryStatus}>{availability.mappedCount} of {availability.libraryCount} videos ready for AI · {availability.indexName}. Videos outside this index need an indexed copy from the organizers.</p>}
    {!opened && <div className={styles.libraryIntro}><Library size={31} /><h3>Your games, already in ScorePlay</h3><p>Find a recording in your team’s library. Filter by league, season or match.</p><button type="button" className={styles.secondary} disabled={disabled || busy} onClick={() => void run()}>{busy ? <LoaderCircle size={16} className={styles.spinner} /> : <Search size={16} />} Open ScorePlay library</button></div>}
    {opened && <><div className={styles.libraryToolbar}><strong>Find your game</strong><button type="button" className={styles.secondary} disabled={disabled || busy} onClick={() => void run()}>Refresh</button></div><form onSubmit={e => { e.preventDefault(); void run(); }}>
      <div className={styles.row}><label>League<select value={filters.leagueId || ''} disabled={disabled || busy} onChange={e => void chooseLeague(e.target.value)}><option value="">All leagues</option>{catalog.leagues.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Season<select value={filters.seasonId || ''} disabled={disabled || busy || !catalog.seasons.length} onChange={e => { change('seasonId', e.target.value); change('matchId', ''); }}><option value="">All seasons</option>{catalog.seasons.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label></div>
      <label>Match<select value={filters.matchId || ''} disabled={disabled || busy || !filters.leagueId} onChange={e => change('matchId', e.target.value)}><option value="">{filters.leagueId ? 'All matches' : 'Choose a league to see matches'}</option>{catalog.matches.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <div className={styles.row}><label>Search videos<input value={query} maxLength={120} disabled={disabled || busy} onChange={e => { setQuery(e.target.value); setDirty(true); }} placeholder="Team, match or video name" /></label></div>
      <details className={styles.advanced}><summary>More filters <ChevronDown size={14} /></summary><div className={styles.detailsBody}><div className={styles.row}><label>Year<input type="number" min="1970" max="2100" placeholder="Any year" value={filters.year || ''} disabled={disabled || busy} onChange={e => change('year', e.target.value)} /></label><label>Sort by<select value={filters.order || 'newest'} disabled={disabled || busy} onChange={e => change('order', e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div><div className={styles.row}><label>From<input type="date" value={filters.from || ''} disabled={disabled || busy} onChange={e => change('from', e.target.value)} /></label><label>Until<input type="date" value={filters.to || ''} disabled={disabled || busy} onChange={e => change('to', e.target.value)} /></label></div><p className={styles.hint}>Dates refer to when the media was recorded in ScorePlay. {catalog.warning}</p></div></details>
      <div className={styles.searchButtonRow}><button className={styles.primary} disabled={disabled || busy}><Search size={15} /> Find videos</button><button type="button" className={styles.secondary} disabled={disabled || busy} onClick={() => void run(undefined, 1, true)}>Reset</button></div>
    </form></>}
    {opened && <button type="button" className={styles.textButton} disabled={busy || disabled} onClick={() => void refreshMapping()}>Refresh AI mapping</button>}
    {mappingStatus && <p role="status" className={styles.libraryStatus}>{mappingStatus}</p>}
    {busy && <p role="status" className={styles.libraryStatus}>Connecting to your library and AI index… <button type="button" className={styles.textButton} onClick={() => controller.current?.abort()}>Cancel</button></p>}
    {error && <div className={styles.error} role="alert"><strong>{errorTitle}</strong><p>{error}</p></div>}
    {opened && <p role="status" className={styles.libraryStatus}>{dirty ? 'Choose “Find videos” to apply your changes.' : `${count} videos found${count ? ` · Page ${page} of ${pages}` : ''}`}</p>}
    {opened && !media.length && !busy && <div className={styles.empty}><Search size={24} /><h3>{readyOnly ? 'No AI-ready videos match these filters' : 'No videos found'}</h3><p>{readyOnly ? 'Try Premier League or clear your filters. This AI index does not include every ScorePlay video.' : 'Try a different team, season or date range.'}</p></div>}
    <div className={styles.libraryResults}>{media.map(item => <button key={item.id} type="button" className={styles.libraryItem} data-ai-ready={item.aiReady === true ? 'ready' : 'unavailable'} disabled={disabled || busy || dirty || item.aiReady !== true} onClick={() => void run(item.id)}><Film size={22} /><div><strong>{item.name}</strong><small>{[item.match, item.date ? new Date(item.date * 1000).toISOString().slice(0, 10) : '', Number.isFinite(item.duration) && item.duration! > 0 ? `${Math.floor(item.duration! / 60)}:${String(Math.floor(item.duration! % 60)).padStart(2, '0')}` : ''].filter(Boolean).join(' · ')}</small><small className={item.aiReady ? styles.selectedTag : undefined}>{item.aiReady ? 'Ready for AI' : 'Not in the connected AI index'}</small></div>{item.aiReady && <ArrowRight size={16} />}</button>)}</div>
    {opened && pages > 1 && <div className={styles.row}><button type="button" className={styles.secondary} disabled={disabled || busy || dirty || page <= 1} onClick={() => void run(undefined, page - 1)}>Previous</button><button type="button" className={styles.secondary} disabled={disabled || busy || dirty || page >= pages || page >= 100} onClick={() => void run(undefined, page + 1)}>Next</button></div>}
  </section>;
}
