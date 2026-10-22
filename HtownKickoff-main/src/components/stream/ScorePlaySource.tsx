'use client';
import { useEffect, useRef, useState } from 'react';
import { highlightFetch } from '../../lib/highlight-session';
import { highlightResponse } from '../../lib/highlight-request';
import styles from './HighlightStudio.module.css';
const endpoint = `${process.env.NEXT_PUBLIC_APP_BASE_PATH || ''}/api/stream/scoreplay`;
type Media = { id: string; name: string; duration?: number };
export type ScorePlayVideo = { ticket: string; name: string; url: string; duration: number; bytes: number };
export default function ScorePlaySource({ disabled, onChoose }: { disabled: boolean; onChoose: (source: ScorePlayVideo) => void }) {
  const [query, setQuery] = useState(''), [media, setMedia] = useState<Media[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run(id?: string) {
    const abort = new AbortController(); controller.current = abort; setBusy(true); setError('');
    try {
      const response = await highlightResponse(await highlightFetch(id ? `${endpoint}?mode=source&mediaId=${encodeURIComponent(id)}` : `${endpoint}?q=${encodeURIComponent(query)}`, { method: id ? 'POST' : 'GET', signal: abort.signal }));
      if (id) {
        onChoose(await response.json());
      } else { const data = await response.json(); setMedia(data.media); if (!data.media.length) setError('No matching ScorePlay videos. Try another filename.'); }
    } catch (e) { if (!abort.signal.aborted) setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section style={{ marginBottom: 20 }} aria-label="ScorePlay library">
    <h3>Use your ScorePlay library</h3>
    <p className={styles.hint}>The server connects using your saved ScorePlay account key. Open the library and select a game; no local video upload is needed.</p>
    <button type="button" className={styles.primary} disabled={disabled || busy} onClick={() => void run()}>Open ScorePlay library</button>
    <p className={styles.hint}>Browse your ScorePlay recordings. Hackathon processing requires the existing TwelveLabs mapping from the organizers. External import and export are disabled by default so challenge content stays on the platform.</p>
    <form onSubmit={e => { e.preventDefault(); void run(); }} className={styles.row}>
      <label>Video filename<input value={query} maxLength={120} disabled={disabled || busy} onChange={e => setQuery(e.target.value)} placeholder="Search or leave blank for recent videos" /></label>
      <button className={styles.secondary} disabled={disabled || busy}>Search library</button>
    </form>
    {busy && <p role="status">{media.length ? 'Loading ScorePlay video…' : 'Connecting to ScorePlay…'} <button type="button" onClick={() => controller.current?.abort()}>Cancel</button></p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {media.map(item => <div key={item.id} style={{ marginTop: 12 }}><button type="button" className={styles.secondary} disabled={disabled || busy} onClick={() => void run(item.id)}>Use {item.name}</button>{Number.isFinite(item.duration) && <span> · {Math.round(item.duration!)} seconds</span>}</div>)}
  </section>;
}
