"use client";

import { useEffect, useState } from "react";
import styles from "./SportsCarousel.module.css";

const slides = [
  {
    category: "Basketball / NBA",
    title: "From courtside to capital",
    subtitle: "The business engine behind the league",
    text: "Premium seating, jersey sponsorships, media rights, and loyal fans power the NBA. Global stars bring that energy beyond the court into merchandise, hospitality, and watch parties.",
    image: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1600&q=80",
  },
  {
    category: "Baseball",
    title: "More than a day at the ballpark",
    subtitle: "Tradition meets modern hospitality",
    text: "From suites and family ticket bundles to local sponsors and game-day dining, baseball turns every stadium visit into an experience. Find your own gathering place for the next big game.",
    image: "https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?auto=format&fit=crop&w=1600&q=80",
  },
  {
    category: "Soccer / Messi",
    title: "Global stars. Local connections.",
    subtitle: "Messi, Inter Miami, and the power of fandom",
    text: "Soccer brings international fan culture into local venues. From club merchandise to match-day hospitality, stars like Messi inspire communities to come together and share the game.",
    image: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1600&q=80",
  },
];

export default function SportsCarousel() {
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
    <section className={styles.carousel} aria-label="The business of sports" aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}>
      <div className={styles.heading}>
        <h2>The business of sports</h2>
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
              aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}`}
              style={{ backgroundImage: `linear-gradient(90deg,rgba(5,8,14,.94),rgba(5,8,14,.55)),url("${slide.image}")` }}>
              <span className={styles.category}>{slide.category}</span>
              <h3>{slide.title}</h3>
              <p className={styles.subtitle}>{slide.subtitle}</p>
              <p>{slide.text}</p>
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
  );
}
