"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartIcon, GridIcon, HeartIcon, HomeIcon, UserIcon } from "@tronic/ui";
import { ACCOUNT_LINK, CART_LINK, WISHLIST_LINK } from "@/config/site";
import type { IconProps } from "@tronic/ui";

interface TabItem {
  href: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  /** Pathname that marks this tab active ("/#…" anchors never match). */
  activePath: string | null;
}

/**
 * Mobile bottom tab bar (approved mobile UI reference, Nov 2026): Home,
 * Categories, Wishlist, Cart, Profile. Wishlist/cart/account routes are W03-04
 * placeholder pages for now; no fake badge counts are rendered — real counts
 * arrive with the cart/wishlist modules. Hidden from md upward.
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

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-light-grey)] bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.activePath !== null && pathname === tab.activePath;
          return (
            <li key={tab.label} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "text-[var(--color-action-red)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon size={21} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
