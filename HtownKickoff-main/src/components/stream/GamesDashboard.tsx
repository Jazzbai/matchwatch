"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, Search, ExternalLink, CalendarDays } from 'lucide-react';
import type { RecentGame } from '../../lib/recent-games';
import type { RecapResult } from '../../lib/game-recaps';
import { youtubeSports } from '../../lib/stream-youtube';
import styles from './StreamApp.module.css';

type Feed = { games: RecentGame[]; from: string; to: string; coverage: string[]; failedRequests: number; snapshotAt?: string };
export default function GamesDashboard() {
  const [sport, setSport] = useState('All'); const [kind, setKind] = useState<'recaps' | 'past'>('recaps');
  const [feed, setFeed] = useState<Feed | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(''); const [limit, setLimit] = useState(12); const [retry, setRetry] = useState(0);
  const [results, setResults] = useState<Record<string, RecapResult>>({});
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setFeed(null); setLimit(12);
    fetch(`/api/stream/games?sport=${sport}`, { signal: controller.signal }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Results are unavailable.'); setFeed(data);
    }).catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [sport, retry]);
  const filtered = (feed?.games || []).filter((g) => `${g.home} ${g.away} ${g.league}`.toLowerCase().includes(query.toLowerCase()));
  const visible = filtered.slice(0, limit);
  const visibleKey = visible.map((g) => `${g.id}:${g.sport}`).join('|');
  useEffect(() => {
    const controller = new AbortController(); const queue = visible.filter((g) => !results[`US:${g.id}:${kind}`]); let index = 0;
    async function worker() {
      while (!controller.signal.aborted && index < queue.length) {
        const game = queue[index++];
        try {
          const response = await fetch(`/api/stream/games/video?sport=${game.sport}&id=${game.id}&kind=${kind}`, { signal: controller.signal });
          const data = await response.json();
          if (!controller.signal.aborted) setResults((current) => ({ ...current, [`US:${game.id}:${kind}`]: data.status ? data : { status: 'unavailable', reason: data.error || 'Video lookup failed.' } }));
        } catch { if (!controller.signal.aborted) setResults((current) => ({ ...current, [`US:${game.id}:${kind}`]: { status: 'unavailable', reason: 'Video lookup failed.' } })); }
      }
    }
    void Promise.all([worker(), worker()]); return () => controller.abort();
    // Results are deliberately excluded: each completed lookup must not cancel the other workers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, kind]);
  const dateRange = feed ? `${new Date(feed.from).toLocaleDateString()} – ${new Date(feed.to).toLocaleDateString()}` : 'Rolling last 7 days';
  const matched = visible.filter((g) => results[`US:${g.id}:${kind}`]?.status === 'matched').length;
  return <main className={styles.app}>
    <header className={styles.nav}><Link href="/stream" className={styles.brand}>MATCHWATCH<span>STREAM</span></Link><nav><Link href="/stream">Past games</Link><a href="https://matchwatch.us/matches">Match schedule</a><Link href="/stream/studio">Demo studio</Link></nav><span className={styles.signin}>YouTube ? US audience</span></header>
    <div className={styles.shell}>
      <section className={styles.gamesHero}><div><span className={styles.eyebrow}><CalendarDays size={14} /> THE LAST SEVEN DAYS IN SPORT</span><h1>Real games.<br /><em>Every moment worth replaying.</em></h1><p>Completed fixtures, final scores, and YouTube recaps matched to the teams and game date.</p><span className={styles.range}>{dateRange}</span></div><div className={styles.heroScore}><span>THE FINAL WHISTLE IS JUST THE BEGINNING.</span><strong>7<span>DAYS</span></strong><p>Soccer · Basketball · Baseball · Football</p></div></section>
      <section aria-label="Completed matches in the last seven days">
        <div className={styles.intro}><div><span className={styles.eyebrow}>RECENT RESULTS</span><h2>Catch up on your game.</h2></div><span>{feed ? `${feed.games.length} completed games · ${matched} matched videos on this page` : 'Loading real results'}</span></div>
        <div className={styles.toolbar}><div className={styles.tabs}><button aria-pressed={kind === 'recaps'} onClick={() => setKind('recaps')}>Recaps & highlights</button><button aria-pressed={kind === 'past'} onClick={() => setKind('past')}>Full-game replays</button></div><label className={styles.search}><Search size={16} /><input aria-label="Search teams or competitions" placeholder="Search teams or competitions" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(12); }} /></label></div>
        <div className={styles.sports}>{['All', ...youtubeSports].map((value) => <button aria-pressed={sport === value} key={value} onClick={() => { setSport(value); setQuery(''); }}>{value === 'All' ? 'All sports' : value}</button>)}</div>
        {feed && <p className={styles.libraryNote}>Coverage: {feed.coverage.join(', ')}. Final scores and fixtures: ESPN. Dates shown in your timezone.{feed.snapshotAt ? ` Using saved results checked ${new Date(feed.snapshotAt).toLocaleString()}; newer games may be missing.` : feed.failedRequests > 0 ? ` Some results requests failed (${feed.failedRequests}); this list may be incomplete.` : ''}</p>}
        {loading ? <div className={styles.empty} role="status"><CalendarDays size={32} /><h3>Loading the last seven days…</h3><p>Collecting completed fixtures from the results provider.</p></div> : error ? <div className={styles.empty} role="alert"><h3>Results could not load</h3><p>{error}</p><button className={styles.secondary} onClick={() => setRetry((v) => v + 1)}>Retry results</button></div> : visible.length ? <>
          <div className={styles.grid}>{visible.map((game) => {
            const result = results[`US:${game.id}:${kind}`]; const video = result?.video;
            return <article className={styles.gameCard} key={game.id}>
              <div className={styles.gamePoster} style={video ? { backgroundImage: `linear-gradient(0deg,#0a0f18e0,transparent),url(${video.thumbnail})` } : undefined}>
                <span className={styles.badge}>{game.league} · FINAL</span>
                {!video && <div className={styles.scoreboard}><div>{game.homeLogo && <img src={game.homeLogo} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />}<span>{game.home}</span></div><strong>{game.homeScore}<span>–</span>{game.awayScore}</strong><div>{game.awayLogo && <img src={game.awayLogo} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />}<span>{game.away}</span></div></div>}
                {video && <a className={styles.matchPlay} href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${game.home} vs ${game.away} on YouTube (opens in a new tab)`}><Play size={24} fill="currentColor" /></a>}
              </div>
              <div className={styles.cardBody}><small>{game.sport} · {new Date(game.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small><h3>{game.home} vs {game.away}</h3><p className={styles.resultLine}>Final score: {game.homeScore} – {game.awayScore}</p>
                {video ? <><span className={styles.matchLabel}>Match-linked video · {video.channel}</span><div className={styles.actions}><a className={styles.primary} href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer"><Play size={14} />{kind === 'recaps' ? 'Watch recap on YouTube' : 'Watch replay on YouTube'} <ExternalLink size={13} /></a></div></> : <p className={styles.videoStatus} role="status">{!result ? 'Checking YouTube for this game…' : result.status === 'not_found' ? `No US-eligible ${kind === 'recaps' ? 'recap' : 'full replay'} found.` : result.reason || 'YouTube lookup unavailable.'}</p>}
              </div>
            </article>;
          })}</div>
          {visible.length < filtered.length && <div className={styles.moreGames}><button className={styles.secondary} onClick={() => setLimit((v) => v + 12)}>Show more games ({filtered.length - visible.length} remaining)</button></div>}
        </> : <div className={styles.empty}><h3>No completed games found</h3><p>{query ? 'Try a different team or competition.' : 'No completed fixtures were returned for this sport in the rolling seven-day window.'}</p></div>}
        <p className={styles.libraryNote}>A missing recap does not hide the game. Videos must match both teams and an explicit game date, or a unique matchup with an official publisher upload within 48 hours. Repeat matchups require an explicit date. This automated check can miss legitimate videos; Known US country restrictions are filtered out; uploader rules can still change.</p>
      </section>
      <footer className={styles.footer}><Link href="/stream">MATCHWATCH STREAM</Link><span>Real results. Original YouTube videos.</span><Link href="/stream/studio">Hackathon demo studio</Link></footer>
    </div>

  </main>;
}
