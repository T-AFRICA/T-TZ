"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartIcon, GridIcon, HeartIcon, HomeIcon, UserIcon } from "@tronic/ui";
import { ACCOUNT_LINK, CART_LINK, SIGNED_IN_ACCOUNT_LINK, WISHLIST_LINK } from "@/config/site";
import { useSignedInHint } from "@/features/auth/sessionHint";
import type { IconProps } from "@tronic/ui";
import { CartCountBadge, CartCountText, WishlistCountBadge, WishlistCountText } from "@/components/cart/CountBadge";

interface TabItem {
  href: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  /** Pathname that marks this tab active ("/#…" anchors never match). */
  activePath: string | null;
}

/**
 * Mobile bottom tab bar (approved mobile UI reference, Nov 2026): Home,
 * Categories, Wishlist, Cart, Profile. Profile opens the sign-in page for
 * a visitor and the account for a signed-in customer; Wishlist and Cart
 * show this browser's item counts (features/cart), never invented numbers.
 * Hidden from md upward.
 */
const TABS: readonly TabItem[] = [
  { href: "/", label: "Home", icon: HomeIcon, activePath: "/" },
  { href: "/#departments", label: "Categories", icon: GridIcon, activePath: null },
  { href: WISHLIST_LINK.href, label: "Wishlist", icon: HeartIcon, activePath: WISHLIST_LINK.href },
  { href: CART_LINK.href, label: "Cart", icon: CartIcon, activePath: CART_LINK.href },
  { href: ACCOUNT_LINK.href, label: "Profile", icon: UserIcon, activePath: ACCOUNT_LINK.href },
];

export function BottomNav() {
  const pathname = usePathname();
  const signedIn = useSignedInHint();
  const tabs = TABS.map((tab) =>
    tab.href === ACCOUNT_LINK.href && signedIn ? { ...tab, href: SIGNED_IN_ACCOUNT_LINK.href, activePath: SIGNED_IN_ACCOUNT_LINK.href } : tab,
  );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-light-grey)] bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.activePath !== null &&
            (pathname === tab.activePath || (tab.activePath === SIGNED_IN_ACCOUNT_LINK.href && Boolean(pathname?.startsWith(`${tab.activePath}/`))));
          return (
            <li key={tab.label} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors active:scale-95 ${
                  isActive
                    ? "text-[var(--color-action-red)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {/* Active tab marker: short red bar hugging the top border */}
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-px left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-b-full bg-[var(--color-action-red)]"
                  />
                ) : null}
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
