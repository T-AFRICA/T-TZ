"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { AUTH_ERROR_TEXT, AUTH_NOT_CONNECTED_MESSAGE } from "./service";
import type { Errors } from "./rules";
import type { AuthFormState } from "./state";

/**
 * Shared state for the four account forms. The form itself posts to a
 * server action (method POST, never a URL query): with JavaScript this hook
 * validates first and lets the post go only when the input is valid; without
 * JavaScript the browser posts directly and the server action validates.
 *
 * - Errors show after a field is left or a submit was attempted; errors
 *   from the server (a post without JavaScript) show until the field is
 *   edited.
 * - `enabled` is false while auth is not configured: submission is blocked
 *   and the form says so.
 * - Values live only in React state; they are never written to storage,
 *   a URL or a log.
 */
export function useAuthForm<T extends object>({
  initial,
  validate,
  state,
  enabled,
}: {
  initial: T;
  validate: (values: T) => Errors<T>;
  /** The latest server-action result (useActionState). */
  state: AuthFormState;
  enabled: boolean;
}) {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [editedSince, setEditedSince] = useState<{ state: AuthFormState; keys: Set<keyof T> } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const clientErrors = validate(values);
  const serverErrors = (state.status === "invalid" || state.status === "error" ? state.fieldErrors : undefined) ?? {};
  const edited = editedSince?.state === state ? editedSince.keys : new Set<keyof T>();
  const errors: Errors<T> = {};
  for (const key of Object.keys(values) as (keyof T)[]) {
    if (touched[key] && clientErrors[key]) errors[key] = clientErrors[key];
    else if (!edited.has(key) && serverErrors[key as string]) errors[key] = serverErrors[key as string];
  }

  const setValue = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValues((current) => ({ ...current, [key]: value }));
      setEditedSince((current) => ({
        state,
        keys: new Set([...(current?.state === state ? current.keys : []), key]),
      }));
    },
    [state],
  );

  const touch = useCallback((key: keyof T) => {
    setTouched((current) => ({ ...current, [key]: true }));
  }, []);

  /** Lets the post go only when enabled and valid; otherwise shows why. */
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!enabled) {
      event.preventDefault();
      return;
    }
    const found = validate(values);
    setTouched(Object.fromEntries(Object.keys(values).map((key) => [key, true])) as Partial<Record<keyof T, boolean>>);
    const first = (Object.keys(values) as (keyof T)[]).find((key) => found[key]);
    if (first) {
      event.preventDefault();
      formRef.current?.querySelector<HTMLElement>(`[name="${String(first)}"]`)?.focus();
    }
  }

  const hideMessage = editedSince?.state === state;
  let message: { tone: "info" | "error"; text: string } | null = null;
  if (!enabled) message = { tone: "info", text: AUTH_NOT_CONNECTED_MESSAGE };
  else if (!hideMessage && state.status === "error") {
    message = { tone: state.code === "not_connected" ? "info" : "error", text: AUTH_ERROR_TEXT[state.code] };
  } else if (!hideMessage && state.status === "sent") message = { tone: "info", text: state.text };

  return { values, errors, message, formRef, setValue, touch, onSubmit };
}
