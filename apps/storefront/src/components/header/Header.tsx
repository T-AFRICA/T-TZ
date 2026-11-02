import Link from "next/link";
import { BrandMark, CartIcon, Container, HeartIcon, PhoneIcon, TruckIcon, UserIcon } from "@tronic/ui";
import { METER_NAV_ITEM } from "@tronic/country-config";
import { Navbar } from "./Navbar";
import { MobileNav } from "./MobileNav";
import { SearchBox } from "@/components/search/SearchBox";
import { CountrySelector } from "@/components/country/CountrySelector";
import {
  ACCOUNT_LINK,
  ANNOUNCEMENT,
  CART_LINK,
  WISHLIST_LINK,
  COMPANY_LINKS,
  SOCIAL_LINKS,
  SUPPORT_PHONE,
  TRACK_ORDER_LINK,
} from "@/config/site";

/**
 * Global header, three tiers matching the TRONIC storefront layout:
 * announcement bar (premium black), utility row (company links + country),
 * main row (logo, search, order/account actions), then the red category
 * navbar. Red logo on white per brand guide §9; mobile collapses navigation
 * into the drawer and keeps search on its own row.
 */
export function Header() {
  const socials = SOCIAL_LINKS.filter(
    (link): link is { label: string; href: string } => link.href !== null,
  );

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      {/* Tier 1 — announcement */}
      <p className="bg-[var(--color-premium-black)] px-4 py-2 text-center text-xs font-medium tracking-wide text-white sm:text-sm">
        {ANNOUNCEMENT.message}{" "}
        <Link
          href={ANNOUNCEMENT.href}
          className="font-semibold underline decoration-[var(--color-brand-red)] decoration-2 underline-offset-4 hover:text-[var(--color-light-grey)]"
        >
          {ANNOUNCEMENT.linkLabel}
        </Link>
      </p>

      {/* Tier 2 — utility row (desktop) */}
      <div className="hidden border-b border-[var(--color-light-grey)] lg:block">
        <Container className="flex h-9 items-center justify-between text-xs">
          <nav aria-label="Company">
            <ul className="flex items-center gap-6">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--color-action-red)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-4">
            {socials.length > 0 ? (
              <ul className="flex items-center gap-3" aria-label="Social media">
                {socials.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-[var(--text-muted)] hover:text-[var(--color-action-red)]">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <CountrySelector />
          </div>
        </Container>
      </div>

      {/* Tier 3 — main row */}
      <Container className="flex h-[var(--header-height)] items-center gap-3 lg:gap-8">
        <MobileNav />
        <Link href="/" className="shrink-0" aria-label="TRONIC Tanzania home">
          <BrandMark tone="light" />
        </Link>
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <SearchBox />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 lg:gap-6">
          <Link
            href={TRACK_ORDER_LINK.href}
            className="hidden items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--color-action-red)] lg:flex"
          >
            <TruckIcon size={24} className="text-[var(--color-action-red)]" />
            {TRACK_ORDER_LINK.label}
          </Link>
          <Link
            href={METER_NAV_ITEM.href}
            className="hidden items-center rounded-full bg-[var(--color-action-red)] px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-[var(--color-action-red-dark)] lg:inline-flex"
          >
            {METER_NAV_ITEM.label}
          </Link>
          <a
            href={SUPPORT_PHONE.href}
            className="hidden items-center gap-2 text-sm font-semibold text-[var(--color-action-red)] xl:flex"
          >
            <PhoneIcon size={18} />
            {SUPPORT_PHONE.label}
          </a>
          <Link
            href={ACCOUNT_LINK.href}
            className="flex h-10 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors hover:text-[var(--color-action-red)]"
          >
            <UserIcon size={22} />
            <span className="hidden lg:inline">{ACCOUNT_LINK.label}</span>
          </Link>
          <Link
            href={WISHLIST_LINK.href}
            aria-label={WISHLIST_LINK.label}
            className="hidden h-10 w-10 items-center justify-center rounded-md transition-colors hover:text-[var(--color-action-red)] sm:flex"
          >
            <HeartIcon size={23} />
          </Link>
          <Link
            href={CART_LINK.href}
            aria-label={CART_LINK.label}
            className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:text-[var(--color-action-red)]"
          >
            <CartIcon size={24} />
          </Link>
        </div>
      </Container>

      {/* Mobile search row */}
      <div className="border-t border-[var(--color-light-grey)] md:hidden">
        <Container className="py-2.5">
          <SearchBox />
        </Container>
      </div>

      <Navbar />
    </header>
  );
}
