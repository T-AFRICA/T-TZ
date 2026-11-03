export interface SkeletonProps {
  /** Tailwind sizing/shape classes, e.g. "h-4 w-32" or "aspect-square w-full rounded-xl". */
  className?: string;
}

/**
 * Loading placeholder (§10): a pulsing neutral block. The pulse is removed
 * by the global reduced-motion override. Always pair a skeleton group with
 * a visually-hidden "Loading…" live region in the consuming component.
 */
export function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-[var(--color-light-grey)]/70 ${className}`} />;
}
