import Link from "next/link";
import { BellIcon, BrandMark, CartIcon, Container, HeartIcon, MeterIcon, PhoneIcon, ShieldCheckIcon, TruckIcon, UserIcon } from "@tronic/ui";
import { METER_NAV_ITEM } from "@tronic/country-config";
import { Navbar } from "./Navbar";
import { MobileNav } from "./MobileNav";
import { SearchBox } from "@/components/search/SearchBox";
import { CountrySelector } from "@/components/country/CountrySelector";
import {
  ACCOUNT_LINK,
  ANNOUNCEMENT,
  CART_LINK,
  CHECK_WARRANTY_LINK,
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
    <header className="sticky top-0 z-40 bg-white shadow-sm max-md:bg-[var(--color-off-white)] max-md:shadow-none">
      {/* Tier 1 — announcement (compact, master prompt §5) */}
      <p className="bg-[var(--color-premium-black)] px-4 py-1.5 text-center text-xs font-medium tracking-wide text-white/90">
        {ANNOUNCEMENT.message}{" "}
        <Link
          href={ANNOUNCEMENT.href}
          className="font-semibold text-white underline decoration-[var(--color-brand-red)] decoration-2 underline-offset-4 transition-colors hover:text-[var(--color-light-grey)]"
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
          <div className="flex items-center gap-5">
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
            <a
              href={SUPPORT_PHONE.href}
              className="flex items-center gap-1.5 font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--color-action-red)]"
            >
              <PhoneIcon size={14} />
              {SUPPORT_PHONE.label}
            </a>
            <CountrySelector />
          </div>
        </Container>
      </div>

      {/* Tier 3 — main row */}
      <Container className="relative flex h-[var(--header-height)] items-center gap-3 lg:gap-8">
        <MobileNav />
        {/* Below md the logo sits dead-centre (burger left, actions right);
            from md it returns to the flow next to the search field. */}
        <Link
          href="/"
          className="shrink-0 max-md:absolute max-md:left-1/2 max-md:top-1/2 max-md:-translate-x-1/2 max-md:-translate-y-1/2"
          aria-label="TRONIC Tanzania home"
        >
          <BrandMark tone="light" />
        </Link>
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <SearchBox />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 lg:gap-5">
          <Link
            href={TRACK_ORDER_LINK.href}
            className="hidden items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--color-action-red)] lg:flex"
          >
            <TruckIcon size={22} className="text-[var(--color-action-red)]" />
            {TRACK_ORDER_LINK.label}
          </Link>
          {/* xl+ only: at lg the search field would be squeezed out */}
          <Link
            href={CHECK_WARRANTY_LINK.href}
            className="hidden items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--color-action-red)] xl:flex"
          >
            <ShieldCheckIcon size={21} className="text-[var(--color-action-red)]" />
            {CHECK_WARRANTY_LINK.label}
          </Link>
          <Link
            href={METER_NAV_ITEM.href}
            className="hidden items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--color-action-red)] lg:flex"
          >
            <MeterIcon size={22} className="text-[var(--color-action-red)]" />
            {METER_NAV_ITEM.label}
          </Link>
          <span aria-hidden="true" className="hidden h-6 w-px bg-[var(--color-light-grey)] lg:block" />
          {/* Below md the account/wishlist/cart actions live in the bottom
              tab bar; the header keeps a single notifications chip instead
              (approved mobile UI reference). */}
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:bg-[var(--surface-card)] md:hidden"
          >
            <BellIcon size={20} />
          </Link>
          {/* Red account CTA (owner request, Nov 2026) */}
          <Link
            href={ACCOUNT_LINK.href}
            className="hidden items-center gap-2 rounded-full bg-[var(--color-action-red)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)] md:flex"
          >
            <UserIcon size={18} />
            <span className="hidden lg:inline">{ACCOUNT_LINK.label}</span>
          </Link>
          <Link
            href={WISHLIST_LINK.href}
            aria-label={WISHLIST_LINK.label}
            className="hidden h-10 w-10 items-center justify-center rounded-md transition-colors hover:text-[var(--color-action-red)] md:flex"
          >
            <HeartIcon size={23} />
          </Link>
          <Link
            href={CART_LINK.href}
            aria-label={CART_LINK.label}
            className="hidden h-10 w-10 items-center justify-center rounded-md transition-colors hover:text-[var(--color-action-red)] md:flex"
          >
            <CartIcon size={24} />
          </Link>
        </div>
      </Container>

      {/* Mobile search row — seamless on the off-white app background */}
      <div className="md:hidden">
        <Container className="pb-3 pt-1">
          <SearchBox />
        </Container>
      </div>

      <Navbar />
    </header>
  );
}
