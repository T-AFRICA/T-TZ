import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon } from "@tronic/ui";
import { ACTIVE_COUNTRY, formatMoney } from "@tronic/country-config";
import type { StatusTone } from "@/features/orders/status";

/** Building blocks shared by the customer portal pages (server-safe, no hooks). */

export function money(minor: number, currency: string): string {
  return formatMoney(minor, ACTIVE_COUNTRY, currency);
}

export function formatDate(iso: string, withTime = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(ACTIVE_COUNTRY.locale, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

/** Page content wrapper: plays the short portal entrance (globals.css, .account-enter). */
export function PortalPage({ children }: { children: React.ReactNode }) {
  return <div className="account-enter space-y-4 md:space-y-5">{children}</div>;
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-action-red)]">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-[1.5rem] font-bold leading-tight tracking-[-0.01em] md:text-[1.85rem]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
  labelledBy,
  bare = false,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
  /** Heading row only: the children bring their own cards (e.g. a list of order cards). */
  bare?: boolean;
}) {
  return (
    <section
      aria-labelledby={title ? labelledBy : undefined}
      className={`${bare ? "" : "rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(17,17,17,0.04)] md:p-6"} ${className}`}
    >
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={labelledBy} className="text-base font-bold md:text-lg">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const TONES: Record<StatusTone, string> = {
  neutral: "bg-[#f1f1f3] text-[var(--text-primary)]",
  progress: "bg-[#fdf1f1] text-[var(--color-action-red)]",
  success: "bg-[#e9f7ef] text-[#17743a]",
  danger: "bg-[#fdecec] text-[#b3141a]",
  warning: "bg-[#fff4e0] text-[#8a5300]",
};

/** Compact status pill; the dot repeats the tone so colour is never the only cue (the label says it). */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONES[tone]}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-action-red)] hover:underline">
      {children}
      <ArrowRightIcon size={14} />
    </Link>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors ${
        variant === "primary"
          ? "bg-[var(--color-action-red)] text-white hover:bg-[var(--color-premium-black)]"
          : "border border-[var(--color-light-grey)] bg-white text-[var(--text-primary)] hover:border-[var(--color-premium-black)]"
      }`}
    >
      {children}
    </Link>
  );
}

/** Nothing to show yet, with one way forward. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center md:py-14">
      <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-2xl bg-[#f6f6f7] text-[var(--text-secondary)]">
        <Icon size={24} />
      </span>
      <h2 className="mt-4 text-base font-bold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/**
 * A module whose backend is not connected yet. Says so plainly, names what
 * it is waiting for, and never shows sample records in its place.
 */
export function NotConnected({
  icon: Icon,
  title,
  body,
  waitingFor,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  waitingFor: string;
  action?: React.ReactNode;
}) {
  return (
    <div role="status" className="flex flex-col items-center px-4 py-10 text-center md:py-14">
      <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-2xl bg-[#fdf1f1] text-[var(--color-action-red)]">
        <Icon size={24} />
      </span>
      <p className="mt-4 rounded-full bg-[#f1f1f3] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
        Not connected yet
      </p>
      <h2 className="mt-3 text-base font-bold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-[var(--text-secondary)]">{body}</p>
      <p className="mt-2 max-w-md text-xs text-[var(--text-muted)]">Waiting for: {waitingFor}.</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** A label and its value, stacked; used in order and profile summaries. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--text-secondary)]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}
