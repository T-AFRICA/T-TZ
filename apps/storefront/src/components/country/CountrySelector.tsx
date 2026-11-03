"use client";

import { useEffect, useRef, useState } from "react";
import { ACTIVE_COUNTRY, COUNTRIES } from "@tronic/country-config";
import { ChevronDownIcon, GlobeIcon } from "@tronic/ui";

/**
 * Country display and switcher. Countries are isolated deployments
 * (SSD AD-02): other countries appear only once their deployments are live
 * (origin set) — no "coming soon" entries. With no live alternatives the
 * selector is a plain label. It never changes pricing, catalog or
 * authorization client-side (SRS FR-059).
 */
export function CountrySelector({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toneClasses =
    tone === "dark" ? "text-white/85 [&_.muted]:text-white/50" : "[&_.muted]:text-[var(--text-muted)]";

  const linkedCountries = COUNTRIES.filter(
    (country) => country.code !== ACTIVE_COUNTRY.code && country.origin !== null,
  );

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const activeLabel = (
    <>
      <GlobeIcon
        size={15}
        className={tone === "dark" ? "text-white/80" : "text-[var(--color-action-red)]"}
      />
      <span>
        {ACTIVE_COUNTRY.name}
        <span className="muted"> · {ACTIVE_COUNTRY.currency}</span>
      </span>
    </>
  );

  if (linkedCountries.length === 0) {
    return (
      <span className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium ${toneClasses}`}>
        {activeLabel}
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setIsOpen((open) => !open)}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:text-[var(--color-action-red)] ${toneClasses}`}
      >
        {activeLabel}
        <ChevronDownIcon size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen ? (
        <ul
          aria-label="Choose country"
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-[var(--color-light-grey)] bg-white py-1 shadow-md"
        >
          <li>
            <span className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
              {ACTIVE_COUNTRY.name} ({ACTIVE_COUNTRY.currency})
              <span aria-hidden="true" className="text-[var(--color-action-red)]">
                ✓
              </span>
            </span>
          </li>
          {linkedCountries.map((country) => (
            <li key={country.code}>
              <a
                href={country.origin ?? "#"}
                className="block px-3 py-2 text-sm hover:bg-[var(--surface-card)]"
              >
                {country.name} ({country.currency})
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
