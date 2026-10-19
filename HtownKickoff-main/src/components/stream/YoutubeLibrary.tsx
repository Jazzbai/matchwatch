"use client";
import { useEffect, useRef, useState } from 'react';
import { Play, X, ExternalLink } from 'lucide-react';
import { youtubeSports, type YoutubeVideo, type YoutubeSport, type YoutubeKind } from '../../lib/stream-youtube';
import styles from './StreamApp.module.css';

export default function YoutubeLibrary() {
  const [sport, setSport] = useState<YoutubeSport>('Basketball');
  const [kind, setKind] = useState<YoutubeKind>('recaps');
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [selected, setSelected] = useState<YoutubeVideo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setVideos([]);
    fetch(`/api/stream/youtube?sport=${sport}&kind=${kind}`, { signal: controller.signal }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load YouTube videos.');
      setVideos(result.videos);
    }).catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load videos.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [sport, kind, retry]);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else { dialog.current?.close(); opener.current?.focus(); }
  }, [selected]);
  function close() { setSelected(null); }
  return <section className={styles.youtubeSection} aria-label="YouTube sports library">
    <div className={styles.intro}><div><span className={styles.eyebrow}>WATCH ON MATCHWATCH · POWERED BY YOUTUBE</span><h2>Catch the game. Relive the moments.</h2></div><span>Original videos · Original channels</span></div>
    <div className={styles.toolbar}><div className={styles.tabs}>
      <button aria-pressed={kind === 'recaps'} onClick={() => setKind('recaps')}>Recaps & highlights</button>
      <button aria-pressed={kind === 'past'} onClick={() => setKind('past')}>Past games & replays</button>
    </div></div>
    <div className={styles.sports}>{youtubeSports.map((value) => <button key={value} aria-pressed={sport === value} onClick={() => setSport(value)}>{value}</button>)}</div>
    {loading ? <div className={styles.empty} role="status">Loading {sport.toLowerCase()} videos from YouTube…</div> : error ? <div className={styles.empty}><h3>YouTube connection</h3><p>{error}</p><button className={styles.secondary} onClick={() => setRetry((v) => v + 1)}>Retry connection</button></div> : videos.length ? <div className={styles.videoRail}>{videos.map((video) => <article key={video.id} className={styles.youtubeCard}>
      <button className={styles.youtubePoster} onClick={(event) => { opener.current = event.currentTarget; setSelected(video); }} aria-label={`Watch ${video.title}`}><img src={video.thumbnail} alt="" loading="lazy" /><span className={styles.playIcon}><Play size={22} /></span><span className={styles.youtubeBadge}>YouTube</span></button>
      <div className={styles.cardBody}><small>{video.channel}</small><h3><button onClick={(event) => { opener.current = event.currentTarget; setSelected(video); }}>{video.title}</button></h3><small>{video.publishedAt ? `Uploaded ${new Date(video.publishedAt).toLocaleDateString()}` : 'YouTube video'}</small></div>
    </article>)}</div> : <div className={styles.empty}><p>No videos found for this category. Try another sport.</p></div>}
    <p className={styles.libraryNote}>Results come from YouTube search. Replay availability and playback restrictions are set by the uploader; upload dates may differ from game dates.</p>
    <dialog className={styles.youtubeDialog} ref={dialog} onCancel={close} onClose={close} onClick={(event) => { if (event.target === event.currentTarget) close(); }} aria-label={selected?.title || 'YouTube player'}>
      {selected && <><div className={styles.dialogTop}><span>YOUTUBE · {selected.channel}</span><button aria-label="Close video" onClick={close}><X size={20} /></button></div><iframe src={`https://www.youtube-nocookie.com/embed/${selected.id}?autoplay=1&rel=0`} title={selected.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /><div className={styles.dialogBottom}><h3>{selected.title}</h3><a href={`https://www.youtube.com/watch?v=${selected.id}`} target="_blank" rel="noreferrer">Watch on YouTube <ExternalLink size={14} /></a></div></>}
    </dialog>
  </section>;
}
