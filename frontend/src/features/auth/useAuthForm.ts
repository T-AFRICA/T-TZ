"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { AUTH_ERROR_TEXT, type AuthResult } from "./service";
import type { Errors } from "./rules";

/**
 * Shared form state for the four account screens: values, per-field
 * errors shown after a field is left or the form is submitted, one
 * submission at a time, focus on the first invalid field, and the result
 * message from the auth service. Values live only in React state; they
 * are never written to storage or logged.
 */
export function useAuthForm<T extends object>({
  initial,
  validate,
  submit,
}: {
  initial: T;
  validate: (values: T) => Errors<T>;
  submit: (values: T) => Promise<AuthResult>;
}) {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const allErrors = validate(values);
  const errors: Errors<T> = {};
  for (const key of Object.keys(allErrors) as (keyof T)[]) {
    if (touched[key]) errors[key] = allErrors[key];
  }

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }, []);

  const touch = useCallback((key: keyof T) => {
    setTouched((current) => ({ ...current, [key]: true }));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const found = validate(values);
    setTouched(Object.fromEntries(Object.keys(values).map((key) => [key, true])) as Partial<Record<keyof T, boolean>>);
    const first = (Object.keys(values) as (keyof T)[]).find((key) => found[key]);
    if (first) {
      setMessage(null);
      formRef.current?.querySelector<HTMLElement>(`[name="${String(first)}"]`)?.focus();
      return;
    }
    setPending(true);
    try {
      const result = await submit(values);
      // A successful result is handled by the caller when auth is connected
      // (redirect, session); until then every result is a failure code.
      if (!result.ok) {
        setMessage({ tone: result.code === "not_connected" ? "info" : "error", text: AUTH_ERROR_TEXT[result.code] });
      }
    } catch {
      setMessage({ tone: "error", text: AUTH_ERROR_TEXT.network });
    } finally {
      setPending(false);
    }
  }

  return { values, errors, pending, message, formRef, setValue, touch, onSubmit };
}
