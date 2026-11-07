export interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger offset in seconds (time-based fallback browsers only). */
  delay?: number;
}

/**
 * Gentle reveal for homepage sections, now fully CSS-driven (no client JS):
 * the server HTML carries only a class, never an inline opacity:0, so the
 * content can never be stuck hidden by stalled hydration — the root cause
 * of the earlier "invisible gallery" regression. Chromium ties the
 * animation to scroll position (animation-timeline: view()); other
 * browsers play a one-shot fade on load; reduced-motion disables it
 * entirely. See .reveal-view in globals.css.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  return (
    <div
      className={`reveal-view ${className ?? ""}`.trim()}
      style={delay > 0 ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
