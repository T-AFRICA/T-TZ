"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { SlidersIcon } from "@tronic/ui";

/**
 * Mobile filter bottom sheet on the native <dialog> element (focus
 * containment and Escape for free). Opening slides the sheet up and fades
 * the backdrop; closing plays the slide down before the dialog really
 * closes, the same approach as the menu drawer. The sheet's children are the
 * same server-rendered FiltersForm as the desktop sidebar.
 */
export function FilterSheet({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || !dialog.open || dialog.dataset.closing !== undefined) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.close();
      return;
    }
    dialog.dataset.closing = "";
    let done = false;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      dialog.removeEventListener("animationend", onEnd);
      delete dialog.dataset.closing;
      dialog.close();
    };
    const onEnd = (event: AnimationEvent) => {
      if (event.target === dialog) {
        finish();
      }
    };
    dialog.addEventListener("animationend", onEnd);
    window.setTimeout(finish, 350);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const onCancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [close]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-light-grey)] bg-white px-3.5 text-[13px] font-medium transition-colors duration-150 hover:border-[var(--color-premium-black)]"
      >
        <SlidersIcon size={16} />
        Filters
        {activeCount > 0 ? (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-action-red)] px-1.5 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Categories and filters"
        className="filter-sheet m-0 mt-auto max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-white p-0 backdrop:bg-black/45"
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            close();
          }
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-light-grey)] bg-white px-4 py-3">
          <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--color-light-grey)]" />
          <h2 className="pt-1 text-base font-semibold">Categories &amp; Filters</h2>
          <button
            type="button"
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-card)] transition-colors hover:bg-[var(--color-light-grey)]"
            aria-label="Close filters"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </dialog>
    </div>
  );
}
