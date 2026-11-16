import type { Metadata } from "next";
import Link from "next/link";
import { ORDER_STATUSES, type OrderStatus } from "@tronic/api-contracts";
import { can } from "@tronic/permissions";
import { Cell, DataTable, EmptyRow, Notice, PageHeader, Pagination, Panel, StatusPill, buttonClass, inputClass } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, formatMinor, isOrderStatus, paymentStatusLabel } from "@/features/orders/labels";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Orders" };

/**
 * The orders of one country, read from that country's own backend with a
 * signed request. Nothing is stored or cached here: what is shown is what
 * the country answered for this page load, or the reason it could not be
 * asked.
 */
export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { admin, country } = await requireCountry((await params).country, "orders.read");
  const query = await searchParams;
  const status = typeof query.status === "string" && isOrderStatus(query.status) ? query.status : undefined;
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  const requestedPage = Number.parseInt(typeof query.page === "string" ? query.page : "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10_000 ? requestedPage : 1;

  const api = await countryApiFor(admin, country);
  const result = await api.listOrders(admin.actor.userId, { ...(status ? { status } : {}), ...(search ? { q: search } : {}), page });

  const base = `/c/${country.id}/orders`;
  const hrefFor = (next: { status?: OrderStatus | undefined; page?: number }) => {
    const values = new URLSearchParams();
    if (next.status) values.set("status", next.status);
    if (search) values.set("q", search);
    if (next.page && next.page > 1) values.set("page", String(next.page));
    const text = values.toString();
    return text ? `${base}?${text}` : base;
  };

  const header = (
    <PageHeader
      eyebrow={country.name}
      title="Orders"
      description={`Orders placed on ${country.name}'s storefront, read live from ${country.name}'s own system.`}
    />
  );

  if (!result.available) {
    return (
      <>
        {header}
        <Notice tone="warn" title={`${country.name}'s orders cannot be shown right now`}>
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
        {can(admin.actor, "settings.read", country.id) ? (
          <div>
            <Link href={`/c/${country.id}/settings`} className={buttonClass.secondary}>
              Service connection
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted">Ask your Country Super Admin or a Master Super Admin to check the service connection.</p>
        )}
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

  return (
    <>
      {header}

      <nav aria-label="Order status" className="flex flex-wrap gap-2">
        <Link href={hrefFor({})} aria-current={!status ? "true" : undefined} className={chip(!status)}>
          All <span className="tabular-nums text-muted">{everything}</span>
        </Link>
        {ORDER_STATUSES.map((value) => (
          <Link key={value} href={hrefFor({ status: value })} aria-current={status === value ? "true" : undefined} className={chip(status === value)}>
            {ORDER_STATUS_LABEL[value]} <span className="tabular-nums text-muted">{list.counts[value] ?? 0}</span>
          </Link>
        ))}
      </nav>

      <Panel
        title={`${list.total} ${list.total === 1 ? "order" : "orders"}`}
        flush
        actions={
          <form method="get" action={base} role="search" className="flex flex-wrap items-end gap-2">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Order number, name, email or phone
              <input type="search" name="q" defaultValue={search} maxLength={80} className={`${inputClass} min-w-56 py-2`} />
            </label>
            <button type="submit" className={buttonClass.secondary}>
              Search
            </button>
          </form>
        }
      >
        {list.orders.length === 0 ? (
          <EmptyRow
            title={search || status ? "No orders match" : "No orders yet"}
            description={search || status ? "Try another status or clear the search." : `Orders appear here as soon as customers place them on ${country.name}'s storefront.`}
          />
        ) : (
          <DataTable caption="Orders" head={["Order", "Placed", "Customer", "Items", "Total", "Payment", "Status"]}>
            {list.orders.map((order) => (
              <tr key={order.orderNumber}>
                <Cell>
                  <Link href={`${base}/${order.orderNumber}`} className="whitespace-nowrap font-semibold text-ink underline-offset-4 hover:underline">
                    {order.orderNumber}
                  </Link>
                </Cell>
                <Cell className="whitespace-nowrap text-muted">{formatDateTime(order.createdAt)}</Cell>
                <Cell>
                  <p className="text-ink">{order.contactName}</p>
                  {order.deliveryRegion ? <p className="text-xs text-muted">{order.deliveryRegion}</p> : null}
                </Cell>
                <Cell className="tabular-nums text-muted">{order.itemCount}</Cell>
                <Cell className="whitespace-nowrap font-medium tabular-nums text-ink">{formatMinor(order.totalMinor, order.currency, order.currencyExponent)}</Cell>
                <Cell className="whitespace-nowrap text-muted">{paymentStatusLabel(order.paymentStatus)}</Cell>
                <Cell>
                  <StatusPill tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</StatusPill>
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
