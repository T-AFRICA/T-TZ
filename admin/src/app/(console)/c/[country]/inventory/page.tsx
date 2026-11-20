import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@tronic/permissions";
import { Cell, DataTable, EmptyRow, Notice, PageHeader, Pagination, Panel, StatusPill, buttonClass, inputClass } from "@/components/ui";
import { STOCK_LEVEL_LABEL, STOCK_LEVEL_TONE } from "@/features/inventory/labels";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { PRODUCT_STATUS_LABEL } from "@/features/products/labels";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Inventory" };

const FILTERS = { low: "Low", out: "Out of stock" } as const;

/**
 * The stock of every product of one country, read live from the country:
 * out of stock first, then low (each product's own level), then the rest.
 */
export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { admin, country } = await requireCountry((await params).country, "inventory.read");
  const query = await searchParams;
  const filter = query.filter === "low" || query.filter === "out" ? query.filter : undefined;
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  const requestedPage = Number.parseInt(typeof query.page === "string" ? query.page : "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10_000 ? requestedPage : 1;

  const api = await countryApiFor(admin, country);
  const result = await api.listInventory(admin.actor.userId, { ...(filter ? { filter } : {}), ...(search ? { q: search } : {}), page });

  const base = `/c/${country.id}/inventory`;
  const hrefFor = (next: { filter?: "low" | "out" | undefined; page?: number }) => {
    const values = new URLSearchParams();
    if (next.filter) values.set("filter", next.filter);
    if (search) values.set("q", search);
    if (next.page && next.page > 1) values.set("page", String(next.page));
    const text = values.toString();
    return text ? `${base}?${text}` : base;
  };
  const photos = can(admin.actor, "products.read", country.id);

  const header = (
    <PageHeader
      eyebrow={country.name}
      title="Inventory"
      description={`Units ${country.name} can sell, read live from ${country.name}'s own system. Orders take units and cancellations give them back; every change is in each product's history.`}
    />
  );

  if (!result.available) {
    return (
      <>
        {header}
        <Notice tone="warn" title={`${country.name}'s stock cannot be shown right now`}>
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
      </>
    );
  }

  const list = result.data;
  const pageCount = Math.max(1, Math.ceil(list.total / list.pageSize));
  const chip = (current: boolean) =>
    `inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      current ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink hover:bg-raised"
    }`;

  return (
    <>
      {header}

      <nav aria-label="Stock level" className="flex flex-wrap gap-2">
        <Link href={hrefFor({})} aria-current={!filter ? "true" : undefined} className={chip(!filter)}>
          All <span className="tabular-nums text-muted">{list.counts.all}</span>
        </Link>
        {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((value) => (
          <Link key={value} href={hrefFor({ filter: value })} aria-current={filter === value ? "true" : undefined} className={chip(filter === value)}>
            {FILTERS[value]} <span className="tabular-nums text-muted">{list.counts[value]}</span>
          </Link>
        ))}
      </nav>

      <Panel
        title={`${list.total} ${list.total === 1 ? "product" : "products"}`}
        flush
        actions={
          <form method="get" action={base} role="search" className="flex flex-wrap items-end gap-2">
            {filter ? <input type="hidden" name="filter" value={filter} /> : null}
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Name or SKU
              <input type="search" name="q" defaultValue={search} maxLength={80} className={`${inputClass} min-w-48 py-2`} />
            </label>
            <button type="submit" className={buttonClass.secondary}>
              Search
            </button>
          </form>
        }
      >
        {list.items.length === 0 ? (
          <EmptyRow title={search || filter ? "Nothing matches" : "No products yet"} description={filter ? "Nothing is low or out of stock here." : undefined} />
        ) : (
          <DataTable caption="Stock" head={["Product", "In stock", "Low at", "Level", "Last change"]}>
            {list.items.map((entry) => (
              <tr key={entry.slug}>
                <Cell>
                  <div className="flex items-start gap-3">
                    {entry.image && photos ? (
                      // eslint-disable-next-line @next/next/no-img-element -- served by this console from the country
                      <img
                        src={`/c/${country.id}/products/${entry.slug}/images/${entry.image.id}`}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-md border border-line bg-raised object-contain"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <Link href={`${base}/${entry.slug}`} className="font-semibold text-ink underline-offset-4 hover:underline [overflow-wrap:anywhere]">
                        {entry.name}
                      </Link>
                      <p className="text-xs text-muted">
                        <span className="font-mono">{entry.sku}</span>
                        {entry.status !== "live" ? ` · ${PRODUCT_STATUS_LABEL[entry.status]}` : ""}
                      </p>
                    </div>
                  </div>
                </Cell>
                <Cell className="text-base font-semibold tabular-nums text-ink">{entry.available}</Cell>
                <Cell className="tabular-nums text-muted">{entry.lowStockAt === 0 ? "Never" : entry.lowStockAt}</Cell>
                <Cell>
                  <StatusPill tone={STOCK_LEVEL_TONE[entry.level]}>{STOCK_LEVEL_LABEL[entry.level]}</StatusPill>
                </Cell>
                <Cell className="whitespace-nowrap text-muted">{entry.lastChangeAt ? formatDateTime(entry.lastChangeAt) : "None recorded"}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
        <Pagination page={list.page} pageCount={pageCount} hrefFor={(target) => hrefFor({ filter, page: target })} />
      </Panel>
    </>
  );
}
