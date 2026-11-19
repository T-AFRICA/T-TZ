"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** A mouse must move this far before a press becomes a drag (a smaller move is still a click). */
const DRAG_THRESHOLD_PX = 5;

/**
 * A horizontal row of product cards (scroll-snap) that moves only when the
 * visitor moves it: touch users swipe, mouse users drag it or use the
 * previous/next buttons (from md), keyboard users tab through the cards and
 * the row follows focus. No autoplay. A drag that moved the row does not
 * also open the card it started on.
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
  const drag = useRef<{ x: number; left: number; pointer: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  function scrollByPage(direction: 1 | -1) {
    const list = listRef.current;
    if (!list) return;
    list.scrollBy({ left: direction * list.clientWidth * 0.85, behavior: "smooth" });
  }

  function endDrag() {
    const state = drag.current;
    drag.current = null;
    if (!state?.moved) return;
    // The click that follows this release is not a click on a card. It comes
    // straight after pointerup, so the flag is cleared on the next task.
    swallowClick.current = true;
    window.setTimeout(() => {
      swallowClick.current = false;
    }, 0);
    // Snapping comes back on and the row settles on the nearest card.
    setDragging(false);
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
        data-dragging={dragging ? "true" : undefined}
        className={`-my-2 flex gap-3 overflow-x-auto overscroll-x-contain py-2 [scrollbar-width:none] md:cursor-grab md:gap-4 [&::-webkit-scrollbar]:hidden ${
          dragging ? "cursor-grabbing select-none snap-none [&_a]:cursor-grabbing" : "snap-x snap-mandatory"
        }`}
        onPointerDown={(event) => {
          // Touch and pen scroll natively; only a primary mouse button drags.
          if (event.pointerType !== "mouse" || event.button !== 0 || !listRef.current) return;
          drag.current = { x: event.clientX, left: listRef.current.scrollLeft, pointer: event.pointerId, moved: false };
          swallowClick.current = false;
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          const list = listRef.current;
          if (!state || !list) return;
          const dx = event.clientX - state.x;
          if (!state.moved) {
            if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
            state.moved = true;
            list.setPointerCapture(state.pointer);
            setDragging(true);
          }
          list.scrollLeft = state.left - dx;
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        // Images and links would otherwise start the browser's own drag-and-drop.
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
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
