"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useData } from "../lib/data-provider";
import styles from "./SportsCarousel.module.css";

const slides = [
  {
    category: "Basketball / NBA",
    title: "LeBron James",
    subtitle: "A legacy beyond the court",
    text: "From NBA greatness to sponsorships and media, LeBron shows how an athlete's influence reaches far beyond game night.",
    image: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1600&q=80",
  },
  {
    category: "Baseball",
    title: "Jackie Robinson",
    subtitle: "A legacy that changed the game",
    text: "A baseball pioneer whose courage and impact endure. Celebrate the stories and traditions that bring generations of fans together.",
    image: "https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?auto=format&fit=crop&w=1600&q=80",
  },
  {
    category: "Soccer / Messi",
    title: "Lionel Messi",
    subtitle: "Messi, Inter Miami, and the power of fandom",
    text: "From Messi and Inter Miami to your neighborhood sports bar, the world's game brings fans together wherever they watch.",
    image: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1600&q=80",
  },
];

export default function SportsCarousel() {
  const { venues, isLoading } = useData();
  const featuredBars = venues.filter((venue) =>
    !venue.amenities?.includes("OFFICIAL_FAN_FEST") &&
    !/fifa fan festival|fifa fan zone|official fifa fan zone/i.test(venue.name)
  ).sort((a, b) => (b.rating || 0) - (a.rating || 0) ||
    (b.upcomingEventsCount || 0) - (a.upcomingEventsCount || 0) || a.name.localeCompare(b.name)).slice(0, 3);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || !rotationEnabled) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % slides.length), 4500);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, rotationEnabled]);

  const move = (direction: number) => setActive((value) => (value + direction + slides.length) % slides.length);

  return (
    <div className={styles.layout}>
    <section className={styles.carousel} aria-label="Sports legends" aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}>
      <div className={styles.heading}>
        <h2>Legends of the game</h2>
        <button type="button" onClick={() => {
          if (reducedMotion) { setReducedMotion(false); setRotationEnabled(true); }
          else setRotationEnabled((value) => !value);
        }} aria-pressed={!rotationEnabled || reducedMotion}>
          {!rotationEnabled || reducedMotion ? "Play slides" : "Pause slides"}
        </button>
      </div>
      <div className={styles.viewport}>
        <div className={styles.track} style={{ transform: `translateX(-${active * 100}%)` }}>
          {slides.map((slide, index) => (
            <article key={slide.category} className={styles.slide} aria-hidden={index !== active}
              aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}`}>
              <div className={styles.copy}>
              <span className={styles.category}>{slide.category}</span>
              <h3>{slide.title}</h3>
              <p className={styles.subtitle}>{slide.subtitle}</p>
              <p>{slide.text}</p>
              <span className={styles.slideNumber}>0{index + 1} <span>/ 0{slides.length}</span></span>
              </div>
              <div className={styles.image} style={{ backgroundImage: `url("${slide.image}")` }} aria-hidden="true" />
            </article>
          ))}
        </div>
      </div>
      <div className={styles.controls}>
        <button type="button" aria-label="Previous slide" onClick={() => move(-1)}>&larr;</button>
        <div className={styles.dots}>
          {slides.map((slide, index) => (
            <button type="button" key={slide.category} aria-label={`Show ${slide.category} slide`}
              aria-current={index === active ? "true" : undefined} onClick={() => setActive(index)}
              className={index === active ? styles.active : undefined} />
          ))}
        </div>
        <button type="button" aria-label="Next slide" onClick={() => move(1)}>&rarr;</button>
      </div>
    </section>
    <aside className={styles.bars} aria-label="Featured sports bars">
      <div className={styles.barHeading}>
        <div><span className={styles.category}>Your next game night</span><h2>Featured sports bars</h2></div>
        <Link href="/venues">View all &rarr;</Link>
      </div>
      <div className={styles.barList}>
        {featuredBars.map((venue, index) => (
          <Link className={styles.barCard} key={venue.id} href={`/venues/${venue.slug || venue.id}`}>
            <div className={styles.barPhoto} style={venue.coverImageUrl ? { backgroundImage: `url(${JSON.stringify(venue.coverImageUrl)})` } : undefined}>
              {!venue.coverImageUrl && <span>{venue.name.slice(0, 2).toUpperCase()}</span>}
              <span className={styles.rank}>0{index + 1}</span>
            </div>
            <div className={styles.barCopy}>
              <span className={styles.city}>{[venue.city, venue.state].filter(Boolean).join(", ")}</span>
              <h3>{venue.name}</h3>
              <p>{venue.rating ? `★ ${venue.rating.toFixed(1)}` : "Discover this venue"}{venue.upcomingEventsCount ? ` · ${venue.upcomingEventsCount} events` : ""}</p>
            </div>
            <span className={styles.barArrow} aria-hidden="true">&nearr;</span>
          </Link>
        ))}
        {featuredBars.length === 0 && <p className={styles.empty}>{isLoading ? "Finding your next watch spot…" : "Explore venues to find your next watch spot."}</p>}
      </div>
    </aside>
    </div>
  );
}
