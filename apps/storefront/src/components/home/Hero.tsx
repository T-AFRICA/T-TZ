"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, Container } from "@tronic/ui";
import { HeroArt, type HeroArtKind } from "./HeroArt";

interface HeroSlide {
  eyebrow: string;
  title: string;
  lines: readonly string[];
  href: string;
  cta: string;
  art: HeroArtKind;
}

/**
 * PLACEHOLDER campaign slides: generic category messaging pending the real
 * campaign imagery and copy (homepage content is a W02 deliverable). Slides
 * link only to real category routes and must not state prices or offers.
 * Artwork is in-house illustration (see HeroArt.tsx), tagged as such in the
 * UI until approved product photography replaces it.
 */
const SLIDES: readonly HeroSlide[] = [
  {
    eyebrow: "Lighting",
    title: "LED Flood Lights",
    lines: ["Excellent waterproof performance", "Built for all weather conditions"],
    href: "/categories/lighting",
    cta: "Shop now",
    art: "floodlight",
  },
  {
    eyebrow: "Cables & Wiring",
    title: "Certified Cables",
    lines: ["Reliable conductors for safe installations", "For homes, businesses and industry"],
    href: "/categories/cables-wiring",
    cta: "Shop now",
    art: "cables",
  },
  {
    eyebrow: "Switchgear & Protection",
    title: "Protect Every Circuit",
    lines: ["Breakers, isolators and surge protection", "Trusted across East Africa since 1993"],
    href: "/categories/switchgear-protection",
    cta: "Shop now",
    art: "breaker",
  },
];

/**
 * Premium hero carousel: two-column editorial composition (copy left, product
 * illustration right) on premium black with a controlled red glow. Controls
 * live in a bottom bar inside the content column so they never overlap copy
 * at any viewport. Manual navigation only — no autoplay (WCAG 2.2).
 */
export function Hero() {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index] ?? SLIDES[0]!;

  function go(delta: number) {
    setIndex((current) => (current + delta + SLIDES.length) % SLIDES.length);
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured categories"
      className="relative overflow-hidden max-md:bg-transparent md:bg-[var(--color-premium-black)] md:text-white"
    >
      {/* Mobile: white floating campaign card (approved mobile UI reference) */}
      <Container className="pt-3 md:hidden">
        <div
          key={`mobile-${index}`}
          className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-[0_10px_30px_-18px_rgba(17,17,17,0.35)] animate-[hero-copy-in_400ms_ease-out_both]"
        >
          <div className="relative z-10 max-w-[60%]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-action-red)]">
              {slide.eyebrow}
            </p>
            <h1
              className="mt-1.5 text-xl font-bold leading-snug text-[var(--color-premium-black)]"
              style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
            >
              {slide.title}
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              {slide.lines[0]}
            </p>
            <Link
              href={slide.href}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-action-red)] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)]"
            >
              {slide.cta}
              <ArrowRightIcon size={14} />
            </Link>
          </div>
          <div aria-hidden="true" className="absolute -right-3 bottom-0 h-36 w-36">
            <HeroArt kind={slide.art} />
          </div>
          <span className="absolute bottom-1.5 right-2 rounded-sm bg-black/5 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-black/40">
            Illustration
          </span>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5" role="group" aria-label="Slide controls">
          {SLIDES.map((item, dotIndex) => (
            <button
              key={item.title}
              type="button"
              aria-label={`Go to slide ${dotIndex + 1}`}
              aria-current={dotIndex === index}
              onClick={() => setIndex(dotIndex)}
              className={`h-2 rounded-full transition-all ${
                dotIndex === index
                  ? "w-5 bg-[var(--color-action-red)]"
                  : "w-2 bg-[var(--color-light-grey)]"
              }`}
            />
          ))}
        </div>
      </Container>

      {/* Desktop: dark editorial two-column composition */}
      <div className="relative hidden md:block">
        {/* Brand glow over the premium black base */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_30%,rgba(215,25,32,0.35),transparent_55%),radial-gradient(ellipse_at_0%_100%,rgba(215,25,32,0.14),transparent_40%)]"
        />
        <Container className="relative">
        <div
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${SLIDES.length}`}
          className="grid grid-cols-1 items-center gap-x-8 gap-y-2 pb-6 pt-10 lg:min-h-[27rem] lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:py-14"
        >
          {/* Copy column — keyed so each slide change replays the entrance */}
          <div key={`copy-${index}`} className="max-w-xl animate-[hero-copy-in_450ms_ease-out_both]">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#ff6b72]">
              <span aria-hidden="true" className="h-px w-8 bg-[var(--color-action-red)]" />
              {slide.eyebrow}
            </p>
            <h1
              className="mt-4 text-[length:var(--text-display)] font-bold uppercase leading-[1.08] tracking-[-0.01em]"
              style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
            >
              {slide.title}
            </h1>
            <div className="mt-4 space-y-1 text-sm leading-relaxed text-white/75 sm:text-base">
              {slide.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="mt-7">
              <Link
                href={slide.href}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-action-red)] px-7 py-3 text-sm font-semibold uppercase tracking-wide transition-colors hover:bg-[var(--color-action-red-dark)]"
              >
                {slide.cta}
                <ArrowRightIcon size={16} />
              </Link>
            </div>
          </div>

          {/* Product illustration column */}
          <div
            key={`art-${index}`}
            className="relative mx-auto mt-4 h-44 w-full max-w-[15rem] animate-[hero-art-in_550ms_ease-out_both] sm:h-64 sm:max-w-sm lg:mt-0 lg:h-[21rem] lg:max-w-md"
          >
            {/* spotlight rings behind the product */}
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 aspect-square h-[105%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]"
            />
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 aspect-square h-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
            />
            <HeroArt kind={slide.art} />
            {/* Honest-content tag: in-house illustration, not product photography */}
            <span className="absolute bottom-0 right-0 rounded-sm bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/50">
              Illustration
            </span>
          </div>
        </div>

        {/* Control bar — arrows + progress, never overlapping content */}
        <div className="flex items-center justify-between border-t border-white/10 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => go(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-white/60 hover:text-white"
            >
              <ArrowLeftIcon size={18} />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => go(1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-white/60 hover:text-white"
            >
              <ArrowRightIcon size={18} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {SLIDES.map((item, dotIndex) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Go to slide ${dotIndex + 1}`}
                aria-current={dotIndex === index}
                onClick={() => setIndex(dotIndex)}
                className={`h-1.5 rounded-full transition-all ${
                  dotIndex === index
                    ? "w-8 bg-[var(--color-brand-red)]"
                    : "w-4 bg-white/25 hover:bg-white/60"
                }`}
              />
            ))}
            <span className="ml-3 text-xs tabular-nums text-white/50" aria-hidden="true">
              {String(index + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
            </span>
          </div>
        </div>
        </Container>
      </div>
    </section>
  );
}
