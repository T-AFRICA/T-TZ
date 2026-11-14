import Link from "next/link";
import {
  BellIcon,
  BrandMark,
  CartIcon,
  Container,
  HeartIcon,
  MeterIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "@tronic/ui";
import { METER_NAV_ITEM } from "@tronic/country-config";
import { AccountButton } from "./AccountButton";
import { MobileNav } from "./MobileNav";
import { MobileSearch } from "./MobileSearch";
import { SmartScroll } from "./SmartScroll";
import { SearchBox } from "@/components/search/SearchBox";
import { CartCountBadge, CartCountText, WishlistCountBadge, WishlistCountText } from "@/components/cart/CountBadge";
import {
  CART_LINK,
  CHECK_WARRANTY_LINK,
  WISHLIST_LINK,
  TRACK_ORDER_LINK,
} from "@/config/site";

/**
 * Sticky global header: one row. Desktop: logo, search field, order and
 * account actions. Phones (owner brief 2026-11-14): menu, centred logo,
 * search button, notifications; the search button opens the search panel
 * (MobileSearch) and the whole header slides away while scrolling down
 * (SmartScroll). Red logo on white per brand guide §9; mobile collapses
 * navigation into the drawer.
 *
 * The red category navbar is not in here: the root layout renders it right
 * after this header, outside the sticky element, so on desktop it scrolls
 * away with the page and is back when the page is at the top (owner request
 * 2026-11-09). No scroll listener and no layout shift.
 *
 * The red top bar (announcement ticker, social links, support phone, country
 * selector) is hidden by owner request (2026-11-09). AnnouncementTicker and
 * the SOCIAL_LINKS / SUPPORT_PHONE config stay in the codebase so it can
 * return; the country selector is still in the mobile drawer.
 */
export function Header() {
  return (
    <header className="site-header sticky top-0 z-40 bg-white shadow-sm max-md:bg-[var(--color-off-white)] max-md:shadow-none">
      <SmartScroll />
      {/* Main row */}
      <Container className="relative flex h-[var(--header-height)] items-center gap-3 lg:gap-8">
        <MobileNav />
        {/* Below md the logo sits dead-centre (burger left, actions right);
            from md it returns to the flow next to the search field. On the
            narrowest phones (under 344px) it is drawn a little smaller, so
            it stays centred and clear of the search button. */}
        <Link
          href="/"
          className="shrink-0 max-md:absolute max-md:left-1/2 max-md:top-1/2 max-md:-translate-x-1/2 max-md:-translate-y-1/2 max-[21.5rem]:scale-[0.84]"
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
              tab bar; the header keeps search and then notifications
              (owner brief 2026-11-14: Menu, Logo, Search, Notification). */}
          <MobileSearch />
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:bg-[var(--surface-card)] md:hidden"
          >
            <BellIcon size={20} />
          </Link>
          <Link
            href={WISHLIST_LINK.href}
            className="relative hidden h-10 w-10 items-center justify-center rounded-md transition-colors hover:text-[var(--color-action-red)] md:flex"
          >
            <HeartIcon size={23} />
            <span className="sr-only">{WISHLIST_LINK.label}</span>
            <WishlistCountText />
            <WishlistCountBadge className="-right-0.5 top-0" />
          </Link>
          <Link
            href={CART_LINK.href}
            className="relative hidden h-10 w-10 items-center justify-center rounded-md transition-colors hover:text-[var(--color-action-red)] md:flex"
          >
            <CartIcon size={24} />
            <span className="sr-only">{CART_LINK.label}</span>
            <CartCountText />
            <CartCountBadge className="-right-0.5 top-0" />
          </Link>
          {/* Red account CTA (owner request, Nov 2026), placed after the
              cart (owner request Nov 2026): "Login", or "Account" for a
              signed-in customer. */}
          <AccountButton />
        </div>
      </Container>
    </header>
  );
}
