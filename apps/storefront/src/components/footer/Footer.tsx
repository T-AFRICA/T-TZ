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
      <Container className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <BrandMark tone="dark" />
          <p className="mt-3 text-sm text-[var(--color-light-grey)]">
            Electrical supplies, LED lighting and switchgear for homes, businesses and industry.
          </p>
          <p className="mt-3 text-sm text-[var(--color-light-grey)]">
            Prices in {ACTIVE_COUNTRY.currency} ({ACTIVE_COUNTRY.name}).
          </p>
        </div>
        <nav aria-label="Shop">
          <h2 className="text-sm font-bold uppercase tracking-wide">Shop</h2>
          <ul className="mt-3 space-y-2">
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
          <h2 className="text-sm font-bold uppercase tracking-wide">Company</h2>
          <ul className="mt-3 space-y-2">
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
          <h2 className="text-sm font-bold uppercase tracking-wide">Help &amp; Policies</h2>
          <ul className="mt-3 space-y-2">
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
        <Container className="flex flex-col gap-2 py-4 text-xs text-[var(--color-mid-grey)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TRONIC {ACTIVE_COUNTRY.name}. All rights reserved.</p>
          <p>Founded 1993 · Present in over 10 African countries</p>
        </Container>
      </div>
    </footer>
  );
}
