"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ANNOUNCEMENTS } from "@/config/site";

const ROTATE_INTERVAL_MS = 5000;

/**
 * News-style rotating announcement line (owner request Nov 2026): cycles the
 * placeholder messages with a slide-up entrance. Rotation pauses while
 * hovered (so the link stays clickable) and never starts for users who
 * prefer reduced motion — they keep the first message.
 */
export function AnnouncementTicker() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (ANNOUNCEMENTS.length < 2 || isPaused) {
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
      () => setIndex((current) => (current + 1) % ANNOUNCEMENTS.length),
      ROTATE_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [isPaused]);

  const item = ANNOUNCEMENTS[index] ?? ANNOUNCEMENTS[0]!;

  return (
    <p
      key={index}
      className="overflow-hidden whitespace-nowrap text-center text-xs font-medium tracking-wide animate-[ticker-in_400ms_ease-out]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <span className="sm:hidden">{item.shortMessage}</span>
      <span className="hidden sm:inline">{item.message}</span>{" "}
      <Link
        href={item.href}
        className="font-semibold text-white underline decoration-white/80 decoration-2 underline-offset-4 transition-colors hover:decoration-white"
      >
        {item.linkLabel}
      </Link>
    </p>
  );
}
