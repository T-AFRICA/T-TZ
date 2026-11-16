"use client";

import { buttonClass } from "@/components/ui";

/** Shown when a console page fails to load. Never shows the error itself. */
export default function ConsoleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-bold text-ink">This page could not be loaded</h1>
      <p className="text-sm text-muted">Something went wrong on our side. Nothing was changed. Try again; if it keeps happening, tell a Master Super Admin.</p>
      <button type="button" onClick={reset} className={buttonClass.primary}>
        Try again
      </button>
    </div>
  );
}
