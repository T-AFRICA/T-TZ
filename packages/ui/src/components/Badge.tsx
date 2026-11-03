import type { ReactNode } from "react";

const VARIANTS = {
  /** Quiet grey — metadata, counts. */
  neutral: "bg-[var(--surface-card)] text-[var(--text-secondary)]",
  /** Brand red — offers and meaningful accents only (brand rule). */
  brand: "bg-[var(--color-action-red)] text-white",
  /** Premium black — e.g. the SAMPLE marker. */
  dark: "bg-[var(--color-premium-black)] text-white",
  /** Outlined — secondary tags on white surfaces. */
  outline: "border border-[var(--color-light-grey)] text-[var(--text-secondary)]",
} as const;

export interface BadgeProps {
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
}

/** Small status/label chip (§10). Never the only carrier of state — pair with text. */
export function Badge({ variant = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  );
}
