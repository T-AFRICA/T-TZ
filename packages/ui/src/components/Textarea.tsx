import type { TextareaHTMLAttributes } from "react";
import { Field, controlClasses, fieldDescribedBy } from "./Field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}

/** Multi-line input with label, hint and accessible validation state (§10). */
export function Textarea({ id, label, hint, error, required, className: _ignored, rows = 4, ...rest }: TextareaProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(id, hint, error)}
        className={`${controlClasses(error)} resize-y`}
        {...rest}
      />
    </Field>
  );
}
