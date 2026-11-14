"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SearchIcon, XIcon } from "@tronic/ui";
import { SearchBox } from "@/components/search/SearchBox";

/** From this width the header shows the search field itself (Tailwind md). */
const DESKTOP_QUERY = "(min-width: 48rem)";

/**
 * Phone search (owner brief 2026-11-14): a compact search button in the
 * single-row mobile header, just before Notifications. Tapping it opens a
 * full-width panel over the top of the page with the same SearchBox the
 * desktop header uses, so product, SKU and model search, the suggestions
 * and the quick view all work exactly as before. Nothing is duplicated:
 * this component only decides where the box is shown.
 *
 * Built on the native <dialog> like the drawer: showModal keeps focus
 * inside, Escape closes it, focus returns to the search button, and it
 * sits in the top layer above the header. The box is mounted only while
 * the panel is open, so there is one search field in the page at a time.
 */
export function MobileSearch() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    setOpen(false);
  }, []);

  function show() {
    const dialog = dialogRef.current;
    // Open first: the field can only take focus inside an open dialog.
    if (dialog && !dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    setOpen(true);
  }

  // Turning a phone or resizing to the desktop layout: the header has its
  // own field there, so the panel steps aside.
  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (desktop.matches) close();
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [open, close]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={show}
        aria-label="Search products"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:bg-[var(--surface-card)]"
      >
        <SearchIcon size={20} />
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Search products"
        className="mobile-search m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/45"
        // Escape, or any other way the browser closes the dialog.
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // A tap on the dimmed page (the dialog element itself) closes the panel.
          if (event.target === dialogRef.current) close();
        }}
      >
        <div className="mobile-search-bar flex items-center gap-2 bg-[var(--color-off-white)] px-4 py-3 shadow-[0_10px_30px_-18px_rgba(17,17,17,0.45)]">
          <div className="min-w-0 flex-1">{open ? <SearchBox autoFocus onClose={close} onNavigate={close} /> : null}</div>
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:bg-[var(--surface-card)]"
          >
            <XIcon size={20} />
          </button>
        </div>
      </dialog>
    </div>
  );
}
