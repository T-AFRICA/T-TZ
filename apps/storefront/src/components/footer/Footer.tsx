import Link from "next/link";
import { BrandMark, Container } from "@tronic/ui";
import { ACTIVE_COUNTRY, CATEGORY_SECTIONS, METER_NAV_ITEM } from "@tronic/country-config";
import { COMPANY_LINKS, POLICY_LINKS } from "@/config/site";

/**
 * Global footer: white-on-dark per brand guide §9 ("Footer on dark: White
 * logo"). Link targets map to the SRS §7.1 informational and policy pages,
 * which are built in Week 6.
 */
export function Footer() {
  return (
    <footer className="border-t-4 border-[var(--color-brand-red)] bg-[var(--surface-footer)] text-[var(--text-on-dark)]">
      <Container className="grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-12">
        <div className="max-w-sm">
          <BrandMark tone="dark" />
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Electrical supplies, LED lighting and switchgear for homes, businesses and industry.
          </p>
          <p className="mt-3 text-sm text-white/70">
            Prices in {ACTIVE_COUNTRY.currency} ({ACTIVE_COUNTRY.name}).
          </p>
        </div>
        <nav aria-label="Shop">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Shop</h2>
          <ul className="mt-4 space-y-2.5">
            {CATEGORY_SECTIONS.map((section) => (
              <li key={section.slug}>
                <Link
                  href={`/categories/${section.slug}`}
                  className="text-sm text-[var(--color-light-grey)] hover:text-white"
                >
                  {section.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={METER_NAV_ITEM.href}
                className="text-sm font-semibold text-white hover:underline"
              >
                {METER_NAV_ITEM.label}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Company">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Company</h2>
          <ul className="mt-4 space-y-2.5">
            {COMPANY_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-[var(--color-light-grey)] hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Help and policies">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Help &amp; Policies</h2>
          <ul className="mt-4 space-y-2.5">
            {POLICY_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-[var(--color-light-grey)] hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <div className="border-t border-[var(--color-dark-grey)]">
        {/* white/60 keeps AA contrast on the premium-black footer (the
            mid-grey token sat at 3.9:1 here) */}
        <Container className="flex flex-col gap-2 py-4 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TRONIC {ACTIVE_COUNTRY.name}. All rights reserved.</p>
          <p>Founded 1993 · Present in over 10 African countries</p>
        </Container>
      </div>
    </footer>
  );
}
