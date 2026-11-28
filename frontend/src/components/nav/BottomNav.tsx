"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartIcon, HeartIcon, HomeIcon, PackageIcon, UserIcon } from "@tronic/ui";
import { ACCOUNT_LINK, CART_LINK, PRODUCTS_LINK, SIGNED_IN_ACCOUNT_LINK, WISHLIST_LINK } from "@/config/site";
import { useSignedInHint } from "@/features/auth/sessionHint";
import type { IconProps } from "@tronic/ui";
import { CartCountBadge, CartCountText, WishlistCountBadge, WishlistCountText } from "@/components/cart/CountBadge";

interface TabItem {
  href: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  /** The tab is current on this path and, for each prefix, on every page under it. */
  activePath: string;
  activeUnder?: readonly string[];
}

/**
 * Phone bottom tab bar (owner request 2026-11-16): a rounded bar that
 * floats above the bottom edge, with Home, Products, Wishlist, Cart and
 * Profile. Products opens the list of every product (/products) and stays
 * current on product and category pages. Profile opens the sign-in page
 * for a visitor and the account for a signed-in customer; Wishlist and
 * Cart show this browser's item counts (features/cart), never invented
 * numbers. Hidden from md upward.
 *
 * The <nav> spans the screen and ignores taps so the page beside the bar
 * stays usable; it carries the bottom gap and the device safe-area inset,
 * so sliding it down by its own height hides the whole bar while a phone
 * scrolls down (header/SmartScroll.tsx, .bottom-nav in globals.css). Its
 * footprint is --bottom-nav-space in globals.css: keep the two in step.
 */
const TABS: readonly TabItem[] = [
  { href: "/", label: "Home", icon: HomeIcon, activePath: "/" },
  {
    href: PRODUCTS_LINK.href,
    label: PRODUCTS_LINK.label,
    icon: PackageIcon,
    activePath: PRODUCTS_LINK.href,
    activeUnder: [`${PRODUCTS_LINK.href}/`, "/categories/"],
  },
  { href: WISHLIST_LINK.href, label: "Wishlist", icon: HeartIcon, activePath: WISHLIST_LINK.href },
  { href: CART_LINK.href, label: "Cart", icon: CartIcon, activePath: CART_LINK.href },
  { href: ACCOUNT_LINK.href, label: "Profile", icon: UserIcon, activePath: ACCOUNT_LINK.href },
];

const SIGNED_IN_PROFILE = {
  href: SIGNED_IN_ACCOUNT_LINK.href,
  activePath: SIGNED_IN_ACCOUNT_LINK.href,
  activeUnder: [`${SIGNED_IN_ACCOUNT_LINK.href}/`],
} as const;

export function BottomNav() {
  const pathname = usePathname();
  const signedIn = useSignedInHint();
  const tabs = TABS.map((tab) => (tab.href === ACCOUNT_LINK.href && signedIn ? { ...tab, ...SIGNED_IN_PROFILE } : tab));

  return (
    <nav
      aria-label="Primary"
      className="bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
    >
      <ul className="pointer-events-auto mx-auto flex max-w-md items-stretch gap-0.5 rounded-full border border-[var(--color-light-grey)] bg-white/95 p-1 shadow-[0_10px_30px_-8px_rgba(17,17,17,0.28),0_2px_6px_rgba(17,17,17,0.06)] backdrop-blur-md">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            pathname === tab.activePath || Boolean(tab.activeUnder?.some((prefix) => pathname?.startsWith(prefix)));
          return (
            <li key={tab.label} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                data-cart-target={tab.href === CART_LINK.href ? "" : undefined}
                className={`m-press relative flex h-12 flex-col items-center justify-center gap-1 rounded-full text-[10.5px] leading-none ${
                  isActive
                    ? "bg-[#fdecec] font-semibold text-[var(--color-action-red)]"
                    : "font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="relative">
                  <Icon size={21} />
                  {tab.href === CART_LINK.href ? <CartCountBadge className="-right-2.5 -top-1.5" /> : null}
                  {tab.href === WISHLIST_LINK.href ? <WishlistCountBadge className="-right-2.5 -top-1.5" /> : null}
                </span>
                {tab.label}
                {tab.href === CART_LINK.href ? <CartCountText /> : null}
                {tab.href === WISHLIST_LINK.href ? <WishlistCountText /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
