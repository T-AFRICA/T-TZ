import type { Metadata } from "next";
import Link from "next/link";
import { Cell, DataTable, EmptyRow, Notice, PageHeader, Pagination, Panel, buttonClass, inputClass } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { formatMinor } from "@/features/orders/labels";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Customers" };

/** The country's customer accounts, read from its own records: newest first, searchable. Read only. */
export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { country: countryId } = await params;
  const query = await searchParams;
  const { admin, country } = await requireCountry(countryId, "customers.read");
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const requested = typeof query.page === "string" ? Number.parseInt(query.page, 10) : 1;
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const base = `/c/${country.id}/customers`;

  const api = await countryApiFor(admin, country);
  const result = await api.listCustomers(admin.actor.userId, { ...(search ? { q: search } : {}), page });
  if (!result.available) {
    return (
      <>
        <PageHeader eyebrow={country.name} title="Customers" />
        <Notice tone="warn" title={`${country.name}'s customers cannot be shown right now`}>
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
      </>
    );
  }
  const list = result.data;
  const pageCount = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hrefFor = (target: number) => {
    const values = new URLSearchParams();
    if (search) values.set("q", search);
    if (target > 1) values.set("page", String(target));
    const text = values.toString();
    return text ? `${base}?${text}` : base;
  };
  const amount = (minor: number) => formatMinor(minor, list.currency, list.currencyExponent);

  return (
    <>
      <PageHeader
        eyebrow={country.name}
        title="Customers"
        description={`Website accounts and their orders in ${country.name}. Guest checkouts have no account; find them under Orders.`}
      />
      <Panel
        title={`${list.total} ${list.total === 1 ? "customer" : "customers"}`}
        flush
        actions={
          <form method="get" action={base} role="search" className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Email, name or phone
              <input type="search" name="q" defaultValue={search} maxLength={120} className={`${inputClass} min-w-56 py-2`} />
            </label>
            <button type="submit" className={buttonClass.secondary}>
              Search
            </button>
          </form>
        }
      >
        {list.customers.length === 0 ? (
          <EmptyRow
            title={search ? "No customers match" : "No customer accounts yet"}
            description={search ? "Try another email, name or phone." : "Customers appear here once they create an account on the website."}
          />
        ) : (
          <DataTable caption="Customers" head={["Customer", "Phone", "Orders", "Paid", "Last order", "Joined"]}>
            {list.customers.map((customer) => (
              <tr key={customer.id}>
                <Cell>
                  <Link href={`${base}/${customer.id}`} className="font-medium text-ink underline-offset-4 hover:underline [overflow-wrap:anywhere]">
                    {customer.name ?? customer.email ?? "Unnamed account"}
                  </Link>
                  {customer.name && customer.email ? <p className="text-xs text-muted [overflow-wrap:anywhere]">{customer.email}</p> : null}
                </Cell>
                <Cell className="whitespace-nowrap text-muted">{customer.phone ?? "–"}</Cell>
                <Cell className="tabular-nums">{customer.orders}</Cell>
                <Cell className="whitespace-nowrap tabular-nums">{amount(customer.paidMinor)}</Cell>
                <Cell className="whitespace-nowrap text-muted">{customer.lastOrderAt ? formatDateTime(customer.lastOrderAt) : "None yet"}</Cell>
                <Cell className="whitespace-nowrap text-muted">{formatDateTime(customer.createdAt)}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <Pagination page={list.page} pageCount={pageCount} hrefFor={hrefFor} />
    </>
  );
}
