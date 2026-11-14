/**
 * Customer portal navigation (owner brief 2026-11-14), in sidebar order.
 * `match` lists every path prefix that keeps the item active; the dashboard
 * matches its own path only.
 */
export interface AccountNavItem {
  href: string;
  label: string;
  /** Short label for the phone navigation, when the full one is long. */
  shortLabel?: string;
  match: readonly string[];
  exact?: boolean;
}

export const ACCOUNT_NAV: readonly AccountNavItem[] = [
  { href: "/account", label: "Dashboard", match: ["/account"], exact: true },
  { href: "/account/orders", label: "My Orders", shortLabel: "Orders", match: ["/account/orders"] },
  { href: "/account/tracking", label: "Track Order", shortLabel: "Track", match: ["/account/tracking"] },
  { href: "/account/wishlist", label: "Wishlist", match: ["/account/wishlist"] },
  { href: "/account/addresses", label: "Addresses", match: ["/account/addresses"] },
  { href: "/account/payments", label: "Payments", match: ["/account/payments"] },
  { href: "/account/invoices", label: "Invoices", match: ["/account/invoices"] },
  { href: "/account/notifications", label: "Notifications", shortLabel: "Alerts", match: ["/account/notifications"] },
  { href: "/account/support", label: "Help & Support", shortLabel: "Support", match: ["/account/support"] },
  { href: "/account/profile", label: "Profile & Security", shortLabel: "Profile", match: ["/account/profile", "/account/security"] },
];

export function isActiveNavItem(item: AccountNavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
