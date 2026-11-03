import type { InputHTMLAttributes } from "react";
import { Field, controlClasses, fieldDescribedBy } from "./Field";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}

/** Text input with label, hint and accessible validation state (§10). */
export function Input({ id, label, hint, error, required, className: _ignored, ...rest }: InputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(id, hint, error)}
        className={controlClasses(error)}
        {...rest}
      />
    </Field>
  );
}
