"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ProductSearchHit } from "@tronic/types";
import { SearchQuickView } from "./SearchQuickView";

/**
 * Phone and touch quick view (owner request 2026-11-10): tapping a search
 * result opens this bottom sheet instead of the product page. It holds the
 * same SearchQuickView as the desktop column, laid out for a narrow screen.
 *
 * Built like FilterSheet on the native <dialog>: showModal gives focus
 * containment, Escape and the back gesture close it, a tap on the backdrop
 * closes it, and the slide-down plays before the dialog really closes.
 * The sheet sits in the top layer, above the header and the bottom tab bar.
 */
export function SearchQuickSheet({
  hit,
  onClosed,
  onNavigate,
}: {
  /** Product to show; null keeps the sheet closed. */
  hit: ProductSearchHit | null;
  /** The dialog has finished closing (after the slide-down). */
  onClosed: () => void;
  /** A link or Buy Now left the page: close the sheet and the search panel. */
  onNavigate: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || !dialog.open || dialog.dataset.closing !== undefined) {
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      dialog.close();
      return;
    }
    dialog.dataset.closing = "";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      dialog.removeEventListener("animationend", onEnd);
      delete dialog.dataset.closing;
      dialog.close();
    };
    const onEnd = (event: AnimationEvent) => {
      if (event.target === dialog) finish();
    };
    dialog.addEventListener("animationend", onEnd);
    window.setTimeout(finish, 350);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (hit && dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [hit]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClosed);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClosed);
    };
  }, [close, onClosed]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={hit ? `Quick view: ${hit.name}` : "Quick view"}
      className="search-sheet m-0 mt-auto h-[min(88dvh,46rem)] max-h-none w-full max-w-none flex-col overflow-hidden rounded-t-2xl bg-white p-0 backdrop:bg-black/45 open:flex"
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
    >
      <div className="relative flex shrink-0 items-center justify-between border-b border-[var(--color-light-grey)] px-4 py-3">
        <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--color-light-grey)]" />
        <h2 className="pt-1 text-base font-semibold">Quick view</h2>
        <button
          type="button"
          onClick={close}
          aria-label="Close quick view"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-card)] transition-colors hover:bg-[var(--color-light-grey)]"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {hit ? (
        <div className="min-h-0 flex-1">
          <SearchQuickView
            hits={[hit]}
            active={hit}
            layout="sheet"
            onNavigate={() => {
              dialogRef.current?.close();
              onNavigate();
            }}
          />
        </div>
      ) : null}
    </dialog>
  );
}
