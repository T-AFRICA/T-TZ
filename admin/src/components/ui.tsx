import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Presentation pieces of the console. All colours come from the console's
 * theme tokens (globals.css), so each piece reads in light and dark.
 */

export function PageHeader({ title, description, eyebrow, actions }: { title: string; description?: string; eyebrow?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-bold leading-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  flush = false,
  id,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** No inner padding: for tables that run edge to edge. */
  flush?: boolean;
  id?: string;
}) {
  return (
    <section id={id} aria-label={title} className="rounded-xl border border-line bg-surface shadow-panel">
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  text = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  /** The value is words (a product name), not a figure: smaller, at most two lines. */
  text?: boolean;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {text ? (
        <p className="mt-2 line-clamp-2 text-lg font-semibold leading-snug text-ink [overflow-wrap:anywhere]" title={String(value)}>
          {value}
        </p>
      ) : (
        <p className="mt-2 text-3xl font-bold tabular-nums text-ink">{value}</p>
      )}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  const classes = "block rounded-xl border border-line bg-surface p-5 shadow-panel";
  return href ? (
    <Link href={href} className={`${classes} transition-colors hover:border-line-strong`}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

/** A figure that comes from a country's own service and cannot be shown yet. Never a number. */
export function UnavailableStat({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-raised p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-ink">Unavailable</p>
      <p className="mt-1 text-xs text-muted">{reason}</p>
    </div>
  );
}

export type Tone = "ok" | "neutral" | "warn" | "danger" | "info";

const TONES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  neutral: "bg-raised text-muted border border-line",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

/** Status chip. The text says the state; the colour only supports it. */
export function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

const NOTICE_TONES: Record<Tone, string> = {
  ok: "border-ok/40 bg-ok-soft text-ok",
  neutral: "border-line bg-raised text-ink",
  warn: "border-warn/40 bg-warn-soft text-warn",
  danger: "border-danger/40 bg-danger-soft text-danger",
  info: "border-info/30 bg-info-soft text-info",
};

export function Notice({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-lg border ${NOTICE_TONES[tone]} px-4 py-3 text-sm`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}

export function EmptyRow({ title, description }: { title: string; description?: string }) {
  return (
    <div role="status" className="px-5 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p> : null}
    </div>
  );
}

/** A table that scrolls sideways inside its panel on narrow screens. */
export function DataTable({ caption, head, children }: { caption: string; head: string[]; children: ReactNode }) {
  return (
    <div className="table-scroll">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-raised text-xs font-semibold uppercase tracking-wide text-muted">
            {head.map((label) => (
              <th key={label} scope="col" className="px-5 py-3">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-3.5 align-top ${className}`}>{children}</td>;
}

export const buttonClass = {
  primary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-60",
  secondary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-raised disabled:pointer-events-none disabled:opacity-60",
  quiet:
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-60",
  danger:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-danger/50 bg-surface px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:pointer-events-none disabled:opacity-60",
} as const;

export const inputClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-muted hover:border-muted focus:border-ink disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted";

export function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClass.secondary} rel="prev">
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={buttonClass.secondary} rel="next">
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
