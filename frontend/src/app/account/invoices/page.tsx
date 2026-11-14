import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { ButtonLink, EmptyState, NotConnected, PageHeading, PortalPage, formatDate, money } from "@/components/account/ui";
import { createAccountService } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";

export const metadata: Metadata = { title: "Invoices" };

/**
 * /account/invoices — invoices and receipts issued for the customer's
 * orders. Invoices must come from the accounting workflow; this site has
 * none connected, so no invoice is generated here from order data. The
 * order pages remain the purchase record until then.
 */
export default async function AccountInvoicesPage() {
  const user = await requireCustomer();
  const result = await createAccountService(user).listInvoices();

  return (
    <PortalPage>
      <PageHeading eyebrow="Billing" title="Invoices" description="Invoices and receipts for your orders." />

      <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
        {result.status === "not_connected" ? (
          <NotConnected
            icon={FileText}
            title="Invoices are not available online yet"
            body="Invoices will be listed here to view and download once they are issued by our accounting system. Until then, each order page shows what you bought and what it cost."
            waitingFor={result.waitingFor}
            action={<ButtonLink href="/account/orders" variant="outline">View my orders</ButtonLink>}
          />
        ) : result.data.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" body="Invoices for your orders will be listed here." />
        ) : (
          <ul className="divide-y divide-[var(--color-light-grey)]" aria-label="Invoices">
            {result.data.map((invoice) => (
              <li key={invoice.invoiceNumber} className="flex flex-wrap items-center justify-between gap-3 p-4 md:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-bold tabular-nums">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {formatDate(invoice.issuedAt)} · Order{" "}
                    <Link href={`/account/orders/${invoice.orderNumber}`} className="font-semibold hover:text-[var(--color-action-red)]">
                      {invoice.orderNumber}
                    </Link>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold tabular-nums">{money(invoice.totalMinor, invoice.currency)}</p>
                  {invoice.downloadUrl ? (
                    <a
                      href={invoice.downloadUrl}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-light-grey)] px-4 text-[13px] font-semibold transition-colors hover:border-[var(--color-premium-black)]"
                    >
                      <Download size={15} aria-hidden="true" />
                      PDF
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalPage>
  );
}
