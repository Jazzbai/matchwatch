"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import styles from './StreamApp.module.css';
import own from './PersonalStudio.module.css';
type Broadcast = { id: string; title: string; sport: string; description: string; ended: boolean; live: boolean; playerUrl: string | null; unavailable?: boolean };
export default function LiveWatch({ id }: { id: string }) {
  const [item, setItem] = useState<Broadcast | null>(null); const [error, setError] = useState('');
  useEffect(() => { let active = true; async function load() { try { const r = await api.get<Broadcast>(`/streams/watch/${encodeURIComponent(id)}`); if (active) { setItem(r.data); setError(''); } } catch(e) { if (active) { setItem(null); setError(e instanceof Error ? e.message : 'Broadcast unavailable'); } } } void load(); const timer = setInterval(load, 15000); return () => { active = false; clearInterval(timer); }; }, [id]);
  return <main className={styles.app}><header className={styles.nav}><Link className={styles.brand} href="/stream">MATCHWATCH<span>STREAM</span></Link><Link href="/stream/studio">My dashboard</Link></header><div className={styles.shell}>{error ? <p role="alert">{error}</p> : !item ? <p role="status">Loading broadcast...</p> : <><span className={styles.eyebrow}>{item.sport} · {item.ended ? 'ENDED' : item.live ? 'LIVE' : 'OFFLINE'}</span><h1>{item.title}</h1>{item.playerUrl && item.live ? <iframe className={own.frame} src={item.playerUrl} title={item.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /> : <section className={styles.empty}><h2>{item.ended ? 'This broadcast has ended' : item.unavailable ? 'The streaming server is unavailable' : 'Waiting for the camera'}</h2><p>{item.ended ? 'The creator can find saved segments in their recording library.' : 'This page checks for the broadcast automatically.'}</p></section>}<p>{item.description}</p><button className={styles.secondary} onClick={async () => { try { await navigator.clipboard.writeText(location.href); setError(''); } catch { setError('Copy the page address to share this broadcast.'); } }}>Copy watch link</button></>}</div></main>;
}
