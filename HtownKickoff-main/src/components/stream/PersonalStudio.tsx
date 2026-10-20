"use client";
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Radio, Video, Bookmark, Search, Copy, Share2, Play, Upload } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import styles from './StreamApp.module.css';
import own from './PersonalStudio.module.css';

type Broadcast = { id: string; title: string; sport: string; description: string; ended: boolean; createdAt: string; live: boolean | null };
type SavedVideo = { id: string; title: string; sport: string; fileSize: number; createdAt: string };
type Favorite = { id: string; title: string; sport: string; videoId: string };
type Library = { broadcasts: Broadcast[]; videos: SavedVideo[]; favorites: Favorite[]; liveConfigured: boolean; storageConfigured: boolean; recordingsConfigured: boolean };
type Recording = { start: string; duration: number; url: string };
const sports = ['Soccer', 'Basketball', 'Baseball', 'Football', 'Other'];
const errorMessage = (e: unknown) => e instanceof Error ? e.message : 'Please try again.';
function SportSelect({ all = false, ...props }: { all?: boolean; name?: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void }) { return <select {...props}>{all && <option value="All">All sports</option>}{sports.map(s => <option key={s}>{s}</option>)}</select>; }
export default function PersonalStudio() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <main className={styles.app}><div className={styles.shell}><p role="status">Loading your account...</p></div></main>;
  if (!user) return <main className={styles.app}><div className={styles.shell}><section className={styles.panel}><h1>Your games. Your channel.</h1><p>Sign in to manage GoPro broadcasts, save recordings, and collect your favorite match videos.</p><Link className={styles.primary} href="/login">Sign in</Link> <Link className={styles.secondary} href="/stream">Explore recaps</Link></section></div></main>;
  return <Studio key={user.id} name={user.name} />;
}
function Studio({ name }: { name: string }) {
  const [data, setData] = useState<Library | null>(null); const [tab, setTab] = useState('Broadcasts');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(''); const [sport, setSport] = useState('All');
  const [credentials, setCredentials] = useState<{ id: string; url: string } | null>(null);
  const [recordings, setRecordings] = useState<Record<string, Recording[]>>({});
  const [player, setPlayer] = useState<{ title: string; url: string } | null>(null);
  const load = useCallback(async () => { const r = await api.get<Library>('/streams/mine'); setData(r.data); }, []);
  useEffect(() => { let active = true; api.get<Library>('/streams/mine').then(r => { if (active) setData(r.data); }).catch(e => { if (active) setError(errorMessage(e)); }); return () => { active = false; }; }, []);
  useEffect(() => { if (busy) return; let active = true; const timer = setInterval(() => { api.get<Library>('/streams/mine').then(r => { if (active) setData(r.data); }).catch(() => {}); }, 30000); return () => { active = false; clearInterval(timer); }; }, [busy]);
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try { await action(); } catch(e) { setError(errorMessage(e)); } finally { setBusy(false); } }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
    await run(async () => { const r = await api.post<Broadcast & { publishUrl: string }>('/streams/broadcasts', { title: f.get('title'), sport: f.get('sport'), description: f.get('description'), rightsConfirmed: f.get('rights') === 'on' }); setCredentials({ id: r.data.id, url: r.data.publishUrl }); form.reset(); await load(); setNotice('Broadcast created. Copy the private address into GoPro Quik or OBS.'); });
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const file = f.get('file') as File;
    if (!file?.size) return;
    await run(async () => {
      setNotice('Uploading your recording. Keep this page open.');
      const type = file.type || (/\.mov$/i.test(file.name) ? 'video/quicktime' : /\.webm$/i.test(file.name) ? 'video/webm' : /\.mp4$/i.test(file.name) ? 'video/mp4' : '');
      const r = await api.post<{ id: string; uploadUrl: string; headers: Record<string, string> }>('/streams/videos/upload', { title: f.get('title'), sport: f.get('sport'), contentType: type, fileSize: file.size });
      const result = await fetch(r.data.uploadUrl, { method: 'PUT', headers: r.data.headers, body: file });
      if (!result.ok) throw new Error('Upload failed. Check storage connectivity and try again.');
      await api.post(`/streams/videos/${r.data.id}/complete`); form.reset(); await load(); setNotice('Recording saved to your private library.');
    });
  }
  async function share(id: string, title: string) { await run(async () => { const url = `${location.origin}/stream/watch/${id}`; if (navigator.share) await navigator.share({ title, url }); else { await navigator.clipboard.writeText(url); setNotice('Watch link copied.'); } }); }
  async function archive(broadcast: Broadcast, recording: Recording) {
    await run(async () => {
      const count = Math.ceil(recording.duration / 900);
      try {
        for (let offset = 0; offset < recording.duration; offset += 900) {
          setNotice(`Saving recording part ${Math.floor(offset / 900) + 1} of ${count}. Keep this page open.`);
          await api.post(`/streams/broadcasts/${broadcast.id}/archive`, { start: new Date(Date.parse(recording.start) + offset * 1000).toISOString(), duration: Math.min(900, recording.duration - offset) });
        }
        setNotice('Recording saved to your library in parts of up to 15 minutes.');
      } finally { await load(); }
    });
  }
  const matches = (v: { title: string; sport: string }) => (sport === 'All' || v.sport === sport) && `${v.title} ${v.sport}`.toLowerCase().includes(query.toLowerCase());
  const broadcasts = data?.broadcasts.filter(matches) || []; const videos = data?.videos.filter(matches) || []; const favorites = data?.favorites.filter(matches) || [];
  return <main className={styles.app}>
    <header className={styles.nav}><Link href="/stream" className={styles.brand}>MATCHWATCH<span>STREAM</span></Link><nav><Link href="/stream">Explore games</Link><Link href="/stream/studio">My dashboard</Link></nav></header>
    <div className={styles.shell}>
      <section className={own.hero}><span className={styles.eyebrow}>YOUR CREATOR SPACE</span><h1>{name.split(' ')[0]}’s MatchWatch</h1><p>Go live. Keep the recording. Save the moments you love.</p><div className={own.stats}><span><Radio size={18} />{data?.broadcasts.length ?? 0} broadcasts</span><span><Video size={18} />{data?.videos.length ?? 0} saved recordings</span><span><Bookmark size={18} />{data?.favorites.length ?? 0} favorites</span></div></section>
      {error && <div className={own.error} role="alert">{error} <button onClick={() => void run(load)}>Retry library</button></div>}{notice && <p className={own.notice} role="status">{notice}</p>}
      <div className={styles.toolbar}><div className={styles.tabs}>{['Broadcasts', 'Recordings', 'Favorites'].map(t => <button key={t} aria-pressed={tab === t} onClick={() => { setTab(t); setPlayer(null); }}>{t}</button>)}</div><label className={styles.search}><Search size={16} /><input aria-label="Search your library" placeholder="Search your library" value={query} onChange={e => setQuery(e.target.value)} /></label><label className={own.filter}>Sport<SportSelect all value={sport} onChange={e => setSport(e.target.value)} /></label></div>
      {!data ? <div className={styles.empty}><p>{error ? 'Your library could not load.' : 'Loading your library...'}</p></div> : <>
      {tab === 'Broadcasts' && <>
        <section className={styles.panel}><h2>Create a broadcast</h2><p>Your watch page is public. Your GoPro publishing address is private.</p>{!data.liveConfigured && <p role="status">Live broadcasting is awaiting the MediaMTX server connection.</p>}
          <form onSubmit={create} className={own.form}><label>Game title<input name="title" required maxLength={180} placeholder="Our Saturday soccer match" /></label><label>Sport<SportSelect name="sport" /></label><label className={own.wide}>Description<textarea name="description" maxLength={2000} /></label><label className={own.check}><input name="rights" type="checkbox" required />I have permission to broadcast and record this game.</label><button className={styles.primary} disabled={busy || !data.liveConfigured}><Radio size={16} />Create broadcast</button></form>
        </section>
        {credentials && <section className={styles.panel}><h3>Private GoPro connection</h3><p>Shown only now. Generating a replacement changes the password for future connections.</p><input className={own.secret} aria-label="Private GoPro publishing address" readOnly value={credentials.url} /><div className={styles.actions}><button className={styles.primary} onClick={() => void run(async () => { await navigator.clipboard.writeText(credentials.url); setNotice('Private publishing address copied.'); })}><Copy size={15} />Copy address</button><button className={styles.secondary} onClick={() => setCredentials(null)}>Hide address</button></div><p>GoPro Quik → Live → RTMP. Paste the complete address, connect to Wi-Fi, then start your camera.</p></section>}
        <div className={own.list}>{broadcasts.map(b => <article className={styles.panel} key={b.id}><span className={styles.eyebrow}>{b.sport} · {b.ended ? 'ENDED' : b.live === true ? 'LIVE' : b.live === false ? 'OFFLINE' : 'STATUS UNAVAILABLE'}</span><h3>{b.title}</h3><p>{b.description}</p><div className={styles.actions}><Link className={styles.primary} href={`/stream/watch/${b.id}`}><Play size={15} />Watch page</Link><button className={styles.secondary} disabled={busy} onClick={() => void share(b.id, b.title)}><Share2 size={15} />Share</button>{!b.ended && <><button className={styles.secondary} disabled={busy} onClick={() => void run(async () => { const r = await api.post<{ publishUrl: string }>(`/streams/broadcasts/${b.id}/credentials`); setCredentials({ id: b.id, url: r.data.publishUrl }); })}>New GoPro address</button><button className={styles.secondary} disabled={busy} onClick={() => { if (confirm('End this broadcast and disconnect the camera?')) void run(async () => { try { await api.post(`/streams/broadcasts/${b.id}/end`); setCredentials(null); } finally { await load(); } }); }}>End broadcast</button></>}</div></article>)}</div>{!broadcasts.length && <p className={styles.empty}>No broadcasts match your filters. Create your first game above.</p>}
      </>}
      {tab === 'Recordings' && <>
        <section className={styles.panel}><h2>Upload a game recording</h2><p>MP4, WebM, or MOV, up to 2 GB. Uploads stay private to your account. Playback depends on the video codec; H.264 MP4 works widely.</p>{!data.storageConfigured && <p>Video uploads are awaiting the private storage bucket configuration.</p>}<form className={own.form} onSubmit={upload}><label>Title<input name="title" required maxLength={180} /></label><label>Sport<SportSelect name="sport" /></label><label className={own.wide}>Recording<input type="file" name="file" required accept="video/mp4,video/webm,video/quicktime,.mov" /></label><button className={styles.primary} disabled={busy || !data.storageConfigured}><Upload size={16} />Save recording</button></form></section>
        <h2>Your saved videos</h2><div className={own.list}>{videos.map(v => <article className={styles.panel} key={v.id}><span className={styles.eyebrow}>{v.sport} · {(v.fileSize / 1024 ** 2).toFixed(1)} MB</span><h3>{v.title}</h3><div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={() => void run(async () => { const r = await api.get<{ url: string }>(`/streams/videos/${v.id}/play`); setPlayer({ title: v.title, url: r.data.url }); })}>Play recording</button><button className={styles.secondary} disabled={busy} onClick={() => { if (confirm('Permanently delete this uploaded video?')) void run(async () => { await api.delete(`/streams/videos/${v.id}`); setPlayer(null); await load(); }); }}>Delete</button></div></article>)}</div>{!videos.length && <p>No uploaded recordings match your filters.</p>}
        <h2>Broadcast recordings</h2><p>Recordings appear after MediaMTX finishes a recording segment. Server recordings are retained for seven days. Save a segment to your library to keep it in your private storage.</p><div className={own.list}>{broadcasts.map(b => <article key={b.id} className={styles.panel}><h3>{b.title}</h3><button className={styles.secondary} disabled={busy || !data.recordingsConfigured} onClick={() => void run(async () => { const r = await api.get<Recording[]>(`/streams/broadcasts/${b.id}/recordings`); setRecordings(prev => ({ ...prev, [b.id]: r.data })); })}>Load recordings</button>{recordings[b.id]?.length === 0 && <p>No saved segments are currently available.</p>}{recordings[b.id]?.map(r => <div className={own.segment} key={r.start}><span>{new Date(r.start).toLocaleString()} · {Math.ceil(r.duration / 60)} min</span><button className={styles.secondary} onClick={() => setPlayer({ title: b.title, url: r.url })}>Play</button><a className={styles.secondary} href={r.url} target="_blank" rel="noopener noreferrer">Open / download</a><button className={styles.secondary} disabled={busy || !data.storageConfigured} onClick={() => void archive(b, r)}>Save to my library</button></div>)}</article>)}</div>
      </>}
      {tab === 'Favorites' && <>
        <section className={styles.panel}><h2>Save a YouTube video</h2><p>Keep links to highlights, full games, and sports videos. Videos play on YouTube.</p><form className={own.form} onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); void run(async () => { await api.post('/streams/favorites', { videoId: f.get('url'), title: f.get('title'), sport: f.get('sport') }); form.reset(); await load(); setNotice('Video saved to favorites.'); }); }}><label>YouTube link<input type="url" name="url" required placeholder="https://www.youtube.com/watch?v=..." /></label><label>Title<input name="title" required maxLength={180} /></label><label>Sport<SportSelect name="sport" /></label><button className={styles.primary} disabled={busy}><Bookmark size={16} />Save favorite</button></form></section>
        <div className={styles.grid}>{favorites.map(v => <article className={styles.gameCard} key={v.id}><a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer"><Image unoptimized width={480} height={270} className={own.thumbnail} src={`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`} alt="" /></a><div className={styles.cardBody}><small>{v.sport}</small><h3>{v.title}</h3><div className={styles.actions}><a className={styles.primary} href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer">Watch on YouTube</a><button className={styles.secondary} disabled={busy} onClick={() => void run(async () => { await api.delete(`/streams/favorites/${v.id}`); await load(); })}>Remove</button></div></div></article>)}</div>{!favorites.length && <p className={styles.empty}>Your saved videos will appear here. Save any recap from Explore games.</p>}
      </>}
      </>}
      {player && <section className={styles.panel} aria-label="Recording player"><div className={styles.actions}><h2>{player.title}</h2><button className={styles.secondary} onClick={() => setPlayer(null)}>Close player</button></div><video key={player.url} className={own.player} src={player.url} controls autoPlay playsInline onError={() => setError('This recording could not play. Refresh its link or try an H.264 MP4 recording.')} /></section>}
    </div>
  </main>;
}
