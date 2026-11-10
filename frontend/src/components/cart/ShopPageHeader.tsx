import Link from "next/link";
import { Container } from "@tronic/ui";

const MICRO = "text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]";
const HEADING_FONT = { fontFamily: "var(--font-heading, var(--font-fallback-heading))" };

/** Breadcrumb, eyebrow and title band shared by the cart and wishlist pages (same look as /search). */
export function ShopPageHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="border-b border-[var(--color-light-grey)]/70 bg-white">
      <Container className="py-5 lg:py-7">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
          <ol className="flex flex-wrap items-center gap-x-1.5">
            <li>
              <Link href="/" className="transition-colors hover:text-[var(--color-action-red)]">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-[var(--color-light-grey)]">/</li>
            <li aria-current="page" className="font-medium text-[var(--text-secondary)]">
              {title}
            </li>
          </ol>
        </nav>
        <p className={`${MICRO} mt-4`}>{eyebrow}</p>
        <h1
          className="mt-1 text-[1.75rem] font-bold leading-[1.15] tracking-[-0.01em] lg:text-[2rem]"
          style={HEADING_FONT}
        >
          {title}
        </h1>
      </Container>
    </div>
  );
}
