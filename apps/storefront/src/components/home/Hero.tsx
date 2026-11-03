"use client";

import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { ArrowRightIcon, Container } from "@tronic/ui";

/**
 * Cinematic hero (owner direction Nov 2026, v2 — replaces the multi-card
 * energy scene; campaign artwork remains in /public/banners). Commercial
 * advertising composition: copy and CTAs on the left, one large featured
 * TRONIC bulb on the right inside a warm bloom, standing on a soft ground
 * shadow. A single energy wire carries a light packet toward the bulb and
 * the bulb's glow peaks as the packet arrives (phase-matched CSS cycles in
 * globals.css). Mouse-only parallax adds depth via Motion springs.
 * Copy is generic brand messaging — no offers, prices or claims.
 * Fixed per-breakpoint heights prevent layout shift; the bulb image is the
 * LCP candidate and loads with priority; every effect is inert under
 * reduced motion.
 */
export function Hero() {
  const reduceMotion = useReducedMotion() ?? false;

  // Pointer parallax: -1..1 across the section, spring-smoothed, mouse only.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const productX = useSpring(useTransform(pointerX, [-1, 1], [-10, 10]), {
    stiffness: 60,
    damping: 16,
  });
  const productY = useSpring(useTransform(pointerY, [-1, 1], [-7, 7]), {
    stiffness: 60,
    damping: 16,
  });
  const bloomX = useSpring(useTransform(pointerX, [-1, 1], [6, -6]), {
    stiffness: 50,
    damping: 18,
  });

  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (reduceMotion || event.pointerType !== "mouse") {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
    pointerY.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  function onPointerLeave() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <section
      aria-label="TRONIC — electrical supplies, lighting and switchgear"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative overflow-hidden bg-[#121214] text-white"
    >
      {/* Environment: charcoal base, deep-red falloff behind the product,
          vignette toward the edges for a cinematic frame */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(112deg,#121214_0%,#141114_46%,#2a0d10_78%,#3a0f12_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]"
      />

      {/* Energy wire: one solid, elegant line from the left edge to the
          product, with a traveling light packet. Stretched to percentage
          coordinates so it lands near the bulb at every width. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 560"
        preserveAspectRatio="none"
        className="absolute inset-0 hidden h-full w-full md:block"
      >
        <defs>
          <linearGradient id="hero-wire-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ef1c26" stopOpacity="0" />
            <stop offset="0.55" stopColor="#ef1c26" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffb466" stopOpacity="0.55" />
          </linearGradient>
          <filter id="hero-wire-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>
        {/* Wire base — faint, solid */}
        <path
          d="M-20,470 C 260,430 520,440 740,370 S 960,300 1020,296"
          fill="none"
          stroke="url(#hero-wire-grad)"
          strokeWidth="1.6"
          pathLength="100"
        />
        {/* Traveling light packet */}
        <path
          d="M-20,470 C 260,430 520,440 740,370 S 960,300 1020,296"
          fill="none"
          stroke="#ffd9a8"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength="100"
          filter="url(#hero-wire-glow)"
          className="hero-wire-pulse"
        />
      </svg>

      <Container className="relative">
        <div className="grid min-h-[26rem] items-center gap-6 py-10 md:min-h-[28rem] md:grid-cols-[1.05fr_0.95fr] md:gap-8 md:py-12 lg:min-h-[30rem]">
          {/* Copy */}
          <div className="max-md:text-center">
            <p className="animate-[hero-copy-in_500ms_ease-out_both] text-[11px] font-semibold uppercase tracking-[0.3em] text-[#ff6b72]">
              Powering Tanzania
            </p>
            <h1
              className="mt-3 animate-[hero-copy-in_500ms_ease-out_120ms_both] text-[length:var(--text-h1)] font-bold leading-[1.06] tracking-[-0.01em]"
              style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
            >
              Energy for Every
              <span className="block text-[var(--color-brand-red)]">Home &amp; Industry</span>
            </h1>
            <p className="mt-4 max-w-md animate-[hero-copy-in_500ms_ease-out_240ms_both] text-sm leading-relaxed text-white/70 max-md:mx-auto md:text-[15px]">
              Discover reliable lighting, electrical solutions, and power innovations — all in one
              place.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3 animate-[hero-copy-in_500ms_ease-out_360ms_both] max-md:justify-center">
              <Link
                href="/#departments"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-action-red)] px-6 py-3 text-sm font-semibold shadow-[0_10px_30px_-10px_rgba(215,25,32,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-action-red-dark)]"
              >
                Explore Products
                <ArrowRightIcon size={16} />
              </Link>
              <Link
                href="/categories/lighting"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/90 transition-colors hover:border-white/60 hover:text-white"
              >
                Shop Lighting
              </Link>
            </div>
          </div>

          {/* Featured product: one large bulb inside a warm bloom, feathered
              out of its white studio background, over a soft ground shadow.
              Fixed-size stage — no layout shift. */}
          <div
            aria-hidden="true"
            className="relative mx-auto h-64 w-64 sm:h-72 sm:w-72 md:h-[22rem] md:w-[22rem] lg:h-[24rem] lg:w-[24rem]"
          >
            {/* Ambient bloom behind the bulb (breathes slowly) */}
            <motion.div style={{ x: bloomX }} className="absolute inset-0">
              <div className="hero-ambient absolute inset-[-18%] rounded-full bg-[radial-gradient(circle,rgba(255,180,102,0.28)_0%,rgba(239,28,38,0.14)_42%,transparent_70%)] blur-2xl" />
            </motion.div>
            {/* Product with parallax — bulb-hero.png is a true cutout of the
                official bulb photo (border-connected white removed by flood
                fill, leftover floor reflection faded), so the bulb sits
                directly in the scene */}
            <motion.div style={{ x: productX, y: productY }} className="absolute inset-0">
              {/* Tight warm backlight hugging the bulb head */}
              <div className="hero-bulb-glow absolute left-1/2 top-[30%] h-[46%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,196,120,0.55)_0%,rgba(255,150,80,0.22)_45%,transparent_72%)] blur-xl" />
              <Image
                src="/products/bulb-hero.png"
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 24rem, (min-width: 768px) 22rem, 18rem"
                className="object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.55)]"
              />
              {/* Soft bloom over the lit dome, peaking with the packet */}
              <div className="hero-bulb-glow absolute left-1/2 top-[26%] h-[34%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,214,150,0.5),transparent_70%)] mix-blend-screen blur-lg" />
            </motion.div>
            {/* Ground contact shadow + faint light pool */}
            <div className="absolute bottom-[4%] left-1/2 h-7 w-52 -translate-x-1/2 rounded-[100%] bg-black/70 blur-xl md:w-60" />
            <div className="absolute bottom-[2%] left-1/2 h-10 w-64 -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse,rgba(239,28,38,0.22),transparent_70%)] blur-lg md:w-72" />
          </div>
        </div>
      </Container>

      {/* Bottom energy seam into the page */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(239,28,38,0.55),transparent)]"
      />
    </section>
  );
}
