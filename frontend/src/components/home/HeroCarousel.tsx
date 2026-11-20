"use client";

import { Children, useEffect, useRef, useState, type AnimationEvent, type ReactNode } from "react";

/** The first slide's lighting loop (globals.css); one full cycle is 18 s. */
const CYCLE_ANIMATION = "hero-room-dim";
/** How long each later slide stays before the first slide comes back. */
const SLIDE_MS = 7000;

/**
 * The homepage hero as a slideshow (owner request 2026-11-19). The first
 * slide is the animated "Power Every Space" room; when its lighting cycle
 * ends (the room has just gone dark) the next slide fades in, stays
 * SLIDE_MS, and the room comes back and lights up again. The room's
 * animations are paused while it is hidden, so it always restarts from the
 * start of its cycle.
 *
 * - The dots switch slides by hand; after that the slideshow stays where
 *   the visitor put it.
 * - Hovering or focusing the hero holds the current slide.
 * - With reduced motion the room does not animate, so the slideshow does
 *   not move by itself either; the dots still work.
 * - Only the shown slide is reachable (the others are inert), and slides
 *   fade (no movement), with no fade under reduced motion.
 * The server HTML shows the first slide, so nothing waits for JavaScript.
 */
export function HeroCarousel({ labels, children }: { labels: readonly string[]; children: ReactNode }) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const hold = useRef(false);

  // Every lit and dim layer of the room fires its own iteration event; the
  // first one moves on, the rest find the slide already changed.
  function onCycleEnd(event: AnimationEvent<HTMLDivElement>) {
    if (!auto || hold.current || event.animationName !== CYCLE_ANIMATION) return;
    setActive((current) => (current === 0 && count > 1 ? 1 : current));
  }

  // A later slide stays SLIDE_MS (longer while it is held), then the next one comes.
  useEffect(() => {
    if (!auto || active === 0) return;
    let timer = window.setTimeout(function next() {
      if (hold.current) {
        timer = window.setTimeout(next, 1000);
        return;
      }
      setActive((current) => (current + 1) % count);
    }, SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [active, auto, count]);

  if (count < 2) return <>{slides}</>;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="TRONIC highlights"
      className="relative grid"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") hold.current = true;
      }}
      onPointerLeave={() => {
        hold.current = false;
      }}
      onFocus={() => {
        hold.current = true;
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hold.current = false;
      }}
    >
      {slides.map((slide, index) => {
        const shown = index === active;
        return (
          <div
            key={index}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}: ${labels[index] ?? ""}`}
            inert={!shown}
            data-paused={shown ? undefined : "true"}
            onAnimationIteration={index === 0 ? onCycleEnd : undefined}
            className={`hero-slide [grid-area:1/1] transition-opacity duration-700 ease-out motion-reduce:transition-none ${
              shown ? "z-[1] opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {slide}
          </div>
        );
      })}
      <div className="absolute bottom-3 right-3 z-20 flex items-center rounded-full bg-black/35 px-1 backdrop-blur-sm md:bottom-4 md:right-5">
        {labels.slice(0, count).map((label, index) => (
          <button
            key={label}
            type="button"
            aria-label={`Show slide ${index + 1}: ${label}`}
            aria-current={index === active ? "true" : undefined}
            onClick={() => {
              setAuto(false);
              setActive(index);
            }}
            className="grid h-6 w-7 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
          >
            <span
              aria-hidden="true"
              className={`block h-2 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                index === active ? "w-5 bg-white" : "w-2 bg-white/60"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
