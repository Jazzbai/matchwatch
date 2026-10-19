"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Play, Radio, Search, Share2, Video, ArrowUpRight, Clock, Tv } from 'lucide-react';
import { demoApi as api, grantDemoPass, hasDemoPass, resetDemo } from './demo';
import styles from './StreamApp.module.css';
import YoutubeLibrary from './YoutubeLibrary';

type Broadcast = { id: string; alias: string; title: string; description: string; sport: string; scheduledAt: string; state: string; hasRecap: boolean; access: string };
type Tab = 'All' | 'Live' | 'Upcoming' | 'Recaps';
const sports = ['All sports', 'Soccer', 'Basketball', 'Baseball', 'Football', 'Other'];
const artwork: Record<string, string> = { Soccer: '/images/home/soccer.jpg', Basketball: '/images/home/basketball.jpg', Baseball: '/images/home/baseball.jpg' };
function when(value: string) { return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function message(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
function linkFor(id: string) { return window.location.hostname === 'stream.matchwatch.us' ? `${window.location.origin}/watch/${id}` : `${window.location.origin}/stream/watch/${id}`; }

export default function StreamApp({ mode }: { mode: 'browse' | 'watch' | 'studio' }) {
  const user = { name: 'Demo creator' };
  const authLoading = false;
  const params = useParams<{ id: string }>();
  const [items, setItems] = useState<Broadcast[]>([]);
  const [current, setCurrent] = useState<Broadcast | null>(null);
  const [tab, setTab] = useState<Tab>('All');
  const [sport, setSport] = useState('All sports');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [player, setPlayer] = useState('');
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const [uploadedVideo, setUploadedVideo] = useState('');
  const [passReady, setPassReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (mode === 'studio' && !user) { setLoading(false); return; }
    try {
      if (mode === 'watch') {
        const result = await api.get<Broadcast>(`/streams/${encodeURIComponent(params.id)}`);
        setCurrent(result.data);
      } else {
        const result = await api.get<Broadcast[]>(mode === 'studio' ? '/streams/mine' : '/streams');
        setItems(result.data);
      }
      setError('');
    } catch (e) { setError(message(e)); }
    finally { setLoading(false); }
  }, [mode, params.id]);
  useEffect(() => { if (cameraRef.current) cameraRef.current.srcObject = camera; return () => { camera?.getTracks().forEach((track) => track.stop()); }; }, [camera]);
  useEffect(() => () => { if (uploadedVideo) URL.revokeObjectURL(uploadedVideo); }, [uploadedVideo]);
  useEffect(() => { if (current) setPassReady(hasDemoPass(current)); }, [current]);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);
  useEffect(() => {
    api.get<{ videoReady: boolean }>('/streams/config').then((r) => setVideoReady(r.data.videoReady)).catch(() => {});
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function share(item: Broadcast) {
    try {
      const url = linkFor(item.id);
      if (navigator.share) await navigator.share({ title: item.title, url });
      else { await navigator.clipboard.writeText(url); setNotice('Watch link copied. Share it on WhatsApp, by text, or on social media.'); }
    } catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setError('Sharing failed. Open the watch page and copy its address.'); }
  }
  async function play() {
    if (!current) return;
    setBusy(true); setError('');
    try { const result = await api.post<{ playerUrl: string }>(`/streams/${current.id}/play`); setPlayer(result.data.playerUrl); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    setBusy(true); setError('');
    try {
      await api.post('/streams', { title: values.get('title'), alias: values.get('alias'), sport: values.get('sport'), description: values.get('description'),
        scheduledAt: new Date(String(values.get('scheduledAt'))).toISOString(), rightsConfirmed: values.get('rights') === 'on', access: values.get('access') });
      form.reset(); setNotice('Demo scheduled in this browser. Custom game links work here; sample game links work across devices.'); await load();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function action(item: Broadcast, name: 'connect' | 'refresh' | 'end' | 'recap') {
    if (name === 'end' && !window.confirm('End this broadcast? The current stream key will stop accepting video.')) return;
    setBusy(true); setError('');
    try {
      await api.post(`/streams/${item.id}/${name}`);
      if (name === 'connect') setNotice('Demo broadcast started. Open its watch page to present the viewer experience. No video is being broadcast.');
      else if (name === 'end') { setCamera(null); setNotice('Demo broadcast ended. You can now publish its recording entry.'); }
      else if (name === 'recap') setNotice('Recording published in Recaps.');
      await load();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  const visible = items.filter((item) => (sport === 'All sports' || item.sport === sport) &&
    `${item.title} ${item.alias} ${item.sport}`.toLowerCase().includes(query.toLowerCase()) &&
    (tab === 'All' || tab === 'Live' && ['LIVE', 'RECONNECTING'].includes(item.state) || tab === 'Upcoming' && item.state === 'SCHEDULED' || tab === 'Recaps' && item.hasRecap));
  const featured = items.find((item) => item.state === 'LIVE') || items.find((item) => item.state === 'SCHEDULED');
  const countdown = current ? Math.max(0, new Date(current.scheduledAt).getTime() - now) : 0;

  return <main className={styles.app}>
    <header className={styles.nav}>
      <Link href="/stream" className={styles.brand}>MATCHWATCH<span>STREAM</span></Link>
      <nav><Link href="/stream">Discover</Link><Link href="/stream/studio">Creator studio</Link><a href="https://matchwatch.us">Find a venue <ArrowUpRight size={14} /></a></nav>
      <Link className={styles.signin} href="/stream/studio">Demo studio</Link>
    </header>
    <div className={styles.shell}>
      <div className={styles.demoBanner}><span><strong>HACKATHON DEMO</strong> Sample games, simulated access, no real broadcasts or charges.</span><button onClick={() => { resetDemo(); setPlayer(''); setNotice('Demo reset.'); load(); }}>Reset demo</button></div>
      {error && <div role="alert" className={styles.error}>{error} <button onClick={load}>Try again</button></div>}
      {notice && <div role="status" className={styles.notice}>{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}
      {mode === 'browse' && <>
        <section className={styles.hero}>
          <div className={styles.heroArt} style={{ backgroundImage: 'url(/images/home/basketball.jpg)' }} />
          <div className={styles.heroCopy}><span className={styles.eyebrow}><Radio size={14} /> THE GAME. YOUR PERSPECTIVE.</span>
            <h1>Every game.<br /><em>Closer to the action.</em></h1>
            <p>Independent streams. Real fans. Watch live, find your next match, or catch what you missed.</p>
            <div className={styles.actions}><button className={styles.primary} onClick={() => { setTab('Live'); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }}><Play size={16} fill="currentColor" /> Explore live</button><Link className={styles.secondary} href="/stream/studio"><Video size={16} /> Start streaming</Link></div>
          </div>
          <div className={styles.heroNote}><span className={styles.badge}>INDEPENDENT BROADCASTS</span><p>Your seat. Your camera. Your crowd.</p></div>
        </section>
        <YoutubeLibrary />
        <div className={styles.intro}><div><span className={styles.eyebrow}>HACKATHON SAMPLE BROADCASTS</span><h2>Explore the streaming demo.</h2></div><span>{items.filter((i) => i.state === 'LIVE').length} demo live · {items.filter((i) => i.hasRecap).length} demo recordings</span></div>
        {featured && <div className={styles.featured}><Radio size={20} /><div><small>{featured.state === 'LIVE' ? 'ON AIR NOW' : 'COMING UP'}</small><Link href={`/stream/watch/${featured.id}`}>{featured.title}</Link></div><span>{when(featured.scheduledAt)}</span><Link href={`/stream/watch/${featured.id}`} className={styles.secondary}>Open stream <ArrowUpRight size={16} /></Link></div>}
        <section id="catalog">
          <div className={styles.toolbar}><div className={styles.tabs}>{(['All', 'Live', 'Upcoming', 'Recaps'] as Tab[]).map((value) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value}</button>)}</div><label className={styles.search}><Search size={16} /><input aria-label="Search streams" placeholder="Search games or streamers" value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>
          <div className={styles.sports}>{sports.map((value) => <button key={value} aria-pressed={sport === value} onClick={() => setSport(value)}>{value}</button>)}</div>
          {loading ? <div className={styles.empty}>Loading broadcasts…</div> : visible.length ? <div className={styles.grid}>{visible.map((item) => <article key={item.id} className={styles.card}>
            <Link href={`/stream/watch/${item.id}`} className={styles.poster} style={{ backgroundImage: artwork[item.sport] ? `url(${artwork[item.sport]})` : undefined }}><span className={styles.badge}>{item.hasRecap && item.state === 'ENDED' ? 'RECAP / REPLAY' : item.state.replace('_', ' ')}</span><span className={styles.playIcon}><Play size={22} /></span><span className={styles.free}>{item.access === 'FREE' ? 'Free to watch' : item.access === 'MATCH' ? '$4.99 · demo match pass' : '$9.99/mo · demo channel pass'}</span></Link>
            <div className={styles.cardBody}><small>{item.sport} · {when(item.scheduledAt)}</small><h3><Link href={`/stream/watch/${item.id}`}>{item.title}</Link></h3><div className={styles.creator}><span>{item.alias.slice(0, 1).toUpperCase()}</span><p>{item.alias}</p><button aria-label={`Share ${item.title}`} onClick={() => share(item)}><Share2 size={16} /></button></div></div>
          </article>)}</div> : <div className={styles.empty}><Tv size={36} /><h3>{query ? 'No matching streams' : 'The next great game starts with you.'}</h3><p>{query ? 'Try another search or sport.' : 'No broadcasts in this category yet. Schedule a game and invite your crowd.'}</p><Link className={styles.secondary} href="/stream/studio">Open creator studio <ArrowUpRight size={16} /></Link></div>}
        </section>
        <section className={styles.bottom}><div><span className={styles.eyebrow}>BRING YOUR VIEW TO THE WORLD</span><h2>Turn game day into your channel.</h2><p>Schedule your broadcast, connect your camera, and send fans one watch link.</p></div><Link href="/stream/studio" className={styles.primary}>Create a broadcast <ArrowUpRight size={16} /></Link></section>
      </>}
      {mode === 'watch' && (loading ? <div className={styles.empty}>Loading your stream…</div> : current && <>
        <Link href="/stream" className={styles.back}>← All streams</Link>
        <div className={styles.watchGrid}><div><div className={styles.player}>{player ? <div className={styles.videoWrap}><video controls playsInline autoPlay src={uploadedVideo || "/images/home/demo-video.mp4"} /><span>DEMO VIDEO ? {uploadedVideo ? "Your local file ? stays on this device" : "Sample footage, not this game"}</span></div> : <div className={styles.playerPlaceholder}><Radio size={38} /><span className={styles.eyebrow}>{current.state}</span><h1>{current.title}</h1><p>{countdown > 0 && current.state === 'SCHEDULED' ? `Starts in ${Math.floor(countdown / 3600000)}h ${Math.floor(countdown / 60000) % 60}m ${Math.floor(countdown / 1000) % 60}s` : current.state === 'ENDED' && !current.hasRecap ? 'The broadcast has ended. A recording has not been published yet.' : 'Watch the action from an independent streamer.'}</p><button className={styles.primary} disabled={busy || countdown > 0 && current.state === 'SCHEDULED' || current.state === 'ENDED' && !current.hasRecap} onClick={play}><Play size={17} />{busy ? 'Connecting…' : current.hasRecap && current.state === 'ENDED' ? 'Watch recording' : 'Watch stream'}</button></div>}</div><div className={styles.watchTitle}><div><span className={styles.eyebrow}>{current.sport} · {when(current.scheduledAt)}</span><h2>{current.title}</h2><p>Broadcast by {current.alias}</p></div><button className={styles.secondary} onClick={() => share(current)}><Share2 size={16} /> Share</button></div><p className={styles.description}>{current.description}</p></div><aside className={styles.panel}><span className={styles.eyebrow}>YOUR WATCH PASS</span><h2>{current.access === 'FREE' ? 'Free demo stream' : passReady ? 'Demo access unlocked' : 'Choose your watch pass'}</h2><p>Hackathon simulation only. No card details, charges, or actual subscriptions.</p>{current.access !== 'FREE' && !passReady && <div className={styles.passOptions}><button className={styles.primary} onClick={() => { grantDemoPass(current, false); setPassReady(true); setNotice('Demo match pass unlocked. No payment was taken.'); }}>Simulate $4.99 match pass</button><button className={styles.secondary} onClick={() => { grantDemoPass(current, true); setPassReady(true); setNotice('Demo channel pass unlocked for this browser. No payment was taken.'); }}>Simulate $9.99/month channel pass</button></div>}<label>Use your own demo footage<input type="file" accept="video/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { if (uploadedVideo) URL.revokeObjectURL(uploadedVideo); setUploadedVideo(URL.createObjectURL(file)); setNotice('Local video selected. It stays on this device.'); } }} /></label><hr /><h3>Invite your crowd</h3><p>Send this watch link on WhatsApp, in a text, or on social media.</p><button className={styles.secondary} onClick={() => share(current)}><Share2 size={16} /> Share watch link</button></aside></div>
      </>)}
      {mode === 'studio' && <>
        <div className={styles.intro}><div><span className={styles.eyebrow}>CREATOR STUDIO</span><h1>Your game. Your channel.</h1><p>A public nickname. One watch link. A crowd that follows your perspective.</p></div></div>
        {authLoading ? <div className={styles.empty}>Checking your account…</div> : !user ? <div className={styles.empty}><Video size={36} /><h2>Sign in to start your channel.</h2><p>Use your MatchWatch account to schedule and manage broadcasts.</p><Link className={styles.primary} href="/login">Sign in</Link></div> : <>
          {!videoReady && <div className={styles.notice}>You can schedule games now. Live video activation is still pending.</div>}
          <div className={styles.studioGrid}><form className={styles.panel} onSubmit={create}><span className={styles.eyebrow}>NEW BROADCAST</span><h2>Set the stage.</h2><label>Game title<input required name="title" minLength={4} maxLength={160} placeholder="Home team vs Away team" /></label><label>Public streamer name<input required name="alias" minLength={2} maxLength={60} placeholder="Your channel nickname" /></label><div className={styles.formRow}><label>Sport<select name="sport">{sports.slice(1).map((v) => <option key={v}>{v}</option>)}</select></label><label>Start time<input required name="scheduledAt" type="datetime-local" /></label></div><label>About the broadcast<textarea name="description" maxLength={2000} rows={3} placeholder="Tell viewers what to expect" /></label><label>Viewing access<select name="access"><option value="FREE">Free to watch</option><option value="MATCH">Demo match pass ? $4.99</option><option value="CHANNEL">Demo channel subscription ? $9.99/month</option></select></label><p className={styles.hint}>Demo prices only. No real payment or subscription is created.</p><label className={styles.checkbox}><input required type="checkbox" name="rights" /><span>I have permission to broadcast this game and footage.</span></label><button className={styles.primary} disabled={busy}>{busy ? 'Saving…' : 'Schedule & create watch link'}</button></form>
          <div><section className={styles.panel}><span className={styles.eyebrow}>CAMERA → MATCHWATCH → YOUR FANS</span><h2>Get ready to go live.</h2><ol><li>Schedule a game to create its watch link.</li><li>Open “Connect camera” to get your private server and key.</li><li>Enter them in compatible streaming software or your camera app.</li><li>Start sending video, then refresh the status.</li><li>End the broadcast and publish its recording.</li></ol><p className={styles.hint}>Camera preview is local only. A real GoPro broadcast needs compatible hardware and a video delivery service.</p></section><section className={styles.panel}><h3>Live + past games</h3><p>Your original watch link stays the same after you publish the recording. Share it before, during, or after the game.</p></section></div></div>
          <section className={styles.panel}><h2>Camera rehearsal</h2><p>Preview a connected camera in this browser. This is not sent to viewers.</p><div className={styles.actions}><button className={styles.secondary} onClick={async () => { try { if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera preview needs HTTPS or localhost.'); const feed = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); setCamera(feed); } catch (e) { setError(message(e)); } }}>Preview camera</button><button className={styles.secondary} disabled={!camera} onClick={() => setCamera(null)}>Stop camera</button></div>{camera && <video className={styles.cameraPreview} ref={cameraRef} autoPlay muted playsInline />}</section>
          <h2 className={styles.sectionTitle}>Your broadcasts</h2>{loading ? <p>Loading…</p> : items.length === 0 ? <div className={styles.empty}><Clock size={30} /><p>Your scheduled demo broadcasts will appear here.</p></div> : <div className={styles.broadcastList}>{items.map((item) => <article className={styles.panel} key={item.id}><span className={styles.eyebrow}>{item.state} · {item.sport}</span><h3>{item.title}</h3><p>{when(item.scheduledAt)} · {item.alias}</p><div className={styles.actions}><Link className={styles.secondary} href={`/stream/watch/${item.id}`}>Watch page</Link><button className={styles.secondary} onClick={() => share(item)}>Share link</button>{!['ENDED', 'CANCELLED'].includes(item.state) && <><button className={styles.secondary} disabled={busy || !videoReady} onClick={() => action(item, 'connect')}>Start demo stream</button><button className={styles.secondary} disabled={busy} onClick={() => action(item, 'refresh')}>Simulate live</button><button className={styles.secondary} disabled={busy} onClick={() => action(item, 'end')}>End broadcast</button></>}{item.state === 'ENDED' && !item.hasRecap && <button className={styles.secondary} disabled={busy} onClick={() => action(item, 'recap')}>Publish recording</button>}</div></article>)}</div>}
        </>}
      </>}
      <footer className={styles.footer}><Link href="/stream">MATCHWATCH STREAM</Link><span>Independent perspectives. Shared passion.</span><Link href="/images/home/credits.html">Photo credits</Link></footer>
    </div>
  </main>;
}
