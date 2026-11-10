import Image from "next/image";
import type { ProductSearchHit } from "@tronic/types";
import { ChevronRightIcon } from "@tronic/ui";
import { ACTIVE_COUNTRY, formatMoney } from "@tronic/country-config";

/** Product page of a hit; the only product route (no duplicate pages). */
export function productHref(hit: Pick<ProductSearchHit, "slug">): string {
  return `/products/${encodeURIComponent(hit.slug)}`;
}

/** Price in the active country's format, e.g. "TZS 28,000". */
export function formatHitPrice(amount: number, currency: string): string {
  return formatMoney(amount, ACTIVE_COUNTRY, currency);
}

export function isOnSale(hit: Pick<ProductSearchHit, "price" | "wasPrice">): hit is { price: number; wasPrice: number } {
  return hit.wasPrice !== undefined && hit.wasPrice > hit.price;
}

/** Wraps the parts of the name that match a query word in <mark>; plain text, never HTML. */
export function HighlightedName({ name, query }: { name: string; query: string }) {
  const tokens = [...new Set(query.toLowerCase().split(" ").filter((token) => token.length > 0))];
  if (tokens.length === 0) {
    return <>{name}</>;
  }
  const lower = name.toLowerCase();
  const marked = new Array<boolean>(name.length).fill(false);
  for (const token of tokens) {
    let at = lower.indexOf(token);
    while (at !== -1) {
      marked.fill(true, at, at + token.length);
      at = lower.indexOf(token, at + token.length);
    }
  }
  const parts: React.ReactNode[] = [];
  let start = 0;
  for (let i = 1; i <= name.length; i += 1) {
    if (i === name.length || marked[i] !== marked[start]) {
      const text = name.slice(start, i);
      parts.push(
        marked[start] ? (
          <mark key={start} className="bg-transparent font-bold text-inherit">
            {text}
          </mark>
        ) : (
          text
        ),
      );
      start = i;
    }
  }
  return <>{parts}</>;
}

/**
 * One autocomplete row: thumbnail, name, SKU and category, then price
 * (sale price in TRONIC red with the old price struck through) and stock.
 * Rendered inside the listbox option's link by SearchBox.
 */
export function SearchResultItem({ hit, query }: { hit: ProductSearchHit; query: string }) {
  const onSale = isOnSale(hit);
  return (
    <>
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--color-light-grey)] bg-white md:h-16 md:w-16">
        <Image src={hit.image} alt="" fill sizes="64px" className="object-contain p-1.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--text-primary)]">
          <HighlightedName name={hit.name} query={query} />
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">
          SKU {hit.sku} · {hit.categoryName}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end text-right">
        <span
          className={`text-[13px] font-bold ${onSale ? "text-[var(--color-action-red)]" : "text-[var(--color-premium-black)]"}`}
        >
          {formatHitPrice(hit.price, hit.currency)}
        </span>
        {onSale ? (
          <span className="text-[11px] text-[var(--text-muted)] line-through">
            {formatHitPrice(hit.wasPrice, hit.currency)}
          </span>
        ) : null}
        <span
          className={`mt-0.5 text-[11px] font-medium ${hit.inStock ? "text-[var(--color-success)]" : "text-[var(--text-muted)]"}`}
        >
          {hit.inStock ? "In stock" : "Out of stock"}
        </span>
      </span>
      <ChevronRightIcon size={16} className="search-row-chevron shrink-0 text-[var(--text-muted)] max-sm:hidden" />
    </>
  );
}
