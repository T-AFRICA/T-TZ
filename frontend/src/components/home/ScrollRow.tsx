"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A horizontal, swipeable row of product cards (scroll-snap) with
 * previous/next buttons from md. Touch users swipe; keyboard users tab
 * through the cards and the row follows focus. No autoplay.
 */
export function ScrollRow({
  label,
  tone = "light",
  children,
}: {
  /** Accessible name of the row, e.g. "Offers". */
  label: string;
  tone?: "light" | "dark";
  children: React.ReactNode;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  function scrollByPage(direction: 1 | -1) {
    const list = listRef.current;
    if (!list) return;
    list.scrollBy({ left: direction * list.clientWidth * 0.85, behavior: "smooth" });
  }

  const button = `hidden h-10 w-10 place-items-center rounded-full border transition-colors md:grid ${
    tone === "dark"
      ? "border-white/40 text-white hover:bg-white hover:text-[var(--color-action-red)]"
      : "border-[var(--color-light-grey)] bg-white text-[var(--text-primary)] hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
  }`;

  return (
    <div>
      <ul
        ref={listRef}
        aria-label={label}
        className="-my-2 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-2 [scrollbar-width:none] md:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      <div className="mt-3 hidden justify-end gap-2 md:flex">
        <button type="button" aria-label={`Previous: ${label}`} onClick={() => scrollByPage(-1)} className={button}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" aria-label={`Next: ${label}`} onClick={() => scrollByPage(1)} className={button}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
