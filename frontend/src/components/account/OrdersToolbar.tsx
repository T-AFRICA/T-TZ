import Link from "next/link";
import { Search } from "lucide-react";

/**
 * Order list filters. Status tabs are links and the search, sort and date
 * controls are one GET form, so filtering works without JavaScript and the
 * filtering itself happens on the server (features/account/orderQuery).
 * The filters hold no personal data: a status, a sort, dates and part of
 * the customer's own order number.
 */
export interface OrderFilterTab {
  key: string;
  label: string;
}

export const ORDER_FILTER_TABS: readonly OrderFilterTab[] = [
  { key: "all", label: "All orders" },
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

export interface OrderFilterValues {
  tab: string;
  q: string;
  sort: "newest" | "oldest";
  from: string;
  to: string;
}

function tabHref(basePath: string, values: OrderFilterValues, tab: string): string {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("status", tab);
  if (values.q) params.set("q", values.q);
  if (values.sort !== "newest") params.set("sort", values.sort);
  if (values.from) params.set("from", values.from);
  if (values.to) params.set("to", values.to);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

const FIELD =
  "h-11 w-full rounded-xl border border-[var(--color-light-grey)] bg-white px-3 text-sm outline-none transition-colors focus:border-[var(--color-action-red)]";

export function OrdersToolbar({ basePath, values }: { basePath: string; values: OrderFilterValues }) {
  const filtered = values.q !== "" || values.from !== "" || values.to !== "" || values.sort !== "newest" || values.tab !== "all";
  return (
    <div className="space-y-3">
      <nav aria-label="Filter orders by status">
        <ul className="-mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
          {ORDER_FILTER_TABS.map((tab) => {
            const active = values.tab === tab.key;
            return (
              <li key={tab.key} className="shrink-0">
                <Link
                  href={tabHref(basePath, values, tab.key)}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? "bg-[var(--color-premium-black)] text-white"
                      : "bg-white text-[var(--text-primary)] shadow-[0_1px_2px_rgba(17,17,17,0.06)] hover:text-[var(--color-action-red)]"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action={basePath} className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(17,17,17,0.04)] md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto] md:items-end md:gap-3 md:p-4">
        {values.tab !== "all" ? <input type="hidden" name="status" value={values.tab} /> : null}
        <label className="col-span-2 block md:col-span-1">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Order number</span>
          <span className="relative block">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              name="q"
              defaultValue={values.q}
              placeholder="e.g. TZ-261114"
              maxLength={40}
              autoComplete="off"
              className={`${FIELD} pl-9`}
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">From</span>
          <input type="date" name="from" defaultValue={values.from} className={FIELD} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">To</span>
          <input type="date" name="to" defaultValue={values.to} className={FIELD} />
        </label>
        <label className="col-span-2 block md:col-span-1">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Sort</span>
          <select name="sort" defaultValue={values.sort} className={FIELD}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <div className="col-span-2 flex gap-2 md:col-span-1">
          <button
            type="submit"
            className="h-11 flex-1 rounded-full bg-[var(--color-premium-black)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red)] md:flex-none"
          >
            Apply
          </button>
          {filtered ? (
            <Link
              href={basePath}
              className="inline-flex h-11 items-center rounded-full border border-[var(--color-light-grey)] px-4 text-sm font-semibold transition-colors hover:border-[var(--color-premium-black)]"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  );
}

export function Pagination({ basePath, params, page, pageCount }: { basePath: string; params: URLSearchParams; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const next = new URLSearchParams(params);
    if (target > 1) next.set("page", String(target));
    else next.delete("page");
    const query = next.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  const LINK =
    "inline-flex h-10 items-center rounded-full border border-[var(--color-light-grey)] bg-white px-4 text-sm font-semibold transition-colors hover:border-[var(--color-premium-black)]";
  const OFF = "inline-flex h-10 cursor-not-allowed items-center rounded-full border border-[var(--color-light-grey)] px-4 text-sm font-semibold text-[var(--text-muted)]";
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={LINK}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={OFF}>
          Previous
        </span>
      )}
      <p className="text-sm text-[var(--text-secondary)]">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={LINK}>
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className={OFF}>
          Next
        </span>
      )}
    </nav>
  );
}
