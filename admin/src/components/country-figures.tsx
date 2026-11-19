import type { CountrySummary } from "@tronic/api-contracts";
import type { AdminCountry } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { formatMinor } from "@/features/orders/labels";
import { countryApiFor } from "@/server/country-api";
import type { AdminContext } from "@/server/session";
import { StatCard, UnavailableStat } from "./ui";

const LABELS = ["Orders", "Open orders", "Sales, last 30 days", "Customer accounts", "Products on sale", "Stock to refill"] as const;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The country dashboard's figures, counted by the country from its own
 * records when the page is opened (migration 0009). Shown to whoever holds
 * reports.read there; a figure that cannot be had says why, never a number.
 */
export async function CountryFigures({ admin, country, connected }: { admin: AdminContext; country: AdminCountry; connected: boolean }) {
  let reason: string | null = null;
  let summary: CountrySummary | null = null;
  if (!can(admin.actor, "reports.read", country.id)) {
    reason = "Your role does not include the country's reports.";
  } else {
    const result = await (await countryApiFor(admin, country)).summary(admin.actor.userId);
    if (result.available) summary = result.data;
    else reason = connected || result.reason !== "not_configured" ? SERVICE_UNAVAILABLE_TEXT[result.reason] : `Comes from ${country.name}'s own service, which is not connected to this console yet.`;
  }

  if (!summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {LABELS.map((label) => (
          <UnavailableStat key={label} label={label} reason={reason ?? ""} />
        ))}
      </div>
    );
  }

  const orders = can(admin.actor, "orders.read", country.id) ? `/c/${country.id}/orders` : undefined;
  const awaiting = summary.ordersByStatus.pending_payment ?? 0;
  const toRefill = summary.productsOutOfStock + summary.productsLowStock;
  const link = (href: string | undefined) => (href ? { href } : {});

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Orders" value={summary.ordersTotal} hint={`${count(summary.ordersToday, "order", "orders")} placed today`} {...link(orders)} />
      <StatCard
        label="Open orders"
        value={summary.ordersOpen}
        hint={`Not delivered or cancelled · ${awaiting} awaiting confirmation`}
        {...link(orders && awaiting > 0 ? `${orders}?status=pending_payment` : orders)}
      />
      <StatCard
        label="Sales, last 30 days"
        value={formatMinor(summary.sales30DaysMinor, summary.currency, summary.currencyExponent)}
        hint="Paid orders placed in the last 30 days; Cash on Delivery counts once delivered"
      />
      <StatCard label="Customer accounts" value={summary.customerAccounts} hint="Registered on the website" />
      <StatCard label="Products on sale" value={summary.productsActive} hint={`Active, with a price in ${country.name}`} />
      <StatCard
        label="Stock to refill"
        value={toRefill}
        hint={`${summary.productsOutOfStock} out of stock · ${summary.productsLowStock} with ${summary.lowStockThreshold} or fewer left`}
      />
    </div>
  );
}
