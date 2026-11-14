import type { Metadata } from "next";
import { Package, SearchX } from "lucide-react";
import { OrderCard } from "@/components/account/OrderCard";
import { OrdersToolbar, Pagination } from "@/components/account/OrdersToolbar";
import { ButtonLink, EmptyState, NotConnected, PageHeading, PortalPage } from "@/components/account/ui";
import { filterParams, parseOrderFilters, toOrderQuery, type SearchParams } from "@/features/account/orderQuery";
import { createAccountService, loadLineImages } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";

export const metadata: Metadata = { title: "My orders" };

const BASE = "/account/orders";

/**
 * /account/orders — every order of the signed-in customer, with status
 * tabs, search by order number, a date range, sorting and paging. All of it
 * is applied in the database for this customer only.
 */
export default async function AccountOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireCustomer();
  const filters = parseOrderFilters(await searchParams);
  const service = createAccountService(user);
  const result = await service.listOrders(toOrderQuery(filters));
  const images = result.status === "ok" ? await loadLineImages(result.data.items) : new Map<string, string>();
  const filtered = filters.tab !== "all" || filters.q !== "" || filters.from !== "" || filters.to !== "";

  return (
    <PortalPage>
      <PageHeading eyebrow="Orders" title="My orders" description="Every order you have placed with this account." />

      {result.status === "not_connected" ? (
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
          <NotConnected
            icon={Package}
            title="Your orders will appear here"
            body="Online ordering is not connected to this site yet, so there are no orders to show."
            waitingFor={result.waitingFor}
          />
        </div>
      ) : (
        <>
          <OrdersToolbar basePath={BASE} values={filters} />
          {result.data.items.length === 0 ? (
            <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
              {filtered ? (
                <EmptyState
                  icon={SearchX}
                  title="No orders match these filters"
                  body="Try another status, a different date range or part of the order number."
                  action={<ButtonLink href={BASE} variant="outline">Clear filters</ButtonLink>}
                />
              ) : (
                <EmptyState
                  icon={Package}
                  title="No orders yet"
                  body="When you place an order it will show up here with its status."
                  action={<ButtonLink href="/">Start shopping</ButtonLink>}
                />
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
                {result.data.total} {result.data.total === 1 ? "order" : "orders"}
              </p>
              <ul className="space-y-3" aria-label="Orders">
                {result.data.items.map((order) => (
                  <li key={order.orderNumber}>
                    <OrderCard order={order} images={images} />
                  </li>
                ))}
              </ul>
              <Pagination basePath={BASE} params={filterParams(filters)} page={result.data.page} pageCount={result.data.pageCount} />
            </>
          )}
        </>
      )}
    </PortalPage>
  );
}
