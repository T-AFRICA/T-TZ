import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "@tronic/ui";
import { listingHref, type ListingFilters } from "@/features/catalog/catalog";

type PaginationProps = { page: number; pageCount: number } & (
  | { basePath: string; filters: ListingFilters }
  /** Any other URL scheme, e.g. the /search page. */
  | { hrefFor: (page: number) => string }
);

/** Previous / page numbers / next, as plain links so the URL carries the page. */
export function Pagination(props: PaginationProps) {
  const { page, pageCount } = props;
  if (pageCount <= 1) {
    return null;
  }
  const href = (p: number) =>
    "hrefFor" in props ? props.hrefFor(p) : listingHref(props.basePath, { ...props.filters, page: p });
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );
  const pill =
    "inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors";
  const idle = `${pill} border-[var(--color-light-grey)] bg-white hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]`;
  const disabled = `${pill} cursor-not-allowed border-[var(--color-light-grey)] text-[var(--text-muted)]`;

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={idle} aria-label="Previous page">
          <ArrowLeftIcon size={16} />
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled}>
          <ArrowLeftIcon size={16} />
        </span>
      )}
      {pages.map((p, index) => {
        const gap = index > 0 && p - (pages[index - 1] ?? p) > 1;
        return (
          <span key={p} className="contents">
            {gap ? <span aria-hidden="true" className="px-1 text-[var(--text-muted)]">…</span> : null}
            {p === page ? (
              <span aria-current="page" className={`${pill} border-[var(--color-action-red)] bg-[var(--color-action-red)] text-white`}>
                {p}
              </span>
            ) : (
              <Link href={href(p)} className={idle}>
                {p}
              </Link>
            )}
          </span>
        );
      })}
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={idle} aria-label="Next page">
          <ArrowRightIcon size={16} />
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled}>
          <ArrowRightIcon size={16} />
        </span>
      )}
    </nav>
  );
}
