import type { ReactNode, SelectHTMLAttributes } from "react";
import { Field, controlClasses, fieldDescribedBy } from "./Field";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/** Native select with label, hint, chevron and accessible validation state (§10). */
export function Select({ id, label, hint, error, required, className: _ignored, children, ...rest }: SelectProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <span className="relative block">
        <select
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(id, hint, error)}
          className={`${controlClasses(error)} appearance-none pr-10`}
          {...rest}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </Field>
  );
}
