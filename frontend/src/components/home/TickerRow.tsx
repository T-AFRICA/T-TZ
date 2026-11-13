"use client";

/**
 * A slowly moving row of product cards, right to left (owner request
 * 2026-11-12: the Offers section moves like the category rail). Pure CSS
 * (globals.css, "Product ticker"): two identical groups slide left by one
 * group, so the loop has no jump. The second group is hidden from
 * assistive tech and the keyboard (inert). Hover, touch and keyboard focus
 * pause it; a keyboard-focused card is scrolled fully into view; reduced
 * motion shows one still, swipeable row.
 *
 * `seconds` sets the speed: pass about 6s per card for 35–45px/s.
 */
export function TickerRow({ label, seconds, children }: { label: string; seconds: number; children: React.ReactNode }) {
  return (
    <div
      className="ticker-frame -my-2"
      style={{ "--ticker-duration": `${seconds}s` } as React.CSSProperties}
      onFocus={(event) => {
        if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) {
          event.target.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      }}
    >
      <div className="ticker-track py-2">
        <ul aria-label={label} className="ticker-group">
          {children}
        </ul>
        <ul aria-hidden="true" inert className="ticker-group ticker-copy">
          {children}
        </ul>
      </div>
    </div>
  );
}
