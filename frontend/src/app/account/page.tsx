import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@tronic/ui";
import { ACTIVE_COUNTRY, formatMoney } from "@tronic/country-config";
import { listCustomerOrders, type CustomerOrder } from "@tronic/database";
import { signOutAction } from "@/features/auth/actions";
import { currentUser } from "@/features/auth/server";
import { getDb, ordersEnabled } from "@/features/data/source";
import { ORDER_STATUS_LABELS } from "@/features/orders/status";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };

const HEADING_FONT = { fontFamily: "var(--font-heading, var(--font-fallback-heading))" };

/**
 * /account — protected. The proxy sends signed-out visitors to /login and
 * this page checks the session again with Supabase Auth. Orders are read as
 * the authenticated role, so Row Level Security returns this customer's
 * orders only.
 */
export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  let orders: CustomerOrder[] | null = null;
  if (ordersEnabled()) {
    orders = await listCustomerOrders(getDb(), { role: "authenticated", userId: user.id });
  }

  return (
    <Container className="py-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-action-red)]">TRONIC account</p>
          <h1 className="mt-1 text-[1.75rem] font-bold leading-tight" style={HEADING_FONT}>
            {user.fullName ? `Hello, ${user.fullName}` : "Your account"}
          </h1>
          {user.email ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{user.email}</p> : null}
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-full border border-[var(--color-light-grey)] bg-white px-5 text-sm font-semibold transition-colors hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
          >
            Sign out
          </button>
        </form>
      </div>

      <section aria-labelledby="orders-heading" className="mt-8 rounded-2xl bg-white p-4 md:border md:border-[var(--color-light-grey)] md:p-6">
        <h2 id="orders-heading" className="text-base font-bold md:text-lg" style={HEADING_FONT}>
          Your orders
        </h2>
        {orders === null ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Online ordering is not connected yet.</p>
        ) : orders.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            No orders yet.{" "}
            <Link href="/" className="font-semibold text-[var(--color-action-red)] hover:underline">
              Start shopping
            </Link>
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-light-grey)]" aria-label="Orders">
            {orders.map((order) => (
              <li key={order.orderNumber} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  <span className="block font-semibold tabular-nums">{order.orderNumber}</span>
                  <span className="block text-xs text-[var(--text-secondary)]">
                    {new Date(order.createdAt).toLocaleDateString(ACTIVE_COUNTRY.locale, { dateStyle: "medium" })} ·{" "}
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(order.totalMinor, ACTIVE_COUNTRY, order.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
