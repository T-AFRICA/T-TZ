import type { ReactNode } from "react";

interface StateProps {
  title: string;
  description?: string;
  /** Usually a Button or a Link styled as one. */
  action?: ReactNode;
}

/** Empty result state (§10): quiet, centered, with an optional way forward. */
export function EmptyState({ title, description, action }: StateProps) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 py-12 text-center">
      <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-full bg-[var(--surface-card)] text-[var(--text-muted)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M16.5 16.5 21 21M8.5 11h5" />
        </svg>
      </span>
      <p className="mt-1 font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-[var(--text-secondary)]">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Error state (§10): alert semantics, explicit retry affordance. */
export function ErrorState({ title, description, action }: StateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-12 text-center">
      <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-full bg-[#fdecec] text-[var(--color-action-red)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 2.8 19.5h18.4L12 3Z" />
          <path d="M12 9.5v4.5M12 17v.3" />
        </svg>
      </span>
      <p className="mt-1 font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-[var(--text-secondary)]">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
