"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";

/**
 * Field and button styles shared by the four account screens (login,
 * register, forgot and reset password; owner request 2026-11-11: one design
 * for all of them). Labels stay visible, errors are linked to their input
 * with aria-describedby, and the password toggle is a real button.
 */
const FIELD_SHELL =
  "group relative flex items-center rounded-xl border bg-white transition-[border-color,box-shadow] duration-200 ease-out focus-within:shadow-[0_0_0_4px_rgba(215,25,32,0.10)]";

export type IconFieldProps = {
  label: string;
  icon: ReactNode;
  error?: string;
  trailing?: ReactNode;
  /** Extra ids for aria-describedby (e.g. password requirements). */
  describedBy?: string;
} & InputHTMLAttributes<HTMLInputElement> & { name: string };

export function IconField({ label, icon, error, trailing, describedBy, required = true, ...input }: IconFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const described = [error ? errorId : null, describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[var(--color-premium-black)]">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-[var(--color-action-red)]">
            *
          </span>
        ) : null}
      </label>
      <div
        className={`${FIELD_SHELL} ${
          error
            ? "border-[var(--color-action-red)]"
            : "border-[#f0d9d9] hover:border-[#e6bfbf] focus-within:border-[var(--color-action-red)]"
        }`}
      >
        <span aria-hidden="true" className="pointer-events-none pl-4 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--color-action-red)]">
          {icon}
        </span>
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className="auth-input h-12 min-w-0 flex-1 rounded-xl bg-transparent px-3 text-[15px] text-[var(--color-premium-black)] outline-none placeholder:text-[var(--text-muted)]"
          {...input}
        />
        {trailing}
      </div>
      {error ? (
        <p id={errorId} className="auth-message mt-1.5 text-xs font-medium text-[var(--color-action-red)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Password field with a Show/Hide toggle. */
export function PasswordField(props: Omit<IconFieldProps, "icon" | "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <IconField
      {...props}
      type={visible ? "text" : "password"}
      autoCapitalize="none"
      spellCheck={false}
      icon={<LockKeyhole size={18} strokeWidth={1.8} />}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="mr-1.5 grid h-10 w-10 place-items-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[#fff1f1] hover:text-[var(--color-action-red)]"
        >
          <span key={visible ? "hide" : "show"} className="auth-eye grid place-items-center">
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </span>
        </button>
      }
    />
  );
}

/** The red pill submit button with a loading state for the future auth calls. */
export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="login-cta group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#e8232c_0%,#c4121b_100%)] text-base font-semibold text-white shadow-[0_14px_30px_-14px_rgba(215,25,32,0.85)] transition-[transform,box-shadow,filter] duration-200 ease-out hover:-translate-y-px hover:brightness-105 hover:shadow-[0_18px_34px_-14px_rgba(215,25,32,0.9)] active:translate-y-0 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {pending ? (
        <>
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
          Please wait…
        </>
      ) : (
        <>
          {children}
          <ArrowRight size={18} aria-hidden="true" className="transition-transform duration-200 ease-out group-hover:translate-x-[3px] motion-reduce:transition-none" />
        </>
      )}
    </button>
  );
}

/** Result line under a form: the not-connected notice or an auth error. Never a success claim. */
export function AuthMessage({ message }: { message: { tone: "info" | "error"; text: string } | null }) {
  return (
    <div aria-live="polite">
      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`auth-message mt-4 rounded-xl px-4 py-3 text-sm leading-relaxed ${
            message.tone === "error"
              ? "bg-[#fdecec] text-[var(--color-action-red)]"
              : "border border-[var(--color-light-grey)] bg-[var(--surface-card)] text-[var(--text-primary)]"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
