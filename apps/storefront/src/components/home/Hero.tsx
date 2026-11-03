"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * Campaign banner carousel — owner-supplied artwork from the brand's Kenya
 * storefront (tronic.co.ke, Nov 2026), in both desktop (1920×500) and mobile
 * (2:1) variants. The offer claims are the brand's own campaign content, not
 * invented copy; swap per campaign. Autoplay advances slides, pauses while
 * hovered and never auto-rotates for reduced-motion users (owner accepted
 * autoplay with no visible controls, Nov 2026).
 */
const BANNERS = [
  {
    image: "/banners/black-november-pendants.webp",
    mobileImage: "/banners/black-november-pendants-mobile.png",
    alt: "Black November offer — up to 50% off pendant lighting",
    href: "/categories/lighting",
  },
  {
    image: "/banners/black-november-wall-lights.webp",
    mobileImage: "/banners/black-november-wall-lights-mobile.png",
    alt: "Black November offer — up to 50% off outdoor wall lights",
    href: "/categories/lighting",
  },
  {
    image: "/banners/water-heaters.webp",
    mobileImage: "/banners/water-heaters-mobile.png",
    alt: "Water heaters and instant showers — smart hot water solutions for every home",
    href: "/categories/home-appliances",
  },
] as const;

const BANNER_INTERVAL_MS = 5000;

export function Hero() {
  const [bannerIndex, setBannerIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const banner = BANNERS[bannerIndex] ?? BANNERS[0]!;

  useEffect(() => {
    if (BANNERS.length < 2 || isPaused) {
      return;
    }
    // matchMedia is absent in some environments (e.g. jsdom in tests).
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const timer = window.setInterval(
      () => setBannerIndex((current) => (current + 1) % BANNERS.length),
      BANNER_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [isPaused]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Campaign banners"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        role="group"
        aria-roledescription="slide"
        aria-label={`${bannerIndex + 1} of ${BANNERS.length}`}
        key={bannerIndex}
        className="animate-[hero-copy-in_500ms_ease-out_both]"
      >
        <Link
          href={banner.href}
          aria-label={`${banner.alt} — shop the offer`}
          className="block w-full focus-visible:outline focus-visible:-outline-offset-4 focus-visible:outline-[3px] focus-visible:outline-white"
        >
          {/* Mobile variant (2:1) */}
          <span className="relative block aspect-[2/1] w-full overflow-hidden md:hidden">
            <Image src={banner.mobileImage} alt="" fill sizes="100vw" className="object-cover" />
          </span>
          {/* Desktop variant (1920×500), full-bleed with a height cap so the
              category section stays within reach on tall screens */}
          <span className="relative hidden aspect-[1920/500] max-h-[30rem] w-full overflow-hidden md:block">
            <Image
              src={banner.image}
              alt=""
              fill
              priority={bannerIndex === 0}
              sizes="100vw"
              className="object-cover"
            />
          </span>
        </Link>
      </div>
    </section>
  );
}
