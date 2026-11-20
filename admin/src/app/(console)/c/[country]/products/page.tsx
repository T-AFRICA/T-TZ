import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_STATUSES, type ProductStatus } from "@tronic/api-contracts";
import { can } from "@tronic/permissions";
import { Cell, DataTable, EmptyRow, Notice, PageHeader, Pagination, Panel, StatusPill, buttonClass, inputClass } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { formatMinor } from "@/features/orders/labels";
import { PRODUCT_STATUS_LABEL, PRODUCT_STATUS_TONE, isProductStatus } from "@/features/products/labels";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Products" };

/**
 * The products of one country, read from that country's own backend with a
 * signed request: every product with its status (draft, live, hidden), price
 * and stock. Nothing is stored here.
 */
export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { admin, country } = await requireCountry((await params).country, "products.read");
  const query = await searchParams;
  const status = typeof query.status === "string" && isProductStatus(query.status) ? query.status : undefined;
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  const category = typeof query.category === "string" && /^[a-z0-9-]{1,80}$/.test(query.category) ? query.category : "";
  const requestedPage = Number.parseInt(typeof query.page === "string" ? query.page : "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10_000 ? requestedPage : 1;

  const api = await countryApiFor(admin, country);
  const [result, options] = await Promise.all([
    api.listProducts(admin.actor.userId, { ...(status ? { status } : {}), ...(search ? { q: search } : {}), ...(category ? { category } : {}), page }),
    api.catalogueOptions(admin.actor.userId),
  ]);

  const base = `/c/${country.id}/products`;
  const hrefFor = (next: { status?: ProductStatus | undefined; page?: number }) => {
    const values = new URLSearchParams();
    if (next.status) values.set("status", next.status);
    if (search) values.set("q", search);
    if (category) values.set("category", category);
    if (next.page && next.page > 1) values.set("page", String(next.page));
    const text = values.toString();
    return text ? `${base}?${text}` : base;
  };
  const mayCreate = can(admin.actor, "products.create", country.id);

  const header = (
    <PageHeader
      eyebrow={country.name}
      title="Products"
      description={`The catalogue of ${country.name}'s storefront, read live from ${country.name}'s own system. A new product starts as a draft until someone publishes it.`}
      actions={
        mayCreate && result.available ? (
          <Link href={`${base}/new`} className={buttonClass.primary}>
            New product
          </Link>
        ) : null
      }
    />
  );

  if (!result.available) {
    return (
      <>
        {header}
        <Notice tone="warn" title={`${country.name}'s products cannot be shown right now`}>
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
      </>
    );
  }

  const list = result.data;
  const everything = Object.values(list.counts).reduce((sum, count) => sum + (count ?? 0), 0);
  const pageCount = Math.max(1, Math.ceil(list.total / list.pageSize));
  const chip = (current: boolean) =>
    `inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      current ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink hover:bg-raised"
    }`;
  const categories = options.available ? options.data.categories : [];

  return (
    <>
      {header}

      <nav aria-label="Product status" className="flex flex-wrap gap-2">
        <Link href={hrefFor({})} aria-current={!status ? "true" : undefined} className={chip(!status)}>
          All <span className="tabular-nums text-muted">{everything}</span>
        </Link>
        {PRODUCT_STATUSES.map((value) => (
          <Link key={value} href={hrefFor({ status: value })} aria-current={status === value ? "true" : undefined} className={chip(status === value)}>
            {PRODUCT_STATUS_LABEL[value]} <span className="tabular-nums text-muted">{list.counts[value] ?? 0}</span>
          </Link>
        ))}
      </nav>

      <Panel
        title={`${list.total} ${list.total === 1 ? "product" : "products"}`}
        flush
        actions={
          <form method="get" action={base} role="search" className="flex flex-wrap items-end gap-2">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Name or SKU
              <input type="search" name="q" defaultValue={search} maxLength={80} className={`${inputClass} min-w-48 py-2`} />
            </label>
            {categories.length > 0 ? (
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Category
                <select name="category" defaultValue={category} className={`${inputClass} py-2`}>
                  <option value="">All categories</option>
                  {categories.map((entry) => (
                    <option key={entry.id} value={entry.slug}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="submit" className={buttonClass.secondary}>
              Search
            </button>
          </form>
        }
      >
        {list.products.length === 0 ? (
          <EmptyRow
            title={search || status || category ? "No products match" : "No products yet"}
            description={search || status || category ? "Try another status or category, or clear the search." : "Create the first product with New product."}
          />
        ) : (
          <DataTable caption="Products" head={["Product", "Category", "Price", "Stock", "Status"]}>
            {list.products.map((product) => (
              <tr key={product.slug}>
                <Cell>
                  <div className="flex items-start gap-3">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- served by this console from the country, already small
                      <img
                        src={`${base}/${product.slug}/images/${product.image.id}`}
                        alt=""
                        width={48}
                        height={48}
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-md border border-line bg-raised object-contain"
                      />
                    ) : (
                      <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-dashed border-line-strong text-[10px] text-muted">
                        No photo
                      </span>
                    )}
                    <div className="min-w-0">
                      <Link href={`${base}/${product.slug}`} className="font-semibold text-ink underline-offset-4 hover:underline [overflow-wrap:anywhere]">
                        {product.name}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <span className="font-mono">{product.sku}</span>
                        {product.sample ? <StatusPill tone="warn">Sample</StatusPill> : null}
                      </p>
                    </div>
                  </div>
                </Cell>
                <Cell className="text-muted">
                  {product.categoryName}
                  {product.brandName ? <p className="text-xs">{product.brandName}</p> : null}
                </Cell>
                <Cell className="whitespace-nowrap tabular-nums">
                  {product.priceMinor === null ? (
                    <span className="text-muted">No price</span>
                  ) : (
                    <>
                      <span className="font-medium text-ink">{formatMinor(product.priceMinor, list.currency, list.currencyExponent)}</span>
                      {product.wasPriceMinor ? (
                        <p className="text-xs text-muted line-through">{formatMinor(product.wasPriceMinor, list.currency, list.currencyExponent)}</p>
                      ) : null}
                    </>
                  )}
                </Cell>
                <Cell className="tabular-nums">
                  {product.available === null ? <span className="text-muted">Not set</span> : product.available === 0 ? <span className="text-danger">Out of stock</span> : product.available}
                </Cell>
                <Cell>
                  <StatusPill tone={PRODUCT_STATUS_TONE[product.status]}>{PRODUCT_STATUS_LABEL[product.status]}</StatusPill>
                </Cell>
              </tr>
            ))}
          </DataTable>
        )}
        <Pagination page={list.page} pageCount={pageCount} hrefFor={(target) => hrefFor({ status, page: target })} />
      </Panel>
    </>
  );
}
