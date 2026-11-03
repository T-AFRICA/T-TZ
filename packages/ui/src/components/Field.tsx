import type { ReactNode } from "react";

/**
 * Shared chrome for form controls (master prompt §10): label, optional hint,
 * and a validation error line. The error is announced via the control's
 * aria-describedby and never communicated by colour alone.
 */
export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function fieldDescribedBy(id: string, hint?: string, error?: string) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/** Input/textarea/select share this border treatment, including the error state. */
export function controlClasses(error?: string) {
  return [
    "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm transition-colors",
    "placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:bg-[var(--surface-card)] disabled:text-[var(--text-muted)]",
    error
      ? "border-[var(--color-action-red)] pr-10"
      : "border-[var(--color-light-grey)] hover:border-[var(--color-mid-grey)] focus:border-[var(--color-dark-grey)]",
  ].join(" ");
}

export function Field({ id, label, hint, error, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-[var(--color-action-red)]">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-[var(--text-secondary)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs font-medium text-[var(--color-action-red)]">
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5M12 16.2v.3" />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  );
}
