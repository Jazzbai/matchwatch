'use client';
import { useCallback, useEffect, useState } from 'react';
import { CircleCheck, Library, LoaderCircle, Radio, RefreshCw, Upload } from 'lucide-react';
import { fetchLibrary, type LibraryItem, type SourceChoice } from '../../../lib/highlights/client';
import styles from '../HighlightStudio.module.css';
import { clock } from './format';

type Tab = SourceChoice['kind'];
type Props = { choice: SourceChoice | null; onChoose: (choice: SourceChoice) => void; disabled: boolean; canBrowse: boolean };
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const tabs: { id: Tab; label: string; Icon: typeof Library }[] = [
  { id: 'library', label: 'ScorePlay library', Icon: Library },
  { id: 'upload', label: 'Upload a video', Icon: Upload },
  { id: 'hls', label: 'Live HLS feed', Icon: Radio },
];

/** Diagram step 1: a match video from ScorePlay (already in TwelveLabs), an upload, or a live feed. */
export default function SourcePicker({ choice, onChoose, disabled, canBrowse }: Props) {
  const [tab, setTab] = useState<Tab>('library');
  const [videos, setVideos] = useState<LibraryItem[] | null>(null);
  const [filter, setFilter] = useState(''), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [hlsUrl, setHlsUrl] = useState(''), [captureSeconds, setCaptureSeconds] = useState(60);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError('');
    try { setVideos(await fetchLibrary(refresh)); }
    catch (failure) { setError((failure as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (canBrowse && tab === 'library' && !videos) void load(); }, [canBrowse, tab, videos, load]);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setError('Choose a video smaller than 200 MB.'); return; }
    setError('');
    onChoose({ kind: 'upload', file });
  }

  const shown = (videos ?? []).filter(video => video.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const selectedTicket = choice?.kind === 'library' ? choice.video.ticket : null;
  return <section className={styles.card} id="source">
    <div className={styles.heading}><span>01</span><div><h2>Match video</h2><p>ScorePlay media, an uploaded recording, or a live HLS stream.</p></div></div>
    <div className={styles.sourceTabs} role="tablist" aria-label="Video source">
      {tabs.map(({ id, label, Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} disabled={disabled} onClick={() => setTab(id)}><Icon size={16} /> {label}</button>)}
    </div>

    {tab === 'library' && <div role="tabpanel" aria-label="ScorePlay library">
      <div className={styles.libraryToolbar}>
        <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Search matches, players, clips…" aria-label="Search the library" disabled={!videos} />
        <button type="button" className={styles.secondary} disabled={loading || disabled || !canBrowse} onClick={() => void load(true)} aria-label="Refresh the library">
          {loading ? <LoaderCircle size={15} className={styles.spinner} /> : <RefreshCw size={15} />}
        </button>
      </div>
      {!canBrowse && <p className={styles.libraryStatus}>Sign in to browse the match library.</p>}
      {loading && !videos && <p className={styles.libraryStatus}>Loading media already analyzed by TwelveLabs…</p>}
      {videos && <p className={styles.libraryStatus}>{shown.length} of {videos.length} videos · already indexed, so analysis starts immediately.</p>}
      <div className={styles.libraryResults}>
        {shown.map(video => <button key={video.ticket} type="button" className={styles.libraryItem} aria-pressed={selectedTicket === video.ticket} disabled={disabled} onClick={() => onChoose({ kind: 'library', video })}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Provider thumbnails are external, signed CDN URLs. */}
          {video.thumbnail ? <img className={styles.thumb} src={video.thumbnail} alt="" loading="lazy" /> : <span className={styles.thumb} />}
          <div><strong>{video.name}</strong><small>{clock(video.duration)}{video.scoreplay ? ` · ScorePlay ${video.scoreplay.mediaId}` : ''}{video.orientation === 'portrait' ? ' · vertical' : ''}</small></div>
          {selectedTicket === video.ticket && <CircleCheck size={18} />}
        </button>)}
      </div>
    </div>}

    {tab === 'upload' && <div role="tabpanel" aria-label="Upload a video">
      <label className={`${styles.upload} ${dragging ? styles.dragging : ''}`}
        onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) chooseFile(event.dataTransfer.files[0]); }}>
        <span className={styles.uploadIcon}><Upload size={25} /></span>
        <strong>Drop your match video here</strong>
        <span>or click to choose a file</span>
        <small>MP4 · up to 200 MB · it is analyzed by TwelveLabs</small>
        <input type="file" accept="video/*,.mp4" aria-label="Choose a video file" disabled={disabled} onChange={event => chooseFile(event.target.files?.[0])} />
      </label>
    </div>}

    {tab === 'hls' && <div role="tabpanel" aria-label="Live HLS feed">
      <div className={styles.row}>
        <label>Live feed URL<input type="url" value={hlsUrl} maxLength={4096} disabled={disabled} onChange={event => setHlsUrl(event.target.value)} placeholder="https://…/playlist.m3u8 (blank uses the server feed)" /></label>
        <label>Capture window<select value={captureSeconds} disabled={disabled} onChange={event => setCaptureSeconds(Number(event.target.value))}>{[30, 60, 90, 120].map(seconds => <option key={seconds} value={seconds}>Last {seconds} seconds</option>)}</select></label>
      </div>
      <button type="button" className={styles.secondary} disabled={disabled} onClick={() => onChoose({ kind: 'hls', url: hlsUrl.trim(), seconds: captureSeconds })}><Radio size={15} /> Use the live feed</button>
      <p className={styles.hint}>The server captures the most recent window from allowed hosts only, then analyzes it like an upload.</p>
    </div>}

    {error && <p className={styles.error} role="alert">{error}</p>}
    {choice && <div className={styles.sourceSelected}><CircleCheck size={19} /><div>
      <strong>{choice.kind === 'library' ? choice.video.name : choice.kind === 'upload' ? choice.file.name : 'Live feed'}</strong>
      <span>{choice.kind === 'library' ? `ScorePlay library · ${clock(choice.video.duration)} · already analyzed by TwelveLabs` : choice.kind === 'upload' ? `${(choice.file.size / 1048576).toFixed(1)} MB from your device` : `Last ${choice.seconds} seconds of the stream`}</span>
    </div></div>}
  </section>;
}
