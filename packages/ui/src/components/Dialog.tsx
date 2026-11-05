"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Modal dialog (§10) on the native <dialog> element: focus containment,
 * Escape and backdrop-click close for free. The title is wired up for
 * assistive tech; body scroll stays with the platform default.
 */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Unique per instance — several dialogs can be mounted at once.
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop (the dialog element itself) closes it.
        if (event.target === ref.current) {
          onClose();
        }
      }}
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-xl backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-light-grey)] px-5 py-4">
        <h2 id={titleId} className="font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="group flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-card)] transition-colors hover:bg-[var(--color-light-grey)]"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 18 18"
            fill="none"
            className="transition-transform duration-200 group-hover:rotate-90"
          >
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
