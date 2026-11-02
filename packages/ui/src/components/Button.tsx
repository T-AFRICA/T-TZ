import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium " +
  "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-[var(--color-action-red)] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-action-red)] text-white hover:bg-[var(--color-brand-red)]",
  outline:
    "border border-[var(--color-light-grey)] bg-white text-[var(--text-primary)] " +
    "hover:border-[var(--color-dark-grey)]",
  ghost: "bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-card)]",
};

export function Button({ variant = "primary", className, children, ...rest }: ButtonProps) {
  const classes = [base, variants[variant], className].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
