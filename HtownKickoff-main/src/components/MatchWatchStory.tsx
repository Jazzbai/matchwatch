import Image from 'next/image';
import Link from 'next/link';
import styles from './MatchWatchStory.module.css';

export default function MatchWatchStory() {
  return <section id="our-story" className={styles.section} aria-labelledby="matchwatch-story-title">
    <div className={styles.heading}><span>THE MATCHWATCH STORY</span><h2 id="matchwatch-story-title">Where the match finds its tribe.</h2><p>Our original idea brought fans, venues, and matches together. Personal streaming and media are the next chapter.</p></div>
    <div className={styles.layout}>
      <figure className={styles.figure}>
        <a href="/images/story/matchwatch-original-launch.png" target="_blank" rel="noopener noreferrer" aria-label="View the original MatchWatch launch sheet at full size in a new tab">
          <Image src="/images/story/matchwatch-original-launch.png" width={1487} height={1925} sizes="(max-width: 760px) 90vw, 480px" alt="Original MatchWatch launch concept connecting sports fans, venues, and matches, with ideas for venue discovery and community engagement." />
          <span className={styles.expand}>View original launch sheet ↗</span>
        </a>
        <figcaption>Original concept · Historical launch sheet. Features described in this early vision may still be planned.</figcaption>
      </figure>
      <div className={styles.chapters}>
        <article><span className={styles.label}>THE FOUNDATION</span><h3>Fans + venues + matches.</h3><p>Discover the game, find a place to watch, and bring your community together. Venue discovery and match-day experiences remain part of MatchWatch.</p><div className={styles.actions}><Link href="/venues">Explore venues</Link><Link href="/matches">Find a match</Link></div></article>
        <article className={styles.next}><span className={styles.label}>THE NEXT CHAPTER</span><h3>Your game. Your channel. Your media.</h3><p>A personal space for broadcasts, saved recordings, and favorite sports videos, built around your own dashboard.</p><p className={styles.status}>Personal streaming integration is built. Production setup and physical camera testing are in progress.</p><div className={styles.actions}><Link href="/stream/studio">My streaming dashboard</Link><Link href="/stream">Explore game recaps</Link></div></article>
      </div>
    </div>
  </section>;
}
