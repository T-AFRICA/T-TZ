import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@tronic/ui";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import { parseBuyNowParams } from "@/features/checkout/links";
import { ordersEnabled } from "@/features/data/source";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

const HEADING_FONT = { fontFamily: "var(--font-heading, var(--font-fallback-heading))" };

/**
 * /checkout — the cart's lines, or one Buy Now line from the URL
 * (?buy=<id>&qty=&color=&variant=), validated here before the page renders.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const buyNowLine = parseBuyNowParams(await searchParams);
  return (
    <>
      <div className="border-b border-[var(--color-light-grey)]/70 bg-white">
        <Container className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 py-4 lg:py-6">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
              <ol className="flex flex-wrap items-center gap-x-1.5">
                <li>
                  <Link href="/" className="transition-colors hover:text-[var(--color-action-red)]">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true" className="text-[var(--color-light-grey)]">/</li>
                <li>
                  <Link href="/cart" className="transition-colors hover:text-[var(--color-action-red)]">
                    Cart
                  </Link>
                </li>
                <li aria-hidden="true" className="text-[var(--color-light-grey)]">/</li>
                <li aria-current="page" className="font-medium text-[var(--text-secondary)]">
                  Checkout
                </li>
              </ol>
            </nav>
            <h1 className="mt-2 text-[1.6rem] font-bold leading-tight tracking-[-0.01em] lg:text-[2rem]" style={HEADING_FONT}>
              Checkout
            </h1>
          </div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Prices checked on our server
          </p>
        </Container>
      </div>
      <CheckoutView buyNowLine={buyNowLine} ordersEnabled={ordersEnabled()} />
    </>
  );
}
