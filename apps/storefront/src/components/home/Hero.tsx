"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, Container } from "@tronic/ui";

interface HeroSlide {
  eyebrow: string;
  title: string;
  lines: readonly string[];
  href: string;
  cta: string;
}

/**
 * PLACEHOLDER campaign slides: generic category messaging pending the real
 * campaign imagery and copy (homepage content is a W02 deliverable). Slides
 * link only to real category routes and must not state prices or offers.
 */
const SLIDES: readonly HeroSlide[] = [
  {
    eyebrow: "Lighting",
    title: "LED Flood Lights",
    lines: ["Excellent waterproof performance", "Built for all weather conditions"],
    href: "/categories/lighting",
    cta: "Shop now",
  },
  {
    eyebrow: "Cables & Wiring",
    title: "Certified Cables",
    lines: ["Reliable conductors for safe installations", "For homes, businesses and industry"],
    href: "/categories/cables-wiring",
    cta: "Shop now",
  },
  {
    eyebrow: "Switchgear & Protection",
    title: "Protect Every Circuit",
    lines: ["Breakers, isolators and surge protection", "Trusted across East Africa since 1993"],
    href: "/categories/switchgear-protection",
    cta: "Shop now",
  },
];

/**
 * Premium hero carousel: dark panel with a red brand glow, Montserrat
 * display type and a single CTA per slide. Manual navigation only (arrows +
 * dots), no autoplay — respects users who need time to read (WCAG 2.2).
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
      className="relative overflow-hidden bg-[var(--color-premium-black)] text-white"
    >
      {/* Brand glow over the premium black base */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_15%,rgba(215,25,32,0.4),transparent_55%),radial-gradient(ellipse_at_10%_90%,rgba(215,25,32,0.18),transparent_45%)]"
      />
      <Container className="relative">
        <div
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${SLIDES.length}`}
          className="flex min-h-[20rem] flex-col justify-center px-10 py-14 sm:min-h-[24rem] sm:px-12 lg:min-h-[26rem] lg:py-20"
        >
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--color-brand-red)] sm:text-sm">
            {slide.eyebrow}
          </p>
          <h1
            className="mt-3 max-w-3xl text-[length:var(--text-display)] font-bold uppercase leading-[1.05]"
            style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
          >
            {slide.title}
          </h1>
          <div className="mt-4 space-y-1 text-base text-[var(--color-light-grey)] sm:text-lg">
            {slide.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="mt-8">
            <Link
              href={slide.href}
              className="inline-flex items-center gap-2 rounded-md border border-white/70 bg-[var(--color-action-red)] px-7 py-3 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-[var(--color-action-red-dark)]"
            >
              {slide.cta}
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>

        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => go(-1)}
          className="absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeftIcon size={24} />
        </button>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => go(1)}
          className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowRightIcon size={24} />
        </button>

        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2">
          {SLIDES.map((item, dotIndex) => (
            <button
              key={item.title}
              type="button"
              aria-label={`Go to slide ${dotIndex + 1}`}
              aria-current={dotIndex === index}
              onClick={() => setIndex(dotIndex)}
              className={`h-2.5 rounded-full transition-all ${
                dotIndex === index ? "w-6 bg-[var(--color-brand-red)]" : "w-2.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
