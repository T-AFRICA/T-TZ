import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Info } from "lucide-react";
import { Pagination } from "@/components/account/OrdersToolbar";
import { ButtonLink, EmptyState, NotConnected, PageHeading, PortalPage, StatusBadge, formatDate, money } from "@/components/account/ui";
import { parseOrderFilters, type SearchParams } from "@/features/account/orderQuery";
import { createAccountService } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, paymentStatusTone } from "@/features/orders/status";

export const metadata: Metadata = { title: "Payments" };

/**
 * /account/payments — payment activity as the order records know it: the
 * method chosen at checkout, the amount and the payment status our team
 * recorded. No payment provider is connected, so there are no transaction
 * references and nothing is ever marked paid by this page.
 */
export default async function AccountPaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireCustomer();
  const { page } = parseOrderFilters(await searchParams);
  const result = await createAccountService(user).listPayments({ page, pageSize: 15 });

  return (
    <PortalPage>
      <PageHeading eyebrow="Billing" title="Payments" description="How each of your orders is paid and whether the payment has been recorded." />

      {result.status === "not_connected" ? (
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
          <NotConnected
            icon={CreditCard}
            title="Payment history is not connected yet"
            body="Once online ordering is connected, the payment status of each order will show here."
            waitingFor={result.waitingFor}
          />
        </div>
      ) : result.data.items.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
          <EmptyState
            icon={CreditCard}
            title="No payments yet"
            body="Payments for your orders will be listed here."
            action={<ButtonLink href="/">Start shopping</ButtonLink>}
          />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
            {/* Table from md; stacked rows on phones (same data, no sideways scrolling). */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-[var(--color-light-grey)] text-xs text-[var(--text-secondary)]">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Order</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Date</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Method</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Reference</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-light-grey)]">
                {result.data.items.map((payment) => (
                  <tr key={payment.orderNumber}>
                    <td className="px-5 py-3.5 font-semibold tabular-nums">
                      <Link href={`/account/orders/${payment.orderNumber}`} className="hover:text-[var(--color-action-red)]">
                        {payment.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 text-[var(--text-secondary)]">{formatDate(payment.orderedAt)}</td>
                    <td className="px-3 py-3.5">{PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}</td>
                    <td className="px-3 py-3.5 text-[var(--text-secondary)]">{payment.transactionReference ?? "—"}</td>
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{money(payment.amountMinor, payment.currency)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <StatusBadge tone={paymentStatusTone(payment.status)}>{PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-[var(--color-light-grey)] md:hidden" aria-label="Payments">
              {result.data.items.map((payment) => (
                <li key={payment.orderNumber} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/account/orders/${payment.orderNumber}`} className="text-sm font-bold tabular-nums hover:text-[var(--color-action-red)]">
                        {payment.orderNumber}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {formatDate(payment.orderedAt)} · {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                      </p>
                    </div>
                    <StatusBadge tone={paymentStatusTone(payment.status)}>{PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm font-bold tabular-nums">{money(payment.amountMinor, payment.currency)}</p>
                </li>
              ))}
            </ul>
          </div>
          <Pagination basePath="/account/payments" params={new URLSearchParams()} page={result.data.page} pageCount={result.data.pageCount} />
        </>
      )}

      <p className="flex items-start gap-2 rounded-2xl bg-white px-4 py-3.5 text-xs text-[var(--text-secondary)] shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
        <Info size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          Orders are currently paid on delivery. A payment shows as paid once our team has recorded it. Card and mobile-money payments,
          and their transaction references, will appear here when an online payment provider is connected.
        </span>
      </p>
    </PortalPage>
  );
}
