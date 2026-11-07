import Link from "next/link";
import {
  BellIcon,
  BrandMark,
  CartIcon,
  Container,
  FacebookIcon,
  HeartIcon,
  InstagramIcon,
  MeterIcon,
  PhoneIcon,
  ShieldCheckIcon,
  TikTokIcon,
  TruckIcon,
  UserIcon,
  type IconProps,
} from "@tronic/ui";
import { METER_NAV_ITEM } from "@tronic/country-config";
import { Navbar } from "./Navbar";
import { MobileNav } from "./MobileNav";
import { AnnouncementTicker } from "./AnnouncementTicker";
import { SearchBox } from "@/components/search/SearchBox";
import { CountrySelector } from "@/components/country/CountrySelector";
import {
  ACCOUNT_LINK,
  CART_LINK,
  CHECK_WARRANTY_LINK,
  WISHLIST_LINK,
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
const SOCIAL_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  Facebook: FacebookIcon,
  Instagram: InstagramIcon,
  TikTok: TikTokIcon,
};

export function Header() {
  const socials = SOCIAL_LINKS.filter(
    (link): link is { label: string; href: string } => link.href !== null,
  );

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm max-md:bg-[var(--color-off-white)] max-md:shadow-none">
      {/* Tier 1 — announcement bar with the utilities folded in (owner
          request Nov 2026: the old second utility row is gone; company
          links moved into the red navbar). */}
      <div className="bg-[var(--color-action-red)] text-white/95">
        <Container className="flex min-h-8 items-center justify-center gap-6 py-1 lg:justify-between">
          <AnnouncementTicker />
          <div className="hidden shrink-0 items-center gap-4 lg:flex">
            {socials.length > 0 ? (
              <ul className="flex items-center gap-1" aria-label="Social media">
                {socials.map((link) => {
                  const Icon = SOCIAL_ICONS[link.label];
                  return (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        aria-label={link.label}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/15 hover:text-white"
                      >
                        {Icon ? <Icon size={15} /> : <span className="text-xs">{link.label}</span>}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <a
              href={SUPPORT_PHONE.href}
              className="flex items-center gap-1.5 text-xs font-medium text-white/85 transition-colors hover:text-white"
            >
              <PhoneIcon size={13} className="text-white/80" />
              {SUPPORT_PHONE.label}
            </a>
            <CountrySelector tone="dark" />
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
            className="group hidden items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--color-action-red)] lg:flex"
          >
            <TruckIcon size={22} className="text-[var(--color-dark-grey)] transition-colors group-hover:text-[var(--color-action-red)]" />
            {TRACK_ORDER_LINK.label}
          </Link>
          {/* xl+ only: at lg the search field would be squeezed out */}
          <Link
            href={CHECK_WARRANTY_LINK.href}
            className="group hidden items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--color-action-red)] xl:flex"
          >
            <ShieldCheckIcon size={21} className="text-[var(--color-dark-grey)] transition-colors group-hover:text-[var(--color-action-red)]" />
            {CHECK_WARRANTY_LINK.label}
          </Link>
          <Link
            href={METER_NAV_ITEM.href}
            className="group hidden items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--color-action-red)] lg:flex"
          >
            <MeterIcon size={22} className="text-[var(--color-dark-grey)] transition-colors group-hover:text-[var(--color-action-red)]" />
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
          {/* Red account CTA (owner request, Nov 2026), placed after the
              cart (owner request Nov 2026). */}
          <Link
            href={ACCOUNT_LINK.href}
            className="hidden items-center gap-2 rounded-full bg-[var(--color-action-red)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)] md:flex"
          >
            <UserIcon size={18} />
            <span className="hidden lg:inline">{ACCOUNT_LINK.label}</span>
          </Link>
        </div>
      </Container>

      {/* Mobile search row — seamless on the off-white app background */}
      <div className="md:hidden">
        <Container className="pb-2.5 pt-0.5">
          <SearchBox />
        </Container>
      </div>

      <Navbar />
    </header>
  );
}
