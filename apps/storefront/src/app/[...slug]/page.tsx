import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";

export const metadata = {
  title: "Page under construction",
  robots: { index: false, follow: false },
};

/**
 * Catch-all placeholder for routes that are planned but not yet built
 * (About, Locations, Blog, Showrooms and the eight policy pages — Week 6;
 * cart/checkout/account — Weeks 3-4). It keeps header and footer links
 * honest instead of returning 404s, and is excluded from indexing.
 */
export default function PlaceholderPage() {
  return (
    <Container className="flex flex-col items-center py-16 text-center lg:py-24">
      <span
        aria-hidden="true"
        className="grid h-16 w-16 place-items-center rounded-full bg-white text-[var(--color-action-red)] shadow-[0_3px_14px_rgba(17,17,17,0.08)] md:bg-[var(--surface-card)] md:shadow-none"
      >
        {/* simple hard-hat / construction mark */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 16a8 8 0 0 1 16 0" />
          <path d="M10 8.5V5.8a2 2 0 0 1 4 0v2.7" />
          <path d="M2.5 16h19M4.5 19h15" />
        </svg>
      </span>
      <h1 className="mt-5 text-[length:var(--text-h2)] font-bold leading-tight">
        This page is on the way
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        This part of the TRONIC Tanzania site is scheduled for a later build phase and its content
        is pending business approval.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-action-red)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)]"
        >
          Back to home
        </Link>
        <Link
          href="/#departments"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-light-grey)] bg-white px-6 py-2.5 text-sm font-medium transition-colors hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
        >
          Browse departments
          <ArrowRightIcon size={14} />
        </Link>
      </div>
    </Container>
  );
}
