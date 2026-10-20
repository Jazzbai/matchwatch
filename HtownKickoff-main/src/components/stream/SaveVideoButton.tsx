"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import styles from './StreamApp.module.css';
export default function SaveVideoButton({ videoId, title, sport }: { videoId: string; title: string; sport: string }) {
  const { user, isLoading } = useAuth(); const [state, setState] = useState(''); const [busy, setBusy] = useState(false);
  if (!isLoading && !user) return <Link className={styles.secondary} href="/login">Sign in to save</Link>;
  return <><button className={styles.secondary} disabled={busy || isLoading || state === 'Saved'} onClick={async () => {
    setBusy(true); setState('');
    try { await api.post('/streams/favorites', { videoId, title, sport }); setState('Saved'); }
    catch (e) { setState(e instanceof Error ? e.message : 'Could not save video'); }
    finally { setBusy(false); }
  }}><Bookmark size={14} />{busy ? 'Saving...' : state === 'Saved' ? 'Saved' : 'Save to favorites'}</button>{state && <small role="status">{state}</small>}</>;
}
