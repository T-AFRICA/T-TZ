import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";

/**
 * Branded 404. Category slugs that don't exist land here via notFound();
 * tone stays helpful and routes people back into the catalogue.
 */
export default function NotFound() {
  return (
    <Container className="flex flex-col items-center py-16 text-center lg:py-24">
      <p
        aria-hidden="true"
        className="text-6xl font-bold tracking-tight text-[var(--color-light-grey)]"
        style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
      >
        404
      </p>
      <h1 className="mt-3 text-[length:var(--text-h2)] font-bold leading-tight">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        The address may be mistyped, or the page may have moved. Everything electrical is still a
        click away.
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
