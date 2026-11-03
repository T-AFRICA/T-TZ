import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** "border" for white pages (desktop), "float" for the off-white app shell. */
  variant?: "border" | "float";
  /** Adds the shared hover lift used by tiles and product cards. */
  interactive?: boolean;
  children: ReactNode;
}

/** Surface container matching the established tile language (§10). */
export function Card({ variant = "border", interactive = false, className, children, ...rest }: CardProps) {
  const classes = [
    "rounded-xl bg-white",
    variant === "border"
      ? "border border-[var(--color-light-grey)]"
      : "shadow-[0_3px_14px_rgba(17,17,17,0.06)]",
    interactive
      ? "transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-mid-grey)] hover:shadow-[0_12px_28px_-16px_rgba(17,17,17,0.35)]"
      : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
