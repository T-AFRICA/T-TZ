import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, FileText, MessageCircle, ShieldCheck, Truck, Undo2 } from "lucide-react";
import { ArrowRightIcon } from "@tronic/ui";
import { PageHeading, Panel, PortalPage, formatDate } from "@/components/account/ui";
import { whatsappHref } from "@/config/site";
import { createAccountService } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";

export const metadata: Metadata = { title: "Help & support" };

/**
 * Answers describe how this site works today, nothing more: no opening
 * hours, response times or phone numbers are promised here.
 */
const FAQS: readonly { question: string; answer: React.ReactNode }[] = [
  {
    question: "How do I track my order?",
    answer: (
      <>
        Open <Link href="/account/tracking" className="font-semibold text-[var(--color-action-red)] hover:underline">Track order</Link> to
        see your orders in progress. If you ordered without signing in, use{" "}
        <Link href="/track-order" className="font-semibold text-[var(--color-action-red)] hover:underline">Track by order number</Link> with
        the order number and the email or phone you gave at checkout.
      </>
    ),
  },
  {
    question: "How do I pay for my order?",
    answer: "Orders are paid on delivery. Online card and mobile-money payments are not available on this site yet.",
  },
  {
    question: "Can I change or cancel an order?",
    answer: "Changes and cancellations cannot be requested from your account yet. Message us with your order number and we will help.",
  },
  {
    question: "Where is my invoice?",
    answer: "Invoices are not available online yet. Your order page shows what you bought and what it cost.",
  },
  {
    question: "Why is my wishlist different on another device?",
    answer: "Your wishlist is saved in the browser you used, so it does not follow you to other devices yet.",
  },
];

const POLICIES = [
  { href: "/policies/delivery", label: "Delivery information", icon: Truck },
  { href: "/policies/returns", label: "Return policy", icon: Undo2 },
  { href: "/policies/warranty", label: "Warranty policy", icon: ShieldCheck },
  { href: "/help", label: "Help Center", icon: FileText },
] as const;

/**
 * /account/support — answers, the policy pages and the site's existing
 * WhatsApp link. A recent order can be attached to the message: the link
 * only pre-fills the chat with the order number, and nothing is sent until
 * the customer sends it themselves.
 */
export default async function AccountSupportPage() {
  const user = await requireCustomer();
  const orders = await createAccountService(user).listOrders({ pageSize: 3 });
  const recent = orders.status === "ok" ? orders.data.items : [];

  return (
    <PortalPage>
      <PageHeading eyebrow="Help" title="Help & support" description="Answers to common questions and ways to reach us." />

      <Panel title="Frequently asked questions" labelledBy="support-faq">
        <div className="divide-y divide-[var(--color-light-grey)]">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group py-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ChevronDown size={17} aria-hidden="true" className="shrink-0 text-[var(--text-secondary)] transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-3 text-sm leading-relaxed text-[var(--text-secondary)]">{faq.answer}</p>
            </details>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2 xl:gap-5">
        <Panel title="Contact TRONIC" labelledBy="support-contact">
          <p className="text-sm text-[var(--text-secondary)]">Message us on WhatsApp. Include your order number so we can find your order.</p>
          <a
            href={whatsappHref("Hello TRONIC, I need help with my account.")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#128c4a] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0e733d]"
          >
            <MessageCircle size={17} aria-hidden="true" />
            Chat on WhatsApp
          </a>
          {recent.length > 0 ? (
            <div className="mt-5 border-t border-[var(--color-light-grey)] pt-4">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Ask about a recent order</p>
              <ul className="mt-2 space-y-1.5">
                {recent.map((order) => (
                  <li key={order.orderNumber}>
                    <a
                      href={whatsappHref(`Hello TRONIC, I need help with order ${order.orderNumber}.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[var(--color-light-grey)] px-3.5 text-sm transition-colors hover:border-[var(--color-action-red)]"
                    >
                      <span className="min-w-0">
                        <span className="font-semibold tabular-nums">{order.orderNumber}</span>
                        <span className="text-[var(--text-secondary)]"> · {formatDate(order.createdAt)}</span>
                      </span>
                      <ArrowRightIcon size={14} className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--color-action-red)]" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        <Panel title="Delivery, returns and warranty" labelledBy="support-policies">
          <ul className="space-y-1.5">
            {POLICIES.map((policy) => (
              <li key={policy.href}>
                <Link
                  href={policy.href}
                  className="group flex min-h-11 items-center gap-3 rounded-xl border border-[var(--color-light-grey)] px-3.5 text-sm font-medium transition-colors hover:border-[var(--color-action-red)]"
                >
                  <policy.icon size={17} aria-hidden="true" className="shrink-0 text-[var(--text-secondary)]" />
                  <span className="flex-1">{policy.label}</span>
                  <ArrowRightIcon size={14} className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--color-action-red)]" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </PortalPage>
  );
}
