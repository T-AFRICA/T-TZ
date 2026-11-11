"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Field, controlClasses, fieldDescribedBy } from "@tronic/ui";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Extra ids for aria-describedby (e.g. the password requirements list). */
  describedBy?: string;
}

/**
 * Password field on the shared Field chrome, with a Show/Hide toggle. The
 * toggle is a real button (keyboard and screen-reader reachable, with
 * aria-pressed) and does not submit the form.
 */
export function PasswordInput({ id, label, hint, error, required, describedBy, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const described = [fieldDescribedBy(id, hint, error), describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <span className="relative block">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${controlClasses(error)} !pr-16`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--text-primary)]"
        >
          <span className="sr-only">{visible ? "Hide password" : "Show password"}</span>
          <span aria-hidden="true">{visible ? "Hide" : "Show"}</span>
        </button>
      </span>
    </Field>
  );
}
