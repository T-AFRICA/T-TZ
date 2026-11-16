"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useToast } from "@tronic/ui";
import { IDLE, type FormState } from "@/features/form-state";
import { buttonClass, inputClass } from "./ui";

/**
 * Form building blocks. Every form posts to a server action and works
 * without JavaScript; with it, the result is announced inline (and as a
 * toast for successes) and fields keep their validation messages.
 */

type Action = (previous: FormState, form: FormData) => Promise<FormState>;

export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  const ok = state.status === "ok";
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`rounded-lg px-3.5 py-2.5 text-sm font-medium ${ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}
    >
      {state.message}
    </p>
  );
}

/** Shows a toast when an action succeeds, once per result. */
function useResultToast(state: FormState) {
  const { showToast } = useToast();
  const last = useRef<FormState | null>(null);
  useEffect(() => {
    if (last.current === state) return;
    last.current = state;
    if (state.status === "ok" && state.message) showToast(state.message, "success");
  }, [state, showToast]);
}

export function SubmitButton({
  pending,
  children,
  variant = "primary",
  pendingLabel = "Working…",
}: {
  pending: boolean;
  children: ReactNode;
  variant?: keyof typeof buttonClass;
  pendingLabel?: string;
}) {
  return (
    <button type="submit" className={buttonClass[variant]} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function TextField({
  name,
  label,
  error,
  hint,
  ...rest
}: {
  name: string;
  label: string;
  error?: string | undefined;
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "className">) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={inputClass} {...rest} />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  name,
  label,
  error,
  hint,
  children,
  ...rest
}: {
  name: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name" | "className">) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={inputClass} {...rest}>
        {children}
      </select>
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A form bound to a server action. `children` receives the action's last
 * result and whether it is running.
 */
export function ActionForm({
  action,
  children,
  className = "flex flex-col gap-4",
  resetOnSuccess = false,
}: {
  action: Action;
  children: (state: FormState, pending: boolean) => ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const ref = useRef<HTMLFormElement>(null);
  useResultToast(state);
  useEffect(() => {
    if (resetOnSuccess && state.status === "ok") ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} noValidate>
      {children(state, pending)}
    </form>
  );
}

/**
 * A button that asks before it acts: it opens a dialog that names what will
 * happen, and only the dialog's confirm button posts the form.
 */
export function ConfirmAction({
  action,
  fields,
  label,
  title,
  description,
  confirmLabel,
  variant = "quiet",
  reasonField,
}: {
  action: Action;
  /** Hidden fields sent with the action. */
  fields: Record<string, string>;
  /** Text of the button that opens the dialog. */
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: keyof typeof buttonClass;
  /** Adds an optional text field (e.g. a reason for a suspension). */
  reasonField?: { name: string; label: string };
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useResultToast(state);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state]);

  return (
    <>
      <button type="button" className={buttonClass[variant]} onClick={() => setOpen(true)}>
        {label}
      </button>
      <dialog ref={dialog} className="console-dialog" aria-labelledby={titleId} onClose={() => setOpen(false)}>
        <form action={formAction} className="flex flex-col gap-4 p-6">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            <p className="mt-1.5 text-sm text-muted">{description}</p>
          </div>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {reasonField ? <TextField name={reasonField.name} label={reasonField.label} maxLength={300} error={state.fieldErrors?.[reasonField.name]} /> : null}
          {state.status === "error" ? <FormMessage state={state} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={buttonClass.secondary} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <SubmitButton pending={pending} variant={variant === "danger" || variant === "quiet" ? "danger" : "primary"}>
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
