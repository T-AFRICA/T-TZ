import type { ReactNode } from "react";

/**
 * The heading of a sign-in page: a lit red badge, a two-tone title and the
 * step dots (signing in is one step; the second factor, where a role needs
 * it, is the second). No notes under it (owner request 2026-11-19).
 */
export function AuthHead({ icon, title, accent, step }: { icon: ReactNode; title: string; accent?: string; step?: 1 | 2 }) {
  return (
    <div className="auth-head">
      <span className="auth-badge" aria-hidden="true">
        {icon}
      </span>
      <h1 className="auth-title">
        {title}
        {accent ? (
          <>
            {" "}
            <span>{accent}</span>
          </>
        ) : null}
      </h1>
      {step ? (
        <div className="auth-steps" aria-hidden="true">
          <i className={step === 1 ? "on" : ""} />
          <i className={step === 2 ? "on" : ""} />
          <i />
        </div>
      ) : null}
    </div>
  );
}
